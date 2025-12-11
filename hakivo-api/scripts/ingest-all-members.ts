#!/usr/bin/env tsx

/**
 * Comprehensive Member Ingestion Script
 *
 * Ingests all current Congress members from multiple data sources:
 * 1. unitedstates.io legislators-current.json - biographical data
 * 2. unitedstates.io legislators-social-media.json - social handles
 * 3. Congress Bioguide photos - official member photos
 *
 * Data sources:
 * - https://unitedstates.github.io/congress-legislators/legislators-current.json
 * - https://unitedstates.github.io/congress-legislators/legislators-social-media.json
 *
 * Run with: npx tsx scripts/ingest-all-members.ts
 */

// Updated admin dashboard URL (Dec 2024 deployment)
const ADMIN_DASHBOARD_URL = process.env.DB_ADMIN_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzq.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

// Data source URLs
const LEGISLATORS_CURRENT_URL = 'https://unitedstates.github.io/congress-legislators/legislators-current.json';
const LEGISLATORS_SOCIAL_MEDIA_URL = 'https://unitedstates.github.io/congress-legislators/legislators-social-media.json';
const BIOGUIDE_PHOTO_URL = 'https://bioguide.congress.gov/bioguide/photo';

interface Legislator {
  id: {
    bioguide: string;
    thomas?: string;
    lis?: string;
    govtrack?: number;
    opensecrets?: string;
    votesmart?: number;
    fec?: string[];
    cspan?: number;
    wikipedia?: string;
    house_history?: number;
    ballotpedia?: string;
    maplight?: number;
    icpsr?: number;
    wikidata?: string;
    google_entity_id?: string;
  };
  name: {
    first: string;
    middle?: string;
    last: string;
    suffix?: string;
    nickname?: string;
    official_full?: string;
  };
  bio: {
    birthday?: string;
    gender?: string;
    religion?: string;
  };
  terms: Array<{
    type: 'sen' | 'rep';
    start: string;
    end: string;
    state: string;
    district?: number;
    class?: number;
    state_rank?: string;
    party: string;
    url?: string;
    address?: string;
    phone?: string;
    fax?: string;
    contact_form?: string;
    office?: string;
    rss_url?: string;
  }>;
}

interface SocialMedia {
  id: {
    bioguide: string;
    govtrack?: number;
    thomas?: string;
  };
  social: {
    twitter?: string;
    twitter_id?: number;
    facebook?: string;
    facebook_id?: string;
    youtube?: string;
    youtube_id?: string;
    instagram?: string;
    instagram_id?: string;
  };
}

interface Stats {
  totalFetched: number;
  membersInserted: number;
  membersUpdated: number;
  socialMediaMerged: number;
  photosFound: number;
  errors: number;
}

