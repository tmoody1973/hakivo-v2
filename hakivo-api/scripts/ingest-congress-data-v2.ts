#!/usr/bin/env tsx

/**
 * Congress Data Ingestion Script v2 - IMPROVED
 *
 * Fetches and populates the database with Congress.gov data for 118th and 119th Congress.
 * Run with: npx tsx scripts/ingest-congress-data-v2.ts
 *
 * IMPROVEMENTS:
 * - Fetches ALL members (not just current congress - includes historical)
 * - Properly fetches and stores FULL bill text
 * - Captures policy areas for bills
 * - Better error handling for foreign key constraints
 */

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const ADMIN_DASHBOARD_URL = 'https://svc-01ka747hjpq5r2qk4ct00r3yyd.01k66gey30f48fys2tv4e412yt.lmapp.run';

if (!CONGRESS_API_KEY) {
  console.error('❌ CONGRESS_API_KEY environment variable is required');
  console.error('Get your API key from: https://api.congress.gov/sign-up/');
  process.exit(1);
}

const BASE_URL = 'https://api.congress.gov/v3';

interface Stats {
  bills: number;
  billsWithText: number;
  billsWithPolicyArea: number;
  members: number;
  committees: number;
  votes: number;
  startTime: number;
}

const stats: Stats = {
  bills: 0,
  billsWithText: 0,
  billsWithPolicyArea: 0,
  members: 0,
  committees: 0,
  votes: 0,
  startTime: Date.now()
};

/**
 * Fetch from Congress.gov API
 */
async function fetchCongressAPI(endpoint: string): Promise<any> {
  const url = `${BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${CONGRESS_API_KEY}&format=json`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Congress API error: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

/**
 * Execute SQL query against the database via db-admin service
 */
async function executeSQL(query: string, params: any[] = []): Promise<any> {
  const response = await fetch(`${ADMIN_DASHBOARD_URL}/api/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Database query failed: ${error}`);
  }

  return response.json();
}

/**
 * Escape SQL strings
 */
function escapeSQLString(str: string | null | undefined): string {
  if (!str) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}

/**
 * Ingest bills for a specific congress - WITH FULL TEXT AND POLICY AREAS
 */
