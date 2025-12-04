import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Import SmartSQL tools (Phase 3 implementation)
import { smartSqlTool, getBillDetailTool, getMemberDetailTool } from "../tools/smartsql";
// Import SmartBucket tools (Phase 3 implementation)
import { semanticSearchTool, billTextRagTool, compareBillsTool, policyAreaSearchTool } from "../tools/smartbucket";
// Import SmartMemory tools (Phase 3 implementation)
import {
  getUserContextTool,
  getUserRepresentativesTool,
  getTrackedBillsTool,
  getConversationHistoryTool,
  storeWorkingMemoryTool,
  getBriefingTemplatesTool,
  getPersonalizedRecommendationsTool,
} from "../tools/smartmemory";
// Import Perplexity tools (replaces Tavily for web search)
import {
  searchNewsTool,
  searchCongressionalNewsTool,
  searchLegislatorNewsTool,
  webSearchTool,
} from "../tools/perplexity";
// Import OpenStates tools (Phase 4 implementation)
import {
  searchStateBillsTool as realSearchStateBillsTool,
  getStateBillDetailsTool,
  getStateLegislatorsByLocationTool,
  getStateLegislatorDetailsTool,
  getStateLegislatorVotingRecordTool,
} from "../tools/openstates";
// Import C1 Artifacts tools (Phase 4 implementation)
import {
  generateBillReportTool as realGenerateBillReportTool,
  generateBriefingSlidesTool,
} from "../tools/c1-artifacts";

/**
 * Congressional Assistant Agent
 *
 * A Mastra-powered AI agent that helps citizens understand and engage
 * with their federal and state governments. Uses thesys.dev C1 for
 * generative UI components and Raindrop for data storage/retrieval.
 */

// System prompt optimized for thesys C1 generative UI
export const congressionalSystemPrompt = `You are Hakivo, an intelligent, non-partisan congressional assistant that helps citizens understand and engage with their government.

## Your Identity
- Name: Hakivo
- Role: Congressional Assistant
- Tone: Professional, accessible, non-partisan, helpful
- Style: Conversational but informative, like a knowledgeable friend

## Core Capabilities
1. **Bill Information**: Search and explain bills in plain language using SmartSQL
2. **Representative Lookup**: Find representatives by location, show voting records
3. **Vote Tracking**: Display how representatives voted on specific bills
4. **Legislative Status**: Track where bills are in the legislative process
5. **News Context**: Provide current news about legislation via Tavily search
6. **State Legislation**: Track state-level bills and legislators via OpenStates
7. **Bill Tracking**: Let users track bills and get updates
8. **Audio Briefings**: Generate NPR-style audio summaries
9. **Reports & Presentations**: Generate detailed bill analysis reports and briefing slides

## Generative UI Components

IMPORTANT: When displaying bill, representative, or voting data, include interactive UI components DIRECTLY in your response (NOT in code blocks). The frontend will render these as interactive cards.

### BillCard - Use when showing bill information
Include this component inline in your response:
<BillCard billNumber="H.R. 1234" title="Bill Title" sponsor="Rep. Name (D-CA)" status="In Committee" lastAction="Referred to Committee" lastActionDate="2024-03-15" />

### RepresentativeProfile - Use when showing representative info
<RepresentativeProfile name="Senator Jane Smith" party="D" state="California" chamber="Senate" phone="(202) 555-1234" website="https://smith.senate.gov" />

### VotingChart - Use when showing vote breakdowns
<VotingChart billNumber="H.R. 1234" billTitle="Bill Title" result="Passed" yea={234} nay={201} present={0} notVoting={0} />

### BillTimeline - Use when showing bill progress
<BillTimeline billNumber="H.R. 1234" currentStage="Committee Review" introducedDate="2024-01-15" />

### NewsCard - Use when showing news articles
<NewsCard headline="Congress Passes Major Bill" source="NYT" date="2024-03-15" snippet="The House voted..." url="https://..." />

FORMAT RULES:
- Output components directly in text, NOT inside code blocks
- Use double quotes for string props: billNumber="H.R. 1234"
- Use curly braces for numbers: yea={234}
- Self-close all components with />
- Include natural language context before/after components

## Data Formatting Rules
1. Bill numbers: Use official format "H.R. 1234" or "S. 567"
2. Dates: Human-readable "March 15, 2024"
3. Votes: "Passed 234-201" or "Yea: 234 | Nay: 201 | Present: 0"
4. Percentages: One decimal "78.5%"
5. Status: Clear labels - "In Committee", "Passed House", "Awaiting Senate Vote", "Signed into Law"

## Response Structure
For complex queries:
1. **Direct Answer** - Brief summary (1-2 sentences)
2. **Visual Component** - Appropriate UI component with data
3. **Context** - Additional background if relevant
4. **Suggested Actions** - Interactive buttons for next steps

## User Context (from SmartMemory)
Access user preferences stored in memory:
- Location (state, district) - for "my representative" queries
- Tracked bills - highlight updates on these
- Policy interests - prioritize relevant information
- Conversation history - reference previous discussions

## Current Congressional Session
The current Congress is the **119th Congress** (January 2025 - January 2027).
- ALWAYS use congress=119 when searching for current legislation unless the user specifically asks about a previous Congress
- The 118th Congress was January 2023 - January 2025 (previous session)
- When users ask about "recent" or "current" bills, default to the 119th Congress

## Important Rules
1. **Non-partisan**: Present facts objectively, no political commentary
2. **Cite Sources**: Reference Congress.gov, OpenStates, official records
3. **Accessible Language**: Always explain legislative jargon
4. **Current Information**: Note when data might be outdated
5. **Actionable**: Always suggest what the user can do next
6. **Rich UI**: Prefer visual components over plain text when displaying data
7. **Current Congress**: Always use 119th Congress for current legislation queries`;

