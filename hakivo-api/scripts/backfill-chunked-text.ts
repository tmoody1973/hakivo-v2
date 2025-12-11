#!/usr/bin/env tsx

/**
 * Backfill Bill Text in Chunks
 *
 * For extremely large bills that exceed SQLite statement limits,
 * this script stores text in multiple smaller chunks in a separate table.
 *
 * Usage:
 *   npx tsx scripts/backfill-chunked-text.ts
 *   npx tsx scripts/backfill-chunked-text.ts --bill-ids 119-hr-5300,119-s-1071
 *
 * This creates a bill_text_chunks table and stores text in 30KB chunks.
 */

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const BASE_URL = 'https://api.congress.gov/v3';
const ADMIN_DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyzp.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

// Very small chunks to stay well under D1's 1MB statement limit
// 30KB raw text + escaping overhead + SQL structure should be ~60KB max
const CHUNK_SIZE = 30000; // 30KB per chunk
const API_DELAY_MS = 750;

const args = process.argv.slice(2);
const BILL_IDS_ARG = args.indexOf('--bill-ids');
const SPECIFIC_BILL_IDS = BILL_IDS_ARG !== -1 ? args[BILL_IDS_ARG + 1]?.split(',') : null;

let stats = {
  billsProcessed: 0,
  chunksInserted: 0,
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

function escapeSql(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  const escaped = value.replace(/'/g, "''").replace(/\\/g, '\\\\');
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

async function ensureChunkTable(): Promise<void> {
  console.log('   Creating bill_text_chunks table if not exists...');

  await executeSQL(`
    CREATE TABLE IF NOT EXISTS bill_text_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      total_chunks INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(bill_id, chunk_index)
    )
  `);

  // Create index for fast lookups
  try {
    await executeSQL(`CREATE INDEX IF NOT EXISTS idx_bill_text_chunks_bill_id ON bill_text_chunks(bill_id)`);
  } catch {
    // Index might already exist
  }
}

function splitTextIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.substring(i, i + CHUNK_SIZE));
  }
  return chunks;
}

async function storeTextInChunks(billId: string, text: string): Promise<number> {
  // First, delete any existing chunks for this bill
  await executeSQL(`DELETE FROM bill_text_chunks WHERE bill_id = ${escapeSql(billId)}`);

  const chunks = splitTextIntoChunks(text);
  const totalChunks = chunks.length;

  for (let i = 0; i < chunks.length; i++) {
    const query = `
      INSERT INTO bill_text_chunks (bill_id, chunk_index, chunk_text, total_chunks)
      VALUES (${escapeSql(billId)}, ${i}, ${escapeSql(chunks[i])}, ${totalChunks})
    `;

    try {
      await executeSQL(query);
      stats.chunksInserted++;
    } catch (error) {
      // If even a 30KB chunk fails, skip this chunk
      console.error(`   ⚠️  Chunk ${i + 1}/${totalChunks} failed for ${billId}`);
      stats.errors.push(`${billId} chunk ${i}: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  return totalChunks;
}

async function findBillsWithoutText(): Promise<string[]> {
  if (SPECIFIC_BILL_IDS && SPECIFIC_BILL_IDS.length > 0) {
    return SPECIFIC_BILL_IDS;
  }

  // Find bills that have NULL text (these are the oversized ones we set to metadata-only)
  const result = await executeSQL(`
    SELECT id FROM bills
    WHERE congress = 119
    AND text IS NULL
    ORDER BY id
  `);

  if (result.success && result.results) {
    return result.results.map((r: any) => r.id);
  }

  return [];
}

async function processBill(billId: string): Promise<boolean> {
  const parts = billId.split('-');
  if (parts.length !== 3) return false;

  const congress = parseInt(parts[0]);
  const type = parts[1];
  const number = parseInt(parts[2]);

  try {
    console.log(`   Processing ${billId}...`);

    const text = await fetchBillText(congress, type, number);

    if (!text) {
      console.log(`   ⚠️  No text available for ${billId}`);
      return true; // Not a failure, just no text
    }

    const sizeKB = (text.length / 1024).toFixed(0);
    const numChunks = Math.ceil(text.length / CHUNK_SIZE);
    console.log(`   📝 ${billId}: ${sizeKB}KB text → ${numChunks} chunks`);

    const insertedChunks = await storeTextInChunks(billId, text);
    console.log(`   ✅ Stored ${insertedChunks} chunks for ${billId}`);

    stats.billsProcessed++;
    return true;

  } catch (error) {
    stats.errors.push(`${billId}: ${error instanceof Error ? error.message : 'Unknown'}`);
    console.error(`   ❌ Failed ${billId}: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📝 BACKFILL CHUNKED BILL TEXT');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n⚙️  Configuration:`);
  console.log(`   Chunk size: ${CHUNK_SIZE / 1024}KB`);
  console.log(`   Specific bills: ${SPECIFIC_BILL_IDS ? SPECIFIC_BILL_IDS.join(', ') : 'Auto-detect (NULL text bills)'}`);

  // Ensure the chunks table exists
  await ensureChunkTable();

  console.log('\n📋 Finding bills without text...\n');
  const bills = await findBillsWithoutText();

  if (bills.length === 0) {
    console.log('   ✨ No bills need chunked text!');
    return;
  }

  console.log(`   Found ${bills.length} bills to process\n`);
  console.log('🔧 Processing bills...\n');

  for (const billId of bills) {
    await processBill(billId);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅ CHUNKED TEXT BACKFILL COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Results:`);
  console.log(`   Bills processed: ${stats.billsProcessed}`);
  console.log(`   Chunks inserted: ${stats.chunksInserted}`);
  console.log(`   Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors:`);
    stats.errors.slice(0, 10).forEach(e => console.log(`   • ${e}`));
  }

  console.log('\n📋 To retrieve full text for a bill:');
  console.log(`   SELECT chunk_text FROM bill_text_chunks WHERE bill_id = '119-hr-5300' ORDER BY chunk_index;`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
