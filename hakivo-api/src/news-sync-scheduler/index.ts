import { Task, Event } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import policyInterestMapping from '../../docs/architecture/policy_interest_mapping.json';

/**
 * News Sync Scheduler
 *
 * Runs 3x daily (8 AM, 2 PM, and 8 PM) to fetch Congressional news from Exa.ai
 * for all 12 policy interests. Stores results in shared news_articles pool
 * for efficient user filtering without per-user API calls.
 *
 * Schedule: 0 8,14,20 * * * (8 AM, 2 PM, and 8 PM every day)
 *
 * Cost: 12 interests × 3 times/day = 36 Exa.ai API calls/day
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

      // Define date range (last 3 days for larger content pool)
      const endDate = new Date();
      const startDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      console.log(`📅 Fetching news from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Get all policy interests for AI categorization
      const availableCategories = policyInterestMapping.map(m => m.interest);
      const cerebrasClient = this.env.CEREBRAS_CLIENT;

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
            25 // Fetch 25 articles per interest (3-day window = ~900 total articles)
          );

          console.log(`   Found ${results.length} articles`);

          // Store each article in news_articles table with AI categorization
          for (const article of results) {
            try {
              // Extract domain from URL
              const url = new URL(article.url);
              const sourceDomain = url.hostname.replace('www.', '');

              // Use AI to determine correct category (semantic understanding)
              let aiCategory = interest; // Fallback to keyword-based category
              let categoryChanged = false;

              try {
                const categorization = await cerebrasClient.categorizeNewsArticle(
                  article.title,
                  article.summary,
                  availableCategories
                );
                aiCategory = categorization.category;
                categoryChanged = (aiCategory !== interest);

                if (categoryChanged) {
                  console.log(`   🔄 Recategorized: "${article.title.substring(0, 60)}..."`);
                  console.log(`      ${interest} → ${aiCategory}`);
                }
              } catch (error) {
                console.warn(`   ⚠️ AI categorization failed, using keyword-based: ${interest}`, error);
              }

              // Insert article with AI-determined category (ignore if duplicate URL)
              await db
                .prepare(`
                  INSERT OR IGNORE INTO news_articles (
                    id, interest, title, url, author, summary, text,
                    image_url, published_date, fetched_at, score, source_domain
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `)
                .bind(
                  crypto.randomUUID(),
                  aiCategory, // Use AI-determined category
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

      // Clean up old view records (keep last 7 days per user)
      // This allows articles to reappear after a week without clearing everyone's history
      await db
        .prepare('DELETE FROM user_article_views WHERE viewed_at < ?')
        .bind(sevenDaysAgo)
        .run();

      console.log(`🗑️  Cleaned up old view records (>7 days per user)`);

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
