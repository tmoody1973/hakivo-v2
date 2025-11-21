#!/usr/bin/env tsx

/**
 * Ingest Co-Sponsored Legislation for a Single Member
 *
 * Usage: npx tsx scripts/ingest-single-member-cosponsors.ts J000293
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local from hakivo-api directory
config({ path: resolve(__dirname, '../.env.local') });

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const ADMIN_DASHBOARD_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

const BIOGUIDE_ID = process.argv[2] || 'J000293';

if (!CONGRESS_API_KEY) {
  console.error('❌ CONGRESS_API_KEY environment variable is required');
  console.error('Get your API key from: https://api.congress.gov/sign-up/');
  process.exit(1);
}

const BASE_URL = 'https://api.congress.gov/v3';

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
 * Execute SQL query against the database
 */
async function executeSQL(query: string): Promise<any> {
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
 * Main ingestion function
 */
async function main() {
  console.log(`🗳️  Ingesting Co-Sponsors for Member: ${BIOGUIDE_ID}\n`);

  try {
    // Get member info
    const memberResult = await executeSQL(`
      SELECT bioguide_id, first_name, last_name, party, state
      FROM members
      WHERE bioguide_id = '${BIOGUIDE_ID}'
    `);

    if (!memberResult.results || memberResult.results.length === 0) {
      console.error(`❌ Member ${BIOGUIDE_ID} not found in database`);
      process.exit(1);
    }

    const member = memberResult.results[0];
    const memberName = `${member.first_name} ${member.last_name} (${member.party}-${member.state})`;
    console.log(`📝 Member: ${memberName}\n`);

    // Fetch all co-sponsored legislation
    let offset = 0;
    const limit = 250;
    let hasMore = true;
    let totalCosponsors = 0;
    let insertedCosponsors = 0;
    let skippedBills = 0;

    console.log('🔄 Fetching co-sponsored legislation from Congress.gov API...\n');

    while (hasMore) {
      console.log(`   Fetching offset ${offset}...`);

      const cosponsoredData = await fetchCongressAPI(
        `/member/${BIOGUIDE_ID}/cosponsored-legislation?offset=${offset}&limit=${limit}`
      );
      const cosponsoredBills = cosponsoredData.cosponsoredLegislation || [];

      if (cosponsoredBills.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`   Found ${cosponsoredBills.length} bills in this batch`);

      // Insert each co-sponsored bill
      for (const bill of cosponsoredBills) {
        try {
          // Build bill ID in our format: {congress}-{type}-{number}
          const congress = bill.congress;
          const billType = bill.type?.toLowerCase();
          const billNumber = bill.number;
          const billId = `${congress}-${billType}-${billNumber}`;

          // Get sponsorship date if available
          const sponsorshipDate = bill.latestAction?.actionDate || null;

          const cosponsorQuery = `
            INSERT OR REPLACE INTO bill_cosponsors (
              bill_id, member_bioguide_id, cosponsor_date
            ) VALUES (
              ${escapeSQLString(billId)},
              ${escapeSQLString(BIOGUIDE_ID)},
              ${escapeSQLString(sponsorshipDate)}
            )
          `;
          await executeSQL(cosponsorQuery);
          insertedCosponsors++;
        } catch (error) {
          // Bill doesn't exist in our database yet - skip silently
          skippedBills++;
        }
        totalCosponsors++;
      }

      offset += limit;

      // Check if there are more results
      if (cosponsoredBills.length < limit) {
        hasMore = false;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Print results
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  ✅ INGESTION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n📊 Results for ${memberName}:`);
    console.log(`   Total cosponsored bills:     ${totalCosponsors.toLocaleString()}`);
    console.log(`   Inserted into database:      ${insertedCosponsors.toLocaleString()}`);
    console.log(`   Skipped (bill not in DB):    ${skippedBills.toLocaleString()}`);

    // Verify in database
    const verifyResult = await executeSQL(`
      SELECT COUNT(*) as count
      FROM bill_cosponsors
      WHERE member_bioguide_id = '${BIOGUIDE_ID}'
    `);
    const dbCount = verifyResult.results?.[0]?.count || 0;
    console.log(`\n✅ Verified: ${dbCount} cosponsors now in database for ${BIOGUIDE_ID}`);

    if (dbCount > 0) {
      // Show sample bills
      const sampleResult = await executeSQL(`
        SELECT
          b.bill_type, b.bill_number, b.title,
          bc.cosponsor_date
        FROM bill_cosponsors bc
        JOIN bills b ON bc.bill_id = b.id
        WHERE bc.member_bioguide_id = '${BIOGUIDE_ID}'
        ORDER BY bc.cosponsor_date DESC
        LIMIT 5
      `);

      console.log('\n📋 Sample co-sponsored bills:');
      sampleResult.results?.forEach((bill: any, i: number) => {
        console.log(`   ${i + 1}. ${bill.bill_type?.toUpperCase()} ${bill.bill_number}`);
        console.log(`      Date: ${bill.cosponsor_date}`);
        console.log(`      Title: ${bill.title?.substring(0, 80)}...`);
      });
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
