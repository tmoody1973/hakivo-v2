import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

// =============================================================================
// FEC API Types
// =============================================================================

export interface FECCandidate {
  candidate_id: string;
  name: string;
  party: string;
  party_full: string;
  office: string;
  office_full: string;
  state: string;
  district: string;
  district_number: number;
  incumbent_challenge: string;
  incumbent_challenge_full: string;
  candidate_status: string;
  election_years: number[];
  cycles: number[];
  first_file_date: string;
  has_raised_funds: boolean;
  principal_committees: FECCommittee[];
}

export interface FECCommittee {
  committee_id: string;
  name: string;
  designation: string;
  designation_full: string;
  committee_type: string;
  committee_type_full: string;
  party: string;
  party_full: string;
  state: string;
  treasurer_name: string;
  cycles: number[];
  first_file_date: string;
  last_file_date: string;
}

export interface FECCandidateTotals {
  candidate_id: string;
  candidate_election_year: number;
  cycle: number | null;
  receipts: number;
  disbursements: number;
  contributions: number;
  individual_contributions: number;
  individual_itemized_contributions: number;
  individual_unitemized_contributions: number;
  other_political_committee_contributions: number;
  political_party_committee_contributions: number;
  transfers_from_other_authorized_committee: number;
  loans: number;
  loans_made_by_candidate: number;
  last_cash_on_hand_end_period: number;
  last_debts_owed_by_committee: number;
  coverage_start_date: string;
  coverage_end_date: string;
}

export interface FECContributionByEmployer {
  committee_id: string;
  cycle: number;
  employer: string;
  total: number;
  count: number;
}

export interface FECContributionByOccupation {
  committee_id: string;
  cycle: number;
  occupation: string;
  total: number;
  count: number;
}

export interface FECContributionByState {
  committee_id: string;
  cycle: number;
  state: string;
  state_full: string;
  total: number;
  count: number;
}

export interface FECContributionBySize {
  committee_id: string;
  cycle: number;
  size: number; // 0, 200, 500, 1000, 2000
  total: number;
  count: number | null;
}

export interface LegislatorIds {
  bioguide: string;
  fec?: string[];
  opensecrets?: string;
  govtrack?: number;
  votesmart?: number;
}

export interface CampaignFinanceSummary {
  candidateId: string;
  committeeId: string;
  cycle: number;
  totalRaised: number;
  totalSpent: number;
  cashOnHand: number;
  individualContributions: number;
  pacContributions: number;
  partyContributions: number;
  selfFinanced: number;
  debts: number;
  coverageStart: string;
  coverageEnd: string;
  topContributorsByEmployer: FECContributionByEmployer[];
  topContributorsByOccupation: FECContributionByOccupation[];
  contributionsByState: FECContributionByState[];
  contributionsBySize: FECContributionBySize[];
}

// =============================================================================
// FEC Client Service
// =============================================================================

export default class extends Service<Env> {
  private readonly BASE_URL = 'https://api.open.fec.gov/v1';
  private readonly LEGISLATORS_URL = 'https://unitedstates.github.io/congress-legislators/legislators-current.json';
  private legislatorCache: Map<string, LegislatorIds> | null = null;

  /**
   * Get FEC API key from environment
   */
  private getApiKey(): string {
    const apiKey = this.env.FEC_API_KEY;

    if (!apiKey) {
      throw new Error('FEC_API_KEY environment variable is not set');
    }

    return apiKey;
  }

