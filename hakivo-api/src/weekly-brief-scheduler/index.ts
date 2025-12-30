import { Task, Event } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * Weekly Brief Scheduler
 *
 * Runs every Monday at 7 AM to generate weekly briefings for users.
 * Queries users with weekly briefing preferences enabled and enqueues
 * brief generation jobs to the brief-queue.
 *
 * Schedule: 0 7 * * 1 (7 AM every Monday)
 */
export default class extends Task<Env> {
  async handle(event: Event): Promise<void> {
    console.log('📅 Weekly Brief Scheduler: Starting weekly briefing generation');

    try {
      const db = this.env.APP_DB;
      const briefQueue = this.env.BRIEF_QUEUE;

      // Query users who have weekly briefing enabled
      const usersResult = await db
        .prepare(`
          SELECT u.id, u.email, u.first_name, up.briefing_frequency
          FROM users u
          JOIN user_preferences up ON u.id = up.user_id
          WHERE up.briefing_frequency = 'weekly'
            AND u.email_verified = 1
            AND u.onboarding_completed = 1
        `)
        .all();

      const users = usersResult.results || [];

      if (users.length === 0) {
        console.log('ℹ️  No users with weekly briefing enabled');
        return;
      }

      console.log(`📬 Found ${users.length} users for weekly briefing`);

      // Enqueue brief generation for each user
      let enqueuedCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      // Free tier limit constant
      const FREE_TIER_BRIEFS_PER_MONTH = 3;

      for (const user of users as any[]) {
        try {
          // Check subscription status and monthly brief limit
          const userRecord = await db
            .prepare('SELECT subscription_status FROM users WHERE id = ?')
            .bind(user.id)
            .first();

          const isPro = userRecord?.subscription_status === 'active';

          if (!isPro) {
            // Check monthly brief count for free tier users
            const currentDate = new Date();
            const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getTime();

            const briefsThisMonth = await db
              .prepare(`
                SELECT COUNT(*) as count FROM briefs
                WHERE user_id = ?
                  AND created_at >= ?
                  AND status IN ('completed', 'script_ready', 'processing', 'audio_processing', 'pending')
              `)
              .bind(user.id, monthStart)
              .first();

            const briefCount = (briefsThisMonth?.count as number) || 0;

            if (briefCount >= FREE_TIER_BRIEFS_PER_MONTH) {
              console.log(`  ⊘ Skipping ${user.email} - monthly brief limit reached: ${briefCount}/${FREE_TIER_BRIEFS_PER_MONTH}`);
              skippedCount++;
              continue; // Skip this user
            }
          }

          // Calculate date range for weekly brief (last 7 days)
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);

          const briefId = crypto.randomUUID();
          const now = Date.now();
          const title = `Weekly Brief - Week of ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

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
              'weekly',
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
            type: 'weekly' as const,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            requestedAt: now
          };

          await briefQueue.send(briefRequest);
          enqueuedCount++;

          console.log(`  ✓ Enqueued weekly brief for ${user.email}`);
        } catch (error) {
          errorCount++;
          console.error(`  ✗ Failed to enqueue brief for ${user.email}:`, error);
        }
      }

      console.log('✅ Weekly brief scheduling complete');
      console.log(`   Enqueued: ${enqueuedCount}`);
      console.log(`   Skipped (limit reached): ${skippedCount}`);
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
            'weekly_brief',
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
      console.error('❌ Weekly brief scheduler failed:', error);
      throw error;
    }
  }
}
