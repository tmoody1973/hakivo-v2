import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { billSearchResultsTemplate } from "./c1-templates";

/**
 * SmartBucket Tool for Hakivo Congressional Assistant
 *
 * This tool provides semantic search and RAG (Retrieval Augmented Generation)
 * over bill text documents stored in Raindrop SmartBucket.
 *
 * Features:
 * - Semantic search across all indexed bill text
 * - Chunk-level search for precise content retrieval
 * - Q&A about specific bills using document chat
 * - Similarity scoring for relevance ranking
 */

// Raindrop service URL for bills
const BILLS_SERVICE_URL =
  process.env.NEXT_PUBLIC_BILLS_API_URL ||
  "https://svc-01kc6rbecv0s5k4yk6ksdaqyz16.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

// Result types
interface SemanticSearchResult {
  source: string;
  content: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

interface BillTextSearchResult {
  success: boolean;
  query: string;
  bills: Array<{
    id: number;
    bill_id: string;
    congress: number;
    bill_type: string;
    bill_number: number;
    title: string;
    short_title?: string;
    sponsor_name?: string;
    sponsor_party?: string;
    sponsor_state?: string;
    policy_area?: string;
    latest_action_text?: string;
    latest_action_date?: string;
    similarity_score: number;
    matched_content?: string;
  }>;
  count: number;
}

interface ChunkSearchResult {
  success: boolean;
  query: string;
  chunks: Array<{
    content: string;
    source: string;
    similarity: number;
    bill_info?: {
      congress: number;
      bill_type: string;
      bill_number: number;
    };
  }>;
  count: number;
}

/**
 * Normalize bill data from API response to expected interface
 * API returns: type, number, policyArea, sponsor (nested)
 * Template expects: bill_type, bill_number, policy_area, sponsor_name, sponsor_party, sponsor_state
 */
function normalizeBill(bill: Record<string, unknown>): Record<string, unknown> {
  const sponsor = bill.sponsor as Record<string, unknown> | undefined;
  const latestAction = bill.latestAction as Record<string, unknown> | undefined;
  return {
    ...bill,
    bill_type: bill.type || bill.bill_type,
    bill_number: bill.number || bill.bill_number,
    policy_area: bill.policyArea || bill.policy_area,
    sponsor_name: sponsor ? `${sponsor.firstName} ${sponsor.lastName}` : (bill.sponsor_name || undefined),
    sponsor_party: sponsor?.party || bill.sponsor_party,
    sponsor_state: sponsor?.state || bill.sponsor_state,
    latest_action_text: latestAction?.text || bill.latest_action_text,
    latest_action_date: latestAction?.date || bill.latest_action_date,
    similarity_score: bill.relevanceScore || bill.similarity_score,
    matched_content: bill.matchedChunk || bill.matched_content,
  };
}

/**
 * Semantic Search Tool - Search bill text using natural language
 *
 * Uses SmartBucket vector search to find relevant bill content
 * based on semantic similarity rather than keyword matching.
 */
export const semanticSearchTool = createTool({
  id: "semanticSearch",
  description: `PREFERRED TOOL for searching bills by TOPIC or THEME.

USE THIS TOOL when user asks about:
- Topic-based searches: "agriculture bills", "healthcare legislation", "climate change bills"
- Theme searches: "bills about food safety", "legislation on renewable energy"
- Concept searches: "immigration reform", "tax incentives", "veteran benefits"

This tool uses AI-powered semantic similarity (meaning-based matching) which finds
relevant bills even when exact keywords don't match. It searches the full bill text,
not just titles.

Example queries:
- "agriculture or food legislation"
- "bills about protecting endangered species"
- "tax incentives for renewable energy"
- "healthcare coverage for veterans"
- "immigration reform pathways"

DO NOT use smartSql for topic searches - it uses keyword matching and will return no results.`,
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Natural language query describing what you're looking for in bill text"
      ),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum number of results to return (1-50)"),
    congress: z
      .number()
      .optional()
      .describe("Filter by Congress number. Use 119 for current (2025-2027), 118 for previous"),
  }),
  execute: async ({ context }) => {
    const { query, limit = 10, congress } = context;

    try {
      const response = await fetch(`${BILLS_SERVICE_URL}/bills/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          limit: Math.min(limit, 50),
          congress,
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          query,
          bills: [],
          count: 0,
          error: `Semantic search failed: ${response.statusText}`,
        };
      }

      const result = await response.json();
      const rawBills = result.bills || [];
      const bills = rawBills.map(normalizeBill);

      // Generate legislative aide-style summary
      const generateBriefingSummary = (bills: Array<Record<string, unknown>>, searchQuery: string): string => {
        if (bills.length === 0) {
          return `No legislation found matching "${searchQuery}".`;
        }

        // Analyze the bills to create a helpful summary
        const billTypes = new Map<string, number>();
        const sponsors = new Map<string, number>();
        const policyAreas = new Map<string, number>();

        for (const bill of bills) {
          // Count bill types (use normalized bill_type)
          const type = ((bill.bill_type || bill.type) as string)?.toUpperCase() || 'Unknown';
          billTypes.set(type, (billTypes.get(type) || 0) + 1);

          // Count sponsors by party (use normalized sponsor_party)
          const party = (bill.sponsor_party as string) || '';
          if (party) sponsors.set(party, (sponsors.get(party) || 0) + 1);

          // Count policy areas (use normalized policy_area)
          const area = (bill.policy_area as string) || '';
          if (area) policyAreas.set(area, (policyAreas.get(area) || 0) + 1);
        }

        // Build summary
        const parts: string[] = [];
        parts.push(`Found ${bills.length} bill${bills.length !== 1 ? 's' : ''} related to "${searchQuery}".`);

        // Bill type breakdown
        const typeBreakdown = Array.from(billTypes.entries())
          .map(([type, count]) => `${count} ${type}`)
          .join(', ');
        if (typeBreakdown) {
          parts.push(`Includes ${typeBreakdown}.`);
        }

        // Party breakdown if available
        const dems = sponsors.get('Democratic') || sponsors.get('Democrat') || sponsors.get('D') || 0;
        const reps = sponsors.get('Republican') || sponsors.get('R') || 0;
        if (dems > 0 || reps > 0) {
          const partyParts = [];
          if (dems > 0) partyParts.push(`${dems} Democratic`);
          if (reps > 0) partyParts.push(`${reps} Republican`);
          parts.push(`Sponsored by ${partyParts.join(' and ')} member${dems + reps > 1 ? 's' : ''}.`);
        }

        // Top policy area
        const topArea = Array.from(policyAreas.entries()).sort((a, b) => b[1] - a[1])[0];
        if (topArea && topArea[0]) {
          parts.push(`Primary policy focus: ${topArea[0]}.`);
        }

        return parts.join(' ');
      };

      const summary = generateBriefingSummary(bills, query);

      // Generate C1 template for rich UI rendering
      const c1Template = billSearchResultsTemplate(bills, {
        query,
        count: bills.length,
        source: "semantic",
      });

      return {
        success: true,
        query,
        bills,
        count: bills.length,
        summary, // Legislative aide-style briefing
        // C1 template for frontend rendering
        c1Template,
        templateType: "billSearchResults",
      };
    } catch (error) {
      return {
        success: false,
        query,
        bills: [],
        count: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Bill Text RAG Tool - Answer questions about specific bill content
 *
 * Retrieves relevant bill text chunks and provides context for
 * answering detailed questions about legislation.
 */
export const billTextRagTool = createTool({
  id: "billTextRag",
  description: `Retrieve relevant sections from bill text to answer detailed questions.
This tool searches the full text of legislation to find specific provisions,
definitions, requirements, or other details.

Best for questions like:
- "What does this bill say about funding levels?"
- "What exemptions are included?"
- "What are the enforcement mechanisms?"
- "How does this define 'qualified organization'?"`,
  inputSchema: z.object({
    query: z
      .string()
      .describe("Question or topic to search for in bill text"),
    congress: z
      .number()
      .optional()
      .describe("Congress number to search within"),
    billType: z
      .string()
      .optional()
      .describe("Filter by bill type: hr, s, hjres, sjres, etc."),
    billNumber: z
      .number()
      .optional()
      .describe(
        "Search within a specific bill number (requires billType and congress)"
      ),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe("Number of text chunks to retrieve"),
  }),
  execute: async ({ context }) => {
    const { query, congress, billType, billNumber, limit = 5 } = context;

    try {
      // If searching within a specific bill, construct bill ID
      let searchParams: Record<string, unknown> = {
        query,
        limit: Math.min(limit, 20),
      };

      if (congress && billType && billNumber) {
        searchParams.billFilter = {
          congress,
          bill_type: billType.toLowerCase(),
          bill_number: billNumber,
        };
      } else if (congress) {
        searchParams.congress = congress;
      }

      // Call semantic search endpoint
      const response = await fetch(`${BILLS_SERVICE_URL}/bills/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searchParams),
      });

      if (!response.ok) {
        return {
          success: false,
          query,
          context: "",
          sources: [],
          error: `RAG retrieval failed: ${response.statusText}`,
        };
      }

      const result = await response.json();
      const rawBills = result.bills || [];
      const bills = rawBills.map(normalizeBill);

      // Format the retrieved content as context
      const contextParts: string[] = [];
      const sources: Array<{
        bill_id: string;
        title: string;
        similarity: number;
      }> = [];

      for (const bill of bills.slice(0, limit)) {
        const billId = `${bill.congress}-${bill.bill_type}-${bill.bill_number}`;
        contextParts.push(
          `## ${billId}: ${bill.title}\n${bill.matched_content || bill.short_title || ""}`
        );
        sources.push({
          bill_id: billId,
          title: bill.title as string,
          similarity: bill.similarity_score as number,
        });
      }

      return {
        success: true,
        query,
        context: contextParts.join("\n\n---\n\n"),
        sources,
        count: sources.length,
      };
    } catch (error) {
      return {
        success: false,
        query,
        context: "",
        sources: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Compare Bills Tool - Find and compare similar legislation
 *
 * Uses semantic similarity to find related bills and compare their content.
 */
export const compareBillsTool = createTool({
  id: "compareBills",
  description: `Find bills that are similar to a given bill or topic.
Useful for:
- Finding competing/companion legislation
- Tracking bills on similar topics
- Comparing approaches to the same issue across Congress sessions`,
  inputSchema: z.object({
    topic: z
      .string()
      .describe("Topic or description to find similar bills for"),
    congress: z
      .number()
      .optional()
      .describe("Limit search to specific Congress"),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe("Number of similar bills to return"),
  }),
  execute: async ({ context }) => {
    const { topic, congress, limit = 5 } = context;

    try {
      const response = await fetch(`${BILLS_SERVICE_URL}/bills/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: topic,
          limit: Math.min(limit, 20),
          congress,
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          topic,
          similar_bills: [],
          error: `Comparison search failed: ${response.statusText}`,
        };
      }

      const result = await response.json();
      const rawBills = result.bills || [];
      const bills = rawBills.map(normalizeBill);

      const similarBills = bills.map((bill: Record<string, unknown>) => ({
        bill_id: `${bill.congress}-${bill.bill_type}-${bill.bill_number}`,
        title: bill.title,
        short_title: bill.short_title,
        sponsor: bill.sponsor_name
          ? `${bill.sponsor_name} (${bill.sponsor_party}-${bill.sponsor_state})`
          : null,
        policy_area: bill.policy_area,
        similarity_score: bill.similarity_score,
        latest_action: bill.latest_action_text,
        latest_action_date: bill.latest_action_date,
      }));

      // Generate C1 template for rich UI rendering
      const c1Template = billSearchResultsTemplate(bills, {
        query: topic,
        count: similarBills.length,
        source: "comparison",
      });

      return {
        success: true,
        topic,
        similar_bills: similarBills,
        count: similarBills.length,
        c1Template,
        templateType: "billSearchResults",
      };
    } catch (error) {
      return {
        success: false,
        topic,
        similar_bills: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Policy Area Search Tool - Search within specific policy domains
 *
 * Combines semantic search with policy area filtering for
 * targeted legislative research.
 */
export const policyAreaSearchTool = createTool({
  id: "policyAreaSearch",
  description: `Search for bills within a specific policy area using semantic matching.
Combines policy domain filtering with natural language search.

Common policy areas: Healthcare, Education, Environment, Defense,
Immigration, Taxation, Foreign Relations, Criminal Justice,
Social Welfare, Agriculture, Energy, Transportation, Housing`,
  inputSchema: z.object({
    policyArea: z.string().describe("Policy area to search within"),
    query: z
      .string()
      .optional()
      .describe(
        "Additional natural language query to refine search within policy area"
      ),
    congress: z
      .number()
      .optional()
      .describe("Congress number to search within"),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum results to return"),
  }),
  execute: async ({ context }) => {
    const { policyArea, query, congress, limit = 10 } = context;

    try {
      // Combine policy area with query for semantic search
      const searchQuery = query
        ? `${policyArea}: ${query}`
        : `legislation about ${policyArea}`;

      const response = await fetch(`${BILLS_SERVICE_URL}/bills/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          limit: Math.min(limit, 50),
          congress,
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          policyArea,
          query,
          bills: [],
          error: `Policy area search failed: ${response.statusText}`,
        };
      }

      const result = await response.json();
      const rawBills = result.bills || [];
      const bills = rawBills.map(normalizeBill);

      // Generate C1 template for rich UI rendering
      const c1Template = billSearchResultsTemplate(bills, {
        query: query || policyArea,
        count: bills.length,
        source: "policyArea",
      });

      return {
        success: true,
        policyArea,
        query,
        bills,
        count: bills.length,
        c1Template,
        templateType: "billSearchResults",
      };
    } catch (error) {
      return {
        success: false,
        policyArea,
        query,
        bills: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Export all SmartBucket tools
export const smartBucketTools = {
  semanticSearch: semanticSearchTool,
  billTextRag: billTextRagTool,
  compareBills: compareBillsTool,
  policyAreaSearch: policyAreaSearchTool,
};
