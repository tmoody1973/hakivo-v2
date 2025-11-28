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

      let successfulSyncs = 0;
      const errors: Array<{ interest: string; error: string }> = [];

      // Define date range (last 3 days for larger content pool)
      const endDate = new Date();
      const startDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      console.log(`📅 Fetching news from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Get all policy interests for AI categorization
      const availableCategories = policyInterestMapping.map(m => m.interest);
      const cerebrasClient = this.env.CEREBRAS_CLIENT;

      // PHASE 1: Collect all articles from all interests
      type ArticleWithMetadata = {
        id: string;
        title: string;
        summary: string;
        url: string;
        author: string | null;
        text: string;
        imageUrl: string | null;
        publishedDate: string;
        score: number;
        sourceDomain: string;
        aiCategory: string;
        originalInterest: string;
      };

      const allArticles: ArticleWithMetadata[] = [];

      console.log('📥 PHASE 1: Fetching articles from all interests...');

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

          // Filter out landing pages and section pages
          const filteredResults = results.filter(article => {
            const isLanding = this.isLandingPage(article);
            if (isLanding) {
              console.log(`   🚫 Filtered landing page: "${article.title}"`);
            }
            return !isLanding;
          });

          console.log(`   Found ${results.length} articles (${filteredResults.length} after filtering)`);

          // Categorize and collect articles
          for (const article of filteredResults) {
            try {
              // Extract domain from URL
              const url = new URL(article.url);
              const sourceDomain = url.hostname.replace('www.', '');

              // Use AI to determine correct category (semantic understanding)
              let aiCategory = interest; // Fallback to keyword-based category

              try {
                const categorization = await cerebrasClient.categorizeNewsArticle(
                  article.title,
                  article.summary,
                  availableCategories
                );
                aiCategory = categorization.category;

                if (aiCategory !== interest) {
                  console.log(`   🔄 Recategorized: "${article.title.substring(0, 60)}..."`);
                  console.log(`      ${interest} → ${aiCategory}`);
                }
              } catch (error) {
                console.warn(`   ⚠️ AI categorization failed, using keyword-based: ${interest}`, error);
              }

              // Collect article with metadata
              allArticles.push({
                id: crypto.randomUUID(),
                title: article.title,
                summary: article.summary,
                url: article.url,
                author: article.author,
                text: article.text,
                imageUrl: article.imageUrl || null,
                publishedDate: article.publishedDate,
                score: article.score,
                sourceDomain,
                aiCategory,
                originalInterest: interest
              });
            } catch (error) {
              console.warn(`   ⚠️ Failed to process article: ${article.title}`, error);
            }
          }

          successfulSyncs++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`   ❌ Failed to sync ${interest}:`, errorMsg);
          errors.push({ interest, error: errorMsg });
        }
      }

      console.log(`✅ Phase 1 complete: ${allArticles.length} articles collected`);

      // PHASE 2: Group by category and deduplicate
      console.log('🔍 PHASE 2: Deduplicating articles by category...');

      // Group articles by AI category
      const articlesByCategory = new Map<string, ArticleWithMetadata[]>();
      for (const article of allArticles) {
        const existing = articlesByCategory.get(article.aiCategory) || [];
        existing.push(article);
        articlesByCategory.set(article.aiCategory, existing);
      }

      // Deduplication metrics
      let totalDuplicatesRemoved = 0;
      let totalStage1Candidates = 0;
      let totalStage2Verifications = 0;
      const uniqueArticles: ArticleWithMetadata[] = [];
      const categoryMetrics: Array<{
        category: string;
        total: number;
        unique: number;
        duplicates: number;
        deduplicationRate: number;
      }> = [];

      // Track which sources overlap (for source analysis)
      const sourcePairCounts = new Map<string, number>();

      // Deduplicate each category
      for (const [category, articles] of articlesByCategory) {
        console.log(`📂 Category: ${category} (${articles.length} articles)`);

        if (articles.length <= 1) {
          // No duplicates possible
          uniqueArticles.push(...articles);
          categoryMetrics.push({
            category,
            total: articles.length,
            unique: articles.length,
            duplicates: 0,
            deduplicationRate: 0
          });
          continue;
        }

        try {
          const deduplicationResult = await cerebrasClient.deduplicateArticles(
            articles.map(a => ({
              id: a.id,
              title: a.title,
              summary: a.summary,
              score: a.score
            }))
          );

          // Keep only unique articles
          const uniqueIds = new Set(deduplicationResult.uniqueArticleIds);
          const categoryUniqueArticles = articles.filter(a => uniqueIds.has(a.id));
          uniqueArticles.push(...categoryUniqueArticles);

          // Update metrics
          totalDuplicatesRemoved += deduplicationResult.stats.duplicatesRemoved;
          totalStage1Candidates += deduplicationResult.stats.stage1Candidates;
          totalStage2Verifications += deduplicationResult.stats.stage2Verified;

          const deduplicationRate = (deduplicationResult.stats.duplicatesRemoved / articles.length) * 100;

          categoryMetrics.push({
            category,
            total: articles.length,
            unique: categoryUniqueArticles.length,
            duplicates: deduplicationResult.stats.duplicatesRemoved,
            deduplicationRate
          });

          // Track source pairs for duplicate analysis
          for (const group of deduplicationResult.duplicateGroups) {
            const keptArticle = articles.find(a => a.id === group.kept);
            for (const removedId of group.removed) {
              const removedArticle = articles.find(a => a.id === removedId);
              if (keptArticle && removedArticle) {
                const sourcePair = [keptArticle.sourceDomain, removedArticle.sourceDomain].sort().join(' <-> ');
                sourcePairCounts.set(sourcePair, (sourcePairCounts.get(sourcePair) || 0) + 1);
              }
            }
          }

          console.log(`   ✅ ${categoryUniqueArticles.length} unique, ${deduplicationResult.stats.duplicatesRemoved} duplicates removed (${deduplicationRate.toFixed(1)}%)`);
        } catch (error) {
          console.warn(`   ⚠️ Deduplication failed for ${category}, keeping all articles`, error);
          uniqueArticles.push(...articles);
          categoryMetrics.push({
            category,
            total: articles.length,
            unique: articles.length,
            duplicates: 0,
            deduplicationRate: 0
          });
        }
      }

      console.log(`✅ Phase 2 complete: ${uniqueArticles.length} unique articles (${totalDuplicatesRemoved} duplicates removed)`);

      // Log detailed deduplication metrics
      console.log('\n📊 DEDUPLICATION METRICS:');
      console.log(`   Total articles fetched: ${allArticles.length}`);
      console.log(`   Unique articles: ${uniqueArticles.length}`);
      console.log(`   Duplicates removed: ${totalDuplicatesRemoved}`);
      console.log(`   Overall deduplication rate: ${((totalDuplicatesRemoved / allArticles.length) * 100).toFixed(1)}%`);
      console.log(`   Stage 1 candidates (>70% similarity): ${totalStage1Candidates}`);
      console.log(`   Stage 2 LLM verifications: ${totalStage2Verifications}`);
      console.log(`   LLM efficiency: ${totalStage1Candidates > 0 ? ((totalStage2Verifications / totalStage1Candidates) * 100).toFixed(1) : 0}% of candidates verified`);

      // Category breakdown
      console.log('\n📋 BY CATEGORY:');
      for (const metric of categoryMetrics.sort((a, b) => b.duplicates - a.duplicates)) {
        if (metric.duplicates > 0) {
          console.log(`   ${metric.category}: ${metric.unique}/${metric.total} unique (${metric.duplicates} dupes, ${metric.deduplicationRate.toFixed(1)}%)`);
        }
      }

      // Source overlap analysis (top 5 most duplicated source pairs)
      if (sourcePairCounts.size > 0) {
        console.log('\n🔗 TOP SOURCE OVERLAPS:');
        const topSourcePairs = Array.from(sourcePairCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        for (const [pair, count] of topSourcePairs) {
          console.log(`   ${pair}: ${count} duplicates`);
        }
      }

      // PHASE 3: Insert unique articles into database
      console.log('💾 PHASE 3: Inserting unique articles into database...');

      let totalArticles = 0;
      for (const article of uniqueArticles) {
        try {
          // Insert article (ignore if duplicate URL)
          await db
            .prepare(`
              INSERT OR IGNORE INTO news_articles (
                id, interest, title, url, author, summary, text,
                image_url, published_date, fetched_at, score, source_domain
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              article.id,
              article.aiCategory,
              article.title,
              article.url,
              article.author,
              article.summary,
              article.text,
              article.imageUrl,
              article.publishedDate,
              Date.now(),
              article.score,
              article.sourceDomain
            )
            .run();

          totalArticles++;
        } catch (error) {
          console.warn(`   ⚠️ Failed to store article: ${article.title}`, error);
        }
      }

      console.log(`✅ Phase 3 complete: ${totalArticles} articles inserted`)

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

  // Check if article is a landing page or section page
  private isLandingPage(article: { title: string; url: string; summary: string }): boolean {
    const url = article.url.toLowerCase();
    const title = article.title.toLowerCase();
    const summary = article.summary.toLowerCase();

    // Generic landing page titles
    const genericTitles = [
      'business news',
      'world news',
      'politics news',
      'breaking news',
      'latest news',
      'top stories',
      'home',
      'homepage',
      'news home',
      'business | ',
      'politics | ',
      'economy | ',
      '| economy, tech, ai',
      'research news',
      'climate news',
      'tech news',
      'science news',
    ];

    // Check if title matches generic patterns
    if (genericTitles.some(generic => title.includes(generic) || title === generic.replace(' | ', ''))) {
      return true;
    }

    // URL patterns that indicate landing pages (section pages, not articles)
    const landingUrlPatterns = [
      // Main sections ending in category name
      /\/business\/?$/,
      /\/politics\/?$/,
      /\/news\/?$/,
      /\/world\/?$/,
      /\/economy\/?$/,
      /\/latest\/?$/,
      /\/home\/?$/,
      /\/tech\/?$/,
      /\/science\/?$/,
      /\/health\/?$/,
      /\/climate\/?$/,
      /\/opinion\/?$/,
      /\/sports\/?$/,
      /\/entertainment\/?$/,
      // Regional section pages (e.g., /world/canada, /world/europe)
      /\/world\/[a-z]+\/?$/,
      // Topic section pages (e.g., /green, /citylab, /markets)
      /\/green\/?$/,
      /\/citylab\/?$/,
      /\/markets\/?$/,
      /\/energy\/?$/,
      /\/technology\/?$/,
      /\/environment\/?$/,
      // NPR-style sections (e.g., /sections/research-news)
      /\/sections\/[a-z-]+\/?$/,
      // Category pages (e.g., /category/politics)
      /\/category\/[a-z-]+\/?$/,
      /\/categories\/[a-z-]+\/?$/,
      // Tag pages
      /\/tag\/[a-z-]+\/?$/,
      /\/tags\/[a-z-]+\/?$/,
      // Topic pages
      /\/topic\/[a-z-]+\/?$/,
      /\/topics\/[a-z-]+\/?$/,
    ];

    if (landingUrlPatterns.some(pattern => pattern.test(url))) {
      return true;
    }

    // Check URL path segment count - landing pages usually have 1-2 path segments
    // Real articles typically have more segments or date-based paths
    try {
      const urlObj = new URL(article.url);
      const pathSegments = urlObj.pathname.split('/').filter(s => s.length > 0);

      // If URL has only 1-2 short segments and no numbers (dates/IDs), likely a section page
      if (pathSegments.length <= 2) {
        const hasDateOrId = pathSegments.some(seg =>
          /\d{4}/.test(seg) || // Year like 2024
          /^\d+$/.test(seg) || // Numeric ID
          seg.length > 30      // Long slugs are usually articles
        );
        if (!hasDateOrId) {
          return true;
        }
      }
    } catch {
      // Invalid URL, skip this check
    }

    // Summary patterns that indicate section pages
    const sectionSummaryPatterns = [
      'page provides the latest',
      'section covers a variety',
      'provides updates on various',
      'covers topics including',
      'includes coverage of',
      'page features',
      'section includes',
      'find the latest',
      'browse all',
      'explore our coverage',
      'read more about',
    ];

    if (sectionSummaryPatterns.some(pattern => summary.includes(pattern))) {
      return true;
    }

    return false;
  }
}
