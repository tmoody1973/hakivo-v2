/**
 * Congress.gov API Client
 *
 * Provides functions for accessing Congressional data including bills, members,
 * votes, and committees from the 118th & 119th Congress.
 *
 * API Base URL: https://api.congress.gov/v3
 * Documentation: https://api.congress.gov/
 *
 * Rate Limits: 5,000 requests per hour per API key
 */

import {
  Bill,
  BillDetail,
  BillSearchParams,
  BillsResponse,
  Member,
  MemberDetail,
  MemberSearchParams,
  MembersResponse,
  Vote,
  VoteSearchParams,
  VotesResponse,
  Committee,
  CommitteeDetail,
  CommitteesResponse,
  CongressNumber,
  BillType,
} from '../api-specs/congress.types';
import { APIResponse } from '../api-specs/common.types';

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_BILL: Bill = {
  congress: 119,
  type: 'hr',
  number: '1234',
  originChamber: 'House',
  title: 'Clean Energy Innovation Act',
  introducedDate: '2025-01-15',
  updateDate: '2025-01-20',
  latestAction: {
    actionDate: '2025-01-20',
    text: 'Referred to the Committee on Energy and Commerce',
  },
  sponsors: [
    {
      bioguideId: 'S000001',
      fullName: 'Rep. Smith, Jane [D-CA-12]',
      firstName: 'Jane',
      lastName: 'Smith',
      party: 'D',
      state: 'CA',
      district: 12,
    },
  ],
  policyArea: 'Energy',
  url: 'https://www.congress.gov/bill/119th-congress/house-bill/1234',
};

const MOCK_MEMBER: Member = {
  bioguideId: 'S000001',
  district: 12,
  partyName: 'Democratic',
  state: 'CA',
  name: 'Smith, Jane',
  updateDate: '2025-01-15',
  depiction: {
    imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=JaneSmith',
  },
};

// ============================================================================
// Bills API
// ============================================================================

/**
 * Fetch bills with optional filtering
 *
 * @param params - Search and filter parameters
 * @returns Paginated list of bills
 *
 * API ENDPOINT: GET https://api.congress.gov/v3/bill/{congress}
 * HEADERS: {
 *   'X-Api-Key': process.env.CONGRESS_API_KEY
 * }
 * QUERY PARAMETERS: {
 *   format: 'json',
 *   fromDateTime?: string (ISO 8601),
 *   toDateTime?: string (ISO 8601),
 *   sort?: 'updateDate:desc' | 'latestAction:desc',
 *   limit?: number (default: 20, max: 250),
 *   offset?: number (default: 0)
 * }
 * SUCCESS RESPONSE (200): {
 *   bills: [{
 *     congress: number,
 *     type: string,
 *     number: string,
 *     title: string,
 *     introducedDate: string,
 *     updateDate: string,
 *     latestAction: {
 *       actionDate: string,
 *       text: string
 *     },
 *     url: string
 *   }],
 *   pagination: {
 *     count: number,
 *     next?: string
 *   }
 * }
 * ERROR RESPONSES:
 *   400: { error: 'Invalid request parameters' }
 *   401: { error: 'Invalid or missing API key' }
 *   429: { error: 'Rate limit exceeded. Limit: 5000/hour' }
 *   503: { error: 'Service temporarily unavailable' }
 */
export async function fetchBills(
  params: BillSearchParams = {}
): Promise<APIResponse<BillsResponse>> {
  const congress = params.congress || 119;

  // API ENDPOINT: GET https://api.congress.gov/v3/bill/{congress}
  // HEADERS: { 'X-Api-Key': process.env.CONGRESS_API_KEY }
  // QUERY PARAMETERS: {
  //   format: 'json',
  //   fromDateTime: params.fromDateTime,
  //   toDateTime: params.toDateTime,
  //   sort: params.sort ? `${params.sort}:desc` : 'updateDate:desc',
  //   limit: params.limit || 20,
  //   offset: params.offset || 0
  // }

  // If billType is specified, use type-specific endpoint:
  // GET https://api.congress.gov/v3/bill/{congress}/{billType}

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      bills: [MOCK_BILL, { ...MOCK_BILL, number: '1235', title: 'Healthcare Access Act' }],
      pagination: {
        count: 2,
      },
    },
  };
}