async function ingestBills(congress: number): Promise<void> {
  console.log(`\n📄 Fetching bills for ${congress}th Congress...`);

  let offset = 0;
  const limit = 250;
  let hasMore = true;

  while (hasMore) {
    try {
      const data = await fetchCongressAPI(`/bill/${congress}?offset=${offset}&limit=${limit}`);
      const bills = data.bills || [];

      if (bills.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`  Fetching bills ${offset + 1}-${offset + bills.length}...`);

      for (const bill of bills) {
        try {
          // Fetch full bill details
          const billType = bill.type.toLowerCase();
          const billNumber = bill.number;
          const detailsData = await fetchCongressAPI(`/bill/${congress}/${billType}/${billNumber}`);
          const billDetails = detailsData.bill;

          // Extract policy area
          const policyArea = billDetails.policyArea?.name || null;
          if (policyArea) {
            stats.billsWithPolicyArea++;
          }

          // Insert bill into database (WITHOUT foreign key for sponsor to avoid errors)
          const billId = `${congress}-${billType}-${billNumber}`;
          const query = `
            INSERT OR REPLACE INTO bills (
              id, congress, bill_type, bill_number, title,
              origin_chamber, introduced_date, latest_action_date,
              latest_action_text, sponsor_bioguide_id, update_date, policy_area
            ) VALUES (
              ${escapeSQLString(billId)},
              ${congress},
              ${escapeSQLString(billType)},
              ${billNumber},
              ${escapeSQLString(billDetails.title)},
              ${escapeSQLString(billDetails.originChamber)},
              ${escapeSQLString(billDetails.introducedDate)},
              ${escapeSQLString(billDetails.latestAction?.actionDate)},
              ${escapeSQLString(billDetails.latestAction?.text)},
              ${escapeSQLString(billDetails.sponsors?.[0]?.bioguideId)},
              ${escapeSQLString(billDetails.updateDate)},
              ${escapeSQLString(policyArea)}
            )
          `;

          await executeSQL(query);
          stats.bills++;

          // Fetch and store FULL bill text if available
          // FIXED: textVersions is an object with url, not an array!
          if (billDetails.textVersions?.url) {
            try {
              const textVersionsData = await fetchCongressAPI(`/bill/${congress}/${billType}/${billNumber}/text`);
              const textVersions = textVersionsData.textVersions || [];

              // Try to get the most recent version's text
              for (const version of textVersions) {
                if (version.formats) {
                  const textFormat = version.formats.find((f: any) => f.type === 'Formatted Text');

                  if (textFormat?.url) {
                    try {
                      console.log(`      📝 Fetching full text for ${billId}...`);
                      const textResponse = await fetch(textFormat.url);

                      if (textResponse.ok) {
                        const billText = await textResponse.text();
                        const escapedText = billText.replace(/'/g, "''");

                        await executeSQL(`
                          UPDATE bills
                          SET text = ${escapeSQLString(escapedText)}
                          WHERE id = ${escapeSQLString(billId)}
                        `);

                        stats.billsWithText++;
                        console.log(`      ✅ Stored ${billText.length} chars of text for ${billId}`);
                        break;
                      }
                    } catch (error) {
                      console.warn(`      ⚠️  Could not fetch text for ${billId}`);
                    }
                  }
                }
              }
            } catch (error) {
              console.warn(`      ⚠️  No text versions available for ${billId}`);
            }
          }

          if (stats.bills % 10 === 0) {
            console.log(`    ✓ Inserted ${stats.bills} bills (${stats.billsWithText} with full text, ${stats.billsWithPolicyArea} with policy areas)`);
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`    ✗ Failed to insert bill ${bill.type}${bill.number}:`, error);
        }
      }

      offset += limit;

      // Check if there are more results
      if (bills.length < limit) {
        hasMore = false;
      }

    } catch (error) {
      console.error(`  ✗ Failed to fetch bills batch at offset ${offset}:`, error);
      hasMore = false;
    }
  }

  console.log(`  ✅ Completed: ${stats.bills} bills inserted (${stats.billsWithText} with full text, ${stats.billsWithPolicyArea} with policy areas)`);
}

/**
 * Ingest ALL members (not just for a specific congress)
 * This fetches from the complete member database
 */
async function ingestAllMembers(): Promise<void> {
  console.log(`\n👥 Fetching ALL members from Congress database...`);

  let offset = 0;
  const limit = 250;
  let hasMore = true;

  while (hasMore) {
    try {
      // Fetch members with pagination - this gets ALL members, not just current congress
      const data = await fetchCongressAPI(`/member?offset=${offset}&limit=${limit}`);
      const members = data.members || [];

      if (members.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`  Processing members ${offset + 1}-${offset + members.length}...`);

      for (const member of members) {
        try {
          const bioguideId = member.bioguideId;

          // Fetch full member details
          const detailsData = await fetchCongressAPI(`/member/${bioguideId}`);
          const memberDetails = detailsData.member;

          // Extract office info from current term if available
          const currentTerm = memberDetails.terms?.[0]; // Most recent term
          const officeAddress = currentTerm?.memberType === 'Senator'
            ? memberDetails.addressInformation?.officeAddress
            : currentTerm?.officeAddress;
          const phoneNumber = currentTerm?.phoneNumber || memberDetails.addressInformation?.phoneNumber;

          const query = `
            INSERT OR REPLACE INTO members (
              bioguide_id, first_name, middle_name, last_name,
              party, state, district, birth_year, current_member,
              image_url, office_address, phone_number
            ) VALUES (
              ${escapeSQLString(bioguideId)},
              ${escapeSQLString(memberDetails.firstName)},
              ${escapeSQLString(memberDetails.middleName)},
              ${escapeSQLString(memberDetails.lastName)},
              ${escapeSQLString(memberDetails.partyHistory?.[0]?.partyCode)},
              ${escapeSQLString(memberDetails.state)},
              ${memberDetails.district ? memberDetails.district : 'NULL'},
              ${memberDetails.birthYear ? memberDetails.birthYear : 'NULL'},
              ${memberDetails.terms && memberDetails.terms.length > 0 ? 1 : 0},
              ${escapeSQLString(memberDetails.depiction?.imageUrl)},
              ${escapeSQLString(officeAddress)},
              ${escapeSQLString(phoneNumber)}
            )
          `;

          await executeSQL(query);
          stats.members++;

          if (stats.members % 50 === 0) {
            console.log(`    ✓ Inserted ${stats.members} members`);
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`    ✗ Failed to insert member ${member.bioguideId}:`, error);
        }
      }

      offset += limit;

      // Check if there are more results
      if (members.length < limit) {
        hasMore = false;
      }

    } catch (error) {
      console.error(`  ✗ Failed to fetch members batch at offset ${offset}:`, error);
      hasMore = false;
    }
  }

  console.log(`  ✅ Completed: ${stats.members} members inserted`);
}

/**
 * Ingest committees for a specific congress
 */
async function ingestCommittees(congress: number): Promise<void> {
  console.log(`\n🏛️  Fetching committees for ${congress}th Congress...`);

  try {
    // Fetch House committees
    const houseData = await fetchCongressAPI(`/committee/house?limit=250`);
    const houseCommittees = houseData.committees || [];

    // Fetch Senate committees
    const senateData = await fetchCongressAPI(`/committee/senate?limit=250`);
    const senateCommittees = senateData.committees || [];

    const allCommittees = [...houseCommittees, ...senateCommittees];
    console.log(`  Found ${allCommittees.length} committees`);

    for (const committee of allCommittees) {
      try {
        const systemCode = committee.systemCode;
        const name = committee.name || '';
        const chamber = committee.chamber || '';

        const query = `
          INSERT OR REPLACE INTO committees (
            id, name, chamber, committee_code
          ) VALUES (
            ${escapeSQLString(systemCode)},
            ${escapeSQLString(name)},
            ${escapeSQLString(chamber)},
            ${escapeSQLString(systemCode)}
          )
        `;

        await executeSQL(query);
        stats.committees++;

        if (stats.committees % 10 === 0) {
          console.log(`    ✓ Inserted ${stats.committees} committees`);
        }

      } catch (error) {
        console.error(`    ✗ Failed to insert committee:`, error);
      }
    }

    console.log(`  ✅ Completed: ${stats.committees} committees inserted`);

  } catch (error) {
    console.error(`  ✗ Failed to fetch committees:`, error);
  }
}

/**
 * Main ingestion function
 */
async function main() {
  console.log('🗳️  Congress Data Ingestion Tool v2 (IMPROVED)');
  console.log('==============================================\n');
  console.log('✨ NEW FEATURES:');
  console.log('  - Fetches ALL members (not just current congress)');
  console.log('  - Stores FULL bill text (no truncation)');
  console.log('  - Captures policy areas for bills\n');
  console.log(`📊 Monitor progress at: ${ADMIN_DASHBOARD_URL}\n`);
  console.log('Starting ingestion for 118th and 119th Congress...\n');

  // FIRST: Ingest ALL members (not congress-specific)
  // This ensures we have all historical members for foreign key references
  await ingestAllMembers();

  const congresses = [118, 119];

  for (const congress of congresses) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  ${congress}TH CONGRESS`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Ingest data in order
    await ingestCommittees(congress);
    await ingestBills(congress);
    // await ingestVotes(congress); // Add this later
  }

  // Print final stats
  const elapsed = ((Date.now() - stats.startTime) / 1000 / 60).toFixed(2);

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ INGESTION COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📊 Statistics:`);
  console.log(`   Bills:              ${stats.bills.toLocaleString()}`);
  console.log(`   Bills w/ Full Text: ${stats.billsWithText.toLocaleString()}`);
  console.log(`   Bills w/ Policy:    ${stats.billsWithPolicyArea.toLocaleString()}`);
  console.log(`   Members:            ${stats.members.toLocaleString()}`);
  console.log(`   Committees:         ${stats.committees.toLocaleString()}`);
  console.log(`   Votes:              ${stats.votes.toLocaleString()}`);
  console.log(`\n⏱️  Time elapsed: ${elapsed} minutes`);
  console.log(`\n🔍 View data at: ${ADMIN_DASHBOARD_URL}`);
  console.log('\nExample SQL queries to run in admin dashboard:');
  console.log('  SELECT COUNT(*) FROM bills;');
  console.log('  SELECT COUNT(*) FROM bills WHERE text IS NOT NULL;');
  console.log('  SELECT COUNT(*) FROM bills WHERE policy_area IS NOT NULL;');
  console.log('  SELECT * FROM bills WHERE text IS NOT NULL LIMIT 5;');
  console.log('  SELECT title, policy_area FROM bills WHERE policy_area IS NOT NULL LIMIT 10;');
  console.log('  SELECT COUNT(*) FROM members;');
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
