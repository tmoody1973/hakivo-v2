import { Task, Event } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * Rate limit tracking key for KV cache
 */
const RATE_LIMIT_KEY = 'netlify_audio_trigger_last_run';
const RATE_LIMIT_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes between trigger attempts

/**
 * Netlify Background Function URL
 * Background functions have 15-minute timeout (vs 30s for Raindrop Tasks)
 */
const NETLIFY_AUDIO_FUNCTION_URL = 'https://hakivo-v2.netlify.app/.netlify/functions/audio-processor-background';

/**
 * Audio Retry Scheduler - Netlify Background Function Trigger
 *
 * Runs every 5 minutes to check if there are briefs pending audio generation.
 * Instead of processing audio directly (which times out), this scheduler
 * triggers the Netlify Background Function which has a 15-minute timeout.
 *
 * The Netlify Background Function:
 * - Polls the database for briefs with status='script_ready'
 * - Calls Gemini TTS API (can take 60-90+ seconds)
 * - Uploads audio to Vultr storage
 * - Updates brief status
 *
 * Schedule: Every 5 minutes (cron: 0/5 * * * *)
 */
export default class extends Task<Env> {
  async handle(_event: Event): Promise<void> {
    console.log('🎧 [AUDIO-RETRY] Checking for briefs pending audio generation');

    try {
      // Check rate limit cooldown to avoid triggering too frequently
      const cache = this.env.DASHBOARD_CACHE;
      const lastCallStr = await cache.get(RATE_LIMIT_KEY);

      if (lastCallStr) {
        const lastCall = parseInt(lastCallStr, 10);
        const timeSinceLastCall = Date.now() - lastCall;
        if (timeSinceLastCall < RATE_LIMIT_COOLDOWN_MS) {
          const remainingMs = RATE_LIMIT_COOLDOWN_MS - timeSinceLastCall;
          console.log(`⏳ [AUDIO-RETRY] Cooldown active. ${Math.ceil(remainingMs / 1000)}s remaining. Skipping.`);
          return;
        }
      }

      const db = this.env.APP_DB;

      // Check if any briefs need audio processing
      // Look for script_ready, stuck audio_processing (older than 10 min), or audio_failed (older than 15 min for retry)
      const stuckThreshold = Date.now() - (10 * 60 * 1000); // 10 minutes ago
      const failedRetryThreshold = Date.now() - (15 * 60 * 1000); // 15 minutes ago (cooldown before retry)

      // First, reset audio_failed briefs to script_ready for retry (if older than 15 min)
      const failedBriefsToRetry = await db
        .prepare(`
          SELECT id FROM briefs
          WHERE status = 'audio_failed'
            AND updated_at < ?
            AND script IS NOT NULL
            AND script != ''
          LIMIT 5
        `)
        .bind(failedRetryThreshold)
        .all();

      const failedBriefIds = (failedBriefsToRetry.results || []).map((r: any) => r.id);

      if (failedBriefIds.length > 0) {
        console.log(`🔄 [AUDIO-RETRY] Resetting ${failedBriefIds.length} failed brief(s) for retry: ${failedBriefIds.join(', ')}`);
        for (const briefId of failedBriefIds) {
          await db
            .prepare(`UPDATE briefs SET status = 'script_ready', updated_at = ? WHERE id = ?`)
            .bind(Date.now(), briefId)
            .run();
        }
      }

      // Also reset failed podcast episodes for retry
      const failedPodcastsToRetry = await db
        .prepare(`
          SELECT id FROM podcast_episodes
          WHERE status = 'audio_failed'
            AND updated_at < ?
            AND script IS NOT NULL
            AND script != ''
          LIMIT 3
        `)
        .bind(failedRetryThreshold)
        .all();

      const failedPodcastIds = (failedPodcastsToRetry.results || []).map((r: any) => r.id);

      if (failedPodcastIds.length > 0) {
        console.log(`🔄 [AUDIO-RETRY] Resetting ${failedPodcastIds.length} failed podcast episode(s) for retry: ${failedPodcastIds.join(', ')}`);
        for (const podcastId of failedPodcastIds) {
          await db
            .prepare(`UPDATE podcast_episodes SET status = 'script_ready', updated_at = ? WHERE id = ?`)
            .bind(Date.now(), podcastId)
            .run();
        }
      }

      // Now count all briefs needing audio processing
      const briefResult = await db
        .prepare(`
          SELECT COUNT(*) as count
          FROM briefs
          WHERE (status = 'script_ready'
                 OR (status = 'audio_processing' AND updated_at < ?))
            AND script IS NOT NULL
            AND script != ''
        `)
        .bind(stuckThreshold)
        .all();

      const briefCount = (briefResult.results?.[0] as { count: number } | undefined)?.count || 0;

      // Check if any podcast episodes need audio processing
      const podcastResult = await db
        .prepare(`
          SELECT COUNT(*) as count
          FROM podcast_episodes
          WHERE (status = 'script_ready'
                 OR (status = 'audio_processing' AND updated_at < ?))
            AND script IS NOT NULL
            AND script != ''
        `)
        .bind(stuckThreshold)
        .all();

      const podcastCount = (podcastResult.results?.[0] as { count: number } | undefined)?.count || 0;

      const totalCount = briefCount + podcastCount;

      if (totalCount === 0) {
        console.log('ℹ️ [AUDIO-RETRY] No briefs or podcast episodes pending audio generation');
        return;
      }

      console.log(`📋 [AUDIO-RETRY] Found ${briefCount} brief(s) and ${podcastCount} podcast episode(s) pending audio. Triggering Netlify background function...`);

      // Update cooldown timestamp before triggering
      await cache.put(RATE_LIMIT_KEY, Date.now().toString(), { expirationTtl: 600 });

      // Trigger Netlify Background Function
      // Background functions immediately return 202 Accepted and run async
      const response = await fetch(NETLIFY_AUDIO_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trigger: 'raindrop-scheduler' }),
      });

      if (response.ok || response.status === 202) {
        console.log(`✅ [AUDIO-RETRY] Netlify background function triggered successfully (${response.status})`);
      } else {
        const errorText = await response.text();
        console.error(`❌ [AUDIO-RETRY] Failed to trigger Netlify function: ${response.status} - ${errorText}`);
      }

    } catch (error) {
      console.error('❌ [AUDIO-RETRY] Scheduler failed:', error);
      throw error;
    }
  }
}
