/**
 * WorkOS Authentication API Client
 *
 * Provides functions for user authentication using WorkOS, including:
 * - OAuth (Google, Microsoft, GitHub)
 * - Email/password authentication
 * - Session management
 * - Magic links
 *
 * API Base URL: https://api.workos.com
 * Documentation: https://workos.com/docs/reference
 */

import {
  WorkOSUser,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  OAuthProvider,
  OAuthAuthorizationURLRequest,
  OAuthAuthorizationURLResponse,
  OAuthCallbackParams,
  AuthSession,
  RefreshTokenRequest,
  RefreshTokenResponse,
  PasswordResetRequest,
  EmailVerificationRequest,
  MagicLinkRequest,
  WorkOSError,
} from '../api-specs/workos.types';
import { APIResponse } from '../api-specs/common.types';

// ============================================================================
// Mock Data (Replace with actual API calls)
// ============================================================================

const MOCK_USER: WorkOSUser = {
  id: 'user_01HQZV9X6P2K3M4N5Q7R8T9V0W',
  email: 'demo@hakivo.com',
  emailVerified: true,
  firstName: 'Alex',
  lastName: 'Johnson',
  profilePictureUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_SESSION: AuthSession = {
  accessToken: 'wos_access_token_mock_123456789',
  refreshToken: 'wos_refresh_token_mock_123456789',
  user: MOCK_USER,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
};

// ============================================================================
// OAuth Authentication
// ============================================================================

/**
 * Generate OAuth authorization URL for Google login
 *
 * @param redirectUri - URL to redirect to after OAuth authorization
 * @param state - Optional state parameter for CSRF protection
 * @returns Authorization URL to redirect user to
 *
 * API ENDPOINT: POST https://api.workos.com/user_management/authorize
 * HEADERS: {
 *   'Authorization': 'Bearer {WORKOS_API_KEY}',
 *   'Content-Type': 'application/json'
 * }
 * REQUEST BODY: {
 *   provider: 'GoogleOAuth' | 'MicrosoftOAuth' | 'GitHubOAuth',
 *   client_id: string,
 *   redirect_uri: string,
 *   state?: string,
 *   response_type: 'code'
 * }
 * SUCCESS RESPONSE (200): {
 *   url: string
 * }
 * ERROR RESPONSES:
 *   400: { code: 'invalid_request', message: 'Invalid provider or redirect URI' }
 *   401: { code: 'unauthorized', message: 'Invalid API key' }
 *   429: { code: 'rate_limit_exceeded', message: 'Too many requests' }
 */
export async function getOAuthAuthorizationURL(
  provider: OAuthProvider,
  redirectUri: string,
  state?: string
): Promise<APIResponse<OAuthAuthorizationURLResponse>> {
  // API ENDPOINT: POST https://api.workos.com/user_management/authorize
  // HEADERS: {
  //   'Authorization': 'Bearer {WORKOS_API_KEY}',
  //   'Content-Type': 'application/json'
  // }
  // REQUEST BODY: {
  //   provider: 'GoogleOAuth',
  //   client_id: process.env.WORKOS_CLIENT_ID,
  //   redirect_uri: redirectUri,
  //   state: state,
  //   response_type: 'code'
  // }

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      url: `https://accounts.google.com/o/oauth2/v2/auth?client_id=mock&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&state=${state || 'mock_state'}&response_type=code&scope=openid%20email%20profile`,
      state: state,
    },
  };
}

/**
 * Handle OAuth callback and exchange code for session
 *
 * @param code - Authorization code from OAuth provider
 * @returns User session with access token
 *
 * API ENDPOINT: POST https://api.workos.com/user_management/authenticate
 * HEADERS: {
 *   'Authorization': 'Bearer {WORKOS_API_KEY}',
 *   'Content-Type': 'application/json'
 * }
 * REQUEST BODY: {
 *   client_id: string,
 *   client_secret: string,
 *   grant_type: 'authorization_code',
 *   code: string
 * }
 * SUCCESS RESPONSE (200): {
 *   access_token: string,
 *   refresh_token: string,
 *   user: {
 *     id: string,
 *     email: string,
 *     email_verified: boolean,
 *     profile_picture_url?: string,
 *     first_name?: string,
 *     last_name?: string,
 *     created_at: string,
 *     updated_at: string
 *   },
 *   expires_in: number
 * }
 * ERROR RESPONSES:
 *   400: { code: 'invalid_grant', message: 'Invalid authorization code' }
 *   401: { code: 'unauthorized', message: 'Invalid client credentials' }
 *   429: { code: 'rate_limit_exceeded', message: 'Too many requests' }
 */
