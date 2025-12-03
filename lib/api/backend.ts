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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const DASHBOARD_API_URL = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
// Auth Token Management
// ============================================================================

/**
 * Refresh access token using refresh token
 *
 * API ENDPOINT: POST {API_URL}/auth/refresh
 * BODY: { refreshToken: string }
 * SUCCESS RESPONSE (200): { success: true, accessToken: string }
 * ERROR RESPONSES:
 *   401: { error: 'Invalid or expired refresh token' }
 *   500: { error: 'Token refresh failed' }
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  success: boolean;
  accessToken?: string;
  error?: string;
}> {
  try {
    console.log('[refreshAccessToken] Refreshing access token...');

    // Use query parameter to avoid CORS preflight (same pattern as getUserPreferences)
    const url = `${API_BASE_URL}/auth/refresh?refreshToken=${encodeURIComponent(refreshToken)}`;
    const response = await fetch(url, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[refreshAccessToken] Refresh failed:', errorData);
      return {
        success: false,
        error: errorData.error || 'Failed to refresh token',
      };
    }

    const data = await response.json();
    console.log('[refreshAccessToken] Token refreshed successfully');

    return {
      success: true,
      accessToken: data.accessToken,
    };
  } catch (error) {
    console.error('[refreshAccessToken] Error refreshing token:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Centralized Fetch Wrapper with Automatic Token Refresh
// ============================================================================

interface AuthenticatedFetchOptions extends RequestInit {
  accessToken: string;
  refreshToken?: string;
  onTokenRefreshed?: (newAccessToken: string) => void;
  skipAuthHeader?: boolean; // For endpoints that use token in query params
}

/**
 * Centralized fetch wrapper that automatically handles token refresh on 401 errors
 * This ensures all API calls can recover from expired tokens without manual retry logic
 */
