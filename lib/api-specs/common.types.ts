/**
 * Common API Types and Error Handling Structures
 *
 * Shared types used across all API integrations in the Hakivo platform.
 * These provide consistent error handling, response formatting, and pagination
 * across WorkOS, Congress.gov, Geocodio, Claude, ElevenLabs, Cerebras, Exa.ai,
 * and the custom backend.
 */

// ============================================================================
// Generic API Response Wrapper
// ============================================================================

/**
 * Standard API response wrapper
 * Used to ensure consistent response format across all API endpoints
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
  metadata?: ResponseMetadata;
}

/**
 * Response metadata for additional context
 */
export interface ResponseMetadata {
  timestamp: string;
  requestId?: string;
  version?: string;
  [key: string]: any;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Standardized API error structure
 */
export interface APIError {
  code: string;
  message: string;
  details?: ErrorDetails;
  statusCode?: number;
  path?: string;
}

/**
 * Additional error details
 */
export interface ErrorDetails {
  field?: string;
  reason?: string;
  suggestion?: string;
  [key: string]: any;
}

/**
 * Common HTTP error codes
 */
export enum HTTPStatusCode {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
}

/**
 * Common error codes used across the application
 */
export enum ErrorCode {
  // Authentication errors
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Resource errors
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',

  // External API errors
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  EXTERNAL_API_TIMEOUT = 'EXTERNAL_API_TIMEOUT',

  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

// ============================================================================
// Pagination
// ============================================================================

/**
 * Pagination parameters for list requests
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
  cursor?: string;
}

/**
 * Pagination metadata in responses
 */
export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  nextCursor?: string;
  previousCursor?: string;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMetadata;
}

// ============================================================================
// Filtering and Sorting
// ============================================================================

/**
 * Sort order options
 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * Generic sort parameters
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: SortOrder;
}

/**
 * Generic filter parameters
 */
export interface FilterParams {
  [key: string]: string | number | boolean | string[] | number[] | undefined;
}

// ============================================================================
// Request/Response Headers
// ============================================================================

/**
 * Common request headers
 */
export interface RequestHeaders {
  'Content-Type'?: string;
  'Authorization'?: string;
  'X-API-Key'?: string;
  'User-Agent'?: string;
  'Accept'?: string;
  [key: string]: string | undefined;
}

/**
 * Rate limit information from response headers
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  retryAfter?: number; // Seconds
}

// ============================================================================
// API Configuration
// ============================================================================

/**
 * Base API configuration
 */
export interface APIConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Request options
 */
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: RequestHeaders;
  body?: any;
  timeout?: number;
  signal?: AbortSignal;
}

// ============================================================================
// Date/Time Utilities
// ============================================================================

/**
 * Date range for filtering
 */
export interface DateRange {
  from: string; // ISO 8601 format
  to: string; // ISO 8601 format
}

// ============================================================================
// File Upload/Download
// ============================================================================

/**
 * File metadata
 */
export interface FileMetadata {
  filename: string;
  contentType: string;
  size: number;
  url?: string;
  uploadedAt?: string;
}

/**
 * Upload response
 */
export interface UploadResponse {
  fileId: string;
  url: string;
  cdnUrl?: string;
  metadata: FileMetadata;
}

// ============================================================================
// Search and Query
// ============================================================================

/**
 * Search parameters
 */
export interface SearchParams {
  query: string;
  filters?: FilterParams;
  sort?: SortParams;
  pagination?: PaginationParams;
}

/**
 * Search result with relevance score
 */
export interface SearchResult<T> {
  item: T;
  score?: number;
  highlights?: string[];
}

/**
 * Search response
 */
export interface SearchResponse<T> {
  results: SearchResult<T>[];
  total: number;
  pagination?: PaginationMetadata;
}

// ============================================================================
// Webhooks
// ============================================================================

/**
 * Webhook event structure
 */
export interface WebhookEvent<T = any> {
  id: string;
  type: string;
  createdAt: string;
  data: T;
  signature?: string;
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Service health status
 */
export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version?: string;
  timestamp: string;
  services?: {
    [serviceName: string]: {
      status: 'up' | 'down';
      latency?: number;
      message?: string;
    };
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if response is an error
 */
export function isAPIError(response: any): response is { error: APIError } {
  return response && typeof response === 'object' && 'error' in response;
}

/**
 * Type guard to check if response is successful
 */
export function isAPISuccess<T>(response: APIResponse<T>): response is Required<Pick<APIResponse<T>, 'data'>> & APIResponse<T> {
  return response.success === true && response.data !== undefined;
}
