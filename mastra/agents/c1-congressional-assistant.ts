import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { congressionalTools, congressionalSystemPrompt } from "./congressional-assistant";

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
- Be concise - let the UI tell the story`;

/**
 * C1 Congressional Assistant - Mastra Agent with thesys C1 model
 *
 * This agent combines Mastra's tool orchestration with C1's generative UI.
 */
export const c1CongressionalAssistant = new Agent({
  name: "c1-congressional-assistant",
  instructions: c1SystemPrompt,
  model: thesysC1.chat("c1/anthropic/claude-sonnet-4/v-20251130"),
  tools: congressionalTools,
});

/**
 * Create C1 Congressional Assistant with custom configuration
 */
export function createC1CongressionalAssistant(options?: {
  maxTokens?: number;
  temperature?: number;
}) {
  return new Agent({
    name: "c1-congressional-assistant",
    instructions: c1SystemPrompt,
    model: thesysC1.chat("c1/anthropic/claude-sonnet-4/v-20251130"),
    tools: congressionalTools,
  });
}

// Export for use in API routes
export { c1SystemPrompt };
