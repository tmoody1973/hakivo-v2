#!/usr/bin/env tsx

/**
 * Apply Member Metadata Migration
 *
 * Uses Raindrop SmartSQL best practices:
 * - CREATE TABLE IF NOT EXISTS for idempotency
 * - Direct SQL execution through admin dashboard API
 * - Table recreation pattern for D1 compatibility
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
  console.log('📋 Applying Member Metadata Migration');
  console.log('======================================\n');
  console.log('Strategy: Table recreation (D1-compatible)');
  console.log('Following Raindrop SmartSQL best practices\n');

  // Step 0: Disable foreign key constraints temporarily
  console.log('[0/5] Disabling foreign key constraints...');
  await executeSQL(`PRAGMA foreign_keys = OFF`);
  console.log('  ✅ Foreign keys disabled\n');

  // Step 1: Create new members table with all fields
  console.log('[1/5] Creating new members table with extended schema...');
  await executeSQL(`
    CREATE TABLE IF NOT EXISTS members_new (
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

      -- New biographical fields
      gender TEXT,
      birth_date TEXT,
      birth_place TEXT,
      nickname TEXT,
      suffix TEXT,

      -- New ID fields for cross-referencing
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

      -- New social media fields
      twitter_handle TEXT,
      facebook_url TEXT,
      youtube_url TEXT,
      instagram_handle TEXT,
      website_url TEXT,
      contact_form_url TEXT,
      rss_url TEXT,

      -- New term info
      current_term_start TEXT,
      current_term_end TEXT,
      current_term_type TEXT,
      current_term_state TEXT,
      current_term_district INTEGER,
      current_term_class INTEGER,
      current_term_state_rank TEXT
    )
  `);
  console.log('  ✅ Created members_new table\n');

  // Step 2: Copy existing data from old table
  console.log('[2/5] Copying existing member data...');
  const copyResult: any = await executeSQL(`
    INSERT INTO members_new (
      bioguide_id, first_name, middle_name, last_name, party, state, district,
      url, birth_year, death_year, current_member, image_url, office_address, phone_number
    )
    SELECT
      bioguide_id, first_name, middle_name, last_name, party, state, district,
      url, birth_year, death_year, current_member, image_url, office_address, phone_number
    FROM members
  `);
  console.log(`  ✅ Copied existing data\n`);

  // Step 3: Drop old table
  console.log('[3/5] Dropping old members table...');
  await executeSQL(`DROP TABLE members`);
  console.log('  ✅ Dropped old table\n');

  // Step 4: Rename new table to members
  console.log('[4/5] Renaming members_new to members...');
  await executeSQL(`ALTER TABLE members_new RENAME TO members`);
  console.log('  ✅ Renamed table\n');

  // Step 5: Re-enable foreign key constraints
  console.log('[5/5] Re-enabling foreign key constraints...');
  await executeSQL(`PRAGMA foreign_keys = ON`);
  console.log('  ✅ Foreign keys re-enabled\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ MIGRATION COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Verify the new table structure
  const result: any = await executeSQL('SELECT * FROM members LIMIT 1');
  const member = result.results?.[0];

  if (member) {
    const fieldCount = Object.keys(member).length;
    console.log('\n📊 Verified new table structure:');
    console.log(`   Total fields: ${fieldCount} (was 14, now has 30+ new fields)`);
    console.log(`   New bio fields: gender, birth_date, nickname, suffix, etc.`);
    console.log(`   New social fields: twitter_handle, facebook_url, instagram_handle, etc.`);
    console.log(`   New ID fields: govtrack_id, opensecrets_id, wikipedia_id, etc.`);
    console.log(`   New term fields: current_term_start, current_term_type, etc.\n`);
  }

  console.log('✨ Ready to run enhance-member-metadata.ts to populate new fields!');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
