/**
 * Delete test enrichment to allow real AI analysis
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

async function deleteTestEnrichment() {
  console.log(`🗑️  Deleting test enrichment for: ${BILL_ID}\n`);

  try {
    // Check current enrichment
    console.log('1️⃣  Checking current enrichment...');
    const check = await executeSQL(`
      SELECT status, model_used, plain_language_summary
      FROM bill_enrichment
      WHERE bill_id = '${BILL_ID}'
    `);

    if (check.results && check.results.length > 0) {
      const e = check.results[0];
      console.log(`   Current: status=${e.status}, model=${e.model_used}`);
      console.log(`   Summary: ${e.plain_language_summary?.substring(0, 100)}...`);
    } else {
      console.log('   No enrichment found');
      return;
    }

    // Delete
    console.log('\n2️⃣  Deleting enrichment...');
    await executeSQL(`DELETE FROM bill_enrichment WHERE bill_id = '${BILL_ID}'`);
    console.log('   ✓ Deleted');

    // Verify
    console.log('\n3️⃣  Verifying deletion...');
    const verify = await executeSQL(`
      SELECT COUNT(*) as count
      FROM bill_enrichment
      WHERE bill_id = '${BILL_ID}'
    `);

    if (verify.results && verify.results[0].count === 0) {
      console.log('   ✓ Confirmed - enrichment deleted');
    } else {
      console.log('   ⚠️  Enrichment still exists');
    }

    console.log('\n📋 Next Steps:');
    console.log('   1. Access http://localhost:3000/bills/119-s-1092');
    console.log('   2. Dashboard service should queue enrichment automatically');
    console.log('   3. Enrichment-observer should process and call Gemini API');
    console.log('   4. Real AI analysis should appear within 10-30 seconds');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deleteTestEnrichment().then(() => {
  console.log('\n✅ Test enrichment deleted');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
