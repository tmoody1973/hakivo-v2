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

    // Calculate dynamic date range - last 7 days by default
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const searchStartDate = startDate || sevenDaysAgo;
    const searchEndDate = endDate || now;

    // Build search query following Exa integration strategy
    const keywordQuery = interests.length > 0 ? interests.join(' OR ') : 'Congress legislation';
    const contextQuery = '(news headline OR article OR bill OR legislation OR law OR congress OR act) site:news headline OR site:article';
    const query = `${keywordQuery} ${contextQuery}`;

    try {
      const response = await client.searchAndContents(query, {
        numResults: limit,
        text: {
          maxCharacters: 500
        },
        type: 'auto',
        category: 'news',
        userLocation: 'US',
        summary: true,
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
      });

      console.log(`✓ Exa news search: ${response.results.length} articles found`);

      return response.results.map(result => ({
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
