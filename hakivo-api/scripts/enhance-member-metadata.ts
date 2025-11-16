#!/usr/bin/env tsx

/**
 * Enhance Member Metadata
 *
 * Fetches additional biographical and social media data from
 * the @unitedstates/congress-legislators project and enriches
 * the members table with this information.
 *
 * Data sources:
 * - legislators-current.json: Biographical data, IDs, terms
 * - legislators-social-media.json: Social media accounts
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01ka747hjpq5r2qk4ct00r3yyd.01k66gey30f48fys2tv4e412yt.lmapp.run';
const LEGISLATORS_URL = 'https://unitedstates.github.io/congress-legislators/legislators-current.json';
const SOCIAL_MEDIA_URL = 'https://unitedstates.github.io/congress-legislators/legislators-social-media.json';

interface Stats {
  membersProcessed: number;
  bioDataAdded: number;
  socialMediaAdded: number;
  notFound: number;
  errors: number;
}

const stats: Stats = {
  membersProcessed: 0,
  bioDataAdded: 0,
  socialMediaAdded: 0,
  notFound: 0,
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
  console.log('🔄 Member Metadata Enhancement Tool');
  console.log('=====================================\n');
  console.log('Fetching data from @unitedstates/congress-legislators...\n');

  // Fetch legislators data
  console.log('📥 Fetching biographical data...');
  const legislatorsResponse = await fetch(LEGISLATORS_URL);
  const legislators = await legislatorsResponse.json() as any[];
  console.log(`   ✅ Loaded ${legislators.length} legislators\n`);

  // Fetch social media data
  console.log('📥 Fetching social media data...');
  const socialMediaResponse = await fetch(SOCIAL_MEDIA_URL);
  const socialMediaData = await socialMediaResponse.json() as any[];
  console.log(`   ✅ Loaded ${socialMediaData.length} social media profiles\n`);

  // Create lookup maps by bioguide_id
  const bioguideMap = new Map();
  const socialMap = new Map();

  for (const legislator of legislators) {
    const bioguideId = legislator.id.bioguide;
    bioguideMap.set(bioguideId, legislator);
  }

  for (const profile of socialMediaData) {
    const bioguideId = profile.id.bioguide;
    socialMap.set(bioguideId, profile.social);
  }

  // Get all members from database
  console.log('📊 Fetching members from database...');
  const result: any = await executeSQL('SELECT bioguide_id FROM members LIMIT 10000');
  const members = result.results || [];
  console.log(`   Found ${members.length} members to enhance\n`);

  console.log('🔄 Processing members...\n');

  for (const member of members) {
    try {
      stats.membersProcessed++;
      const { bioguide_id } = member;

      const legislator = bioguideMap.get(bioguide_id);
      const social = socialMap.get(bioguide_id);

      if (!legislator && !social) {
        stats.notFound++;
        console.log(`  ⚠️  ${bioguide_id}: No additional data found`);
        continue;
      }

      const updates: string[] = [];

      // Add biographical data
      if (legislator) {
        const bio = legislator.bio;
        const name = legislator.name;
        const ids = legislator.id;
        const terms = legislator.terms || [];
        const currentTerm = terms[terms.length - 1]; // Most recent term

        if (bio?.gender) updates.push(`gender = ${escapeSQLString(bio.gender)}`);
        if (bio?.birthday) updates.push(`birth_date = ${escapeSQLString(bio.birthday)}`);

        if (name?.nickname) updates.push(`nickname = ${escapeSQLString(name.nickname)}`);
        if (name?.suffix) updates.push(`suffix = ${escapeSQLString(name.suffix)}`);

        // IDs
        if (ids?.thomas) updates.push(`thomas_id = ${escapeSQLString(ids.thomas)}`);
        if (ids?.lis) updates.push(`lis_id = ${escapeSQLString(ids.lis)}`);
        if (ids?.govtrack) updates.push(`govtrack_id = ${escapeSQLString(String(ids.govtrack))}`);
        if (ids?.opensecrets) updates.push(`opensecrets_id = ${escapeSQLString(ids.opensecrets)}`);
        if (ids?.votesmart) updates.push(`votesmart_id = ${escapeSQLString(String(ids.votesmart))}`);
        if (ids?.fec) {
          const fecIds = Array.isArray(ids.fec) ? ids.fec : [ids.fec];
          updates.push(`fec_ids = ${escapeSQLString(JSON.stringify(fecIds))}`);
        }
        if (ids?.cspan) updates.push(`cspan_id = ${escapeSQLString(String(ids.cspan))}`);
        if (ids?.wikipedia) updates.push(`wikipedia_id = ${escapeSQLString(ids.wikipedia)}`);
        if (ids?.house_history) updates.push(`house_history_id = ${escapeSQLString(String(ids.house_history))}`);
        if (ids?.ballotpedia) updates.push(`ballotpedia_id = ${escapeSQLString(ids.ballotpedia)}`);
        if (ids?.maplight) updates.push(`maplight_id = ${escapeSQLString(String(ids.maplight))}`);
        if (ids?.icpsr) updates.push(`icpsr_id = ${escapeSQLString(String(ids.icpsr))}`);
        if (ids?.wikidata) updates.push(`wikidata_id = ${escapeSQLString(ids.wikidata)}`);
        if (ids?.google_entity_id) updates.push(`google_entity_id = ${escapeSQLString(ids.google_entity_id)}`);

        // Current term info
        if (currentTerm) {
          if (currentTerm.start) updates.push(`current_term_start = ${escapeSQLString(currentTerm.start)}`);
          if (currentTerm.end) updates.push(`current_term_end = ${escapeSQLString(currentTerm.end)}`);
          if (currentTerm.type) updates.push(`current_term_type = ${escapeSQLString(currentTerm.type)}`);
          if (currentTerm.state) updates.push(`current_term_state = ${escapeSQLString(currentTerm.state)}`);
          if (currentTerm.district !== undefined) updates.push(`current_term_district = ${currentTerm.district}`);
          if (currentTerm.class !== undefined) updates.push(`current_term_class = ${currentTerm.class}`);
          if (currentTerm.state_rank) updates.push(`current_term_state_rank = ${escapeSQLString(currentTerm.state_rank)}`);
        }

        stats.bioDataAdded++;
      }

      // Add social media data
      if (social) {
        if (social.twitter) updates.push(`twitter_handle = ${escapeSQLString(social.twitter)}`);
        if (social.facebook) updates.push(`facebook_url = ${escapeSQLString(`https://facebook.com/${social.facebook}`)}`);
        if (social.youtube) updates.push(`youtube_url = ${escapeSQLString(`https://youtube.com/${social.youtube}`)}`);
        if (social.instagram) updates.push(`instagram_handle = ${escapeSQLString(social.instagram)}`);
        if (social.website) updates.push(`website_url = ${escapeSQLString(social.website)}`);
        if (social.contact_form) updates.push(`contact_form_url = ${escapeSQLString(social.contact_form)}`);
        if (social.rss) updates.push(`rss_url = ${escapeSQLString(social.rss)}`);

        stats.socialMediaAdded++;
      }

      if (updates.length > 0) {
        await executeSQL(`
          UPDATE members
          SET ${updates.join(', ')}
          WHERE bioguide_id = ${escapeSQLString(bioguide_id)}
        `);

        console.log(`  ✅ ${bioguide_id}: Enhanced with ${updates.length} fields`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 10));

    } catch (error) {
      console.error(`  ✗ Error processing member:`, error);
      stats.errors++;
    }

    // Progress update every 100 members
    if (stats.membersProcessed % 100 === 0) {
      console.log(`\n📊 Progress: ${stats.membersProcessed}/${members.length} members`);
      console.log(`   Bio data added: ${stats.bioDataAdded}`);
      console.log(`   Social media added: ${stats.socialMediaAdded}`);
      console.log(`   Not found: ${stats.notFound}`);
      console.log(`   Errors: ${stats.errors}\n`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ ENHANCEMENT COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📊 Final Statistics:`);
  console.log(`   Members processed: ${stats.membersProcessed}`);
  console.log(`   Bio data added: ${stats.bioDataAdded}`);
  console.log(`   Social media added: ${stats.socialMediaAdded}`);
  console.log(`   Not found: ${stats.notFound}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log(`\n🔍 View enhanced data at: ${ADMIN_DASHBOARD_URL}`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
