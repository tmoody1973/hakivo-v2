/**
 * Custom Backend API Client
 *
 * Hakivo backend API for user management, preferences, bill tracking,
 * briefs, chat history, and dashboard data.
 *
 * API Base URL: process.env.NEXT_PUBLIC_API_URL
 */

import {
  User,
  UserPreferences,
  TrackedBill,
  Brief,
  BriefGenerationRequest,
  ChatSession,
  ChatMessage,
  ChatRequest,
  DashboardData,
  UserResponse,
  UserPreferencesResponse,
  TrackedBillsResponse,
  BriefResponse,
  BriefsResponse,
  ChatSessionResponse,
  ChatMessagesResponse,
  SendChatMessageResponse,
  DashboardResponse,
} from '../api-specs/backend.types';
import { APIResponse } from '../api-specs/common.types';

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Helper to get auth headers
function getHeaders(accessToken?: string): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  if (process.env.BACKEND_API_KEY) {
    headers['X-API-Key'] = process.env.BACKEND_API_KEY;
  }
  return headers;
}

// ============================================================================
// User APIs
// ============================================================================

/**
 * Get current user profile
 *
 * API ENDPOINT: GET {API_URL}/users/me
 * HEADERS: { 'Authorization': 'Bearer {accessToken}' }
 * SUCCESS RESPONSE (200): {
 *   id: string,
 *   workosId: string,
 *   email: string,
 *   firstName?: string,
 *   lastName?: string,
 *   onboardingCompleted: boolean,
 *   createdAt: string,
 *   updatedAt: string
 * }
 * ERROR RESPONSES:
 *   401: { error: 'Unauthorized' }
 *   404: { error: 'User not found' }
 */
export async function getCurrentUserProfile(accessToken: string): Promise<UserResponse> {
  // API ENDPOINT: GET {API_BASE_URL}/users/me
  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      id: 'user_123',
      workosId: 'wos_user_123',
      email: 'demo@hakivo.com',
      firstName: 'Alex',
      lastName: 'Johnson',
      emailVerified: true,
      onboardingCompleted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Update user profile
 *
 * API ENDPOINT: PATCH {API_URL}/users/me
 * HEADERS: { 'Authorization': 'Bearer {accessToken}', 'Content-Type': 'application/json' }
 * REQUEST BODY: { firstName?: string, lastName?: string }
 */
export async function updateUserProfile(
  accessToken: string,
  updates: Partial<Pick<User, 'firstName' | 'lastName'>>
): Promise<UserResponse> {
  // API ENDPOINT: PATCH {API_BASE_URL}/users/me
  // TODO: Replace with actual API call
  return { success: true, data: {} as User };
}

// ============================================================================
// Preferences APIs
// ============================================================================

/**
 * Get user preferences
 *
 * API ENDPOINT: GET {API_URL}/users/me/preferences
 * SUCCESS RESPONSE (200): {
 *   id: string,
 *   userId: string,
 *   policyInterests: string[],
 *   zipCode: string,
 *   state: string,
 *   district: number,
 *   briefingTime: string,
 *   emailNotifications: boolean,
 *   weeklyBriefing: boolean,
 *   autoPlay: boolean,
 *   playbackSpeed: number
 * }
 */
export async function getUserPreferences(accessToken: string): Promise<UserPreferencesResponse> {
  // API ENDPOINT: GET {API_BASE_URL}/users/me/preferences
  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      id: 'pref_123',
      userId: 'user_123',
      policyInterests: ['climate', 'healthcare', 'education'],
      zipCode: '94102',
      state: 'CA',
      district: 12,
      briefingTime: '08:00',
      emailNotifications: true,
      weeklyBriefing: true,
      autoPlay: false,
      playbackSpeed: 1.0,
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Update user preferences
 *
 * API ENDPOINT: PUT {API_URL}/users/me/preferences
 * REQUEST BODY: Partial<UserPreferences>
 */
export async function updateUserPreferences(
  accessToken: string,
  preferences: Partial<UserPreferences>
): Promise<UserPreferencesResponse> {
  // API ENDPOINT: PUT {API_BASE_URL}/users/me/preferences
  // TODO: Replace with actual API call
  return { success: true, data: {} as UserPreferences };
}

/**
 * Save onboarding preferences (policy interests, zip code)
 */
export async function saveOnboardingPreferences(
  accessToken: string,
  data: {
    policyInterests: string[];
    zipCode: string;
    state: string;
    district: number;
  }
): Promise<UserPreferencesResponse> {
  // API ENDPOINT: POST {API_BASE_URL}/users/me/onboarding
  // Also marks user.onboardingCompleted = true
  // TODO: Replace with actual API call
  return { success: true, data: {} as UserPreferences };
}

// ============================================================================
// Bill Tracking APIs
// ============================================================================

/**
 * Get tracked bills for user
 *
 * API ENDPOINT: GET {API_URL}/users/me/tracked-bills
 * QUERY PARAMETERS: { page?: number, limit?: number }
 * SUCCESS RESPONSE (200): {
 *   data: [{ id, userId, billId, title, addedAt, ... }],
 *   pagination: { page, limit, total, totalPages, hasNext, hasPrevious }
 * }
 */
export async function getTrackedBills(
  accessToken: string,
  params: { page?: number; limit?: number } = {}
): Promise<TrackedBillsResponse> {
  // API ENDPOINT: GET {API_BASE_URL}/users/me/tracked-bills?page={page}&limit={limit}
  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      },
    },
  };
}