async function authenticatedFetch(
  url: string,
  options: AuthenticatedFetchOptions
): Promise<Response> {
  const { accessToken, refreshToken, onTokenRefreshed, skipAuthHeader, ...fetchOptions } = options;

  // Add Authorization header unless explicitly skipped
  if (!skipAuthHeader) {
    fetchOptions.headers = {
      ...fetchOptions.headers,
      'Authorization': `Bearer ${accessToken}`,
    };
  }

  console.log('[authenticatedFetch] Making request to:', url);

  // First attempt with current token
  let response = await fetch(url, fetchOptions);

  // If 401 and we have a refresh token, attempt refresh and retry
  if (response.status === 401 && refreshToken) {
    console.log('[authenticatedFetch] Token expired (401), attempting refresh...');

    const refreshResult = await refreshAccessToken(refreshToken);

    if (refreshResult.success && refreshResult.accessToken) {
      console.log('[authenticatedFetch] Token refreshed successfully, retrying request...');

      // Notify caller of new token (they should update their state)
      if (onTokenRefreshed) {
        onTokenRefreshed(refreshResult.accessToken);
      }

      // Retry request with new token
      if (!skipAuthHeader) {
        fetchOptions.headers = {
          ...fetchOptions.headers,
          'Authorization': `Bearer ${refreshResult.accessToken}`,
        };
      } else {
        // If token is in query params, update the URL
        const urlObj = new URL(url);
        urlObj.searchParams.set('token', refreshResult.accessToken);
        url = urlObj.toString();
      }

      response = await fetch(url, fetchOptions);
      console.log('[authenticatedFetch] Retry response status:', response.status);
    } else {
      console.error('[authenticatedFetch] Token refresh failed, user needs to re-login');
      // Return the 401 response - caller should handle redirect to login
    }
  }

  return response;
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
 * ACTUAL BACKEND: GET /auth/settings
 * Returns: { success: true, preferences: {...}, user: {...} }
 */
export async function getUserPreferences(
  accessToken: string,
  refreshToken?: string,
  onTokenRefreshed?: (newAccessToken: string) => void
): Promise<UserPreferencesResponse> {
  try {
    // Pass token as query parameter to avoid CORS preflight (Cloudflare blocks OPTIONS requests)
    const url = `${API_BASE_URL}/auth/settings?token=${encodeURIComponent(accessToken)}`;
    console.log('[getUserPreferences] Calling API:', url);
    console.log('[getUserPreferences] Token length:', accessToken?.length);
    console.log('[getUserPreferences] API_BASE_URL:', API_BASE_URL);

    let response;
    try {
      // Don't send Content-Type header to avoid CORS preflight
      // GET requests don't need Content-Type since there's no body
      response = await fetch(url, {
        method: 'GET',
      });
    } catch (fetchError) {
      console.error('[getUserPreferences] Fetch failed:', fetchError);
      console.error('[getUserPreferences] Fetch error name:', (fetchError as Error)?.name);
      console.error('[getUserPreferences] Fetch error message:', (fetchError as Error)?.message);
      throw fetchError;
    }

    console.log('[getUserPreferences] Response status:', response.status);
    console.log('[getUserPreferences] Response headers:', Object.fromEntries(response.headers.entries()));

    // If 401 and we have a refresh token, try to refresh and retry
    if (response.status === 401 && refreshToken) {
      console.log('[getUserPreferences] Token expired, attempting refresh...');
      const refreshResult = await refreshAccessToken(refreshToken);

      if (refreshResult.success && refreshResult.accessToken) {
        console.log('[getUserPreferences] Token refreshed, retrying request...');
        // Notify caller of new token
        if (onTokenRefreshed) {
          onTokenRefreshed(refreshResult.accessToken);
        }

        // Retry with new token
        const retryUrl = `${API_BASE_URL}/auth/settings?token=${encodeURIComponent(refreshResult.accessToken)}`;
        response = await fetch(retryUrl, {
          method: 'GET',
        });

        console.log('[getUserPreferences] Retry response status:', response.status);
      } else {
        console.error('[getUserPreferences] Token refresh failed:', refreshResult.error);
        throw new Error('Token expired and refresh failed. Please sign in again.');
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getUserPreferences] API error response:', errorText);
      let error;
      try {
        error = JSON.parse(errorText);
      } catch (e) {
        error = { error: errorText };
      }
      throw new Error(error.error || 'Failed to get user preferences');
    }

    const result = await response.json();
    console.log('[getUserPreferences] API result:', result);
    // Backend returns { preferences: {...}, user: {...} }
    return {
      success: true,
      data: {
        ...result.preferences,
        ...result.user,
      } as UserPreferences,
    };
  } catch (error) {
    console.error('[getUserPreferences] Error getting user preferences:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get user preferences',
      },
      data: {
        id: '',
        userId: '',
        policyInterests: [],
        zipCode: '',
        state: '',
        district: 0,
        briefingTime: '08:00',
        emailNotifications: true,
        weeklyBriefing: true,
        autoPlay: false,
        playbackSpeed: 1.0,
        updatedAt: new Date().toISOString(),
      },
    };
  }
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
  try {
    // Pass token as query parameter to avoid CORS preflight (Cloudflare blocks OPTIONS requests)
    // Use POST instead of PUT because PUT always triggers CORS preflight
    const url = `${API_BASE_URL}/auth/preferences?token=${encodeURIComponent(accessToken)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain', // Avoid CORS preflight
      },
      body: JSON.stringify(preferences)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: data.success, data: preferences as UserPreferences };
  } catch (error) {
    console.error('Update preferences error:', error);
    return {
      success: false,
      error: {
        code: 'UPDATE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update preferences'
      }
    };
  }
}

/**
 * Save onboarding preferences (policy interests, personal info)
 *
 * ACTUAL BACKEND: POST /auth/onboarding
 * Body: { interests: string[], firstName?: string, lastName?: string, zipCode?: string, city?: string }
 */
export async function saveOnboardingPreferences(
  accessToken: string,
  data: {
    policyInterests: string[];
    firstName?: string;
    lastName?: string;
    zipCode?: string;
    city?: string;
    state?: string;
    district?: number;
    briefingTime?: string;
    briefingDays?: string[];
    playbackSpeed?: number;
    autoplay?: boolean;
    emailNotifications?: boolean;
  }
): Promise<UserPreferencesResponse> {
  console.log('[Onboarding] Function called');
  console.log('[Onboarding] API_BASE_URL:', API_BASE_URL);
  console.log('[Onboarding] typeof API_BASE_URL:', typeof API_BASE_URL);

  try {
    // Pass token as query parameter to avoid CORS preflight (Cloudflare blocks OPTIONS requests)
    const url = `${API_BASE_URL}/auth/onboarding?token=${encodeURIComponent(accessToken)}`;
    console.log('[Onboarding] Constructed URL:', url);
    console.log('[Onboarding] Data:', {
      interests: data.policyInterests,
      firstName: data.firstName,
      lastName: data.lastName,
      zipCode: data.zipCode,
      city: data.city,
    });
    console.log('[Onboarding] About to call fetch...');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        // Use text/plain to avoid CORS preflight (application/json triggers preflight)
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        interests: data.policyInterests,
        firstName: data.firstName,
        lastName: data.lastName,
        zipCode: data.zipCode,
        city: data.city,
      }),
    });

    console.log('[Onboarding] Response status:', response.status);
    console.log('[Onboarding] Response ok:', response.ok);

    if (!response.ok) {
      const error = await response.json();
      console.error('[Onboarding] Error response:', error);
      console.error('[Onboarding] Error details:', JSON.stringify(error, null, 2));
      throw new Error(error.error || error.message || 'Failed to save onboarding preferences');
    }

    const result = await response.json();
    console.log('[Onboarding] Success response:', result);
    return { success: true, data: result };
  } catch (error) {
    console.error('[Onboarding] Caught error:', error);
    console.error('[Onboarding] Error name:', error instanceof Error ? error.name : 'unknown');
    console.error('[Onboarding] Error message:', error instanceof Error ? error.message : 'unknown');
    console.error('[Onboarding] Error stack:', error instanceof Error ? error.stack : 'unknown');
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to save onboarding preferences',
      },
      data: {} as UserPreferences,
    };
  }
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

/**
 * Get user's congressional representatives
 *
 * ACTUAL BACKEND: GET /dashboard/representatives
 * Returns: { success: true, representatives: [...], stateLegislators: [...], userLocation: { state, district } }
 */
export interface Representative {
  bioguideId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName: string;
  party: string;
  state: string;
  district?: number;
  role: string;
  imageUrl?: string;
  officeAddress?: string;
  phoneNumber?: string;
  url?: string;
  initials: string;
}

/**
 * State legislator (state senator or state representative)
 */
export interface StateLegislator {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  fullName: string;
  party: string;
  state: string;
  district?: string;
  role: string;
  chamber: 'upper' | 'lower';
  imageUrl?: string;
  email?: string;
  initials: string;
}

/**
 * Combined response for all representatives (federal + state)
 */
export interface RepresentativesResponse {
  representatives: Representative[];
  stateLegislators: StateLegislator[];
  userLocation: {
    state: string;
    district?: number;
  };
}

/**
 * Get a single member/representative by bioguide ID
 */
export async function getMemberById(bioguideId: string): Promise<APIResponse<any>> {
  try {
    const BILLS_API_URL = process.env.NEXT_PUBLIC_BILLS_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const url = `${BILLS_API_URL}/members/${encodeURIComponent(bioguideId)}`;
    console.log('[getMemberById] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
    });

    console.log('[getMemberById] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getMemberById] Error response:', errorText);
      let errorMessage = 'Failed to get member';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || 'Failed to get member';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[getMemberById] Success');
    return {
      success: true,
      data: result.member,
    };
  } catch (error) {
    console.error('[getMemberById] Caught error:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get member',
      },
    };
  }
}

/**
 * Get co-sponsored legislation for a member by bioguide ID
 */
export async function getMemberCosponsoredLegislation(
  bioguideId: string,
  limit: number = 20,
  offset: number = 0
): Promise<APIResponse<any>> {
  try {
    const BILLS_API_URL = process.env.NEXT_PUBLIC_BILLS_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const url = `${BILLS_API_URL}/members/${encodeURIComponent(bioguideId)}/cosponsored-legislation?limit=${limit}&offset=${offset}`;
    console.log('[getMemberCosponsoredLegislation] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
    });

    console.log('[getMemberCosponsoredLegislation] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getMemberCosponsoredLegislation] Error response:', errorText);
      let errorMessage = 'Failed to get co-sponsored legislation';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || 'Failed to get co-sponsored legislation';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[getMemberCosponsoredLegislation] Success, found:', result.cosponsoredBills?.length || 0, 'bills');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[getMemberCosponsoredLegislation] Caught error:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get co-sponsored legislation',
      },
    };
  }
}

export async function getRepresentatives(
  accessToken: string,
  refreshToken?: string,
  onTokenRefreshed?: (newAccessToken: string) => void
): Promise<APIResponse<RepresentativesResponse>> {
  try {
    // Pass token as query parameter to avoid CORS preflight
    let url = `${DASHBOARD_API_URL}/dashboard/representatives?token=${encodeURIComponent(accessToken)}`;
    console.log('[Representatives] Fetching from:', url.replace(accessToken, 'TOKEN_REDACTED'));
    console.log('[Representatives] DASHBOARD_API_URL:', DASHBOARD_API_URL);

    let response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'text/plain', // Avoid CORS preflight
      },
    });

    console.log('[Representatives] Response status:', response.status);

    // If 401 and we have a refresh token, try to refresh and retry
    if (response.status === 401 && refreshToken) {
      console.log('[Representatives] Token expired, attempting refresh...');
      const refreshResult = await refreshAccessToken(refreshToken);

      if (refreshResult.success && refreshResult.accessToken) {
        console.log('[Representatives] Token refreshed, retrying request...');
        // Notify caller of new token
        if (onTokenRefreshed) {
          onTokenRefreshed(refreshResult.accessToken);
        }

        // Retry with new token
        url = `${DASHBOARD_API_URL}/dashboard/representatives?token=${encodeURIComponent(refreshResult.accessToken)}`;
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'text/plain',
          },
        });

        console.log('[Representatives] Retry response status:', response.status);
      } else {
        console.error('[Representatives] Token refresh failed:', refreshResult.error);
        throw new Error('Token expired and refresh failed. Please sign in again.');
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Representatives] Error response:', errorText);
      let errorMessage = 'Failed to get representatives';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || 'Failed to get representatives';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[Representatives] Success, got', result.representatives?.length || 0, 'federal reps,', result.stateLegislators?.length || 0, 'state legislators');
    return {
      success: true,
      data: {
        representatives: result.representatives || [],
        stateLegislators: result.stateLegislators || [],
        userLocation: result.userLocation || { state: '', district: undefined },
      },
    };
  } catch (error) {
    console.error('[Representatives] Caught error:', error);
    console.error('[Representatives] Error name:', error instanceof Error ? error.name : 'unknown');
    console.error('[Representatives] Error message:', error instanceof Error ? error.message : 'unknown');
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get representatives',
      },
      data: {
        representatives: [],
        stateLegislators: [],
        userLocation: { state: '', district: undefined },
      },
    };
  }
}

// ============================================================================
// Voting Record Types & APIs
// ============================================================================

/**
 * Voting record statistics
 */
export interface VotingStats {
  totalVotes: number;
  yeaVotes: number;
  nayVotes: number;
  presentVotes?: number;
  notVotingCount: number;
  attendancePercentage?: number;
  partyAlignmentPercentage?: number;
}

/**
 * Individual vote record
 */
export interface VoteRecord {
  id?: string;
  rollCallNumber?: number;
  voteId?: string;
  voteDate: string;
  voteQuestion: string;
  voteResult: string;
  voteType?: string;
  memberVote: string; // 'Yea' | 'Nay' | 'Not Voting' | 'Present' | 'yes' | 'no' | 'absent' | 'excused' | 'other'
  bill?: {
    id?: string;
    type?: string;
    number?: string;
    identifier?: string;
    title?: string;
  };
  votedWithParty?: boolean | null;
  motion?: string;
  yesCount?: number;
  noCount?: number;
  absentCount?: number;
}

/**
 * Voting record response from API
 */
export interface VotingRecordResponse {
  success: boolean;
  member: {
    bioguideId?: string;
    id?: string;
    fullName: string;
    party: string;
    state: string;
    chamber: 'House' | 'Senate' | 'upper' | 'lower';
    district?: string | null;
  };
  stats: VotingStats | null;
  votes: VoteRecord[];
  pagination: {
    total: number;
    limit: number;
    hasMore: boolean;
    offset?: number;
  };
  dataAvailability: {
    hasData: boolean;
    reason?: 'senate_not_available' | 'no_votes_found';
    message?: string;
  };
}

/**
 * Get voting record for a federal House member
 *
 * API ENDPOINT: GET /members/:bioguideId/voting-record
 * QUERY PARAMETERS: { congress?: number, limit?: number }
 *
 * Note: Senate voting records are NOT available via Congress.gov API.
 * For Senate members, the response will have dataAvailability.hasData = false
 * and reason = 'senate_not_available'
 */
export async function getMemberVotingRecord(
  bioguideId: string,
  params?: { congress?: number; limit?: number }
): Promise<APIResponse<VotingRecordResponse>> {
  try {
    const BILLS_API_URL = process.env.NEXT_PUBLIC_BILLS_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Build query parameters
    const queryParams = new URLSearchParams();
    if (params?.congress) queryParams.append('congress', String(params.congress));
    if (params?.limit) queryParams.append('limit', String(params.limit));

    const url = `${BILLS_API_URL}/members/${encodeURIComponent(bioguideId)}/voting-record?${queryParams.toString()}`;
    console.log('[getMemberVotingRecord] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
    });

    console.log('[getMemberVotingRecord] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getMemberVotingRecord] Error response:', errorText);
      let errorMessage = 'Failed to get voting record';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || 'Failed to get voting record';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[getMemberVotingRecord] Success, found:', result.votes?.length || 0, 'votes');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[getMemberVotingRecord] Caught error:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get voting record',
      },
    };
  }
}

/**
 * Get voting record for a state legislator
 *
 * API ENDPOINT: GET /state-legislators/:id/voting-record
 * QUERY PARAMETERS: { limit?: number }
 *
 * Returns voting history from OpenStates API
 */
export async function getStateLegislatorVotingRecord(
  legislatorId: string,
  params?: { limit?: number }
): Promise<APIResponse<VotingRecordResponse>> {
  try {
    const BILLS_API_URL = process.env.NEXT_PUBLIC_BILLS_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Build query parameters
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', String(params.limit));

    const url = `${BILLS_API_URL}/state-legislators/${encodeURIComponent(legislatorId)}/voting-record?${queryParams.toString()}`;
    console.log('[getStateLegislatorVotingRecord] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
    });

    console.log('[getStateLegislatorVotingRecord] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getStateLegislatorVotingRecord] Error response:', errorText);
      let errorMessage = 'Failed to get voting record';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || 'Failed to get voting record';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[getStateLegislatorVotingRecord] Success, found:', result.votes?.length || 0, 'votes');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[getStateLegislatorVotingRecord] Caught error:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get voting record',
      },
    };
  }
}

/**
 * Search all members of Congress
 *
 * API ENDPOINT: GET /members/search
 * QUERY PARAMETERS: { query?: string, party?: string, state?: string, chamber?: 'house' | 'senate', currentOnly?: boolean, limit?: number, offset?: number }
 * SUCCESS RESPONSE (200): {
 *   success: true,
 *   members: [...],
 *   pagination: { total, limit, offset, hasMore }
 * }
 */
export async function searchMembers(params: {
  query?: string;
  party?: string;
  state?: string;
  chamber?: 'house' | 'senate';
  currentOnly?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<APIResponse<any>> {
  try {
    const BILLS_API_URL = process.env.NEXT_PUBLIC_BILLS_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Build query parameters
    const queryParams = new URLSearchParams();
    if (params.query) queryParams.append('query', params.query);
    if (params.party && params.party !== 'all') queryParams.append('party', params.party);
    if (params.state && params.state !== 'all') queryParams.append('state', params.state);
    if (params.chamber) queryParams.append('chamber', params.chamber);
    if (params.currentOnly !== undefined) queryParams.append('currentOnly', String(params.currentOnly));
    if (params.limit !== undefined) queryParams.append('limit', String(params.limit));
    if (params.offset !== undefined) queryParams.append('offset', String(params.offset));

    const url = `${BILLS_API_URL}/members/search?${queryParams.toString()}`;
    console.log('[searchMembers] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
    });

    console.log('[searchMembers] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[searchMembers] Error response:', errorText);
      let errorMessage = 'Failed to search members';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || 'Failed to search members';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[searchMembers] Success, found:', result.members?.length || 0, 'members');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[searchMembers] Caught error:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to search members',
      },
    };
  }
}

// ============================================================================
// Personalized News & Bookmarks
// ============================================================================

/**
 * Get personalized news articles filtered by user's policy interests
 */
export async function getPersonalizedNews(
  accessToken: string,
  limit?: number,
  refreshToken?: string,
  onTokenRefreshed?: (newAccessToken: string) => void
): Promise<APIResponse<{
  articles: Array<{
    id: string;
    interest: string;
    title: string;
    url: string;
    author: string | null;
    summary: string;
    imageUrl: string | null;
    publishedDate: string;
    fetchedAt: number;
    score: number;
    sourceDomain: string;
  }>;
  count: number;
  interests: string[];
}>> {
  try {
    console.log('[getPersonalizedNews] Fetching personalized news...');
    console.log('[getPersonalizedNews] DASHBOARD_API_URL:', DASHBOARD_API_URL);
    console.log('[getPersonalizedNews] Access token present:', !!accessToken);

    if (!DASHBOARD_API_URL) {
      throw new Error('DASHBOARD_API_URL is not configured');
    }

    const queryParams = new URLSearchParams();
    queryParams.append('token', accessToken); // Use token in query param to avoid CORS preflight
    if (limit) queryParams.append('limit', String(limit));

    const url = `${DASHBOARD_API_URL}/dashboard/news?${queryParams.toString()}`;
    console.log('[getPersonalizedNews] Fetching from:', url);

    // Use centralized fetch wrapper with automatic token refresh
    const response = await authenticatedFetch(url, {
      method: 'GET',
      accessToken,
      refreshToken,
      onTokenRefreshed,
      skipAuthHeader: true, // Token is in query params
    });

    console.log('[getPersonalizedNews] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getPersonalizedNews] Error response:', errorText);
      let errorMessage = 'Failed to fetch personalized news';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || 'Failed to fetch personalized news';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[getPersonalizedNews] Success, found:', result.count || 0, 'articles');

    // DEBUG: Log first article's imageUrl
    if (result.articles && result.articles.length > 0) {
      console.log('[getPersonalizedNews] 🖼️ First article imageUrl:', result.articles[0].imageUrl);
      console.log('[getPersonalizedNews] 📰 First article title:', result.articles[0].title);
      console.log('[getPersonalizedNews] 🔍 Full first article:', JSON.stringify(result.articles[0], null, 2));
    }

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[getPersonalizedNews] Caught error:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch personalized news',
      },
    };
  }
}

/**
 * Bookmark an article to user's profile
 */
export async function bookmarkArticle(
  accessToken: string,
  article: {
    articleUrl: string;
    title: string;
    summary?: string;
    imageUrl?: string;
    interest: string;
  },
  refreshToken?: string,
  onTokenRefreshed?: (newAccessToken: string) => void
): Promise<APIResponse<{ message: string }>> {
  try {
    console.log('[bookmarkArticle] Bookmarking article:', article.title);

    const url = `${DASHBOARD_API_URL}/dashboard/news/bookmark`;
    const response = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(article),
      accessToken,
      refreshToken,
      onTokenRefreshed,
    });

    console.log('[bookmarkArticle] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[bookmarkArticle] Error response:', errorText);
      let errorMessage = 'Failed to bookmark article';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || 'Failed to bookmark article';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[bookmarkArticle] Success');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[bookmarkArticle] Caught error:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to bookmark article',
      },
    };
  }
}

/**
 * Remove a bookmark
 */
export async function removeBookmark(
  accessToken: string,
  bookmarkId: string
): Promise<APIResponse<{ message: string }>> {
  try {
    console.log('[removeBookmark] Removing bookmark:', bookmarkId);

    const url = `${DASHBOARD_API_URL}/dashboard/news/bookmark/${bookmarkId}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders(accessToken),
    });

    console.log('[removeBookmark] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[removeBookmark] Error response:', errorText);
      let errorMessage = 'Failed to remove bookmark';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || 'Failed to remove bookmark';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[removeBookmark] Success');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[removeBookmark] Caught error:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to remove bookmark',
      },
    };
  }
}

