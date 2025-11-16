/**
 * Database Initialization Script
 *
 * This script initializes the Hakivo API database schema.
 * Run this script to set up all required tables and indexes.
 *
 * Usage:
 *   npx tsx scripts/init-database.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Read the SQL schema file
const schemaPath = join(__dirname, '../sql/init-schema.sql');
const schema = readFileSync(schemaPath, 'utf-8');

// Split into individual statements (separated by semicolons)
const statements = schema
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

console.log(`📦 Hakivo Database Initialization`);
console.log(`Found ${statements.length} SQL statements to execute\n`);

/**
 * Execute schema initialization
 *
 * This function should be called from a Raindrop service context
 * where the APP_DB environment binding is available.
 */
export async function initializeDatabase(db: any): Promise<void> {
  console.log('🚀 Starting database initialization...\n');

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';

    try {
      // Extract table/index name for logging
      const match = statement.match(/CREATE\s+(TABLE|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
      const objectType = match?.[1] || 'STATEMENT';
      const objectName = match?.[2] || `statement_${i + 1}`;

      await db.exec(statement);

      console.log(`✓ Created ${objectType}: ${objectName}`);
      successCount++;
    } catch (error) {
      console.error(`✗ Error executing statement ${i + 1}:`, error);
      console.error(`  Statement: ${statement.substring(0, 100)}...`);
      errorCount++;
    }
  }

  console.log(`\n✅ Database initialization complete!`);
  console.log(`   Success: ${successCount} statements`);

  if (errorCount > 0) {
    console.log(`   ⚠️  Errors: ${errorCount} statements`);
  }
}

/**
 * Standalone execution (for testing)
 *
 * Note: This requires a Raindrop environment context.
 * In production, call initializeDatabase() from a service.
 */
if (require.main === module) {
  console.log('⚠️  This script must be run from a Raindrop service context');
  console.log('   Use the initialize-db service endpoint instead\n');

  console.log('Schema preview:');
  console.log('===============');
  statements.slice(0, 3).forEach((stmt, i) => {
    console.log(`\n${i + 1}. ${stmt.substring(0, 200)}...`);
  });
  console.log(`\n... and ${statements.length - 3} more statements`);
}
