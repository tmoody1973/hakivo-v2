import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import Exa from 'exa-js';

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
   * Search for news articles relevant to policy interests
   * Used by brief-generator observer
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

    // Calculate dynamic date range - last 14 days by default
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const searchStartDate = startDate || fourteenDaysAgo;
    const searchEndDate = endDate || now;

    // Build search query - simpler approach for better results
    // Use interest/keyword terms with policy context
    const policyTerms = interests.length > 0
      ? interests.map(interest => `"${interest}"`).join(' OR ')
      : 'Congress legislation policy';

    // Keywords that already imply policy context (don't need extra "policy" keyword)
    const policyImpliedKeywords = [
      'HUD', 'affordable housing', 'housing crisis', 'eviction', 'homelessness',
      'Medicaid', 'Medicare', 'immigration', 'border', 'Congress', 'legislation',
      'federal funding', 'federal research'
    ];

    // Check if any of the interests already imply policy context
    const hasPolicyContext = interests.some(interest =>
      policyImpliedKeywords.some(keyword =>
        interest.toLowerCase().includes(keyword.toLowerCase())
      )
    );

    // Lighter exclusions - only exclude clearly off-topic
    const exclusions = '-celebrity -entertainment -sports';

    // Add "policy" keyword only if not already implied by the terms
    const query = hasPolicyContext
      ? `(${policyTerms}) ${exclusions}`
      : `(${policyTerms}) policy ${exclusions}`;

    // Request more results to account for filtering (minimum 25)
    const requestLimit = Math.max(limit, 25);

    try {
      const response = await client.searchAndContents(query, {
        numResults: requestLimit,
        text: true,
        type: 'auto',
        category: 'news',
        summary: {
          query: 'create a plain english 2 sentence summary easy to understand'
        },
        startPublishedDate: searchStartDate.toISOString(),
        endPublishedDate: searchEndDate.toISOString(),
        includeDomains: [
          // Major political news
          'punchbowl.news',
          'politico.com',
          'thehill.com',
          'rollcall.com',
          // Major newspapers
          'nytimes.com',
          'washingtonpost.com',
          'wsj.com',
          'usatoday.com',
          'theguardian.com',
          // Wire services
          'apnews.com',
          'reuters.com',
          // TV news
          'cnn.com',
          'cbsnews.com',
          'abcnews.com',
          'nbcnews.com',
          'foxnews.com',
          // Other quality sources
          'npr.org',
          'axios.com',
          'bbc.com',
          'bloomberg.com',
          // Think tanks & business
          'brookings.edu',
          'businessinsider.com',
          'propublica.org',
          // Education
          'edweek.org',
          // Healthcare
          'kff.org',
          'modernhealthcare.com',
          // Housing
          'shelterforce.org',
          'housingwire.com',
          'nextcity.org',
          'urban.org',
          // General quality journalism
          'vox.com',
          // Agriculture & Food
          'agri-pulse.com',
          'fooddive.com'
        ]
      });

      console.log(`✓ Exa news search: ${response.results.length} articles found`);

      // Filter out landing pages and topic pages (relaxed filter)
      const filteredResults = response.results.filter(result => {
        // Must have a published date (landing pages often don't)
        if (!result.publishedDate) return false;

        // Must have some text content (relaxed to 200 chars)
        if (!result.text || result.text.length < 200) return false;

        // Exclude URLs that look like landing pages or aggregation pages
        const landingPagePatterns = [
          /\/$/, // Ends with /
          /\/category\//,
          /\/tag\//,
          /\/topics?\//,
          /\/section\//,
          /\/author\//,
          /\/news-event\//,  // NYT topic pages
          /\/live\//,        // Live blogs/feeds
          /\/archive\//,
          /\/search/,
          /\?page=/,         // Pagination pages
          /index\.html$/
        ];

        if (landingPagePatterns.some(p => p.test(result.url))) return false;

        // Exclude domain-only URLs and short section pages
        try {
          const url = new URL(result.url);
          if (url.pathname === '/' || url.pathname === '') return false;

          // Filter short-path section pages more carefully
          // Real articles typically have: dates, long slugs, or 3+ segments
          const pathSegments = url.pathname.split('/').filter(s => s.length > 0);

          if (pathSegments.length <= 2) {
            const lastSegment = pathSegments[pathSegments.length - 1] || '';
            const hasDatePattern = /\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(url.pathname);
            const hasLongSlug = lastSegment.length > 25; // Real article titles are long

            // Allow if it has a date or long slug, otherwise filter
            if (!hasDatePattern && !hasLongSlug) return false;
          }
        } catch {
          // Invalid URL, skip
        }

        return true;
      });

      console.log(`✓ After filtering: ${filteredResults.length} actual articles`);

      return filteredResults.map(result => ({
        title: result.title || 'Untitled',
        url: result.url,
        author: result.author || null,
        publishedDate: result.publishedDate || new Date().toISOString(),
        summary: result.summary || 'No summary available',
        text: result.text || '',
        imageUrl: result.image || null,
        score: result.score || 0
      }));
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
