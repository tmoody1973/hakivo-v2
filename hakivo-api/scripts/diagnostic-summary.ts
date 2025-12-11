/**
 * Complete diagnostic summary of enrichment pipeline
 */

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

async function diagnosticSummary() {
  console.log('🔍 ENRICHMENT PIPELINE DIAGNOSTIC SUMMARY');
  console.log('==========================================\n');

  try {
    // 1. Check bill data
    console.log('📄 BILL DATA:');
    const bill = await executeSQL(`
      SELECT id, title, LENGTH(text) as text_length,
             CASE WHEN text LIKE '<html>%' THEN 'HTML' ELSE 'Plain Text' END as text_format
      FROM bills
      WHERE id = '${BILL_ID}'
    `);

    if (bill.results && bill.results.length > 0) {
      const b = bill.results[0];
      console.log(`   ✓ Bill: ${b.title}`);
      console.log(`   ✓ Text: ${b.text_length} chars (${b.text_format})`);
    } else {
      console.log('   ❌ Bill not found');
    }

    // 2. Check enrichment status
    console.log('\n🤖 ENRICHMENT STATUS:');
    const enrichment = await executeSQL(`
      SELECT status, model_used, started_at, completed_at,
             LENGTH(plain_language_summary) as summary_length
      FROM bill_enrichment
      WHERE bill_id = '${BILL_ID}'
    `);

    if (enrichment.results && enrichment.results.length > 0) {
      const e = enrichment.results[0];
      console.log(`   ✓ Status: ${e.status}`);
      console.log(`   ✓ Model: ${e.model_used}`);
      console.log(`   ✓ Summary: ${e.summary_length} chars`);
      console.log(`   ✓ Started: ${e.started_at || 'N/A'}`);
      console.log(`   ✓ Completed: ${e.completed_at || 'N/A'}`);
    } else {
      console.log('   ❌ No enrichment record');
    }

    // 3. Check database stats
    console.log('\n📊 DATABASE STATS:');
    const stats = await executeSQL(`
      SELECT
        COUNT(*) as total_bills,
        COUNT(CASE WHEN text IS NOT NULL AND LENGTH(text) > 0 THEN 1 END) as bills_with_text,
        COUNT(CASE WHEN text LIKE '<html>%' THEN 1 END) as html_bills,
        (SELECT COUNT(*) FROM bill_enrichment) as enriched_bills
      FROM bills
    `);

    if (stats.results && stats.results.length > 0) {
      const s = stats.results[0];
      console.log(`   Total bills: ${s.total_bills}`);
      console.log(`   Bills with text: ${s.bills_with_text}`);
      console.log(`   HTML bills (need stripping): ${s.html_bills}`);
      console.log(`   Enriched bills: ${s.enriched_bills}`);
    }

    // 4. Check backfill progress
    console.log('\n🔄 BACKFILL PROGRESS:');
    try {
      const backfill = await executeSQL(`
        SELECT status, processed, total, updated_at
        FROM backfill_progress
        WHERE id = 'html-strip'
      `);

      if (backfill.results && backfill.results.length > 0) {
        const b = backfill.results[0];
        console.log(`   Status: ${b.status}`);
        console.log(`   Progress: ${b.processed}/${b.total} (${((b.processed/b.total)*100).toFixed(1)}%)`);
        console.log(`   Last update: ${new Date(b.updated_at).toISOString()}`);
      } else {
        console.log('   ⚠️  No backfill progress tracked');
      }
    } catch (e) {
      console.log('   ⚠️  Backfill progress table not created yet');
    }

    // 5. Key findings
    console.log('\n🔑 KEY FINDINGS:');
    if (bill.results && bill.results.length > 0) {
      const b = bill.results[0];
      if (b.text_format === 'Plain Text') {
        console.log('   ✅ Bill text is plain text (ready for AI)');
      } else {
        console.log('   ⚠️  Bill text is HTML (needs stripping)');
      }
    }

    if (enrichment.results && enrichment.results.length > 0) {
      const e = enrichment.results[0];
      if (e.model_used === 'test-manual-trigger') {
        console.log('   ⚠️  Using test enrichment (not real AI analysis)');
      } else if (e.model_used === 'gemini-3-pro-preview') {
        console.log('   ✅ Real Gemini AI analysis present');
      }
    } else {
      console.log('   ❌ No enrichment - automatic queuing may have failed');
    }

    if (stats.results && stats.results.length > 0) {
      const s = stats.results[0];
      if (s.html_bills > 0) {
        console.log(`   ⚠️  ${s.html_bills} bills still have HTML text`);
      }
    }

    console.log('\n📋 NEXT STEPS:');
    if (enrichment.results && enrichment.results.length > 0 && enrichment.results[0].model_used === 'test-manual-trigger') {
      console.log('   1. Test enrichment is showing - verify it displays at http://localhost:3000/bills/119-s-1092');
      console.log('   2. Delete test enrichment to trigger automatic queueing:');
      console.log(`      DELETE FROM bill_enrichment WHERE bill_id = '${BILL_ID}'`);
      console.log('   3. Access bill again to trigger automatic enrichment queue');
      console.log('   4. Monitor enrichment-observer logs to see if it processes');
    }

    if (stats.results && stats.results.length > 0 && stats.results[0].html_bills > 0) {
      console.log(`   5. Run backfill-strip-html.ts to convert ${stats.results[0].html_bills} HTML bills`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

diagnosticSummary().then(() => {
  console.log('\n✅ Diagnostic complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
