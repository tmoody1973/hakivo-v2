#!/usr/bin/env tsx

/**
 * 119th Congress Bill Ingestion Script
 *
 * Comprehensive ingestion of ALL bills from the 119th Congress into Raindrop SQL.
 * Includes: metadata, full text, policy areas, cosponsors, actions, summaries.
 *
 * Usage:
 *   npx tsx scripts/ingest-119th-bills.ts
 *   npx tsx scripts/ingest-119th-bills.ts --resume       # Resume from last position
 *   npx tsx scripts/ingest-119th-bills.ts --skip-text    # Skip full text fetch (faster)
 *   npx tsx scripts/ingest-119th-bills.ts --limit 100    # Process only N bills
 *
 * Required env:
 *   CONGRESS_API_KEY - Get from https://api.congress.gov/sign-up/
 *
 * Data captured per bill:
 *   - Basic metadata (title, type, number, chamber, dates)
 *   - Sponsor bioguide ID
 *   - Policy area classification
 *   - Latest action text and date
 *   - Full bill text (if available) - cleaned HTML -> plain text
 *   - Update date for tracking changes
 *
 * Additional tables populated:
 *   - bill_cosponsors (member -> bill relationships)
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const CONGRESS = 119;
const BASE_URL = 'https://api.congress.gov/v3';

// Raindrop admin-dashboard service (has /api/database/query endpoint)
const ADMIN_DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyzp.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

// Processing settings
const BATCH_SIZE = 50;           // Bills to process per batch
const API_DELAY_MS = 750;        // 5000 req/hr = 1.4/sec max. 750ms = ~4800/hr (safe margin)
const PROGRESS_SAVE_INTERVAL = 25; // Save progress every N bills
const PROGRESS_FILE = path.join(__dirname, '.ingest-119th-progress.json');

// Bill types to fetch
const BILL_TYPES = ['hr', 's', 'hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres'];

// Parse CLI args
const args = process.argv.slice(2);
const RESUME_MODE = args.includes('--resume');
const SKIP_TEXT = args.includes('--skip-text');
const LIMIT_ARG = args.indexOf('--limit');
const BILL_LIMIT = LIMIT_ARG !== -1 ? parseInt(args[LIMIT_ARG + 1]) : Infinity;

// Stats
interface Stats {
  startTime: number;
  totalBillsFound: number;
  billsProcessed: number;
  billsInserted: number;
  billsWithText: number;
  billsWithPolicy: number;
  cosponsorsInserted: number;
  errors: string[];
  lastProcessedOffset: number;
}

let stats: Stats = {
  startTime: Date.now(),
  totalBillsFound: 0,
  billsProcessed: 0,
  billsInserted: 0,
  billsWithText: 0,
  billsWithPolicy: 0,
  cosponsorsInserted: 0,
  errors: [],
  lastProcessedOffset: 0
};

// Validation
if (!CONGRESS_API_KEY) {
  console.error('❌ CONGRESS_API_KEY environment variable is required');
  console.error('   Get your API key from: https://api.congress.gov/sign-up/');
  process.exit(1);
}

/**
 * Load progress from file (for resume mode)
 */
function loadProgress(): number {
  if (RESUME_MODE && fs.existsSync(PROGRESS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      console.log(`📂 Resuming from offset ${data.lastProcessedOffset} (${data.billsProcessed} bills done)`);
      stats = { ...stats, ...data, startTime: Date.now() };
      return data.lastProcessedOffset;
    } catch {
      console.log('⚠️  Could not load progress file, starting fresh');
    }
  }
  return 0;
}

/**
 * Save progress to file
 */
function saveProgress(): void {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
      lastProcessedOffset: stats.lastProcessedOffset,
      billsProcessed: stats.billsProcessed,
      billsInserted: stats.billsInserted,
      billsWithText: stats.billsWithText,
      billsWithPolicy: stats.billsWithPolicy,
      cosponsorsInserted: stats.cosponsorsInserted,
      timestamp: new Date().toISOString()
    }, null, 2));
  } catch (error) {
    console.error('⚠️  Could not save progress:', error);
  }
}

