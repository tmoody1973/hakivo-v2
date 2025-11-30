import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import Exa from 'exa-js';

// Multi-query mapping for policy interests - more specific queries per category
const INTEREST_QUERY_MAP: Record<string, string[]> = {
  'Environment & Energy': [
    'climate bill Congress 2025',
    'EPA clean air regulation legislation',
    'renewable energy solar wind bill Congress'
  ],
  'Health & Social Welfare': [
    'Medicare Medicaid bill Congress 2025',
    'mental health legislation funding Congress',
    'healthcare reform bill vote Congress'
  ],
  'Economy & Finance': [
    'federal budget Congress 2025',
    'tax bill legislation Congress vote',
    'debt ceiling spending bill Congress'
  ],
  'Immigration': [
    'immigration bill Congress 2025',
    'border security legislation vote',
    'visa immigration reform Congress'
  ],
  'Education': [
    'education funding bill Congress 2025',
    'student loan legislation Congress',
    'school education reform bill vote'
  ],
  'National Security & Defense': [
    'defense bill Congress 2025',
    'military funding legislation vote',
    'national security authorization Congress'
  ],
  'Technology & Innovation': [
    'AI regulation bill Congress 2025',
    'tech antitrust legislation Congress',
    'data privacy bill vote Congress'
  ],
  'Civil Rights & Justice': [
    'civil rights bill Congress 2025',
    'criminal justice reform legislation',
    'voting rights bill Congress vote'
  ],
  'Infrastructure & Transportation': [
    'infrastructure bill Congress 2025',
    'transportation funding legislation',
    'highway bridge bill Congress vote'
  ],
  'Agriculture & Food': [
    'farm bill Congress 2025',
    'agriculture funding legislation',
    'food safety bill Congress vote'
  ]
};

// Default queries for general policy news
const DEFAULT_QUERIES = [
  'Congress bill legislation 2025',
  'federal policy vote Congress',
  'House Senate bill passed 2025'
];

export default class extends Service<Env> {
  private exa: Exa | null = null;

  /**
   * Initialize Exa client
   */
  private getExaClient(): Exa {
    if (!this.exa) {
      const apiKey = this.env.EXA_API_KEY;

      if (!apiKey) {
        throw new Error('EXA_API_KEY environment variable is not set');
      }

      this.exa = new Exa(apiKey);
    }

    return this.exa;
  }

  /**
   * Generate queries for user interests
   * Uses predefined query sets for known interests, generates custom queries for others
   */
  private getQueriesForInterests(interests: string[]): string[] {
    const queries: string[] = [];

    if (interests.length === 0) {
      return DEFAULT_QUERIES;
    }

    for (const interest of interests) {
      // Check if we have predefined queries for this interest
      const predefinedQueries = INTEREST_QUERY_MAP[interest];
      if (predefinedQueries) {
        queries.push(...predefinedQueries);
      } else {
        // Generate custom queries for unknown interests
        queries.push(
          `${interest} bill Congress 2025`,
          `${interest} legislation vote Congress`,
          `${interest} federal policy Congress`
        );
      }
    }

    return queries;
  }

  /**
   * Filter out landing pages and non-article content
   */
  private filterResults(results: Array<{
    title?: string;
    url: string;
    author?: string;
    publishedDate?: string;
    summary?: string;
    text?: string;
    image?: string;
    score?: number;
  }>): Array<{
    title: string;
    url: string;
    author: string | null;
    publishedDate: string;
    summary: string;
    text: string;
    imageUrl: string | null;
    score: number;
  }> {
    const landingPagePatterns = [
      /\/$/, // Ends with /
      /\/category\//,
      /\/tag\//,
      /\/topics?\//,
      /\/section\//,
      /\/author\//,
      /index\.html$/
    ];

    return results
      .filter(result => {
        // Must have a published date (landing pages often don't)
        if (!result.publishedDate) return false;

        // Must have substantial text content (at least 300 chars)
        if (!result.text || result.text.length < 300) return false;

        // Exclude URLs that look like landing pages
        if (landingPagePatterns.some(p => p.test(result.url))) return false;

        return true;
      })
      .map(result => ({
        title: result.title || 'Untitled',
        url: result.url,
        author: result.author || null,
        publishedDate: result.publishedDate || new Date().toISOString(),
        summary: result.summary || 'No summary available',
        text: result.text || '',
        imageUrl: result.image || null,
        score: result.score || 0
      }));
  }

