#!/usr/bin/env tsx

/**
 * Backfill Policy Areas Script
 *
 * Uses Cerebras AI to infer policy areas for bills that don't have one
 * from Congress.gov. Classifies based on bill title and text content.
 *
 * Usage:
 *   npx tsx scripts/backfill-policy-areas.ts
 *   npx tsx scripts/backfill-policy-areas.ts --limit 100    # Process only N bills
 *   npx tsx scripts/backfill-policy-areas.ts --dry-run      # Don't update database
 *
 * Required env:
 *   CEREBRAS_API_KEY - Get from Cerebras
 */

// Official Congress.gov Policy Areas (27 categories)
const POLICY_AREAS = [
  "Agriculture and Food",
  "Animals",
  "Armed Forces and National Security",
  "Arts, Culture, Religion",
  "Civil Rights and Liberties, Minority Issues",
  "Commerce",
  "Congress",
  "Crime and Law Enforcement",
  "Education",
  "Emergency Management",
  "Energy",
  "Environmental Protection",
  "Families",
  "Finance and Financial Sector",
  "Foreign Trade and International Finance",
  "Government Operations and Politics",
  "Health",
  "International Affairs",
  "Labor and Employment",
  "Law",
  "Native Americans",
  "Public Lands and Natural Resources",
  "Science, Technology, Communications",
  "Social Welfare",
  "Sports and Recreation",
  "Taxation",
  "Transportation and Public Works",
  "Water Resources Development"
];

// Configuration
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const ADMIN_DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyzp.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

// Parse CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT_ARG = args.indexOf('--limit');
const BILL_LIMIT = LIMIT_ARG !== -1 ? parseInt(args[LIMIT_ARG + 1]) : Infinity;

// Stats
let stats = {
  startTime: Date.now(),
  billsFound: 0,
  billsProcessed: 0,
  billsUpdated: 0,
  errors: 0
};

// Validation
if (!CEREBRAS_API_KEY) {
  console.error('❌ CEREBRAS_API_KEY environment variable is required');
  process.exit(1);
}

/**
 * Execute SQL query via admin-dashboard
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

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Use Cerebras to infer policy area from bill title and text
 */
async function inferPolicyArea(title: string, text?: string, retries = 3): Promise<string | null> {
  const textSnippet = text ? text.slice(0, 2000) : '';

  const prompt = `You are a legislative policy analyst. Classify the following bill into ONE of these official Congress.gov policy areas:

${POLICY_AREAS.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Bill Title: ${title}
${textSnippet ? `\nBill Text (excerpt):\n${textSnippet}` : ''}

Respond with ONLY the policy area name exactly as listed above, nothing else. If uncertain, choose the most likely category based on the title.`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CEREBRAS_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-oss-120b',
          messages: [
            { role: 'system', content: 'You are a legislative policy classification expert. Respond only with the exact policy area name.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1, // Low temperature for consistent classification
          max_completion_tokens: 100,
          stream: false
        })
      });

      if (response.status === 429) {
        console.error(`   ⚠️  Rate limited, waiting 5s (attempt ${attempt}/${retries})`);
        await sleep(5000);
        continue;
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Cerebras API error: ${error}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
      };

      const aiResponse = data.choices[0]?.message?.content?.trim();

      if (!aiResponse && attempt < retries) {
        console.error(`   ⚠️  Empty response, retrying (${attempt}/${retries})`);
        await sleep(1000);
        continue;
      }

      if (!aiResponse) {
        console.error(`   ⚠️  Empty AI response`);
        return null;
      }

      // Validate response is a valid policy area
      // Try exact match first
      let matchedArea = POLICY_AREAS.find(p =>
        p.toLowerCase() === aiResponse.toLowerCase()
      );

      // Try partial match if no exact match
      if (!matchedArea) {
        matchedArea = POLICY_AREAS.find(p =>
          aiResponse.toLowerCase().includes(p.toLowerCase()) ||
          p.toLowerCase().includes(aiResponse.toLowerCase())
        );
      }

      if (!matchedArea) {
        console.error(`   ⚠️  Invalid AI response: "${aiResponse}"`);
      }

      return matchedArea || null;
    } catch (error) {
      if (attempt < retries) {
        console.error(`   ⚠️  Error, retrying (${attempt}/${retries}): ${error}`);
        await sleep(1000);
        continue;
      }
      console.error(`   ⚠️  AI inference failed: ${error}`);
      return null;
    }
  }
  return null;
}

/**
 * Escape SQL strings
 */
function escapeSql(value: string | null): string {
  if (value === null) return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Main function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🤖 POLICY AREA BACKFILL (AI Inference)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n⚙️  Configuration:`);
  console.log(`   Dry run: ${DRY_RUN}`);
  console.log(`   Limit: ${BILL_LIMIT === Infinity ? 'None' : BILL_LIMIT}`);
  console.log(`   Policy areas: ${POLICY_AREAS.length} categories`);

  // Find bills without policy areas
  console.log('\n📊 Finding bills without policy areas...\n');

  const query = `SELECT id, title, text FROM bills WHERE policy_area IS NULL LIMIT ${Math.min(BILL_LIMIT, 1000)}`;
  const result = await executeSQL(query);

  const bills = result.results || [];
  stats.billsFound = bills.length;

  console.log(`   Found ${stats.billsFound} bills without policy areas`);

  if (bills.length === 0) {
    console.log('\n✅ No bills need policy area inference!');
    return;
  }

  // Process each bill
  console.log('\n🔄 Processing bills with AI...\n');

  for (const bill of bills) {
    const billId = bill.id;
    const title = bill.title || '';
    const text = bill.text || '';

    process.stdout.write(`   ${billId}: `);

    // Skip if no title
    if (!title) {
      console.log('⚠️  No title, skipping');
      stats.billsProcessed++;
      continue;
    }

    // Infer policy area using AI
    const policyArea = await inferPolicyArea(title, text);

    if (!policyArea) {
      console.log('❌ Could not infer policy area');
      stats.errors++;
      stats.billsProcessed++;
      continue;
    }

    console.log(`→ ${policyArea}`);

    // Update database (unless dry run)
    if (!DRY_RUN) {
      try {
        const updateQuery = `UPDATE bills SET policy_area = ${escapeSql(policyArea)} WHERE id = ${escapeSql(billId)}`;
        await executeSQL(updateQuery);
        stats.billsUpdated++;
      } catch (error) {
        console.error(`   ⚠️  Failed to update: ${error}`);
        stats.errors++;
      }
    } else {
      stats.billsUpdated++;
    }

    stats.billsProcessed++;

    // Progress logging
    if (stats.billsProcessed % 50 === 0) {
      const elapsed = ((Date.now() - stats.startTime) / 1000 / 60).toFixed(1);
      console.log(`\n   --- Progress: ${stats.billsProcessed}/${stats.billsFound} (${elapsed}m) ---\n`);
    }

    // Delay to avoid rate limiting (500ms between requests)
    await sleep(500);
  }

  // Summary
  const elapsed = ((Date.now() - stats.startTime) / 1000 / 60).toFixed(2);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅ BACKFILL COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Statistics:`);
  console.log(`   Bills found:      ${stats.billsFound}`);
  console.log(`   Bills processed:  ${stats.billsProcessed}`);
  console.log(`   Bills updated:    ${stats.billsUpdated}${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`   Errors:           ${stats.errors}`);
  console.log(`\n⏱️  Duration: ${elapsed} minutes`);
}

// Run
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