/**
 * Get user's saved bookmarks
 */
export async function getUserBookmarks(
  accessToken: string,
  limit?: number
): Promise<APIResponse<{
  bookmarks: Array<{
    id: string;
    articleUrl: string;
    title: string;
    summary: string | null;
    imageUrl: string | null;
    interest: string;
    createdAt: number;
  }>;
  count: number;
}>> {
  try {
    console.log('[getUserBookmarks] Fetching user bookmarks...');

    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', String(limit));

    const url = `${DASHBOARD_API_URL}/dashboard/news/bookmarks?${queryParams.toString()}`;
    console.log('[getUserBookmarks] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(accessToken),
    });

    console.log('[getUserBookmarks] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getUserBookmarks] Error response:', errorText);
      let errorMessage = 'Failed to fetch bookmarks';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || 'Failed to fetch bookmarks';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[getUserBookmarks] Success, found:', result.count || 0, 'bookmarks');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[getUserBookmarks] Caught error:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch bookmarks',
      },
    };
  }
}

/**
 * Get personalized bills based on user's policy interests
 */
export async function getPersonalizedBills(
  accessToken: string,
  limit?: number,
  refreshToken?: string,
  onTokenRefreshed?: (newAccessToken: string) => void
): Promise<APIResponse<{
  bills: Array<{
    id: string;
    congress: number;
    billType: string;
    billNumber: number;
    title: string;
    policyArea: string | null;
    introducedDate: string | null;
    latestActionDate: string | null;
    latestActionText: string | null;
    originChamber: string | null;
    updateDate: string | null;
    sponsor: {
      firstName: string;
      lastName: string;
      party: string;
      state: string;
    } | null;
    enrichment: {
      plainLanguageSummary: string;
      keyPoints: string[];
      readingTimeMinutes: number;
      impactLevel: string;
      bipartisanScore: number;
      currentStage: string;
      progressPercentage: number;
      tags: string[];
      enrichedAt: string;
      modelUsed: string;
    } | null;
  }>;
  count: number;
  interests: string[];
}>> {
  try {
    console.log('[getPersonalizedBills] Fetching personalized bills...');
    console.log('[getPersonalizedBills] DASHBOARD_API_URL:', DASHBOARD_API_URL);
    console.log('[getPersonalizedBills] Access token present:', !!accessToken);

    if (!DASHBOARD_API_URL) {
      throw new Error('DASHBOARD_API_URL is not configured');
    }

    const queryParams = new URLSearchParams();
    queryParams.append('token', accessToken); // Use token in query param to avoid CORS preflight
    if (limit) queryParams.append('limit', String(limit));

    const url = `${DASHBOARD_API_URL}/dashboard/bills?${queryParams.toString()}`;
    console.log('[getPersonalizedBills] Fetching from:', url);

    // Use centralized fetch wrapper with automatic token refresh
    const response = await authenticatedFetch(url, {
      method: 'GET',
      accessToken,
      refreshToken,
      onTokenRefreshed,
      skipAuthHeader: true, // Token is in query params
    });

    console.log('[getPersonalizedBills] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getPersonalizedBills] Error response:', errorText);
      let errorMessage = 'Failed to fetch personalized bills';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || 'Failed to fetch personalized bills';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[getPersonalizedBills] Success, found:', result.count || 0, 'bills');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[getPersonalizedBills] Caught error:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch personalized bills',
      },
    };
  }
}

