import type { RunnableToolFunctionWithParse } from "openai/lib/RunnableFunction.mjs";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { JSONSchema } from "openai/lib/jsonschema.mjs";

// Import execute functions from Mastra tools
import {
  smartSqlTool,
  getBillDetailTool,
  getMemberDetailTool,
} from "@/mastra/tools/smartsql";

import {
  searchNewsTool,
  searchCongressionalNewsTool,
  webSearchTool,
} from "@/mastra/tools/perplexity";

import {
  searchStateBillsTool,
  getStateBillDetailsTool,
  getStateLegislatorsByLocationTool,
} from "@/mastra/tools/openstates";

import {
  semanticSearchTool,
  billTextRagTool,
} from "@/mastra/tools/smartbucket";

// Mastra tool type - using any to handle complex execute signature
type MastraTool = any; // eslint-disable-line

/**
 * Convert Mastra tool to OpenAI RunnableToolFunctionWithParse format
 *
 * Mastra tools have execute(context, options) signature but we need to
 * call them with just the input parameters for OpenAI tool calling.
 */
function convertMastraTool(
  mastraTool: MastraTool
): RunnableToolFunctionWithParse<Record<string, unknown>> {
  return {
    type: "function",
    function: {
      name: mastraTool.id,
      description: mastraTool.description,
      parse: (input: string) => JSON.parse(input) as Record<string, unknown>,
      parameters: zodToJsonSchema(mastraTool.inputSchema) as JSONSchema,
      function: async (args: Record<string, unknown>) => {
        try {
          // Mastra tools expect execute({ context: args, runtimeContext: ... })
          // We create a minimal context object for standalone execution
          const result = await mastraTool.execute({ context: args });
          return typeof result === "string" ? result : JSON.stringify(result);
        } catch (error) {
          return `Error: ${error instanceof Error ? error.message : "Tool execution failed"}`;
        }
      },
      strict: true,
    },
  };
}

/**
 * Congressional tools converted to OpenAI format for C1 API
 */
export const tools: RunnableToolFunctionWithParse<Record<string, unknown>>[] = [
  // Database tools
  convertMastraTool(smartSqlTool),
  convertMastraTool(getBillDetailTool),
  convertMastraTool(getMemberDetailTool),

  // News/Search tools
  convertMastraTool(searchNewsTool),
  convertMastraTool(searchCongressionalNewsTool),
  convertMastraTool(webSearchTool),

  // State legislation tools
  convertMastraTool(searchStateBillsTool),
  convertMastraTool(getStateBillDetailsTool),
  convertMastraTool(getStateLegislatorsByLocationTool),

  // RAG/Semantic search tools
  convertMastraTool(semanticSearchTool),
  convertMastraTool(billTextRagTool),
];
