/**
 * Clear viewed articles for a user to allow news to reappear
 * Usage: USER_ID=your-user-id npx tsx scripts/clear-viewed-articles.ts
 */

async function clearViewedArticles() {
  const userId = process.env.USER_ID;

  if (!userId) {
    console.error('❌ USER_ID environment variable is required');
    console.log('Usage: USER_ID=your-user-id npx tsx scripts/clear-viewed-articles.ts');
    process.exit(1);
  }

  const API_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz19.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

  try {
    console.log(`🗑️  Clearing viewed articles for user: ${userId}`);

    const response = await fetch(`${API_URL}/db-admin/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'DELETE FROM user_article_views WHERE user_id = ?',
        params: [userId]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log('✅ Viewed articles cleared successfully');
    console.log(`   Result:`, result);

  } catch (error) {
    console.error('❌ Failed to clear viewed articles:', error);
    process.exit(1);
  }
}

clearViewedArticles().then(() => {
  console.log('\n✅ Done');
  process.exit(0);
});
