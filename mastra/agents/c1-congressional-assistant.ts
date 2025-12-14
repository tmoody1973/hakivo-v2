import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { congressionalSystemPrompt } from "./congressional-assistant";

/**
 * MINIMAL TOOL SET for C1 Congressional Assistant (7 tools)
 *
 * Speed-optimized for better UX:
 * - User data (reps, interests) is pre-fetched in API route
 * - Artifacts (reports, slides) use direct C1 Artifact API (no tool needed)
 * - Removed: webSearch (overlaps searchNews), conversation history, working memory
 */

// Core data lookup (3 tools)
import { getMemberDetailTool, getBillDetailTool, smartSqlTool } from "../tools/smartsql";
// Semantic search for bills (1 tool)
import { semanticSearchTool } from "../tools/smartbucket";
// News search via Perplexity (1 tool)
import { searchNewsTool } from "../tools/perplexity";
// SmartMemory - fallback for user personalization (2 tools)
import { getUserContextTool, getUserRepresentativesTool } from "../tools/smartmemory";

/**
 * C1 Congressional Assistant Agent
 *
 * Uses thesys C1 for generative UI with all congressional tools.
 * This agent generates interactive UI components for bills, votes, representatives.
 */

// Create thesys C1 provider using OpenAI-compatible SDK
const thesysC1 = createOpenAI({
  apiKey: process.env.THESYS_API_KEY,
  baseURL: "https://api.thesys.dev/v1/embed",
});

// Streamlined system prompt for C1 generative UI (speed-optimized)
const c1SystemPrompt = `${congressionalSystemPrompt}

## User Personalization

User data (representatives, interests, location) is typically provided in the system context.
If user data is NOT in the context, use SmartMemory tools as fallback:
- \`getUserContext\` - Get user's location, policy interests, tracked bills
- \`getUserRepresentatives\` - Get user's senators and house representative

Look for \`[AUTH_TOKEN: xxx]\` in the context to use with SmartMemory tools.

## C1 Generative UI Components

Use these component types for rich responses:

**Data Display:** Cards, Tables, Steps, Accordions
**Charts:** Bar Chart, Pie Chart, Line Chart
**Interactive:** Buttons, Tags, Badges

**Layout Rules:**
1. Lead with the most important visual
2. Use Tables for comparisons
3. Include action buttons for next steps
4. Be concise - let the UI tell the story

## Reports & Presentations

When users ask for reports, analysis, slides, or presentations - just describe what you would create.
The system handles artifact generation separately for optimal performance.`;

/**
 * MINIMAL Tool Set for C1 (7 tools - 50% reduction from 14)
 *
 * Speed optimizations:
 * - User data pre-fetched in route, SmartMemory tools are fallback only
 * - Artifacts handled via direct C1 API (no tools needed)
 * - Removed overlapping tools (webSearch duplicates searchNews)
 */
const c1Tools = {
  // Core data lookup (3)
  smartSql: smartSqlTool,                // Database queries for bills, members, votes
  getMemberDetail: getMemberDetailTool,  // Congress member lookups
  getBillDetail: getBillDetailTool,      // Bill details and status
  // Search (2)
  semanticSearch: semanticSearchTool,    // Topic-based bill search
  searchNews: searchNewsTool,            // Current news via Perplexity
  // SmartMemory fallback (2)
  getUserContext: getUserContextTool,           // Fallback: user location/preferences
  getUserRepresentatives: getUserRepresentativesTool,  // Fallback: user's reps
};

/**
 * C1 Congressional Assistant - Speed-optimized Mastra Agent
 *
 * 7 tools (50% reduction) for faster response times.
 * Artifacts are handled via direct C1 API in the route handler.
 */
export const c1CongressionalAssistant = new Agent({
  name: "c1-congressional-assistant",
  instructions: c1SystemPrompt,
  model: thesysC1.chat("c1/anthropic/claude-sonnet-4/v-20251130"),
  tools: c1Tools,
});

/**
 * Create C1 Congressional Assistant with custom configuration
 */
export function createC1CongressionalAssistant(_options?: {
  maxTokens?: number;
  temperature?: number;
}) {
  return new Agent({
    name: "c1-congressional-assistant",
    instructions: c1SystemPrompt,
    model: thesysC1.chat("c1/anthropic/claude-sonnet-4/v-20251130"),
    tools: c1Tools,
  });
}

// Export for use in API routes
export { c1SystemPrompt };