  /**
   * Make rate-limited request to FEC API
   */
  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, string | number> = {}
  ): Promise<T> {
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
        throw new Error('FEC API rate limit exceeded (1000 requests/hour)');
      }

      if (!response.ok) {
        throw new Error(`FEC API error: ${response.status} ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      console.error('FEC API request error:', error);
      throw new Error(`FEC API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load and cache the congress-legislators JSON for bioguide→FEC ID mapping
   */
  async loadLegislatorMapping(): Promise<Map<string, LegislatorIds>> {
    if (this.legislatorCache) {
      return this.legislatorCache;
    }

    console.log('Loading congress-legislators mapping...');

    try {
      const response = await fetch(this.LEGISLATORS_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch legislators: ${response.status}`);
      }

      const legislators: Array<{ id: LegislatorIds }> = await response.json();

      this.legislatorCache = new Map();
      for (const legislator of legislators) {
        if (legislator.id?.bioguide) {
          this.legislatorCache.set(legislator.id.bioguide, legislator.id);
        }
      }

      console.log(`Loaded ${this.legislatorCache.size} legislator mappings`);
      return this.legislatorCache;
    } catch (error) {
      console.error('Failed to load legislator mapping:', error);
      throw error;
    }
  }

  /**
   * Get FEC candidate IDs from bioguide ID
   * Uses the congress-legislators mapping
   */
  async getFecIdsFromBioguide(bioguideId: string): Promise<{
    fecIds: string[];
    opensecretsId?: string;
  }> {
    const mapping = await this.loadLegislatorMapping();
    const ids = mapping.get(bioguideId);

    if (!ids) {
      console.log(`No mapping found for bioguide ID: ${bioguideId}`);
      return { fecIds: [] };
    }

    return {
      fecIds: ids.fec || [],
      opensecretsId: ids.opensecrets
    };
  }

  /**
   * Search for candidates by name
   * Fallback if bioguide mapping doesn't exist
   */
  async searchCandidates(
    name: string,
    office?: 'H' | 'S' | 'P',
    state?: string
  ): Promise<FECCandidate[]> {
    console.log(`FEC search: ${name}${office ? ` (${office})` : ''}${state ? ` in ${state}` : ''}`);

    const params: Record<string, string | number> = {
      q: name,
      per_page: 10,
      sort: '-election_years'
    };

    if (office) params.office = office;
    if (state) params.state = state;

    const response = await this.makeRequest<{ results: FECCandidate[] }>(
      '/candidates/search/',
      params
    );

    return response.results || [];
  }

  /**
   * Get candidate details by FEC candidate ID
   */
  async getCandidateDetails(candidateId: string): Promise<FECCandidate | null> {
    console.log(`FEC candidate details: ${candidateId}`);

    try {
      const response = await this.makeRequest<{ results: FECCandidate[] }>(
        `/candidate/${candidateId}/`
      );

      return response.results?.[0] || null;
    } catch (error) {
      console.error(`Failed to get candidate ${candidateId}:`, error);
      return null;
    }
  }

  /**
   * Get candidate's principal campaign committee
   */
  async getCandidateCommittee(candidateId: string): Promise<FECCommittee | null> {
    console.log(`FEC committee for candidate: ${candidateId}`);

    try {
      const response = await this.makeRequest<{ results: FECCommittee[] }>(
        `/candidate/${candidateId}/committees/`,
        { designation: 'P' } // Principal campaign committee
      );

      return response.results?.[0] || null;
    } catch (error) {
      console.error(`Failed to get committee for ${candidateId}:`, error);
      return null;
    }
  }

  /**
   * Get candidate financial totals
   */
  async getCandidateTotals(
    candidateId: string,
    cycle?: number
  ): Promise<FECCandidateTotals[]> {
    console.log(`FEC totals: ${candidateId}${cycle ? ` (${cycle})` : ''}`);

    const params: Record<string, string | number> = {
      per_page: 10,
      sort: '-cycle'
    };

    if (cycle) params.cycle = cycle;

    try {
      const response = await this.makeRequest<{ results: FECCandidateTotals[] }>(
        `/candidate/${candidateId}/totals/`,
        params
      );

      return response.results || [];
    } catch (error) {
      console.error(`Failed to get totals for ${candidateId}:`, error);
      return [];
    }
  }

  /**
   * Get contributions aggregated by employer (top organizations)
   */
  async getContributionsByEmployer(
    committeeId: string,
    cycle: number,
    limit: number = 20
  ): Promise<FECContributionByEmployer[]> {
    console.log(`FEC contributions by employer: ${committeeId} (${cycle})`);

    try {
      const response = await this.makeRequest<{ results: FECContributionByEmployer[] }>(
        '/schedules/schedule_a/by_employer/',
        {
          committee_id: committeeId,
          cycle,
          per_page: limit,
          sort: '-total'
        }
      );

      return response.results || [];
    } catch (error) {
      console.error(`Failed to get employer contributions for ${committeeId}:`, error);
      return [];
    }
  }

  /**
   * Get contributions aggregated by occupation (like "industry" categories)
   */
  async getContributionsByOccupation(
    committeeId: string,
    cycle: number,
    limit: number = 20
  ): Promise<FECContributionByOccupation[]> {
    console.log(`FEC contributions by occupation: ${committeeId} (${cycle})`);

    try {
      const response = await this.makeRequest<{ results: FECContributionByOccupation[] }>(
        '/schedules/schedule_a/by_occupation/',
        {
          committee_id: committeeId,
          cycle,
          per_page: limit,
          sort: '-total'
        }
      );

      return response.results || [];
    } catch (error) {
      console.error(`Failed to get occupation contributions for ${committeeId}:`, error);
      return [];
    }
  }

  /**
   * Get contributions aggregated by state
   */
  async getContributionsByState(
    committeeId: string,
    cycle: number
  ): Promise<FECContributionByState[]> {
    console.log(`FEC contributions by state: ${committeeId} (${cycle})`);

    try {
      const response = await this.makeRequest<{ results: FECContributionByState[] }>(
        '/schedules/schedule_a/by_state/',
        {
          committee_id: committeeId,
          cycle,
          per_page: 60, // All states + territories
          sort: '-total'
        }
      );

      return response.results || [];
    } catch (error) {
      console.error(`Failed to get state contributions for ${committeeId}:`, error);
      return [];
    }
  }

  /**
   * Get contributions aggregated by size
   */
  async getContributionsBySize(
    committeeId: string,
    cycle: number
  ): Promise<FECContributionBySize[]> {
    console.log(`FEC contributions by size: ${committeeId} (${cycle})`);

    try {
      const response = await this.makeRequest<{ results: FECContributionBySize[] }>(
        '/schedules/schedule_a/by_size/',
        {
          committee_id: committeeId,
          cycle
        }
      );

      return response.results || [];
    } catch (error) {
      console.error(`Failed to get size contributions for ${committeeId}:`, error);
      return [];
    }
  }

  /**
   * Get comprehensive campaign finance data for a member
   * This is the main method to call from other services
   */
  async getMemberCampaignFinance(
    bioguideId: string,
    cycle: number = 2024
  ): Promise<CampaignFinanceSummary | null> {
    console.log(`Getting campaign finance for ${bioguideId} (${cycle})`);

    try {
      // Step 1: Get FEC ID from bioguide mapping
      const { fecIds, opensecretsId } = await this.getFecIdsFromBioguide(bioguideId);

      if (fecIds.length === 0) {
        console.log(`No FEC IDs found for ${bioguideId}`);
        return null;
      }

      // Use the most recent FEC ID (usually the last one for current office)
      // For members who served in both House and Senate, they'll have multiple IDs
      const candidateId = fecIds[fecIds.length - 1]!;
      console.log(`Using FEC candidate ID: ${candidateId}`);

      // Step 2: Get the principal campaign committee
      const committee = await this.getCandidateCommittee(candidateId);
      if (!committee) {
        console.log(`No committee found for ${candidateId}`);
        return null;
      }

      const committeeId = committee.committee_id;
      console.log(`Found committee: ${committeeId} (${committee.name})`);

      // Step 3: Get financial totals
      const totals = await this.getCandidateTotals(candidateId, cycle);
      const currentTotals = totals.find(t =>
        t.candidate_election_year === cycle ||
        (t.cycle === cycle)
      ) || totals[0];

      if (!currentTotals) {
        console.log(`No totals found for ${candidateId} in cycle ${cycle}`);
        return null;
      }

      // Step 4: Get contribution breakdowns in parallel
      const [byEmployer, byOccupation, byState, bySize] = await Promise.all([
        this.getContributionsByEmployer(committeeId, cycle, 25),
        this.getContributionsByOccupation(committeeId, cycle, 25),
        this.getContributionsByState(committeeId, cycle),
        this.getContributionsBySize(committeeId, cycle)
      ]);

      // Build the summary
      const summary: CampaignFinanceSummary = {
        candidateId,
        committeeId,
        cycle,
        totalRaised: currentTotals.receipts || 0,
        totalSpent: currentTotals.disbursements || 0,
        cashOnHand: currentTotals.last_cash_on_hand_end_period || 0,
        individualContributions: currentTotals.individual_contributions || 0,
        pacContributions: currentTotals.other_political_committee_contributions || 0,
        partyContributions: currentTotals.political_party_committee_contributions || 0,
        selfFinanced: currentTotals.loans_made_by_candidate || 0,
        debts: currentTotals.last_debts_owed_by_committee || 0,
        coverageStart: currentTotals.coverage_start_date || '',
        coverageEnd: currentTotals.coverage_end_date || '',
        topContributorsByEmployer: byEmployer,
        topContributorsByOccupation: byOccupation,
        contributionsByState: byState,
        contributionsBySize: bySize
      };

      console.log(`Campaign finance data retrieved for ${bioguideId}`);
      return summary;
    } catch (error) {
      console.error(`Failed to get campaign finance for ${bioguideId}:`, error);
      throw error;
    }
  }

  /**
   * Get available election cycles for a member
   */
  async getMemberElectionCycles(bioguideId: string): Promise<number[]> {
    const { fecIds } = await this.getFecIdsFromBioguide(bioguideId);

    if (fecIds.length === 0) {
      return [];
    }

    const candidateId = fecIds[fecIds.length - 1]!;
    const candidate = await this.getCandidateDetails(candidateId);

    return candidate?.cycles || [];
  }

  /**
   * Get OpenSecrets profile URL for a member
   */
  async getOpenSecretsUrl(bioguideId: string): Promise<string | null> {
    const { opensecretsId } = await this.getFecIdsFromBioguide(bioguideId);

    if (!opensecretsId) {
      return null;
    }

    return `https://www.opensecrets.org/members-of-congress/summary?cid=${opensecretsId}`;
  }

  /**
   * Required fetch method for Raindrop Service
   * This is a private service, so fetch returns 501 Not Implemented
   */
  async fetch(_request: Request): Promise<Response> {
    return new Response('Not Implemented - Private Service', { status: 501 });
  }
}