const stats: Stats = {
  totalFetched: 0,
  membersInserted: 0,
  membersUpdated: 0,
  socialMediaMerged: 0,
  photosFound: 0,
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
function escapeSQLString(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return 'NULL';
  if (typeof str === 'number') return String(str);
  return `'${String(str).replace(/'/g, "''")}'`;
}

/**
 * Check if member photo exists
 */
async function checkPhotoExists(bioguideId: string): Promise<string | null> {
  try {
    const photoUrl = `${BIOGUIDE_PHOTO_URL}/${bioguideId[0].toUpperCase()}/${bioguideId}.jpg`;
    const response = await fetch(photoUrl, { method: 'HEAD' });
    if (response.ok) {
      stats.photosFound++;
      return photoUrl;
    }
  } catch {
    // Photo doesn't exist or network error
  }
  return null;
}

/**
 * Fetch JSON from URL
 */
async function fetchJSON<T>(url: string): Promise<T> {
  console.log(`📥 Fetching: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

/**
 * Extract year from date string
 */
function extractYear(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const year = parseInt(dateStr.split('-')[0], 10);
  return isNaN(year) ? null : year;
}

/**
 * Build UPSERT query for a member
 */
function buildMemberUpsert(
  legislator: Legislator,
  socialMedia: SocialMedia | undefined,
  photoUrl: string | null
): string {
  const bioguideId = legislator.id.bioguide;
  const name = legislator.name;
  const bio = legislator.bio;
  const currentTerm = legislator.terms[legislator.terms.length - 1]; // Most recent term
  const social = socialMedia?.social;

  // Build FEC IDs as comma-separated string
  const fecIds = legislator.id.fec?.join(',') || null;

  return `
    INSERT INTO members (
      bioguide_id, first_name, middle_name, last_name, party, state, district,
      url, birth_year, current_member, image_url, office_address, phone_number,
      official_full_name, gender, birth_date, nickname, suffix,
      thomas_id, lis_id, govtrack_id, opensecrets_id, votesmart_id, fec_ids,
      cspan_id, wikipedia_id, house_history_id, ballotpedia_id, maplight_id,
      icpsr_id, wikidata_id, google_entity_id,
      twitter_handle, facebook_url, youtube_url, instagram_handle,
      website_url, contact_form_url, rss_url,
      current_term_start, current_term_end, current_term_type,
      current_term_state, current_term_district, current_term_class, current_term_state_rank
    ) VALUES (
      ${escapeSQLString(bioguideId)},
      ${escapeSQLString(name.first)},
      ${escapeSQLString(name.middle)},
      ${escapeSQLString(name.last)},
      ${escapeSQLString(currentTerm.party)},
      ${escapeSQLString(currentTerm.state)},
      ${currentTerm.district !== undefined ? currentTerm.district : 'NULL'},
      ${escapeSQLString(currentTerm.url)},
      ${extractYear(bio.birthday) || 'NULL'},
      1,
      ${escapeSQLString(photoUrl)},
      ${escapeSQLString(currentTerm.address || currentTerm.office)},
      ${escapeSQLString(currentTerm.phone)},
      ${escapeSQLString(name.official_full)},
      ${escapeSQLString(bio.gender)},
      ${escapeSQLString(bio.birthday)},
      ${escapeSQLString(name.nickname)},
      ${escapeSQLString(name.suffix)},
      ${escapeSQLString(legislator.id.thomas)},
      ${escapeSQLString(legislator.id.lis)},
      ${legislator.id.govtrack || 'NULL'},
      ${escapeSQLString(legislator.id.opensecrets)},
      ${legislator.id.votesmart || 'NULL'},
      ${escapeSQLString(fecIds)},
      ${legislator.id.cspan || 'NULL'},
      ${escapeSQLString(legislator.id.wikipedia)},
      ${legislator.id.house_history || 'NULL'},
      ${escapeSQLString(legislator.id.ballotpedia)},
      ${legislator.id.maplight || 'NULL'},
      ${legislator.id.icpsr || 'NULL'},
      ${escapeSQLString(legislator.id.wikidata)},
      ${escapeSQLString(legislator.id.google_entity_id)},
      ${escapeSQLString(social?.twitter)},
      ${social?.facebook ? escapeSQLString(`https://facebook.com/${social.facebook}`) : 'NULL'},
      ${social?.youtube ? escapeSQLString(`https://youtube.com/${social.youtube}`) : 'NULL'},
      ${escapeSQLString(social?.instagram)},
      ${escapeSQLString(currentTerm.url)},
      ${escapeSQLString(currentTerm.contact_form)},
      ${escapeSQLString(currentTerm.rss_url)},
      ${escapeSQLString(currentTerm.start)},
      ${escapeSQLString(currentTerm.end)},
      ${escapeSQLString(currentTerm.type)},
      ${escapeSQLString(currentTerm.state)},
      ${currentTerm.district !== undefined ? currentTerm.district : 'NULL'},
      ${currentTerm.class || 'NULL'},
      ${escapeSQLString(currentTerm.state_rank)}
    )
    ON CONFLICT(bioguide_id) DO UPDATE SET
      first_name = excluded.first_name,
      middle_name = excluded.middle_name,
      last_name = excluded.last_name,
      party = excluded.party,
      state = excluded.state,
      district = excluded.district,
      url = excluded.url,
      birth_year = excluded.birth_year,
      current_member = 1,
      image_url = COALESCE(excluded.image_url, members.image_url),
      office_address = COALESCE(excluded.office_address, members.office_address),
      phone_number = COALESCE(excluded.phone_number, members.phone_number),
      official_full_name = excluded.official_full_name,
      gender = excluded.gender,
      birth_date = excluded.birth_date,
      nickname = excluded.nickname,
      suffix = excluded.suffix,
      thomas_id = excluded.thomas_id,
      lis_id = excluded.lis_id,
      govtrack_id = excluded.govtrack_id,
      opensecrets_id = excluded.opensecrets_id,
      votesmart_id = excluded.votesmart_id,
      fec_ids = excluded.fec_ids,
      cspan_id = excluded.cspan_id,
      wikipedia_id = excluded.wikipedia_id,
      house_history_id = excluded.house_history_id,
      ballotpedia_id = excluded.ballotpedia_id,
      maplight_id = excluded.maplight_id,
      icpsr_id = excluded.icpsr_id,
      wikidata_id = excluded.wikidata_id,
      google_entity_id = excluded.google_entity_id,
      twitter_handle = COALESCE(excluded.twitter_handle, members.twitter_handle),
      facebook_url = COALESCE(excluded.facebook_url, members.facebook_url),
      youtube_url = COALESCE(excluded.youtube_url, members.youtube_url),
      instagram_handle = COALESCE(excluded.instagram_handle, members.instagram_handle),
      website_url = COALESCE(excluded.website_url, members.website_url),
      contact_form_url = COALESCE(excluded.contact_form_url, members.contact_form_url),
      rss_url = COALESCE(excluded.rss_url, members.rss_url),
      current_term_start = excluded.current_term_start,
      current_term_end = excluded.current_term_end,
      current_term_type = excluded.current_term_type,
      current_term_state = excluded.current_term_state,
      current_term_district = excluded.current_term_district,
      current_term_class = excluded.current_term_class,
      current_term_state_rank = excluded.current_term_state_rank
  `;
}

/**
 * Main ingestion function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🏛️  COMPREHENSIVE CONGRESS MEMBER INGESTION');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`📡 Admin Dashboard: ${ADMIN_DASHBOARD_URL}\n`);

  // Test database connection
  try {
    const testResult = await executeSQL('SELECT COUNT(*) as count FROM members');
    console.log(`✅ Database connected. Current member count: ${testResult.results?.[0]?.count || 0}\n`);
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    process.exit(1);
  }

  // Fetch data from unitedstates.io
  console.log('\n📊 STEP 1: Fetching legislator data...\n');

  const legislators = await fetchJSON<Legislator[]>(LEGISLATORS_CURRENT_URL);
  stats.totalFetched = legislators.length;
  console.log(`   Found ${legislators.length} current legislators\n`);

  const socialMediaList = await fetchJSON<SocialMedia[]>(LEGISLATORS_SOCIAL_MEDIA_URL);
  console.log(`   Found ${socialMediaList.length} social media records\n`);

  // Build social media lookup by bioguide ID
  const socialMediaMap = new Map<string, SocialMedia>();
  for (const sm of socialMediaList) {
    socialMediaMap.set(sm.id.bioguide, sm);
    if (sm.social?.twitter || sm.social?.facebook) {
      stats.socialMediaMerged++;
    }
  }

  // Process each legislator
  console.log('\n📊 STEP 2: Processing legislators...\n');

  let batchCount = 0;
  const batchSize = 10;

  for (let i = 0; i < legislators.length; i++) {
    const legislator = legislators[i];
    const bioguideId = legislator.id.bioguide;

    try {
      // Get social media data
      const socialMedia = socialMediaMap.get(bioguideId);

      // Check for photo (with rate limiting)
      let photoUrl: string | null = null;
      if (i % 5 === 0) { // Check every 5th member to avoid rate limiting
        photoUrl = await checkPhotoExists(bioguideId);
      }

      // Build and execute UPSERT
      const query = buildMemberUpsert(legislator, socialMedia, photoUrl);
      await executeSQL(query);

      stats.membersUpdated++;

      // Progress indicator
      if ((i + 1) % 25 === 0) {
        console.log(`   [${i + 1}/${legislators.length}] ${legislator.name.first} ${legislator.name.last} (${legislator.terms[legislator.terms.length - 1].state})`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));

    } catch (error) {
      console.error(`   ❌ Error processing ${bioguideId}:`, error);
      stats.errors++;
    }
  }

  // Mark non-current members
  console.log('\n📊 STEP 3: Marking former members...\n');

  const currentBioguides = legislators.map(l => `'${l.id.bioguide}'`).join(',');
  await executeSQL(`
    UPDATE members
    SET current_member = 0
    WHERE bioguide_id NOT IN (${currentBioguides})
  `);

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅ INGESTION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 Statistics:');
  console.log(`   Total legislators fetched: ${stats.totalFetched}`);
  console.log(`   Members upserted: ${stats.membersUpdated}`);
  console.log(`   Social media records: ${stats.socialMediaMerged}`);
  console.log(`   Photos found: ${stats.photosFound}`);
  console.log(`   Errors: ${stats.errors}`);

  // Get final counts
  const finalCount = await executeSQL('SELECT COUNT(*) as total, SUM(current_member) as current FROM members');
  console.log(`\n📊 Database Status:`);
  console.log(`   Total members: ${finalCount.results?.[0]?.total}`);
  console.log(`   Current members: ${finalCount.results?.[0]?.current}`);

  console.log(`\n🔍 View data at: ${ADMIN_DASHBOARD_URL}`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
