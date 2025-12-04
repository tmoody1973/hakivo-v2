import { createTool } from "@mastra/core/tools";
import { z } from "zod";

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
  "https://svc-01ka8k5e6tr0kgy0jkzj9m4q16.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

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
 * Semantic Search Tool - Search bill text using natural language
 *
 * Uses SmartBucket vector search to find relevant bill content
 * based on semantic similarity rather than keyword matching.
 */
export const semanticSearchTool = createTool({
  id: "semanticSearch",
  description: `Search through bill text documents using natural language queries.
This tool uses semantic similarity (meaning-based matching) rather than keyword matching,
so it can find relevant content even when exact words don't match.

Example queries:
- "legislation about protecting endangered species"
- "tax incentives for renewable energy"
- "healthcare coverage for veterans"
- "immigration reform pathways"`,
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
      return {
        success: true,
        query,
        bills: result.bills || [],
        count: result.bills?.length || 0,
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
      const bills = result.bills || [];

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
          title: bill.title,
          similarity: bill.similarity_score,
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
      const bills = result.bills || [];

      const similarBills = bills.map((bill: BillTextSearchResult["bills"][0]) => ({
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

      return {
        success: true,
        topic,
        similar_bills: similarBills,
        count: similarBills.length,
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

      return {
        success: true,
        policyArea,
        query,
        bills: result.bills || [],
        count: result.bills?.length || 0,
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
