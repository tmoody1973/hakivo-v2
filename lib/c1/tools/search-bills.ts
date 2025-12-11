/**
 * Bill Search Tool for C1/Thesys
 *
 * Searches Congressional bills by topic, keyword, bill number, or sponsor.
 * Returns structured JSON data - the model decides how to format as C1 components.
 */

import type { RunnableToolFunctionWithParse } from "openai/lib/RunnableFunction.mjs";
import type { JSONSchema } from "openai/lib/jsonschema.mjs";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { WriteProgress, BillSearchResult, Bill } from "./types";

// Raindrop service URLs
const RAINDROP_SERVICES = {
  BILLS:
    process.env.NEXT_PUBLIC_BILLS_API_URL ||
    "https://svc-01kc6rbecv0s5k4yk6ksdaqyz16.01k66gywmx8x4r0w31fdjjfekf.lmapp.run",
  ADMIN:
    "https://svc-01kc6rbecv0s5k4yk6ksdaqyz1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run",
} as const;

/**
 * Input schema for bill search
 */
const billSearchSchema = z.object({
  query: z.string().describe("Search query - can be topic keywords, bill number (e.g., 'HR 1234'), or sponsor name"),
  congress: z
    .number()
    .optional()
    .describe("Congress number (e.g., 119 for current, 118 for previous). Default: 119"),
  chamber: z
    .enum(["house", "senate", "both"])
    .optional()
    .describe("Filter by chamber of origin"),
  policyArea: z
    .string()
    .optional()
    .describe("Filter by policy area (e.g., 'Health', 'Immigration', 'Environment')"),
  limit: z.number().optional().describe("Maximum results to return (default: 10)"),
});

type BillSearchInput = z.infer<typeof billSearchSchema>;

/**
 * Search bills using the bills-service API
 */
