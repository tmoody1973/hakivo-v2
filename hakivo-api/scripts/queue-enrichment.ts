/**
 * Manually queue a bill for AI enrichment
 */

const ENRICHMENT_QUEUE_URL = 'https://api-01ka8k5e6tr0kgy0jkzj9m4q1g.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const BILL_ID = '119-s-1092';

async function queueEnrichment() {
  console.log(`📤 Queuing bill ${BILL_ID} for enrichment...`);

  try {
    const response = await fetch(`${ENRICHMENT_QUEUE_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'enrich_bill',
        bill_id: BILL_ID,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Queue send failed: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Enrichment queued successfully');
    console.log('   Response:', result);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

queueEnrichment().then(() => {
  console.log('\n✅ Script complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
