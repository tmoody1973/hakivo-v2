#!/usr/bin/env tsx

/**
 * Backfill Oversized Bills Script
 *
 * Re-ingests bills that failed due to SQLITE_TOOBIG errors by using
 * much smaller text chunks. This script:
 *
 * 1. Queries for bills that have NULL text (likely failed during insert)
 * 2. Re-fetches bill details and text with aggressive truncation
 * 3. Inserts with much smaller text limit (100KB instead of 500KB)
 *
 * Usage:
 *   npx tsx scripts/backfill-oversized-bills.ts
 *   npx tsx scripts/backfill-oversized-bills.ts --bill-ids 119-hr-5300,119-hr-4321
 *   npx tsx scripts/backfill-oversized-bills.ts --no-text   # Insert without text at all
 */

// Configuration
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const CONGRESS = 119;
const BASE_URL = 'https://api.congress.gov/v3';
const ADMIN_DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyzp.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

// Much more aggressive text limit for oversized bills
// D1 max statement size is ~1MB, so 100KB text + overhead should be safe
const MAX_TEXT_LENGTH = 100000; // 100KB for oversized bills
const API_DELAY_MS = 750;

// Parse CLI args
const args = process.argv.slice(2);
const BILL_IDS_ARG = args.indexOf('--bill-ids');
const SPECIFIC_BILL_IDS = BILL_IDS_ARG !== -1 ? args[BILL_IDS_ARG + 1]?.split(',') : null;
const NO_TEXT = args.includes('--no-text');

// Stats
let stats = {
  billsFound: 0,
  billsFixed: 0,
  billsStillFailed: 0,
  errors: [] as string[]
};

if (!CONGRESS_API_KEY) {
  console.error('❌ CONGRESS_API_KEY environment variable is required');
  process.exit(1);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchCongressAPI(endpoint: string, retries = 3): Promise<any> {
  const url = `${BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${CONGRESS_API_KEY}&format=json`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        console.warn(`⚠️  Rate limited, waiting 60s`);
        await sleep(60000);
        continue;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      await sleep(API_DELAY_MS);
      return await response.json();
    } catch (error) {
      if (attempt === retries) throw error;
      await sleep(2000 * attempt);
    }
  }
}

async function executeSQL(query: string): Promise<any> {
  const response = await fetch(`${ADMIN_DASHBOARD_URL}/api/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SQL failed: ${error}`);
  }
  return response.json();
}