// Phase 3: SmartSQL tools are now imported from ../tools/smartsql
// Re-export for backwards compatibility
export { smartSqlTool as searchBillsTool } from "../tools/smartsql";
export { getBillDetailTool as getBillDetailsTool } from "../tools/smartsql";
export { getMemberDetailTool as getRepresentativeTool } from "../tools/smartsql";

// Note: searchStateBillsTool is exported via ../tools/index.ts
// Note: searchNewsTool is exported via ../tools/index.ts (perplexity)

/**
 * Track Bill Tool - Add bills to user's tracked list
 *
 * Uses the bills-service backend to track federal and state bills.
 * Tracked bills appear in the user's dashboard and they can receive
 * notifications for status updates.
 */
export const trackBillTool = createTool({
  id: "trackBill",
  description: `Track a federal or state bill for the user. Tracked bills appear in their dashboard and they can receive notifications for status updates.

For federal bills, provide: billId, congress, billType, billNumber
For state bills, provide: billId (OCD ID), state, identifier

Returns the tracking ID on success.`,
  inputSchema: z.object({
    billType: z.enum(["federal", "state"]).describe("Whether this is a federal or state bill"),
    // Federal bill params
    billId: z.union([z.number(), z.string()]).describe("Internal bill ID (number for federal, OCD ID string for state)"),
    congress: z.number().optional().describe("Congress number (federal bills only)"),
    federalBillType: z.string().optional().describe("Federal bill type: hr, s, hjres, sjres, etc."),
    billNumber: z.number().optional().describe("Bill number (federal bills only)"),
    // State bill params
    state: z.string().optional().describe("Two-letter state code (state bills only), e.g., 'CA', 'TX'"),
    identifier: z.string().optional().describe("State bill identifier (state bills only), e.g., 'SB 123'"),
    // Shared
    authToken: z.string().optional().describe("User auth token for authenticated request"),
    notify: z.boolean().optional().default(true).describe("Enable notifications for status updates"),
  }),
  execute: async ({ context }) => {
    const {
      billType,
      billId,
      congress,
      federalBillType,
      billNumber,
      state,
      identifier,
      authToken,
    } = context;

    const BILLS_SERVICE = process.env.NEXT_PUBLIC_BILLS_API_URL ||
      "https://svc-01ka8k5e6tr0kgy0jkzj9m4q16.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

    if (!authToken) {
      return {
        success: false,
        message: "Authentication required to track bills. Please sign in.",
        requiresAuth: true,
      };
    }

    try {
      if (billType === "federal") {
        // Validate federal bill params
        if (!congress || !federalBillType || !billNumber) {
          return {
            success: false,
            message: "Federal bills require congress, federalBillType, and billNumber",
          };
        }

        const response = await fetch(`${BILLS_SERVICE}/bills/track`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            billId: typeof billId === "number" ? billId : parseInt(String(billId)),
            congress,
            billType: federalBillType,
            billNumber,
          }),
        });

        if (!response.ok) {
          if (response.status === 409) {
            return {
              success: false,
              alreadyTracked: true,
              message: "This bill is already being tracked.",
            };
          }
          const error = await response.json().catch(() => ({ error: response.statusText }));
          return {
            success: false,
            message: error.error || "Failed to track bill",
          };
        }

        const result = await response.json();
        return {
          success: true,
          trackingId: result.trackingId,
          message: `Successfully tracking ${federalBillType.toUpperCase()} ${billNumber} from the ${congress}th Congress`,
          billType: "federal",
        };
      } else {
        // State bill tracking
        if (!state || !identifier) {
          return {
            success: false,
            message: "State bills require state code and identifier",
          };
        }

        const response = await fetch(`${BILLS_SERVICE}/state-bills/track`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            billId: String(billId),
            state: state.toUpperCase(),
            identifier,
          }),
        });

        if (!response.ok) {
          if (response.status === 409) {
            return {
              success: false,
              alreadyTracked: true,
              message: "This state bill is already being tracked.",
            };
          }
          const error = await response.json().catch(() => ({ error: response.statusText }));
          return {
            success: false,
            message: error.error || "Failed to track state bill",
          };
        }

        const result = await response.json();
        return {
          success: true,
          trackingId: result.trackingId,
          message: `Successfully tracking ${identifier} from ${state}`,
          billType: "state",
          state,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error tracking bill",
      };
    }
  },
});

