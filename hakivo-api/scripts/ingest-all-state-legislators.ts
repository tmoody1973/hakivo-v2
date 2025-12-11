#!/usr/bin/env tsx

/**
 * State Legislator Ingestion Script
 *
 * Fetches all current state legislators from OpenStates data dumps:
 * https://data.openstates.org/people/current/{state}.csv
 *
 * This is a comprehensive ingestion of all ~7,400 state legislators
 * across all 50 US states plus DC and territories.
 *
 * Run with: npx tsx scripts/ingest-all-state-legislators.ts
 */

const ADMIN_DASHBOARD_URL = process.env.DB_ADMIN_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzq.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

// All US states and territories with legislatures
const JURISDICTIONS = [
  'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga',
  'hi', 'id', 'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md',
  'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nj',
  'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc',
  'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv', 'wi', 'wy',
  'dc', 'pr', 'vi', 'gu', 'as', 'mp'
];

interface Stats {
  statesProcessed: number;
  legislatorsInserted: number;
  legislatorsUpdated: number;
  errors: number;
  statesWithErrors: string[];
}

const stats: Stats = {
  statesProcessed: 0,
  legislatorsInserted: 0,
  legislatorsUpdated: 0,
  errors: 0,
  statesWithErrors: []
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
 * Parse CSV line handling quoted fields with commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

/**
 * Fetch legislators for a state from OpenStates CSV
 */
async function fetchStateLegislators(state: string): Promise<Array<{
  id: string;
  name: string;
  party: string;
  state: string;
  currentRoleTitle: string | null;
  currentRoleDistrict: string | null;
  currentRoleChamber: string | null;
  imageUrl: string | null;
  email: string | null;
}>> {
  const csvUrl = `https://data.openstates.org/people/current/${state.toLowerCase()}.csv`;

  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(`CSV fetch failed: ${response.status}`);
  }

  const csvText = await response.text();
  const lines = csvText.split('\n');

  if (lines.length < 2) {
    return [];
  }

  // Parse header to find column indices
  const header = parseCSVLine(lines[0] as string);
  const idIdx = header.indexOf('id');
  const nameIdx = header.indexOf('name');
  const partyIdx = header.indexOf('current_party');
  const districtIdx = header.indexOf('current_district');
  const chamberIdx = header.indexOf('current_chamber');
  const emailIdx = header.indexOf('email');
  const imageIdx = header.indexOf('image');

  const legislators: Array<{
    id: string;
    name: string;
    party: string;
    state: string;
    currentRoleTitle: string | null;
    currentRoleDistrict: string | null;
    currentRoleChamber: string | null;
    imageUrl: string | null;
    email: string | null;
  }> = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    const cols = parseCSVLine(line);
    const chamber = cols[chamberIdx] || '';

    // Only include legislators (upper/lower chamber)
    if (chamber === 'upper' || chamber === 'lower') {
      legislators.push({
        id: cols[idIdx] || '',
        name: cols[nameIdx] || '',
        party: cols[partyIdx] || '',
        state: state.toUpperCase(),
        currentRoleTitle: chamber === 'upper' ? 'State Senator' : 'State Representative',
        currentRoleDistrict: cols[districtIdx] || null,
        currentRoleChamber: chamber,
        imageUrl: cols[imageIdx] || null,
        email: cols[emailIdx] || null
      });
    }
  }

  return legislators;
}

/**
 * Build UPSERT query for a legislator
 */
