/**
 * Check what's in the news_articles table
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

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

async function checkNewsDatabase() {
  console.log('🔍 Checking news_articles table\n');

  try {
    // Count total articles
    const count = await executeSQL(`
      SELECT COUNT(*) as total FROM news_articles
    `);
    console.log(`📊 Total articles: ${count.results[0].total}\n`);

    // Count by interest
    const byInterest = await executeSQL(`
      SELECT interest, COUNT(*) as count
      FROM news_articles
      GROUP BY interest
      ORDER BY count DESC
    `);

    console.log('📈 Articles by interest:');
    for (const row of byInterest.results || []) {
      console.log(`  ${row.interest}: ${row.count}`);
    }

    // Check recent articles
    console.log('\n📰 Most recent 5 articles:');
    const recent = await executeSQL(`
      SELECT title, interest, published_date, source_domain
      FROM news_articles
      ORDER BY fetched_at DESC
      LIMIT 5
    `);

    for (const article of recent.results || []) {
      console.log(`  • [${article.interest}] ${article.title}`);
      console.log(`    ${article.source_domain} | ${new Date(article.published_date).toLocaleDateString()}`);
    }

    // Check user_article_views
    console.log('\n👁️  User article views:');
    const views = await executeSQL(`
      SELECT COUNT(*) as total FROM user_article_views
    `);
    console.log(`  Total views: ${views.results[0].total}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkNewsDatabase().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