/**
 * Get detailed information for a specific bill by ID
 */
export async function getBillById(
  billId: string,
  accessToken?: string
): Promise<APIResponse<{
  bill: {
    id: string;
    congress: number;
    type: string;
    number: number;
    title: string;
    text: string | null;
    policyArea: string | null;
    introducedDate: string | null;
    latestAction?: {
      date: string | null;
      text: string | null;
    };
    latestActionDate?: string | null;
    latestActionText?: string | null;
    originChamber: string | null;
    updateDate: string | null;
    sponsor: {
      bioguideId: string;
      firstName: string;
      lastName: string;
      fullName: string;
      party: string;
      state: string;
    } | null;
    enrichment: {
      plainLanguageSummary: string;
      keyPoints: string[];
      readingTimeMinutes: number;
      impactLevel: string;
      bipartisanScore: number;
      currentStage: string;
      progressPercentage: number;
      tags: string[];
      enrichedAt: string;
      modelUsed: string;
    } | null;
    analysis: {
      executiveSummary: string;
      statusQuoVsChange: string;
      sectionBreakdown: Array<{
        section: string;
        summary: string;
      }>;
      mechanismOfAction: string;
      agencyPowers: string[];
      fiscalImpact: {
        estimatedCost: string;
        fundingSource: string;
        timeframe: string;
      };
      stakeholderImpact: {
        [key: string]: string;
      };
      unintendedConsequences: string[];
      argumentsFor: string[];
      argumentsAgainst: string[];
      implementationChallenges: string[];
      passageLikelihood: string;
      passageReasoning: string;
      recentDevelopments: Array<{
        date: string;
        event: string;
      }>;
      stateImpacts: {
        [state: string]: string;
      };
      thinkingSummary: string;
      analyzedAt: string;
      modelUsed: string;
    } | null;
  };
}>> {
  try {
    console.log('[getBillById] Fetching bill:', billId);
    console.log('[getBillById] Access token present:', !!accessToken);

    // Use Next.js API route to avoid CORS issues
    const url = `/api/bills/${billId}`;
    console.log('[getBillById] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(accessToken),
    });

    console.log('[getBillById] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();

      // 401 during initial load is expected (auth not ready yet)
      if (response.status === 401) {
        console.log('[getBillById] Auth not ready, will retry when token available');
      } else {
        console.error('[getBillById] Error response:', errorText);
      }

      return {
        success: false,
        error: {
          code: response.status === 404 ? 'NOT_FOUND' : response.status === 401 ? 'UNAUTHORIZED' : 'API_ERROR',
          message: response.status === 404 ? 'Bill not found' : response.status === 401 ? 'Authentication required' : `Failed to fetch bill: ${response.statusText}`,
        },
      };
    }

    const data = await response.json();
    console.log('[getBillById] Received bill data');

    return {
      success: true,
      data: {
        bill: data.bill,
      },
    };
  } catch (error) {
    console.error('[getBillById] Caught error:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch bill',
      },
    };
  }
}

