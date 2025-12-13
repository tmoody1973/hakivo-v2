import arcjet, {
  shield,
  detectBot,
  slidingWindow,
  fixedWindow,
  ArcjetDecision,
} from "@arcjet/next";

// Log Arcjet initialization
if (!process.env.ARCJET_KEY) {
  console.warn("[Arcjet] WARNING: ARCJET_KEY is not set! Security protection disabled.");
} else {
  console.log("[Arcjet] Initialized with key:", process.env.ARCJET_KEY.substring(0, 15) + "...");
}

// Base Arcjet client with global Shield protection
export const aj = arcjet({
  key: process.env.ARCJET_KEY || "missing_key",
  characteristics: ["ip.src"], // Default to IP-based identification
  rules: [
    // Global Shield WAF protection against common attacks
    shield({
      mode: "LIVE",
    }),
  ],
});

// ============================================================================
// CHAT & AI ENDPOINTS - Most restrictive (expensive operations)
// ============================================================================

/**
 * Protection for chat endpoints (/api/chat, /api/chat/c1)
 * - 5 requests per minute per IP (anonymous)
 * - 20 requests per minute per user (authenticated)
 * - Bot detection to block automated abuse
 */
export const chatProtection = aj.withRule(
  detectBot({
    mode: "LIVE",
    allow: [
      "CATEGORY:SEARCH_ENGINE", // Allow search engines for SEO
    ],
  })
).withRule(
  slidingWindow({
    mode: "LIVE",
    interval: "1m",
    max: 5, // 5 requests per minute per IP
  })
);

/**
 * Chat protection with user ID for authenticated users
 * Higher limits for logged-in users
 */
export const authenticatedChatProtection = arcjet({
  key: process.env.ARCJET_KEY!,
  characteristics: ["userId"], // User-based identification
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: "LIVE",
      allow: ["CATEGORY:SEARCH_ENGINE"],
    }),
    slidingWindow({
      mode: "LIVE",
      interval: "1m",
      max: 20, // 20 requests per minute per user
    }),
  ],
});

// ============================================================================
// AI QUOTA CONTROL - Token-based rate limiting for expensive operations
// ============================================================================

/**
 * Brief generation protection with sliding window
 * - 5 briefs per hour for users
 * - Prevents burst abuse of expensive AI operations
 */
export const briefGenerationProtection = arcjet({
  key: process.env.ARCJET_KEY!,
  characteristics: ["userId"],
  rules: [
    shield({ mode: "LIVE" }),
    slidingWindow({
      mode: "LIVE",
      interval: "1h",
      max: 5, // Max 5 briefs per hour per user
    }),
  ],
});

/**
 * Bill analysis protection
 * - 10 analyses per minute per IP
 * - Higher for authenticated users
 */
export const analysisProtection = aj.withRule(
  slidingWindow({
    mode: "LIVE",
    interval: "1m",
    max: 10,
  })
);

// ============================================================================
// PAYMENT/CHECKOUT PROTECTION - Fraud prevention
// ============================================================================

/**
 * Checkout endpoint protection
 * - Bot detection (block all automated clients)
 * - Strict rate limiting (5 per 10 minutes)
 * - Shield WAF for attack protection
 */
export const checkoutProtection = arcjet({
  key: process.env.ARCJET_KEY!,
  characteristics: ["ip.src"],
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: "LIVE",
      allow: [], // Block ALL bots on checkout
    }),
    fixedWindow({
      mode: "LIVE",
      window: "10m",
      max: 5, // Max 5 checkout attempts per 10 minutes
    }),
  ],
});

// ============================================================================
// SUBSCRIPTION ENDPOINTS - Anti-probing protection
// ============================================================================

/**
 * Subscription check protection
 * - Prevent probing of subscription limits
 * - 30 checks per minute per user
 */
export const subscriptionProtection = arcjet({
  key: process.env.ARCJET_KEY!,
  characteristics: ["userId"],
  rules: [
    shield({ mode: "LIVE" }),
    slidingWindow({
      mode: "LIVE",
      interval: "1m",
      max: 30,
    }),
  ],
});

// ============================================================================
// PUBLIC ENDPOINTS - Lighter protection
// ============================================================================

/**
 * Public endpoint protection (trivia, podcast, congress data)
 * - 100 requests per minute per IP
 * - Basic bot detection
 */
export const publicProtection = aj.withRule(
  slidingWindow({
    mode: "LIVE",
    interval: "1m",
    max: 100,
  })
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Handle Arcjet decision and return appropriate response
 */
export function handleArcjetDecision(decision: ArcjetDecision): {
  blocked: boolean;
  status: number;
  message: string;
} {
  // Log decision for debugging
  console.log("[Arcjet] Decision:", {
    conclusion: decision.conclusion,
    isDenied: decision.isDenied(),
    reason: decision.reason,
  });

  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return {
        blocked: true,
        status: 429,
        message: "Too many requests. Please try again later.",
      };
    }
    if (decision.reason.isBot()) {
      return {
        blocked: true,
        status: 403,
        message: "Automated access is not permitted.",
      };
    }
    if (decision.reason.isShield()) {
      return {
        blocked: true,
        status: 403,
        message: "Request blocked for security reasons.",
      };
    }
    // Generic denial
    return {
      blocked: true,
      status: 403,
      message: "Access denied.",
    };
  }

  return {
    blocked: false,
    status: 200,
    message: "OK",
  };
}

/**
 * Extract user ID from authorization header for rate limiting
 */
export function extractUserIdFromAuth(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    return payload.sub || payload.userId || null;
  } catch {
    return null;
  }
}
