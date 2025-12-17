/**
 * Custom Backend API Types
 *
 * Type definitions for Hakivo backend API including user data,
 * preferences, bill tracking, briefs, chat history, and dashboard.
 */

import { APIResponse, PaginatedResponse } from './common.types';

// ============================================================================
// User Types
// ============================================================================

export interface User {
  id: string;
  workosId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  id: string;
  userId: string;
  policyInterests: string[]; // e.g., ['climate', 'healthcare', 'education']
  zipCode: string;
  city?: string;
  state: string;
  district: number;
  congressionalDistrict?: string; // e.g., "WI-4"
  briefingTime?: string; // Preferred daily briefing time (HH:mm format)
  emailNotifications: boolean;
  weeklyBriefing: boolean;
  autoPlay: boolean;
  playbackSpeed: number; // 1.0, 1.25, 1.5, 2.0
  updatedAt: string;
  // Document generation preferences (Studio)
  docDefaultFormat?: 'presentation' | 'document' | 'webpage';
  docDefaultTemplate?: string;
  docDefaultAudience?: string;
  docDefaultTone?: string;
  docAutoExportPdf?: boolean;
  docAutoEnrich?: boolean;
  docTextAmount?: 'brief' | 'medium' | 'detailed' | 'extensive';
  docImageSource?: 'stock' | 'ai' | 'none';
}

// ============================================================================
// Bill Tracking Types
// ============================================================================

export interface TrackedBill {
  id: string;
  userId: string;
  billId: string; // e.g., 'hr-1234-119'
  congress: number;
  billType: string;
  billNumber: string;
  title: string;
  addedAt: string;
  notes?: string;
  notifications: boolean;
}

export interface BillNote {
  id: string;
  userId: string;
  billId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Brief Types
// ============================================================================

export enum BriefStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface Brief {
  id: string;
  userId: string;
  type: 'daily' | 'weekly';
  title: string;
  date: string;
  status: BriefStatus;
  audioUrl?: string;
  cdnUrl?: string;
  duration?: number; // seconds
  script?: any; // BriefingScript from claude.types.ts
  listened: boolean;
  listenedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BriefGenerationRequest {
  userId: string;
  type: 'daily' | 'weekly';
  date: string;
  forceRegenerate?: boolean;
}

// ============================================================================
// Chat Types
// ============================================================================

export interface ChatSession {
  id: string;
  userId: string;
  billId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  createdAt: string;
}

export interface ChatRequest {
  sessionId?: string; // Omit to create new session
  billId: string;
  message: string;
}

export interface ChatResponse {
  sessionId: string;
  message: ChatMessage;
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface DashboardData {
  user: User;
  upcomingBrief?: Brief;
  recentBriefs: Brief[];
  trackedBills: {
    bill: TrackedBill;
    latestAction?: string;
    actionDate?: string;
  }[];
  newsHighlights: {
    title: string;
    summary: string;
    url: string;
    publishedDate: string;
  }[];
  stats: {
    totalBriefsListened: number;
    trackedBillsCount: number;
    minutesListened: number;
    currentStreak: number;
  };
}

// ============================================================================
// Response Types
// ============================================================================

export type UserResponse = APIResponse<User>;
export type UserPreferencesResponse = APIResponse<UserPreferences>;
export type TrackedBillsResponse = APIResponse<PaginatedResponse<TrackedBill>>;
export type BriefResponse = APIResponse<Brief>;
export type BriefsResponse = APIResponse<PaginatedResponse<Brief>>;
export type ChatSessionResponse = APIResponse<ChatSession>;
export type ChatMessagesResponse = APIResponse<PaginatedResponse<ChatMessage>>;
export type SendChatMessageResponse = APIResponse<ChatResponse>;
export type DashboardResponse = APIResponse<DashboardData>;
