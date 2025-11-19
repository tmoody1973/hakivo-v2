import { Task, Event } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import policyInterestMapping from '../../docs/architecture/policy_interest_mapping.json';

/**
 * News Sync Scheduler
 *
 * Runs twice daily (6 AM and 6 PM) to fetch Congressional news from Exa.ai
 * for all 12 policy interests. Stores results in shared news_articles pool
 * for efficient user filtering without per-user API calls.
 *
 * Schedule: 0 6,18 * * * (6 AM and 6 PM every day)
 *
 * Cost: 12 interests × 2 times/day = 24 Exa.ai API calls/day
 */
export default class extends Task<Env> {
  async handle(event: Event): Promise<void> {
    console.log('📰 News Sync Scheduler: Starting news sync job');
    const startTime = Date.now();

    try {
      const db = this.env.APP_DB;
      const exaClient = this.env.EXA_CLIENT;

      let totalArticles = 0;
      let successfulSyncs = 0;
      const errors: Array<{ interest: string; error: string }> = [];

      // Define date range (last 24 hours for fresh news)
      const endDate = new Date();
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      console.log(`📅 Fetching news from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Iterate through all 12 policy interests
      for (const mapping of policyInterestMapping) {
        const { interest, keywords } = mapping;

        console.log(`🔍 Syncing: ${interest}`);
        console.log(`   Keywords: ${keywords.slice(0, 3).join(', ')}...`);

        try {
          // Call Exa.ai search with keywords from mapping
          const results = await exaClient.searchNews(
            keywords,
            startDate,
            endDate,
            15 // Fetch 15 articles per interest
          );

          console.log(`   Found ${results.length} articles`);

          // Store each article in news_articles table
          for (const article of results) {
            try {
              // Extract domain from URL
              const url = new URL(article.url);
              const sourceDomain = url.hostname.replace('www.', '');

              // Insert article (ignore if duplicate URL for this interest)
              await db
                .prepare(`
                  INSERT OR IGNORE INTO news_articles (
                    id, interest, title, url, author, summary, text,
                    image_url, published_date, fetched_at, score, source_domain
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `)
                .bind(
                  crypto.randomUUID(),
                  interest,
                  article.title,
                  article.url,
                  article.author,
                  article.summary,
                  article.text,
                  article.imageUrl,
                  article.publishedDate,
                  Date.now(),
                  article.score,
                  sourceDomain
                )
                .run();

              totalArticles++;
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
      }

      // Clean up old articles (keep last 7 days)
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      await db
        .prepare('DELETE FROM news_articles WHERE fetched_at < ?')
        .bind(sevenDaysAgo)
        .run();

      console.log(`🗑️  Cleaned up old articles (>7 days)`);

      const duration = Date.now() - startTime;

      console.log('✅ News sync completed successfully');
      console.log(`   Total articles stored: ${totalArticles}`);
      console.log(`   Successful syncs: ${successfulSyncs}/${policyInterestMapping.length}`);
      console.log(`   Failed syncs: ${errors.length}`);
      console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);

      if (errors.length > 0) {
        console.log('   Errors:');
        errors.forEach(({ interest, error }) => {
          console.log(`     - ${interest}: ${error}`);
        });
      }

    } catch (error) {
      console.error('❌ News sync scheduler failed:', error);
      throw error;
    }
  }
}
