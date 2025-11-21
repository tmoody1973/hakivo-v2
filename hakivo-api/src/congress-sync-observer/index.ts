import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * Strip HTML tags and extract plain text from bill content
 */
function stripHTML(html: string): string {
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Remove excessive whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');

  return text.trim();
}

/**
 * Congress Sync Observer
 *
 * Processes messages from the sync-queue to synchronize Congress.gov data.
 * Fetches bills, members, committees, and votes, populates the SQL database,
 * and uploads bill text to the BILL_TEXTS SmartBucket for semantic search.
 */
export default class extends Each<SyncMessage, Env> {
  async process(message: Message<SyncMessage>): Promise<void> {
    console.log('🗳️  Congress Sync Observer: Processing sync message');
    console.log(`   Type: ${message.body.type}`);
    console.log(`   Sync types: ${message.body.syncTypes?.join(', ')}`);

    const { type, congress, syncTypes, syncWindow } = message.body;
    const db = this.env.APP_DB;
    const billTexts = this.env.BILL_TEXTS;
    const congressApi = this.env.CONGRESS_API_CLIENT;

    try {
      // Process each sync type
      for (const syncType of syncTypes || []) {
        switch (syncType) {
          case 'bills':
            await this.syncBills(congress || [118, 119], syncWindow?.days || 7);
            break;
          case 'members':
            await this.syncMembers(congress || [118, 119]);
            break;
          case 'committees':
            await this.syncCommittees(congress || [118, 119]);
            break;
          case 'votes':
            console.log('⚠️  Vote sync not yet implemented');
            break;
          default:
            console.warn(`Unknown sync type: ${syncType}`);
        }
      }

      console.log('✅ Congress sync complete');
    } catch (error) {
      console.error('❌ Congress sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync bills from Congress.gov for specified congresses
   */
  private async syncBills(congresses: number[], daysBack: number = 7): Promise<void> {
    console.log(`📄 Syncing bills for congresses: ${congresses.join(', ')}`);

    const db = this.env.APP_DB;
    const congressApi = this.env.CONGRESS_API_CLIENT;
    const billTexts = this.env.BILL_TEXTS;

    for (const congress of congresses) {
      try {
        // Fetch bills updated in the last N days
        const billsResponse = await congressApi.searchBills(congress, 250, 0, 'updateDate:desc');
        const bills = billsResponse.bills || [];

        console.log(`  Found ${bills.length} bills for ${congress}th Congress`);

        for (const bill of bills) {
          try {
            // Insert or update bill in database
            await db
              .prepare(`
                INSERT OR REPLACE INTO bills (
                  id, congress, bill_type, bill_number, title,
                  origin_chamber, update_date, introduced_date, latest_action_text,
                  latest_action_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `)
              .bind(
                bill.number || crypto.randomUUID(),
                congress,
                bill.type,
                bill.number,
                bill.title || 'Untitled',
                bill.originChamber || null,
                bill.updateDate || null,
                bill.introducedDate || null,
                bill.latestAction?.text || null,
                bill.latestAction?.actionDate || null
              )
              .run();

            // If bill has text URL, upload to SmartBucket
            if (bill.textVersions && bill.textVersions.length > 0) {
              const latestText = bill.textVersions[0];
              if (latestText.formats) {
                const textFormat = latestText.formats.find((f: any) => f.type === 'Formatted Text');
                if (textFormat?.url) {
                  try {
                    // Fetch bill text
                    const textResponse = await fetch(textFormat.url);
                    const billText = await textResponse.text();

                    // Strip HTML to get plain text
                    const plainText = stripHTML(billText);

                    // Save plain text to database
                    await db
                      .prepare(`UPDATE bills SET text = ? WHERE id = ?`)
                      .bind(plainText, bill.number)
                      .run();

                    // Upload plain text to SmartBucket
                    const documentKey = `congress-${congress}/${bill.type}${bill.number}.txt`;
                    await billTexts.put(documentKey, plainText, {
                      customMetadata: {
                        congress: String(congress),
                        type: bill.type,
                        number: String(bill.number),
                        title: bill.title
                      }
                    });

                    console.log(`    ✓ Saved text and uploaded ${bill.type}${bill.number} (${plainText.length} chars)`);
                  } catch (error) {
                    console.warn(`    ⚠️  Failed to upload bill text for ${bill.type}${bill.number}`);
                  }
                }
              }
            }
          } catch (error) {
            console.error(`  ✗ Failed to sync bill ${bill.type}${bill.number}:`, error);
          }
        }
      } catch (error) {
        console.error(`  ✗ Failed to fetch bills for Congress ${congress}:`, error);
      }
    }
  }

  /**
   * Sync members from Congress.gov
   */
  private async syncMembers(congresses: number[]): Promise<void> {
    console.log(`👥 Syncing members for congresses: ${congresses.join(', ')}`);

    const db = this.env.APP_DB;
    const congressApi = this.env.CONGRESS_API_CLIENT;

    for (const congress of congresses) {
      try {
        // Note: This would need the actual Congress API method for members
        console.log(`  ⚠️  Member sync for Congress ${congress} - API method pending`);

        // Placeholder for member sync logic
        // const membersResponse = await congressApi.getMembers(congress);
        // ... insert members into database
      } catch (error) {
        console.error(`  ✗ Failed to sync members for Congress ${congress}:`, error);
      }
    }
  }

  /**
   * Sync committees from Congress.gov
   */
  private async syncCommittees(congresses: number[]): Promise<void> {
    console.log(`🏛️  Syncing committees for congresses: ${congresses.join(', ')}`);

    const db = this.env.APP_DB;
    const congressApi = this.env.CONGRESS_API_CLIENT;

    for (const congress of congresses) {
      try {
        // Note: This would need the actual Congress API method for committees
        console.log(`  ⚠️  Committee sync for Congress ${congress} - API method pending`);

        // Placeholder for committee sync logic
        // const committeesResponse = await congressApi.getCommittees(congress);
        // ... insert committees into database
      } catch (error) {
        console.error(`  ✗ Failed to sync committees for Congress ${congress}:`, error);
      }
    }
  }
}

/**
 * Sync message structure sent to the sync-queue
 */
export interface SyncMessage {
  type: 'daily_sync' | 'manual_sync' | 'initial_sync';
  timestamp: string;
  syncWindow?: {
    days: number;
  };
  congress?: number[];
  syncTypes?: ('bills' | 'members' | 'committees' | 'votes')[];
}

// Export Body as alias for Raindrop framework
export type Body = SyncMessage;