function escapeSql(value: string | null | undefined, maxLength?: number): string {
  if (value === null || value === undefined) return 'NULL';
  let str = value;
  if (maxLength && str.length > maxLength) {
    str = str.substring(0, maxLength) + '\n\n[TRUNCATED - Bill text exceeds storage limit. Full text available at congress.gov]';
  }
  const escaped = str.replace(/'/g, "''").replace(/\\/g, '\\\\');
  return `'${escaped}'`;
}

function cleanHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

async function fetchBillText(congress: number, type: string, number: number): Promise<string | null> {
  if (NO_TEXT) return null;

  try {
    const textData = await fetchCongressAPI(`/bill/${congress}/${type}/${number}/text`);
    const versions = textData.textVersions || [];
    if (versions.length === 0) return null;

    const latest = versions[0];
    if (!latest.formats) return null;

    const textFormat = latest.formats.find((f: any) =>
      f.type?.toLowerCase().includes('formatted') || f.url?.includes('.htm')
    ) || latest.formats.find((f: any) => f.url);

    if (!textFormat?.url) return null;

    const textResponse = await fetch(textFormat.url);
    if (!textResponse.ok) return null;

    let text = await textResponse.text();
    if (textFormat.url.includes('.htm')) {
      text = cleanHtml(text);
    }

    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

async function findFailedBills(): Promise<string[]> {
  // If specific bill IDs provided, use those
  if (SPECIFIC_BILL_IDS && SPECIFIC_BILL_IDS.length > 0) {
    return SPECIFIC_BILL_IDS;
  }

  // Otherwise, find bills without text that we likely failed to insert
  // These are bills where the insert failed mid-way
  console.log('   Querying for bills that might have failed...');

  // First, let's check what bills exist with NULL text
  const result = await executeSQL(`
    SELECT id FROM bills
    WHERE congress = ${CONGRESS}
    AND text IS NULL
    ORDER BY id
  `);

  if (result.success && result.results) {
    return result.results.map((r: any) => r.id);
  }

  return [];
}

async function fixBill(billId: string): Promise<boolean> {
  // Parse bill ID: "119-hr-5300" -> congress=119, type=hr, number=5300
  const parts = billId.split('-');
  if (parts.length !== 3) {
    console.error(`   Invalid bill ID format: ${billId}`);
    return false;
  }

  const congress = parseInt(parts[0]);
  const type = parts[1];
  const number = parseInt(parts[2]);

  try {
    console.log(`   Processing ${billId}...`);

    // Fetch bill details
    const detailsData = await fetchCongressAPI(`/bill/${congress}/${type}/${number}`);
    const bill = detailsData.bill;

    // Fetch text with aggressive truncation
    let text = await fetchBillText(congress, type, number);

    // If text is still too large, try even more aggressive truncation
    if (text && text.length > MAX_TEXT_LENGTH) {
      console.log(`   📝 Text is ${(text.length / 1024).toFixed(0)}KB, truncating to ${MAX_TEXT_LENGTH / 1024}KB`);
    }

    // Build and execute the insert
    const query = `
      INSERT OR REPLACE INTO bills (
        id, congress, bill_type, bill_number, title,
        origin_chamber, introduced_date, latest_action_date,
        latest_action_text, sponsor_bioguide_id, text, update_date, policy_area
      ) VALUES (
        ${escapeSql(billId)},
        ${congress},
        ${escapeSql(type)},
        ${number},
        ${escapeSql(bill.title)},
        ${escapeSql(bill.originChamber)},
        ${escapeSql(bill.introducedDate)},
        ${escapeSql(bill.latestAction?.actionDate)},
        ${escapeSql(bill.latestAction?.text)},
        ${escapeSql(bill.sponsors?.[0]?.bioguideId)},
        ${escapeSql(text, MAX_TEXT_LENGTH)},
        ${escapeSql(bill.updateDate)},
        ${escapeSql(bill.policyArea?.name)}
      )
    `;

    await executeSQL(query);
    console.log(`   ✅ Fixed ${billId}${text ? ` (${(Math.min(text.length, MAX_TEXT_LENGTH) / 1024).toFixed(0)}KB text)` : ' (no text)'}`);
    return true;

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';

    // If still too big, try without text
    if (msg.includes('SQLITE_TOOBIG') && !NO_TEXT) {
      console.log(`   ⚠️  Still too big, retrying ${billId} without text...`);

      try {
        const detailsData = await fetchCongressAPI(`/bill/${congress}/${type}/${number}`);
        const bill = detailsData.bill;

        const query = `
          INSERT OR REPLACE INTO bills (
            id, congress, bill_type, bill_number, title,
            origin_chamber, introduced_date, latest_action_date,
            latest_action_text, sponsor_bioguide_id, text, update_date, policy_area
          ) VALUES (
            ${escapeSql(billId)},
            ${congress},
            ${escapeSql(type)},
            ${number},
            ${escapeSql(bill.title)},
            ${escapeSql(bill.originChamber)},
            ${escapeSql(bill.introducedDate)},
            ${escapeSql(bill.latestAction?.actionDate)},
            ${escapeSql(bill.latestAction?.text)},
            ${escapeSql(bill.sponsors?.[0]?.bioguideId)},
            NULL,
            ${escapeSql(bill.updateDate)},
            ${escapeSql(bill.policyArea?.name)}
          )
        `;

        await executeSQL(query);
        console.log(`   ✅ Fixed ${billId} (metadata only - text too large)`);
        return true;
      } catch (retryError) {
        stats.errors.push(`${billId}: ${retryError instanceof Error ? retryError.message : 'Retry failed'}`);
        return false;
      }
    }

    stats.errors.push(`${billId}: ${msg}`);
    console.error(`   ❌ Failed ${billId}: ${msg}`);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🔧 BACKFILL OVERSIZED BILLS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n⚙️  Configuration:`);
  console.log(`   Max text length: ${MAX_TEXT_LENGTH / 1024}KB`);
  console.log(`   No text mode: ${NO_TEXT}`);
  console.log(`   Specific bills: ${SPECIFIC_BILL_IDS ? SPECIFIC_BILL_IDS.join(', ') : 'Auto-detect'}`);

  console.log('\n📋 Finding failed bills...\n');
  const failedBills = await findFailedBills();
  stats.billsFound = failedBills.length;

  if (failedBills.length === 0) {
    console.log('   ✨ No failed bills found!');
    return;
  }

  console.log(`   Found ${failedBills.length} bills to fix\n`);
  console.log('🔧 Fixing bills...\n');

  for (const billId of failedBills) {
    const success = await fixBill(billId);
    if (success) {
      stats.billsFixed++;
    } else {
      stats.billsStillFailed++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅ BACKFILL COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Results:`);
  console.log(`   Bills found:    ${stats.billsFound}`);
  console.log(`   Bills fixed:    ${stats.billsFixed}`);
  console.log(`   Still failed:   ${stats.billsStillFailed}`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors:`);
    stats.errors.forEach(e => console.log(`   • ${e}`));
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
