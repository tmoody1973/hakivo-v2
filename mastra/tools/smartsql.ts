import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  robustFetch,
  billsCache,
  membersCache,
  measure,
  withErrorHandling,
} from "../../lib/api-utils";

/**
 * SmartSQL Tool for Hakivo Congressional Assistant
 *
 * This tool provides natural language database queries using the Raindrop
 * backend infrastructure. It wraps the bills-service and admin-dashboard
 * endpoints to provide intelligent bill and member lookups.
 *
 * Performance features:
 * - Retry logic with exponential backoff
 * - In-memory caching for frequently accessed data
 * - Request timeout handling
 * - Graceful error recovery
 *
 * Supported tables:
 * - bills: Federal legislation from Congress.gov
 * - bill_analysis: AI-generated bill analysis and summaries
 * - bill_tracking: User bill tracking preferences
 * - members: Congressional members (House and Senate)
 * - member_votes: How members voted on bills
 * - state_bills: State-level legislation from OpenStates
 * - state_legislators: State legislators
 * - votes: Bill vote records
 */

// Raindrop service URLs
const RAINDROP_SERVICES = {
  BILLS:
    process.env.NEXT_PUBLIC_BILLS_API_URL ||
    "https://svc-01ka8k5e6tr0kgy0jkzj9m4q16.01k66gywmx8x4r0w31fdjjfekf.lmapp.run",
  ADMIN:
    "https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run",
} as const;

// Result types
interface Bill {
  id: number;
  bill_id: string;
  congress: number;
  bill_type: string;
  bill_number: number;
  title: string;
  short_title?: string;
  sponsor_bioguide_id?: string;
  sponsor_name?: string;
  sponsor_party?: string;
  sponsor_state?: string;
  cosponsors_count: number;
  policy_area?: string;
  latest_action_text?: string;
  latest_action_date?: string;
  introduced_date?: string;
  summary?: string;
}

interface Member {
  bioguide_id: string;
  first_name: string;
  last_name: string;
  party: string;
  state: string;
  district?: number;
  chamber: string;
  image_url?: string;
  office_address?: string;
  phone?: string;
  url?: string;
}

interface StateBill {
  id: number;
  openstates_id: string;
  state: string;
  identifier: string;
  title: string;
  session: string;
  chamber?: string;
  subjects?: string[];
  latest_action_description?: string;
  latest_action_date?: string;
}

interface QueryResult {
  success: boolean;
  data: Bill[] | Member[] | StateBill[] | Record<string, unknown>[];
  count: number;
  query_type: string;
  sql_executed?: string;
  error?: string;
}

/**
 * Parse natural language query to determine intent and entities
 */
