import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * News article response from Perplexity search
 * Images come from Perplexity's search_results and images arrays (return_images: true)
 */
export interface NewsArticle {
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  source: string;
  category: string;
  image?: {
    url: string;
    width?: number;
    height?: number;
  };
}

/**
 * Perplexity API response schema for news search
 */
interface PerplexityNewsResponse {
  articles: NewsArticle[];
}

/**
 * Interest-to-query mapping for targeted Perplexity searches
 * Maps user-friendly interest names to specific search terms and context
 */
const INTEREST_PROMPTS: Record<string, {
  searchTerms: string[];
  context: string;
  topics: string[];
}> = {
  'Commerce & Labor': {
    searchTerms: ['labor policy', 'worker rights', 'business regulation', 'trade policy', 'employment law'],
    context: 'labor unions, minimum wage, worker safety, trade deals, business incentives, job market policies',
    topics: ['Labor rights', 'Trade policy', 'Business regulation', 'Employment']
  },
  'Education & Science': {
    searchTerms: ['education policy', 'school funding', 'STEM research', 'student loans', 'higher education'],
    context: 'K-12 education, college affordability, research grants, STEM initiatives, school choice, teacher policy',
    topics: ['Education reform', 'School funding', 'Student debt', 'Research policy']
  },
  'Economy & Finance': {
    searchTerms: ['economic policy', 'federal budget', 'tax legislation', 'banking regulation', 'inflation policy'],
    context: 'tax reform, federal spending, debt ceiling, Federal Reserve, financial regulation, economic stimulus',
    topics: ['Tax policy', 'Federal budget', 'Banking', 'Economic growth']
  },
  'Environment & Energy': {
    searchTerms: ['climate policy', 'clean energy', 'environmental regulation', 'carbon emissions', 'renewable energy'],
    context: 'climate change legislation, EPA regulations, green energy incentives, fossil fuel policy, conservation',
    topics: ['Climate action', 'Clean energy', 'Environmental protection', 'Energy independence']
  },
  'Health & Social Welfare': {
    searchTerms: ['healthcare policy', 'Medicare Medicaid', 'public health', 'drug pricing', 'social services'],
    context: 'healthcare reform, prescription drug costs, mental health policy, social safety net, health insurance',
    topics: ['Healthcare access', 'Drug pricing', 'Medicare/Medicaid', 'Public health']
  },
  'Defense & Security': {
    searchTerms: ['defense policy', 'military spending', 'national security', 'cybersecurity', 'veterans affairs'],
    context: 'military budget, foreign threats, homeland security, defense contracts, veteran benefits',
    topics: ['Military spending', 'National security', 'Veterans', 'Cybersecurity']
  },
  'Immigration': {
    searchTerms: ['immigration policy', 'border security', 'visa reform', 'asylum policy', 'DACA'],
    context: 'border policy, deportation, work visas, refugee programs, immigration courts, pathway to citizenship',
    topics: ['Border security', 'Immigration reform', 'Asylum', 'Work visas']
  },
  'Foreign Affairs': {
    searchTerms: ['foreign policy', 'international relations', 'diplomatic policy', 'sanctions', 'foreign aid'],
    context: 'international diplomacy, trade agreements, foreign aid, sanctions, NATO, international conflicts',
    topics: ['Diplomacy', 'Foreign aid', 'Trade deals', 'International relations']
  },
  'Government': {
    searchTerms: ['government reform', 'federal agencies', 'election policy', 'executive orders', 'bureaucracy'],
    context: 'government efficiency, agency regulations, election laws, federal appointments, administrative reform',
    topics: ['Government reform', 'Elections', 'Federal agencies', 'Executive actions']
  },
  'Civil Rights': {
    searchTerms: ['civil rights', 'voting rights', 'discrimination law', 'equality legislation', 'justice reform'],
    context: 'voting access, anti-discrimination, criminal justice reform, LGBTQ+ rights, disability rights',
    topics: ['Voting rights', 'Equal rights', 'Justice reform', 'Anti-discrimination']
  }
};

