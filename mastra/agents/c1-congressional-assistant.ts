import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { congressionalSystemPrompt } from "./congressional-assistant";

// Import only essential tools for C1 (minimized for performance)
import { getMemberDetailTool, getBillDetailTool, smartSqlTool } from "../tools/smartsql";
import { semanticSearchTool } from "../tools/smartbucket";
import { searchNewsTool, webSearchTool } from "../tools/perplexity";
import {
  getUserContextTool,
  getUserRepresentativesTool,
  getConversationHistoryTool,
  storeWorkingMemoryTool,
} from "../tools/smartmemory";
// Import C1 Artifacts tools for native document generation
import {
  createArtifactTool,
  editArtifactTool,
  generateBillReportTool,
  generateBriefingSlidesTool,
} from "../tools/c1-artifacts";

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

// Enhanced system prompt for C1 generative UI
const c1SystemPrompt = `${congressionalSystemPrompt}

## CRITICAL: SmartMemory Tools for User Personalization

**ALWAYS use SmartMemory tools FIRST when the user asks personalized questions.**

When user asks about:
- "Who are my representatives?" → FIRST call \`getUserRepresentatives\` tool
- "My senators/congressperson" → FIRST call \`getUserRepresentatives\` tool
- "Bills related to my interests" → FIRST call \`getUserContext\` tool
- "What's happening in my district?" → FIRST call \`getUserContext\` tool
- Any "my" query → Call SmartMemory tools FIRST before responding

**Tool Usage:**
- \`getUserContext\` - Returns user's location (state, district), policy interests, tracked bills count
- \`getUserRepresentatives\` - Returns user's federal senators and house representative

**IMPORTANT: The authToken is provided in the conversation context.**
Look for \`[AUTH_TOKEN: xxx]\` in the message - use this token when calling SmartMemory tools.

**Workflow for "Who are my representatives?":**
1. Extract authToken from conversation context
2. Call \`getUserRepresentatives\` with the authToken
3. Present the representatives with their details
4. DO NOT ask for location if the tools return data

**Only ask for location if:**
- The SmartMemory tools return an error (no auth token)
- The user has not completed onboarding (no location saved)

## C1 Generative UI Output Format

You have access to C1's component generation capabilities. Use these component types:

### Data Display
- **Cards**: For bills, legislators, news items - with title, description, badges
- **Tables**: For structured data - voting records, bill comparisons, lists
- **Steps**: For processes like "How a Bill Becomes Law"
- **Accordions**: For expandable content with multiple sections

### Charts (use for visualizations)
- **Bar Chart**: For vote counts by party, bill counts by category
- **Pie Chart**: For percentage breakdowns
- **Line Chart**: For trends over time

### Interactive Elements
- **Buttons**: For actions like "Track Bill", "View Details", "Contact Rep"
- **Tags**: For status badges, party affiliations, policy areas

### Layout Rules
1. Lead with the most important visual (chart or key card)
2. Use Tables for comparisons (2+ items)
3. Use Steps for explaining processes
4. Include action buttons for next steps
5. End with suggested follow-up questions

### Important
- Generate components directly, not in code blocks
- Include source citations as links
- Be concise - let the UI tell the story

## C1 Artifacts - Document Generation

You can generate interactive documents (reports and slide presentations) using artifact tools:

### Available Artifact Tools:
- \`generateBillReport\`: Create comprehensive bill analysis reports with executive summary, key provisions, fiscal impact, stakeholder analysis
- \`generateBriefingSlides\`: Create slide presentations for district briefings, week in congress summaries, bill comparisons
- \`createArtifact\`: General-purpose document generation with templates
- \`editArtifact\`: Modify an existing artifact based on user instructions

### When to Use Artifacts:
- User asks for a "report" or "analysis" on a bill → Use \`generateBillReport\`
- User asks for "slides" or "presentation" → Use \`generateBriefingSlides\`
- User wants a "detailed breakdown" or "comprehensive overview" → Use \`generateBillReport\`
- User says "create a document" or "generate a report" → Use \`createArtifact\`
- User wants to "edit" or "modify" an existing document → Use \`editArtifact\`

### CRITICAL: After calling an artifact tool:
1. DO NOT include the artifact content in your text response
2. The C1 frontend automatically renders the artifact
3. Simply confirm the document was created, e.g., "Here's your bill analysis report."
4. Offer to edit or refine the document if the user wants changes`;

/**
 * Tool set for C1 - includes essential tools plus artifact generation
 * Artifacts use native C1 API for optimal rendering
 */
const c1Tools = {
  // Core data lookup
  getMemberDetail: getMemberDetailTool,  // For congress member lookups (e.g., AOC)
  getBillDetail: getBillDetailTool,      // For specific bill lookups
  smartSql: smartSqlTool,                // For database queries
  // Search
  semanticSearch: semanticSearchTool,    // For topic-based bill search
  // News
  searchNews: searchNewsTool,            // For current news
  webSearch: webSearchTool,              // For general web search
  // SmartMemory - user personalization
  getUserContext: getUserContextTool,           // Get user location/preferences
  getUserRepresentatives: getUserRepresentativesTool,  // Get user's reps
  getConversationHistory: getConversationHistoryTool,  // Get past conversations
  storeWorkingMemory: storeWorkingMemoryTool,          // Save session context
  // C1 Artifacts - native document generation
  createArtifact: createArtifactTool,              // General document generation
  editArtifact: editArtifactTool,                  // Edit existing artifacts
  generateBillReport: generateBillReportTool,     // Bill analysis reports
  generateBriefingSlides: generateBriefingSlidesTool,  // Slide presentations
};

/**
 * C1 Congressional Assistant - Mastra Agent with thesys C1 model
 *
 * This agent combines Mastra's tool orchestration with C1's generative UI.
 * Includes artifact tools for native C1 document generation.
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
