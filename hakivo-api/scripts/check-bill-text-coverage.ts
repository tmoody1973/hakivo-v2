/**
 * Check how many bills have text data in the database
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

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

async function checkBillTextCoverage() {
  console.log('📊 Checking bill text coverage in database...\n');

  try {
    // Get total counts
    const counts = await executeSQL(`
      SELECT
        COUNT(*) as total_bills,
        COUNT(CASE WHEN text IS NOT NULL AND LENGTH(text) > 0 THEN 1 END) as bills_with_text,
        COUNT(CASE WHEN text IS NULL OR LENGTH(text) = 0 THEN 1 END) as bills_without_text
      FROM bills
    `);

    const stats = counts.results[0];
    console.log('Overall Statistics:');
    console.log(`  Total bills: ${stats.total_bills}`);
    console.log(`  Bills with text: ${stats.bills_with_text} (${((stats.bills_with_text / stats.total_bills) * 100).toFixed(1)}%)`);
    console.log(`  Bills without text: ${stats.bills_without_text} (${((stats.bills_without_text / stats.total_bills) * 100).toFixed(1)}%)`);

    // Sample some bills with text
    console.log('\n📝 Sample bills with text:');
    const samplesWithText = await executeSQL(`
      SELECT id, title, LENGTH(text) as text_length, SUBSTR(text, 1, 100) as preview
      FROM bills
      WHERE text IS NOT NULL AND LENGTH(text) > 0
      LIMIT 5
    `);

    if (samplesWithText.results && samplesWithText.results.length > 0) {
      for (const bill of samplesWithText.results) {
        console.log(`\n  ${bill.id}: ${bill.title}`);
        console.log(`    Text length: ${bill.text_length} chars`);
        console.log(`    Preview: ${bill.preview}...`);
      }
    } else {
      console.log('  No bills with text found');
    }

    // Sample some bills without text
    console.log('\n\n❌ Sample bills without text:');
    const samplesWithoutText = await executeSQL(`
      SELECT id, title, congress, bill_type, bill_number
      FROM bills
      WHERE text IS NULL OR LENGTH(text) = 0
      LIMIT 5
    `);

    if (samplesWithoutText.results && samplesWithoutText.results.length > 0) {
      for (const bill of samplesWithoutText.results) {
        console.log(`  ${bill.id}: ${bill.title}`);
      }
    } else {
      console.log('  All bills have text!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkBillTextCoverage().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
