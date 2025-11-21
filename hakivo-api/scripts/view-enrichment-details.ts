/**
 * View complete enrichment details from database
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
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

async function viewEnrichmentDetails() {
  console.log(`🔍 Viewing enrichment details for: ${BILL_ID}\n`);

  try {
    const result = await executeSQL(`
      SELECT *
      FROM bill_enrichment
      WHERE bill_id = '${BILL_ID}'
    `);

    if (result.results && result.results.length > 0) {
      const enrichment = result.results[0];

      console.log('📊 Enrichment Record:');
      console.log('   Status:', enrichment.status);
      console.log('   Model:', enrichment.model_used);
      console.log('\n📝 Plain Language Summary:');
      console.log(enrichment.plain_language_summary);
      console.log('\n🔑 Key Points:');
      console.log(enrichment.key_points || 'null');
      console.log('\n🏷️  Tags:');
      console.log(enrichment.tags || 'null');
      console.log('\n⏰ Timestamps:');
      console.log('   Started:', enrichment.started_at);
      console.log('   Completed:', enrichment.completed_at);
      console.log('   Enriched:', enrichment.enriched_at);

      // Try to parse JSON fields
      if (enrichment.key_points) {
        try {
          const keyPoints = JSON.parse(enrichment.key_points);
          console.log('\n📋 Parsed Key Points:');
          keyPoints.forEach((point: string, i: number) => {
            console.log(`   ${i + 1}. ${point}`);
          });
        } catch (e) {
          console.log('\n   ⚠️  Could not parse key_points JSON');
        }
      }

      if (enrichment.tags) {
        try {
          const tags = JSON.parse(enrichment.tags);
          console.log('\n🏷️  Parsed Tags:');
          console.log('   ', tags.join(', '));
        } catch (e) {
          console.log('\n   ⚠️  Could not parse tags JSON');
        }
      }

    } else {
      console.log('❌ No enrichment found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

viewEnrichmentDetails().then(() => {
  console.log('\n✅ Complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
