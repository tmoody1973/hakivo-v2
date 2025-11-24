/**
 * Clear failed analysis record for a bill
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
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

async function clearFailedAnalysis() {
  console.log(`🗑️  Clearing failed analysis for ${BILL_ID}...\n`);

  try {
    // Delete the failed analysis record
    const result = await executeSQL(`
      DELETE FROM bill_analysis WHERE bill_id = '${BILL_ID}'
    `);

    console.log('✅ Failed analysis record deleted');
    console.log('\nResult:', result);
    console.log('\nYou can now trigger a fresh analysis with:');
    console.log(`   curl -X POST https://svc-01ka8k5e6tr0kgy0jkzj9m4q16.01k66gywmx8x4r0w31fdjjfekf.lmapp.run/bills/119/s/1659/analyze`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

clearFailedAnalysis().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