/**
 * Bookmark a bill to user's profile
 */
export async function bookmarkBill(
  accessToken: string,
  bill: {
    billId: string;
    title: string;
    policyArea: string;
    latestActionText?: string;
    latestActionDate?: string;
  },
  refreshToken?: string,
  onTokenRefreshed?: (newAccessToken: string) => void
): Promise<APIResponse<{ message: string; bookmarkId: string }>> {
  try {
    console.log('[bookmarkBill] Bookmarking bill:', bill.title);

    const url = `${DASHBOARD_API_URL}/dashboard/bills/bookmark`;
    const response = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bill),
      accessToken,
      refreshToken,
      onTokenRefreshed,
    });

    console.log('[bookmarkBill] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[bookmarkBill] Error response:', errorText);
      let errorMessage = 'Failed to bookmark bill';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || 'Failed to bookmark bill';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[bookmarkBill] Success');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[bookmarkBill] Caught error:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to bookmark bill',
      },
    };
  }
}

/**
 * Get user's saved bill bookmarks
 */
export async function getUserBillBookmarks(
  accessToken: string
): Promise<APIResponse<{
  bookmarks: Array<{
    id: string;
    billId: string;
    title: string;
    policyArea: string;
    latestActionText: string | null;
    latestActionDate: string | null;
    createdAt: number;
    congress: number;
    billType: string;
    billNumber: number;
    originChamber: string | null;
  }>;
  count: number;
}>> {
  try {
    console.log('[getUserBillBookmarks] Fetching user bill bookmarks...');

    const url = `${DASHBOARD_API_URL}/dashboard/bills/bookmarks`;
    console.log('[getUserBillBookmarks] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(accessToken),
    });

    console.log('[getUserBillBookmarks] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getUserBillBookmarks] Error response:', errorText);
      let errorMessage = 'Failed to fetch bill bookmarks';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || 'Failed to fetch bill bookmarks';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[getUserBillBookmarks] Success, found:', result.count || 0, 'bookmarks');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[getUserBillBookmarks] Caught error:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch bill bookmarks',
      },
    };
  }
}

