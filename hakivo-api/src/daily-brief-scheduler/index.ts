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
      let skippedCount = 0;
      const errorDetails: Array<{ email: string; step: string; error: string }> = [];

      // Free tier limit constant
      const FREE_TIER_BRIEFS_PER_MONTH = 3;

      for (const user of users as any[]) {
        try {
          // Check subscription status and monthly brief limit
          let userRecord;
          try {
            userRecord = await db
              .prepare('SELECT subscription_status FROM users WHERE id = ?')
              .bind(user.id)
              .first();
          } catch (err) {
            throw new Error(`[STEP: Query subscription status] ${err instanceof Error ? err.message : String(err)}`);
          }

          const isPro = userRecord?.subscription_status === 'active';

          if (!isPro) {
            // Check monthly brief count for free tier users
            const currentDate = new Date();
            const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getTime();

            let briefsThisMonth;
            try {
              briefsThisMonth = await db
                .prepare(`
                  SELECT COUNT(*) as count FROM briefs
                  WHERE user_id = ?
                    AND created_at >= ?
                    AND status IN ('completed', 'script_ready', 'processing', 'audio_processing', 'pending')
                `)
                .bind(user.id, monthStart)
                .first();
            } catch (err) {
              throw new Error(`[STEP: Count monthly briefs] ${err instanceof Error ? err.message : String(err)}`);
            }

            const briefCount = (briefsThisMonth?.count as number) || 0;

            if (briefCount >= FREE_TIER_BRIEFS_PER_MONTH) {
              console.log(`  ⊘ Skipping ${user.email} - monthly brief limit reached: ${briefCount}/${FREE_TIER_BRIEFS_PER_MONTH}`);
              skippedCount++;
              continue; // Skip this user
            }
          }

          // Calculate date range for daily brief (last 24 hours)
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 1);

          const briefId = crypto.randomUUID();
          const now = Date.now();
          const title = `Daily Brief - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

          // CRITICAL: Insert brief record BEFORE enqueueing
          // The brief-generator observer expects the brief to exist in DB
          try {
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
          } catch (err) {
            throw new Error(`[STEP: Insert brief record] ${err instanceof Error ? err.message : String(err)}`);
          }

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

          try {
            await briefQueue.send(briefRequest);
          } catch (err) {
            throw new Error(`[STEP: Enqueue to brief-queue] ${err instanceof Error ? err.message : String(err)}`);
          }

          enqueuedCount++;
          console.log(`  ✓ Enqueued daily brief for ${user.email}`);
        } catch (error) {
          errorCount++;
          const errorMsg = error instanceof Error ? error.message : String(error);

          // Extract step from error message if present
          const stepMatch = errorMsg.match(/\[STEP: ([^\]]+)\]/);
          const step = stepMatch ? stepMatch[1] : 'Unknown step';
          const cleanError = errorMsg.replace(/\[STEP: [^\]]+\]\s*/, '');

          const userEmail: string = (user.email || user.id || 'unknown') as string;

          errorDetails.push({
            email: userEmail,
            step: step as string,
            error: cleanError as string
          });

          console.error(`  ✗ Failed for ${userEmail} at ${step}:`, cleanError);
        }
      }

      console.log('✅ Daily brief scheduling complete');
      console.log(`   Enqueued: ${enqueuedCount}`);
      console.log(`   Skipped (limit reached): ${skippedCount}`);
      console.log(`   Errors: ${errorCount}`);

      // Log error details if any
      if (errorDetails.length > 0) {
        console.error('📋 Error Summary:');
        for (const detail of errorDetails) {
          console.error(`   • ${detail.email} - ${detail.step}: ${detail.error}`);
        }
      }

      // Log the scheduler execution
      try {
        const errorSummary = errorDetails.length > 0
          ? JSON.stringify(errorDetails.slice(0, 10)) // Limit to first 10 errors to avoid exceeding column size
          : null;

        await db
          .prepare(`
            INSERT INTO scheduler_logs (id, scheduler_type, executed_at, users_processed, jobs_enqueued, errors, error_details)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            crypto.randomUUID(),
            'daily_brief',
            Date.now(),
            users.length,
            enqueuedCount,
            errorCount,
            errorSummary
          )
          .run();
      } catch (error) {
        // Table might not exist yet or doesn't have error_details column - log but don't fail
        console.warn('⚠️  Could not store scheduler log (table may not have error_details column yet):', error);

        // Try without error_details column for backwards compatibility
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
        } catch (fallbackError) {
          console.warn('⚠️  Could not store scheduler log (fallback also failed):', fallbackError);
        }
      }

    } catch (error) {
      console.error('❌ Daily brief scheduler failed:', error);
      throw error;
    }
  }
}
