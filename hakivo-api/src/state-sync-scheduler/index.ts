import { Task, Event } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * State Legislation Sync Scheduler
 *
 * Runs daily at 3 AM to sync state bills for active user states.
 * Uses OpenStates API to fetch recent legislation.
 *
 * Schedule: 0 3 * * * (3 AM every day)
 *
 * Rate limits to respect:
 * - 500 requests/day to OpenStates
 * - 1 request/second
 *
 * Strategy:
 * - Only sync states where we have active users
 * - Fetch 20 most recent bills per state
 * - Limit to 10 states per run to stay well under rate limits
 */
export default class extends Task<Env> {
  async handle(event: Event): Promise<void> {
    console.log('🏛️  State Sync Scheduler: Starting daily state legislation sync');

    const db = this.env.APP_DB;
    const openStatesClient = this.env.OPENSTATES_CLIENT;

    try {
      // Get unique states from users with state preferences
      const statesResult = await db
        .prepare(`
          SELECT DISTINCT state
          FROM user_preferences
          WHERE state IS NOT NULL AND state != ''
          LIMIT 10
        `)
        .all();

      const states = statesResult.results as { state: string }[];

      if (states.length === 0) {
        console.log('ℹ️  No user states found - skipping state sync');
        return;
      }

      console.log(`📍 Found ${states.length} unique states to sync: ${states.map(s => s.state).join(', ')}`);

      let totalSynced = 0;
      let totalErrors = 0;

      // Process each state
      for (const { state } of states) {
        try {
          console.log(`\n🔄 Syncing state: ${state}`);

          // Call OpenStates client to search bills by state
          // The client handles rate limiting internally
          const bills = await openStatesClient.searchBillsByState(state, undefined, 20);

          if (!bills || bills.length === 0) {
            console.log(`  ⚠️  No bills found for ${state}`);
            continue;
          }

          console.log(`  📋 Retrieved ${bills.length} bills for ${state}`);

          // Insert or update bills in database
          for (const bill of bills) {
            try {
              await db
                .prepare(`
                  INSERT INTO state_bills (
                    id, state, session_identifier, identifier, title,
                    subjects, chamber, latest_action_date, latest_action_description,
                    created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    subjects = excluded.subjects,
                    latest_action_date = excluded.latest_action_date,
                    latest_action_description = excluded.latest_action_description,
                    updated_at = excluded.updated_at
                `)
                .bind(
                  bill.id,
                  state.toUpperCase(),
                  bill.session,
                  bill.identifier,
                  bill.title,
                  JSON.stringify(bill.subjects || []),
                  bill.chamber || '',
                  bill.latestActionDate,
                  bill.latestActionDescription,
                  Date.now(),
                  Date.now()
                )
                .run();

              totalSynced++;
            } catch (insertError) {
              console.error(`  ❌ Failed to insert bill ${bill.id}:`, insertError);
              totalErrors++;
            }
          }

          console.log(`  ✅ Synced ${bills.length} bills for ${state}`);

          // Brief pause between states to be extra safe with rate limits
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (stateError) {
          console.error(`❌ Failed to sync state ${state}:`, stateError);
          totalErrors++;
        }
      }

      console.log(`\n✅ State sync complete!`);
      console.log(`   Total bills synced: ${totalSynced}`);
      console.log(`   Errors: ${totalErrors}`);

      // Store sync log
      try {
        await db
          .prepare(`
            INSERT INTO sync_logs (id, sync_type, status, started_at, completed_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
          `)
          .bind(
            crypto.randomUUID(),
            'state_legislation_sync',
            totalErrors === 0 ? 'completed' : 'completed_with_errors',
            Date.now() - 60000, // Approximate start time
            Date.now(),
            JSON.stringify({
              states: states.map(s => s.state),
              totalSynced,
              totalErrors
            })
          )
          .run();
      } catch (logError) {
        console.warn('⚠️  Could not store sync log:', logError);
      }

    } catch (error) {
      console.error('❌ State sync scheduler failed:', error);
      throw error;
    }
  }
}