/**
 * Fetch from Congress.gov API with retry logic
 */
async function fetchCongressAPI(endpoint: string, retries = 3): Promise<any> {
  const url = `${BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${CONGRESS_API_KEY}&format=json`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        console.warn(`⚠️  Rate limited, waiting 60s (attempt ${attempt}/${retries})`);
        await sleep(60000);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      await sleep(API_DELAY_MS); // Rate limiting
      return await response.json();
    } catch (error) {
      if (attempt === retries) throw error;
      console.warn(`⚠️  Request failed, retrying (${attempt}/${retries})...`);
      await sleep(2000 * attempt);
    }
  }
}

/**
 * Execute SQL query via Raindrop admin-dashboard
 */
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

// D1 SQLite has a max statement size (~1MB). Truncate large texts.
const MAX_TEXT_LENGTH = 500000; // 500KB should be safe

/**
 * Escape SQL strings safely
 */
function escapeSql(value: string | null | undefined, maxLength?: number): string {
  if (value === null || value === undefined) return 'NULL';
  let str = value;
  // Truncate if too long
  if (maxLength && str.length > maxLength) {
    str = str.substring(0, maxLength) + '\n\n[TRUNCATED - Full text exceeds storage limit]';
  }
  // Escape single quotes and handle special chars
  const escaped = str
    .replace(/'/g, "''")
    .replace(/\\/g, '\\\\');
  return `'${escaped}'`;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clean HTML to plain text
 */
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

/**
 * Fetch full bill text
 */
async function fetchBillText(congress: number, type: string, number: number): Promise<string | null> {
  if (SKIP_TEXT) return null;

  try {
    const textData = await fetchCongressAPI(`/bill/${congress}/${type}/${number}/text`);
    const versions = textData.textVersions || [];

    if (versions.length === 0) return null;

    // Get most recent version
    const latest = versions[0];
    if (!latest.formats) return null;

    // Prefer formatted text over XML
    const textFormat = latest.formats.find((f: any) =>
      f.type?.toLowerCase().includes('formatted') || f.url?.includes('.htm')
    ) || latest.formats.find((f: any) => f.url);

    if (!textFormat?.url) return null;

    const textResponse = await fetch(textFormat.url);
    if (!textResponse.ok) return null;

    let text = await textResponse.text();

    // Clean HTML if needed
    if (textFormat.url.includes('.htm')) {
      text = cleanHtml(text);
    }

    return text.length > 0 ? text : null;
  } catch (error) {
    return null; // Silently fail - text is optional
  }
}

/**
 * Fetch cosponsors for a bill
 */
async function fetchCosponsors(congress: number, type: string, number: number): Promise<Array<{ bioguideId: string; date: string | null }>> {
  try {
    const data = await fetchCongressAPI(`/bill/${congress}/${type}/${number}/cosponsors`);
    const cosponsors = data.cosponsors || [];

    return cosponsors
      .filter((c: any) => c.bioguideId)
      .map((c: any) => ({
        bioguideId: c.bioguideId,
        date: c.sponsorshipDate || null
      }));
  } catch {
    return [];
  }
}

/**
 * Insert a bill into the database
 */
async function insertBill(bill: {
  id: string;
  congress: number;
  billType: string;
  billNumber: number;
  title: string | null;
  originChamber: string | null;
  introducedDate: string | null;
  latestActionDate: string | null;
  latestActionText: string | null;
  sponsorBioguideId: string | null;
  text: string | null;
  updateDate: string | null;
  policyArea: string | null;
}): Promise<void> {
  const query = `
    INSERT OR REPLACE INTO bills (
      id, congress, bill_type, bill_number, title,
      origin_chamber, introduced_date, latest_action_date,
      latest_action_text, sponsor_bioguide_id, text, update_date, policy_area
    ) VALUES (
      ${escapeSql(bill.id)},
      ${bill.congress},
      ${escapeSql(bill.billType)},
      ${bill.billNumber},
      ${escapeSql(bill.title)},
      ${escapeSql(bill.originChamber)},
      ${escapeSql(bill.introducedDate)},
      ${escapeSql(bill.latestActionDate)},
      ${escapeSql(bill.latestActionText)},
      ${escapeSql(bill.sponsorBioguideId)},
      ${escapeSql(bill.text, MAX_TEXT_LENGTH)},
      ${escapeSql(bill.updateDate)},
      ${escapeSql(bill.policyArea)}
    )
  `;

  await executeSQL(query);
}

/**
 * Insert a cosponsor relationship
 */
async function insertCosponsor(billId: string, bioguideId: string, date: string | null): Promise<void> {
  const query = `
    INSERT OR REPLACE INTO bill_cosponsors (
      bill_id, member_bioguide_id, cosponsor_date
    ) VALUES (
      ${escapeSql(billId)},
      ${escapeSql(bioguideId)},
      ${escapeSql(date)}
    )
  `;

  try {
    await executeSQL(query);
    stats.cosponsorsInserted++;
  } catch {
    // Ignore FK errors - member may not exist
  }
}

/**
 * Process a single bill
 */
async function processBill(billBasic: any): Promise<void> {
  const type = billBasic.type.toLowerCase();
  const number = billBasic.number;
  const billId = `${CONGRESS}-${type}-${number}`;

  try {
    // Fetch full bill details
    const detailsData = await fetchCongressAPI(`/bill/${CONGRESS}/${type}/${number}`);
    const bill = detailsData.bill;

    // Extract policy area
    const policyArea = bill.policyArea?.name || null;
    if (policyArea) stats.billsWithPolicy++;

    // Fetch full text (if not skipped)
    const text = await fetchBillText(CONGRESS, type, number);
    if (text) stats.billsWithText++;

    // Insert bill
    await insertBill({
      id: billId,
      congress: CONGRESS,
      billType: type,
      billNumber: number,
      title: bill.title || null,
      originChamber: bill.originChamber || null,
      introducedDate: bill.introducedDate || null,
      latestActionDate: bill.latestAction?.actionDate || null,
      latestActionText: bill.latestAction?.text || null,
      sponsorBioguideId: bill.sponsors?.[0]?.bioguideId || null,
      text: text,
      updateDate: bill.updateDate || null,
      policyArea: policyArea
    });

    stats.billsInserted++;

    // Fetch and insert cosponsors
    const cosponsors = await fetchCosponsors(CONGRESS, type, number);
    for (const cosponsor of cosponsors) {
      await insertCosponsor(billId, cosponsor.bioguideId, cosponsor.date);
    }

    stats.billsProcessed++;

    // Progress logging
    if (stats.billsProcessed % 10 === 0) {
      const elapsed = ((Date.now() - stats.startTime) / 1000 / 60).toFixed(1);
      const rate = (stats.billsProcessed / parseFloat(elapsed)).toFixed(1);
      console.log(
        `   ✓ ${stats.billsProcessed}/${stats.totalBillsFound} bills ` +
        `(${stats.billsWithText} w/text, ${stats.billsWithPolicy} w/policy, ${stats.cosponsorsInserted} cosponsors) ` +
        `[${elapsed}m, ${rate} bills/min]`
      );
    }

    // Save progress periodically
    if (stats.billsProcessed % PROGRESS_SAVE_INTERVAL === 0) {
      saveProgress();
    }

  } catch (error) {
    const msg = `Failed ${billId}: ${error instanceof Error ? error.message : 'Unknown'}`;
    stats.errors.push(msg);
    console.error(`   ✗ ${msg}`);
    stats.billsProcessed++;
  }
}

/**
 * Main ingestion function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📜 119th CONGRESS BILL INGESTION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n⚙️  Configuration:`);
  console.log(`   Congress: ${CONGRESS}`);
  console.log(`   Database: ${ADMIN_DASHBOARD_URL}`);
  console.log(`   Batch size: ${BATCH_SIZE}`);
  console.log(`   Skip text: ${SKIP_TEXT}`);
  console.log(`   Limit: ${BILL_LIMIT === Infinity ? 'None' : BILL_LIMIT}`);
  console.log(`   Resume mode: ${RESUME_MODE}`);

  // Load progress if resuming
  const startOffset = loadProgress();

  // Phase 1: Count total bills
  console.log('\n📊 PHASE 1: Discovering bills...\n');

  let totalCount = 0;
  try {
    const countData = await fetchCongressAPI(`/bill/${CONGRESS}?limit=1`);
    totalCount = countData.pagination?.count || 0;
    stats.totalBillsFound = Math.min(totalCount, BILL_LIMIT);
    console.log(`   Found ${totalCount} total bills in ${CONGRESS}th Congress`);
    if (BILL_LIMIT < totalCount) {
      console.log(`   Processing limited to ${BILL_LIMIT} bills`);
    }
  } catch (error) {
    console.error('❌ Failed to count bills:', error);
    process.exit(1);
  }

  // Phase 2: Process bills in batches
  console.log('\n📥 PHASE 2: Fetching and storing bills...\n');

  let offset = startOffset;
  let processedCount = stats.billsProcessed;

  while (processedCount < stats.totalBillsFound) {
    try {
      const batchData = await fetchCongressAPI(
        `/bill/${CONGRESS}?offset=${offset}&limit=${BATCH_SIZE}`
      );
      const bills = batchData.bills || [];

      if (bills.length === 0) break;

      console.log(`\n   Batch ${Math.floor(offset / BATCH_SIZE) + 1}: bills ${offset + 1}-${offset + bills.length}`);

      for (const bill of bills) {
        if (processedCount >= stats.totalBillsFound) break;
        await processBill(bill);
        processedCount++;
        stats.lastProcessedOffset = offset + (processedCount - stats.billsProcessed);
      }

      offset += bills.length;

      // Check if we've hit our limit
      if (processedCount >= BILL_LIMIT) {
        console.log(`\n⚠️  Reached limit of ${BILL_LIMIT} bills`);
        break;
      }

    } catch (error) {
      console.error(`\n❌ Batch error at offset ${offset}:`, error);
      stats.errors.push(`Batch error at offset ${offset}`);
      // Save progress and continue
      saveProgress();
      offset += BATCH_SIZE;
    }
  }

  // Final progress save
  saveProgress();

  // Phase 3: Summary
  const elapsed = ((Date.now() - stats.startTime) / 1000 / 60).toFixed(2);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅ INGESTION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Statistics:`);
  console.log(`   Bills found:       ${stats.totalBillsFound.toLocaleString()}`);
  console.log(`   Bills processed:   ${stats.billsProcessed.toLocaleString()}`);
  console.log(`   Bills inserted:    ${stats.billsInserted.toLocaleString()}`);
  console.log(`   Bills w/ text:     ${stats.billsWithText.toLocaleString()}`);
  console.log(`   Bills w/ policy:   ${stats.billsWithPolicy.toLocaleString()}`);
  console.log(`   Cosponsors:        ${stats.cosponsorsInserted.toLocaleString()}`);
  console.log(`   Errors:            ${stats.errors.length}`);
  console.log(`\n⏱️  Duration: ${elapsed} minutes`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors (first 10):`);
    stats.errors.slice(0, 10).forEach(e => console.log(`   • ${e}`));
    if (stats.errors.length > 10) {
      console.log(`   ... and ${stats.errors.length - 10} more`);
    }
  }

  console.log('\n📋 Verify with SQL:');
  console.log(`   SELECT COUNT(*) FROM bills WHERE congress = ${CONGRESS};`);
  console.log(`   SELECT COUNT(*) FROM bills WHERE congress = ${CONGRESS} AND text IS NOT NULL;`);
  console.log(`   SELECT bill_type, COUNT(*) FROM bills WHERE congress = ${CONGRESS} GROUP BY bill_type;`);

  // Clean up progress file on successful completion
  if (stats.billsProcessed >= stats.totalBillsFound && fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
    console.log('\n🧹 Cleaned up progress file');
  }
}

// Run
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  saveProgress();
  process.exit(1);
});
