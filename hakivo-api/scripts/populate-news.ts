#!/usr/bin/env ts-node
/**
 * Standalone script to populate news articles into Raindrop SQL database
 *
 * Usage:
 *   npm run populate-news           # Use local sandbox database
 *   npm run populate-news:prod      # Use production database
 *
 * This script fetches news from Exa.ai for all 12 policy interests,
 * categorizes them with Cerebras AI, and stores them in the database.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import Exa from 'exa-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const policyInterestMapping: Array<{
  interest: string;
  keywords: string[];
}> = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../docs/architecture/policy_interest_mapping.json'),
    'utf-8'
  )
);

// Configuration
const DAYS_BACK = 7; // Fetch articles from last 7 days
const ARTICLES_PER_INTEREST = 25;
const EXA_API_KEY = process.env.EXA_API_KEY;
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;

interface Article {
  title: string;
  url: string;
  author: string | null;
  summary: string;
  text: string;
  imageUrl: string | null;
  publishedDate: string;
  score: number;
}

interface ExaResult {
  results: Array<{
    title: string;
    url: string;
    author?: string;
    publishedDate: string;
    summary?: string;
    text?: string;
    image?: string;
    score: number;
  }>;
}

interface CerebrasResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    total_tokens: number;
  };
}

// Exa.ai client
async function searchNews(keywords: string[], startDate: Date, endDate: Date, numResults: number): Promise<Article[]> {
  const exa = new Exa(EXA_API_KEY!);

  // Build query like the actual service does
  const keywordQuery = keywords.join(' OR ');
  const contextQuery = '(news headline OR article OR bill OR legislation OR law OR congress OR act) site:news headline OR site:article';
  const query = `${keywordQuery} ${contextQuery}`;

  const response = await exa.searchAndContents(query, {
    numResults,
    text: true,
    type: 'auto', // Use 'auto' instead of 'keyword' for better results
    category: 'news',
    userLocation: 'US',
    summary: {
      query: 'create a plain english 2 sentence summary easy to understand'
    },
    startPublishedDate: startDate.toISOString(),
    endPublishedDate: endDate.toISOString(),
    includeDomains: [
      'punchbowl.news',
      'politico.com',
      'theguardian.com',
      'nytimes.com',
      'cbsnews.com',
      'abcnews.com',
      'npr.org',
      'washingtonpost.com',
      'rollcall.com',
      'thehill.com',
      'ap.com',
      'cnn.com'
    ]
  });

  return response.results.map(result => ({
    title: result.title || 'Untitled',
    url: result.url,
    author: result.author || null,
    summary: result.summary || 'No summary available',
    text: result.text || '',
    imageUrl: result.image || null,
    publishedDate: result.publishedDate || new Date().toISOString(),
    score: result.score || 0,
  }));
}

// Cerebras AI categorization
async function categorizeArticle(
  title: string,
  summary: string,
  availableCategories: string[]
): Promise<{ category: string; tokensUsed: number }> {
  const categoriesText = availableCategories.map((c, i) => `${i + 1}. ${c}`).join('\n');

  const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama3.1-8b',
      messages: [
        {
          role: 'system',
          content: `You are a news categorization expert. Analyze the article and determine which ONE policy interest category it belongs to based on its PRIMARY topic.

Ignore tangential keyword mentions - focus on what the article is ACTUALLY about.

Available categories:
${categoriesText}

Return your response as JSON with this exact structure:
{
  "category": "Category Name",
  "reasoning": "Brief explanation"
}`,
        },
        {
          role: 'user',
          content: `Categorize this news article:

Title: ${title}
Summary: ${summary}

Return JSON with the category name (must exactly match one from the list).`,
        },
      ],
      temperature: 0.2,
      max_tokens: 150,
    }),
  });

  if (!response.ok) {
    throw new Error(`Cerebras API error: ${response.statusText}`);
  }

  const data = await response.json() as CerebrasResponse;
  const content = data.choices[0]!.message.content.trim();

  // Parse JSON response
  let jsonText = content;
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/, '').replace(/```$/, '').trim();
  }

  const parsed = JSON.parse(jsonText);
  const category = parsed.category || parsed.Category || availableCategories[0];

  // Validate category
  if (!availableCategories.includes(category)) {
    return {
      category: availableCategories[0]!,
      tokensUsed: data.usage.total_tokens,
    };
  }

  return {
    category,
    tokensUsed: data.usage.total_tokens,
  };
}

// Main script
async function main() {
  console.log('🚀 Starting news population script...\n');

  // Validate environment variables
  if (!EXA_API_KEY) {
    console.error('❌ EXA_API_KEY environment variable not set');
    process.exit(1);
  }
  if (!CEREBRAS_API_KEY) {
    console.error('❌ CEREBRAS_API_KEY environment variable not set');
    process.exit(1);
  }

  const startTime = Date.now();
  let totalArticles = 0;
  let successfulSyncs = 0;
  const errors: Array<{ interest: string; error: string }> = [];

  // Define date range
  const endDate = new Date();
  const startDate = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000);

  console.log(`📅 Fetching news from ${startDate.toISOString()} to ${endDate.toISOString()}`);
  console.log(`📰 Articles per interest: ${ARTICLES_PER_INTEREST}\n`);

  // Get all policy interests
  const availableCategories = policyInterestMapping.map((m: { interest: string; keywords: string[] }) => m.interest);

  // Collect all articles
  const allArticles: Array<{
    article: Article;
    category: string;
    interest: string;
  }> = [];

  // Iterate through all policy interests
  for (const mapping of policyInterestMapping) {
    const { interest, keywords } = mapping;

    console.log(`🔍 Syncing: ${interest}`);
    console.log(`   Keywords: ${keywords.slice(0, 3).join(', ')}...`);

    try {
      // Fetch articles from Exa.ai
      const results = await searchNews(keywords, startDate, endDate, ARTICLES_PER_INTEREST);
      console.log(`   Found ${results.length} articles`);

      // Categorize each article with AI
      for (const article of results) {
        try {
          let aiCategory = interest; // Fallback to keyword-based category
          let categoryChanged = false;

          try {
            const categorization = await categorizeArticle(
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

          allArticles.push({
            article,
            category: aiCategory,
            interest,
          });

          totalArticles++;
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

  const duration = Date.now() - startTime;

  console.log('\n✅ News fetch completed');
  console.log(`   Total articles fetched: ${totalArticles}`);
  console.log(`   Successful syncs: ${successfulSyncs}/${policyInterestMapping.length}`);
  console.log(`   Failed syncs: ${errors.length}`);
  console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(({ interest, error }) => {
      console.log(`   - ${interest}: ${error}`);
    });
  }

  // Output SQL INSERT statements
  console.log('\n📝 Generating SQL INSERT statements...\n');
  console.log('-- Copy and paste these into Raindrop SQL admin or run via Wrangler D1');
  console.log('-- Database: app-db\n');

  for (const { article, category } of allArticles) {
    const url = new URL(article.url);
    const sourceDomain = url.hostname.replace('www.', '');
    const id = crypto.randomUUID();
    const fetchedAt = Date.now();

    // Escape single quotes in strings
    const escape = (str: string) => str.replace(/'/g, "''");

    console.log(`INSERT INTO news_articles (
  id, interest, title, url, author, summary, text,
  image_url, published_date, fetched_at, score, source_domain
) VALUES (
  '${id}',
  '${escape(category)}',
  '${escape(article.title)}',
  '${escape(article.url)}',
  ${article.author ? `'${escape(article.author)}'` : 'NULL'},
  '${escape(article.summary)}',
  '${escape(article.text)}',
  ${article.imageUrl ? `'${escape(article.imageUrl)}'` : 'NULL'},
  '${article.publishedDate}',
  ${fetchedAt},
  ${article.score},
  '${escape(sourceDomain)}'
);`);
  }

  console.log('\n✨ Done! Copy the SQL statements above and run them in Raindrop SQL admin.');
  console.log('   Or save to a file and use: wrangler d1 execute app-db --file=insert-news.sql');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
