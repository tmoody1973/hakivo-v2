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
 * - Fetch bill details and full text (HTML only, PDFs skipped)
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
      let totalTextFetched = 0;
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

          // Insert or update bills in database, then fetch full text
          for (const bill of bills) {
            try {
              // First, insert/update basic bill info
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

              // Check if we already have full text for this bill
              const existingText = await db
                .prepare('SELECT full_text FROM state_bills WHERE id = ?')
                .bind(bill.id)
                .first();

              if (existingText?.full_text) {
                console.log(`  📄 Bill ${bill.identifier} already has text, skipping`);
                continue;
              }

              // Fetch bill details to get text version URLs
              try {
                const details = await openStatesClient.getBillDetails(bill.id);

                if (details.textVersions && details.textVersions.length > 0) {
                  // Prefer HTML/text versions over PDFs
                  const htmlVersion = details.textVersions.find(v =>
                    v.mediaType?.includes('html') ||
                    v.mediaType?.includes('text') ||
                    v.url?.includes('.html') ||
                    v.url?.includes('.htm')
                  );

                  const textVersion = htmlVersion || details.textVersions[0];

                  if (textVersion) {
                    // Store the text URL
                    await db
                      .prepare(`
                        UPDATE state_bills
                        SET full_text_url = ?, full_text_format = ?, abstract = ?, updated_at = ?
                        WHERE id = ?
                      `)
                      .bind(
                        textVersion.url,
                        textVersion.mediaType || 'unknown',
                        details.abstract,
                        Date.now(),
                        bill.id
                      )
                      .run();

                    // Try to fetch the actual text (only for HTML/text, not PDFs)
                    if (htmlVersion || !textVersion.mediaType?.includes('pdf')) {
                      const fullText = await openStatesClient.getBillText(textVersion.url);

                      if (fullText && fullText.length > 100) {
                        // Store the full text
                        await db
                          .prepare(`
                            UPDATE state_bills
                            SET full_text = ?, text_extracted_at = ?, updated_at = ?
                            WHERE id = ?
                          `)
                          .bind(
                            fullText,
                            Date.now(),
                            Date.now(),
                            bill.id
                          )
                          .run();

                        console.log(`  📄 Fetched text for ${bill.identifier} (${fullText.length} chars)`);
                        totalTextFetched++;
                      }
                    } else {
                      console.log(`  📄 ${bill.identifier}: PDF only, skipping text extraction`);
                    }
                  }
                }

                // Also store sponsors if available
                if (details.sponsors && details.sponsors.length > 0) {
                  for (const sponsor of details.sponsors) {
                    try {
                      await db
                        .prepare(`
                          INSERT INTO state_bill_sponsorships (bill_id, name, classification, created_at)
                          VALUES (?, ?, ?, ?)
                          ON CONFLICT(bill_id, person_id, classification) DO NOTHING
                        `)
                        .bind(
                          bill.id,
                          sponsor.name,
                          sponsor.classification,
                          Date.now()
                        )
                        .run();
                    } catch (sponsorError) {
                      // Ignore duplicate sponsor errors
                    }
                  }
                }

              } catch (detailsError) {
                console.log(`  ⚠️  Could not fetch details for ${bill.identifier}:`, detailsError);
                // Continue with next bill - don't fail the whole sync
              }

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
      console.log(`   Total texts fetched: ${totalTextFetched}`);
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
              totalTextFetched,
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