export async function handleOAuthCallback(
  params: OAuthCallbackParams
): Promise<APIResponse<AuthResponse>> {
  // API ENDPOINT: POST https://api.workos.com/user_management/authenticate
  // HEADERS: {
  //   'Authorization': 'Bearer {WORKOS_API_KEY}',
  //   'Content-Type': 'application/json'
  // }
  // REQUEST BODY: {
  //   client_id: process.env.WORKOS_CLIENT_ID,
  //   client_secret: process.env.WORKOS_API_KEY,
  //   grant_type: 'authorization_code',
  //   code: params.code
  // }

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      session: MOCK_SESSION,
      user: MOCK_USER,
    },
  };
}

/**
 * Login with Google OAuth
 * Convenience function that generates authorization URL
 */
export async function loginWithGoogle(
  redirectUri: string
): Promise<APIResponse<OAuthAuthorizationURLResponse>> {
  return getOAuthAuthorizationURL(OAuthProvider.GOOGLE, redirectUri);
}

// ============================================================================
// Email/Password Authentication
// ============================================================================

/**
 * Register a new user with email and password
 *
 * @param data - Registration data (email, password, optional name)
 * @returns User session with access token
 *
 * API ENDPOINT: POST https://api.workos.com/user_management/users
 * HEADERS: {
 *   'Authorization': 'Bearer {WORKOS_API_KEY}',
 *   'Content-Type': 'application/json'
 * }
 * REQUEST BODY: {
 *   email: string,
 *   password: string,
 *   first_name?: string,
 *   last_name?: string,
 *   email_verified: boolean
 * }
 * SUCCESS RESPONSE (201): {
 *   id: string,
 *   email: string,
 *   email_verified: boolean,
 *   profile_picture_url?: string,
 *   first_name?: string,
 *   last_name?: string,
 *   created_at: string,
 *   updated_at: string
 * }
 * ERROR RESPONSES:
 *   400: { code: 'invalid_request', message: 'Invalid email or password format' }
 *   409: { code: 'user_already_exists', message: 'User with this email already exists' }
 *   422: { code: 'validation_error', message: 'Password does not meet requirements', details: { field: 'password', reason: 'min_length_8' } }
 *   429: { code: 'rate_limit_exceeded', message: 'Too many requests' }
 */
export async function register(
  data: RegisterRequest
): Promise<APIResponse<AuthResponse>> {
  // API ENDPOINT: POST https://api.workos.com/user_management/users
  // HEADERS: {
  //   'Authorization': 'Bearer {WORKOS_API_KEY}',
  //   'Content-Type': 'application/json'
  // }
  // REQUEST BODY: {
  //   email: data.email,
  //   password: data.password,
  //   first_name: data.firstName,
  //   last_name: data.lastName,
  //   email_verified: false
  // }

  // After user creation, need to authenticate to get session:
  // API ENDPOINT: POST https://api.workos.com/user_management/authenticate
  // REQUEST BODY: {
  //   client_id: process.env.WORKOS_CLIENT_ID,
  //   client_secret: process.env.WORKOS_API_KEY,
  //   grant_type: 'password',
  //   email: data.email,
  //   password: data.password
  // }

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      session: MOCK_SESSION,
      user: { ...MOCK_USER, ...data, id: 'user_' + Math.random().toString(36).substr(2, 9) },
    },
  };
}

/**
 * Login with email and password
 *
 * @param data - Login credentials (email, password)
 * @returns User session with access token
 *
 * API ENDPOINT: POST https://api.workos.com/user_management/authenticate
 * HEADERS: {
 *   'Authorization': 'Bearer {WORKOS_API_KEY}',
 *   'Content-Type': 'application/json'
 * }
 * REQUEST BODY: {
 *   client_id: string,
 *   client_secret: string,
 *   grant_type: 'password',
 *   email: string,
 *   password: string
 * }
 * SUCCESS RESPONSE (200): {
 *   access_token: string,
 *   refresh_token: string,
 *   user: {
 *     id: string,
 *     email: string,
 *     email_verified: boolean,
 *     profile_picture_url?: string,
 *     first_name?: string,
 *     last_name?: string,
 *     created_at: string,
 *     updated_at: string
 *   },
 *   expires_in: number
 * }
 * ERROR RESPONSES:
 *   400: { code: 'invalid_request', message: 'Missing email or password' }
 *   401: { code: 'invalid_credentials', message: 'Invalid email or password' }
 *   403: { code: 'email_not_verified', message: 'Please verify your email before logging in' }
 *   429: { code: 'rate_limit_exceeded', message: 'Too many login attempts. Try again later.' }
 */
