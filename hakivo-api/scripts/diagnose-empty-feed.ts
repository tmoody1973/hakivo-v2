/**
 * Diagnostic script to check why feeds are empty
 *
 * Checks:
 * 1. Bills table row count and policy_area presence
 * 2. News_articles table row count
 * 3. User's policy interests
 * 4. View tracking tables
 */

const ADMIN_DASHBOARD_URL = process.env.ADMIN_DASHBOARD_URL || 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
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

async function diagnose() {
  console.log('🔍 Diagnosing empty feed issue...\n');

  try {
    // Check bills table
    console.log('1. Bills Table:');
    const billsCount = await executeSQL('SELECT COUNT(*) as count FROM bills');
    const billsWithPolicy = await executeSQL('SELECT COUNT(*) as count FROM bills WHERE policy_area IS NOT NULL');
    console.log(`   Total bills: ${billsCount.results[0]?.count || 0}`);
    console.log(`   Bills with policy_area: ${billsWithPolicy.results[0]?.count || 0}`);

    if ((billsCount.results[0]?.count || 0) > 0) {
      const sampleBills = await executeSQL('SELECT id, title, policy_area FROM bills LIMIT 5');
      console.log(`   Sample bills:`);
      sampleBills.results?.forEach((bill: any) => {
        console.log(`     - ${bill.id}: ${bill.policy_area || 'NO POLICY_AREA'} - ${bill.title?.substring(0, 50)}...`);
      });
    }

    // Check news_articles table
    console.log('\n2. News Articles Table:');
    const newsCount = await executeSQL('SELECT COUNT(*) as count FROM news_articles');
    console.log(`   Total articles: ${newsCount.results[0]?.count || 0}`);

    if ((newsCount.results[0]?.count || 0) > 0) {
      const recentNews = await executeSQL('SELECT id, interest, title, published_date FROM news_articles ORDER BY fetched_at DESC LIMIT 5');
      console.log(`   Recent articles:`);
      recentNews.results?.forEach((article: any) => {
        console.log(`     - ${article.interest}: ${article.title?.substring(0, 50)}...`);
      });
    }

    // Check user's policy interests
    console.log(`\n3. User Policy Interests (${USER_ID}):`);
    const userPrefs = await executeSQL(`SELECT policy_interests FROM user_preferences WHERE user_id = '${USER_ID}'`);
    if (userPrefs.results?.[0]?.policy_interests) {
      const interests = JSON.parse(userPrefs.results[0].policy_interests);
      console.log(`   Interests: ${interests.join(', ')}`);
      console.log(`   Count: ${interests.length}`);
    } else {
      console.log('   ⚠️  No policy interests found for this user');
    }

    // Check view tracking
    console.log('\n4. View Tracking:');
    const billViews = await executeSQL(`SELECT COUNT(*) as count FROM user_bill_views WHERE user_id = '${USER_ID}'`);
    const articleViews = await executeSQL(`SELECT COUNT(*) as count FROM user_article_views WHERE user_id = '${USER_ID}'`);
    console.log(`   Bills viewed by user: ${billViews.results[0]?.count || 0}`);
    console.log(`   Articles viewed by user: ${articleViews.results[0]?.count || 0}`);

    // Analyze the issue
    console.log('\n📊 DIAGNOSIS:');
    const totalBills = billsCount.results[0]?.count || 0;
    const billsWithPolicyArea = billsWithPolicy.results[0]?.count || 0;
    const totalNews = newsCount.results[0]?.count || 0;
    const hasInterests = userPrefs.results?.[0]?.policy_interests;

    if (totalBills === 0) {
      console.log('❌ Bills table is EMPTY - Need to run congress sync');
    } else if (billsWithPolicyArea === 0) {
      console.log('❌ Bills exist but NO policy_area values - Need to backfill policy areas');
    } else if (!hasInterests) {
      console.log('❌ User has NO policy interests set - User needs to set preferences');
    } else {
      console.log('✅ Bills table looks good');
    }

    if (totalNews === 0) {
      console.log('❌ News table is EMPTY - Need to run news sync');
    } else {
      console.log('✅ News table has data');
    }

    console.log('\n🔧 RECOMMENDED ACTIONS:');
    if (totalNews === 0) {
      console.log('1. Run: npx tsx scripts/test-news-sync.ts (to populate news immediately)');
    }
    if (totalBills === 0 || billsWithPolicyArea === 0) {
      console.log('2. Run: npx tsx scripts/backfill-bill-data-v4.ts (to populate/fix bills)');
    }
    if (!hasInterests) {
      console.log('3. User needs to set policy interests in their preferences');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

diagnose().then(() => {
  console.log('\n✅ Diagnosis complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
