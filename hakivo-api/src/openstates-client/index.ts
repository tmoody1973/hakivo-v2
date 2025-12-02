import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * OpenStates API Client
 *
 * Fetches state legislation data from OpenStates (Plural Policy) API v3.
 * Rate limits: 500 requests/day, 1 request/sec
 *
 * Note: GraphQL API (v2) was sunset in December 2023.
 * This client uses the v3 REST API exclusively.
 *
 * Key difference from federal bills:
 * - State bills are fetched ON-DEMAND per user's state
 * - AI maps bills to user's personalized interests
 */
export default class extends Service<Env> {
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
   * Make REST API request to OpenStates
   * Supports array values for repeated query params (e.g., include=a&include=b)
   */
  private async restRequest(endpoint: string, params: Record<string, string | number | string[]> = {}): Promise<any> {
    await this.enforceRateLimit();

    const apiKey = this.getApiKey();

    const queryParams = new URLSearchParams();
    queryParams.set('apikey', apiKey);

    // Handle array values as repeated query params
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          queryParams.append(key, v);
        }
      } else {
        queryParams.set(key, String(value));
      }
    }

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

    // Build REST API parameters
    const params: Record<string, string | number> = {
      jurisdiction: state.toLowerCase(),
      per_page: limit,
      sort: 'updated_desc',
      include: 'actions'
    };

    if (query) {
      params.q = query;
    }

    const data = await this.restRequest('/bills', params);

    return (data.results || []).map((bill: any) => {
      // Get the latest action from the actions array
      const actions = bill.actions || [];
      const latestAction = actions.length > 0 ? actions[actions.length - 1] : null;

      return {
        id: bill.id,
        identifier: bill.identifier,
        title: bill.title,
        session: bill.session || '',
        chamber: bill.from_organization?.classification || '',
        latestActionDate: latestAction?.date || null,
        latestActionDescription: latestAction?.description || null,
        subjects: bill.subject || []
      };
    });
  }

  /**
   * Get detailed bill information including text versions
   *
   * @param billId - OpenStates bill ID (ocd-bill/uuid format)
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

    // Use REST API with includes for full details
    // OpenStates v3 API requires separate include params for each value
    const bill = await this.restRequest(`/bills/${billId}`, {
      include: ['sponsorships', 'abstracts', 'versions', 'actions']
    });

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
              mediaType: link.media_type || null
            });
          }
        }
      }
    }

    // Get the latest action from the actions array
    const actions = bill.actions || [];
    const latestAction = actions.length > 0 ? actions[actions.length - 1] : null;

    return {
      id: bill.id,
      identifier: bill.identifier,
      title: bill.title,
      session: bill.session || '',
      chamber: bill.from_organization?.classification || '',
      abstract: bill.abstracts?.[0]?.abstract || null,
      latestActionDate: latestAction?.date || null,
      latestActionDescription: latestAction?.description || null,
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
   * Get state legislators by state abbreviation
   * Used to populate state legislators table for displaying on dashboard
   *
   * @param state - State abbreviation (e.g., 'CA', 'TX')
   * @param perPage - Number of results per page (default: 100)
   * @returns Array of state legislators
   */
  async getLegislatorsByState(state: string, _perPage: number = 100): Promise<Array<{
    id: string;
    name: string;
    party: string;
    state: string;
    currentRoleTitle: string | null;
    currentRoleDistrict: string | null;
    currentRoleChamber: string | null;
    jurisdictionId: string | null;
    imageUrl: string | null;
    email: string | null;
  }>> {
    console.log(`✓ OpenStates legislators by state: ${state}`);

    const legislators: Array<{
      id: string;
      name: string;
      party: string;
      state: string;
      currentRoleTitle: string | null;
      currentRoleDistrict: string | null;
      currentRoleChamber: string | null;
      jurisdictionId: string | null;
      imageUrl: string | null;
      email: string | null;
    }> = [];

    try {
      // Use bulk CSV data download instead of API (more reliable)
      // CSV is available at: https://data.openstates.org/people/current/{state}.csv
      const csvUrl = `https://data.openstates.org/people/current/${state.toLowerCase()}.csv`;
      console.log(`  📥 Fetching CSV from: ${csvUrl}`);

      const response = await fetch(csvUrl);
      if (!response.ok) {
        console.log(`  ⚠️ CSV fetch failed: ${response.status}`);
        return legislators;
      }

      const csvText = await response.text();
      const lines = csvText.split('\n');

      if (lines.length < 2) {
        console.log(`  ⚠️ CSV is empty or invalid`);
        return legislators;
      }

      // Parse header to find column indices
      const header = this.parseCSVLine(lines[0] as string);
      const idIdx = header.indexOf('id');
      const nameIdx = header.indexOf('name');
      const partyIdx = header.indexOf('current_party');
      const districtIdx = header.indexOf('current_district');
      const chamberIdx = header.indexOf('current_chamber');
      const emailIdx = header.indexOf('email');
      const imageIdx = header.indexOf('image');

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line || !line.trim()) continue;

        const cols = this.parseCSVLine(line);
        const chamber = cols[chamberIdx] || '';

        // Only include legislators (upper/lower chamber)
        if (chamber === 'upper' || chamber === 'lower') {
          legislators.push({
            id: cols[idIdx] || '',
            name: cols[nameIdx] || '',
            party: cols[partyIdx] || '',
            state: state.toUpperCase(),
            currentRoleTitle: chamber === 'upper' ? 'State Senator' : 'State Representative',
            currentRoleDistrict: cols[districtIdx] || null,
            currentRoleChamber: chamber,
            jurisdictionId: null,
            imageUrl: cols[imageIdx] || null,
            email: cols[emailIdx] || null
          });
        }
      }

      console.log(`  📋 CSV parsed ${legislators.length} legislators`);

    } catch (e) {
      console.log(`  ⚠️ Could not fetch legislators: ${e}`);
    }

    console.log(`  Found ${legislators.length} legislators for ${state}`);
    return legislators;
  }

  /**
   * Parse a CSV line handling quoted fields with commas
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);

    return result;
  }

  /**
   * Get current legislative session for a state
   *
   * @param state - State abbreviation (e.g., 'CA', 'TX')
   * @returns Current session identifier
   */
  async getCurrentSession(state: string): Promise<string | null> {
    console.log(`✓ OpenStates session: ${state}`);

    // Use REST API to get jurisdiction details
    const data = await this.restRequest(`/jurisdictions/${state.toLowerCase()}`);

    // Find the current or most recent session
    const sessions = data.legislative_sessions || [];
    const today = new Date().toISOString().split('T')[0] as string;

    // Look for current session (has started, hasn't ended)
    for (const session of sessions) {
      if (session.start_date && session.start_date <= today) {
        if (!session.end_date || session.end_date >= today) {
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
