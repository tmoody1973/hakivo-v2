import { Task, Event } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * Podcast Scheduler - Generates nightly "100 Laws That Shaped America" episodes
 *
 * Runs daily at 2 AM to generate the next episode in the series.
 * Picks the next ungenerated law (ordered by year) and triggers
 * script generation via the podcast-generator service.
 *
 * Audio generation is handled by the same audio-processor-background
 * Netlify function that processes daily briefs (it picks up any
 * content with status='script_ready').
 *
 * Schedule: Daily at 2 AM (cron: 0 2 * * *)
 */
export default class extends Task<Env> {
  async handle(_event: Event): Promise<void> {
    console.log('🎙️ [PODCAST-SCHEDULER] Starting nightly podcast generation');

    try {
      const db = this.env.APP_DB;

      // Check how many episodes are left to generate
      const statusResult = await db
        .prepare(`
          SELECT
            (SELECT COUNT(*) FROM historic_laws) as total,
            (SELECT COUNT(*) FROM historic_laws WHERE episode_generated = 1) as generated
        `)
        .first() as { total: number; generated: number };

      const remaining = statusResult.total - statusResult.generated;

      if (remaining === 0) {
        console.log('✅ [PODCAST-SCHEDULER] All 100 episodes have been generated!');
        return;
      }

      console.log(`📊 [PODCAST-SCHEDULER] Status: ${statusResult.generated}/${statusResult.total} episodes generated, ${remaining} remaining`);

      // Check if there's already an episode being generated
      const pendingResult = await db
        .prepare("SELECT COUNT(*) as count FROM podcast_episodes WHERE status IN ('pending', 'generating')")
        .first() as { count: number };

      if (pendingResult.count > 0) {
        console.log(`⏳ [PODCAST-SCHEDULER] Episode already in progress, skipping`);
        return;
      }

      // Trigger the podcast-generator service to generate next episode
      console.log('🚀 [PODCAST-SCHEDULER] Triggering podcast-generator service...');

      const response = await this.env.PODCAST_GENERATOR.fetch(
        new Request('http://internal/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const result = await response.json() as {
        success: boolean;
        episodeId?: string;
        headline?: string;
        error?: string;
      };

      if (result.success) {
        console.log(`✅ [PODCAST-SCHEDULER] Episode generated: ${result.headline}`);
        console.log(`   Episode ID: ${result.episodeId}`);
      } else {
        console.error(`❌ [PODCAST-SCHEDULER] Generation failed: ${result.error}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ [PODCAST-SCHEDULER] Error: ${errorMessage}`);
    }
  }
}
