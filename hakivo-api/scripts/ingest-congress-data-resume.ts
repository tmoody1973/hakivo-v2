#!/usr/bin/env tsx

/**
 * Congress Data Ingestion RESUME Script
 *
 * Continues ingestion from where ingest-congress-data-v2.ts left off:
 * - Resume 118th Congress bills from offset 15000
 * - Ingest ALL 119th Congress bills
 */

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const ADMIN_DASHBOARD_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

if (!CONGRESS_API_KEY) {
  console.error('❌ CONGRESS_API_KEY environment variable is required');
  process.exit(1);
}

const BASE_URL = 'https://api.congress.gov/v3';

interface Stats {
  bills: number;
  billsWithText: number;
  billsWithPolicyArea: number;
  startTime: number;
}

const stats: Stats = {
  bills: 0,
  billsWithText: 0,
  billsWithPolicyArea: 0,
  startTime: Date.now()
};

async function fetchCongressAPI(endpoint: string): Promise<any> {
  const url = `${BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${CONGRESS_API_KEY}&format=json`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Congress API error: ${response.status} ${await response.text()}`);
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

/**
 * Ingest bills for a specific congress - RESUME VERSION
 */
async function ingestBills(congress: number, startOffset: number = 0): Promise<void> {
  console.log(`\n📄 Fetching bills for ${congress}th Congress (starting from offset ${startOffset})...`);

  let offset = startOffset;
  const limit = 250;
  let hasMore = true;

  while (hasMore) {
    try {
      const data = await fetchCongressAPI(`/bill/${congress}?offset=${offset}&limit=${limit}`);
      const bills = data.bills || [];

      if (bills.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`  Fetching bills ${offset + 1}-${offset + bills.length}...`);

      for (const bill of bills) {
        try {
          // Fetch full bill details
          const billType = bill.type.toLowerCase();
          const billNumber = bill.number;
          const detailsData = await fetchCongressAPI(`/bill/${congress}/${billType}/${billNumber}`);
          const billDetails = detailsData.bill;

          // Extract policy area
          const policyArea = billDetails.policyArea?.name || null;
          if (policyArea) {
            stats.billsWithPolicyArea++;
          }

          // Insert bill into database
          const billId = `${congress}-${billType}-${billNumber}`;
          const query = `
            INSERT OR REPLACE INTO bills (
              id, congress, bill_type, bill_number, title,
              origin_chamber, introduced_date, latest_action_date,
              latest_action_text, sponsor_bioguide_id, update_date, policy_area
            ) VALUES (
              ${escapeSQLString(billId)},
              ${congress},
              ${escapeSQLString(billType)},
              ${billNumber},
              ${escapeSQLString(billDetails.title)},
              ${escapeSQLString(billDetails.originChamber)},
              ${escapeSQLString(billDetails.introducedDate)},
              ${escapeSQLString(billDetails.latestAction?.actionDate)},
              ${escapeSQLString(billDetails.latestAction?.text)},
              ${escapeSQLString(billDetails.sponsors?.[0]?.bioguideId)},
              ${escapeSQLString(billDetails.updateDate)},
              ${escapeSQLString(policyArea)}
            )
          `;

          await executeSQL(query);
          stats.bills++;

          // Fetch and store FULL bill text if available
          if (billDetails.textVersions?.url) {
            try {
              const textVersionsData = await fetchCongressAPI(`/bill/${congress}/${billType}/${billNumber}/text`);
              const textVersions = textVersionsData.textVersions || [];

              // Try to get the most recent version's text
              for (const version of textVersions) {
                if (version.formats) {
                  const textFormat = version.formats.find((f: any) => f.type === 'Formatted Text');

                  if (textFormat?.url) {
                    try {
                      const textResponse = await fetch(textFormat.url);

                      if (textResponse.ok) {
                        const billText = await textResponse.text();
                        const escapedText = billText.replace(/'/g, "''");

                        await executeSQL(`
                          UPDATE bills
                          SET text = ${escapeSQLString(escapedText)}
                          WHERE id = ${escapeSQLString(billId)}
                        `);

                        stats.billsWithText++;
                        break;
                      }
                    } catch (error) {
                      // Silent fail for text fetch
                    }
                  }
                }
              }
            } catch (error) {
              // Silent fail for text versions
            }
          }

          if (stats.bills % 50 === 0) {
            console.log(`    ✓ Inserted ${stats.bills} bills (${stats.billsWithText} with text, ${stats.billsWithPolicyArea} with policy)`);
          }

          // Rate limiting - slightly longer delay to avoid errors
          await new Promise(resolve => setTimeout(resolve, 150));

        } catch (error) {
          console.error(`    ✗ Failed to insert bill ${bill.type}${bill.number}:`, (error as Error).message);
        }
      }

      offset += limit;

      // Check if there are more results
      if (bills.length < limit) {
        hasMore = false;
      }

    } catch (error) {
      console.error(`  ✗ Failed to fetch bills batch at offset ${offset}:`, (error as Error).message);
      console.log(`  ⏸️  Waiting 5 seconds before retrying...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log(`  ✅ Completed: ${stats.bills} bills inserted (${stats.billsWithText} with text, ${stats.billsWithPolicyArea} with policy)`);
}

async function main() {
  console.log('🔄 Congress Data Ingestion RESUME Tool');
  console.log('======================================\n');
  console.log('Resuming ingestion from offset 15,000...\n');

  // Resume 118th Congress from offset 15000
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  118TH CONGRESS (RESUME)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  await ingestBills(118, 15000);

  // Reset stats for 119th Congress
  stats.bills = 0;
  stats.billsWithText = 0;
  stats.billsWithPolicyArea = 0;

  // Ingest ALL 119th Congress bills
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  119TH CONGRESS (FULL)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  await ingestBills(119, 0);

  const elapsed = ((Date.now() - stats.startTime) / 1000 / 60).toFixed(2);

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ RESUME INGESTION COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n⏱️  Time elapsed: ${elapsed} minutes`);
  console.log(`\n🔍 View complete data at: ${ADMIN_DASHBOARD_URL}`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
