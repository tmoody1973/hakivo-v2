/**
 * Test enrichment queue by sending a manual message
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

async function sendQueueMessage() {
  console.log('🧪 Testing enrichment queue...\n');

  try {
    // Use the admin dashboard to execute code that sends a queue message
    const response = await fetch(`${ADMIN_DASHBOARD_URL}/api/test/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          type: 'enrich_bill',
          bill_id: '119-s-2749',
          timestamp: new Date().toISOString()
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to send queue message:', error);
      return;
    }

    const result = await response.json();
    console.log('✓ Queue message sent:', result);
    console.log('\n⏳ Wait 10 seconds, then check enrichment status with:');
    console.log('   npx tsx scripts/check-enrichment-status.ts');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

sendQueueMessage().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