function buildLegislatorUpsert(legislator: {
  id: string;
  name: string;
  party: string;
  state: string;
  currentRoleTitle: string | null;
  currentRoleDistrict: string | null;
  currentRoleChamber: string | null;
  imageUrl: string | null;
  email: string | null;
}): string {
  return `
    INSERT INTO state_legislators (
      id, name, party, state, current_role_title, current_role_district,
      current_role_chamber, image_url, email
    ) VALUES (
      ${escapeSQLString(legislator.id)},
      ${escapeSQLString(legislator.name)},
      ${escapeSQLString(legislator.party)},
      ${escapeSQLString(legislator.state)},
      ${escapeSQLString(legislator.currentRoleTitle)},
      ${escapeSQLString(legislator.currentRoleDistrict)},
      ${escapeSQLString(legislator.currentRoleChamber)},
      ${escapeSQLString(legislator.imageUrl)},
      ${escapeSQLString(legislator.email)}
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      party = excluded.party,
      state = excluded.state,
      current_role_title = excluded.current_role_title,
      current_role_district = excluded.current_role_district,
      current_role_chamber = excluded.current_role_chamber,
      image_url = COALESCE(excluded.image_url, state_legislators.image_url),
      email = COALESCE(excluded.email, state_legislators.email),
      updated_at = (strftime('%s', 'now') * 1000)
  `;
}

/**
 * Main ingestion function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🏛️  STATE LEGISLATOR INGESTION');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`📡 Admin Dashboard: ${ADMIN_DASHBOARD_URL}\n`);

  // Test database connection
  try {
    const testResult = await executeSQL('SELECT COUNT(*) as count FROM state_legislators');
    console.log(`✅ Database connected. Current legislator count: ${testResult.results?.[0]?.count || 0}\n`);
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    process.exit(1);
  }

  console.log(`📊 Processing ${JURISDICTIONS.length} jurisdictions...\n`);

  for (const state of JURISDICTIONS) {
    try {
      const legislators = await fetchStateLegislators(state);

      if (legislators.length === 0) {
        console.log(`   ⏭️  ${state.toUpperCase()}: No legislators found (may not have active legislature)`);
        stats.statesProcessed++;
        continue;
      }

      // Process in batches to avoid overwhelming the database
      const batchSize = 25;
      for (let i = 0; i < legislators.length; i += batchSize) {
        const batch = legislators.slice(i, i + batchSize);

        for (const legislator of batch) {
          if (!legislator.id) continue;

          try {
            const query = buildLegislatorUpsert(legislator);
            await executeSQL(query);
            stats.legislatorsUpdated++;
          } catch (err) {
            console.error(`      Error inserting ${legislator.name}:`, err);
            stats.errors++;
          }
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log(`   ✅ ${state.toUpperCase()}: ${legislators.length} legislators`);
      stats.statesProcessed++;

      // Rate limiting between states
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`   ❌ ${state.toUpperCase()}: Error -`, error);
      stats.errors++;
      stats.statesWithErrors.push(state.toUpperCase());
    }
  }

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅ INGESTION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 Statistics:');
  console.log(`   States processed: ${stats.statesProcessed}`);
  console.log(`   Legislators upserted: ${stats.legislatorsUpdated}`);
  console.log(`   Errors: ${stats.errors}`);

  if (stats.statesWithErrors.length > 0) {
    console.log(`   States with errors: ${stats.statesWithErrors.join(', ')}`);
  }

  // Get final counts
  const finalCount = await executeSQL(`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT state) as states,
      SUM(CASE WHEN current_role_chamber = 'upper' THEN 1 ELSE 0 END) as senators,
      SUM(CASE WHEN current_role_chamber = 'lower' THEN 1 ELSE 0 END) as reps
    FROM state_legislators
  `);

  console.log(`\n📊 Database Status:`);
  console.log(`   Total state legislators: ${finalCount.results?.[0]?.total}`);
  console.log(`   States covered: ${finalCount.results?.[0]?.states}`);
  console.log(`   State Senators: ${finalCount.results?.[0]?.senators}`);
  console.log(`   State Representatives: ${finalCount.results?.[0]?.reps}`);

  // Sample by state
  const sampleByState = await executeSQL(`
    SELECT state, COUNT(*) as count
    FROM state_legislators
    GROUP BY state
    ORDER BY count DESC
    LIMIT 10
  `);

  console.log(`\n🔝 Top 10 states by legislator count:`);
  for (const row of sampleByState.results || []) {
    console.log(`   ${row.state}: ${row.count}`);
  }

  console.log(`\n🔍 View data at: ${ADMIN_DASHBOARD_URL}`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
