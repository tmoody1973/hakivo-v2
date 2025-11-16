#!/usr/bin/env tsx

/**
 * Fix Broken SmartBucket References
 *
 * Clears SmartBucket references for bills where the actual content wasn't stored
 * This allows the main ingestion script to re-fetch and store these bills properly
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01ka747hjpq5r2qk4ct00r3yyd.01k66gey30f48fys2tv4e412yt.lmapp.run';

const BROKEN_BILLS = [
  '118-hr-6492',
  '118-s-4367',
  '118-hr-4563',
  '118-hr-10545',
  '118-hr-4552',
  '118-hr-10515',
  '118-hjres-96',
  '118-hr-4507',
  '118-hr-10526',
  '118-hr-10529'
];

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

async function main() {
  console.log('🔧 Fixing Broken SmartBucket References');
  console.log('==========================================\n');
  console.log(`Clearing references for ${BROKEN_BILLS.length} bills with missing SmartBucket content...\n`);

  for (const billId of BROKEN_BILLS) {
    try {
      console.log(`  Clearing ${billId}...`);

      await executeSQL(`
        UPDATE bills
        SET text = NULL
        WHERE id = '${billId}'
      `);

      console.log(`  ✅ Cleared ${billId}`);
    } catch (error) {
      console.error(`  ✗ Error clearing ${billId}:`, error);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ FIX COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nThese bills will be re-fetched by the main ingestion script.');
  console.log(`View data at: ${ADMIN_DASHBOARD_URL}`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
