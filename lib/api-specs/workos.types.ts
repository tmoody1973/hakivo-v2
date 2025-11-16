/**
 * WorkOS Authentication API Types
 *
 * Type definitions for WorkOS authentication including OAuth (Google),
 * email/password authentication, and user session management.
 *
 * API Documentation: https://workos.com/docs/reference
 */

import { APIResponse, APIError } from './common.types';

// ============================================================================
// User Types
// ============================================================================

/**
 * WorkOS User object
 */
export interface WorkOSUser {
  id: string;
  email: string;
  emailVerified: boolean;
  profilePictureUrl?: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * User profile information
 */
export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
}

// ============================================================================
// Authentication Types
// ============================================================================

/**
 * OAuth provider types supported by WorkOS
 */
export enum OAuthProvider {
  GOOGLE = 'GoogleOAuth',
  MICROSOFT = 'MicrosoftOAuth',
  GITHUB = 'GitHubOAuth',
}

/**
 * Authentication method
 */
export enum AuthMethod {
  OAUTH = 'OAuth',
  PASSWORD = 'Password',
  MAGIC_LINK = 'MagicLink',
}

// ============================================================================
// OAuth Flow Types
// ============================================================================

/**
 * OAuth authorization URL request
 */
export interface OAuthAuthorizationURLRequest {
  provider: OAuthProvider;
  redirectUri: string;
  state?: string;
  clientId: string;
}

/**
 * OAuth authorization URL response
 */
export interface OAuthAuthorizationURLResponse {
  url: string;
  state?: string;
}

/**
 * OAuth callback parameters (from redirect)
 */
export interface OAuthCallbackParams {
  code: string;
  state?: string;
}

/**
 * OAuth token exchange request
 */
export interface OAuthTokenRequest {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

// ============================================================================
// Email/Password Authentication Types
// ============================================================================

/**
 * Email/password registration request
 */
export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Email/password login request
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password reset confirmation
 */
export interface PasswordResetConfirmRequest {
  token: string;
  password: string;
}

/**
 * Email verification request
 */
export interface EmailVerificationRequest {
  userId: string;
}

/**
 * Email verification confirmation
 */
export interface EmailVerificationConfirmRequest {
  code: string;
  userId: string;
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * Authentication session
 */
export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: WorkOSUser;
  expiresAt: string;
}

/**
 * Session refresh request
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Session refresh response
 */
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

// ============================================================================
// Magic Link Types
// ============================================================================

/**
 * Magic link send request
 */
export interface MagicLinkRequest {
  email: string;
}

/**
 * Magic link verification
 */
export interface MagicLinkVerifyRequest {
  token: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Authentication response (login/register)
 */
export interface AuthResponse {
  session: AuthSession;
  user: WorkOSUser;
}

/**
 * User response (get current user)
 */
export interface UserResponse {
  user: WorkOSUser;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * WorkOS-specific error codes
 */
export enum WorkOSErrorCode {
  INVALID_CREDENTIALS = 'invalid_credentials',
  USER_NOT_FOUND = 'user_not_found',
  USER_ALREADY_EXISTS = 'user_already_exists',
  EMAIL_NOT_VERIFIED = 'email_not_verified',
  INVALID_TOKEN = 'invalid_token',
  TOKEN_EXPIRED = 'token_expired',
  INVALID_CODE = 'invalid_code',
  INVALID_PROVIDER = 'invalid_provider',
  UNAUTHORIZED = 'unauthorized',
}

/**
 * WorkOS API error
 */
export interface WorkOSError extends APIError {
  code: WorkOSErrorCode | string;
  message: string;
  requestId?: string;
}

// ============================================================================
// Request/Response Wrappers
// ============================================================================

export type WorkOSAuthResponse = APIResponse<AuthResponse>;
export type WorkOSUserResponse = APIResponse<UserResponse>;
export type WorkOSOAuthURLResponse = APIResponse<OAuthAuthorizationURLResponse>;
export type WorkOSRefreshResponse = APIResponse<RefreshTokenResponse>;

// ============================================================================
// Organization Types (for future SSO support)
// ============================================================================

/**
 * Organization object (for SSO)
 */
export interface Organization {
  id: string;
  name: string;
  domains: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Organization member
 */
export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: 'admin' | 'member';
  createdAt: string;
}
