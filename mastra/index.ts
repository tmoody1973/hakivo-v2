import { Mastra } from "@mastra/core";
import { congressionalAssistant, congressionalTools } from "./agents/congressional-assistant";
import { c1CongressionalAssistant, createC1CongressionalAssistant } from "./agents/c1-congressional-assistant";

/**
 * Hakivo Mastra Instance
 *
 * Orchestrates the Congressional Assistant AI agent with tools
 * for bill search, representative lookup, vote tracking, and more.
 */
export const mastra = new Mastra({
  agents: {
    congressionalAssistant,
    c1CongressionalAssistant,
  },
});

// Export the agent and tools for direct access
export { congressionalAssistant, congressionalTools };
export { c1CongressionalAssistant, createC1CongressionalAssistant };

// Re-export all from agents module
export * from "./agents/congressional-assistant";

// Re-export SmartInference configuration
export * from "./config";

// Re-export all tools
export * from "./tools";