/**
 * Perplexity API Client Service
 *
 * Uses Perplexity's Sonar Pro model with structured JSON output
 * for fetching real-time news articles matching user interests.
 *
 * Key features:
 * - Interest-specific prompt templates for targeted searches
 * - Real-time web search with citations
 * - Structured JSON output for reliable parsing
 * - Multi-step reasoning for complex queries
 *
 * @see https://docs.perplexity.ai/api-reference/chat-completions
 */
export default class extends Service<Env> {
  private readonly API_URL = 'https://api.perplexity.ai/chat/completions';
  private readonly MODEL = 'sonar-pro';

  /**
   * Search for news articles based on policy interests and optional state
   * Returns structured JSON with news articles, images, and citations
   *
   * @param interests - User's policy interests (e.g., ["Health & Social Welfare", "Education"])
   * @param state - Optional state abbreviation for local news (e.g., "WI")
   * @param limit - Number of articles to return (default: 10)
   * @returns Array of news articles with structured metadata
   */
  async searchNews(
    interests: string[],
    state?: string | null,
    limit: number = 10
  ): Promise<NewsArticle[]> {
    const apiKey = this.env.PERPLEXITY_API_KEY;

    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY environment variable is not set');
    }

    // Build the search query using interest-specific templates
    const today = new Date().toISOString().split('T')[0];

    // Gather search terms and context from interest templates
    const searchTerms: string[] = [];
    const contexts: string[] = [];
    const allTopics: string[] = [];

    for (const interest of interests.slice(0, 5)) {
      const template = INTEREST_PROMPTS[interest];
      if (template) {
        searchTerms.push(...template.searchTerms.slice(0, 2)); // Top 2 terms per interest
        contexts.push(template.context);
        allTopics.push(...template.topics.slice(0, 2)); // Top 2 topics per interest
      } else {
        // Fallback for unknown interests
        searchTerms.push(interest.toLowerCase());
      }
    }

    // Dedupe and format
    const uniqueTerms = [...new Set(searchTerms)].slice(0, 8);
    const uniqueTopics = [...new Set(allTopics)].slice(0, 6);
    const contextStr = contexts.slice(0, 3).join('; ');

    const locationContext = state
      ? `\n\nIMPORTANT: Include news specifically relevant to ${state} and how federal policies affect ${state} residents.`
      : '';

    // Build a targeted search prompt using the templates
    const searchPrompt = `Search for the ${limit} most recent and important news articles from the past 7 days about U.S. policy and legislation.

SEARCH FOCUS - Find news about:
${uniqueTerms.map(t => `• ${t}`).join('\n')}

TOPICS TO COVER:
${uniqueTopics.map(t => `• ${t}`).join('\n')}

CONTEXT: ${contextStr}${locationContext}

REQUIREMENTS:
- Only articles from the past 7 days (today is ${today})
- Reputable sources only: major newspapers (NYT, WaPo, WSJ), wire services (AP, Reuters), political outlets (Politico, The Hill, Roll Call, Axios), public media (NPR, PBS)
- Focus on legislative action, policy analysis, and political developments
- Include both federal and state-level developments when relevant

For each article, provide:
- title: The article headline
- summary: A 2-3 sentence summary in plain English explaining why this matters
- url: The full article URL (must be a real, accessible URL)
- publishedAt: Publication date (ISO format YYYY-MM-DD)
- source: Publisher name
- category: Most relevant category from: Congress, Healthcare, Education, Economy, Environment, Immigration, Defense, Civil Rights, Labor, Other

Prioritize articles with clear policy implications and citizen impact.`;

    // JSON schema for structured output (no images - Perplexity hallucinates image URLs)
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

