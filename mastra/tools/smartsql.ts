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
  intent: "bills" | "members" | "state_bills" | "votes" | "sponsor_bills" | "custom";
  filters: Record<string, string | number | boolean>;
  keywords: string[];
  sponsorName?: string;
} {
  const lowerQuery = query.toLowerCase();

  // Detect intent
  let intent: "bills" | "members" | "state_bills" | "votes" | "sponsor_bills" | "custom" =
    "bills";
  let sponsorName: string | undefined;

  // Detect sponsor-based bill queries FIRST (before general intent detection)
  // Patterns: "bills sponsored by X", "X's bills", "what has X sponsored", "bills by X"
  const sponsorPatterns = [
    /bills?\s+(?:sponsored|introduced|authored)\s+by\s+([a-z]+(?:\s+[a-z]+)?)/i,
    /(?:sponsored|introduced|authored)\s+by\s+([a-z]+(?:\s+[a-z]+)?)/i,
    /what\s+(?:has|did)\s+([a-z]+(?:\s+[a-z]+)?)\s+(?:sponsored|introduce)/i,
    /([a-z]+(?:\s+[a-z]+)?)'s\s+bills?/i,
    /bills?\s+by\s+([a-z]+(?:\s+[a-z]+)?)/i,
    /([a-z]+(?:\s+[a-z]+)?)\s+(?:has\s+)?sponsored/i,
    /what\s+(?:is|are)\s+([a-z]+(?:\s+[a-z]+)?)\s+(?:working\s+on|doing|up\s+to)/i,
  ];

  for (const pattern of sponsorPatterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      // Extract sponsor name, filter out common words
      const name = match[1].trim();
      const commonWords = ['senator', 'rep', 'representative', 'congressman', 'congresswoman', 'the', 'a', 'an'];
      if (!commonWords.includes(name.toLowerCase())) {
        sponsorName = name;
        intent = "sponsor_bills";
        break;
      }
    }
  }

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

  return { intent, filters, keywords, sponsorName };
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
 * Search bills by sponsor name
 * First looks up the member to get bioguide_id, then queries bills
 */
