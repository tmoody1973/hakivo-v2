1#!/usr/bin/env tsx

/**
 * Congress Data Ingestion Script
 *
 * Fetches and populates the database with Congress.gov data for 118th and 119th Congress.
 * Run with: npx tsx scripts/ingest-congress-data.ts
 *
 * This script will:
 * - Fetch bills, members, committees, and votes
 * - Populate all database tables
 * - Show progress in real-time
 * - Allow monitoring via admin dashboard
 */

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const ADMIN_DASHBOARD_URL = 'https://svc-01ka747hjpq5r2qk4ct00r3yyd.01k66gey30f48fys2tv4e412yt.lmapp.run';
const DB_ADMIN_URL = 'http://localhost:8787'; // You'll need to expose this locally

if (!CONGRESS_API_KEY) {
  console.error('❌ CONGRESS_API_KEY environment variable is required');
  console.error('Get your API key from: https://api.congress.gov/sign-up/');
  process.exit(1);
}

const BASE_URL = 'https://api.congress.gov/v3';

interface Stats {
  bills: number;
  members: number;
  committees: number;
  votes: number;
  startTime: number;
}

const stats: Stats = {
  bills: 0,
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
  // For now, we'll use the admin dashboard's query endpoint
  // In production, you'd connect directly to the D1 database

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
 * Ingest bills for a specific congress
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

          // Insert bill into database
          const billId = `${congress}-${billType}-${billNumber}`;
          const query = `
            INSERT OR REPLACE INTO bills (
              id, congress, bill_type, bill_number, title,
              origin_chamber, introduced_date, latest_action_date,
              latest_action_text, sponsor_bioguide_id, update_date
            ) VALUES (
              '${billId}',
              ${congress},
              '${billType}',
              ${billNumber},
              ${billDetails.title ? `'${billDetails.title.replace(/'/g, "''")}'` : 'NULL'},
              ${billDetails.originChamber ? `'${billDetails.originChamber}'` : 'NULL'},
              ${billDetails.introducedDate ? `'${billDetails.introducedDate}'` : 'NULL'},
              ${billDetails.latestAction?.actionDate ? `'${billDetails.latestAction.actionDate}'` : 'NULL'},
              ${billDetails.latestAction?.text ? `'${billDetails.latestAction.text.replace(/'/g, "''")}'` : 'NULL'},
              ${billDetails.sponsors?.[0]?.bioguideId ? `'${billDetails.sponsors[0].bioguideId}'` : 'NULL'},
              ${billDetails.updateDate ? `'${billDetails.updateDate}'` : 'NULL'}
            )
          `;

          await executeSQL(query);
          stats.bills++;

          // Fetch and store bill text if available
          if (billDetails.textVersions && billDetails.textVersions.length > 0) {
            const latestVersion = billDetails.textVersions[0];
            if (latestVersion.formats) {
              const textFormat = latestVersion.formats.find((f: any) => f.type === 'Formatted Text');
              if (textFormat?.url) {
                try {
                  const textResponse = await fetch(textFormat.url);
                  const billText = await textResponse.text();

                  // Update bill with text content
                  await executeSQL(`
                    UPDATE bills
                    SET text = '${billText.replace(/'/g, "''").substring(0, 50000)}'
                    WHERE id = '${billId}'
                  `);
                } catch (error) {
                  console.warn(`    ⚠️  Could not fetch text for ${billId}`);
                }
              }
            }
          }

          if (stats.bills % 10 === 0) {
            console.log(`    ✓ Inserted ${stats.bills} bills`);
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

  console.log(`  ✅ Completed: ${stats.bills} bills inserted`);
}

/**
 * Ingest members for a specific congress
 */
async function ingestMembers(congress: number): Promise<void> {
  console.log(`\n👥 Fetching members for ${congress}th Congress...`);

  try {
    const data = await fetchCongressAPI(`/member/congress/${congress}?limit=600`);
    const members = data.members || [];

    console.log(`  Found ${members.length} members`);

    for (const member of members) {
      try {
        const bioguideId = member.bioguideId;

        // Fetch full member details
        const detailsData = await fetchCongressAPI(`/member/${bioguideId}`);
        const memberDetails = detailsData.member;

        const query = `
          INSERT OR REPLACE INTO members (
            bioguide_id, first_name, middle_name, last_name,
            party, state, district, birth_year, current_member
          ) VALUES (
            '${bioguideId}',
            ${memberDetails.firstName ? `'${memberDetails.firstName.replace(/'/g, "''")}'` : 'NULL'},
            ${memberDetails.middleName ? `'${memberDetails.middleName.replace(/'/g, "''")}'` : 'NULL'},
            ${memberDetails.lastName ? `'${memberDetails.lastName.replace(/'/g, "''")}'` : 'NULL'},
            ${memberDetails.partyHistory?.[0]?.partyCode ? `'${memberDetails.partyHistory[0].partyCode}'` : 'NULL'},
            ${memberDetails.state ? `'${memberDetails.state}'` : 'NULL'},
            ${memberDetails.district ? memberDetails.district : 'NULL'},
            ${memberDetails.birthYear ? memberDetails.birthYear : 'NULL'},
            1
          )
        `;

        await executeSQL(query);
        stats.members++;

        if (stats.members % 10 === 0) {
          console.log(`    ✓ Inserted ${stats.members} members`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`    ✗ Failed to insert member ${member.bioguideId}:`, error);
      }
    }

    console.log(`  ✅ Completed: ${stats.members} members inserted`);

  } catch (error) {
    console.error(`  ✗ Failed to fetch members:`, error);
  }
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
        const name = committee.name?.replace(/'/g, "''") || '';
        const chamber = committee.chamber || '';

        const query = `
          INSERT OR REPLACE INTO committees (
            id, name, chamber, committee_code
          ) VALUES (
            '${systemCode}',
            '${name}',
            '${chamber}',
            '${systemCode}'
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
  console.log('🗳️  Congress Data Ingestion Tool');
  console.log('================================\n');
  console.log(`📊 Monitor progress at: ${ADMIN_DASHBOARD_URL}\n`);
  console.log('Starting ingestion for 118th and 119th Congress...\n');

  const congresses = [118, 119];

  for (const congress of congresses) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  ${congress}TH CONGRESS`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Ingest data in order
    await ingestMembers(congress);
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
  console.log(`   Bills:      ${stats.bills.toLocaleString()}`);
  console.log(`   Members:    ${stats.members.toLocaleString()}`);
  console.log(`   Committees: ${stats.committees.toLocaleString()}`);
  console.log(`   Votes:      ${stats.votes.toLocaleString()}`);
  console.log(`\n⏱️  Time elapsed: ${elapsed} minutes`);
  console.log(`\n🔍 View data at: ${ADMIN_DASHBOARD_URL}`);
  console.log('\nExample SQL queries to run in admin dashboard:');
  console.log('  SELECT COUNT(*) FROM bills;');
  console.log('  SELECT * FROM bills LIMIT 10;');
  console.log('  SELECT title, text FROM bills WHERE bill_type = "hr" LIMIT 5;');
  console.log('  SELECT * FROM members WHERE state = "CA";');
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
