import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * OpenStates API Client
 *
 * Fetches state legislation data from OpenStates (Plural Policy) API.
 * Rate limits: 500 requests/day, 1 request/sec
 *
 * Key difference from federal bills:
 * - State bills are fetched ON-DEMAND per user's state
 * - AI maps bills to user's personalized interests
 */
export default class extends Service<Env> {
  private readonly GRAPHQL_URL = 'https://v3.openstates.org/graphql';
  private readonly REST_URL = 'https://v3.openstates.org';
  private readonly RATE_LIMIT_MS = 1000; // 1 request per second
  private lastRequestTime = 0;

  /**
   * Get OpenStates API key from environment
   */
  private getApiKey(): string {
    const apiKey = this.env.OPENSTATES_API_KEY;

    if (!apiKey) {
      throw new Error('OPENSTATES_API_KEY environment variable is not set');
    }

    return apiKey;
  }

  /**
   * Rate limit enforcement - ensures 1 request/sec
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.RATE_LIMIT_MS) {
      const delay = this.RATE_LIMIT_MS - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Make GraphQL request to OpenStates
   */
  private async graphqlRequest(query: string, variables: Record<string, any> = {}): Promise<any> {
    await this.enforceRateLimit();

    const apiKey = this.getApiKey();

    try {
      const response = await fetch(this.GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({ query, variables })
      });

      if (response.status === 429) {
        throw new Error('OpenStates rate limit exceeded (500 requests/day)');
      }

      if (!response.ok) {
        throw new Error(`OpenStates API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.errors) {
        throw new Error(`OpenStates GraphQL error: ${JSON.stringify(data.errors)}`);
      }

      return data.data;
    } catch (error) {
      console.error('OpenStates API request error:', error);
      throw new Error(`OpenStates request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Make REST API request to OpenStates
   */
  private async restRequest(endpoint: string, params: Record<string, string | number> = {}): Promise<any> {
    await this.enforceRateLimit();

    const apiKey = this.getApiKey();

    const queryParams = new URLSearchParams({
      apikey: apiKey,
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      )
    });

    const url = `${this.REST_URL}${endpoint}?${queryParams}`;

    try {
      const response = await fetch(url);

      if (response.status === 429) {
        throw new Error('OpenStates rate limit exceeded (500 requests/day)');
      }

      if (!response.ok) {
        throw new Error(`OpenStates API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('OpenStates REST API request error:', error);
      throw new Error(`OpenStates request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search bills by state jurisdiction
   * Returns bills for user's state, optionally filtered by query
   *
   * @param state - State abbreviation (e.g., 'CA', 'TX')
   * @param query - Optional search query
   * @param limit - Number of results (default: 20)
   * @returns Array of state bills
   */
  async searchBillsByState(
    state: string,
    query?: string,
    limit: number = 20
  ): Promise<Array<{
    id: string;
    identifier: string;
    title: string;
    session: string;
    chamber: string;
    latestActionDate: string | null;
    latestActionDescription: string | null;
    subjects: string[];
  }>> {
    console.log(`✓ OpenStates search: ${limit} bills from ${state}${query ? ` (query: ${query})` : ''}`);

    // Use GraphQL for efficient single request
    const graphqlQuery = `
      query SearchBills($jurisdiction: String!, $first: Int!, $searchQuery: String) {
        bills(
          jurisdiction: $jurisdiction
          first: $first
          searchQuery: $searchQuery
          sort: "updated_desc"
        ) {
          edges {
            node {
              id
              identifier
              title
              session {
                identifier
              }
              fromOrganization {
                classification
              }
              latestAction {
                date
                description
              }
              subject
            }
          }
        }
      }
    `;

    const variables: Record<string, any> = {
      jurisdiction: state.toLowerCase(),
      first: limit
    };

    if (query) {
      variables.searchQuery = query;
    }

    const data = await this.graphqlRequest(graphqlQuery, variables);

    return data.bills.edges.map((edge: any) => ({
      id: edge.node.id,
      identifier: edge.node.identifier,
      title: edge.node.title,
      session: edge.node.session?.identifier || '',
      chamber: edge.node.fromOrganization?.classification || '',
      latestActionDate: edge.node.latestAction?.date || null,
      latestActionDescription: edge.node.latestAction?.description || null,
      subjects: edge.node.subject || []
    }));
  }

  /**
   * Get detailed bill information including text versions
   *
   * @param billId - OpenStates bill ID (openstates format)
   * @returns Bill details with text URLs
   */
  async getBillDetails(billId: string): Promise<{
    id: string;
    identifier: string;
    title: string;
    session: string;
    chamber: string;
    abstract: string | null;
    latestActionDate: string | null;
    latestActionDescription: string | null;
    subjects: string[];
    sponsors: Array<{
      name: string;
      classification: string;
    }>;
    textVersions: Array<{
      url: string;
      date: string | null;
      note: string | null;
      mediaType: string | null;
    }>;
  }> {
    console.log(`✓ OpenStates details: ${billId}`);

    const graphqlQuery = `
      query GetBillDetails($id: ID!) {
        bill(id: $id) {
          id
          identifier
          title
          session {
            identifier
          }
          fromOrganization {
            classification
          }
          abstracts {
            abstract
          }
          latestAction {
            date
            description
          }
          subject
          sponsorships {
            name
            classification
          }
          versions {
            links {
              url
              mediaType
            }
            date
            note
          }
        }
      }
    `;

    const data = await this.graphqlRequest(graphqlQuery, { id: billId });
    const bill = data.bill;

    // Extract text version URLs (prefer HTML/text over PDF)
    const textVersions: Array<{
      url: string;
      date: string | null;
      note: string | null;
      mediaType: string | null;
    }> = [];

    if (bill.versions) {
      for (const version of bill.versions) {
        if (version.links) {
          for (const link of version.links) {
            textVersions.push({
              url: link.url,
              date: version.date,
              note: version.note,
              mediaType: link.mediaType
            });
          }
        }
      }
    }

    return {
      id: bill.id,
      identifier: bill.identifier,
      title: bill.title,
      session: bill.session?.identifier || '',
      chamber: bill.fromOrganization?.classification || '',
      abstract: bill.abstracts?.[0]?.abstract || null,
      latestActionDate: bill.latestAction?.date || null,
      latestActionDescription: bill.latestAction?.description || null,
      subjects: bill.subject || [],
      sponsors: bill.sponsorships?.map((s: any) => ({
        name: s.name,
        classification: s.classification
      })) || [],
      textVersions
    };
  }

  /**
   * Fetch bill text from version URL
   * State bills often have PDFs, so we try to get HTML/text if available
   *
   * @param textUrl - URL to bill text
   * @returns Bill text as string, or null if not accessible
   */
  async getBillText(textUrl: string): Promise<string | null> {
    console.log(`  Fetching state bill text from: ${textUrl}`);

    try {
      const response = await fetch(textUrl);

      if (!response.ok) {
        console.log(`  Failed to fetch text: ${response.status}`);
        return null;
      }

      const contentType = response.headers.get('content-type') || '';

      // If it's a PDF, we can't easily extract text in a worker
      if (contentType.includes('pdf')) {
        console.log(`  PDF format - text extraction not supported`);
        return null;
      }

      const text = await response.text();

      // If it's HTML, extract text content
      if (contentType.includes('html') || textUrl.includes('.html') || textUrl.includes('.htm')) {
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
      console.error(`  Error fetching bill text:`, error);
      return null;
    }
  }

  /**
   * Get state legislators by geographic location
   * Used during onboarding to identify user's state representatives
   *
   * @param lat - Latitude
   * @param lng - Longitude
   * @returns Array of state legislators
   */
  async getLegislatorsByLocation(lat: number, lng: number): Promise<Array<{
    id: string;
    name: string;
    party: string;
    chamber: string;
    district: string;
    state: string;
    imageUrl: string | null;
  }>> {
    console.log(`✓ OpenStates legislators: ${lat}, ${lng}`);

    // Use REST API for geo lookup
    const data = await this.restRequest('/people.geo', {
      lat,
      lng
    });

    return data.results?.map((person: any) => ({
      id: person.id,
      name: person.name,
      party: person.party || '',
      chamber: person.current_role?.org_classification || '',
      district: person.current_role?.district || '',
      state: person.jurisdiction?.name || '',
      imageUrl: person.image || null
    })) || [];
  }

  /**
   * Get current legislative session for a state
   *
   * @param state - State abbreviation (e.g., 'CA', 'TX')
   * @returns Current session identifier
   */
  async getCurrentSession(state: string): Promise<string | null> {
    console.log(`✓ OpenStates session: ${state}`);

    const graphqlQuery = `
      query GetJurisdiction($jurisdiction: String!) {
        jurisdiction(name: $jurisdiction) {
          legislativeSessions {
            identifier
            startDate
            endDate
            classification
          }
        }
      }
    `;

    const data = await this.graphqlRequest(graphqlQuery, {
      jurisdiction: state.toLowerCase()
    });

    // Find the current or most recent session
    const sessions = data.jurisdiction?.legislativeSessions || [];
    const today = new Date().toISOString().split('T')[0] as string;

    // Look for current session (has started, hasn't ended)
    for (const session of sessions) {
      if (session.startDate && session.startDate <= today) {
        if (!session.endDate || session.endDate >= today) {
          return session.identifier;
        }
      }
    }

    // Fall back to most recent session
    if (sessions.length > 0) {
      return sessions[0].identifier;
    }

    return null;
  }

  /**
   * Required fetch method for Raindrop Service
   * This is a private service, so fetch returns 501 Not Implemented
   */
  async fetch(_request: Request): Promise<Response> {
    return new Response('Not Implemented - Private Service', { status: 501 });
  }
}
