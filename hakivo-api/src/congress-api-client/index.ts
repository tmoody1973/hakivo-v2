import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

export default class extends Service<Env> {
  private readonly BASE_URL = 'https://api.congress.gov/v3';
  private readonly RATE_LIMIT = 5000; // 5000 requests per hour
  private readonly RATE_LIMIT_WINDOW = 3600000; // 1 hour in milliseconds

  /**
   * Get Congress.gov API key from environment
   */
  private getApiKey(): string {
    const apiKey = this.env.CONGRESS_API_KEY;

    if (!apiKey) {
      throw new Error('CONGRESS_API_KEY environment variable is not set');
    }

    return apiKey;
  }

  /**
   * Make rate-limited request to Congress.gov API
   */
  private async makeRequest(
    endpoint: string,
    params: Record<string, string | number> = {}
  ): Promise<any> {
    const apiKey = this.getApiKey();

    // Build query string
    const queryParams = new URLSearchParams({
      api_key: apiKey,
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      )
    });

    const url = `${this.BASE_URL}${endpoint}?${queryParams}`;

    try {
      const response = await fetch(url);

      if (response.status === 429) {
        throw new Error('Congress.gov rate limit exceeded');
      }

      if (!response.ok) {
        throw new Error(`Congress.gov API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Congress.gov API request error:', error);
      throw new Error(`Congress.gov request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search bills with filters
   * Used by bills-service
   *
   * @param congress - Congress number (e.g., 118)
   * @param limit - Number of results (default: 20)
   * @param offset - Pagination offset (default: 0)
   * @param sort - Sort field and order (default: updateDate:desc)
   * @returns Bill search results
   */
  async searchBills(
    congress: number,
    limit: number = 20,
    offset: number = 0,
    sort: string = 'updateDate:desc'
  ): Promise<any> {
    console.log(`✓ Congress.gov search: ${limit} bills from Congress ${congress}`);

    return await this.makeRequest(`/bill/${congress}`, {
      limit,
      offset,
      sort
    });
  }

  /**
   * Get bill details by congress/type/number
   * Used by bills-service
   *
   * @param congress - Congress number
   * @param type - Bill type (hr, s, hjres, sjres, etc.)
   * @param number - Bill number
   * @returns Bill details
   */
  async getBillDetails(
    congress: number,
    type: string,
    number: number
  ): Promise<any> {
    console.log(`✓ Congress.gov details: ${type}${number} (${congress}th Congress)`);

    return await this.makeRequest(`/bill/${congress}/${type}/${number}`);
  }

  /**
   * Get bill full text from Congress.gov
   * Fetches the latest text version (formatted text if available, otherwise XML)
   *
   * @param congress - Congress number
   * @param type - Bill type (hr, s, hjres, sjres, etc.)
   * @param number - Bill number
   * @returns Bill text as string, or null if not available
   */
  async getBillText(
    congress: number,
    type: string,
    number: number
  ): Promise<string | null> {
    console.log(`✓ Congress.gov text: ${type}${number} (${congress}th Congress)`);

    try {
      // First get the text versions to find the latest
      const textData = await this.makeRequest(`/bill/${congress}/${type}/${number}/text`);

      if (!textData?.textVersions || textData.textVersions.length === 0) {
        console.log(`  No text versions available for ${type}${number}`);
        return null;
      }

      // Get the most recent text version (usually first in list)
      const latestVersion = textData.textVersions[0];

      // Look for formatted text URL (prefer .htm or .txt over .xml)
      let textUrl: string | null = null;
      if (latestVersion.formats) {
        // Prefer formatted text
        const formattedFormat = latestVersion.formats.find((f: any) =>
          f.url?.includes('.htm') || f.type?.toLowerCase() === 'formatted text'
        );
        if (formattedFormat?.url) {
          textUrl = formattedFormat.url;
        } else {
          // Fall back to any available format
          const anyFormat = latestVersion.formats.find((f: any) => f.url);
          if (anyFormat?.url) {
            textUrl = anyFormat.url;
          }
        }
      }

      if (!textUrl) {
        console.log(`  No text URL found for ${type}${number}`);
        return null;
      }

      // Fetch the actual text content
      console.log(`  Fetching text from: ${textUrl}`);
      const textResponse = await fetch(textUrl);

      if (!textResponse.ok) {
        console.log(`  Failed to fetch text: ${textResponse.status}`);
        return null;
      }

      const text = await textResponse.text();

      // If it's HTML, extract just the text content (basic cleanup)
      if (textUrl.includes('.htm')) {
        // Remove HTML tags but keep the structure somewhat readable
        return text
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, '\n')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/\n\s*\n\s*\n/g, '\n\n')
          .trim();
      }

      return text;
    } catch (error) {
      console.error(`  Error fetching bill text for ${type}${number}:`, error);
      return null;
    }
  }

  /**
   * Get bill updates for tracked bills
   * Used by brief-generator observer
   *
   * @param billIds - Array of bill IDs to check
   * @param sinceDate - ISO date string for filtering updates
   * @returns Array of bill updates
   */
  async getBillUpdates(
    billIds: Array<{ congress: number; type: string; number: number }>,
    sinceDate: string
  ): Promise<Array<{
    title: string;
    latestAction: string;
    summary: string;
  }>> {
    const updates: Array<{
      title: string;
      latestAction: string;
      summary: string;
    }> = [];

    // Fetch each bill's latest data
    for (const billId of billIds) {
      try {
        const data = await this.getBillDetails(
          billId.congress,
          billId.type,
          billId.number
        );

        const bill = data.bill;

        // Check if bill was updated since sinceDate
        if (bill.updateDate && bill.updateDate >= sinceDate) {
          updates.push({
            title: bill.title,
            latestAction: bill.latestAction?.text || 'No recent action',
            summary: bill.summary?.text || 'No summary available'
          });
        }
      } catch (error) {
        console.error(`Failed to fetch bill ${billId.type}${billId.number}:`, error);
        // Continue with other bills
      }
    }

    console.log(`✓ Congress.gov updates: ${updates.length} bills updated since ${sinceDate}`);

    return updates;
  }

  /**
   * Get latest Congressional actions
   * Used by dashboard-service
   *
   * @param limit - Number of actions to retrieve (default: 10)
   * @returns Latest actions from Congress
   */
  async getLatestActions(limit: number = 10): Promise<Array<{
    date: string;
    description: string;
    billTitle: string | null;
    chamber: string | null;
  }>> {
    try {
      // Get recent bills to extract their latest actions
      const data = await this.searchBills(118, limit, 0, 'updateDate:desc');

      const actions = data.bills?.map((bill: any) => ({
        date: bill.latestAction?.actionDate || '',
        description: bill.latestAction?.text || '',
        billTitle: bill.title || null,
        chamber: bill.originChamber || null
      })) || [];

      console.log(`✓ Congress.gov actions: ${actions.length} latest actions retrieved`);

      return actions;
    } catch (error) {
      console.error('Failed to fetch latest actions:', error);
      return [];
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
