/**
 * API Utilities for Hakivo Congressional Assistant
 *
 * Provides performance optimization and error handling:
 * - Retry logic with exponential backoff
 * - In-memory caching with TTL
 * - Request timeout handling
 * - Graceful degradation
 */

// ==========================================
// Retry Logic with Exponential Backoff
// ==========================================

interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  shouldRetry?: (error: unknown) => boolean
}

const defaultRetryOptions: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  shouldRetry: (error: unknown) => {
    // Retry on network errors and 5xx responses
    if (error instanceof Error) {
      return error.message.includes("fetch") || error.message.includes("network")
    }
    return false
  },
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultRetryOptions, ...options }
  let lastError: unknown

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === opts.maxRetries || !opts.shouldRetry(error)) {
        throw error
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        opts.baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        opts.maxDelay
      )

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

// ==========================================
// Fetch with Timeout
// ==========================================

interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number
}

/**
 * Fetch with configurable timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Robust fetch with retry and timeout
 */
export async function robustFetch(
  url: string,
  options: FetchWithTimeoutOptions & RetryOptions = {}
): Promise<Response> {
  const { maxRetries, baseDelay, maxDelay, shouldRetry, ...fetchOptions } = options

  return withRetry(
    () => fetchWithTimeout(url, fetchOptions),
    {
      maxRetries,
      baseDelay,
      maxDelay,
      shouldRetry: (error) => {
        // Also retry on timeout (AbortError)
        if (error instanceof Error && error.name === "AbortError") {
          return true
        }
        return shouldRetry?.(error) ?? defaultRetryOptions.shouldRetry(error)
      },
    }
  )
}

// ==========================================
// In-Memory Cache with TTL
// ==========================================

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private maxSize: number

  constructor(maxSize = 100) {
    this.maxSize = maxSize
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)

    if (!entry) {
      return undefined
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }

    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs = 60000): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    })
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  /**
   * Get or set a cached value
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs = 60000
  ): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== undefined) {
      return cached
    }

    const value = await factory()
    this.set(key, value, ttlMs)
    return value
  }
}

// Export singleton cache instances for different data types
export const billsCache = new MemoryCache(50) // Cache up to 50 bills
export const membersCache = new MemoryCache(100) // Cache up to 100 members
export const newsCache = new MemoryCache(30) // Cache up to 30 news articles

// Generic cache for other data
export const dataCache = new MemoryCache(200)

// ==========================================
// Error Handling Utilities
// ==========================================

export interface ApiError {
  code: string
  message: string
  status?: number
  details?: unknown
}

/**
 * Create a standardized API error
 */
export function createApiError(
  code: string,
  message: string,
  status?: number,
  details?: unknown
): ApiError {
  return { code, message, status, details }
}

/**
 * Parse error from fetch response
 */
export async function parseResponseError(response: Response): Promise<ApiError> {
  try {
    const body = await response.json()
    return createApiError(
      body.code || "API_ERROR",
      body.message || body.error || response.statusText,
      response.status,
      body
    )
  } catch {
    return createApiError(
      "API_ERROR",
      response.statusText || "Unknown error",
      response.status
    )
  }
}

/**
 * Wrap an async function with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  fallback?: T
): Promise<{ success: true; data: T } | { success: false; error: ApiError }> {
  try {
    const data = await fn()
    return { success: true, data }
  } catch (error) {
    const apiError: ApiError =
      error instanceof Error
        ? createApiError("ERROR", error.message)
        : createApiError("UNKNOWN_ERROR", "An unknown error occurred")

    if (fallback !== undefined) {
      console.warn("Using fallback due to error:", apiError)
      return { success: true, data: fallback }
    }

    return { success: false, error: apiError }
  }
}

// ==========================================
// Rate Limiting Protection
// ==========================================

interface RateLimiter {
  canMakeRequest(): boolean
  recordRequest(): void
  waitForSlot(): Promise<void>
}

/**
 * Simple sliding window rate limiter
 */
export function createRateLimiter(
  maxRequests: number,
  windowMs: number
): RateLimiter {
  const requests: number[] = []

  const cleanup = () => {
    const now = Date.now()
    const cutoff = now - windowMs
    while (requests.length > 0 && requests[0] < cutoff) {
      requests.shift()
    }
  }

  return {
    canMakeRequest(): boolean {
      cleanup()
      return requests.length < maxRequests
    },

    recordRequest(): void {
      cleanup()
      requests.push(Date.now())
    },

    async waitForSlot(): Promise<void> {
      while (!this.canMakeRequest()) {
        // Wait for oldest request to expire
        const waitTime = requests[0] + windowMs - Date.now()
        if (waitTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, Math.min(waitTime, 1000)))
        }
      }
    },
  }
}

// Pre-configured rate limiters for external APIs
export const tavilyRateLimiter = createRateLimiter(10, 60000) // 10 requests per minute
export const openStatesRateLimiter = createRateLimiter(60, 60000) // 60 requests per minute

// ==========================================
// Parallel Execution Utilities
// ==========================================

interface ParallelOptions {
  maxConcurrency?: number
  stopOnError?: boolean
}

/**
 * Execute multiple async functions in parallel with concurrency limit
 */
export async function parallel<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  options: ParallelOptions = {}
): Promise<R[]> {
  const { maxConcurrency = 5, stopOnError = false } = options

  const results: R[] = []
  const errors: Error[] = []
  let currentIndex = 0

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++
      try {
        results[index] = await fn(items[index], index)
      } catch (error) {
        if (stopOnError) {
          throw error
        }
        errors.push(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(maxConcurrency, items.length) },
    () => worker()
  )

  await Promise.all(workers)

  if (errors.length > 0 && stopOnError) {
    throw errors[0]
  }

  return results
}

/**
 * Execute multiple async functions and return first successful result
 */
export async function race<T>(
  fns: (() => Promise<T>)[],
  timeout = 10000
): Promise<T | undefined> {
  const timeoutPromise = new Promise<undefined>((resolve) =>
    setTimeout(() => resolve(undefined), timeout)
  )

  const fnPromises = fns.map(async (fn) => {
    try {
      return await fn()
    } catch {
      return undefined
    }
  })

  const result = await Promise.race([...fnPromises, timeoutPromise])
  return result
}

// ==========================================
// Performance Monitoring
// ==========================================

interface PerformanceMetrics {
  duration: number
  success: boolean
  cacheHit?: boolean
}

type MetricsCallback = (name: string, metrics: PerformanceMetrics) => void

let metricsCallback: MetricsCallback | null = null

/**
 * Set a callback to receive performance metrics
 */
export function setMetricsCallback(callback: MetricsCallback | null): void {
  metricsCallback = callback
}

/**
 * Measure execution time of an async function
 */
export async function measure<T>(
  name: string,
  fn: () => Promise<T>,
  options: { cacheHit?: boolean } = {}
): Promise<T> {
  const start = performance.now()
  let success = true

  try {
    return await fn()
  } catch (error) {
    success = false
    throw error
  } finally {
    const duration = performance.now() - start

    if (metricsCallback) {
      metricsCallback(name, {
        duration,
        success,
        cacheHit: options.cacheHit,
      })
    }

    // Log slow operations in development
    if (process.env.NODE_ENV === "development" && duration > 2000) {
      console.warn(`Slow operation: ${name} took ${duration.toFixed(0)}ms`)
    }
  }
}
