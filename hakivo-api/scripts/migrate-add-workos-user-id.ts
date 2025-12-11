#!/usr/bin/env tsx

/**
 * Database Migration: Add workos_user_id to users table
 *
 * This migration adds support for WorkOS authentication by:
 * - Adding workos_user_id column to users table
 * - Creating an index for faster lookups
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

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
  console.log('🔄 Database Migration: Add WorkOS User ID');
  console.log('==========================================\n');

  try {
    // Check if column already exists
    console.log('📊 Checking if workos_user_id column exists...');
    const checkResult = await executeSQL(`
      SELECT COUNT(*) as count
      FROM pragma_table_info('users')
      WHERE name = 'workos_user_id'
    `);

    const columnExists = checkResult.results?.[0]?.count > 0;

    if (columnExists) {
      console.log('✅ Column workos_user_id already exists. Skipping migration.\n');
      return;
    }

    console.log('📝 Adding workos_user_id column to users table...');
    await executeSQL(`
      ALTER TABLE users ADD COLUMN workos_user_id TEXT
    `);
    console.log('   ✅ Column added successfully\n');

    console.log('📝 Creating index on workos_user_id...');
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_users_workos_user_id ON users(workos_user_id)
    `);
    console.log('   ✅ Index created successfully\n');

    // Verify migration
    console.log('🔍 Verifying migration...');
    const verifyResult = await executeSQL(`
      SELECT sql FROM sqlite_master
      WHERE type='table' AND name='users'
    `);
    console.log('   Table schema updated:\n');
    console.log(verifyResult.results?.[0]?.sql || 'Schema not found');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  ✅ MIGRATION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📌 Next steps:');
    console.log('   1. Set WorkOS environment variables');
    console.log('   2. Configure WorkOS dashboard redirect URLs');
    console.log('   3. Test authentication flow\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