/**
 * Fetch detailed bill information by ID
 *
 * @param congress - Congress number (118 or 119)
 * @param billType - Bill type (hr, s, hjres, etc.)
 * @param billNumber - Bill number
 * @returns Detailed bill information
 *
 * API ENDPOINT: GET https://api.congress.gov/v3/bill/{congress}/{billType}/{billNumber}
 * HEADERS: {
 *   'X-Api-Key': process.env.CONGRESS_API_KEY
 * }
 * QUERY PARAMETERS: {
 *   format: 'json'
 * }
 * SUCCESS RESPONSE (200): {
 *   bill: {
 *     congress: number,
 *     type: string,
 *     number: string,
 *     title: string,
 *     introducedDate: string,
 *     updateDate: string,
 *     originChamber: string,
 *     latestAction: { actionDate: string, text: string },
 *     sponsors: [{ bioguideId: string, fullName: string, party: string, state: string, district?: number }],
 *     cosponsors: [{ ...sponsor, sponsorshipDate: string, isOriginalCosponsor: boolean }],
 *     committees: [{ systemCode: string, name: string }],
 *     subjects: [{ name: string }],
 *     summaries: [{ actionDate: string, actionDesc: string, text: string }],
 *     actions: [{ actionDate: string, text: string, type: string }],
 *     textVersions: [{ type: string, date: string, formats: [{ type: string, url: string }] }],
 *     policyArea: string,
 *     laws: [{ number: string, type: string }],
 *     url: string
 *   }
 * }
 * ERROR RESPONSES:
 *   400: { error: 'Invalid congress, billType, or billNumber' }
 *   401: { error: 'Invalid or missing API key' }
 *   404: { error: 'Bill not found' }
 *   429: { error: 'Rate limit exceeded. Limit: 5000/hour' }
 */
export async function fetchBillById(
  congress: CongressNumber,
  billType: BillType,
  billNumber: string
): Promise<APIResponse<BillDetail>> {
  // API ENDPOINT: GET https://api.congress.gov/v3/bill/{congress}/{billType}/{billNumber}
  // HEADERS: { 'X-Api-Key': process.env.CONGRESS_API_KEY }
  // QUERY PARAMETERS: { format: 'json' }

  // To get additional details, make parallel requests:
  // - Actions: GET /v3/bill/{congress}/{billType}/{billNumber}/actions
  // - Subjects: GET /v3/bill/{congress}/{billType}/{billNumber}/subjects
  // - Summaries: GET /v3/bill/{congress}/{billType}/{billNumber}/summaries
  // - Text: GET /v3/bill/{congress}/{billType}/{billNumber}/text
  // - Cosponsors: GET /v3/bill/{congress}/{billType}/{billNumber}/cosponsors
  // - Committees: GET /v3/bill/{congress}/{billType}/{billNumber}/committees
  // - Amendments: GET /v3/bill/{congress}/{billType}/{billNumber}/amendments
  // - Related: GET /v3/bill/{congress}/{billType}/{billNumber}/relatedbills

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      ...MOCK_BILL,
      actions: [
        {
          actionDate: '2025-01-15',
          text: 'Introduced in House',
          type: 'IntroReferral',
        },
        {
          actionDate: '2025-01-20',
          text: 'Referred to the Committee on Energy and Commerce',
          type: 'IntroReferral',
        },
      ],
      titles: [
        {
          title: 'Clean Energy Innovation Act',
          titleType: 'Display Title',
        },
      ],
    },
  };
}

/**
 * Search bills by keyword query
 *
 * @param query - Search query string
 * @param params - Additional search parameters
 * @returns Matching bills
 *
 * API ENDPOINT: GET https://api.congress.gov/v3/bill
 * HEADERS: {
 *   'X-Api-Key': process.env.CONGRESS_API_KEY
 * }
 * QUERY PARAMETERS: {
 *   format: 'json',
 *   q: string (URL encoded search query),
 *   congress?: number,
 *   sort?: 'updateDate:desc' | 'latestAction:desc',
 *   limit?: number,
 *   offset?: number
 * }
 * SUCCESS RESPONSE (200): Same as fetchBills
 * ERROR RESPONSES: Same as fetchBills
 *
 * Search Query Examples:
 * - "climate change" - Search for bills containing these terms
 * - "energy AND renewable" - Boolean AND search
 * - "healthcare OR medicare" - Boolean OR search
 * - "sponsor:S000001" - Bills sponsored by specific member
 */
export async function searchBills(
  query: string,
  params: BillSearchParams = {}
): Promise<APIResponse<BillsResponse>> {
  // API ENDPOINT: GET https://api.congress.gov/v3/bill
  // HEADERS: { 'X-Api-Key': process.env.CONGRESS_API_KEY }
  // QUERY PARAMETERS: {
  //   format: 'json',
  //   q: encodeURIComponent(query),
  //   congress: params.congress,
  //   sort: params.sort ? `${params.sort}:desc` : 'updateDate:desc',
  //   limit: params.limit || 20,
  //   offset: params.offset || 0
  // }

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      bills: [MOCK_BILL],
      pagination: {
        count: 1,
      },
    },
  };
}