// ============================================================================
// State Bills APIs
// ============================================================================

/**
 * State bill from OpenStates API
 */
export interface StateBill {
  id: string;
  state: string;
  session: string;
  identifier: string;
  title: string;
  subjects: string[];
  classification: string[];
  abstract: string | null;
  chamber: 'upper' | 'lower' | null;
  latestAction: {
    date: string | null;
    description: string | null;
  };
  firstActionDate: string | null;
  openstatesUrl: string | null;
  detailId: string; // URL-encoded ID for routing to detail page
  sponsor: {
    name: string;
    party: string | null;
    district: string | null;
  } | null;
}

/**
 * Get state legislature bills filtered by state
 *
 * API ENDPOINT: GET /state-bills
 * QUERY PARAMETERS: {
 *   state: string (required) - 2-letter state code
 *   subject?: string
 *   query?: string
 *   chamber?: 'upper' | 'lower'
 *   limit?: number (default: 20)
 *   offset?: number (default: 0)
 *   sort?: 'latest_action_date' | 'identifier'
 *   order?: 'asc' | 'desc'
 * }
 */
export async function getStateBills(params: {
  state: string;
  subject?: string;
  query?: string;
  chamber?: 'upper' | 'lower';
  limit?: number;
  offset?: number;
  sort?: 'latest_action_date' | 'identifier';
  order?: 'asc' | 'desc';
}): Promise<APIResponse<{
  success: boolean;
  state: string;
  bills: StateBill[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}>> {
  try {
    const BILLS_API_URL = process.env.NEXT_PUBLIC_BILLS_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('state', params.state);
    if (params.subject) queryParams.append('subject', params.subject);
    if (params.query) queryParams.append('query', params.query);
    if (params.chamber) queryParams.append('chamber', params.chamber);
    if (params.limit !== undefined) queryParams.append('limit', String(params.limit));
    if (params.offset !== undefined) queryParams.append('offset', String(params.offset));
    if (params.sort) queryParams.append('sort', params.sort);
    if (params.order) queryParams.append('order', params.order);

    const url = `${BILLS_API_URL}/state-bills?${queryParams.toString()}`;
    console.log('[getStateBills] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
    });

    console.log('[getStateBills] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getStateBills] Error response:', errorText);
      let errorMessage = 'Failed to fetch state bills';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || 'Failed to fetch state bills';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[getStateBills] Success, found:', result.bills?.length || 0, 'bills');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[getStateBills] Caught error:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch state bills',
      },
    };
  }
}