export async function login(
  data: LoginRequest
): Promise<APIResponse<AuthResponse>> {
  // API ENDPOINT: POST https://api.workos.com/user_management/authenticate
  // HEADERS: {
  //   'Authorization': 'Bearer {WORKOS_API_KEY}',
  //   'Content-Type': 'application/json'
  // }
  // REQUEST BODY: {
  //   client_id: process.env.WORKOS_CLIENT_ID,
  //   client_secret: process.env.WORKOS_API_KEY,
  //   grant_type: 'password',
  //   email: data.email,
  //   password: data.password
  // }

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      session: MOCK_SESSION,
      user: MOCK_USER,
    },
  };
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Get current authenticated user
 *
 * @param accessToken - User's access token
 * @returns Current user information
 *
 * API ENDPOINT: GET https://api.workos.com/user_management/users/{userId}
 * HEADERS: {
 *   'Authorization': 'Bearer {access_token}',
 *   'Content-Type': 'application/json'
 * }
 * SUCCESS RESPONSE (200): {
 *   id: string,
 *   email: string,
 *   email_verified: boolean,
 *   profile_picture_url?: string,
 *   first_name?: string,
 *   last_name?: string,
 *   created_at: string,
 *   updated_at: string
 * }
 * ERROR RESPONSES:
 *   401: { code: 'unauthorized', message: 'Invalid or expired access token' }
 *   404: { code: 'user_not_found', message: 'User not found' }
 *   429: { code: 'rate_limit_exceeded', message: 'Too many requests' }
 */
export async function getCurrentUser(
  accessToken: string
): Promise<APIResponse<WorkOSUser>> {
  // First, verify the access token and extract user ID:
  // API ENDPOINT: POST https://api.workos.com/user_management/sessions/verify
  // HEADERS: {
  //   'Authorization': 'Bearer {WORKOS_API_KEY}',
  //   'Content-Type': 'application/json'
  // }
  // REQUEST BODY: {
  //   access_token: accessToken
  // }

  // Then fetch user details:
  // API ENDPOINT: GET https://api.workos.com/user_management/users/{userId}
  // HEADERS: {
  //   'Authorization': 'Bearer {WORKOS_API_KEY}'
  // }

  // TODO: Replace with actual API call
  return {
    success: true,
    data: MOCK_USER,
  };
}

/**
 * Refresh access token using refresh token
 *
 * @param refreshToken - User's refresh token
 * @returns New access token and refresh token
 *
 * API ENDPOINT: POST https://api.workos.com/user_management/authenticate
 * HEADERS: {
 *   'Authorization': 'Bearer {WORKOS_API_KEY}',
 *   'Content-Type': 'application/json'
 * }
 * REQUEST BODY: {
 *   client_id: string,
 *   client_secret: string,
 *   grant_type: 'refresh_token',
 *   refresh_token: string
 * }
 * SUCCESS RESPONSE (200): {
 *   access_token: string,
 *   refresh_token: string,
 *   expires_in: number
 * }
 * ERROR RESPONSES:
 *   400: { code: 'invalid_request', message: 'Missing refresh token' }
 *   401: { code: 'invalid_token', message: 'Invalid or expired refresh token' }
 *   429: { code: 'rate_limit_exceeded', message: 'Too many requests' }
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<APIResponse<RefreshTokenResponse>> {
  // API ENDPOINT: POST https://api.workos.com/user_management/authenticate
  // HEADERS: {
  //   'Authorization': 'Bearer {WORKOS_API_KEY}',
  //   'Content-Type': 'application/json'
  // }
  // REQUEST BODY: {
  //   client_id: process.env.WORKOS_CLIENT_ID,
  //   client_secret: process.env.WORKOS_API_KEY,
  //   grant_type: 'refresh_token',
  //   refresh_token: refreshToken
  // }

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      accessToken: 'wos_new_access_token_' + Date.now(),
      refreshToken: 'wos_new_refresh_token_' + Date.now(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  };
}

/**
 * Logout user and invalidate session
 *
 * @param accessToken - User's access token
 *
 * API ENDPOINT: POST https://api.workos.com/user_management/sessions/revoke
 * HEADERS: {
 *   'Authorization': 'Bearer {WORKOS_API_KEY}',
 *   'Content-Type': 'application/json'
 * }
 * REQUEST BODY: {
 *   access_token: string
 * }
 * SUCCESS RESPONSE (200): {
 *   success: true
 * }
 * ERROR RESPONSES:
 *   401: { code: 'unauthorized', message: 'Invalid access token' }
 *   429: { code: 'rate_limit_exceeded', message: 'Too many requests' }
 */
