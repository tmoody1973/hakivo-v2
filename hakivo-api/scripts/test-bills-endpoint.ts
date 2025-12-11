/**
 * Test the /dashboard/bills endpoint with mapped policy areas
 */

const DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz19.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const TEST_TOKEN = process.env.TEST_TOKEN;

if (!TEST_TOKEN) {
  console.error('❌ TEST_TOKEN environment variable is required');
  console.log('Get your token from localStorage.getItem("accessToken") in browser console');
  process.exit(1);
}

async function testBillsEndpoint() {
  console.log('🧪 Testing /dashboard/bills endpoint...\n');

  try {
    const url = `${DASHBOARD_URL}/dashboard/bills?token=${encodeURIComponent(TEST_TOKEN || '')}&limit=5`;
    console.log(`Fetching: ${DASHBOARD_URL}/dashboard/bills`);

    const response = await fetch(url);
    console.log(`Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error response: ${errorText}`);
      process.exit(1);
    }

    const data = await response.json() as any;
    console.log(`\n✅ Success!`);
    console.log(`Found ${data.count} bills`);
    console.log(`User interests: ${data.interests?.join(', ')}`);

    if (data.bills && data.bills.length > 0) {
      console.log(`\nSample bills:`);
      data.bills.forEach((bill: any, i: number) => {
        console.log(`\n${i + 1}. ${bill.billType.toUpperCase()} ${bill.billNumber}`);
        console.log(`   Policy Area: ${bill.policyArea}`);
        console.log(`   Title: ${bill.title?.substring(0, 80)}...`);
        if (bill.sponsor) {
          console.log(`   Sponsor: ${bill.sponsor.firstName} ${bill.sponsor.lastName} (${bill.sponsor.party}-${bill.sponsor.state})`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testBillsEndpoint().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