/**
 * Track a bill
 *
 * API ENDPOINT: POST {API_URL}/users/me/tracked-bills
 * REQUEST BODY: { billId: string, congress: number, billType: string, billNumber: string, title: string }
 */
export async function trackBill(
  accessToken: string,
  billData: {
    billId: string;
    congress: number;
    billType: string;
    billNumber: string;
    title: string;
  }
): Promise<APIResponse<TrackedBill>> {
  // API ENDPOINT: POST {API_BASE_URL}/users/me/tracked-bills
  // TODO: Replace with actual API call
  return { success: true, data: {} as TrackedBill };
}

/**
 * Untrack a bill
 *
 * API ENDPOINT: DELETE {API_URL}/users/me/tracked-bills/{trackedBillId}
 */
export async function untrackBill(
  accessToken: string,
  trackedBillId: string
): Promise<APIResponse<void>> {
  // API ENDPOINT: DELETE {API_BASE_URL}/users/me/tracked-bills/{trackedBillId}
  // TODO: Replace with actual API call
  return { success: true };
}

// ============================================================================
// Briefs APIs
// ============================================================================

/**
 * Get briefs for user
 *
 * API ENDPOINT: GET {API_URL}/users/me/briefs
 * QUERY PARAMETERS: { type?: 'daily' | 'weekly', page?: number, limit?: number }
 * SUCCESS RESPONSE (200): {
 *   data: [{ id, type, title, date, status, audioUrl, cdnUrl, duration, listened, ... }],
 *   pagination: { ... }
 * }
 */
export async function getBriefs(
  accessToken: string,
  params: { type?: 'daily' | 'weekly'; page?: number; limit?: number } = {}
): Promise<BriefsResponse> {
  // API ENDPOINT: GET {API_BASE_URL}/users/me/briefs
  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      },
    },
  };
}

/**
 * Get brief by ID
 *
 * API ENDPOINT: GET {API_URL}/users/me/briefs/{briefId}
 */
export async function getBriefById(
  accessToken: string,
  briefId: string
): Promise<BriefResponse> {
  // API ENDPOINT: GET {API_BASE_URL}/users/me/briefs/{briefId}
  // TODO: Replace with actual API call
  return { success: true, data: {} as Brief };
}

/**
 * Generate a new brief (triggers background job)
 *
 * API ENDPOINT: POST {API_URL}/users/me/briefs/generate
 * REQUEST BODY: { type: 'daily' | 'weekly', date: string, forceRegenerate?: boolean }
 * SUCCESS RESPONSE (202): { id: string, status: 'pending' | 'generating' }
 *
 * This triggers a background job that:
 * 1. Fetches user preferences and tracked bills
 * 2. Calls Exa.ai for news
 * 3. Calls Congress.gov for bill updates
 * 4. Generates script with Claude
 * 5. Generates audio with ElevenLabs
 * 6. Uploads to Vultr storage
 * 7. Updates brief status to 'completed'
 */
