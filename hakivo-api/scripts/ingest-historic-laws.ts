#!/usr/bin/env tsx

/**
 * Historic Laws Ingestion Script
 *
 * Ingests the 100 landmark US laws (1900-2000) from JSON file
 * into the historic_laws database table for podcast generation.
 *
 * Run with: npx tsx scripts/ingest-historic-laws.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const ADMIN_DASHBOARD_URL = process.env.DB_ADMIN_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzq.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

// Path to the JSON file
const JSON_FILE_PATH = path.resolve(__dirname, '../../docs/us_legislation_1900_2000 (1).json');

interface LegislationEntry {
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

interface LegislationData {
  metadata: {
    title: string;
    description: string;
    date_range: string;
    total_entries: number;
  };
  legislation: LegislationEntry[];
}

interface Stats {
  totalInFile: number;
  lawsInserted: number;
  lawsUpdated: number;
  errors: number;
}

const stats: Stats = {
  totalInFile: 0,
  lawsInserted: 0,
  lawsUpdated: 0,
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
 * Escape SQL strings
 */
function escapeSQLString(str: string | null | undefined): string {
  if (str === null || str === undefined || str === '') return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

/**
 * Build INSERT query for a historic law
 */
function buildLawInsert(law: LegislationEntry): string {
  // Convert key_provisions array to JSON string
  const keyProvisionsJSON = JSON.stringify(law.key_provisions);

  return `
    INSERT INTO historic_laws (
      id, name, year, public_law, president_signed, category,
      description, key_provisions, historical_impact
    ) VALUES (
      ${law.id},
      ${escapeSQLString(law.name)},
      ${law.year},
      ${escapeSQLString(law.public_law)},
      ${escapeSQLString(law.president_signed)},
      ${escapeSQLString(law.category)},
      ${escapeSQLString(law.description)},
      ${escapeSQLString(keyProvisionsJSON)},
      ${escapeSQLString(law.historical_impact)}
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      year = excluded.year,
      public_law = excluded.public_law,
      president_signed = excluded.president_signed,
      category = excluded.category,
      description = excluded.description,
      key_provisions = excluded.key_provisions,
      historical_impact = excluded.historical_impact,
      updated_at = (strftime('%s', 'now') * 1000)
  `;
}

/**
 * Main ingestion function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📜 100 LAWS THAT SHAPED AMERICA - DATA INGESTION');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`📡 Admin Dashboard: ${ADMIN_DASHBOARD_URL}`);
  console.log(`📁 JSON File: ${JSON_FILE_PATH}\n`);

  // Test database connection
  try {
    const testResult = await executeSQL('SELECT COUNT(*) as count FROM historic_laws');
    console.log(`✅ Database connected. Current historic laws count: ${testResult.results?.[0]?.count || 0}\n`);
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    process.exit(1);
  }

  // Read the JSON file
  console.log('📊 STEP 1: Reading JSON file...\n');

  let data: LegislationData;
  try {
    const fileContent = fs.readFileSync(JSON_FILE_PATH, 'utf-8');
    data = JSON.parse(fileContent);
    stats.totalInFile = data.legislation.length;
    console.log(`   Found ${stats.totalInFile} laws in JSON file`);
    console.log(`   Title: ${data.metadata.title}`);
    console.log(`   Date Range: ${data.metadata.date_range}\n`);
  } catch (error) {
    console.error('❌ Failed to read JSON file:', error);
    process.exit(1);
  }

  // Process each law
  console.log('📊 STEP 2: Inserting laws into database...\n');

  for (let i = 0; i < data.legislation.length; i++) {
    const law = data.legislation[i];

    try {
      const query = buildLawInsert(law);
      await executeSQL(query);
      stats.lawsInserted++;

      // Progress indicator every 10 laws
      if ((i + 1) % 10 === 0 || i === data.legislation.length - 1) {
        console.log(`   [${i + 1}/${data.legislation.length}] ${law.year} - ${law.name}`);
      }

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 50));

    } catch (error) {
      console.error(`   ❌ Error inserting law ${law.id} (${law.name}):`, error);
      stats.errors++;
    }
  }

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅ INGESTION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 Statistics:');
  console.log(`   Laws in JSON file: ${stats.totalInFile}`);
  console.log(`   Laws inserted/updated: ${stats.lawsInserted}`);
  console.log(`   Errors: ${stats.errors}`);

  // Get final counts and breakdown
  const finalCount = await executeSQL(`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT category) as categories,
      MIN(year) as earliest_year,
      MAX(year) as latest_year,
      SUM(CASE WHEN episode_generated = 1 THEN 1 ELSE 0 END) as episodes_generated
    FROM historic_laws
  `);

  console.log(`\n📊 Database Status:`);
  console.log(`   Total historic laws: ${finalCount.results?.[0]?.total}`);
  console.log(`   Categories: ${finalCount.results?.[0]?.categories}`);
  console.log(`   Year range: ${finalCount.results?.[0]?.earliest_year} - ${finalCount.results?.[0]?.latest_year}`);
  console.log(`   Episodes already generated: ${finalCount.results?.[0]?.episodes_generated}`);

  // Category breakdown
  const categoryBreakdown = await executeSQL(`
    SELECT category, COUNT(*) as count
    FROM historic_laws
    GROUP BY category
    ORDER BY count DESC
  `);

  console.log(`\n📁 Laws by Category:`);
  for (const row of categoryBreakdown.results || []) {
    console.log(`   ${row.category}: ${row.count}`);
  }

  // Sample laws
  const sampleLaws = await executeSQL(`
    SELECT year, name
    FROM historic_laws
    ORDER BY year
    LIMIT 5
  `);

  console.log(`\n📜 Sample Laws (earliest):`);
  for (const row of sampleLaws.results || []) {
    console.log(`   ${row.year}: ${row.name}`);
  }

  console.log(`\n🔍 View data at: ${ADMIN_DASHBOARD_URL}`);
  console.log(`\n🎙️ Ready for podcast generation! Run the podcast-generator service to start creating episodes.`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
