import { Mastra } from "@mastra/core";
import { congressionalAssistant, congressionalTools } from "./agents/congressional-assistant";

/**
 * Hakivo Mastra Instance
 *
 * Orchestrates the Congressional Assistant AI agent with tools
 * for bill search, representative lookup, vote tracking, and more.
 */
export const mastra = new Mastra({
  agents: {
    congressionalAssistant,
  },
});

// Export the agent and tools for direct access
export { congressionalAssistant, congressionalTools };

// Re-export all from agents module
export * from "./agents/congressional-assistant";

// Re-export SmartInference configuration
export * from "./config";

// Re-export all tools
export * from "./tools";
