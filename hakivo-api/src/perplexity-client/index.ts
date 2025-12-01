import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * News article response from Perplexity search
 */
export interface NewsArticle {
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  source: string;
  category: string;
  image: {
    url: string | null;
    alt: string | null;
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
- image.url: The article's featured image URL if available (null otherwise)
- image.alt: Image description (null if no image)

Prioritize articles with clear policy implications and citizen impact.`;

    // JSON schema for structured output
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
              category: { type: 'string' },
              image: {
                type: 'object',
                properties: {
                  url: { type: ['string', 'null'] },
                  alt: { type: ['string', 'null'] }
                },
                required: ['url', 'alt']
              }
            },
            required: ['title', 'summary', 'url', 'publishedAt', 'source', 'category', 'image']
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
      };

      // Parse the JSON response
      const content = result.choices?.[0]?.message?.content;
      if (!content) {
        console.warn('[PERPLEXITY] No content in response');
        return [];
      }

      const parsed = JSON.parse(content) as PerplexityNewsResponse;

      console.log(`[PERPLEXITY] Found ${parsed.articles?.length || 0} articles`);

      // Validate and return articles
      const articles = (parsed.articles || []).slice(0, limit).map(article => ({
        title: article.title || 'Untitled',
        summary: article.summary || 'No summary available',
        url: article.url || '',
        publishedAt: article.publishedAt || new Date().toISOString(),
        source: article.source || 'Unknown',
        category: article.category || 'Other',
        image: {
          url: article.image?.url || null,
          alt: article.image?.alt || null
        }
      }));

      return articles;

    } catch (error) {
      console.error('[PERPLEXITY] Search error:', error);
      throw new Error(`Perplexity search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
