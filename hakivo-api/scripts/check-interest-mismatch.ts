/**
 * Check for policy interest mismatch
 * Compare user's interests with actual values in bills and news_articles
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

async function checkMismatch() {
  console.log('🔍 Checking for policy interest mismatch...\n');

  try {
    // Get user's interests
    const userPrefs = await executeSQL(`SELECT policy_interests FROM user_preferences WHERE user_id = '${USER_ID}'`);
    const userInterests = JSON.parse(userPrefs.results[0].policy_interests);

    console.log('User\'s Policy Interests:');
    userInterests.forEach((interest: string) => {
      console.log(`  - "${interest}"`);
    });

    // Get unique policy_area values from bills
    console.log('\nUnique policy_area values in bills table:');
    const billPolicies = await executeSQL('SELECT DISTINCT policy_area FROM bills WHERE policy_area IS NOT NULL ORDER BY policy_area LIMIT 50');
    billPolicies.results?.forEach((row: any) => {
      console.log(`  - "${row.policy_area}"`);
    });

    // Get unique interest values from news_articles
    console.log('\nUnique interest values in news_articles table:');
    const newsInterests = await executeSQL('SELECT DISTINCT interest FROM news_articles ORDER BY interest');
    newsInterests.results?.forEach((row: any) => {
      console.log(`  - "${row.interest}"`);
    });

    // Check for matches
    console.log('\n📊 ANALYSIS:');
    console.log('\nBills matching user interests:');
    for (const interest of userInterests) {
      const count = await executeSQL(`SELECT COUNT(*) as count FROM bills WHERE policy_area = '${interest}'`);
      console.log(`  "${interest}": ${count.results[0].count} bills`);
    }

    console.log('\nNews matching user interests:');
    for (const interest of userInterests) {
      const count = await executeSQL(`SELECT COUNT(*) as count FROM news_articles WHERE interest = '${interest}'`);
      console.log(`  "${interest}": ${count.results[0].count} articles`);
    }

    // Check bills NOT viewed by user
    console.log('\nBills matching interests NOT yet viewed:');
    for (const interest of userInterests) {
      const notViewedQuery = `
        SELECT COUNT(*) as count
        FROM bills b
        LEFT JOIN user_bill_views ubv ON b.id = ubv.bill_id AND ubv.user_id = '${USER_ID}'
        WHERE b.policy_area = '${interest}'
          AND ubv.bill_id IS NULL
      `;
      const count = await executeSQL(notViewedQuery);
      console.log(`  "${interest}": ${count.results[0].count} unviewed bills`);
    }

    // Check news NOT viewed by user
    console.log('\nNews matching interests NOT yet viewed:');
    for (const interest of userInterests) {
      const notViewedQuery = `
        SELECT COUNT(*) as count
        FROM news_articles na
        LEFT JOIN user_article_views uav ON na.id = uav.article_id AND uav.user_id = '${USER_ID}'
        WHERE na.interest = '${interest}'
          AND uav.article_id IS NULL
      `;
      const count = await executeSQL(notViewedQuery);
      console.log(`  "${interest}": ${count.results[0].count} unviewed articles`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkMismatch().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
