#!/usr/bin/env tsx

/**
 * Co-Sponsors Ingestion Script (By Member)
 *
 * Fetches co-sponsored legislation for each member.
 * MUCH faster than fetching per-bill since there are fewer members than bills.
 * Run with: npx tsx scripts/ingest-cosponsors-by-member.ts
 *
 * Prerequisites:
 * - Members must already exist in database (from previous ingestion)
 * - CONGRESS_API_KEY environment variable must be set
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local from hakivo-api directory
config({ path: resolve(__dirname, '../.env.local') });

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const ADMIN_DASHBOARD_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

console.log(`[DEBUG] API Key loaded: ${CONGRESS_API_KEY ? `${CONGRESS_API_KEY.substring(0, 10)}...` : 'NOT LOADED'}`);
console.log(`[DEBUG] API Key length: ${CONGRESS_API_KEY?.length || 0}`);

if (!CONGRESS_API_KEY) {
  console.error('❌ CONGRESS_API_KEY environment variable is required');
  console.error('Get your API key from: https://api.congress.gov/sign-up/');
  process.exit(1);
}

const BASE_URL = 'https://api.congress.gov/v3';

interface Stats {
  totalMembers: number;
  processedMembers: number;
  membersWithCosponsors: number;
  totalCosponsors: number;
  errors: number;
  startTime: number;
}

const stats: Stats = {
  totalMembers: 0,
  processedMembers: 0,
  membersWithCosponsors: 0,
  totalCosponsors: 0,
  errors: 0,
  startTime: Date.now()
};

/**
 * Fetch from Congress.gov API
 */
