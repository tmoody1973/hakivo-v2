import { Task, Event } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * Daily Brief Scheduler
 *
 * Runs every day at 7 AM to generate daily briefings for users.
 * Queries users with daily briefing preferences enabled and enqueues
 * brief generation jobs to the brief-queue.
 *
 * Schedule: 0 7 * * * (7 AM every day)
 */
export default class extends Task<Env> {
  async handle(event: Event): Promise<void> {
    console.log('📰 Daily Brief Scheduler: Starting daily briefing generation');

    try {
      const db = this.env.APP_DB;
      const briefQueue = this.env.BRIEF_QUEUE;

      // Query users who have daily briefing enabled
      const usersResult = await db
        .prepare(`
          SELECT u.id, u.email, u.first_name, up.briefing_frequency
          FROM users u
          JOIN user_preferences up ON u.id = up.user_id
          WHERE up.briefing_frequency = 'daily'
            AND u.email_verified = 1
            AND u.onboarding_completed = 1
        `)
        .all();

      const users = usersResult.results || [];

      if (users.length === 0) {
        console.log('ℹ️  No users with daily briefing enabled');
        return;
      }

      console.log(`📬 Found ${users.length} users for daily briefing`);

      // Enqueue brief generation for each user
      let enqueuedCount = 0;
      let errorCount = 0;

      for (const user of users as any[]) {
        try {
          // Calculate date range for daily brief (last 24 hours)
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 1);

          const briefId = crypto.randomUUID();
          const now = Date.now();
          const title = `Daily Brief - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

          // CRITICAL: Insert brief record BEFORE enqueueing
          // The brief-generator observer expects the brief to exist in DB
          await db
            .prepare(`
              INSERT INTO briefs (
                id, user_id, type, title, start_date, end_date, status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              briefId,
              user.id,
              'daily',
              title,
              startDate.toISOString().split('T')[0],
              endDate.toISOString().split('T')[0],
              'pending',
              now,
              now
            )
            .run();

          console.log(`  📝 Created brief record ${briefId} for ${user.email}`);

          // Now enqueue for processing
          const briefRequest = {
            briefId,
            userId: user.id,
            type: 'daily' as const,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            requestedAt: now
          };

          await briefQueue.send(briefRequest);
          enqueuedCount++;

          console.log(`  ✓ Enqueued daily brief for ${user.email}`);
        } catch (error) {
          errorCount++;
          console.error(`  ✗ Failed to enqueue brief for ${user.email}:`, error);
        }
      }

      console.log('✅ Daily brief scheduling complete');
      console.log(`   Enqueued: ${enqueuedCount}`);
      console.log(`   Errors: ${errorCount}`);

      // Log the scheduler execution
      try {
        await db
          .prepare(`
            INSERT INTO scheduler_logs (id, scheduler_type, executed_at, users_processed, jobs_enqueued, errors)
            VALUES (?, ?, ?, ?, ?, ?)
          `)
          .bind(
            crypto.randomUUID(),
            'daily_brief',
            Date.now(),
            users.length,
            enqueuedCount,
            errorCount
          )
          .run();
      } catch (error) {
        // Table might not exist yet - log but don't fail
        console.warn('⚠️  Could not store scheduler log (table may not exist yet):', error);
      }

    } catch (error) {
      console.error('❌ Daily brief scheduler failed:', error);
      throw error;
    }
  }
}
