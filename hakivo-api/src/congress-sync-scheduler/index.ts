import { Task, Event } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * Congress Sync Scheduler
 *
 * Runs daily at 2 AM to trigger synchronization of Congress.gov data.
 * Enqueues sync jobs to the sync-queue for processing by congress-sync-observer.
 *
 * Schedule: 0 2 * * * (2 AM every day)
 */
export default class extends Task<Env> {
  async handle(event: Event): Promise<void> {
    console.log('🗳️  Congress Sync Scheduler: Starting daily sync job');

    try {
      const db = this.env.APP_DB;
      const syncQueue = this.env.SYNC_QUEUE;

      // Get the last sync timestamp from a sync_metadata table
      // For now, we'll sync the last 7 days of data to catch updates
      const syncMessage = {
        type: 'daily_sync' as const,
        timestamp: new Date().toISOString(),
        syncWindow: {
          days: 7, // Sync bills updated in last 7 days
        },
        congress: [118, 119], // Current congresses
        syncTypes: ['bills', 'members', 'committees', 'votes'] as ('bills' | 'members' | 'committees' | 'votes')[]
      };

      // Enqueue the sync job
      await syncQueue.send(syncMessage);

      console.log('✅ Congress sync job enqueued successfully');
      console.log(`   Sync window: ${syncMessage.syncWindow.days} days`);
      console.log(`   Congresses: ${syncMessage.congress.join(', ')}`);
      console.log(`   Types: ${syncMessage.syncTypes.join(', ')}`);

      // Store sync execution record in database
      try {
        await db
          .prepare(`
            INSERT INTO sync_logs (id, sync_type, status, started_at, metadata)
            VALUES (?, ?, ?, ?, ?)
          `)
          .bind(
            crypto.randomUUID(),
            'scheduled_sync',
            'queued',
            Date.now(),
            JSON.stringify(syncMessage)
          )
          .run();
      } catch (error) {
        // Table might not exist yet - log but don't fail
        console.warn('⚠️  Could not store sync log (table may not exist yet):', error);
      }

    } catch (error) {
      console.error('❌ Congress sync scheduler failed:', error);
      throw error;
    }
  }
}
