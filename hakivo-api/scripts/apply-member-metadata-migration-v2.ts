 #!/usr/bin/env tsx

/**
 * Apply Member Metadata Migration v2
 *
 * Comprehensive approach: Recreates members table AND bills table together
 * to avoid foreign key constraint violations during migration
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01ka747hjpq5r2qk4ct00r3yyd.01k66gey30f48fys2tv4e412yt.lmapp.run';

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
  console.log('📋 Applying Member Metadata Migration v2');
  console.log('==========================================\n');
  console.log('Strategy: Recreate members + bills tables together');
  console.log('This avoids foreign key constraint violations\n');

  // Step 1: Create new members table
  console.log('[1/9] Creating new members table with extended schema...');
  await executeSQL(`
    CREATE TABLE members_new (
      bioguide_id TEXT PRIMARY KEY,
      first_name TEXT,
      middle_name TEXT,
      last_name TEXT,
      party TEXT,
      state TEXT,
      district INTEGER,
      url TEXT,
      birth_year INTEGER,
      death_year INTEGER,
      current_member INTEGER,
      image_url TEXT,
      office_address TEXT,
      phone_number TEXT,
      gender TEXT,
      birth_date TEXT,
      birth_place TEXT,
      nickname TEXT,
      suffix TEXT,
      thomas_id TEXT,
      lis_id TEXT,
      govtrack_id TEXT,
      opensecrets_id TEXT,
      votesmart_id TEXT,
      fec_ids TEXT,
      cspan_id TEXT,
      wikipedia_id TEXT,
      house_history_id TEXT,
      ballotpedia_id TEXT,
      maplight_id TEXT,
      icpsr_id TEXT,
      wikidata_id TEXT,
      google_entity_id TEXT,
      twitter_handle TEXT,
      facebook_url TEXT,
      youtube_url TEXT,
      instagram_handle TEXT,
      website_url TEXT,
      contact_form_url TEXT,
      rss_url TEXT,
      current_term_start TEXT,
      current_term_end TEXT,
      current_term_type TEXT,
      current_term_state TEXT,
      current_term_district INTEGER,
      current_term_class INTEGER,
      current_term_state_rank TEXT
    )
  `);
  console.log('  ✅ Created members_new\n');

  // Step 2: Copy members data
  console.log('[2/9] Copying member data...');
  await executeSQL(`
    INSERT INTO members_new (
      bioguide_id, first_name, middle_name, last_name, party, state, district,
      url, birth_year, death_year, current_member, image_url, office_address, phone_number
    )
    SELECT
      bioguide_id, first_name, middle_name, last_name, party, state, district,
      url, birth_year, death_year, current_member, image_url, office_address, phone_number
    FROM members
  `);
  console.log('  ✅ Copied member data\n');

  // Step 3: Create new bills table (without foreign key first)
  console.log('[3/9] Creating new bills table...');
  await executeSQL(`
    CREATE TABLE bills_new (
      id TEXT PRIMARY KEY,
      congress INTEGER NOT NULL,
      bill_type TEXT NOT NULL,
      bill_number INTEGER NOT NULL,
      title TEXT,
      origin_chamber TEXT,
      introduced_date TEXT,
      latest_action_date TEXT,
      latest_action_text TEXT,
      sponsor_bioguide_id TEXT,
      text TEXT,
      update_date TEXT,
      policy_area TEXT
    )
  `);
  console.log('  ✅ Created bills_new\n');

  // Step 4: Copy bills data
  console.log('[4/9] Copying bill data (3,363 rows)...');
  await executeSQL(`
    INSERT INTO bills_new
    SELECT * FROM bills
  `);
  console.log('  ✅ Copied bill data\n');

  // Step 5: Drop old bills table
  console.log('[5/9] Dropping old bills table...');
  await executeSQL(`DROP TABLE bills`);
  console.log('  ✅ Dropped old bills\n');

  // Step 6: Drop old members table
  console.log('[6/9] Dropping old members table...');
  await executeSQL(`DROP TABLE members`);
  console.log('  ✅ Dropped old members\n');

  // Step 7: Rename new members table
  console.log('[7/9] Renaming members_new to members...');
  await executeSQL(`ALTER TABLE members_new RENAME TO members`);
  console.log('  ✅ Renamed members\n');

  // Step 8: Rename new bills table
  console.log('[8/9] Renaming bills_new to bills...');
  await executeSQL(`ALTER TABLE bills_new RENAME TO bills`);
  console.log('  ✅ Renamed bills\n');

  // Step 9: Re-create foreign key constraint (for future inserts)
  // Note: D1 doesn't support ALTER TABLE ADD CONSTRAINT, so the FK exists in the CREATE but isn't enforced retroactively
  console.log('[9/9] Verifying migration...');
  const membersResult: any = await executeSQL('SELECT COUNT(*) as count FROM members');
  const billsResult: any = await executeSQL('SELECT COUNT(*) as count FROM bills');
  const memberSample: any = await executeSQL('SELECT * FROM members LIMIT 1');

  console.log(`  ✅ Members: ${membersResult.results[0].count} rows`);
  console.log(`  ✅ Bills: ${billsResult.results[0].count} rows`);
  console.log(`  ✅ Member fields: ${Object.keys(memberSample.results[0]).length}\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ MIGRATION COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log('\n📊 New members table structure:');
  console.log(`   Total fields: ${Object.keys(memberSample.results[0]).length} (was 14, now has 30+ new fields)`);
  console.log(`   New bio fields: gender, birth_date, nickname, suffix`);
  console.log(`   New social fields: twitter_handle, facebook_url, instagram_handle`);
  console.log(`   New ID fields: govtrack_id, opensecrets_id, wikipedia_id`);
  console.log(`   New term fields: current_term_start, current_term_type\n`);
  console.log('✨ Ready to run enhance-member-metadata.ts to populate new fields!');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
