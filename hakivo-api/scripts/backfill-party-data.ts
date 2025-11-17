#!/usr/bin/env tsx

/**
 * Party Data Backfill Script
 *
 * Fast, focused script to update only the party field for all members.
 * Fetches party affiliation from @unitedstates/congress-legislators.
 *
 * Usage: npx tsx scripts/backfill-party-data.ts
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01ka747hjpq5r2qk4ct00r3yyd.01k66gey30f48fys2tv4e412yt.lmapp.run';
const LEGISLATORS_URL = 'https://unitedstates.github.io/congress-legislators/legislators-current.json';

interface Stats {
  total: number;
  updated: number;
  noMatch: number;
  noParty: number;
  errors: number;
}

const stats: Stats = {
  total: 0,
  updated: 0,
  noMatch: 0,
  noParty: 0,
  errors: 0
};

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

function escapeSQLString(str: string | null | undefined): string {
  if (!str) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}

async function main() {
  console.log('🎯 Party Data Backfill');
  console.log('======================\n');

  // Fetch legislators data
  console.log('📥 Fetching party data from @unitedstates/congress-legislators...');
  const response = await fetch(LEGISLATORS_URL);
  const legislators = await response.json() as any[];
  console.log(`   ✅ Loaded ${legislators.length} current legislators\n`);

  // Create party map by bioguide_id
  console.log('📊 Building party lookup map...');
  const partyMap = new Map<string, string>();

  for (const legislator of legislators) {
    const bioguideId = legislator.id.bioguide;
    const terms = legislator.terms || [];
    const currentTerm = terms[terms.length - 1];

    if (currentTerm?.party) {
      partyMap.set(bioguideId, currentTerm.party);
    }
  }

  console.log(`   ✅ Found party data for ${partyMap.size} members\n`);

  // Get all members from database
  console.log('📊 Fetching members from database...');
  const result: any = await executeSQL('SELECT bioguide_id, party FROM members WHERE party IS NULL OR party = "" LIMIT 10000');
  const members = result.results || [];
  console.log(`   Found ${members.length} members without party data\n`);

  console.log('🔄 Updating party affiliations...\n');

  for (const member of members) {
    try {
      stats.total++;
      const { bioguide_id, party: currentParty } = member;

      const newParty = partyMap.get(bioguide_id);

      if (!newParty) {
        stats.noMatch++;
        continue;
      }

      // Update party
      await executeSQL(`
        UPDATE members
        SET party = ${escapeSQLString(newParty)}
        WHERE bioguide_id = ${escapeSQLString(bioguide_id)}
      `);

      stats.updated++;

      if (stats.updated % 50 === 0) {
        console.log(`  ✓ Updated ${stats.updated}/${members.length} members`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 10));

    } catch (error) {
      console.error(`  ✗ Error updating ${member.bioguide_id}:`, error);
      stats.errors++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ PARTY BACKFILL COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📊 Final Statistics:`);
  console.log(`   Total processed: ${stats.total}`);
  console.log(`   Party updated: ${stats.updated}`);
  console.log(`   No match found: ${stats.noMatch}`);
  console.log(`   Errors: ${stats.errors}`);

  // Verify party distribution
  console.log(`\n🔍 Verifying party distribution...`);
  const partyStats: any = await executeSQL(`
    SELECT party, COUNT(*) as count
    FROM members
    WHERE party IS NOT NULL
    GROUP BY party
    ORDER BY count DESC
  `);

  console.log('\n📊 Current Party Distribution:');
  for (const row of partyStats.results || []) {
    console.log(`   ${row.party}: ${row.count} members`);
  }

  console.log(`\n🔍 View updated data at: ${ADMIN_DASHBOARD_URL}`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