export async function logout(accessToken: string): Promise<APIResponse<void>> {
  // API ENDPOINT: POST https://api.workos.com/user_management/sessions/revoke
  // HEADERS: {
  //   'Authorization': 'Bearer {WORKOS_API_KEY}',
  //   'Content-Type': 'application/json'
  // }
  // REQUEST BODY: {
  //   access_token: accessToken
  // }

  // TODO: Replace with actual API call
  return {
    success: true,
  };
}

// ============================================================================
// Password Reset
// ============================================================================

/**
 * Request password reset email
 *
 * @param data - Password reset request (email)
 *
 * API ENDPOINT: POST https://api.workos.com/user_management/password_reset
 * HEADERS: {
 *   'Authorization': 'Bearer {WORKOS_API_KEY}',
 *   'Content-Type': 'application/json'
 * }
 * REQUEST BODY: {
 *   email: string,
 *   password_reset_url: string  // URL with {token} placeholder
 * }
 * SUCCESS RESPONSE (200): {
 *   success: true,
 *   user_id: string
 * }
 * ERROR RESPONSES:
 *   400: { code: 'invalid_request', message: 'Invalid email format' }
 *   404: { code: 'user_not_found', message: 'No user found with this email' }
 *   429: { code: 'rate_limit_exceeded', message: 'Too many password reset requests' }
 */
export async function requestPasswordReset(
  data: PasswordResetRequest
): Promise<APIResponse<void>> {
  // API ENDPOINT: POST https://api.workos.com/user_management/password_reset
  // HEADERS: {
  //   'Authorization': 'Bearer {WORKOS_API_KEY}',
  //   'Content-Type': 'application/json'
  // }
  // REQUEST BODY: {
  //   email: data.email,
  //   password_reset_url: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token={token}`
  // }

  // TODO: Replace with actual API call
  return {
    success: true,
  };
}

/**
 * Reset password with token
 *
 * @param token - Password reset token from email
 * @param newPassword - New password
 *
 * API ENDPOINT: POST https://api.workos.com/user_management/password_reset/confirm
 * HEADERS: {
 *   'Authorization': 'Bearer {WORKOS_API_KEY}',
 *   'Content-Type': 'application/json'
 * }
 * REQUEST BODY: {
 *   token: string,
 *   new_password: string
 * }
 * SUCCESS RESPONSE (200): {
 *   user: {
 *     id: string,
 *     email: string,
 *     ...
 *   }
 * }
 * ERROR RESPONSES:
 *   400: { code: 'invalid_request', message: 'Invalid token or password' }
 *   401: { code: 'token_expired', message: 'Password reset token has expired' }
 *   422: { code: 'validation_error', message: 'Password does not meet requirements' }
 *   429: { code: 'rate_limit_exceeded', message: 'Too many requests' }
 */
export async function confirmPasswordReset(
  token: string,
  newPassword: string
): Promise<APIResponse<WorkOSUser>> {
  // API ENDPOINT: POST https://api.workos.com/user_management/password_reset/confirm
  // HEADERS: {
  //   'Authorization': 'Bearer {WORKOS_API_KEY}',
  //   'Content-Type': 'application/json'
  // }
  // REQUEST BODY: {
  //   token: token,
  //   new_password: newPassword
  // }

  // TODO: Replace with actual API call
  return {
    success: true,
    data: MOCK_USER,
  };
}

// ============================================================================
// Email Verification
// ============================================================================

/**
 * Send email verification code
 *
 * @param userId - User ID to send verification to
 *
 * API ENDPOINT: POST https://api.workos.com/user_management/users/{userId}/email_verification/send
 * HEADERS: {
 *   'Authorization': 'Bearer {WORKOS_API_KEY}',
 *   'Content-Type': 'application/json'
 * }
 * REQUEST BODY: {}
 * SUCCESS RESPONSE (200): {
 *   success: true,
 *   user_id: string
 * }
 * ERROR RESPONSES:
 *   400: { code: 'invalid_request', message: 'Email already verified' }
 *   404: { code: 'user_not_found', message: 'User not found' }
 *   429: { code: 'rate_limit_exceeded', message: 'Too many verification emails sent' }
 */