/**
 * Fetch bill text (full legislative text)
 *
 * @param congress - Congress number
 * @param billType - Bill type
 * @param billNumber - Bill number
 * @returns Available text versions
 *
 * API ENDPOINT: GET https://api.congress.gov/v3/bill/{congress}/{billType}/{billNumber}/text
 * HEADERS: {
 *   'X-Api-Key': process.env.CONGRESS_API_KEY
 * }
 * SUCCESS RESPONSE (200): {
 *   textVersions: [{
 *     type: 'Introduced in House' | 'Engrossed in House' | 'Enrolled' | etc.,
 *     date: string,
 *     formats: [
 *       { type: 'Formatted Text', url: string },
 *       { type: 'PDF', url: string },
 *       { type: 'Formatted XML', url: string }
 *     ]
 *   }]
 * }
 *
 * Note: Actual bill text must be downloaded from the format URLs
 */
export async function fetchBillText(
  congress: CongressNumber,
  billType: BillType,
  billNumber: string
): Promise<APIResponse<any>> {
  // API ENDPOINT: GET https://api.congress.gov/v3/bill/{congress}/{billType}/{billNumber}/text
  // HEADERS: { 'X-Api-Key': process.env.CONGRESS_API_KEY }

  // To download actual text, use the format URLs from response:
  // Formatted Text: HTML version
  // PDF: PDF version
  // Formatted XML: XML version

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      textVersions: [
        {
          type: 'Introduced in House',
          date: '2025-01-15',
          formats: [
            { type: 'Formatted Text', url: 'https://www.congress.gov/119/bills/hr1234/BILLS-119hr1234ih.htm' },
            { type: 'PDF', url: 'https://www.congress.gov/119/bills/hr1234/BILLS-119hr1234ih.pdf' },
          ],
        },
      ],
    },
  };
}

// ============================================================================
// Members API
// ============================================================================

/**
 * Fetch Congressional members with optional filtering
 *
 * @param params - Search and filter parameters
 * @returns List of members
 *
 * API ENDPOINT: GET https://api.congress.gov/v3/member/{congress}/{chamber}
 * HEADERS: {
 *   'X-Api-Key': process.env.CONGRESS_API_KEY
 * }
 * QUERY PARAMETERS: {
 *   format: 'json',
 *   currentMember?: 'true' | 'false',
 *   limit?: number (default: 20, max: 250),
 *   offset?: number (default: 0)
 * }
 * SUCCESS RESPONSE (200): {
 *   members: [{
 *     bioguideId: string,
 *     district?: number,
 *     partyName: string,
 *     state: string,
 *     name: string,
 *     updateDate: string,
 *     depiction: { imageUrl?: string },
 *     url: string
 *   }],
 *   pagination: {
 *     count: number,
 *     next?: string
 *   }
 * }
 * ERROR RESPONSES:
 *   400: { error: 'Invalid request parameters' }
 *   401: { error: 'Invalid or missing API key' }
 *   429: { error: 'Rate limit exceeded' }
 */
export async function fetchMembers(
  params: MemberSearchParams = {}
): Promise<APIResponse<MembersResponse>> {
  const congress = params.congress || 119;
  const chamber = params.chamber || 'house';

  // API ENDPOINT: GET https://api.congress.gov/v3/member/{congress}/{chamber}
  // HEADERS: { 'X-Api-Key': process.env.CONGRESS_API_KEY }
  // QUERY PARAMETERS: {
  //   format: 'json',
  //   currentMember: params.currentMember ? 'true' : undefined,
  //   limit: params.limit || 20,
  //   offset: params.offset || 0
  // }

  // For state-specific members:
  // GET https://api.congress.gov/v3/member/{congress}/{chamber}/stateDistrict/{state}
  // For specific district: /stateDistrict/{state}/{district}

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      members: [MOCK_MEMBER],
      pagination: {
        count: 1,
      },
    },
  };
}

/**
 * Fetch detailed member information by bioguide ID
 *
 * @param bioguideId - Member's bioguide identifier
 * @returns Detailed member information
 *
 * API ENDPOINT: GET https://api.congress.gov/v3/member/{bioguideId}
 * HEADERS: {
 *   'X-Api-Key': process.env.CONGRESS_API_KEY
 * }
 * SUCCESS RESPONSE (200): {
 *   member: {
 *     bioguideId: string,
 *     birthYear: string,
 *     firstName: string,
 *     lastName: string,
 *     partyName: string,
 *     state: string,
 *     district?: number,
 *     terms: [{ chamber: string, startYear: number, endYear?: number }],
 *     officialWebsiteUrl?: string,
 *     addressInformation: {
 *       officeAddress: string,
 *       city: string,
 *       phoneNumber: string
 *     },
 *     sponsoredLegislation: { count: number },
 *     cosponsoredLegislation: { count: number },
 *     depiction: { imageUrl: string },
 *     updateDate: string
 *   }
 * }
 * ERROR RESPONSES:
 *   404: { error: 'Member not found' }
 *   401: { error: 'Invalid or missing API key' }
 *   429: { error: 'Rate limit exceeded' }
 */