  /**
   * Search for news articles relevant to policy interests
   * Uses multiple narrower queries per interest and dedupes for better coverage
   *
   * @param interests - User's policy interests
   * @param startDate - Start date for news search (optional - defaults to 7 days ago)
   * @param endDate - End date for news search (optional - defaults to now)
   * @param limit - Number of results (default: 10)
   * @returns News articles with summaries
   */
  async searchNews(
    interests: string[],
    startDate?: Date,
    endDate?: Date,
    limit: number = 10
  ): Promise<Array<{
    title: string;
    url: string;
    author: string | null;
    publishedDate: string;
    summary: string;
    text: string;
    imageUrl: string | null;
    score: number;
  }>> {
    const client = this.getExaClient();

    // Calculate dynamic date range - last 7 days by default
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const searchStartDate = startDate || sevenDaysAgo;
    const searchEndDate = endDate || now;

    // Get queries for user interests
    const queries = this.getQueriesForInterests(interests);
    console.log(`✓ Running ${queries.length} queries for interests: ${interests.join(', ') || 'general'}`);

    // Dedupe by URL
    const seenUrls = new Set<string>();
    const allResults: Array<{
      title?: string;
      url: string;
      author?: string;
      publishedDate?: string;
      summary?: string;
      text?: string;
      image?: string;
      score?: number;
    }> = [];

    // Search options - using deep search for more thorough results
    const searchOptions = {
      numResults: 25,
      text: true as const,
      type: 'deep' as const,
      category: 'news' as const,
      summary: {
        query: 'create a plain english 2 sentence summary easy to understand'
      },
      startPublishedDate: searchStartDate.toISOString(),
      endPublishedDate: searchEndDate.toISOString(),
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
    };

    try {
      // Run queries and collect results
      for (const query of queries) {
        try {
          console.log(`  → Searching: "${query}"`);
          const response = await client.searchAndContents(query, searchOptions);

          for (const result of response.results) {
            if (!seenUrls.has(result.url)) {
              seenUrls.add(result.url);
              allResults.push({
                title: result.title ?? undefined,
                url: result.url,
                author: result.author ?? undefined,
                publishedDate: result.publishedDate ?? undefined,
                summary: result.summary ?? undefined,
                text: result.text ?? undefined,
                image: result.image ?? undefined,
                score: result.score ?? undefined
              });
            }
          }

          console.log(`    Found ${response.results.length} results (${allResults.length} unique total)`);
        } catch (queryError) {
          console.error(`  ✗ Query failed: "${query}"`, queryError);
          // Continue with other queries
        }
      }

      console.log(`✓ Exa news search complete: ${allResults.length} unique articles found`);

      // Filter and format results
      const filteredResults = this.filterResults(allResults);
      console.log(`✓ After filtering: ${filteredResults.length} actual articles`);

      // Sort by score and limit
      return filteredResults
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error('Exa search error:', error);
      throw new Error(`Exa search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for articles on a specific topic
   * General-purpose search method
   *
   * @param query - Search query
   * @param limit - Number of results (default: 10)
   * @param category - Content category (news, company, research paper, etc.)
   * @returns Search results
   */
  async search(
    query: string,
    limit: number = 10,
    category?: 'news' | 'company' | 'research paper' | 'tweet' | 'github' | 'pdf'
  ): Promise<Array<{
    title: string;
    url: string;
    author: string | null;
    publishedDate: string | null;
    score: number;
  }>> {
    const client = this.getExaClient();

    try {
      const response = await client.search(query, {
        numResults: limit,
        type: 'neural',
        category
      });

      return response.results.map(result => ({
        title: result.title || 'Untitled',
        url: result.url,
        author: result.author || null,
        publishedDate: result.publishedDate || null,
        score: result.score || 0
      }));
    } catch (error) {
      console.error('Exa search error:', error);
      throw new Error(`Exa search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find similar content to a given URL
   * Useful for finding related articles
   *
   * @param url - URL to find similar content for
   * @param limit - Number of results (default: 5)
   * @returns Similar content
   */
  async findSimilar(
    url: string,
    limit: number = 5
  ): Promise<Array<{
    title: string;
    url: string;
    score: number;
  }>> {
    const client = this.getExaClient();

    try {
      const response = await client.findSimilar(url, {
        numResults: limit
      });

      return response.results.map(result => ({
        title: result.title || 'Untitled',
        url: result.url,
        score: result.score || 0
      }));
    } catch (error) {
      console.error('Exa findSimilar error:', error);
      throw new Error(`Exa findSimilar failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
