/**
 * Hakivo C1 Integration
 *
 * This module provides everything needed to integrate with the Thesys C1 API
 * for generative UI chat experiences.
 *
 * Usage:
 * ```ts
 * import { HAKIVO_SYSTEM_PROMPT, defaultTools, createToolsWithProgress } from '@/lib/c1';
 * ```
 */

// System Prompt
export {
  HAKIVO_SYSTEM_PROMPT,
  HAKIVO_SYSTEM_PROMPT_SHORT,
  default as systemPrompt,
} from "./system-prompt";

// Tools
export {
  // Default tools (no progress callback)
  defaultTools,
  // Factory for tools with progress
  createToolsWithProgress,
  // Individual tool creators
  createSearchNewsTool,
  createSearchBillsTool,
  createSearchMembersTool,
  createSearchImagesTool,
  // Individual tools (no progress)
  searchNewsTool,
  searchBillsTool,
  searchMembersTool,
  searchImagesTool,
  // Utility functions
  formatBillNumber,
  formatParty,
  formatStateName,
  getMemberPhotoUrl,
  toolUtils,
  // Constants
  TOOL_NAMES,
  // Types
  type ToolName,
  type WriteProgress,
  type ToolResult,
  type NewsSearchResult,
  type BillSearchResult,
  type MemberSearchResult,
  type ImageSearchResult,
  type NewsArticle,
  type Bill,
  type Member,
  type ImageSearchItem,
} from "./tools";

// C1 API Configuration
export const C1_CONFIG = {
  baseURL: "https://api.thesys.dev/v1/embed/",
  model: "c1/anthropic/claude-sonnet-4/v-20251130",
  temperature: 0.5,
} as const;

/**
 * Create OpenAI client configured for C1
 *
 * @example
 * ```ts
 * import OpenAI from 'openai';
 * import { C1_CONFIG } from '@/lib/c1';
 *
 * const client = new OpenAI({
 *   baseURL: C1_CONFIG.baseURL,
 *   apiKey: process.env.THESYS_API_KEY,
 * });
 * ```
 */
export function getC1ClientConfig() {
  return {
    baseURL: C1_CONFIG.baseURL,
    apiKey: process.env.THESYS_API_KEY,
  };
}
