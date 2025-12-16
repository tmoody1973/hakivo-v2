/**
 * Member Search Tool for C1/Thesys
 *
 * Searches for members of Congress by name, state, party, chamber, or role.
 * Returns structured JSON data - the model decides how to format as C1 components.
 */

import type { RunnableToolFunctionWithParse } from "openai/lib/RunnableFunction.mjs";
import type { JSONSchema } from "openai/lib/jsonschema.mjs";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { WriteProgress, MemberSearchResult, Member } from "./types";

// Raindrop service URLs
const RAINDROP_SERVICES = {
  BILLS:
    process.env.NEXT_PUBLIC_BILLS_API_URL ||
    "https://svc-01kc6rbecv0s5k4yk6ksdaqyzh.01k66gywmx8x4r0w31fdjjfekf.lmapp.run",
} as const;

/**
 * Input schema for member search
 */
const memberSearchSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Search query - member name (e.g., 'Pelosi', 'Ted Cruz')"),
  state: z
    .string()
    .optional()
    .describe("Two-letter state code (e.g., 'CA', 'TX', 'NY')"),
  party: z
    .enum(["D", "R", "I"])
    .optional()
    .describe("Party affiliation: D (Democrat), R (Republican), I (Independent)"),
  chamber: z
    .enum(["house", "senate"])
    .optional()
    .describe("Chamber: 'house' for Representatives, 'senate' for Senators"),
  currentOnly: z
    .boolean()
    .optional()
    .describe("Only return current members (default: true)"),
  limit: z.number().optional().describe("Maximum results to return (default: 20)"),
});

type MemberSearchInput = z.infer<typeof memberSearchSchema>;

/**
 * Search members using the bills-service API
 */
async function searchMembersApi(
  options: {
    query?: string;
    state?: string;
    party?: string;
    chamber?: string;
    currentOnly?: boolean;
    limit?: number;
  }
): Promise<MemberSearchResult> {
  try {
    const params = new URLSearchParams();

    if (options.query) {
      params.set("query", options.query);
    }
    if (options.state) {
      params.set("state", options.state.toUpperCase());
    }
    if (options.party) {
      params.set("party", options.party);
    }
    if (options.chamber) {
      params.set("chamber", options.chamber);
    }
    params.set("currentOnly", String(options.currentOnly ?? true));
    params.set("limit", String(options.limit || 20));

    const url = `${RAINDROP_SERVICES.BILLS}/members/search?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Members search failed: ${response.statusText}`);
    }

    const result = await response.json();
    const members = (result.members || result || []) as Member[];

    return {
      success: true,
      members: members.map(member => ({
        bioguide_id: member.bioguide_id,
        name: member.name || `${member.first_name} ${member.last_name}`,
        first_name: member.first_name,
        last_name: member.last_name,
        party: member.party,
        state: member.state,
        district: member.district,
        chamber: member.chamber,
        title: getTitle(member),
        image_url: member.image_url,
        office: member.office,
        phone: member.phone,
        website: member.website,
        leadership_role: member.leadership_role,
        committees: member.committees,
        sponsored_bills_count: member.sponsored_bills_count,
      })),
      count: members.length,
      query: options.query,
    };
  } catch (error) {
    return {
      success: false,
      members: [],
      count: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get member detail by bioguide ID
 */
async function getMemberDetail(bioguideId: string): Promise<Member | null> {
  try {
    const url = `${RAINDROP_SERVICES.BILLS}/members/${bioguideId}`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return await response.json() as Member;
  } catch {
    return null;
  }
}

/**
 * Get proper title for member
 */
function getTitle(member: Member): string {
  if (member.title) return member.title;

  const chamber = member.chamber?.toLowerCase();
  if (chamber === "senate") {
    return "Senator";
  } else if (chamber === "house") {
    return "Representative";
  }

  return "Member";
}

/**
 * Format party name from code
 */
export function formatParty(partyCode: string): string {
  const parties: Record<string, string> = {
    D: "Democrat",
    R: "Republican",
    I: "Independent",
    Democrat: "Democrat",
    Democratic: "Democrat",
    Republican: "Republican",
    Independent: "Independent",
  };
  return parties[partyCode] || partyCode;
}

/**
 * Format state name from code
 */
const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia", PR: "Puerto Rico", VI: "Virgin Islands", GU: "Guam",
  AS: "American Samoa", MP: "Northern Mariana Islands",
};

export function formatStateName(stateCode: string): string {
  return STATE_NAMES[stateCode.toUpperCase()] || stateCode;
}

/**
 * Creates the member search tool for C1/OpenAI format
 */
export const createSearchMembersTool = (
  writeProgress?: WriteProgress
): RunnableToolFunctionWithParse<MemberSearchInput> => ({
  type: "function",
  function: {
    name: "searchMembers",
    description: `Search for members of Congress by name, state, party, or chamber.

USE THIS TOOL when the user asks about:
- Specific members ("Who is Nancy Pelosi?", "Tell me about Ted Cruz")
- Representatives for a state ("Who are the senators from Texas?")
- Members by party ("Democratic senators", "Republican representatives")
- Finding their representatives ("Who represents California?")
- Bill sponsors or cosponsors

Returns: Member names, party, state, chamber, leadership roles, committee assignments, and photos.

Supports filtering by:
- state: Two-letter code (CA, TX, NY)
- party: D (Democrat), R (Republican), I (Independent)
- chamber: house, senate`,
    parse: JSON.parse,
    parameters: zodToJsonSchema(memberSearchSchema) as JSONSchema,
    function: async ({
      query,
      state,
      party,
      chamber,
      currentOnly = true,
      limit = 20,
    }: MemberSearchInput): Promise<MemberSearchResult> => {
      try {
        // Validate that at least one search parameter is provided
        if (!query && !state && !party && !chamber) {
          return {
            success: false,
            members: [],
            count: 0,
            error: "Please provide at least one search parameter: query, state, party, or chamber",
          };
        }

        writeProgress?.({
          title: "Searching Members",
          content: query
            ? `Looking for members matching: ${query}`
            : `Searching ${chamber || "Congress"}${state ? ` from ${formatStateName(state)}` : ""}`,
        });

        // Check if query looks like a bioguide ID (e.g., P000197)
        if (query && /^[A-Z]\d{6}$/i.test(query.trim())) {
          const member = await getMemberDetail(query.trim().toUpperCase());
          if (member) {
            writeProgress?.({
              title: "Found Member",
              content: `Retrieved ${member.name || `${member.first_name} ${member.last_name}`}`,
            });
            return {
              success: true,
              members: [{
                bioguide_id: member.bioguide_id,
                name: member.name || `${member.first_name} ${member.last_name}`,
                party: member.party,
                state: member.state,
                district: member.district,
                chamber: member.chamber,
                title: getTitle(member),
                image_url: member.image_url,
                office: member.office,
                phone: member.phone,
                website: member.website,
                leadership_role: member.leadership_role,
                committees: member.committees,
                sponsored_bills_count: member.sponsored_bills_count,
              }],
              count: 1,
            };
          }
        }

        // General search
        const result = await searchMembersApi({
          query,
          state,
          party,
          chamber,
          currentOnly,
          limit,
        });

        writeProgress?.({
          title: "Search Complete",
          content: `Found ${result.count} members`,
        });

        return result;
      } catch (error) {
        console.error("[searchMembers] Error:", error);
        return {
          success: false,
          members: [],
          count: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    strict: true,
  },
});

/**
 * Default export without progress callback
 */
export const searchMembersTool = createSearchMembersTool();
