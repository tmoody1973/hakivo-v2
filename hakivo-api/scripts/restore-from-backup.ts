#!/usr/bin/env tsx

/**
 * EMERGENCY RESTORE SCRIPT
 * Run this if the migration fails and you need to restore original data
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01ka747hjpq5r2qk4ct00r3yyd.01k66gey30f48fys2tv4e412yt.lmapp.run';

async function executeSQL(query: string): Promise<any> {
  const response = await fetch(`${ADMIN_DASHBOARD_URL}/api/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function main() {
  console.log('🚨 EMERGENCY RESTORE FROM BACKUP');
  console.log('==================================\n');
  console.log('⚠️  This will restore members and bills tables from backup\n');

  // Drop current tables
  console.log('[1/4] Dropping current tables...');
  await executeSQL(`DROP TABLE IF EXISTS members`);
  await executeSQL(`DROP TABLE IF EXISTS bills`);
  console.log('  ✅ Dropped\n');

  // Restore members
  console.log('[2/4] Restoring members from backup...');
  await executeSQL(`CREATE TABLE members AS SELECT * FROM members_backup`);
  const membersCount: any = await executeSQL(`SELECT COUNT(*) as count FROM members`);
  console.log(`  ✅ Restored ${membersCount.results[0].count} members\n`);

  // Restore bills
  console.log('[3/4] Restoring bills from backup...');
  await executeSQL(`CREATE TABLE bills AS SELECT * FROM bills_backup`);
  const billsCount: any = await executeSQL(`SELECT COUNT(*) as count FROM bills`);
  console.log(`  ✅ Restored ${billsCount.results[0].count} bills\n`);

  // Cleanup temp tables if they exist
  console.log('[4/4] Cleaning up temp tables...');
  await executeSQL(`DROP TABLE IF EXISTS members_new`);
  await executeSQL(`DROP TABLE IF EXISTS bills_new`);
  console.log('  ✅ Cleaned up\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ RESTORE COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(error => {
  console.error('❌ Restore failed:', error);
  process.exit(1);
});
