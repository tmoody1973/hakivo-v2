/**
 * Test the dashboard service /bills/:id endpoint
 * to see if it queues enrichment
 */

const DASHBOARD_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q19.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const BILL_ID = '119-s-1092';

// You'll need to get a valid auth token from your frontend
// For now, this will test the endpoint structure
async function testDashboardEndpoint() {
  console.log(`🧪 Testing dashboard /bills/${BILL_ID} endpoint...\n`);

  try {
    console.log('1️⃣  Calling endpoint (without auth - will get 401)...');
    const response = await fetch(`${DASHBOARD_URL}/bills/${BILL_ID}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Status: ${response.status}`);

    if (response.status === 401) {
      console.log('   ⚠️  Got 401 Unauthorized (expected without auth token)');
      console.log('   Note: When frontend calls this with valid auth, it should queue enrichment');
      console.log('\n💡 The queueing code is in dashboard-service/index.ts:1632-1643');
      console.log('   It checks if (!bill.plain_language_summary) and queues to ENRICHMENT_QUEUE');
    } else if (response.ok) {
      const data = await response.json();
      console.log('\n   ✓ Got response:');
      console.log(JSON.stringify(data, null, 2).substring(0, 500));
    } else {
      const error = await response.text();
      console.log(`   ❌ Error: ${error}`);
    }

    console.log('\n📋 Debug Steps:');
    console.log('   1. Check frontend is calling the correct backend URL');
    console.log('   2. Check if frontend auth token is valid');
    console.log('   3. Look for "📤 Queued bill" log message in dashboard-service');
    console.log('   4. Check if ENRICHMENT_QUEUE env is properly bound');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testDashboardEndpoint().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