/**
 * Untrack Bill Tool - Remove a bill from user's tracked list
 */
export const untrackBillTool = createTool({
  id: "untrackBill",
  description: "Remove a bill from the user's tracked list.",
  inputSchema: z.object({
    trackingId: z.string().describe("The tracking ID returned when the bill was tracked"),
    billType: z.enum(["federal", "state"]).describe("Whether this is a federal or state bill"),
    authToken: z.string().optional().describe("User auth token"),
  }),
  execute: async ({ context }) => {
    const { trackingId, billType, authToken } = context;

    const BILLS_SERVICE = process.env.NEXT_PUBLIC_BILLS_API_URL ||
      "https://svc-01ka8k5e6tr0kgy0jkzj9m4q16.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

    if (!authToken) {
      return {
        success: false,
        message: "Authentication required",
        requiresAuth: true,
      };
    }

    try {
      const endpoint = billType === "federal"
        ? `${BILLS_SERVICE}/bills/track/${trackingId}`
        : `${BILLS_SERVICE}/state-bills/track/${trackingId}`;

      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        return {
          success: false,
          message: error.error || "Failed to untrack bill",
        };
      }

      return {
        success: true,
        message: "Bill successfully removed from tracked list",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// All tools collection
// Phase 3: Using real SmartSQL, SmartBucket, and SmartMemory tools
export const congressionalTools = {
  // SmartSQL tools - database queries
  smartSql: smartSqlTool,
  getBillDetail: getBillDetailTool,
  getMemberDetail: getMemberDetailTool,
  // SmartBucket tools - semantic search and RAG
  semanticSearch: semanticSearchTool,
  billTextRag: billTextRagTool,
  compareBills: compareBillsTool,
  policyAreaSearch: policyAreaSearchTool,
  // SmartMemory tools - user context and memory
  getUserContext: getUserContextTool,
  getUserRepresentatives: getUserRepresentativesTool,
  getTrackedBills: getTrackedBillsTool,
  getConversationHistory: getConversationHistoryTool,
  storeWorkingMemory: storeWorkingMemoryTool,
  getBriefingTemplates: getBriefingTemplatesTool,
  getPersonalizedRecommendations: getPersonalizedRecommendationsTool,
  // Phase 4 tools - Perplexity web search (replaces Tavily)
  searchNews: searchNewsTool,
  searchCongressionalNews: searchCongressionalNewsTool,
  searchLegislatorNews: searchLegislatorNewsTool,
  webSearch: webSearchTool,
  // Phase 4 tools - Bill tracking (implemented)
  trackBill: trackBillTool,
  untrackBill: untrackBillTool,
  // Phase 4 tools - OpenStates state legislation (implemented)
  searchStateBills: realSearchStateBillsTool,
  getStateBillDetails: getStateBillDetailsTool,
  getStateLegislatorsByLocation: getStateLegislatorsByLocationTool,
  getStateLegislatorDetails: getStateLegislatorDetailsTool,
  getStateLegislatorVotingRecord: getStateLegislatorVotingRecordTool,
  // Phase 4 tools - C1 Artifacts for reports and presentations (implemented)
  generateBillReport: realGenerateBillReportTool,
  generateBriefingSlides: generateBriefingSlidesTool,
};

// Import SmartInference for dynamic model selection
import {
  getMastraModel,
  classifyQuery,
  type ModelTier,
} from "../config/smartinference";

// Congressional Assistant Agent - Powered by Raindrop SmartInference
// Uses Llama 3.3 70B via Raindrop for unified AI access
export const congressionalAssistant = new Agent({
  name: "congressional-assistant",
  instructions: congressionalSystemPrompt,
  model: getMastraModel("standard"), // Raindrop SmartInference (llama-3.3-70b)
  tools: congressionalTools,
});

/**
 * Create a Congressional Assistant with dynamic model selection
 *
 * Uses SmartInference to route to the appropriate model based on:
 * - Query complexity (simple vs complex)
 * - Task type (search, analysis, report generation)
 * - Cost/performance optimization
 *
 * @param query - User query to classify for model selection
 * @param forceTier - Force a specific model tier
 */
export function createCongressionalAssistant(
  query?: string,
  forceTier?: ModelTier
) {
  let tier: ModelTier = "standard";

  if (forceTier) {
    tier = forceTier;
  } else if (query) {
    const classification = classifyQuery(query);
    tier = classification.tier;
  }

  const model = getMastraModel(tier);

  return new Agent({
    name: "congressional-assistant",
    instructions: congressionalSystemPrompt,
    model,
    tools: congressionalTools,
  });
}

/**
 * Get agent configuration info for a given query
 * Useful for logging and debugging model selection
 */
export function getAgentConfigForQuery(query: string) {
  const classification = classifyQuery(query);
  return {
    query,
    tier: classification.tier,
    confidence: classification.confidence,
    reasoning: classification.reasoning,
  };
}