async function fetchCongressAPI(endpoint: string): Promise<any> {
  const url = `${BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${CONGRESS_API_KEY}&format=json`;
  console.log(`[DEBUG] Fetching: ${url.replace(CONGRESS_API_KEY || '', 'KEY_HIDDEN')}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Congress API error: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

/**
 * Execute SQL query against the database via db-admin service
 */
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

/**
 * Escape SQL strings
 */
function escapeSQLString(str: string | null | undefined): string {
  if (!str) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}

/**
 * Get all existing members from database
 */
async function getExistingMembers(): Promise<any[]> {
  console.log('📊 Fetching existing members from database...');

  const result = await executeSQL(`
    SELECT bioguide_id, first_name, last_name
    FROM members
    WHERE current_member = 1
    ORDER BY last_name, first_name
  `);

  const members = result.results || [];
  console.log(`✅ Found ${members.length} current members in database\n`);

  return members;
}

/**
 * Fetch and store co-sponsored legislation for a single member
 */
async function ingestCosponsorsForMember(member: any): Promise<void> {
  const bioguideId = member.bioguide_id;
  const memberName = `${member.first_name} ${member.last_name}`;

  try {
    // Fetch all co-sponsored legislation for this member
    let offset = 0;
    const limit = 250;
    let hasMore = true;
    let totalForMember = 0;

    while (hasMore) {
      const cosponsoredData = await fetchCongressAPI(
        `/member/${bioguideId}/cosponsored-legislation?offset=${offset}&limit=${limit}`
      );
      const cosponsoredBills = cosponsoredData.cosponsoredLegislation || [];

      if (cosponsoredBills.length === 0) {
        hasMore = false;
        break;
      }

      // Insert each co-sponsored bill
      for (const bill of cosponsoredBills) {
        try {
          // Build bill ID in our format: {congress}-{type}-{number}
          const congress = bill.congress;
          const billType = bill.type?.toLowerCase();
          const billNumber = bill.number;
          const billId = `${congress}-${billType}-${billNumber}`;

          // Get sponsorship date if available
          const sponsorshipDate = bill.latestAction?.actionDate || null;

          const cosponsorQuery = `
            INSERT OR REPLACE INTO bill_cosponsors (
              bill_id, member_bioguide_id, cosponsor_date
            ) VALUES (
              ${escapeSQLString(billId)},
              ${escapeSQLString(bioguideId)},
              ${escapeSQLString(sponsorshipDate)}
            )
          `;
          await executeSQL(cosponsorQuery);
          totalForMember++;
          stats.totalCosponsors++;
        } catch (error) {
          // Likely the bill doesn't exist in our database yet - skip silently
          // This is OK because we may only have 118th/119th Congress data
        }
      }

      offset += limit;

      // Check if there are more results
      if (cosponsoredBills.length < limit) {
        hasMore = false;
      }

      // Rate limiting between pagination requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (totalForMember > 0) {
      console.log(`  ✅ ${memberName} (${bioguideId}) - stored ${totalForMember} co-sponsorships`);
      stats.membersWithCosponsors++;
    } else {
      console.log(`  ℹ️  ${memberName} (${bioguideId}) - no co-sponsorships`);
    }

    stats.processedMembers++;

  } catch (error: any) {
    console.error(`  ❌ ${memberName} (${bioguideId}) - error: ${error.message}`);
    stats.errors++;
    stats.processedMembers++;
  }

  // Rate limiting between member requests
  await new Promise(resolve => setTimeout(resolve, 100));
}

/**
 * Main ingestion function
 */
async function main() {
  console.log('🗳️  Co-Sponsors Ingestion Script (By Member)');
  console.log('===========================================\n');
  console.log('📝 This script will:');
  console.log('  - Fetch all current members from database');
  console.log('  - For each member, fetch their co-sponsored legislation');
  console.log('  - Store co-sponsorships in bill_cosponsors table');
  console.log('  - Skip bills not in database (e.g., older congresses)\n');
  console.log(`📊 Monitor progress at: ${ADMIN_DASHBOARD_URL}\n`);
  console.log('Starting co-sponsor ingestion...\n');

  // Get all current members
  const members = await getExistingMembers();
  stats.totalMembers = members.length;

  if (members.length === 0) {
    console.log('❌ No members found in database. Please run the full ingestion first.');
    process.exit(1);
  }

  console.log(`🔄 Processing ${members.length} members...\n`);

  // Process each member
  for (let i = 0; i < members.length; i++) {
    const member = members[i];

    // Show progress every 25 members
    if (i > 0 && i % 25 === 0) {
      const progress = ((i / members.length) * 100).toFixed(1);
      const elapsed = ((Date.now() - stats.startTime) / 1000 / 60).toFixed(1);
      const rate = (stats.totalCosponsors / (i || 1)).toFixed(1);
      console.log(`\n📊 Progress: ${i}/${members.length} (${progress}%) | ${elapsed} min elapsed`);
      console.log(`   Total Cosponsors: ${stats.totalCosponsors} | Avg per member: ${rate} | Errors: ${stats.errors}\n`);
    }

    await ingestCosponsorsForMember(member);
  }

  // Print final stats
  const elapsed = ((Date.now() - stats.startTime) / 1000 / 60).toFixed(2);
  const avgPerMember = (stats.totalCosponsors / stats.processedMembers).toFixed(1);

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ CO-SPONSOR INGESTION COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📊 Statistics:`);
  console.log(`   Total Members:           ${stats.totalMembers.toLocaleString()}`);
  console.log(`   Processed:               ${stats.processedMembers.toLocaleString()}`);
  console.log(`   Members w/ Cosponsors:   ${stats.membersWithCosponsors.toLocaleString()}`);
  console.log(`   Total Cosponsors:        ${stats.totalCosponsors.toLocaleString()}`);
  console.log(`   Avg per Member:          ${avgPerMember}`);
  console.log(`   Errors:                  ${stats.errors.toLocaleString()}`);
  console.log(`\n⏱️  Time elapsed: ${elapsed} minutes`);
  console.log(`\n🔍 View data at: ${ADMIN_DASHBOARD_URL}`);
  console.log('\nExample SQL queries to verify:');
  console.log('  SELECT COUNT(*) FROM bill_cosponsors;');
  console.log('  SELECT COUNT(DISTINCT bill_id) FROM bill_cosponsors;');
  console.log('  SELECT COUNT(DISTINCT member_bioguide_id) FROM bill_cosponsors;');
  console.log('  ');
  console.log('  -- Top co-sponsors');
  console.log('  SELECT m.first_name, m.last_name, COUNT(*) as cosponsor_count');
  console.log('    FROM bill_cosponsors bc');
  console.log('    JOIN members m ON bc.member_bioguide_id = m.bioguide_id');
  console.log('    GROUP BY m.bioguide_id');
  console.log('    ORDER BY cosponsor_count DESC');
  console.log('    LIMIT 10;');
  console.log('  ');
  console.log('  -- Most co-sponsored bills');
  console.log('  SELECT b.title, COUNT(*) as cosponsor_count');
  console.log('    FROM bill_cosponsors bc');
  console.log('    JOIN bills b ON bc.bill_id = b.id');
  console.log('    GROUP BY b.id');
  console.log('    ORDER BY cosponsor_count DESC');
  console.log('    LIMIT 10;');
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
