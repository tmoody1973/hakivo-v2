#!/usr/bin/env tsx

/**
 * Member Photo Backfill Script
 *
 * Fetches member photos from Congress.gov API and updates the members table.
 * Uses the /member/{bioguideId} endpoint which returns depiction.imageUrl
 *
 * Run with: npx tsx scripts/backfill-member-photos.ts
 */

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const ADMIN_DASHBOARD_URL = process.env.DB_ADMIN_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzq.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const BASE_URL = 'https://api.congress.gov/v3';

if (!CONGRESS_API_KEY) {
  console.error('❌ CONGRESS_API_KEY environment variable is required');
  process.exit(1);
}

interface Stats {
  membersProcessed: number;
  photosAdded: number;
  photosSkipped: number;
  errors: number;
}

const stats: Stats = {
  membersProcessed: 0,
  photosAdded: 0,
  photosSkipped: 0,
  errors: 0
};

/**
 * Execute SQL query via admin dashboard
 */
async function executeSQL(query: string): Promise<any> {
  const response = await fetch(`${ADMIN_DASHBOARD_URL}/db-admin/query`, {
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
 * Escape SQL strings
 */
function escapeSQLString(str: string | null | undefined): string {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

/**
 * Main function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📸 MEMBER PHOTO BACKFILL');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Get all members without photos
  console.log('📊 Fetching members without photos...\n');
  const result = await executeSQL(`
    SELECT bioguide_id, first_name, last_name
    FROM members
    WHERE image_url IS NULL AND current_member = 1
    ORDER BY last_name
  `);

  const members = result.results || [];
  console.log(`   Found ${members.length} members without photos\n`);

  if (members.length === 0) {
    console.log('✅ All members already have photos!');
    return;
  }

  console.log('📸 Fetching photos from Congress.gov API...\n');

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const bioguideId = member.bioguide_id;

    try {
      // Fetch member details from Congress.gov
      const data = await fetchCongressAPI(`/member/${bioguideId}`);
      const memberDetails = data.member;

      const imageUrl = memberDetails?.depiction?.imageUrl;

      if (imageUrl) {
        // Update the member's image URL
        await executeSQL(`
          UPDATE members
          SET image_url = ${escapeSQLString(imageUrl)}
          WHERE bioguide_id = ${escapeSQLString(bioguideId)}
        `);
        stats.photosAdded++;
      } else {
        stats.photosSkipped++;
      }

      stats.membersProcessed++;

      // Progress indicator
      if ((i + 1) % 25 === 0 || i === members.length - 1) {
        console.log(`   [${i + 1}/${members.length}] ${member.first_name} ${member.last_name} - ${imageUrl ? '✅' : '⏭️'}`);
      }

      // Rate limiting - Congress.gov allows 5000 requests/hour
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`   ❌ Error processing ${bioguideId}:`, error);
      stats.errors++;
    }
  }

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅ PHOTO BACKFILL COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 Statistics:');
  console.log(`   Members processed: ${stats.membersProcessed}`);
  console.log(`   Photos added: ${stats.photosAdded}`);
  console.log(`   Members without photos: ${stats.photosSkipped}`);
  console.log(`   Errors: ${stats.errors}`);

  // Verify
  const finalCount = await executeSQL(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN image_url IS NOT NULL THEN 1 ELSE 0 END) as with_photos
    FROM members
    WHERE current_member = 1
  `);
  console.log(`\n📊 Database Status:`);
  console.log(`   Current members: ${finalCount.results?.[0]?.total}`);
  console.log(`   With photos: ${finalCount.results?.[0]?.with_photos}`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
