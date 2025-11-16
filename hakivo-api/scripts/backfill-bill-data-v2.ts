#!/usr/bin/env tsx

/**
 * Backfill Script v2 - FIXED TEXT FETCHING
 *
 * The API returns textVersions as {url: "..."} not as an array!
 * We need to fetch the text versions from the separate endpoint first.
 */

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const ADMIN_DASHBOARD_URL = 'https://svc-01ka747hjpq5r2qk4ct00r3yyd.01k66gey30f48fys2tv4e412yt.lmapp.run';

if (!CONGRESS_API_KEY) {
  console.error('❌ CONGRESS_API_KEY environment variable is required');
  process.exit(1);
}

const BASE_URL = 'https://api.congress.gov/v3';

interface Stats {
  billsProcessed: number;
  textAdded: number;
  policyAdded: number;
  errors: number;
}

const stats: Stats = {
  billsProcessed: 0,
  textAdded: 0,
  policyAdded: 0,
  errors: 0
};

async function fetchCongressAPI(endpoint: string): Promise<any> {
  const url = `${BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${CONGRESS_API_KEY}&format=json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Congress API error: ${response.status}`);
  }
  return response.json();
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

function escapeSQLString(str: string | null | undefined): string {
  if (!str) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}

async function main() {
  console.log('🔄 Bill Data Backfill Tool v2 (FIXED)');
  console.log('=======================================\n');
  console.log('This script properly fetches bill text from separate API endpoint...\n');

  // Get all bills that need updating
  const result = await executeSQL(`
    SELECT id, congress, bill_type, bill_number
    FROM bills
    WHERE text IS NULL OR policy_area IS NULL
    ORDER BY congress DESC, bill_type, bill_number
  `);

  const billsToUpdate = result.results || [];
  console.log(`Found ${billsToUpdate.length} bills needing updates\n`);

  if (billsToUpdate.length === 0) {
    console.log('✅ All bills already have full data!');
    return;
  }

  for (const bill of billsToUpdate) {
    try {
      stats.billsProcessed++;

      const { congress, bill_type, bill_number, id } = bill;

      console.log(`[${stats.billsProcessed}/${billsToUpdate.length}] Processing ${id}...`);

      // Fetch full bill details for policy area
      const detailsData = await fetchCongressAPI(`/bill/${congress}/${bill_type}/${bill_number}`);
      const billDetails = detailsData.bill;

      let updates: string[] = [];

      // Add policy area if available
      const policyArea = billDetails.policyArea?.name || null;
      if (policyArea) {
        updates.push(`policy_area = ${escapeSQLString(policyArea)}`);
        stats.policyAdded++;
      }

      // FIXED: Fetch text versions from separate endpoint!
      if (billDetails.textVersions?.url) {
        try {
          const textVersionsData = await fetchCongressAPI(`/bill/${congress}/${bill_type}/${bill_number}/text`);
          const textVersions = textVersionsData.textVersions || [];

          // Try to get the most recent text version
          for (const version of textVersions) {
            if (version.formats) {
              const textFormat = version.formats.find((f: any) => f.type === 'Formatted Text');

              if (textFormat?.url) {
                try {
                  console.log(`    📝 Fetching text from ${textFormat.url}...`);
                  const textResponse = await fetch(textFormat.url);

                  if (textResponse.ok) {
                    const billText = await textResponse.text();
                    const escapedText = billText.replace(/'/g, "''");

                    updates.push(`text = ${escapeSQLString(escapedText)}`);
                    stats.textAdded++;

                    console.log(`    ✅ Added ${billText.length} chars of text${policyArea ? ` + policy: ${policyArea}` : ''}`);
                    break; // Got the text, stop trying other versions
                  }
                } catch (error) {
                  console.warn(`    ⚠️  Could not fetch text from URL`);
                }
              }
            }
          }
        } catch (error) {
          console.warn(`    ⚠️  No text versions available`);
        }
      }

      // Update the bill if we have any updates
      if (updates.length > 0) {
        await executeSQL(`
          UPDATE bills
          SET ${updates.join(', ')}
          WHERE id = ${escapeSQLString(id)}
        `);
      } else {
        console.log(`  ⚠️  No new data available`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));

    } catch (error) {
      console.error(`  ✗ Error processing bill:`, error);
      stats.errors++;
    }

    // Progress update every 10 bills
    if (stats.billsProcessed % 10 === 0) {
      console.log(`\n📊 Progress: ${stats.billsProcessed}/${billsToUpdate.length} bills`);
      console.log(`   Text added: ${stats.textAdded}`);
      console.log(`   Policy added: ${stats.policyAdded}`);
      console.log(`   Errors: ${stats.errors}\n`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ BACKFILL COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📊 Final Statistics:`);
  console.log(`   Bills processed: ${stats.billsProcessed}`);
  console.log(`   Text added: ${stats.textAdded}`);
  console.log(`   Policy areas added: ${stats.policyAdded}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log(`\n🔍 View data at: ${ADMIN_DASHBOARD_URL}`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
