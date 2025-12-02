import { expect, test, describe } from 'vitest';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local from the hakivo-api root
config({ path: resolve(__dirname, '../../.env.local') });

/**
 * Perplexity API Integration Tests
 *
 * These tests hit the real Perplexity API to verify our client works correctly.
 * Run with: npm test -- src/perplexity-client/index.test.ts
 *
 * Requires PERPLEXITY_API_KEY in .env.local
 *
 * NOTE: Perplexity API costs money per request! Run sparingly.
 */

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const API_URL = 'https://api.perplexity.ai/chat/completions';
const MODEL = 'sonar-pro';

// Skip tests if no API key
const runTests = !!PERPLEXITY_API_KEY;

describe('Perplexity API', () => {
  describe('searchNews', () => {
    test.skipIf(!runTests)('should search for policy news with interests', async () => {
      const interests = ['Health & Social Welfare', 'Economy & Finance'];
      const today = new Date().toISOString().split('T')[0];

      // JSON schema without images (Perplexity hallucinates image URLs)
      const jsonSchema = {
        type: 'object',
        properties: {
          articles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                summary: { type: 'string' },
                url: { type: 'string' },
                publishedAt: { type: 'string' },
                source: { type: 'string' },
                category: { type: 'string' }
              },
              required: ['title', 'summary', 'url', 'publishedAt', 'source', 'category']
            }
          }
        },
        required: ['articles']
      };

      const searchPrompt = `Search for the 5 most recent and important news articles from the past 7 days about U.S. policy and legislation.

SEARCH FOCUS - Find news about:
• healthcare policy
• Medicare Medicaid
• economic policy
• federal budget

REQUIREMENTS:
- Only articles from the past 7 days (today is ${today})
- Reputable sources only: major newspapers, wire services, political outlets
- Focus on legislative action and policy developments

For each article, provide:
- title: The article headline
- summary: A 2-3 sentence summary
- url: The full article URL
- publishedAt: Publication date (ISO format YYYY-MM-DD)
- source: Publisher name
- category: Most relevant category`;

      console.log('[Perplexity] Making request with interests:', interests);

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: 'system',
              content: `You are a news research assistant. Search for recent policy news and return results in the exact JSON format requested. Today is ${today}. Only include articles from the past 7 days.`
            },
            {
              role: 'user',
              content: searchPrompt
            }
          ],
          max_tokens: 4096,
          temperature: 0.1,
          return_images: true, // Get real images from search results
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'news_response',
              schema: jsonSchema,
              strict: true
            }
          }
        })
      });

      console.log('[Perplexity] Response status:', response.status);

      expect(response.ok).toBe(true);

      const result = await response.json();
      console.log('[Perplexity] Raw response:', JSON.stringify(result, null, 2).slice(0, 500));

      expect(result.choices).toBeDefined();
      expect(result.choices.length).toBeGreaterThan(0);
      expect(result.choices[0].message).toBeDefined();
      expect(result.choices[0].message.content).toBeDefined();

      // Check search_results and images from API response
      console.log('[Perplexity] search_results count:', result.search_results?.length || 0);
      console.log('[Perplexity] images count:', result.images?.length || 0);

      // Verify images array has real URLs
      if (result.images && result.images.length > 0) {
        console.log('[Perplexity] First image:', {
          image_url: result.images[0].image_url?.slice(0, 60),
          origin_url: result.images[0].origin_url?.slice(0, 60),
          dimensions: `${result.images[0].width}x${result.images[0].height}`
        });

        // Verify image URL is a real https URL
        expect(result.images[0].image_url).toMatch(/^https?:\/\//);
      }

      // Parse the JSON content
      const content = result.choices[0].message.content;
      const parsed = JSON.parse(content);

      console.log('[Perplexity] Parsed articles count:', parsed.articles?.length);

      expect(parsed.articles).toBeDefined();
      expect(Array.isArray(parsed.articles)).toBe(true);

      if (parsed.articles.length > 0) {
        const article = parsed.articles[0];
        console.log('[Perplexity] First article:', {
          title: article.title?.slice(0, 50),
          source: article.source,
          category: article.category,
          publishedAt: article.publishedAt
        });

        expect(article.title).toBeDefined();
        expect(article.summary).toBeDefined();
        expect(article.url).toBeDefined();
        expect(article.source).toBeDefined();
      }
    }, 60000); // 60 second timeout for API call

    test.skipIf(!runTests)('should search for state-specific news', async () => {
      const state = 'WI';
      const today = new Date().toISOString().split('T')[0];

      const searchPrompt = `Search for the 3 most recent news articles about education policy affecting Wisconsin residents.

REQUIREMENTS:
- Only articles from the past 7 days (today is ${today})
- Include both federal education policy and Wisconsin-specific education news
- Focus on K-12 education, college affordability, and school funding

Return as JSON with articles array containing: title, summary, url, publishedAt, source, category.`;

      console.log('[Perplexity WI] Making state-specific request');

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: 'system',
              content: `You are a news research assistant. Search for recent policy news. Today is ${today}.`
            },
            {
              role: 'user',
              content: searchPrompt
            }
          ],
          max_tokens: 2048,
          temperature: 0.1,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'news_response',
              schema: {
                type: 'object',
                properties: {
                  articles: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        summary: { type: 'string' },
                        url: { type: 'string' },
                        publishedAt: { type: 'string' },
                        source: { type: 'string' },
                        category: { type: 'string' }
                      },
                      required: ['title', 'summary', 'url', 'publishedAt', 'source', 'category']
                    }
                  }
                },
                required: ['articles']
              },
              strict: true
            }
          }
        })
      });

      expect(response.ok).toBe(true);

      const result = await response.json();
      const content = result.choices[0]?.message?.content;

      if (content) {
        const parsed = JSON.parse(content);
        console.log(`[Perplexity WI] Found ${parsed.articles?.length || 0} education articles for ${state}`);

        if (parsed.articles?.length > 0) {
          parsed.articles.forEach((article: any, i: number) => {
            console.log(`  ${i + 1}. ${article.title?.slice(0, 60)}... (${article.source})`);
          });
        }
      }
    }, 60000);
  });

  describe('researchTopic', () => {
    test.skipIf(!runTests)('should research a specific policy topic', async () => {
      const query = 'What are the current debates around Medicare drug pricing reform?';

      console.log('[Perplexity Research] Researching:', query);

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are a policy research assistant. Provide factual, well-sourced information about U.S. policy and legislation. Return results in JSON format.'
            },
            {
              role: 'user',
              content: `Research the following topic and provide a comprehensive summary: ${query}

Return as JSON with:
- summary: A 3-4 sentence overview
- keyPoints: Array of 4-6 key points
- sources: Array of {title, url} for cited sources
- analysis: Expert perspectives and implications`
            }
          ],
          max_tokens: 2048,
          temperature: 0.2,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'research_response',
              schema: {
                type: 'object',
                properties: {
                  summary: { type: 'string' },
                  keyPoints: { type: 'array', items: { type: 'string' } },
                  sources: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        url: { type: 'string' }
                      },
                      required: ['title', 'url']
                    }
                  },
                  analysis: { type: 'string' }
                },
                required: ['summary', 'keyPoints', 'sources']
              },
              strict: true
            }
          }
        })
      });

      expect(response.ok).toBe(true);

      const result = await response.json();
      const content = result.choices[0]?.message?.content;

      expect(content).toBeDefined();

      const parsed = JSON.parse(content);
      console.log('[Perplexity Research] Summary:', parsed.summary?.slice(0, 200));
      console.log('[Perplexity Research] Key points:', parsed.keyPoints?.length);
      console.log('[Perplexity Research] Sources:', parsed.sources?.length);

      expect(parsed.summary).toBeDefined();
      expect(parsed.keyPoints).toBeDefined();
      expect(Array.isArray(parsed.keyPoints)).toBe(true);
      expect(parsed.keyPoints.length).toBeGreaterThan(0);
    }, 60000);
  });
});

// Basic test to ensure test setup works
test('test setup is working', () => {
  expect(true).toBe(true);
  if (!PERPLEXITY_API_KEY) {
    console.log('[Perplexity] PERPLEXITY_API_KEY not set - skipping integration tests');
  }
});
