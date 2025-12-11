/**
 * Clear viewed articles and bills for the user
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const USER_ID = '5904f54d-1637-4e75-93c8-04eea7c3ea13';

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

async function clearViews() {
  console.log(`🗑️  Clearing viewed content for user: ${USER_ID}\n`);

  try {
    // Clear viewed articles
    console.log('Clearing viewed articles...');
    const articlesResult = await executeSQL(`DELETE FROM user_article_views WHERE user_id = '${USER_ID}'`);
    console.log(`✅ Cleared viewed articles`);

    // Clear viewed bills
    console.log('Clearing viewed bills...');
    const billsResult = await executeSQL(`DELETE FROM user_bill_views WHERE user_id = '${USER_ID}'`);
    console.log(`✅ Cleared viewed bills`);

    console.log('\n✅ All view records cleared! Fresh content will now appear.');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

clearViews().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
