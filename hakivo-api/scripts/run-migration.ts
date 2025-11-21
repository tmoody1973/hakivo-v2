#!/usr/bin/env tsx

/**
 * Run Database Migration
 *
 * Usage: npx tsx scripts/run-migration.ts <migration-file>
 * Example: npx tsx scripts/run-migration.ts db/app-db/0015_add_enrichment_tables.sql
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const ADMIN_DASHBOARD_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const MIGRATION_FILE = process.argv[2];

if (!MIGRATION_FILE) {
  console.error('❌ Migration file path is required');
  console.error('Usage: npx tsx scripts/run-migration.ts <migration-file>');
  console.error('Example: npx tsx scripts/run-migration.ts db/app-db/0015_add_enrichment_tables.sql');
  process.exit(1);
}

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

async function runMigration() {
  console.log(`🔄 Running migration: ${MIGRATION_FILE}\n`);

  try {
    // Read migration file
    const migrationPath = resolve(process.cwd(), MIGRATION_FILE || '');
    console.log(`📄 Reading migration file from: ${migrationPath}`);

    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Split SQL file into individual statements
    // Split on semicolons but ignore those in comments or strings
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => {
        // Remove empty statements and comment-only statements
        if (!stmt) return false;
        if (stmt.startsWith('--')) return false;
        if (stmt.match(/^\/\*[\s\S]*\*\/$/)) return false;
        return true;
      });

    console.log(`\n📊 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'; // Add semicolon back

      // Extract table name or statement type for logging
      const match = statement.match(/CREATE\s+TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/i) ||
                   statement.match(/CREATE\s+INDEX\s+(?:IF NOT EXISTS\s+)?(\w+)/i) ||
                   statement.match(/ALTER\s+TABLE\s+(\w+)/i);
      const identifier = match ? match[1] : `Statement ${i + 1}`;

      try {
        console.log(`  ⏳ Executing: ${identifier}...`);
        await executeSQL(statement);
        console.log(`  ✅ Success: ${identifier}`);
        successCount++;
      } catch (error: any) {
        console.error(`  ❌ Error executing ${identifier}:`, error.message);
        errorCount++;

        // Don't stop on errors - continue with remaining statements
        // This allows CREATE TABLE IF NOT EXISTS to proceed
      }
    }

    // Print summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  MIGRATION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n✅ Successful: ${successCount}`);
    if (errorCount > 0) {
      console.log(`⚠️  Errors: ${errorCount}`);
    }

    // Verify tables were created
    console.log('\n🔍 Verifying migration...\n');

    const tables = ['news_enrichment', 'bill_enrichment', 'bill_analysis', 'bill_news_links'];
    for (const table of tables) {
      try {
        const result = await executeSQL(`SELECT COUNT(*) as count FROM ${table}`);
        const count = result.results?.[0]?.count || 0;
        console.log(`  ✅ ${table}: ${count} rows`);
      } catch (error: any) {
        console.log(`  ❌ ${table}: Not found or error`);
      }
    }

    console.log('\n✅ Migration verification complete!\n');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
