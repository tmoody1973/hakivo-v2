/**
 * Claude (Anthropic) API Types
 *
 * Type definitions for Claude API script generation for daily and weekly
 * audio briefings.
 *
 * API Documentation: https://docs.anthropic.com/claude/reference
 */

import { APIResponse } from './common.types';

// ============================================================================
// Briefing Script Types
// ============================================================================

/**
 * Briefing type
 */
export enum BriefingType {
  DAILY = 'daily', // 7-9 minutes
  WEEKLY = 'weekly', // 15-20 minutes
}

/**
 * Dialogue speaker
 */
export enum Speaker {
  SARAH = 'sarah',
  JAMES = 'james',
}

/**
 * Script dialogue line
 */
export interface DialogueLine {
  speaker: Speaker;
  text: string;
}

/**
 * Generated briefing script
 */
export interface BriefingScript {
  type: BriefingType;
  title: string;
  date: string;
  dialogue: DialogueLine[];
  estimatedDuration: number; // seconds
  wordCount: number;
  sections: ScriptSection[];
}

/**
 * Script section (intro, news, bills, outro)
 */
export interface ScriptSection {
  type: 'intro' | 'news' | 'bills' | 'outro';
  title?: string;
  dialogue: DialogueLine[];
  wordCount: number;
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Daily briefing generation request
 */
export interface DailyBriefingRequest {
  userInterests: string[]; // e.g., ['climate', 'healthcare', 'education']
  trackedBills: string[]; // Bill IDs user is tracking
  newsArticles: NewsArticle[]; // From Exa.ai
  billUpdates: BillUpdate[]; // From Congress.gov
  date: string; // ISO date
}

/**
 * Weekly briefing generation request
 */
export interface WeeklyBriefingRequest {
  enactedLaws: EnactedLaw[]; // Laws passed this week
  presidentialActions: PresidentialAction[]; // Presidential focus
  majorVotes: MajorVote[]; // Significant votes
  weekOf: string; // ISO date (Monday of the week)
}

/**
 * News article input
 */
export interface NewsArticle {
  title: string;
  summary: string;
  url: string;
  publishedDate: string;
  source: string;
}

/**
 * Bill update input
 */
export interface BillUpdate {
  billId: string;
  title: string;
  latestAction: string;
  actionDate: string;
  summary?: string;
}

/**
 * Enacted law
 */
export interface EnactedLaw {
  publicLawNumber: string;
  title: string;
  enactedDate: string;
  summary: string;
}

/**
 * Presidential action
 */
export interface PresidentialAction {
  type: 'executive_order' | 'proclamation' | 'memorandum' | 'signing_statement';
  title: string;
  date: string;
  summary: string;
}

/**
 * Major vote
 */
export interface MajorVote {
  billTitle: string;
  chamber: 'house' | 'senate';
  result: 'passed' | 'failed';
  date: string;
  significance: string;
}

// ============================================================================
// Claude API Types
// ============================================================================

/**
 * Claude message request
 */
export interface ClaudeMessageRequest {
  model: string; // e.g., 'claude-sonnet-4-5-20250929'
  max_tokens: number;
  temperature?: number;
  system?: string;
  messages: ClaudeMessage[];
}

/**
 * Claude message
 */
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContent[];
}

/**
 * Claude content block
 */
export interface ClaudeContent {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64' | 'url';
    media_type?: string;
    data?: string;
    url?: string;
  };
}

/**
 * Claude response
 */
export interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ============================================================================
// Response Types
// ============================================================================

export type GenerateDailyBriefingResponse = APIResponse<BriefingScript>;
export type GenerateWeeklyBriefingResponse = APIResponse<BriefingScript>;
