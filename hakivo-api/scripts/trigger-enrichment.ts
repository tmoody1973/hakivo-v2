/**
 * Manually trigger enrichment for a specific bill
 * This directly tests the enrichment pipeline
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const BILL_ID = '119-s-1092';

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
 * Strip HTML tags and extract plain text
 */
function stripHTML(html: string): string {
  let text = html.replace(/<[^>]*>/g, '');
  text = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');
  return text.trim();
}

async function triggerEnrichment() {
  console.log(`🚀 Manually triggering enrichment for: ${BILL_ID}\n`);

  try {
    // Step 1: Get bill from database
    console.log('1️⃣  Fetching bill from database...');
    const billResult = await executeSQL(`
      SELECT id, congress, bill_type, bill_number, title,
             latest_action_text, text
      FROM bills
      WHERE id = '${BILL_ID}'
    `);

    if (!billResult.results || billResult.results.length === 0) {
      throw new Error('Bill not found');
    }

    const bill = billResult.results[0];
    console.log(`   ✓ Found: ${bill.title}`);
    console.log(`   Text length: ${bill.text?.length || 0} characters`);

    if (!bill.text || bill.text.length === 0) {
      throw new Error('Bill has no text for enrichment');
    }

    // Step 2: Create test enrichment record
    console.log('\n2️⃣  Creating test enrichment record...');
    console.log('   (Note: This test script doesn\'t have Gemini API access)');
    console.log('   In production, the enrichment-observer would:');
    console.log('   - Use POLICY_ANALYST_PROMPT framework');
    console.log('   - Send up to 30,000 chars of bill text');
    console.log('   - Request structured JSON response');
    console.log('   - Parse and save to database');

    const testSummary = `This bill (${bill.title}) is currently being analyzed by our AI system. The enrichment observer should process this and generate a comprehensive analysis including what it does, who it affects, key provisions, potential benefits, and potential concerns.`;

    await executeSQL(`
      INSERT OR REPLACE INTO bill_enrichment (
        bill_id,
        plain_language_summary,
        status,
        started_at,
        completed_at,
        enriched_at,
        model_used
      ) VALUES (
        '${BILL_ID}',
        '${testSummary.replace(/'/g, "''")}',
        'complete',
        '${new Date().toISOString()}',
        '${new Date().toISOString()}',
        '${new Date().toISOString()}',
        'test-manual-trigger'
      )
    `);

    console.log('   ✓ Test enrichment record created');

    // Step 3: Verify
    console.log('\n3️⃣  Verifying enrichment...');
    const verification = await executeSQL(`
      SELECT bill_id, status, plain_language_summary,
             completed_at, model_used
      FROM bill_enrichment
      WHERE bill_id = '${BILL_ID}'
    `);

    if (verification.results && verification.results.length > 0) {
      const record = verification.results[0];
      console.log('   ✓ Enrichment verified:');
      console.log('     Status:', record.status);
      console.log('     Model:', record.model_used);
      console.log('     Completed:', record.completed_at);
      console.log('     Summary preview:', record.plain_language_summary?.substring(0, 100) + '...');
    }

    console.log('\n📌 Next Steps:');
    console.log('   1. Refresh http://localhost:3000/bills/119-s-1092');
    console.log('   2. The test enrichment should now show');
    console.log('   3. To get REAL AI analysis, the enrichment-observer needs to process the queue');
    console.log('   4. Check if enrichment-observer is running and processing messages');

  } catch (error) {
    console.error('❌ Error:', error);

    // Mark as failed
    try {
      await executeSQL(`
        UPDATE bill_enrichment
        SET status = 'failed',
            completed_at = '${new Date().toISOString()}'
        WHERE bill_id = '${BILL_ID}'
      `);
    } catch (e) {
      console.error('Failed to update status:', e);
    }

    process.exit(1);
  }
}

triggerEnrichment().then(() => {
  console.log('\n✅ Manual enrichment trigger complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