async function searchBillsBySponsor(
  sponsorName: string,
  filters: Record<string, string | number | boolean>
): Promise<QueryResult> {
  try {
    // Step 1: Look up member by name
    // The search API works best with last names, so try extracting last name if full name fails
    let members: Array<{ bioguide_id: string; name?: string; first_name?: string; last_name?: string; party?: string; state?: string }> = [];

    // First try the full name
    const memberParams = new URLSearchParams();
    memberParams.set("query", sponsorName);
    memberParams.set("currentOnly", "true");
    memberParams.set("limit", "5");

    let memberUrl = `${RAINDROP_SERVICES.BILLS}/members/search?${memberParams.toString()}`;
    let memberResponse = await measure("sponsor_member_lookup", () =>
      robustFetch(memberUrl, { timeout: 8000, maxRetries: 2 })
    );

    if (memberResponse.ok) {
      const memberResult = await memberResponse.json();
      members = memberResult.members || memberResult || [];
    }

    // If no results and the name has multiple parts, try just the last name
    if (members.length === 0 && sponsorName.includes(" ")) {
      const nameParts = sponsorName.split(" ");
      const lastName = nameParts[nameParts.length - 1]; // Get last word as last name

      memberParams.set("query", lastName);
      memberUrl = `${RAINDROP_SERVICES.BILLS}/members/search?${memberParams.toString()}`;
      memberResponse = await measure("sponsor_member_lookup_lastname", () =>
        robustFetch(memberUrl, { timeout: 8000, maxRetries: 2 })
      );

      if (memberResponse.ok) {
        const memberResult = await memberResponse.json();
        members = memberResult.members || memberResult || [];
      }
    }

    if (members.length === 0) {
      return {
        success: true,
        data: [],
        count: 0,
        query_type: "sponsor_bills_search",
        error: `Could not find a member matching "${sponsorName}"`,
      };
    }

    // Use the first matching member
    const member = members[0];
    const bioguideId = member.bioguide_id;
    const memberName = member.name || `${member.first_name} ${member.last_name}`;

    // Step 2: Query bills by sponsor_bioguide_id using admin endpoint
    const congress = filters.congress || 119; // Default to current Congress
    const sql = `
      SELECT id, congress, bill_type, bill_number, title, introduced_date,
             latest_action_date, latest_action_text, policy_area, sponsor_bioguide_id
      FROM bills
      WHERE sponsor_bioguide_id = "${bioguideId}"
        AND congress = ${congress}
      ORDER BY introduced_date DESC
      LIMIT 20
    `;

    const billsResponse = await fetch(
      `${RAINDROP_SERVICES.ADMIN}/api/database/query`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql }),
      }
    );

    if (!billsResponse.ok) {
      throw new Error(`Bills query failed: ${billsResponse.statusText}`);
    }

    const billsResult = await billsResponse.json();
    const bills = billsResult.results || [];

    // Add sponsor name to each bill for display
    const enrichedBills = bills.map((bill: Record<string, unknown>) => ({
      ...bill,
      sponsor_name: memberName,
      sponsor_party: member.party,
      sponsor_state: member.state,
    }));

    return {
      success: true,
      data: enrichedBills,
      count: enrichedBills.length,
      query_type: "sponsor_bills_search",
      sql_executed: sql,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      count: 0,
      query_type: "sponsor_bills_search",
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
- Bills by sponsor: "What bills has Ted Cruz sponsored", "bills sponsored by Tammy Baldwin", "what is AOC working on"
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
    const { intent, filters, keywords, sponsorName } = parseNaturalQuery(query);

    // Route to appropriate search function
    switch (intent) {
      case "sponsor_bills":
        if (sponsorName) {
          return searchBillsBySponsor(sponsorName, filters);
        }
        // Fall through to regular bills search if no sponsor found
        return searchBills(filters, keywords);
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
    congress: z.number().describe("Congress number. Use 119 for current Congress (2025-2027), 118 for previous (2023-2025)"),
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

/**
 * User Profile interface for database results
 */
interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  zip_code: string | null;
  city: string | null;
  congressional_district: string | null;
  interests: string | null;
  policy_interests: string | null;
  state: string | null;
  district: string | null;
}

/**
 * Get User Profile Tool - Fetch user details and interests from Raindrop SQL
 *
 * This tool queries the users and user_preferences tables to get the current
 * user's profile, including their policy interests and location.
 */
export const getUserProfileTool = createTool({
  id: "getUserProfile",
  description: `Get the current user's profile including their policy interests, location, and preferences.
Use this tool when you need to personalize responses based on user interests or location.
The tool returns interests, policy_interests, state, district, and other user details.
If no email is provided, inform the user you need their email to look up their profile.`,
  inputSchema: z.object({
    email: z
      .string()
      .email()
      .describe("User's email address to look up their profile"),
  }),
  execute: async ({ context }) => {
    const { email } = context;

    if (!email) {
      return {
        success: false,
        profile: null,
        error: "No email provided. Please provide the user's email address.",
      };
    }

    try {
      // Query users table joined with user_preferences
      // Using parameterized-style escaping for safety
      const escapedEmail = email.replace(/'/g, "''");
      const sql = `
        SELECT
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.zip_code,
          u.city,
          u.congressional_district,
          up.interests,
          up.policy_interests,
          up.state,
          up.district
        FROM users u
        LEFT JOIN user_preferences up ON u.id = up.user_id
        WHERE u.email = '${escapedEmail}'
        LIMIT 1
      `;

      const response = await fetch(
        `${RAINDROP_SERVICES.ADMIN}/api/database/query`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: sql }),
        }
      );

      if (!response.ok) {
        throw new Error(`Database query failed: ${response.statusText}`);
      }

      const result = await response.json();
      const users = result.results || [];

      if (users.length === 0) {
        return {
          success: false,
          profile: null,
          error: `No user found with email: ${email}`,
        };
      }

      const user = users[0] as UserProfile;

      // Parse interests if they're stored as JSON strings
      let parsedInterests: string[] = [];
      let parsedPolicyInterests: string[] = [];

      if (user.interests) {
        try {
          parsedInterests = JSON.parse(user.interests);
        } catch {
          // If not JSON, treat as comma-separated or single value
          parsedInterests = user.interests.split(",").map((s: string) => s.trim());
        }
      }

      if (user.policy_interests) {
        try {
          parsedPolicyInterests = JSON.parse(user.policy_interests);
        } catch {
          parsedPolicyInterests = user.policy_interests.split(",").map((s: string) => s.trim());
        }
      }

      return {
        success: true,
        profile: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          zipCode: user.zip_code,
          city: user.city,
          congressionalDistrict: user.congressional_district,
          state: user.state,
          district: user.district,
          interests: parsedInterests,
          policyInterests: parsedPolicyInterests,
        },
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        profile: null,
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
  getUserProfile: getUserProfileTool,
};
