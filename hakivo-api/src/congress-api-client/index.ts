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
   * Get House roll call votes (BETA endpoint)
   * Note: Senate votes are NOT available via this API
   *
   * @param congress - Congress number (e.g., 118, 119)
   * @param limit - Number of results (default: 50)
   * @param offset - Pagination offset (default: 0)
   * @returns House vote results with pagination
   */
  async getHouseVotes(
    congress: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<any> {
    console.log(`✓ Congress.gov House votes: Congress ${congress}, limit ${limit}, offset ${offset}`);

    return await this.makeRequest(`/house-vote/${congress}`, {
      limit,
      offset
    });
  }

  /**
   * Get specific House vote details with member positions
   *
   * @param congress - Congress number
   * @param rollCallNumber - Roll call vote number
   * @returns Vote details including how each member voted
   */
  async getHouseVoteDetails(
    congress: number,
    rollCallNumber: number
  ): Promise<any> {
    console.log(`✓ Congress.gov House vote details: Roll call ${rollCallNumber} (${congress}th Congress)`);

    // Get the vote details - need to find by rollCallNumber
    const votesData = await this.makeRequest(`/house-vote/${congress}`, {
      limit: 250,
      offset: 0
    });

    // Find the specific vote
    const vote = votesData.houseVotes?.find(
      (v: any) => v.rollCallNumber === rollCallNumber
    );

    if (!vote) {
      throw new Error(`Vote not found: roll call ${rollCallNumber}`);
    }

    return vote;
  }

  /**
   * Get House votes with member positions for a specific member
   * Fetches recent votes and filters to those where the member voted
   * Uses parallel requests with batching for better performance
   *
   * @param bioguideId - Member's bioguide ID
   * @param congress - Congress number (default: 119)
   * @param limit - Number of votes to return (default: 50)
   * @returns Member's voting record
   */
  async getMemberHouseVotes(
    bioguideId: string,
    congress: number = 119,
    limit: number = 50
  ): Promise<{
    votes: Array<{
      rollCallNumber: number;
      voteDate: string;
      voteQuestion: string;
      voteResult: string;
      voteType: string;
      memberVote: string;
      bill?: {
        type: string;
        number: string;
        title?: string;
      };
    }>;
    stats: {
      totalVotes: number;
      yeaVotes: number;
      nayVotes: number;
      presentVotes: number;
      notVotingCount: number;
    };
  }> {
    console.log(`✓ Congress.gov member votes: ${bioguideId} (${congress}th Congress), limit: ${limit}`);

    // Fetch House votes for the congress
    // API returns houseRollCallVotes (not houseVotes)
    const votesData = await this.makeRequest(`/house-vote/${congress}`, {
      limit: Math.min(limit * 2, 250), // Fetch more votes since not all will have this member
      offset: 0
    });

    // The API returns houseRollCallVotes array
    const houseVotes = votesData.houseRollCallVotes || votesData.houseVotes || [];
    console.log(`Found ${houseVotes.length} house votes for Congress ${congress}`);

    const memberVotes: Array<{
      rollCallNumber: number;
      voteDate: string;
      voteQuestion: string;
      voteResult: string;
      voteType: string;
      memberVote: string;
      bill?: {
        type: string;
        number: string;
        title?: string;
      };
    }> = [];

    const stats = {
      totalVotes: 0,
      yeaVotes: 0,
      nayVotes: 0,
      presentVotes: 0,
      notVotingCount: 0
    };

    // Process votes in parallel batches to improve performance
    // Use batch size of 10 to balance speed vs rate limiting
    const BATCH_SIZE = 10;
    const votesToProcess = houseVotes.slice(0, limit);

    for (let i = 0; i < votesToProcess.length; i += BATCH_SIZE) {
      const batch = votesToProcess.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(votesToProcess.length / BATCH_SIZE)}`);

      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(async (vote: any) => {
          try {
            const membersData = await this.makeRequest(
              `/house-vote/${congress}/${vote.sessionNumber}/${vote.rollCallNumber}/members`,
              { limit: 500 }
            );

            // The API returns houseRollCallVoteMemberVotes.results array
            const memberResults = membersData.houseRollCallVoteMemberVotes?.results ||
                                 membersData.members || [];

            // Find this member's vote - API uses bioguideID (uppercase ID)
            const memberVoteRecord = memberResults.find(
              (m: any) => m.bioguideID === bioguideId || m.bioguideId === bioguideId
            );

            if (memberVoteRecord) {
              const voteValue = memberVoteRecord.voteCast || memberVoteRecord.voteOption || 'Not Voting';
              return {
                rollCallNumber: vote.rollCallNumber,
                voteDate: vote.startDate || vote.updateDate,
                voteQuestion: vote.voteTitle || vote.voteType || 'Unknown',
                voteResult: vote.result || 'Unknown',
                voteType: vote.voteType || 'Unknown',
                memberVote: voteValue,
                bill: vote.legislationNumber ? {
                  type: vote.legislationType || '',
                  number: vote.legislationNumber || '',
                  title: vote.legislationTitle
                } : undefined
              };
            }
            return null;
          } catch (error) {
            console.error(`Error fetching vote details for roll call ${vote.rollCallNumber}:`, error);
            return null;
          }
        })
      );

      // Collect successful results
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          const voteRecord = result.value;
          memberVotes.push(voteRecord);

          // Update stats
          stats.totalVotes++;
          const voteValue = voteRecord.memberVote;
          if (voteValue === 'Yea' || voteValue === 'Aye') stats.yeaVotes++;
          else if (voteValue === 'Nay' || voteValue === 'No') stats.nayVotes++;
          else if (voteValue === 'Present') stats.presentVotes++;
          else stats.notVotingCount++;
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < votesToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Found ${memberVotes.length} votes for member ${bioguideId}`);
    return { votes: memberVotes, stats };
  }

  /**
   * Required fetch method for Raindrop Service
   * This is a private service, so fetch returns 501 Not Implemented
   */
  async fetch(_request: Request): Promise<Response> {
    return new Response('Not Implemented - Private Service', { status: 501 });
  }
}