export async function fetchMemberById(
  bioguideId: string
): Promise<APIResponse<MemberDetail>> {
  // API ENDPOINT: GET https://api.congress.gov/v3/member/{bioguideId}
  // HEADERS: { 'X-Api-Key': process.env.CONGRESS_API_KEY }

  // To get sponsored legislation:
  // GET https://api.congress.gov/v3/member/{bioguideId}/sponsored-legislation

  // To get cosponsored legislation:
  // GET https://api.congress.gov/v3/member/{bioguideId}/cosponsored-legislation

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      ...MOCK_MEMBER,
      firstName: 'Jane',
      lastName: 'Smith',
      birthYear: '1975',
      officialWebsiteUrl: 'https://janesmith.house.gov',
      sponsoredLegislation: { count: 42 },
      cosponsoredLegislation: { count: 158 },
    },
  };
}

/**
 * Fetch members by zip code (requires Geocodio first)
 *
 * Note: This is a helper function that combines Geocodio lookup
 * with Congress.gov member fetching. Use lookupByZipCode from
 * geocodio.ts first to get Congressional district.
 *
 * @param state - State abbreviation (e.g., 'CA')
 * @param district - District number
 * @returns Members representing the district
 */
export async function fetchMembersByDistrict(
  state: string,
  district: number
): Promise<APIResponse<MembersResponse>> {
  // First use Geocodio to convert zip -> district
  // Then call: GET https://api.congress.gov/v3/member/congress/119/house/stateDistrict/{state}/{district}

  // API ENDPOINT: GET https://api.congress.gov/v3/member/congress/119/house/stateDistrict/{state}/{district}
  // HEADERS: { 'X-Api-Key': process.env.CONGRESS_API_KEY }

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      members: [MOCK_MEMBER],
      pagination: {
        count: 1,
      },
    },
  };
}

// ============================================================================
// Votes API
// ============================================================================

/**
 * Fetch roll call votes
 *
 * @param params - Search parameters
 * @returns List of votes
 *
 * API ENDPOINT: GET https://api.congress.gov/v3/vote/{congress}/{chamber}
 * HEADERS: {
 *   'X-Api-Key': process.env.CONGRESS_API_KEY
 * }
 * QUERY PARAMETERS: {
 *   format: 'json',
 *   limit?: number,
 *   offset?: number
 * }
 * SUCCESS RESPONSE (200): {
 *   votes: [{
 *     congress: number,
 *     chamber: string,
 *     rollNumber: number,
 *     voteDate: string,
 *     voteQuestion: string,
 *     voteResult: string,
 *     bill?: { congress: number, type: string, number: string },
 *     updateDate: string,
 *     url: string
 *   }]
 * }
 */
export async function fetchVotes(
  params: VoteSearchParams = {}
): Promise<APIResponse<VotesResponse>> {
  // API ENDPOINT: GET https://api.congress.gov/v3/vote/{congress}/{chamber}
  // For specific vote: GET https://api.congress.gov/v3/vote/{congress}/{chamber}/{rollNumber}

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      votes: [
        {
          congress: 119,
          chamber: 'house',
          rollNumber: 1,
          sessionNumber: 1,
          voteDate: '2025-01-20',
          voteQuestion: 'On Passage',
          voteType: 'YEA-AND-NAY',
          voteResult: 'Passed',
          updateDate: '2025-01-20',
        },
      ],
      pagination: {
        count: 1,
      },
    },
  };
}

// ============================================================================
// Committees API
// ============================================================================

/**
 * Fetch Congressional committees
 *
 * @param congress - Congress number
 * @param chamber - Chamber (house or senate)
 * @returns List of committees
 *
 * API ENDPOINT: GET https://api.congress.gov/v3/committee/{congress}/{chamber}
 * HEADERS: {
 *   'X-Api-Key': process.env.CONGRESS_API_KEY
 * }
 * SUCCESS RESPONSE (200): {
 *   committees: [{
 *     systemCode: string,
 *     name: string,
 *     chamber: string,
 *     type: string,
 *     updateDate: string,
 *     url: string
 *   }]
 * }
 */
export async function fetchCommittees(
  congress: CongressNumber = 119,
  chamber?: 'house' | 'senate'
): Promise<APIResponse<CommitteesResponse>> {
  // API ENDPOINT: GET https://api.congress.gov/v3/committee/{congress}/{chamber}
  // For specific committee: GET https://api.congress.gov/v3/committee/{congress}/{chamber}/{committeeCode}

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      committees: [
        {
          systemCode: 'hsif00',
          name: 'Energy and Commerce Committee',
          chamber: 'House',
          type: 'Standing',
          updateDate: '2025-01-15',
        },
      ],
      pagination: {
        count: 1,
      },
    },
  };
}
