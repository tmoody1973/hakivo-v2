import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { stateBillResultsTemplate } from "./c1-templates";

/**
 * OpenStates Tools for Hakivo Congressional Assistant
 *
 * Provides state-level legislation and legislator search functionality
 * using the bills-service backend which integrates with OpenStates API.
 *
 * Supports all 50 US states for:
 * - State bill search and details
 * - State legislator lookup by coordinates
 * - Legislator details and voting records
 */

// Service URL
const BILLS_SERVICE = process.env.NEXT_PUBLIC_BILLS_API_URL ||
  "https://svc-01kc6rbecv0s5k4yk6ksdaqyzh.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

// US State name to abbreviation mapping
const STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

// State abbreviation to full name
const STATE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_ABBREVIATIONS).map(([name, abbrev]) => [abbrev, name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")])
);

/**
 * Query expansion for common legislative topics
 * Maps colloquial terms to formal legislative language
 */
const QUERY_SYNONYMS: Record<string, string[]> = {
  // Drug-related - include all common legislative terms
  "thc": ["cannabis", "marijuana", "marihuana", "medical cannabis", "recreational cannabis"],
  "weed": ["cannabis", "marijuana", "marihuana", "medical cannabis"],
  "pot": ["cannabis", "marijuana", "marihuana", "medical cannabis"],
  "marijuana": ["cannabis", "marihuana", "medical cannabis", "recreational cannabis"],
  "cannabis": ["marijuana", "marihuana", "medical cannabis", "recreational cannabis"],
  "cbd": ["cannabidiol", "hemp", "cannabis", "medical cannabis"],
  "medical marijuana": ["medical cannabis", "cannabis", "marijuana"],

  // Healthcare
  "obamacare": ["affordable care act", "ACA", "health insurance"],
  "abortion": ["reproductive health", "pregnancy termination", "reproductive rights"],

  // Immigration
  "illegal immigration": ["undocumented", "immigration enforcement", "border security"],
  "dreamers": ["DACA", "deferred action"],

  // Guns
  "gun control": ["firearms", "second amendment", "weapons"],
  "guns": ["firearms", "weapons", "second amendment"],
  "ar-15": ["assault weapons", "semiautomatic", "firearms"],

  // Environment
  "climate change": ["greenhouse gas", "emissions", "carbon"],
  "global warming": ["climate", "greenhouse gas", "carbon emissions"],

  // Education
  "student loans": ["higher education", "student debt", "financial aid"],

  // LGBTQ+
  "gay marriage": ["same-sex marriage", "marriage equality"],
  "transgender": ["gender identity", "gender affirming"],
};

/**
 * Get all search terms for a query (original + synonyms)
 * Returns array of terms to search for
 */
function getSearchTerms(query: string): string[] {
  const lowerQuery = query.toLowerCase().trim();

  // Check if query matches any synonym key
  for (const [term, synonyms] of Object.entries(QUERY_SYNONYMS)) {
    if (lowerQuery === term || lowerQuery.includes(term)) {
      // Return original + all synonyms as separate terms
      return [query, ...synonyms];
    }
  }

  return [query];
}

/**
 * Normalize state input to 2-letter abbreviation
 */
function normalizeState(state: string): string | null {
  const upper = state.toUpperCase().trim();
  if (upper.length === 2 && Object.values(STATE_ABBREVIATIONS).includes(upper)) {
    return upper;
  }
  const lower = state.toLowerCase().trim();
  return STATE_ABBREVIATIONS[lower] || null;
}

// Result types
interface StateBill {
  id: string;
  state: string;
  stateName: string;
  identifier: string;
  title: string;
  session: string;
  subjects: string[];
  chamber: string | null;
  latestAction: {
    date: string | null;
    description: string | null;
  };
  openstatesUrl: string | null;
}

interface StateLegislator {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  party: string;
  state: string;
  stateName: string;
  chamber: string;
  district: string;
  title: string;
  imageUrl: string | null;
  email: string | null;
}

/**
 * Search State Bills Tool
 *
 * Search for state-level legislation by state, subject, query text.
 * Returns bills from the state legislature with status and latest actions.
 */
export const searchStateBillsTool = createTool({
  id: "searchStateBills",
  description: `Search for state legislature bills. Requires a state (name or 2-letter code).
Use this to find bills in any US state legislature.

Supports filtering by:
- Subject/policy area (e.g., "healthcare", "education")
- Search query (bill text/title)
- Legislative session
- Status (e.g., "passed", "failed")

Returns bill identifier, title, subjects, and latest action.`,
  inputSchema: z.object({
    state: z.string().describe("State name or 2-letter code (e.g., 'California' or 'CA')"),
    query: z.string().optional().describe("Search query for bill text or title"),
    subject: z.string().optional().describe("Subject/policy area filter (e.g., 'healthcare', 'education')"),
    session: z.string().optional().describe("Legislative session filter"),
    status: z.string().optional().describe("Status filter: passed, failed, introduced, etc."),
    limit: z.number().optional().default(20).describe("Max results to return (1-100)"),
    offset: z.number().optional().default(0).describe("Results offset for pagination"),
  }),
  execute: async ({ context }) => {
    const {
      state,
      query,
      subject,
      session,
      status,
      limit = 20,
      offset = 0,
    } = context;

    // Normalize state
    const stateCode = normalizeState(state);
    if (!stateCode) {
      return {
        success: false,
        bills: [],
        count: 0,
        error: `Invalid state: "${state}". Please provide a valid US state name or 2-letter code.`,
      };
    }

    try {
      // Get search terms (original + synonyms for better coverage)
      const searchTerms = query ? getSearchTerms(query) : [null];
      const wasExpanded = searchTerms.length > 1;

      // Deduplicate bills by ID
      const billMap = new Map<string, StateBill>();
      const searchedTerms: string[] = [];

      // Search for each term and merge results
      for (const term of searchTerms) {
        const params = new URLSearchParams({
          state: stateCode,
          limit: String(Math.min(limit, 100)),
          offset: String(offset),
          sort: "latest_action_date",
          order: "desc",
        });

        if (term) {
          params.set("query", term);
          searchedTerms.push(term);
        }
        if (subject) params.set("subject", subject);
        if (session) params.set("session", session);
        if (status) params.set("status", status);

        const response = await fetch(`${BILLS_SERVICE}/state-bills?${params.toString()}`);

        if (!response.ok) {
          // Continue to next term if one fails
          console.warn(`Search for "${term}" failed: ${response.statusText}`);
          continue;
        }

        const result = await response.json();

        // Add bills to map (deduplicates by ID)
        for (const bill of result.bills || []) {
          if (!billMap.has(bill.id)) {
            billMap.set(bill.id, {
              id: bill.id,
              state: bill.state,
              stateName: STATE_NAMES[bill.state as string] || bill.state,
              identifier: bill.identifier,
              title: bill.title,
              session: bill.session,
              subjects: bill.subjects || [],
              chamber: bill.chamber,
              latestAction: bill.latestAction,
              openstatesUrl: bill.openstatesUrl,
            });
          }
        }
      }

      // Convert map to array and sort by latest action date
      const bills = Array.from(billMap.values()).sort((a, b) => {
        const dateA = a.latestAction?.date ? new Date(a.latestAction.date).getTime() : 0;
        const dateB = b.latestAction?.date ? new Date(b.latestAction.date).getTime() : 0;
        return dateB - dateA;
      });

      // Generate C1 template for rich UI rendering
      const c1Template = stateBillResultsTemplate(
        bills.slice(0, limit).map((bill) => ({
          bill_id: bill.id,
          state: bill.state,
          session: bill.session,
          identifier: bill.identifier,
          title: bill.title,
          subject: bill.subjects,
          latest_action: bill.latestAction?.description || undefined,
          latest_action_date: bill.latestAction?.date || undefined,
        })),
        { query: query || undefined, state: STATE_NAMES[stateCode] || stateCode }
      );

      return {
        success: true,
        bills: bills.slice(0, limit), // Respect limit after merging
        count: Math.min(bills.length, limit),
        total: bills.length,
        state: stateCode,
        stateName: STATE_NAMES[stateCode] || stateCode,
        searchQuery: query || null,
        searchedTerms: wasExpanded ? searchedTerms : null,
        searchNote: wasExpanded
          ? `Expanded search to include related terms: ${searchedTerms.join(", ")}`
          : null,
        c1Template,
        templateType: "stateBillResults",
      };
    } catch (error) {
      return {
        success: false,
        bills: [],
        count: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Get State Bill Details Tool
 *
 * Get comprehensive details for a specific state bill including
 * full text, sponsors, actions history, and voting information.
 */
export const getStateBillDetailsTool = createTool({
  id: "getStateBillDetails",
  description: `Get detailed information about a specific state bill by its OCD ID.
Returns comprehensive bill data including sponsors, actions timeline, and voting info.`,
  inputSchema: z.object({
    billId: z.string().describe("The bill's OCD ID (e.g., 'ocd-bill/...')"),
  }),
  execute: async ({ context }) => {
    const { billId } = context;

    try {
      const encodedId = encodeURIComponent(billId);
      const response = await fetch(`${BILLS_SERVICE}/state-bills/${encodedId}`);

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            bill: null,
            error: `State bill not found: ${billId}`,
          };
        }
        throw new Error(`Failed to fetch state bill: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        bill: result.bill || result,
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        bill: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Get State Legislators by Location Tool
 *
 * Find state legislators (state senator and state representative)
 * based on geographic coordinates. Used during onboarding and for
 * "who represents me" queries.
 */
export const getStateLegislatorsByLocationTool = createTool({
  id: "getStateLegislatorsByLocation",
  description: `Find state legislators (state senator and state representative) for a given location.
Use this to answer "who represents me in the state legislature" or find legislators by address/coordinates.`,
  inputSchema: z.object({
    latitude: z.number().describe("Latitude coordinate"),
    longitude: z.number().describe("Longitude coordinate"),
  }),
  execute: async ({ context }) => {
    const { latitude, longitude } = context;

    try {
      const params = new URLSearchParams({
        lat: String(latitude),
        lng: String(longitude),
      });

      const response = await fetch(`${BILLS_SERVICE}/state-legislators?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to find state legislators: ${response.statusText}`);
      }

      const result = await response.json();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const legislators: StateLegislator[] = (result.legislators || []).map((leg: any) => {
        const currentRole = leg.currentRole || {};
        return {
          id: leg.id,
          name: leg.name,
          firstName: leg.firstName,
          lastName: leg.lastName,
          party: leg.party,
          state: leg.state,
          stateName: STATE_NAMES[leg.state as string] || leg.state,
          chamber: leg.chamber || currentRole.chamber,
          district: leg.district || currentRole.district,
          title: leg.title || currentRole.title,
          imageUrl: leg.imageUrl,
          email: leg.email,
        };
      });

      return {
        success: true,
        legislators,
        count: legislators.length,
        location: { latitude, longitude },
      };
    } catch (error) {
      return {
        success: false,
        legislators: [],
        count: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Get State Legislator Details Tool
 *
 * Get detailed information about a specific state legislator
 * including bio, committees, and contact info.
 */
export const getStateLegislatorDetailsTool = createTool({
  id: "getStateLegislatorDetails",
  description: `Get detailed information about a specific state legislator by their OCD ID.
Returns bio, party, district, committees, and contact information.`,
  inputSchema: z.object({
    legislatorId: z.string().describe("The legislator's OCD ID (e.g., 'ocd-person/...')"),
  }),
  execute: async ({ context }) => {
    const { legislatorId } = context;

    try {
      const encodedId = encodeURIComponent(legislatorId);
      const response = await fetch(`${BILLS_SERVICE}/state-legislators/${encodedId}`);

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            legislator: null,
            error: `State legislator not found: ${legislatorId}`,
          };
        }
        throw new Error(`Failed to fetch state legislator: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        legislator: result.legislator || result,
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        legislator: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Get State Legislator Voting Record Tool
 *
 * Get the voting record for a state legislator from OpenStates.
 */
export const getStateLegislatorVotingRecordTool = createTool({
  id: "getStateLegislatorVotingRecord",
  description: `Get the voting record for a state legislator. Shows how they voted on recent bills.`,
  inputSchema: z.object({
    legislatorId: z.string().describe("The legislator's OCD ID (e.g., 'ocd-person/...')"),
    limit: z.number().optional().default(50).describe("Max number of votes to return"),
  }),
  execute: async ({ context }) => {
    const { legislatorId, limit = 50 } = context;

    try {
      const encodedId = encodeURIComponent(legislatorId);
      const response = await fetch(
        `${BILLS_SERVICE}/state-legislators/${encodedId}/voting-record?limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch voting record: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        votes: result.votes || [],
        count: result.votes?.length || 0,
        legislator: result.legislator,
      };
    } catch (error) {
      return {
        success: false,
        votes: [],
        count: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Export all OpenStates tools as a collection
export const openstatesTools = {
  searchStateBills: searchStateBillsTool,
  getStateBillDetails: getStateBillDetailsTool,
  getStateLegislatorsByLocation: getStateLegislatorsByLocationTool,
  getStateLegislatorDetails: getStateLegislatorDetailsTool,
  getStateLegislatorVotingRecord: getStateLegislatorVotingRecordTool,
};
