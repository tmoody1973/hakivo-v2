/**
 * Check what data we have for articles - especially summary and image_url
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

async function checkArticleData() {
  console.log('🔍 Checking article data quality\n');

  try {
    // Get a sample article
    const article = await executeSQL(`
      SELECT id, title, summary, image_url, text, published_date, source_domain
      FROM news_articles
      LIMIT 1
    `);

    if (article.results && article.results.length > 0) {
      const sample = article.results[0];
      console.log('📰 Sample Article:');
      console.log('  Title:', sample.title);
      console.log('  Source:', sample.source_domain);
      console.log('  Published:', new Date(sample.published_date).toLocaleString());
      console.log('\n📝 Summary:');
      console.log('  Has summary?', !!sample.summary);
      console.log('  Summary length:', sample.summary?.length || 0);
      console.log('  Summary preview:', sample.summary?.substring(0, 200) || 'NULL');
      console.log('\n🖼️  Image:');
      console.log('  Has image_url?', !!sample.image_url);
      console.log('  Image URL:', sample.image_url || 'NULL');
      console.log('\n📄 Text:');
      console.log('  Has text?', !!sample.text);
      console.log('  Text length:', sample.text?.length || 0);
      console.log('  Text preview:', sample.text?.substring(0, 200) || 'NULL');
    }

    // Check summary statistics
    console.log('\n\n📊 Summary Statistics:');
    const stats = await executeSQL(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN summary IS NOT NULL AND summary != '' THEN 1 ELSE 0 END) as has_summary,
        SUM(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 ELSE 0 END) as has_image,
        SUM(CASE WHEN text IS NOT NULL AND text != '' THEN 1 ELSE 0 END) as has_text
      FROM news_articles
    `);

    if (stats.results && stats.results.length > 0) {
      const s = stats.results[0];
      console.log(`  Total articles: ${s.total}`);
      console.log(`  Articles with summary: ${s.has_summary} (${Math.round(s.has_summary/s.total*100)}%)`);
      console.log(`  Articles with image: ${s.has_image} (${Math.round(s.has_image/s.total*100)}%)`);
      console.log(`  Articles with text: ${s.has_text} (${Math.round(s.has_text/s.total*100)}%)`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkArticleData().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
