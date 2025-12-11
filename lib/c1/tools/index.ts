/**
 * C1 Tools Index
 *
 * Exports all tools in OpenAI/Thesys-compatible format for use with the C1 API.
 * Tools return JSON data - the C1 model decides how to render as UI components.
 */

import type { RunnableToolFunctionWithParse } from "openai/lib/RunnableFunction.mjs";
import { createSearchNewsTool, searchNewsTool } from "./search-news";
import { createSearchBillsTool, searchBillsTool, formatBillNumber } from "./search-bills";
import { createSearchMembersTool, searchMembersTool, formatParty, formatStateName } from "./search-members";
import { createSearchImagesTool, searchImagesTool, getMemberPhotoUrl } from "./search-images";
import type { WriteProgress } from "./types";

// Re-export types
export * from "./types";

// Re-export individual tools
export { createSearchNewsTool, searchNewsTool } from "./search-news";
export { createSearchBillsTool, searchBillsTool, formatBillNumber } from "./search-bills";
export { createSearchMembersTool, searchMembersTool, formatParty, formatStateName } from "./search-members";
export { createSearchImagesTool, searchImagesTool, getMemberPhotoUrl } from "./search-images";

/**
 * All default tools (without progress callback)
 *
 * Use this for simple implementations that don't need progress updates.
 */
export const defaultTools: RunnableToolFunctionWithParse<any>[] = [
  searchNewsTool,
  searchBillsTool,
  searchMembersTool,
  searchImagesTool,
];

/**
 * Create tools with progress callback
 *
 * Use this to get tools that report progress to the client.
 *
 * @param writeProgress Callback to receive progress updates
 * @returns Array of tools with progress reporting
 *
 * @example
 * ```ts
 * const tools = createToolsWithProgress((progress) => {
 *   sendSSE({ type: 'progress', ...progress });
 * });
 *
 * const stream = await client.beta.chat.completions.runTools({
 *   model: 'c1/anthropic/claude-sonnet-4/v-20251130',
 *   messages,
 *   tools,
 *   stream: true,
 * });
 * ```
 */
export function createToolsWithProgress(
  writeProgress: WriteProgress
): RunnableToolFunctionWithParse<any>[] {
  return [
    createSearchNewsTool(writeProgress),
    createSearchBillsTool(writeProgress),
    createSearchMembersTool(writeProgress),
    createSearchImagesTool(writeProgress),
  ];
}

/**
 * Tool name constants for type safety
 */
export const TOOL_NAMES = {
  SEARCH_NEWS: "searchNews",
  SEARCH_BILLS: "searchBills",
  SEARCH_MEMBERS: "searchMembers",
  SEARCH_IMAGES: "searchImages",
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

/**
 * Utility functions for working with tools
 */
export const toolUtils = {
  formatBillNumber,
  formatParty,
  formatStateName,
  getMemberPhotoUrl,
};
