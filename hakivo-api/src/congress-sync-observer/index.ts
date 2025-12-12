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
   * Fetches bill details to get sponsor information
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
            // Create proper bill ID: "119-hr-1234"
            const billType = String(bill.type).toLowerCase();
            const billNumber = bill.number;
            const billId = `${congress}-${billType}-${billNumber}`;

            // Fetch bill details to get sponsor information
            let sponsorBioguideId: string | null = null;
            let policyArea: string | null = null;
            let introducedDate: string | null = bill.introducedDate || null;

            try {
              const detailsResponse = await congressApi.getBillDetails(congress, billType, billNumber);
              const billDetails = detailsResponse.bill;

              // Extract sponsor bioguide ID from the first sponsor
              if (billDetails?.sponsors && billDetails.sponsors.length > 0) {
                sponsorBioguideId = billDetails.sponsors[0].bioguideId || null;

                // Also sync the sponsor to members table if not exists
                const sponsor = billDetails.sponsors[0];
                if (sponsorBioguideId && sponsor) {
                  await this.upsertMember(db, {
                    bioguideId: sponsorBioguideId,
                    firstName: sponsor.firstName,
                    lastName: sponsor.lastName,
                    party: sponsor.party,
                    state: sponsor.state,
                    district: sponsor.district
                  });
                }
              }

              // Get policy area if available
              policyArea = billDetails?.policyArea?.name || null;
              introducedDate = billDetails?.introducedDate || introducedDate;

            } catch (detailError) {
              // Non-fatal - continue with basic info
              console.warn(`    ⚠️  Could not fetch details for ${billType}${billNumber}: ${detailError}`);
            }

            // Insert or update bill in database with proper ID and sponsor
            await db
              .prepare(`
                INSERT OR REPLACE INTO bills (
                  id, congress, bill_type, bill_number, title,
                  origin_chamber, update_date, introduced_date, latest_action_text,
                  latest_action_date, sponsor_bioguide_id, policy_area
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `)
              .bind(
                billId,
                congress,
                billType,
                billNumber,
                bill.title || 'Untitled',
                bill.originChamber || null,
                bill.updateDate || null,
                introducedDate,
                bill.latestAction?.text || null,
                bill.latestAction?.actionDate || null,
                sponsorBioguideId,
                policyArea
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

                    // Save plain text to database using proper bill ID
                    await db
                      .prepare(`UPDATE bills SET text = ? WHERE id = ?`)
                      .bind(plainText, billId)
                      .run();

                    // Upload plain text to regular bucket (legacy)
                    const documentKey = `congress-${congress}/${billType}${billNumber}.txt`;
                    await billTexts.put(documentKey, plainText, {
                      customMetadata: {
                        congress: String(congress),
                        type: billType,
                        number: String(billNumber),
                        title: bill.title,
                        billId: billId
                      }
                    });

                    // Also upload to LEGISLATION_SEARCH SmartBucket for semantic search
                    // This enables automatic indexing of new bills for RAG and semantic queries
                    const legislationSearch = this.env.LEGISLATION_SEARCH;
                    const smartBucketKey = `bills/${congress}/${billType}-${billNumber}.txt`;
                    const searchableContent = `${bill.title || ''}\n\n${plainText}`;

                    await legislationSearch.put(smartBucketKey, searchableContent, {
                      httpMetadata: {
                        contentType: 'text/plain',
                        contentLanguage: 'en',
                        cacheControl: 'public, max-age=86400'
                      },
                      customMetadata: {
                        bill_id: billId,
                        congress: String(congress),
                        bill_type: billType,
                        bill_number: String(billNumber),
                        title: bill.title || '',
                        sponsor: sponsorBioguideId || '',
                        introduced_date: introducedDate || '',
                        policy_area: policyArea || ''
                      }
                    });

                    console.log(`    ✓ Saved text for ${billId} (${plainText.length} chars) + indexed to SmartBucket`);
                  } catch (error) {
                    console.warn(`    ⚠️  Failed to upload bill text for ${billId}`);
                  }
                }
              }
            }

            console.log(`    ✓ Synced ${billId}${sponsorBioguideId ? ` (sponsor: ${sponsorBioguideId})` : ''}`);
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
   * Upsert a member record (insert or update)
   */
  private async upsertMember(
    db: any,
    member: {
      bioguideId: string;
      firstName?: string;
      lastName?: string;
      party?: string;
      state?: string;
      district?: number;
    }
  ): Promise<void> {
    try {
      await db
        .prepare(`
          INSERT INTO members (bioguide_id, first_name, last_name, party, state, district)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(bioguide_id) DO UPDATE SET
            first_name = COALESCE(excluded.first_name, members.first_name),
            last_name = COALESCE(excluded.last_name, members.last_name),
            party = COALESCE(excluded.party, members.party),
            state = COALESCE(excluded.state, members.state),
            district = COALESCE(excluded.district, members.district)
        `)
        .bind(
          member.bioguideId,
          member.firstName || null,
          member.lastName || null,
          member.party || null,
          member.state || null,
          member.district || null
        )
        .run();
    } catch (error) {
      // Non-fatal - member might already exist
      console.warn(`    ⚠️  Could not upsert member ${member.bioguideId}: ${error}`);
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