function parseNaturalQuery(query: string): {
  intent: "bills" | "members" | "state_bills" | "votes" | "custom";
  filters: Record<string, string | number | boolean>;
  keywords: string[];
} {
  const lowerQuery = query.toLowerCase();

  // Detect intent
  let intent: "bills" | "members" | "state_bills" | "votes" | "custom" =
    "bills";

  if (
    lowerQuery.includes("representative") ||
    lowerQuery.includes("senator") ||
    (lowerQuery.includes("member") && !lowerQuery.includes("member of")) ||
    lowerQuery.includes("congressperson") ||
    lowerQuery.includes("congresswoman") ||
    lowerQuery.includes("congressman") ||
    lowerQuery.includes("who voted") ||
    lowerQuery.includes("my rep") ||
    lowerQuery.includes("my senators") ||
    lowerQuery.includes("legislators")
  ) {
    intent = "members";
  } else if (
    lowerQuery.includes("state bill") ||
    lowerQuery.includes("state legislation") ||
    lowerQuery.match(/\b(texas|california|new york|florida)\b.*\bbill/)
  ) {
    intent = "state_bills";
  } else if (lowerQuery.includes("vote") || lowerQuery.includes("voted")) {
    intent = "votes";
  }

  // Extract filters
  const filters: Record<string, string | number | boolean> = {};

  // Congress number
  const congressMatch = lowerQuery.match(
    /(\d{3})(st|nd|rd|th)?\s*congress|congress\s*(\d{3})/i
  );
  if (congressMatch) {
    filters.congress = parseInt(congressMatch[1] || congressMatch[3]);
  }

  // State
  const stateAbbreviations: Record<string, string> = {
    alabama: "AL",
    alaska: "AK",
    arizona: "AZ",
    arkansas: "AR",
    california: "CA",
    colorado: "CO",
    connecticut: "CT",
    delaware: "DE",
    florida: "FL",
    georgia: "GA",
    hawaii: "HI",
    idaho: "ID",
    illinois: "IL",
    indiana: "IN",
    iowa: "IA",
    kansas: "KS",
    kentucky: "KY",
    louisiana: "LA",
    maine: "ME",
    maryland: "MD",
    massachusetts: "MA",
    michigan: "MI",
    minnesota: "MN",
    mississippi: "MS",
    missouri: "MO",
    montana: "MT",
    nebraska: "NE",
    nevada: "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    ohio: "OH",
    oklahoma: "OK",
    oregon: "OR",
    pennsylvania: "PA",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    tennessee: "TN",
    texas: "TX",
    utah: "UT",
    vermont: "VT",
    virginia: "VA",
    washington: "WA",
    "west virginia": "WV",
    wisconsin: "WI",
    wyoming: "WY",
  };

  for (const [stateName, abbrev] of Object.entries(stateAbbreviations)) {
    if (lowerQuery.includes(stateName)) {
      filters.state = abbrev;
      break;
    }
  }

  // Two-letter state code
  const stateCodeMatch = lowerQuery.match(
    /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i
  );
  if (stateCodeMatch && !filters.state) {
    filters.state = stateCodeMatch[1].toUpperCase();
  }

  // Party
  if (lowerQuery.includes("democrat") || lowerQuery.match(/\bdem\b/)) {
    filters.party = "D";
  } else if (
    lowerQuery.includes("republican") ||
    lowerQuery.match(/\brep\b/) ||
    lowerQuery.match(/\bgop\b/)
  ) {
    filters.party = "R";
  }

  // Chamber
  if (lowerQuery.includes("house") || lowerQuery.includes("representative")) {
    filters.chamber = "house";
  } else if (lowerQuery.includes("senate") || lowerQuery.includes("senator")) {
    filters.chamber = "senate";
  }

  // Policy areas / subjects
  const policyAreas = [
    "healthcare",
    "health",
    "education",
    "environment",
    "climate",
    "immigration",
    "economy",
    "tax",
    "defense",
    "military",
    "agriculture",
    "energy",
    "transportation",
    "housing",
    "crime",
    "civil rights",
    "foreign policy",
    "trade",
    "labor",
    "social security",
    "medicare",
    "medicaid",
  ];

  for (const area of policyAreas) {
    if (lowerQuery.includes(area)) {
      filters.subject = area;
      break;
    }
  }

  // Extract remaining keywords (remove stop words and filter words)
  const stopWords = [
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "as",
    "is",
    "was",
    "are",
    "were",
    "been",
    "be",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "shall",
    "can",
    "need",
    "dare",
    "ought",
    "used",
    "what",
    "which",
    "who",
    "whom",
    "this",
    "that",
    "these",
    "those",
    "am",
    "show",
    "me",
    "find",
    "search",
    "get",
    "list",
    "all",
    "any",
    "some",
    "no",
    "not",
    "only",
    "same",
    "so",
    "than",
    "too",
    "very",
    "just",
    "about",
    "bills",
    "bill",
    "legislation",
    "member",
    "members",
    "representative",
    "representatives",
    "senator",
    "senators",
  ];

  const keywords = lowerQuery
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.includes(word))
    .slice(0, 5);

  return { intent, filters, keywords };
}

/**
 * Search bills using the bills-service backend
 */
