#!/usr/bin/env tsx

/**
 * Co-Sponsors Only Ingestion Script
 *
 * Fetches co-sponsors for existing bills in the database.
 * Much faster than full ingestion since it only fetches co-sponsor data.
 * Run with: npx tsx scripts/ingest-cosponsors-only.ts
 *
 * Prerequisites:
 * - Bills must already exist in database (from previous ingestion)
 * - CONGRESS_API_KEY environment variable must be set
 */

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const ADMIN_DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

if (!CONGRESS_API_KEY) {
  console.error('❌ CONGRESS_API_KEY environment variable is required');
  console.error('Get your API key from: https://api.congress.gov/sign-up/');
  process.exit(1);
}

const BASE_URL = 'https://api.congress.gov/v3';

interface Stats {
  totalBills: number;
  processedBills: number;
  billsWithCosponsors: number;
  totalCosponsors: number;
  skippedBills: number;
  errors: number;
  startTime: number;
}

const stats: Stats = {
  totalBills: 0,
  processedBills: 0,
  billsWithCosponsors: 0,
  totalCosponsors: 0,
  skippedBills: 0,
  errors: 0,
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
 * Get all existing bills from database
 */
async function getExistingBills(): Promise<any[]> {
  console.log('📊 Fetching existing bills from database...');

  const result = await executeSQL(`
    SELECT id, congress, bill_type, bill_number
    FROM bills
    ORDER BY congress DESC, bill_type, bill_number
  `);

  const bills = result.results || [];
  console.log(`✅ Found ${bills.length} bills in database\n`);

  return bills;
}

/**
 * Check if bill already has cosponsors
 */
async function hasExistingCosponsors(billId: string): Promise<boolean> {
  const result = await executeSQL(`
    SELECT COUNT(*) as count
    FROM bill_cosponsors
    WHERE bill_id = ${escapeSQLString(billId)}
  `);

  const count = result.results?.[0]?.count || 0;
  return count > 0;
}

/**
 * Fetch and store cosponsors for a single bill
 */
async function ingestCosponsorsForBill(bill: any): Promise<void> {
  const billId = bill.id;
  const congress = bill.congress;
  const billType = bill.bill_type;
  const billNumber = bill.bill_number;

  try {
    // Check if we already have cosponsors for this bill
    const hasCosponsors = await hasExistingCosponsors(billId);
    if (hasCosponsors) {
      console.log(`  ⏭️  ${billId} - already has cosponsors, skipping`);
      stats.skippedBills++;
      return;
    }

    // Fetch cosponsors from Congress.gov API
    const cosponsorsData = await fetchCongressAPI(`/bill/${congress}/${billType}/${billNumber}/cosponsors`);
    const cosponsors = cosponsorsData.cosponsors || [];

    if (cosponsors.length === 0) {
      console.log(`  ℹ️  ${billId} - no cosponsors`);
      stats.processedBills++;
      return;
    }

    // Insert cosponsors into database
    let insertedCount = 0;
    for (const cosponsor of cosponsors) {
      if (cosponsor.bioguideId) {
        try {
          const cosponsorQuery = `
            INSERT OR REPLACE INTO bill_cosponsors (
              bill_id, member_bioguide_id, cosponsor_date
            ) VALUES (
              ${escapeSQLString(billId)},
              ${escapeSQLString(cosponsor.bioguideId)},
              ${escapeSQLString(cosponsor.sponsorshipDate)}
            )
          `;
          await executeSQL(cosponsorQuery);
          insertedCount++;
          stats.totalCosponsors++;
        } catch (error) {
          console.warn(`    ⚠️  Failed to insert cosponsor ${cosponsor.bioguideId}`);
        }
      }
    }

    console.log(`  ✅ ${billId} - stored ${insertedCount} cosponsors`);
    stats.billsWithCosponsors++;
    stats.processedBills++;

  } catch (error: any) {
    console.error(`  ❌ ${billId} - error: ${error.message}`);
    stats.errors++;
    stats.processedBills++;
  }

  // Rate limiting - 100ms between requests (well within 5,000/hour limit)
  await new Promise(resolve => setTimeout(resolve, 100));
}

/**
 * Main ingestion function
 */
async function main() {
  console.log('🗳️  Co-Sponsors Only Ingestion Script');
  console.log('=====================================\n');
  console.log('📝 This script will:');
  console.log('  - Fetch all existing bills from database');
  console.log('  - Skip bills that already have cosponsors');
  console.log('  - Fetch and store cosponsors for remaining bills\n');
  console.log(`📊 Monitor progress at: ${ADMIN_DASHBOARD_URL}\n`);
  console.log('Starting co-sponsor ingestion...\n');

  // Get all existing bills
  const bills = await getExistingBills();
  stats.totalBills = bills.length;

  if (bills.length === 0) {
    console.log('❌ No bills found in database. Please run the full ingestion first.');
    process.exit(1);
  }

  console.log(`🔄 Processing ${bills.length} bills...\n`);

  // Process each bill
  for (let i = 0; i < bills.length; i++) {
    const bill = bills[i];

    // Show progress every 10 bills
    if (i > 0 && i % 10 === 0) {
      const progress = ((i / bills.length) * 100).toFixed(1);
      const elapsed = ((Date.now() - stats.startTime) / 1000 / 60).toFixed(1);
      console.log(`\n📊 Progress: ${i}/${bills.length} (${progress}%) | ${elapsed} min elapsed`);
      console.log(`   Cosponsors: ${stats.totalCosponsors} | Skipped: ${stats.skippedBills} | Errors: ${stats.errors}\n`);
    }

    await ingestCosponsorsForBill(bill);
  }

  // Print final stats
  const elapsed = ((Date.now() - stats.startTime) / 1000 / 60).toFixed(2);

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ CO-SPONSOR INGESTION COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📊 Statistics:`);
  console.log(`   Total Bills:           ${stats.totalBills.toLocaleString()}`);
  console.log(`   Processed:             ${stats.processedBills.toLocaleString()}`);
  console.log(`   Bills w/ Cosponsors:   ${stats.billsWithCosponsors.toLocaleString()}`);
  console.log(`   Total Cosponsors:      ${stats.totalCosponsors.toLocaleString()}`);
  console.log(`   Skipped (had data):    ${stats.skippedBills.toLocaleString()}`);
  console.log(`   Errors:                ${stats.errors.toLocaleString()}`);
  console.log(`\n⏱️  Time elapsed: ${elapsed} minutes`);
  console.log(`\n🔍 View data at: ${ADMIN_DASHBOARD_URL}`);
  console.log('\nExample SQL queries to verify:');
  console.log('  SELECT COUNT(*) FROM bill_cosponsors;');
  console.log('  SELECT COUNT(DISTINCT bill_id) FROM bill_cosponsors;');
  console.log('  SELECT COUNT(DISTINCT member_bioguide_id) FROM bill_cosponsors;');
  console.log('  SELECT b.title, COUNT(*) as cosponsor_count');
  console.log('    FROM bill_cosponsors bc');
  console.log('    JOIN bills b ON bc.bill_id = b.id');
  console.log('    GROUP BY b.id');
  console.log('    ORDER BY cosponsor_count DESC');
  console.log('    LIMIT 10;');
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
