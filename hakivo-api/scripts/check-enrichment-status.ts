/**
 * Check enrichment status for a specific bill
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const BILL_IDS = ['119-s-1659'];

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

async function checkEnrichmentStatus() {
  console.log(`🔍 Checking enrichment status for test bills\n`);
  console.log('═'.repeat(80) + '\n');

  for (const BILL_ID of BILL_IDS) {
    console.log(`\n📋 Bill: ${BILL_ID}`);
    console.log('─'.repeat(80));

    try {
      // Check if enrichment record exists
      console.log('1️⃣  Checking bill_enrichment table...');
      const enrichment = await executeSQL(`
        SELECT *
        FROM bill_enrichment
        WHERE bill_id = '${BILL_ID}'
      `);

      if (enrichment.results && enrichment.results.length > 0) {
        const record = enrichment.results[0];
        console.log('   ✓ Enrichment record found:');
        console.log('     Status:', record.status || 'null');
        console.log('     Started:', record.started_at || 'null');
        console.log('     Completed:', record.completed_at || 'null');
        console.log('     Enriched:', record.enriched_at || 'null');
        console.log('     Model:', record.model_used || 'null');
        console.log('     Has summary?', record.plain_language_summary ? 'YES' : 'NO');
        if (record.plain_language_summary) {
          console.log('     Summary preview:', record.plain_language_summary.substring(0, 100) + '...');
        }
      } else {
        console.log('   ❌ No enrichment record found');
      }

      // Check bill_analysis table too
      console.log('\n2️⃣  Checking bill_analysis table...');
      const analysis = await executeSQL(`
        SELECT *
        FROM bill_analysis
        WHERE bill_id = '${BILL_ID}'
      `);

      if (analysis.results && analysis.results.length > 0) {
        const record = analysis.results[0];
        console.log('   ✓ Analysis record found:');
        console.log('     Status:', record.status || 'null');
        console.log('     Started:', record.started_at || 'null');
        console.log('     Completed:', record.completed_at || 'null');
        console.log('     Analyzed:', record.analyzed_at || 'null');
        console.log('     Model:', record.model_used || 'null');
        console.log('     Has summary?', record.executive_summary ? 'YES' : 'NO');
      } else {
        console.log('   ❌ No analysis record found');
      }

      // Check if bill text exists
      console.log('\n3️⃣  Checking bill text...');
      const bill = await executeSQL(`
        SELECT id, title, LENGTH(text) as text_length
        FROM bills
        WHERE id = '${BILL_ID}'
      `);

      if (bill.results && bill.results.length > 0) {
        const record = bill.results[0];
        console.log('   ✓ Bill found:');
        console.log('     Title:', record.title?.substring(0, 80) + '...');
        console.log('     Text length:', record.text_length, 'characters');
      } else {
        console.log('   ❌ Bill not found in database');
      }

    } catch (error) {
      console.error('   ❌ Error:', error);
    }
  }
}

checkEnrichmentStatus().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