async function searchBills(
  filters: Record<string, string | number | boolean>,
  keywords: string[]
): Promise<QueryResult> {
  try {
    const params = new URLSearchParams();

    // Combine keywords and subject into query parameter
    const queryParts = [...keywords];
    if (filters.subject) {
      queryParts.push(String(filters.subject));
    }
    if (queryParts.length > 0) {
      params.set("query", queryParts.join(" "));
    }
    if (filters.congress) {
      params.set("congress", String(filters.congress));
    }
    params.set("limit", "20");
    params.set("sort", "latest_action_date");
    params.set("order", "desc");

    const url = `${RAINDROP_SERVICES.BILLS}/bills/search?${params.toString()}`;

    // Check cache first (30 second TTL for search results)
    const cacheKey = `bills_search:${params.toString()}`;
    const cached = billsCache.get<QueryResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await measure("bills_search", () =>
      robustFetch(url, { timeout: 8000, maxRetries: 2 })
    );

    if (!response.ok) {
      throw new Error(`Bills search failed: ${response.statusText}`);
    }

    const result = await response.json();
    const bills = result.bills || [];

    const queryResult: QueryResult = {
      success: true,
      data: bills,
      count: bills.length,
      query_type: "bills_search",
    };

    // Cache the result
    billsCache.set(cacheKey, queryResult, 30000);

    return queryResult;
  } catch (error) {
    return {
      success: false,
      data: [],
      count: 0,
      query_type: "bills_search",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Search members using the bills-service backend
 */
async function searchMembers(
  filters: Record<string, string | number | boolean>,
  keywords: string[]
): Promise<QueryResult> {
  try {
    const params = new URLSearchParams();

    if (keywords.length > 0) {
      params.set("query", keywords.join(" "));
    }
    if (filters.state) {
      params.set("state", String(filters.state));
    }
    if (filters.party) {
      params.set("party", String(filters.party));
    }
    if (filters.chamber) {
      params.set("chamber", String(filters.chamber));
    }
    params.set("currentOnly", "true");
    params.set("limit", "20");

    const url = `${RAINDROP_SERVICES.BILLS}/members/search?${params.toString()}`;

    // Check cache first (60 second TTL for members - they change less frequently)
    const cacheKey = `members_search:${params.toString()}`;
    const cached = membersCache.get<QueryResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await measure("members_search", () =>
      robustFetch(url, { timeout: 8000, maxRetries: 2 })
    );

    if (!response.ok) {
      throw new Error(`Members search failed: ${response.statusText}`);
    }

    const result = await response.json();
    const members = result.members || result || [];

    const queryResult: QueryResult = {
      success: true,
      data: members,
      count: members.length,
      query_type: "members_search",
    };

    // Cache the result
    membersCache.set(cacheKey, queryResult, 60000);

    return queryResult;
  } catch (error) {
    return {
      success: false,
      data: [],
      count: 0,
      query_type: "members_search",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Search state bills using the bills-service backend
 */
async function searchStateBills(
  filters: Record<string, string | number | boolean>,
  keywords: string[]
): Promise<QueryResult> {
  try {
    if (!filters.state) {
      return {
        success: false,
        data: [],
        count: 0,
        query_type: "state_bills_search",
        error: "State is required for state bill searches",
      };
    }

    const params = new URLSearchParams();
    params.set("state", String(filters.state));

    if (keywords.length > 0) {
      params.set("query", keywords.join(" "));
    }
    if (filters.subject) {
      params.set("subject", String(filters.subject));
    }
    params.set("limit", "20");

    const response = await fetch(
      `${RAINDROP_SERVICES.BILLS}/state-bills?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`State bills search failed: ${response.statusText}`);
    }

    const result = await response.json();
    const bills = result.bills || [];

    return {
      success: true,
      data: bills,
      count: bills.length,
      query_type: "state_bills_search",
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      count: 0,
      query_type: "state_bills_search",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Execute custom SQL query via admin-dashboard (for advanced queries)
 */
async function executeCustomQuery(sql: string): Promise<QueryResult> {
  try {
    const response = await fetch(
      `${RAINDROP_SERVICES.ADMIN}/api/database/query`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql, limit: 100 }),
      }
    );

    if (!response.ok) {
      throw new Error(`Custom query failed: ${response.statusText}`);
    }

    const result = await response.json();
    const data = result.results || result.rows || [];

    return {
      success: true,
      data,
      count: data.length,
      query_type: "custom_sql",
      sql_executed: sql,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      count: 0,
      query_type: "custom_sql",
      sql_executed: sql,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * SmartSQL Tool - Natural language database queries
 *
 * Translates natural language questions into database queries against
 * the Hakivo congressional data. Uses the Raindrop backend for execution.
 */
export const smartSqlTool = createTool({
  id: "smartSql",
  description: `Search the Hakivo database using natural language. Supports queries about:
- Federal bills: "Show me healthcare bills from the 119th Congress"
- Members: "Find Democratic senators from California"
- State bills: "Texas education legislation"
- Votes: "How did my representative vote on H.R. 1234"

The tool automatically parses your query to determine the best search approach.`,
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Natural language query, e.g., 'healthcare bills from 2024' or 'senators from Texas'"
      ),
    customSql: z
      .string()
      .optional()
      .describe(
        "Advanced: Direct SQL query if natural language parsing is insufficient"
      ),
  }),
  execute: async ({ context }) => {
    const { query, customSql } = context;

    // If custom SQL is provided, execute directly
    if (customSql) {
      return executeCustomQuery(customSql);
    }

    // Parse natural language query
    const { intent, filters, keywords } = parseNaturalQuery(query);

    // Route to appropriate search function
    switch (intent) {
      case "members":
        return searchMembers(filters, keywords);
      case "state_bills":
        return searchStateBills(filters, keywords);
      case "votes":
        // For vote queries, search members or bills depending on context
        if (filters.state || keywords.some((k) => k.includes("senator"))) {
          return searchMembers(filters, keywords);
        }
        return searchBills(filters, keywords);
      case "bills":
      default:
        return searchBills(filters, keywords);
    }
  },
});

/**
 * Bill Detail Tool - Get comprehensive bill information
 */
export const getBillDetailTool = createTool({
  id: "getBillDetail",
  description:
    "Get comprehensive details about a specific federal bill including analysis, sponsors, and actions.",
  inputSchema: z.object({
    congress: z.number().describe("Congress number, e.g., 118 or 119"),
    billType: z
      .string()
      .describe("Bill type: hr, s, hjres, sjres, hconres, sconres, hres, sres"),
    billNumber: z.number().describe("Bill number"),
  }),
  execute: async ({ context }) => {
    const { congress, billType, billNumber } = context;
    const cacheKey = `bill_detail:${congress}:${billType}:${billNumber}`;

    // Check cache first (5 minute TTL for bill details)
    const cached = billsCache.get<{ success: boolean; bill: unknown; error: string | null }>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = `${RAINDROP_SERVICES.BILLS}/bills/${congress}/${billType}/${billNumber}`;
      const response = await measure("get_bill_detail", () =>
        robustFetch(url, { timeout: 10000, maxRetries: 2 })
      );

      if (!response.ok) {
        return {
          success: false,
          bill: null,
          error: `Bill not found: ${congress}-${billType}-${billNumber}`,
        };
      }

      const bill = await response.json();
      const result = {
        success: true,
        bill,
        error: null,
      };

      // Cache for 5 minutes
      billsCache.set(cacheKey, result, 300000);

      return result;
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
 * Member Detail Tool - Get comprehensive member information
 */
export const getMemberDetailTool = createTool({
  id: "getMemberDetail",
  description:
    "Get detailed information about a specific congressional member by bioguide ID.",
  inputSchema: z.object({
    bioguideId: z.string().describe("Bioguide ID of the member, e.g., P000197"),
  }),
  execute: async ({ context }) => {
    const { bioguideId } = context;
    const cacheKey = `member_detail:${bioguideId}`;

    // Check cache first (10 minute TTL for member details - they rarely change)
    const cached = membersCache.get<{ success: boolean; member: unknown; error: string | null }>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = `${RAINDROP_SERVICES.BILLS}/members/${bioguideId}`;
      const response = await measure("get_member_detail", () =>
        robustFetch(url, { timeout: 10000, maxRetries: 2 })
      );

      if (!response.ok) {
        return {
          success: false,
          member: null,
          error: `Member not found: ${bioguideId}`,
        };
      }

      const member = await response.json();
      const result = {
        success: true,
        member,
        error: null,
      };

      // Cache for 10 minutes
      membersCache.set(cacheKey, result, 600000);

      return result;
    } catch (error) {
      return {
        success: false,
        member: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Export all SmartSQL tools
export const smartSqlTools = {
  smartSql: smartSqlTool,
  getBillDetail: getBillDetailTool,
  getMemberDetail: getMemberDetailTool,
};
