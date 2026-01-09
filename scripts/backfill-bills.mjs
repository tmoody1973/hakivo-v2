/**
 * One-time backfill script to extract and save bills from brief content
 * Uses the new URL-based extraction pattern
 */

const DB_URL = "https://svc-01kc6rbecv0s5k4yk6ksdaqyzq.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";
const CURRENT_CONGRESS = 119;

async function query(sql) {
  const resp = await fetch(`${DB_URL}/db-admin/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!resp.ok) throw new Error(`Query failed: ${resp.status}`);
  return (await resp.json()).results || [];
}

function extractBillsFromContent(content) {
  const billIdentifiers = new Map();

  // CRITICAL: Extract from Congress.gov URLs first (most reliable)
  // Pattern: congress.gov/bill/{congress}th-congress/{bill_type}/{bill_number}
  const urlMatches = content.matchAll(/congress\.gov\/bill\/\d+(?:th|st|nd|rd)-congress\/([a-z]+)\/(\d+)/gi);
  for (const match of urlMatches) {
    const billType = match[1].toLowerCase();
    const billNumber = match[2];
    if (['hr', 's', 'hres', 'sres', 'hjres', 'sjres', 'hconres', 'sconres'].includes(billType)) {
      const key = `${billType}-${billNumber}`;
      if (!billIdentifiers.has(key)) {
        billIdentifiers.set(key, { type: billType, number: billNumber });
      }
    }
  }

  // Also try text patterns as fallback
  const textPatterns = [
    /\b(HR?\.?\s*(\d+))\b/gi,
    /\b(S\.?\s*(\d+))\b/gi,
    /\b(SRES\.?\s*(\d+))\b/gi,
    /\b(HRES\.?\s*(\d+))\b/gi,
    /\b(SJRES\.?\s*(\d+))\b/gi,
    /\b(HJRES\.?\s*(\d+))\b/gi,
    /\b(SCONRES\.?\s*(\d+))\b/gi,
    /\b(HCONRES\.?\s*(\d+))\b/gi,
  ];

  for (const pattern of textPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const fullMatch = match[1].replace(/\s+/g, '').toUpperCase();
      const number = match[2];
      let type = fullMatch.replace(/\d+$/, '').replace(/\.$/, '').toLowerCase();
      if (type === 'h') type = 'hr';

      const key = `${type}-${number}`;
      if (!billIdentifiers.has(key)) {
        billIdentifiers.set(key, { type, number });
      }
    }
  }

  return Array.from(billIdentifiers.values());
}

async function backfillBrief(briefId, content) {
  const bills = extractBillsFromContent(content);
  if (bills.length === 0) {
    console.log(`  No bills found in content`);
    return 0;
  }

  console.log(`  Found ${bills.length} bills: ${bills.map(b => `${b.type}${b.number}`).join(', ')}`);

  let saved = 0;
  for (const { type, number } of bills) {
    // Look up bill in database
    const lookupResults = await query(
      `SELECT id FROM bills WHERE congress = ${CURRENT_CONGRESS} AND bill_type = '${type}' AND bill_number = ${number}`
    );

    if (lookupResults.length === 0) {
      console.log(`    Bill ${type}${number} not found in database`);
      continue;
    }

    const billId = lookupResults[0].id;

    // Insert into junction table (ignore duplicates)
    try {
      await query(
        `INSERT OR IGNORE INTO brief_bills (brief_id, bill_id, section_type) VALUES ('${briefId}', '${billId}', 'featured')`
      );
      saved++;
      console.log(`    Saved ${type}${number} -> ${billId}`);
    } catch (err) {
      console.log(`    Error saving ${type}${number}: ${err.message}`);
    }
  }

  return saved;
}

async function main() {
  console.log('Fetching briefs with 0 bills...\n');

  // Get briefs from last 5 days with 0 bills
  const briefs = await query(`
    SELECT b.id, b.title, b.content
    FROM briefs b
    WHERE b.created_at > 1736208000000
      AND (SELECT COUNT(*) FROM brief_bills bb WHERE bb.brief_id = b.id) = 0
      AND b.content IS NOT NULL
    ORDER BY b.created_at DESC
  `);

  console.log(`Found ${briefs.length} briefs with 0 bills\n`);

  let totalSaved = 0;
  for (const brief of briefs) {
    console.log(`Processing: ${brief.title} (${brief.id})`);
    const saved = await backfillBrief(brief.id, brief.content);
    totalSaved += saved;
    console.log('');
  }

  console.log(`\nBackfill complete! Saved ${totalSaved} bill associations.`);
}

main().catch(console.error);