/**
 * State bill detail data returned from API
 */
export interface StateBillDetail {
  id: string;
  state: string;
  session: string;
  identifier: string;
  title: string;
  subjects: string[];
  classification: string[];
  abstract: string | null;
  chamber: string;
  latestAction: {
    date: string | null;
    description: string | null;
  };
  firstActionDate: string | null;
  openstatesUrl: string | null;
  sponsors: Array<{
    name: string;
    classification: string;
  }>;
  textVersions: Array<{
    url: string;
    date: string | null;
    note: string | null;
    mediaType: string | null;
  }>;
  createdAt: number;
  updatedAt: number;
}

/**
 * Get state bill by ID (OCD ID)
 *
 * API ENDPOINT: GET /state-bills/:id
 * The ID should be URL-encoded since OCD IDs contain special characters
 */
export async function getStateBillById(billId: string): Promise<APIResponse<{
  success: boolean;
  bill: StateBillDetail;
}>> {
  try {
    const BILLS_API_URL = process.env.NEXT_PUBLIC_BILLS_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // billId should already be URL-encoded from the route param
    const url = `${BILLS_API_URL}/state-bills/${billId}`;
    console.log('[getStateBillById] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
    });

    console.log('[getStateBillById] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getStateBillById] Error response:', errorText);
      let errorMessage = 'Failed to fetch state bill';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || 'Failed to fetch state bill';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[getStateBillById] Success, bill:', result.bill?.identifier);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[getStateBillById] Caught error:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch state bill',
      },
    };
  }
}