export async function generateBrief(
  accessToken: string,
  request: BriefGenerationRequest
): Promise<BriefResponse> {
  // API ENDPOINT: POST {API_BASE_URL}/users/me/briefs/generate
  // TODO: Replace with actual API call
  return { success: true, data: {} as Brief };
}

/**
 * Mark brief as listened
 *
 * API ENDPOINT: POST {API_URL}/users/me/briefs/{briefId}/listen
 */
export async function markBriefAsListened(
  accessToken: string,
  briefId: string
): Promise<BriefResponse> {
  // API ENDPOINT: POST {API_BASE_URL}/users/me/briefs/{briefId}/listen
  // TODO: Replace with actual API call
  return { success: true, data: {} as Brief };
}

// ============================================================================
// Chat APIs
// ============================================================================

/**
 * Get chat sessions for user
 *
 * API ENDPOINT: GET {API_URL}/users/me/chat/sessions
 */
export async function getChatSessions(
  accessToken: string,
  params: { page?: number; limit?: number } = {}
): Promise<APIResponse<ChatSession[]>> {
  // API ENDPOINT: GET {API_BASE_URL}/users/me/chat/sessions
  // TODO: Replace with actual API call
  return { success: true, data: [] };
}

/**
 * Get chat messages for a session
 *
 * API ENDPOINT: GET {API_URL}/users/me/chat/sessions/{sessionId}/messages
 */
export async function getChatMessages(
  accessToken: string,
  sessionId: string,
  params: { page?: number; limit?: number } = {}
): Promise<ChatMessagesResponse> {
  // API ENDPOINT: GET {API_BASE_URL}/users/me/chat/sessions/{sessionId}/messages
  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      data: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      },
    },
  };
}

/**
 * Send a chat message (with RAG)
 *
 * This triggers:
 * 1. Vector search in Pinecone for relevant bill sections
 * 2. Call to Cerebras with context
 * 3. Store message and response
 *
 * API ENDPOINT: POST {API_URL}/users/me/chat/messages
 * REQUEST BODY: { sessionId?: string, billId: string, message: string }
 * SUCCESS RESPONSE (200): {
 *   sessionId: string,
 *   message: { id, role: 'assistant', content, sources, createdAt }
 * }
 */
export async function sendChatMessage(
  accessToken: string,
  request: ChatRequest
): Promise<SendChatMessageResponse> {
  // API ENDPOINT: POST {API_BASE_URL}/users/me/chat/messages
  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      sessionId: 'session_123',
      message: {} as ChatMessage,
    },
  };
}

/**
 * Delete a chat session
 *
 * API ENDPOINT: DELETE {API_URL}/users/me/chat/sessions/{sessionId}
 */
export async function deleteChatSession(
  accessToken: string,
  sessionId: string
): Promise<APIResponse<void>> {
  // API ENDPOINT: DELETE {API_BASE_URL}/users/me/chat/sessions/{sessionId}
  // TODO: Replace with actual API call
  return { success: true };
}

// ============================================================================
// Dashboard API
// ============================================================================

/**
 * Get dashboard data (aggregated)
 *
 * API ENDPOINT: GET {API_URL}/users/me/dashboard
 * SUCCESS RESPONSE (200): {
 *   user: { ... },
 *   upcomingBrief: { ... },
 *   recentBriefs: [...],
 *   trackedBills: [...],
 *   newsHighlights: [...],
 *   stats: { totalBriefsListened, trackedBillsCount, minutesListened, currentStreak }
 * }
 */
export async function getDashboardData(accessToken: string): Promise<DashboardResponse> {
  // API ENDPOINT: GET {API_BASE_URL}/users/me/dashboard
  // This endpoint aggregates data from multiple sources for efficient loading
  // TODO: Replace with actual API call
  return {
    success: true,
    data: {} as DashboardData,
  };
}
