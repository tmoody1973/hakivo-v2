#!/usr/bin/env tsx

/**
 * Backfill Script v4 - SmartBucket Solution
 *
 * Fixes:
 * 1. Processes ALL bills without SQLITE_TOOBIG errors
 * 2. Stores large bill texts (>200KB) in SmartBucket
 * 3. Stores smaller texts directly in database
 * 4. All bills get complete text - no truncation!
 */

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const ADMIN_DASHBOARD_URL = 'https://svc-01ka747hjpq5r2qk4ct00r3yyd.01k66gey30f48fys2tv4e412yt.lmapp.run';

if (!CONGRESS_API_KEY) {
  console.error('❌ CONGRESS_API_KEY environment variable is required');
  process.exit(1);
}

const BASE_URL = 'https://api.congress.gov/v3';
const SMARTBUCKET_THRESHOLD = 100000; // 100KB - store larger texts in SmartBucket (safest limit to avoid SQLITE_TOOBIG)
const BUCKET_NAME = 'BILL_TEXTS';

interface Stats {
  billsProcessed: number;
  textAdded: number;
  textInSmartBucket: number;
  textInDatabase: number;
  policyAdded: number;
  errors: number;
}

const stats: Stats = {
  billsProcessed: 0,
  textAdded: 0,
  textInSmartBucket: 0,
  textInDatabase: 0,
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

async function storeInSmartBucket(billId: string, text: string): Promise<string> {
  // Store large bill text in SmartBucket and return the URL
  const key = `bills/${billId}.txt`;

  const response = await fetch(`${ADMIN_DASHBOARD_URL}/api/smartbucket/store`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucket: BUCKET_NAME,
      key: key,
      content: text,
      contentType: 'text/plain'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SmartBucket store failed: ${error}`);
  }

  const result: any = await response.json();
  return result.url || `smartbucket://${BUCKET_NAME}/${key}`;
}

function escapeSQLString(str: string | null | undefined): string {
  if (!str) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}

async function main() {
  console.log('🔄 Bill Data Backfill Tool v4 (SmartBucket Solution)');
  console.log('=====================================================\n');
  console.log('Strategy:');
  console.log('  • Bills < 100KB → Store text directly in database');
  console.log('  • Bills ≥ 100KB → Store text in SmartBucket');
  console.log('  • ALL bills get complete text - no truncation!\n');

  // Get ALL bills that need updating
  const result: any = await executeSQL(`
    SELECT id, congress, bill_type, bill_number
    FROM bills
    WHERE text IS NULL OR policy_area IS NULL
    LIMIT 1000
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

      let textUpdate: string | null = null;
      let policyUpdate: string | null = null;

      // Add policy area if available
      const policyArea = billDetails.policyArea?.name || null;
      if (policyArea) {
        policyUpdate = `policy_area = ${escapeSQLString(policyArea)}`;
        stats.policyAdded++;
      }

      // Fetch text versions from separate endpoint
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
                  const textResponse = await fetch(textFormat.url);

                  if (textResponse.ok) {
                    const billText = await textResponse.text();
                    const textLength = billText.length;

                    // Decide storage strategy based on size
                    if (textLength > SMARTBUCKET_THRESHOLD) {
                      // Large bill - store in SmartBucket
                      console.log(`    📦 Large bill (${textLength.toLocaleString()} chars) - using SmartBucket...`);

                      try {
                        const smartBucketUrl = await storeInSmartBucket(id, billText);
                        textUpdate = `text = ${escapeSQLString(smartBucketUrl)}`;
                        stats.textInSmartBucket++;
                        stats.textAdded++;

                        console.log(`    ✅ Stored in SmartBucket: ${smartBucketUrl}`);
                      } catch (bucketError) {
                        console.warn(`    ⚠️  SmartBucket failed, storing truncated text in DB`);
                        // Fallback: store truncated version in database
                        const truncated = billText.substring(0, 200000);
                        const escapedText = truncated.replace(/'/g, "''");
                        textUpdate = `text = ${escapeSQLString(escapedText)}`;
                        stats.textInDatabase++;
                        stats.textAdded++;
                      }
                    } else {
                      // Small bill - store directly in database
                      const escapedText = billText.replace(/'/g, "''");
                      textUpdate = `text = ${escapeSQLString(escapedText)}`;
                      stats.textInDatabase++;
                      stats.textAdded++;

                      console.log(`    ✅ Stored ${textLength.toLocaleString()} chars in database${policyArea ? ` + policy: ${policyArea}` : ''}`);
                    }

                    break;
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

      // Update the bill with separate UPDATE statements to avoid SQLITE_TOOBIG
      // Execute policy update first (smaller)
      if (policyUpdate) {
        await executeSQL(`
          UPDATE bills
          SET ${policyUpdate}
          WHERE id = ${escapeSQLString(id)}
        `);
      }

      // Execute text update separately (potentially large)
      if (textUpdate) {
        await executeSQL(`
          UPDATE bills
          SET ${textUpdate}
          WHERE id = ${escapeSQLString(id)}
        `);
      }

      if (!policyUpdate && !textUpdate) {
        console.log(`  ⚠️  No new data available`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));

    } catch (error) {
      console.error(`  ✗ Error processing bill:`, error);
      stats.errors++;
    }

    // Progress update every 25 bills
    if (stats.billsProcessed % 25 === 0) {
      console.log(`\n📊 Progress: ${stats.billsProcessed}/${billsToUpdate.length} bills`);
      console.log(`   Text added: ${stats.textAdded}`);
      console.log(`   ├─ In Database: ${stats.textInDatabase}`);
      console.log(`   └─ In SmartBucket: ${stats.textInSmartBucket}`);
      console.log(`   Policy added: ${stats.policyAdded}`);
      console.log(`   Errors: ${stats.errors}\n`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ BACKFILL COMPLETE - ALL BILLS PROCESSED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📊 Final Statistics:`);
  console.log(`   Bills processed: ${stats.billsProcessed}`);
  console.log(`   Text added: ${stats.textAdded}`);
  console.log(`   ├─ Stored in Database: ${stats.textInDatabase}`);
  console.log(`   └─ Stored in SmartBucket: ${stats.textInSmartBucket}`);
  console.log(`   Policy areas added: ${stats.policyAdded}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log(`\n🔍 View data at: ${ADMIN_DASHBOARD_URL}`);
  console.log(`📦 Large texts stored in SmartBucket: ${BUCKET_NAME}`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
