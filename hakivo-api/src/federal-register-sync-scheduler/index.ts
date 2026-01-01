import { Task, Event } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { FederalRegisterSyncMessage } from '../federal-register-sync-observer';

/**
 * Federal Register Sync Scheduler
 *
 * Runs daily at 6 AM ET (11 AM UTC) to trigger Federal Register document sync.
 * Publishes a message to the federal-register-queue which is processed by
 * the federal-register-sync-observer.
 *
 * Cron: 0 11 * * * (6 AM ET / 11 AM UTC)
 */
export default class extends Task<Env> {
  async handle(event: Event): Promise<void> {
    console.log('📅 Federal Register Sync Scheduler: Starting daily sync');
    console.log(`   Time: ${new Date().toISOString()}`);

    try {
      const queue = this.env.FEDERAL_REGISTER_QUEUE;

      // Create sync message for daily update
      const syncMessage: FederalRegisterSyncMessage = {
        type: 'daily_sync',
        timestamp: new Date().toISOString(),
        documentTypes: ['RULE', 'PRORULE', 'NOTICE', 'PRESDOCU'],
        daysBack: 1 // Fetch yesterday's documents
      };

      // Send message to queue
      await queue.send(syncMessage);

      console.log('✅ Federal Register sync message queued successfully');
      console.log(`   Document types: ${syncMessage.documentTypes?.join(', ')}`);
      console.log(`   Days back: ${syncMessage.daysBack}`);

    } catch (error) {
      console.error('❌ Failed to queue Federal Register sync:', error);
      throw error;
    }
  }
}
