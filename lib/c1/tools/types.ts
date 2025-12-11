/**
 * Type definitions for C1 Tools
 *
 * These types match the OpenAI/Thesys tool calling format
 * used by the C1 API.
 */

import type { RunnableToolFunctionWithParse } from "openai/lib/RunnableFunction.mjs";

/**
 * Progress callback for tools to report status
 */
export type WriteProgress = (progress: { title: string; content: string }) => void;

/**
 * Standard tool result interface
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * News article from search results
 */
export interface NewsArticle {
  title: string;
  source: string;
  url: string;
  date?: string;
  snippet?: string;
  imageUrl?: string;
}

/**
 * News search result
 */
export interface NewsSearchResult {
  success: boolean;
  summary: string;
  summaryWithCitations?: string;
  articles: NewsArticle[];
  citations?: Array<{ index: number; title: string; url: string }>;
  keyFindings?: Array<{ point: string; citationIndex?: number }>;
  relatedTopics?: string[];
  error?: string;
}

/**
 * Bill from database search
 */
export interface Bill {
  id: string;
  congress: number;
  bill_type: string;
  bill_number: number;
  title: string;
  short_title?: string;
  sponsor_name?: string;
  sponsor_party?: string;
  sponsor_state?: string;
  sponsor_bioguide_id?: string;
  cosponsors_count?: number;
  policy_area?: string;
  introduced_date?: string;
  latest_action_text?: string;
  latest_action_date?: string;
  summary?: string;
}

/**
 * Bill search result
 */
export interface BillSearchResult {
  success: boolean;
  bills: Bill[];
  count: number;
  query?: string;
  error?: string;
}

/**
 * Congress member
 */
export interface Member {
  bioguide_id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  party: string;
  state: string;
  district?: number;
  chamber: string;
  title?: string;
  image_url?: string;
  office?: string;
  phone?: string;
  website?: string;
  leadership_role?: string;
  committees?: string[];
  sponsored_bills_count?: number;
}

/**
 * Member search result
 */
export interface MemberSearchResult {
  success: boolean;
  members: Member[];
  count: number;
  query?: string;
  error?: string;
}

/**
 * Image search result item
 */
export interface ImageSearchItem {
  altText: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  error?: string;
}

/**
 * Image search result
 */
export interface ImageSearchResult {
  success: boolean;
  images: ImageSearchItem[];
  error?: string;
}

/**
 * Helper to create typed tool definition
 */
export type C1Tool<TParams extends Record<string, unknown>> = RunnableToolFunctionWithParse<TParams>;
