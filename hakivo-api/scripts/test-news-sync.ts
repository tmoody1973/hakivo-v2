/**
 * Test script to manually trigger the news sync scheduler
 *
 * This script simulates the news-sync-scheduler to populate the news_articles pool
 * for testing purposes. It runs the same logic as the scheduled task.
 *
 * Usage: npx tsx scripts/test-news-sync.ts
 */

import policyInterestMapping from '../docs/architecture/policy_interest_mapping.json';

interface NewsArticle {
  title: string;
  url: string;
  author: string | null;
  publishedDate: string;
  summary: string;
  imageUrl: string | null;
  score: number;
}

async function testNewsSync() {
  console.log('📰 Test News Sync: Starting manual sync job');
  const startTime = Date.now();

  try {
    // Get environment variables
    const API_URL = process.env.API_URL || 'http://localhost:3001';
    const EXA_API_KEY = process.env.EXA_API_KEY;

    if (!EXA_API_KEY) {
      console.error('❌ EXA_API_KEY environment variable is required');
      process.exit(1);
    }

    let totalArticles = 0;
    let successfulSyncs = 0;
    const errors: Array<{ interest: string; error: string }> = [];

    // Define date range (last 24 hours for fresh news)
    const endDate = new Date();
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    console.log(`📅 Fetching news from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`🔍 Will sync ${policyInterestMapping.length} policy interests`);

    // Iterate through all 12 policy interests
    for (const mapping of policyInterestMapping) {
      const { interest, keywords } = mapping;

      console.log(`\n🔍 Syncing: ${interest}`);
      console.log(`   Keywords: ${keywords.slice(0, 3).join(', ')}...`);

      try {
        // Call EXA_CLIENT service via internal API
        const response = await fetch(`${API_URL}/exa-client/search-news`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            interests: keywords,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            limit: 15
          })
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const results = await response.json() as NewsArticle[];

        console.log(`   Found ${results.length} articles`);

        // Store each article in news_articles table
        for (const article of results) {
          try {
            // Extract domain from URL
            const url = new URL(article.url);
            const sourceDomain = url.hostname.replace('www.', '');

            // Insert article via dashboard service
            const insertResponse = await fetch(`${API_URL}/dashboard/news/insert`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                interest,
                title: article.title,
                url: article.url,
                author: article.author,
                summary: article.summary,
                imageUrl: article.imageUrl,
                publishedDate: article.publishedDate,
                score: article.score,
                sourceDomain
              })
            });

            if (insertResponse.ok) {
              totalArticles++;
            } else {
              console.warn(`   ⚠️ Failed to store article: ${article.title}`);
            }
          } catch (error) {
            console.warn(`   ⚠️ Failed to store article: ${article.title}`, error);
          }
        }

        successfulSyncs++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`   ❌ Failed to sync ${interest}:`, errorMsg);
        errors.push({ interest, error: errorMsg });
      }

      // Add small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const duration = Date.now() - startTime;

    console.log('\n✅ Test News sync completed');
    console.log(`   Total articles stored: ${totalArticles}`);
    console.log(`   Successful syncs: ${successfulSyncs}/${policyInterestMapping.length}`);
    console.log(`   Failed syncs: ${errors.length}`);
    console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);

    if (errors.length > 0) {
      console.log('\n   Errors:');
      errors.forEach(({ interest, error }) => {
        console.log(`     - ${interest}: ${error}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Test news sync failed:', error);
    process.exit(1);
  }
}

// Run the test
testNewsSync().then(() => {
  console.log('\n✅ Test completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
