#!/usr/bin/env tsx

/**
 * Import Historic Laws from JSON
 * Loads the 100 laws from the JSON file into the historic_laws table
 */

import * as fs from 'fs';
import * as path from 'path';

const ADMIN_DASHBOARD_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

interface Law {
  id: number;
  name: string;
  year: number;
  public_law: string;
  president_signed: string;
  category: string;
  description: string;
  key_provisions: string[];
  historical_impact: string;
}

interface LawsData {
  metadata: {
    title: string;
    description: string;
    date_range: string;
    total_entries: number;
  };
  legislation: Law[];
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

// Escape single quotes for SQL
function escapeSQL(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

async function importLaws() {
  console.log('📚 Importing Historic Laws from JSON\n');

  // Read the JSON file
  const jsonPath = path.join(__dirname, '../../docs/us_legislation_1900_2000 (1).json');

  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ JSON file not found at: ${jsonPath}`);
    process.exit(1);
  }

  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  const data: LawsData = JSON.parse(jsonContent);

  console.log(`📊 Metadata:`);
  console.log(`   Title: ${data.metadata.title}`);
  console.log(`   Date Range: ${data.metadata.date_range}`);
  console.log(`   Total Entries: ${data.metadata.total_entries}\n`);

  // Check if data already exists
  try {
    const existingResult = await executeSQL('SELECT COUNT(*) as count FROM historic_laws');
    const existingCount = existingResult.results?.[0]?.count || 0;

    if (existingCount > 0) {
      console.log(`⚠️  Table already has ${existingCount} records.`);
      console.log(`   To re-import, first run: DELETE FROM historic_laws`);
      console.log(`   Skipping import.\n`);
      return;
    }
  } catch (error: any) {
    console.error(`❌ Error checking existing data:`, error.message);
    console.log(`   Make sure to run migrate-podcast-tables.ts first.\n`);
    process.exit(1);
  }

  // Import each law
  let successCount = 0;
  let errorCount = 0;
  const now = Date.now();

  for (const law of data.legislation) {
    try {
      const keyProvisionsJson = JSON.stringify(law.key_provisions);

      const sql = `INSERT INTO historic_laws (
        id, name, year, public_law, president_signed, category,
        description, key_provisions, historical_impact,
        episode_generated, created_at, updated_at
      ) VALUES (
        ${law.id},
        '${escapeSQL(law.name)}',
        ${law.year},
        '${escapeSQL(law.public_law)}',
        '${escapeSQL(law.president_signed)}',
        '${escapeSQL(law.category)}',
        '${escapeSQL(law.description)}',
        '${escapeSQL(keyProvisionsJson)}',
        '${escapeSQL(law.historical_impact)}',
        0,
        ${now},
        ${now}
      )`;

      await executeSQL(sql);
      console.log(`  ✅ ${law.id}. ${law.name} (${law.year})`);
      successCount++;
    } catch (error: any) {
      console.error(`  ❌ ${law.id}. ${law.name}: ${error.message}`);
      errorCount++;
    }
  }

  // Print summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  IMPORT COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n✅ Imported: ${successCount}`);
  if (errorCount > 0) {
    console.log(`❌ Errors: ${errorCount}`);
  }

  // Verify import
  console.log('\n🔍 Verifying import...\n');

  try {
    // Count by decade
    const decadeResult = await executeSQL(`
      SELECT
        (year / 10) * 10 as decade,
        COUNT(*) as count
      FROM historic_laws
      GROUP BY decade
      ORDER BY decade
    `);

    console.log('  Laws by decade:');
    for (const row of decadeResult.results || []) {
      console.log(`    ${row.decade}s: ${row.count} laws`);
    }

    // Count by category
    const categoryResult = await executeSQL(`
      SELECT
        category,
        COUNT(*) as count
      FROM historic_laws
      GROUP BY category
      ORDER BY count DESC
      LIMIT 10
    `);

    console.log('\n  Top categories:');
    for (const row of categoryResult.results || []) {
      console.log(`    ${row.category}: ${row.count}`);
    }

    // Total count
    const totalResult = await executeSQL('SELECT COUNT(*) as count FROM historic_laws');
    console.log(`\n  Total laws imported: ${totalResult.results?.[0]?.count || 0}`);

  } catch (error: any) {
    console.error(`  ❌ Verification error:`, error.message);
  }

  console.log('\n✅ Import complete!\n');
}

importLaws().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
