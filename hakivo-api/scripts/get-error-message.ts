/**
 * Get error message from failed analysis
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const BILL_ID = '119-s-1659';

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

async function getErrorMessage() {
  console.log(`🔍 Getting error message for ${BILL_ID}...\n`);

  try {
    const result = await executeSQL(`
      SELECT executive_summary, status, model_used, started_at, analyzed_at
      FROM bill_analysis
      WHERE bill_id = '${BILL_ID}'
    `);

    if (result.results && result.results.length > 0) {
      const record = result.results[0];
      console.log('Status:', record.status);
      console.log('Model:', record.model_used);
      console.log('Started:', new Date(record.started_at).toISOString());
      console.log('Failed:', new Date(record.analyzed_at).toISOString());
      console.log('\n📝 Error Message:');
      console.log('=' .repeat(80));
      console.log(record.executive_summary);
      console.log('='.repeat(80));
    } else {
      console.log('❌ No analysis record found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

getErrorMessage().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
