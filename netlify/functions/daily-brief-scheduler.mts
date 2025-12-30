/**
 * Netlify Scheduled Function for Daily Brief Generation
 *
 * Runs every day at 7 AM UTC to generate daily briefings for users.
 * Queries users with daily briefing preferences enabled and triggers
 * brief generation via Raindrop briefs-service.
 *
 * Schedule: 0 7 * * * (7 AM UTC every day)
 */
import type { Context, Config } from "@netlify/functions";

// Get Raindrop service URLs from env
const getDbAdminUrl = () => {
  const envUrl = Netlify.env.get('RAINDROP_DB_ADMIN_URL');
  if (envUrl) return envUrl;
  return 'https://svc-01kc6rbecv0s5k4yk6ksdaqyzq.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
};

const getBriefsServiceUrl = () => {
  const envUrl = Netlify.env.get('RAINDROP_BRIEFS_SERVICE_URL');
  if (envUrl) return envUrl;
  return 'https://svc-01kc6rbecv0s5k4yk6ksdaqyzj.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
};

// Free tier limit constant
const FREE_TIER_BRIEFS_PER_MONTH = 3;

interface User {
  id: string;
  email: string;
  first_name: string;
  briefing_frequency: string;
  subscription_status: string;
}

interface ErrorDetail {
  email: string;
  step: string;
  error: string;
}

async function queryDatabase(query: string): Promise<any[]> {
  const response = await fetch(`${getDbAdminUrl()}/db-admin/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Database query failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return data.results || [];
}

async function generateBriefForUser(userId: string, type: 'daily' | 'weekly' = 'daily'): Promise<{ success: boolean; briefId?: string; error?: string }> {
  // Use the briefs-service scheduled-generate endpoint for scheduled brief generation
  const response = await fetch(`${getBriefsServiceUrl()}/briefs/scheduled-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, type }),
  });

  const data = await response.json();

  if (!response.ok) {
    return { success: false, error: data.error || `HTTP ${response.status}` };
  }

  return { success: true, briefId: data.briefId };
}

export default async (req: Request, context: Context) => {
  console.log('[DAILY-BRIEF-SCHEDULER] Starting daily briefing generation');
  console.log(`[DAILY-BRIEF-SCHEDULER] Timestamp: ${new Date().toISOString()}`);

  try {
    // Query users who have daily briefing enabled
    const users = await queryDatabase(`
      SELECT u.id, u.email, u.first_name, up.briefing_frequency, u.subscription_status
      FROM users u
      JOIN user_preferences up ON u.id = up.user_id
      WHERE up.briefing_frequency = 'daily'
        AND u.email_verified = 1
        AND u.onboarding_completed = 1
    `) as User[];

    if (users.length === 0) {
      console.log('[DAILY-BRIEF-SCHEDULER] No users with daily briefing enabled');
      return new Response(JSON.stringify({
        success: true,
        message: 'No users with daily briefing enabled',
        stats: { total: 0, enqueued: 0, skipped: 0, errors: 0 }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[DAILY-BRIEF-SCHEDULER] Found ${users.length} users for daily briefing`);

    let enqueuedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const errorDetails: ErrorDetail[] = [];

    for (const user of users) {
      try {
        const isPro = user.subscription_status === 'active';

        if (!isPro) {
          // Check monthly brief count for free tier users
          const currentDate = new Date();
          const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getTime();

          const briefsThisMonth = await queryDatabase(`
            SELECT COUNT(*) as count FROM briefs
            WHERE user_id = '${user.id}'
              AND created_at >= ${monthStart}
              AND status IN ('completed', 'script_ready', 'processing', 'audio_processing', 'pending')
          `);

          const briefCount = briefsThisMonth[0]?.count || 0;

          if (briefCount >= FREE_TIER_BRIEFS_PER_MONTH) {
            console.log(`[DAILY-BRIEF-SCHEDULER] Skipping ${user.email} - monthly limit: ${briefCount}/${FREE_TIER_BRIEFS_PER_MONTH}`);
            skippedCount++;
            continue;
          }
        }

        // Generate brief via briefs-service (handles creation + enqueueing)
        const result = await generateBriefForUser(user.id, 'daily');

        if (result.success) {
          enqueuedCount++;
          console.log(`[DAILY-BRIEF-SCHEDULER] Generated brief ${result.briefId} for ${user.email}`);
        } else {
          throw new Error(result.error || 'Unknown error from briefs-service');
        }

      } catch (error) {
        errorCount++;
        const errorMsg = error instanceof Error ? error.message : String(error);

        errorDetails.push({
          email: user.email || user.id || 'unknown',
          step: 'generate',
          error: errorMsg
        });

        console.error(`[DAILY-BRIEF-SCHEDULER] Failed for ${user.email}:`, errorMsg);
      }
    }

    console.log('[DAILY-BRIEF-SCHEDULER] Scheduling complete');
    console.log(`[DAILY-BRIEF-SCHEDULER] Enqueued: ${enqueuedCount}`);
    console.log(`[DAILY-BRIEF-SCHEDULER] Skipped (limit reached): ${skippedCount}`);
    console.log(`[DAILY-BRIEF-SCHEDULER] Errors: ${errorCount}`);

    // Log the scheduler execution
    try {
      const logQuery = `
        INSERT INTO scheduler_logs (id, scheduler_type, executed_at, users_processed, jobs_enqueued, errors, error_details)
        VALUES (
          '${crypto.randomUUID()}',
          'daily_brief_netlify',
          ${Date.now()},
          ${users.length},
          ${enqueuedCount},
          ${errorCount},
          ${errorDetails.length > 0 ? `'${JSON.stringify(errorDetails.slice(0, 10)).replace(/'/g, "''")}'` : 'NULL'}
        )
      `;
      await queryDatabase(logQuery);
    } catch (logError) {
      console.warn('[DAILY-BRIEF-SCHEDULER] Could not store scheduler log:', logError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Daily brief scheduling complete',
      stats: {
        total: users.length,
        enqueued: enqueuedCount,
        skipped: skippedCount,
        errors: errorCount
      },
      errorDetails: errorDetails.length > 0 ? errorDetails.slice(0, 10) : undefined
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[DAILY-BRIEF-SCHEDULER] Scheduler failed:', errorMsg);

    return new Response(JSON.stringify({
      success: false,
      error: errorMsg
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Netlify scheduled function configuration
// Runs at 7 AM UTC every day
export const config: Config = {
  schedule: "0 7 * * *"
};