// ============================================================================
// State Legislators APIs
// ============================================================================

// StateLegislator interface is defined above with Representative types

/**
 * Get state legislators by geographic coordinates
 *
 * API ENDPOINT: GET /state-legislators
 * QUERY PARAMETERS: {
 *   lat: number (required) - Latitude
 *   lng: number (required) - Longitude
 * }
 */
export async function getStateLegislators(params: {
  lat: number;
  lng: number;
}): Promise<APIResponse<{
  success: boolean;
  legislators: StateLegislator[];
  count: number;
}>> {
  try {
    const BILLS_API_URL = process.env.NEXT_PUBLIC_BILLS_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    const queryParams = new URLSearchParams();
    queryParams.append('lat', String(params.lat));
    queryParams.append('lng', String(params.lng));

    const url = `${BILLS_API_URL}/state-legislators?${queryParams.toString()}`;
    console.log('[getStateLegislators] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
    });

    console.log('[getStateLegislators] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getStateLegislators] Error response:', errorText);
      let errorMessage = 'Failed to fetch state legislators';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || 'Failed to fetch state legislators';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[getStateLegislators] Success, found:', result.legislators?.length || 0, 'legislators');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[getStateLegislators] Caught error:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch state legislators',
      },
    };
  }
}

/**
 * Get a single state legislator by ID
 *
 * API ENDPOINT: GET /state-legislators/:id
 * SUCCESS RESPONSE (200): {
 *   success: true,
 *   member: {
 *     id: string,
 *     fullName: string,
 *     firstName: string,
 *     lastName: string,
 *     party: string,
 *     state: string,
 *     chamber: string,
 *     district: string,
 *     imageUrl: string | null,
 *     currentMember: boolean
 *   }
 * }
 */
export async function getStateLegislatorById(legislatorId: string): Promise<APIResponse<any>> {
  try {
    const BILLS_API_URL = process.env.NEXT_PUBLIC_BILLS_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const url = `${BILLS_API_URL}/state-legislators/${encodeURIComponent(legislatorId)}`;
    console.log('[getStateLegislatorById] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
    });

    console.log('[getStateLegislatorById] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getStateLegislatorById] Error response:', errorText);
      let errorMessage = 'Failed to get state legislator';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || 'Failed to get state legislator';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[getStateLegislatorById] Success:', result.member?.fullName);
    return {
      success: true,
      data: result.member,
    };
  } catch (error) {
    console.error('[getStateLegislatorById] Caught error:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get state legislator',
      },
    };
  }
}

// ============================================================================
// Bills Semantic Search APIs
// ============================================================================

/**
 * Semantic search for bills using vector embeddings in SmartBucket
 *
 * API ENDPOINT: POST /bills/semantic-search
 * REQUEST BODY: { query: string, limit?: number, congress?: number }
 * SUCCESS RESPONSE (200): {
 *   success: true,
 *   query: string,
 *   bills: Array<{
 *     id: string,
 *     congress: number,
 *     type: string,
 *     number: number,
 *     title: string,
 *     policyArea: string | null,
 *     originChamber: string,
 *     introducedDate: string,
 *     latestAction: { date: string, text: string },
 *     sponsor: {
 *       bioguideId: string,
 *       firstName: string,
 *       lastName: string,
 *       party: string,
 *       state: string
 *     } | null,
 *     relevanceScore: number,
 *     matchedChunk: string | null
 *   }>,
 *   count: number,
 *   searchMethod: 'vector_similarity'
 * }
 */
export async function semanticSearchBills(params: {
  query: string;
  limit?: number;
  congress?: number;
}): Promise<APIResponse<{
  success: boolean;
  query: string;
  bills: Array<{
    id: string;
    congress: number;
    type: string;
    number: number;
    title: string;
    policyArea: string | null;
    originChamber: string;
    introducedDate: string;
    latestAction: { date: string; text: string };
    sponsor: {
      bioguideId: string;
      firstName: string;
      lastName: string;
      party: string;
      state: string;
    } | null;
    relevanceScore: number;
    matchedChunk: string | null;
  }>;
  count: number;
  searchMethod: string;
}>> {
  try {
    // Always use /api proxy for client-side requests (bypasses CORS)
    const url = '/api/bills/semantic-search';
    console.log('[semanticSearchBills] Searching for:', params.query);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    console.log('[semanticSearchBills] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[semanticSearchBills] Error response:', errorText);
      let errorMessage = 'Failed to search bills';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || 'Failed to search bills';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[semanticSearchBills] Success, found:', result.count || 0, 'bills');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[semanticSearchBills] Caught error:', error);
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to search bills',
      },
    };
  }
}