async function searchBillsApi(
  query: string,
  options: {
    congress?: number;
    chamber?: string;
    policyArea?: string;
    limit?: number;
  }
): Promise<BillSearchResult> {
  try {
    const params = new URLSearchParams();
    params.set("query", query);

    if (options.congress) {
      params.set("congress", String(options.congress));
    }
    if (options.policyArea) {
      params.set("policyArea", options.policyArea);
    }
    params.set("limit", String(options.limit || 10));
    params.set("sort", "latest_action_date");
    params.set("order", "desc");

    const url = `${RAINDROP_SERVICES.BILLS}/bills/search?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Bills search failed: ${response.statusText}`);
    }

    const result = await response.json();
    const bills = (result.bills || []) as Bill[];

    // Filter by chamber if specified
    let filteredBills = bills;
    if (options.chamber && options.chamber !== "both") {
      const chamberTypes = options.chamber === "house"
        ? ["hr", "hres", "hjres", "hconres"]
        : ["s", "sres", "sjres", "sconres"];
      filteredBills = bills.filter(bill =>
        chamberTypes.includes(bill.bill_type?.toLowerCase() || "")
      );
    }

    return {
      success: true,
      bills: filteredBills.map(bill => ({
        id: bill.id,
        congress: bill.congress,
        bill_type: bill.bill_type,
        bill_number: bill.bill_number,
        title: bill.title || bill.short_title || "Untitled",
        short_title: bill.short_title,
        sponsor_name: bill.sponsor_name,
        sponsor_party: bill.sponsor_party,
        sponsor_state: bill.sponsor_state,
        sponsor_bioguide_id: bill.sponsor_bioguide_id,
        cosponsors_count: bill.cosponsors_count,
        policy_area: bill.policy_area,
        introduced_date: bill.introduced_date,
        latest_action_text: bill.latest_action_text,
        latest_action_date: bill.latest_action_date,
        summary: bill.summary,
      })),
      count: filteredBills.length,
      query,
    };
  } catch (error) {
    return {
      success: false,
      bills: [],
      count: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get specific bill by congress/type/number
 */
async function getBillDetail(
  congress: number,
  billType: string,
  billNumber: number
): Promise<Bill | null> {
  try {
    const url = `${RAINDROP_SERVICES.BILLS}/bills/${congress}/${billType}/${billNumber}`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return await response.json() as Bill;
  } catch {
    return null;
  }
}

/**
 * Parse bill number from query (e.g., "HR 1234", "S. 567")
 */
function parseBillNumber(query: string): { congress?: number; billType?: string; billNumber?: number } | null {
  // Pattern: H.R. 1234, HR1234, S. 567, S567, etc.
  const match = query.match(/^(h\.?r\.?|s\.?|hjres|sjres|hconres|sconres|hres|sres)\s*(\d+)$/i);
  if (!match) return null;

  const typeMap: Record<string, string> = {
    "hr": "hr",
    "h.r.": "hr",
    "h.r": "hr",
    "s": "s",
    "s.": "s",
    "hjres": "hjres",
    "sjres": "sjres",
    "hconres": "hconres",
    "sconres": "sconres",
    "hres": "hres",
    "sres": "sres",
  };

  const billType = typeMap[match[1].toLowerCase().replace(/\.$/, "")];
  const billNumber = parseInt(match[2], 10);

  return { billType, billNumber };
}

/**
 * Creates the bill search tool for C1/OpenAI format
 */
export const createSearchBillsTool = (
  writeProgress?: WriteProgress
): RunnableToolFunctionWithParse<BillSearchInput> => ({
  type: "function",
  function: {
    name: "searchBills",
    description: `Search Congressional bills by topic, keyword, bill number, or sponsor.

USE THIS TOOL when the user asks about:
- Specific bills (e.g., "What is HR 1234?")
- Legislation on a topic (e.g., "healthcare bills", "immigration legislation")
- What Congress is working on
- Bills sponsored by a specific person
- Recent legislative activity

Returns: Bill numbers (H.R., S., etc.), titles, sponsors, cosponsors, status, policy areas, and latest actions.

Can filter by Congress (e.g., 119th current, 118th previous) and chamber (House/Senate).`,
    parse: JSON.parse,
    parameters: zodToJsonSchema(billSearchSchema) as JSONSchema,
    function: async ({
      query,
      congress = 119,
      chamber,
      policyArea,
      limit = 10,
    }: BillSearchInput): Promise<BillSearchResult> => {
      try {
        writeProgress?.({
          title: "Searching Bills",
          content: `Looking for bills matching: ${query}`,
        });

        // Check if query is a specific bill number
        const parsed = parseBillNumber(query.trim());
        if (parsed?.billType && parsed.billNumber) {
          // Fetch specific bill
          const bill = await getBillDetail(congress, parsed.billType, parsed.billNumber);
          if (bill) {
            writeProgress?.({
              title: "Found Bill",
              content: `Retrieved ${parsed.billType.toUpperCase()} ${parsed.billNumber}`,
            });
            return {
              success: true,
              bills: [bill],
              count: 1,
              query,
            };
          }
        }

        // General search
        const result = await searchBillsApi(query, {
          congress,
          chamber,
          policyArea,
          limit,
        });

        writeProgress?.({
          title: "Search Complete",
          content: `Found ${result.count} bills`,
        });

        return result;
      } catch (error) {
        console.error("[searchBills] Error:", error);
        return {
          success: false,
          bills: [],
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
export const searchBillsTool = createSearchBillsTool();

/**
 * Utility: Format bill number for display
 */
export function formatBillNumber(billType: string, billNumber: number): string {
  const typeLabels: Record<string, string> = {
    hr: "H.R.",
    s: "S.",
    hjres: "H.J.Res.",
    sjres: "S.J.Res.",
    hconres: "H.Con.Res.",
    sconres: "S.Con.Res.",
    hres: "H.Res.",
    sres: "S.Res.",
  };
  return `${typeLabels[billType.toLowerCase()] || billType.toUpperCase()} ${billNumber}`;
}
