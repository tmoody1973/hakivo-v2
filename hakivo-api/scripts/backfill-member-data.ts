#!/usr/bin/env tsx

/**
 * Member Data Backfill Script
 *
 * Updates existing members with missing:
 * - image_url
 * - office_address
 * - phone_number
 *
 * Run with: npx tsx scripts/backfill-member-data.ts
 */

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const ADMIN_DASHBOARD_URL = 'https://svc-01ka747hjpq5r2qk4ct00r3yyd.01k66gey30f48fys2tv4e412yt.lmapp.run';

if (!CONGRESS_API_KEY) {
  console.error('❌ CONGRESS_API_KEY environment variable is required');
  process.exit(1);
}

const BASE_URL = 'https://api.congress.gov/v3';

interface Stats {
  membersProcessed: number;
  imageAdded: number;
  addressAdded: number;
  phoneAdded: number;
  errors: number;
}

const stats: Stats = {
  membersProcessed: 0,
  imageAdded: 0,
  addressAdded: 0,
  phoneAdded: 0,
  errors: 0
};

/**
 * Fetch from Congress.gov API
 */
async function fetchCongressAPI(endpoint: string): Promise<any> {
  const url = `${BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${CONGRESS_API_KEY}&format=json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Congress API error: ${response.status}`);
  }
  return response.json();
}

/**
 * Execute SQL query
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
 * Main backfill function
 */
async function main() {
  console.log('🔄 Member Data Backfill Tool');
  console.log('============================\n');
  console.log('This script updates existing members with missing data...\n');

  // Get all members that need updating
  const result = await executeSQL(`
    SELECT bioguide_id
    FROM members
    WHERE image_url IS NULL OR office_address IS NULL OR phone_number IS NULL
    ORDER BY bioguide_id
  `);

  const membersToUpdate = result.results || [];
  console.log(`Found ${membersToUpdate.length} members needing updates\n`);

  if (membersToUpdate.length === 0) {
    console.log('✅ All members already have full data!');
    return;
  }

  for (const member of membersToUpdate) {
    try {
      stats.membersProcessed++;

      const { bioguide_id } = member;

      console.log(`[${stats.membersProcessed}/${membersToUpdate.length}] Processing ${bioguide_id}...`);

      // Fetch full member details from API
      const detailsData = await fetchCongressAPI(`/member/${bioguide_id}`);
      const memberDetails = detailsData.member;

      let updates: string[] = [];

      // Extract image URL
      const imageUrl = memberDetails.depiction?.imageUrl;
      if (imageUrl) {
        updates.push(`image_url = ${escapeSQLString(imageUrl)}`);
        stats.imageAdded++;
      }

      // Extract office address and phone from current term
      const currentTerm = memberDetails.terms?.[0]; // Most recent term
      const officeAddress = currentTerm?.memberType === 'Senator'
        ? memberDetails.addressInformation?.officeAddress
        : currentTerm?.officeAddress;
      const phoneNumber = currentTerm?.phoneNumber || memberDetails.addressInformation?.phoneNumber;

      if (officeAddress) {
        updates.push(`office_address = ${escapeSQLString(officeAddress)}`);
        stats.addressAdded++;
      }

      if (phoneNumber) {
        updates.push(`phone_number = ${escapeSQLString(phoneNumber)}`);
        stats.phoneAdded++;
      }

      // Update the member if we have any updates
      if (updates.length > 0) {
        await executeSQL(`
          UPDATE members
          SET ${updates.join(', ')}
          WHERE bioguide_id = ${escapeSQLString(bioguide_id)}
        `);

        console.log(`  ✅ Updated: ${updates.length} fields`);
      } else {
        console.log(`  ⚠️  No new data available`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`  ✗ Error processing member:`, error);
      stats.errors++;
    }

    // Progress update every 25 members
    if (stats.membersProcessed % 25 === 0) {
      console.log(`\n📊 Progress: ${stats.membersProcessed}/${membersToUpdate.length} members`);
      console.log(`   Images added: ${stats.imageAdded}`);
      console.log(`   Addresses added: ${stats.addressAdded}`);
      console.log(`   Phones added: ${stats.phoneAdded}`);
      console.log(`   Errors: ${stats.errors}\n`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ BACKFILL COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📊 Final Statistics:`);
  console.log(`   Members processed: ${stats.membersProcessed}`);
  console.log(`   Images added: ${stats.imageAdded}`);
  console.log(`   Addresses added: ${stats.addressAdded}`);
  console.log(`   Phones added: ${stats.phoneAdded}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log(`\n🔍 View data at: ${ADMIN_DASHBOARD_URL}`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
