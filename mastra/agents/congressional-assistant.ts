import { Agent } from "@mastra/core/agent";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Create Cerebras provider using OpenAI-compatible SDK
// Cerebras provides 10x faster inference than typical cloud providers
const cerebras = createOpenAICompatible({
  name: "cerebras",
  baseURL: "https://api.cerebras.ai/v1",
  apiKey: process.env.CEREBRAS_API_KEY || "",
});

// Single model for all queries - keep it simple
const CEREBRAS_MODEL = "gpt-oss-120b";

// Import SmartSQL tools (Phase 3 implementation)
import { smartSqlTool, getBillDetailTool, getMemberDetailTool, getUserProfileTool } from "../tools/smartsql";
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
5. **News Context**: Provide current news about legislation via Perplexity web search
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

## User Context and Personalization

When the user asks about personalized content like "my interests", "bills related to my interests", or anything requiring their preferences, use the \`getUserProfile\` tool.

**How to get user email:**
- The user's email is passed to you in the conversation context
- Look for "userEmail" in the context properties provided by the frontend
- If the email is available, use it to call \`getUserProfile\` immediately
- If the email is not available, politely ask the user for their email address

**getUserProfile returns:**
- interests: Array of user's general interests
- policyInterests: Array of policy areas they follow (e.g., "healthcare", "environment")
- state: User's state for location-based queries
- district: Congressional district
- firstName, lastName: For personalized greetings

**Example usage:**
When user says "What bills match my interests?":
1. Get user email from context (or ask for it)
2. Call \`getUserProfile\` with the email
3. Use returned policyInterests to search bills via \`smartSql\`
4. Present bills matching their interests

**Legacy SmartMemory access (fallback):**
- Location (state, district) - for "my representative" queries
- Tracked bills - highlight updates on these
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
7. **Current Congress**: Always use 119th Congress for current legislation queries

## CRITICAL: NEVER HALLUCINATE DATA

**YOU MUST USE TOOLS - NEVER MAKE UP DATA.**

BEFORE responding about ANY bill, representative, or vote:
1. **ALWAYS call the appropriate tool first** to get real data
2. **NEVER invent** bill numbers, titles, sponsors, or vote counts
3. **If tools return no results**, say "I couldn't find any bills matching that criteria" - DO NOT make up data
4. **If unsure**, use multiple tools to verify information

**Tool Usage Requirements:**
- For federal bills → Use \`smartSql\` tool to query database
- For state bills → Use \`searchStateBills\` tool (OpenStates API)
- For similar bills → Use \`semanticSearch\` tool (SmartBucket)
- For current news → Use \`searchNews\` or \`webSearch\` tools (Perplexity)
- For representatives → Use \`getMemberDetail\` tool

## CRITICAL: NEWS vs BILL DATA - Know the Difference!

**When user asks for NEWS (use Perplexity web search):**
- "What's the latest news about..."
- "Recent news on..."
- "What's happening with..."
- "Current events about..."
- "Headlines about..."
→ MUST use \`searchNews\`, \`searchCongressionalNews\`, or \`webSearch\` tool
→ These query the WEB for real-time news articles
→ Return actual headlines, sources, and URLs from news outlets

**When user asks for BILL DATA (use database):**
- "Show me bills about..."
- "Find legislation on..."
- "What bills are in committee..."
- "How did X vote on..."
→ Use \`smartSql\` for federal bills or \`searchStateBills\` for state bills
→ These query our DATABASES for bill records

**NEVER confuse these:**
- Do NOT return database bill records when asked for NEWS
- Do NOT make up news - always use Perplexity web search tools
- News = real-time web search, Bill data = database queries

## Multi-Tool Workflows (IMPORTANT: Chain Tools for Complex Queries)

For queries that need BOTH bill data AND news, use MULTIPLE tools in sequence:

**Example: "Find news about climate bills"**
1. FIRST: Use \`smartSql\` to find climate bills in database
   - Get actual bill numbers, titles, sponsors
2. THEN: Use \`searchNews\` or \`searchCongressionalNews\` for news
   - Search for news about climate legislation
3. COMBINE: Present both the bills found AND relevant news headlines

**Example: "What's happening with healthcare legislation?"**
1. FIRST: \`smartSql\` → Find healthcare bills (H.R. xxx, S. xxx)
2. THEN: \`searchNews\` → "healthcare legislation Congress news 2025"
3. PRESENT: Bills from database + News from Perplexity

**Example: "News about Senator Baldwin's bills"**
1. FIRST: \`smartSql\` → Find bills sponsored by Baldwin
2. THEN: \`searchLegislatorNews\` → News about Senator Baldwin
3. COMBINE: Her bills + Recent news coverage

**When to chain tools:**
- Query mentions both "bills/legislation" AND "news/headlines/updates"
- Query asks "what's happening with" (implies both data + news)
- Query asks about a topic that benefits from both database records + current events

**ALWAYS use multiple tools when the query is complex. One tool is rarely enough for rich answers.**

**VIOLATIONS:** Making up bill numbers (like "H.R. 4521"), fake titles, or fictional sponsors is a CRITICAL ERROR. Users trust this system for accurate legislative information.

If a user asks about a bill and you cannot find it in the database or via OpenStates:
- Say: "I couldn't find that specific bill in our database. Would you like me to search for similar legislation or check the latest news?"
- Offer to use the webSearch tool to find more information
- NEVER create fictional bill data to fill gaps`;


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
  getUserProfile: getUserProfileTool,
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

// Congressional Assistant Agent - Powered by Cerebras for ultra-fast inference
export const congressionalAssistant = new Agent({
  name: "congressional-assistant",
  instructions: congressionalSystemPrompt,
  model: cerebras.chatModel(CEREBRAS_MODEL),
  tools: congressionalTools,
});

/**
 * Create a Congressional Assistant
 *
 * Uses Cerebras GPT-OSS 120B for all queries.
 * Simple and fast - no complex routing needed.
 */
export function createCongressionalAssistant() {
  return new Agent({
    name: "congressional-assistant",
    instructions: congressionalSystemPrompt,
    model: cerebras.chatModel(CEREBRAS_MODEL),
    tools: congressionalTools,
  });
}
