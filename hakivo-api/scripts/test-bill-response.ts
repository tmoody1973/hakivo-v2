/**
 * Test what the /bills/:id endpoint returns for bill 119-s-1092
 */

const DASHBOARD_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q19.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const BILL_ID = '119-s-1092';

// NOTE: This won't work without a valid auth token, but we can try to see the structure
async function testBillResponse() {
  console.log(`📋 Testing /bills/${BILL_ID} endpoint...`);
  console.log(`   URL: ${DASHBOARD_URL}/bills/${BILL_ID}\n`);

  try {
    const response = await fetch(`${DASHBOARD_URL}/bills/${BILL_ID}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // No auth token - will likely get 401
      }
    });

    console.log(`Status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log('\nResponse:');
      console.log(JSON.stringify(data, null, 2));

      // Check enrichment
      if (data.bill?.enrichment) {
        console.log('\n✓ Enrichment data present:');
        console.log('  Status:', data.bill.enrichment.status);
        console.log('  Summary:', data.bill.enrichment.plainLanguageSummary ? 'YES' : 'NO');
      } else {
        console.log('\n⚠️  No enrichment data in response');
      }
    } else {
      const error = await response.text();
      console.log(`❌ Error ${response.status}:`, error.substring(0, 200));
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testBillResponse().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
