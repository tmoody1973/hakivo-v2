#!/usr/bin/env tsx

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
  console.log('🔍 Checking District Numbers for House Members\n');
  console.log('Comparing original "district" field vs new "current_term_district" field\n');

  // Get House members with both district fields
  const result: any = await executeSQL(`
    SELECT
      bioguide_id,
      first_name,
      last_name,
      state,
      district as original_district,
      current_term_district as enhanced_district,
      current_term_type
    FROM members
    WHERE current_term_type = 'rep'
    ORDER BY state, district
    LIMIT 20
  `);

  console.log('Sample of 20 House members:\n');
  console.log('Bioguide | Name | State | Original | Enhanced | Match?');
  console.log('─'.repeat(70));

  let matches = 0;
  let mismatches = 0;
  let nullEnhanced = 0;

  for (const member of result.results) {
    const name = `${member.first_name} ${member.last_name}`.substring(0, 15).padEnd(15);
    const match = member.original_district === member.enhanced_district ? '✅' : '❌';
    const enhanced = member.enhanced_district ?? 'NULL';

    console.log(`${member.bioguide_id} | ${name} | ${member.state} | ${String(member.original_district).padStart(2)} | ${String(enhanced).padStart(2)} | ${match}`);

    if (member.original_district === member.enhanced_district) {
      matches++;
    } else if (member.enhanced_district === null) {
      nullEnhanced++;
    } else {
      mismatches++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  Matches: ${matches}`);
  console.log(`  Mismatches: ${mismatches}`);
  console.log(`  NULL enhanced: ${nullEnhanced}\n`);
}

main();
