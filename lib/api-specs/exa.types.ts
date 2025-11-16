/**
 * Exa.ai API Types
 *
 * Type definitions for Exa.ai news search API for personalized
 * news based on user policy interests.
 *
 * API Documentation: https://docs.exa.ai/
 */

import { APIResponse } from './common.types';

export interface ExaSearchRequest {
  query: string;
  type?: 'keyword' | 'neural' | 'auto';
  num_results?: number;
  start_published_date?: string;
  end_published_date?: string;
  use_autoprompt?: boolean;
  category?: 'news' | 'research paper' | 'tweet' | 'github' | 'company';
  include_domains?: string[];
  exclude_domains?: string[];
}

export interface ExaSearchResult {
  title: string;
  url: string;
  publishedDate?: string;
  author?: string;
  score?: number;
  id: string;
  text?: string;
  highlights?: string[];
  highlightScores?: number[];
}

export interface ExaSearchResponse {
  results: ExaSearchResult[];
  autopromptString?: string;
  requestId: string;
}

export interface ExaContentsRequest {
  ids: string[];
  text?: boolean | { max_characters?: number; include_html_tags?: boolean };
  highlights?: boolean | { num_sentences?: number; highlights_per_url?: number; query?: string };
  summary?: boolean | { query?: string };
}

export type SearchNewsResponse = APIResponse<ExaSearchResponse>;
export type GetNewsContentsResponse = APIResponse<{ results: ExaSearchResult[] }>;
