import { Task, Event } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * Spreaker Sync Scheduler - Uploads completed podcast episodes to Spreaker
 *
 * Runs daily at 4 AM (after podcast-scheduler at 2 AM and audio processing)
 * to sync any completed episodes that haven't been uploaded to Spreaker yet.
 *
 * This scheduler calls the db-admin /spreaker/backfill endpoint which:
 * - Checks Spreaker authentication
 * - Finds completed episodes with audio_url but no spreaker_episode_id
 * - Uploads each episode to Spreaker with metadata and artwork
 * - Updates database with Spreaker episode ID and URL
 *
 * Schedule: Daily at 4 AM (cron: 0 4 * * *)
 */
export default class extends Task<Env> {
  async handle(_event: Event): Promise<void> {
    console.log('🎙️ [SPREAKER-SYNC] Starting Spreaker sync...');

    try {
      const db = this.env.APP_DB;

      // Check if there are any episodes to sync
      const pendingResult = await db
        .prepare(`
          SELECT COUNT(*) as count
          FROM podcast_episodes
          WHERE status = 'completed'
            AND audio_url IS NOT NULL
            AND spreaker_episode_id IS NULL
        `)
        .first() as { count: number };

      if (pendingResult.count === 0) {
        console.log('✅ [SPREAKER-SYNC] No episodes pending upload');
        return;
      }

      console.log(`📊 [SPREAKER-SYNC] Found ${pendingResult.count} episode(s) to upload`);

      // Call the db-admin service to handle backfill
      // Using direct service call per Raindrop service-to-service pattern
      const result = await this.env.DB_ADMIN.fetch(
        new Request('https://internal/spreaker/backfill', { method: 'POST' })
      );

      const response = await result.json() as {
        success: boolean;
        message?: string;
        uploaded?: number;
        failed?: number;
        error?: string;
      };

      if (response.success) {
        console.log(`✅ [SPREAKER-SYNC] ${response.message}`);
        if (response.uploaded && response.uploaded > 0) {
          console.log(`   Uploaded: ${response.uploaded} episode(s)`);
        }
        if (response.failed && response.failed > 0) {
          console.log(`   Failed: ${response.failed} episode(s)`);
        }
      } else {
        console.error(`❌ [SPREAKER-SYNC] Failed: ${response.error}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ [SPREAKER-SYNC] Error: ${errorMessage}`);
    }
  }
}
