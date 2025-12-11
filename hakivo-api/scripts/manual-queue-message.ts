/**
 * Manually send enrichment message to queue
 * This bypasses dashboard service to test if observer is working
 */

const ENRICHMENT_QUEUE_URL = 'https://api-01kc6rbecv0s5k4yk6ksdaqyz1g.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const BILL_ID = '119-s-1092';

async function sendQueueMessage() {
  console.log(`📤 Manually sending enrichment queue message for: ${BILL_ID}\n`);

  try {
    console.log('1️⃣  Sending message to enrichment-queue...');
    const response = await fetch(`${ENRICHMENT_QUEUE_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'enrich_bill',
        bill_id: BILL_ID,
        timestamp: new Date().toISOString()
      })
    });

    console.log(`   Status: ${response.status}`);

    if (response.ok) {
      const result = await response.json();
      console.log('   ✓ Message sent to queue');
      console.log('   Response:', JSON.stringify(result, null, 2));

      console.log('\n2️⃣  Wait 10-30 seconds for enrichment-observer to process...');
      console.log('   Then run: npx tsx scripts/check-enrichment-status.ts');
      console.log('\n   Expected flow:');
      console.log('   • enrichment-queue receives message');
      console.log('   • enrichment-observer picks up message');
      console.log('   • Creates bill_enrichment record with status=processing');
      console.log('   • Calls Gemini API with full bill text');
      console.log('   • Saves analysis to database with status=complete');
    } else {
      const error = await response.text();
      console.log(`   ❌ Failed: ${error}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

sendQueueMessage().then(() => {
  console.log('\n✅ Queue message sent');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