export async function sendEmailVerification(
  userId: string
): Promise<APIResponse<void>> {
  // API ENDPOINT: POST https://api.workos.com/user_management/users/{userId}/email_verification/send
  // HEADERS: {
  //   'Authorization': 'Bearer {WORKOS_API_KEY}',
  //   'Content-Type': 'application/json'
  // }

  // TODO: Replace with actual API call
  return {
    success: true,
  };
}

/**
 * Verify email with code
 *
 * @param userId - User ID
 * @param code - Verification code from email
 *
 * API ENDPOINT: POST https://api.workos.com/user_management/users/{userId}/email_verification/confirm
 * HEADERS: {
 *   'Authorization': 'Bearer {WORKOS_API_KEY}',
 *   'Content-Type': 'application/json'
 * }
 * REQUEST BODY: {
 *   code: string
 * }
 * SUCCESS RESPONSE (200): {
 *   user: {
 *     id: string,
 *     email: string,
 *     email_verified: true,
 *     ...
 *   }
 * }
 * ERROR RESPONSES:
 *   400: { code: 'invalid_code', message: 'Invalid verification code' }
 *   401: { code: 'code_expired', message: 'Verification code has expired' }
 *   404: { code: 'user_not_found', message: 'User not found' }
 *   429: { code: 'rate_limit_exceeded', message: 'Too many verification attempts' }
 */
export async function verifyEmail(
  userId: string,
  code: string
): Promise<APIResponse<WorkOSUser>> {
  // API ENDPOINT: POST https://api.workos.com/user_management/users/{userId}/email_verification/confirm
  // HEADERS: {
  //   'Authorization': 'Bearer {WORKOS_API_KEY}',
  //   'Content-Type': 'application/json'
  // }
  // REQUEST BODY: {
  //   code: code
  // }

  // TODO: Replace with actual API call
  return {
    success: true,
    data: { ...MOCK_USER, emailVerified: true },
  };
}

// ============================================================================
// Magic Links
// ============================================================================

/**
 * Send magic link for passwordless login
 *
 * @param email - User email
 *
 * API ENDPOINT: POST https://api.workos.com/user_management/magic_auth/send
 * HEADERS: {
 *   'Authorization': 'Bearer {WORKOS_API_KEY}',
 *   'Content-Type': 'application/json'
 * }
 * REQUEST BODY: {
 *   email: string,
 *   redirect_uri: string
 * }
 * SUCCESS RESPONSE (200): {
 *   success: true
 * }
 * ERROR RESPONSES:
 *   400: { code: 'invalid_request', message: 'Invalid email format' }
 *   404: { code: 'user_not_found', message: 'No user found with this email' }
 *   429: { code: 'rate_limit_exceeded', message: 'Too many magic link requests' }
 */
export async function sendMagicLink(
  email: string
): Promise<APIResponse<void>> {
  // API ENDPOINT: POST https://api.workos.com/user_management/magic_auth/send
  // HEADERS: {
  //   'Authorization': 'Bearer {WORKOS_API_KEY}',
  //   'Content-Type': 'application/json'
  // }
  // REQUEST BODY: {
  //   email: email,
  //   redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/auth/magic-link`
  // }

  // TODO: Replace with actual API call
  return {
    success: true,
  };
}

/**
 * Verify magic link token
 *
 * @param token - Magic link token from email
 * @returns User session
 *
 * API ENDPOINT: POST https://api.workos.com/user_management/magic_auth/verify
 * HEADERS: {
 *   'Authorization': 'Bearer {WORKOS_API_KEY}',
 *   'Content-Type': 'application/json'
 * }
 * REQUEST BODY: {
 *   token: string
 * }
 * SUCCESS RESPONSE (200): {
 *   access_token: string,
 *   refresh_token: string,
 *   user: { ... },
 *   expires_in: number
 * }
 * ERROR RESPONSES:
 *   400: { code: 'invalid_token', message: 'Invalid magic link token' }
 *   401: { code: 'token_expired', message: 'Magic link has expired' }
 *   429: { code: 'rate_limit_exceeded', message: 'Too many requests' }
 */
export async function verifyMagicLink(
  token: string
): Promise<APIResponse<AuthResponse>> {
  // API ENDPOINT: POST https://api.workos.com/user_management/magic_auth/verify
  // HEADERS: {
  //   'Authorization': 'Bearer {WORKOS_API_KEY}',
  //   'Content-Type': 'application/json'
  // }
  // REQUEST BODY: {
  //   token: token
  // }

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      session: MOCK_SESSION,
      user: MOCK_USER,
    },
  };
}