    try {
      console.log(`[PERPLEXITY] Searching news for interests: ${interests.join(', ')}${state ? ` (${state})` : ''}`);
      console.log(`[PERPLEXITY] Search terms: ${uniqueTerms.join(', ')}`);

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages: [
            {
              role: 'system',
              content: `You are a news research assistant. Search for recent policy news and return results in the exact JSON format requested. Today is ${today}. Only include articles from the past 7 days. Prioritize accuracy and cite only verifiable news sources.`
            },
            {
              role: 'user',
              content: searchPrompt
            }
          ],
          max_tokens: 4096,
          temperature: 0.1, // Low temperature for factual accuracy
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[PERPLEXITY] API error: ${response.status} - ${errorText}`);
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const result = await response.json() as {
        choices: Array<{
          message: {
            content: string;
          };
        }>;
        citations?: string[];
        search_results?: Array<{
          title: string;
          url: string;
          date?: string;
          snippet?: string;
        }>;
        images?: Array<{
          image_url: string;
          origin_url: string;
          height?: number;
          width?: number;
          title?: string;
        }>;
      };

      // Parse the JSON response
      const content = result.choices?.[0]?.message?.content;
      if (!content) {
        console.warn('[PERPLEXITY] No content in response');
        return [];
      }

      const parsed = JSON.parse(content) as PerplexityNewsResponse;

      console.log(`[PERPLEXITY] Found ${parsed.articles?.length || 0} AI-generated articles`);
      console.log(`[PERPLEXITY] Search results: ${result.search_results?.length || 0}, Citations: ${result.citations?.length || 0}, Images: ${result.images?.length || 0}`);

      // PRIORITY: Use search_results from Perplexity as source of truth for URLs
      // These are REAL search results, not AI-generated content
      const searchResultsMap = new Map<string, { title: string; url: string; date?: string; snippet?: string }>();
      if (result.search_results && result.search_results.length > 0) {
        for (const sr of result.search_results) {
          if (sr.url) {
            // Normalize URL for matching
            const normalizedUrl = sr.url.replace(/\/$/, '').toLowerCase();
            searchResultsMap.set(normalizedUrl, sr);
          }
        }
        console.log(`[PERPLEXITY] Built search results map with ${searchResultsMap.size} entries`);
      }

      // Build a map of origin URLs to images for matching
      const imagesByOrigin = new Map<string, { url: string; width?: number; height?: number }>();
      if (result.images) {
        for (const img of result.images) {
          if (img.origin_url && img.image_url) {
            // Normalize URL for matching (remove trailing slashes, protocol)
            const normalizedOrigin = img.origin_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
            imagesByOrigin.set(normalizedOrigin, {
              url: img.image_url,
              width: img.width,
              height: img.height
            });
          }
        }
      }

      // Helper to find image for an article URL
      const findImageForUrl = (articleUrl: string) => {
        if (!articleUrl) return undefined;
        const normalizedUrl = articleUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

        // Exact match
        if (imagesByOrigin.has(normalizedUrl)) {
          return imagesByOrigin.get(normalizedUrl);
        }

        // Try domain match (for cases where URL paths differ slightly)
        const articleDomain = normalizedUrl.split('/')[0];
        if (articleDomain) {
          for (const [originUrl, imgData] of imagesByOrigin) {
            if (originUrl.startsWith(articleDomain)) {
              return imgData;
            }
          }
        }

        return undefined;
      };

      // Helper to extract source domain from URL
      const extractSource = (url: string): string => {
        try {
          const domain = new URL(url).hostname.replace('www.', '');
          // Map common domains to readable names
          const sourceMap: Record<string, string> = {
            'nytimes.com': 'New York Times',
            'washingtonpost.com': 'Washington Post',
            'politico.com': 'Politico',
            'thehill.com': 'The Hill',
            'apnews.com': 'AP News',
            'reuters.com': 'Reuters',
            'npr.org': 'NPR',
            'axios.com': 'Axios',
            'rollcall.com': 'Roll Call',
            'wsj.com': 'Wall Street Journal',
            'cnn.com': 'CNN',
            'nbcnews.com': 'NBC News',
            'abcnews.go.com': 'ABC News',
            'cbsnews.com': 'CBS News',
            'foxnews.com': 'Fox News',
            'pbs.org': 'PBS',
            'bbc.com': 'BBC',
            'theguardian.com': 'The Guardian',
            'usatoday.com': 'USA Today'
          };
          return sourceMap[domain] || domain;
        } catch {
          return 'Unknown';
        }
      };

      // STRATEGY: Build articles from search_results when available, enhanced with AI summaries
      // This ensures we have REAL URLs from Perplexity's actual search, not AI hallucinations
      let articles: NewsArticle[] = [];

      if (searchResultsMap.size > 0) {
        console.log(`[PERPLEXITY] Using search_results as primary source for article URLs`);

        // Build articles from search_results, matching with AI summaries where possible
        const aiArticlesByUrl = new Map<string, any>();
        for (const aiArticle of (parsed.articles || [])) {
          if (aiArticle.url) {
            const normalizedUrl = aiArticle.url.replace(/\/$/, '').toLowerCase();
            aiArticlesByUrl.set(normalizedUrl, aiArticle);
          }
        }

        // Iterate through REAL search results
        for (const [normalizedUrl, sr] of searchResultsMap) {
          // Try to find matching AI article for richer summary
          const aiArticle = aiArticlesByUrl.get(normalizedUrl);

          const image = findImageForUrl(sr.url);
          articles.push({
            title: sr.title || aiArticle?.title || 'Untitled',
            summary: aiArticle?.summary || sr.snippet || 'No summary available',
            url: sr.url, // Use REAL URL from search_results
            publishedAt: sr.date || aiArticle?.publishedAt || new Date().toISOString(),
            source: extractSource(sr.url),
            category: aiArticle?.category || 'Other',
            ...(image && { image })
          });
        }

        articles = articles.slice(0, limit);
        console.log(`[PERPLEXITY] Built ${articles.length} articles from search_results`);
      } else {
        // Fallback: use AI-generated articles (original behavior)
        console.log(`[PERPLEXITY] No search_results available, using AI-generated articles`);
        articles = (parsed.articles || []).slice(0, limit).map(article => {
          const image = findImageForUrl(article.url);
          return {
            title: article.title || 'Untitled',
            summary: article.summary || 'No summary available',
            url: article.url || '',
            publishedAt: article.publishedAt || new Date().toISOString(),
            source: article.source || 'Unknown',
            category: article.category || 'Other',
            ...(image && { image })
          };
        });
      }

      // Filter out fake/error articles that Perplexity returns when it can't find real news
      // This happens because strict JSON schema forces it to return SOMETHING even if no news found
      const validArticles = articles.filter(article => {
        const titleLower = article.title.toLowerCase();
        const summaryLower = article.summary.toLowerCase();

        // Check for error-like patterns in title or summary
        const looksLikeError =
          titleLower.includes('unable to retrieve') ||
          titleLower.includes('cannot be provided') ||
          titleLower.includes('no articles found') ||
          titleLower.includes('not currently possible') ||
          titleLower.includes('unable to find') ||
          titleLower.includes('could not find') ||
          summaryLower.includes('unable to retrieve') ||
          summaryLower.includes('cannot be provided') ||
          summaryLower.includes('it is not currently possible') ||
          summaryLower.includes('no recent articles');

        // Check for invalid URLs
        const hasValidUrl =
          article.url &&
          article.url !== '' &&
          article.url !== 'Unknown' &&
          article.url.startsWith('http');

        // Check for placeholder sources
        const hasValidSource =
          article.source !== 'Unknown' &&
          article.source !== '';

        if (looksLikeError) {
          console.log(`[PERPLEXITY] Filtered out error article: "${article.title.substring(0, 50)}..."`);
          return false;
        }

        if (!hasValidUrl) {
          console.log(`[PERPLEXITY] Filtered out article with invalid URL: "${article.title.substring(0, 50)}..."`);
          return false;
        }

        if (!hasValidSource) {
          console.log(`[PERPLEXITY] Filtered out article with invalid source: "${article.title.substring(0, 50)}..."`);
          return false;
        }

        return true;
      });

      console.log(`[PERPLEXITY] Returning ${validArticles.length} valid articles (filtered ${articles.length - validArticles.length} invalid)`);
      return validArticles;

    } catch (error) {
      console.error('[PERPLEXITY] Search error:', error);
      throw new Error(`Perplexity search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Simple search for headlines with minimal structure
   * Used for quick news searches without full interest mapping
   *
   * @param params - Search parameters
   * @param params.query - Search query string
   * @param params.maxResults - Maximum number of results to return (default: 5)
   * @returns Search results with headlines and URLs
   */
  async search(params: {
    query: string;
    maxResults?: number;
  }): Promise<{
    results: Array<{
      headline: string;
      url: string;
      summary: string;
      publishedAt: string;
    }>;
  }> {
    const { query, maxResults = 5 } = params;
    const apiKey = this.env.PERPLEXITY_API_KEY;

    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY environment variable is not set');
    }

    const today = new Date().toISOString().split('T')[0];

    const jsonSchema = {
      type: 'object',
      properties: {
        articles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              headline: { type: 'string' },
              url: { type: 'string' },
              summary: { type: 'string' },
              publishedAt: { type: 'string' }
            },
            required: ['headline', 'url', 'summary', 'publishedAt']
          }
        }
      },
      required: ['articles']
    };

    try {
      console.log(`[PERPLEXITY] Searching: ${query}`);

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages: [
            {
              role: 'system',
              content: `You are a news research assistant. Search for recent news and return results in the exact JSON format requested. Today is ${today}. Only include articles from the past 7 days.`
            },
            {
              role: 'user',
              content: `Find ${maxResults} recent news articles matching this search: ${query}

Return as JSON with an "articles" array. For each article:
- headline: The article headline
- url: The full article URL (must be a real, accessible URL)
- summary: A 1-2 sentence summary
- publishedAt: Publication date (ISO format YYYY-MM-DD)`
            }
          ],
          max_tokens: 2048,
          temperature: 0.1,
          return_images: false,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'search_response',
              schema: jsonSchema,
              strict: true
            }
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[PERPLEXITY] Search error: ${response.status} - ${errorText}`);
        return { results: [] };
      }

      const result = await response.json() as {
        choices: Array<{ message: { content: string } }>;
      };

      const content = result.choices?.[0]?.message?.content;
      if (!content) {
        console.warn('[PERPLEXITY] No content in search response');
        return { results: [] };
      }

      const parsed = JSON.parse(content) as { articles: Array<{ headline: string; url: string; summary: string; publishedAt: string }> };
      console.log(`[PERPLEXITY] Found ${parsed.articles?.length || 0} articles`);

      return {
        results: (parsed.articles || []).filter(a => a.url && a.url.startsWith('http'))
      };

    } catch (error) {
      console.error('[PERPLEXITY] Search error:', error);
      return { results: [] };
    }
  }

  /**
   * Search for specific policy topic with deeper analysis
   * Uses sonar-pro's multi-step reasoning for complex queries
   *
   * @param query - Specific topic or question to research
   * @param includeAnalysis - Whether to include expert analysis (default: true)
   * @returns Research results with analysis
   */
  async researchTopic(
    query: string,
    includeAnalysis: boolean = true
  ): Promise<{
    summary: string;
    keyPoints: string[];
    sources: Array<{ title: string; url: string }>;
    analysis?: string;
  }> {
    const apiKey = this.env.PERPLEXITY_API_KEY;

    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY environment variable is not set');
    }

    const analysisPrompt = includeAnalysis
      ? ' Include expert analysis and different perspectives on this topic.'
      : '';

    try {
      console.log(`[PERPLEXITY] Researching topic: ${query}`);

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are a policy research assistant. Provide factual, well-sourced information about U.S. policy and legislation. Return results in JSON format.'
            },
            {
              role: 'user',
              content: `Research the following topic and provide a comprehensive summary: ${query}${analysisPrompt}

Return as JSON with:
- summary: A 3-4 sentence overview
- keyPoints: Array of 4-6 key points
- sources: Array of {title, url} for cited sources
${includeAnalysis ? '- analysis: Expert perspectives and implications' : ''}`
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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as {
        choices: Array<{ message: { content: string } }>;
      };

      const content = result.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No content in Perplexity response');
      }

      const parsed = JSON.parse(content);
      console.log(`[PERPLEXITY] Research complete: ${parsed.keyPoints?.length || 0} key points`);

      return {
        summary: parsed.summary || '',
        keyPoints: parsed.keyPoints || [],
        sources: parsed.sources || [],
        analysis: parsed.analysis
      };

    } catch (error) {
      console.error('[PERPLEXITY] Research error:', error);
      throw new Error(`Perplexity research failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Required fetch method for Raindrop Service
   * This is a private service, so fetch returns 501 Not Implemented
   */
  async fetch(_request: Request): Promise<Response> {
    return new Response('Not Implemented - Private Service', { status: 501 });
  }
}
