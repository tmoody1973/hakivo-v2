const ADMIN_DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
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

async function checkBillText() {
  console.log(`🔍 Checking bill text for: ${BILL_ID}\n`);

  try {
    const result = await executeSQL(`
      SELECT id, title, LENGTH(text) as text_length, SUBSTR(text, 1, 1000) as text_preview
      FROM bills
      WHERE id = '${BILL_ID}'
    `);

    if (!result.results || result.results.length === 0) {
      console.log('❌ Bill not found in database!');
      return;
    }

    const bill = result.results[0];
    console.log('Bill ID:', bill.id);
    console.log('Title:', bill.title);
    console.log('\nText field:');
    console.log('- Is null?', bill.text_length === null);
    console.log('- Length:', bill.text_length || 0);
    console.log('\nFirst 1000 characters:');
    console.log(bill.text_preview || 'NO TEXT');

    // Also check enrichment status
    const enrichment = await executeSQL(`
      SELECT bill_id, status, summary, model_used, created_at
      FROM bill_enrichment
      WHERE bill_id = '${BILL_ID}'
    `);

    if (enrichment.results && enrichment.results.length > 0) {
      console.log('\n📊 Enrichment Status:');
      const e = enrichment.results[0];
      console.log('- Status:', e.status);
      console.log('- Model:', e.model_used);
      console.log('- Summary preview:', e.summary?.substring(0, 200) || 'NO SUMMARY');
    } else {
      console.log('\n⚠️  No enrichment found for this bill');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkBillText().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
