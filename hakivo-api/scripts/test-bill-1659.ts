/**
 * Test script to check bill 119-s-1659 and trigger analysis
 */

async function testBill() {
  const billId = '119-s-1659';
  const apiUrl = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz16.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

  console.log(`Testing bill: ${billId}`);
  console.log('='.repeat(60));

  // 1. Fetch bill details
  console.log('\n1. Fetching bill details...');
  const billResponse = await fetch(`${apiUrl}/bills/119/s/1659`);
  const billData = await billResponse.json();

  console.log('   Response structure:', JSON.stringify(billData, null, 2).substring(0, 500));

  if (!billData.success) {
    console.error('Failed to fetch bill:', billData.error);
    return;
  }

  const bill = billData.data?.bill || billData.bill || billData;
  console.log(`   Title: ${bill.title}`);
  console.log(`   Has text: ${bill.text ? 'YES' : 'NO'}`);
  console.log(`   Text length: ${bill.text ? bill.text.length : 0} characters`);
  console.log(`   Has enrichment: ${bill.enrichment ? 'YES' : 'NO'}`);
  console.log(`   Has analysis: ${bill.analysis ? 'YES' : 'NO'}`);

  if (bill.enrichment) {
    console.log(`   Enrichment status: ${bill.enrichment.status}`);
  }

  if (bill.analysis) {
    console.log(`   Analysis status: ${bill.analysis.status}`);
    console.log(`   Executive summary: ${bill.analysis.executiveSummary ? 'Present' : 'Missing'}`);
  }

  // 2. Trigger analysis if not present
  if (!bill.analysis || bill.analysis.status !== 'complete') {
    console.log('\n2. Triggering analysis...');
    const analyzeResponse = await fetch(`${apiUrl}/bills/119/s/1659/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const analyzeData = await analyzeResponse.json();
    console.log(`   Response:`, analyzeData);
  } else {
    console.log('\n2. Analysis already complete!');
  }

  console.log('\n' + '='.repeat(60));
}

testBill().catch(console.error);
