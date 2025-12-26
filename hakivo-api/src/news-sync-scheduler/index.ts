import { Task, Event } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import policyInterestMapping from '../../docs/architecture/policy_interest_mapping.json';

/**
 * News Sync Scheduler
 *
 * Runs 3x daily (8 AM, 2 PM, and 8 PM) to fetch Congressional news from
 * BOTH Exa.ai and Perplexity for all 12 policy interests.
 *
 * Dual-Source Strategy:
 * - Exa.ai: Primary source with built-in images
 * - Perplexity: Secondary source with LinkPreview for images
 *
 * Results stored in shared news_articles pool for efficient user filtering.
 *
 * Schedule: 0 8,14,20 * * * (8 AM, 2 PM, and 8 PM every day)
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

      console.log('📥 PHASE 1: Fetching articles from all interests (Exa.ai + Perplexity)...');

      // Iterate through all 12 policy interests
      for (const mapping of policyInterestMapping) {
        const { interest, keywords } = mapping;

        console.log(`🔍 Syncing: ${interest}`);
        console.log(`   Keywords: ${keywords.slice(0, 3).join(', ')}...`);

        try {
          // ========== SOURCE 1: Exa.ai ==========
          console.log(`   📰 [EXA] Fetching from Exa.ai...`);
          const exaResults = await exaClient.searchNews(
            keywords,
            startDate,
            endDate,
            15 // Reduced to 15 per source (was 25)
          );

          // ========== SOURCE 2: Perplexity ==========
          console.log(`   🔍 [PERPLEXITY] Fetching from Perplexity...`);
          const perplexityResults = await this.fetchPerplexityNews(interest, keywords);
          console.log(`   📰 [PERPLEXITY] Got ${perplexityResults.length} articles`);

          // Combine results from both sources
          const results = [
            ...exaResults.map(article => ({ ...article, source: 'exa' as const })),
            ...perplexityResults.map(article => ({
              title: article.title,
              summary: article.summary,
              url: article.url,
              author: article.author,
              text: article.text,
              imageUrl: article.imageUrl,
              publishedDate: article.publishedDate,
              score: article.score,
              source: 'perplexity' as const
            }))
          ];

          console.log(`   📊 Combined: ${exaResults.length} Exa + ${perplexityResults.length} Perplexity = ${results.length} total`);

          // Filter out landing pages and section pages
          const filteredResults = results.filter(article => {
            const isLanding = this.isLandingPage(article);
            if (isLanding) {
              console.log(`   🚫 Filtered landing page: "${article.title}"`);
              return false;
            }

            // Filter out articles with suspicious dates (Dec 31 placeholder dates)
            const hasBadDate = this.hasSuspiciousDate(article.publishedDate);
            if (hasBadDate) {
              console.log(`   🚫 Filtered bad date (${article.publishedDate}): "${article.title}"`);
              return false;
            }

            return true;
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

  // Check if date looks like a placeholder (Dec 31, Jan 1, etc.)
  private hasSuspiciousDate(publishedDate: string): boolean {
    if (!publishedDate) return true;

    try {
      const date = new Date(publishedDate);
      if (isNaN(date.getTime())) return true;

      const month = date.getMonth(); // 0-indexed (0 = Jan, 11 = Dec)
      const day = date.getDate();
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

      // Filter out Dec 31 and Jan 1 (common placeholder dates)
      if ((month === 11 && day === 31) || (month === 0 && day === 1)) {
        return true;
      }

      // Filter out dates more than 7 days old (we only want recent news)
      if (daysDiff > 7) {
        return true;
      }

      // Filter out future dates (bad data)
      if (daysDiff < 0) {
        return true;
      }

      return false;
    } catch {
      return true;
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
      // News roundup/digest titles
      'morning news brief',
      'evening news brief',
      'news brief',
      'daily briefing',
      'morning edition',
      'evening edition',
      'news roundup',
      'weekly roundup',
      'daily digest',
      'news digest',
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

  /**
   * Fetch og:image using LinkPreview API
   * Used for Perplexity articles which don't have reliable images
   * @param url - Article URL to fetch image for
   * @returns Image URL or null if not found
   */
  private async fetchImageWithLinkPreview(url: string): Promise<string | null> {
    try {
      const apiKey = this.env.LINKPREVIEW_API_KEY;
      if (!apiKey) {
        console.warn('[LINKPREVIEW] API key not set, skipping');
        return null;
      }

      const response = await fetch('https://api.linkpreview.net', {
        method: 'POST',
        headers: {
          'X-Linkpreview-Api-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: url })
      });

      if (!response.ok) {
        console.warn(`[LINKPREVIEW] API error for ${url}: ${response.status}`);
        return null;
      }

      const data = await response.json() as { image?: string };
      if (data.image && data.image.startsWith('http')) {
        return data.image;
      }

      return null;
    } catch (error) {
      console.warn(`[LINKPREVIEW] Failed to fetch image for ${url}:`, error);
      return null;
    }
  }

  /**
   * Fetch news from Perplexity for a specific interest
   * Uses LinkPreview API to get images for articles
   * Uses AI relevance scoring to rank articles by relevance to the interest
   * @param interest - Policy interest to search for
   * @param keywords - Keywords for the interest
   * @returns Array of articles with images and AI-scored relevance
   */
  private async fetchPerplexityNews(
    interest: string,
    keywords: string[]
  ): Promise<Array<{
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
    source: 'perplexity';
  }>> {
    try {
      console.log(`   🔍 [PERPLEXITY] Fetching news for: ${interest}`);

      // Call Perplexity with the interest keywords
      const results = await this.env.PERPLEXITY_CLIENT.searchNews(
        [interest],
        null, // No state filter for general sync
        15    // Fetch 15 articles per interest
      );

      console.log(`   📰 [PERPLEXITY] Got ${results.length} articles for ${interest}`);

      // Get Cerebras client for AI relevance scoring
      const cerebrasClient = this.env.CEREBRAS_CLIENT;

      // Process articles: fetch images and score relevance
      const articlesWithImages = await Promise.all(
        results.map(async (article) => {
          // Extract domain from URL
          let sourceDomain = 'unknown';
          try {
            const url = new URL(article.url);
            sourceDomain = url.hostname.replace('www.', '');
          } catch {
            sourceDomain = 'unknown';
          }

          // Check if article already has an image from Perplexity
          let imageUrl = article.image?.url || null;

          // If no image, try LinkPreview
          if (!imageUrl && article.url) {
            imageUrl = await this.fetchImageWithLinkPreview(article.url);
            if (imageUrl) {
              console.log(`   🖼️  [LINKPREVIEW] Got image for: ${article.title.substring(0, 40)}...`);
            }
          }

          // AI Relevance Scoring: Score how relevant this article is to the interest
          let score = 0.5; // Default fallback score
          try {
            const relevanceResult = await cerebrasClient.scoreArticleRelevance(
              article.title,
              article.summary,
              interest
            );
            score = relevanceResult.score;

            // Log high and low relevance scores for visibility
            if (score >= 0.8) {
              console.log(`   🎯 [RELEVANCE] High (${score.toFixed(2)}): "${article.title.substring(0, 50)}..."`);
            } else if (score <= 0.3) {
              console.log(`   📉 [RELEVANCE] Low (${score.toFixed(2)}): "${article.title.substring(0, 50)}..."`);
            }
          } catch (error) {
            console.warn(`   ⚠️ [RELEVANCE] AI scoring failed, using default 0.5:`, error);
          }

          return {
            id: crypto.randomUUID(),
            title: article.title,
            summary: article.summary,
            url: article.url,
            author: null,
            text: article.summary, // Perplexity provides summary not full text
            imageUrl,
            publishedDate: article.publishedAt || new Date().toISOString(),
            score, // AI-scored relevance (0.0 - 1.0)
            sourceDomain,
            source: 'perplexity' as const
          };
        })
      );

      // Sort by relevance score (highest first)
      articlesWithImages.sort((a, b) => b.score - a.score);

      console.log(`   📊 [PERPLEXITY] Scored ${articlesWithImages.length} articles, top score: ${articlesWithImages[0]?.score.toFixed(2) || 'N/A'}`);

      return articlesWithImages;
    } catch (error) {
      console.error(`   ❌ [PERPLEXITY] Failed to fetch for ${interest}:`, error);
      return [];
    }
  }
}
