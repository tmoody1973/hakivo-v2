/**
 * Document Types for Artifact Generation
 *
 * These types define the structure of user documents that get
 * saved to the database and rendered as artifacts.
 */

// ============================================
// Document Types
// ============================================

export type DocumentType =
  | "policy_report"
  | "bill_summary"
  | "member_profile"
  | "news_briefing"
  | "comparison"
  | "slide_deck";

// ============================================
// Section Types
// ============================================

export type SectionType =
  | "summary"
  | "key_points"
  | "bills"
  | "members"
  | "news"
  | "timeline"
  | "statistics"
  | "quote"
  | "custom";

// ============================================
// Section Content Types
// ============================================

export interface SummaryContent {
  text: string;
}

export interface KeyPointsContent {
  points: string[];
}

export interface BillItem {
  id: string;
  number: string;
  title: string;
  sponsor?: string;
  sponsorParty?: string;
  status?: string;
  summary?: string;
  url?: string;
  introducedDate?: string;
}

export interface BillsContent {
  bills: BillItem[];
}

export interface MemberItem {
  id: string;
  name: string;
  party: string;
  state: string;
  chamber?: string;
  role?: string;
  imageUrl?: string;
  url?: string;
}

export interface MembersContent {
  members: MemberItem[];
}

export interface NewsArticle {
  title: string;
  source: string;
  url: string;
  date?: string;
  snippet?: string;
  imageUrl?: string;
}

export interface NewsContent {
  articles: NewsArticle[];
}

export interface TimelineEvent {
  date: string;
  title: string;
  description?: string;
  type?: "introduced" | "passed" | "signed" | "vetoed" | "other";
}

export interface TimelineContent {
  events: TimelineEvent[];
}

export interface StatItem {
  label: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
}

export interface StatisticsContent {
  stats: StatItem[];
}

export interface QuoteContent {
  text: string;
  attribution: string;
  source?: string;
}

export interface CustomContent {
  markdown: string;
}

// Union type for all section content
export type SectionContent =
  | SummaryContent
  | KeyPointsContent
  | BillsContent
  | MembersContent
  | NewsContent
  | TimelineContent
  | StatisticsContent
  | QuoteContent
  | CustomContent;

// ============================================
// Section Definition
// ============================================

export interface Section<T extends SectionContent = SectionContent> {
  id: string;
  type: SectionType;
  title: string;
  content: T;
  order: number;
}

// ============================================
// Document Metadata
// ============================================

export interface DocumentMetadata {
  generatedAt: string;
  query: string;
  focus?: string;
  sources: string[];
  toolCalls?: string[];
}

// ============================================
// User Document
// ============================================

export interface UserDocument {
  id: string;
  userId: string;
  documentType: DocumentType;
  title: string;
  metadata: DocumentMetadata;
  sections: Section[];
  rawToolResults?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Document Creation Input
// ============================================

export interface CreateDocumentInput {
  userId: string;
  documentType: DocumentType;
  title: string;
  query: string;
  focus?: string;
  sections: Omit<Section, "id">[];
  rawToolResults?: Record<string, unknown>;
}

// ============================================
// Progress Events
// ============================================

export type ProgressPhase =
  | "starting"
  | "researching"
  | "building"
  | "saving"
  | "rendering"
  | "complete"
  | "error";

export interface ProgressEvent {
  type: "progress";
  step: number;
  totalSteps: number;
  message: string;
  detail?: string;
  phase: ProgressPhase;
  estimatedTimeRemaining?: number;
}

// ============================================
// Document Templates
// ============================================

/**
 * Template definitions for different document types.
 * Each template defines the sections that should be included.
 */
export const DOCUMENT_TEMPLATES: Record<DocumentType, SectionType[]> = {
  policy_report: ["summary", "key_points", "bills", "members", "news"],
  bill_summary: ["summary", "key_points", "timeline", "members"],
  member_profile: ["summary", "statistics", "bills", "news"],
  news_briefing: ["summary", "key_points", "news"],
  comparison: ["summary", "statistics", "bills", "key_points"],
  slide_deck: ["summary", "key_points", "statistics", "bills", "members"],
};

// ============================================
// Step Time Estimates (in milliseconds)
// ============================================

export const STEP_TIME_ESTIMATES: Record<number, number> = {
  1: 500, // Starting
  2: 3000, // News search
  3: 2000, // Bill search
  4: 2000, // Member search
  5: 1000, // Building document
  6: 5000, // Rendering artifact
  7: 500, // Complete
};

/**
 * Calculate estimated remaining time from current step
 */
export function estimateRemainingTime(currentStep: number, totalSteps: number = 7): number {
  let remaining = 0;
  for (let i = currentStep; i <= totalSteps; i++) {
    remaining += STEP_TIME_ESTIMATES[i] || 1000;
  }
  return remaining;
}
