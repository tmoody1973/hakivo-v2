import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * SmartMemory Tools for Hakivo Congressional Assistant
 *
 * Implements a 4-layer memory system:
 * - Working Memory: Active session context (in-memory during conversation)
 * - Episodic Memory: Past conversation summaries (chat_sessions/messages)
 * - Semantic Memory: User preferences, tracked bills, district info
 * - Procedural Memory: Response templates, briefing formats
 *
 * These tools wrap calls to the Hakivo backend services to provide
 * the agent with persistent memory capabilities.
 */

// Backend service URLs from Raindrop deployment
const DASHBOARD_SERVICE_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_API_URL ||
  "https://svc-01kc6rbecv0s5k4yk6ksdaqyzm.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

const AUTH_SERVICE_URL =
  process.env.NEXT_PUBLIC_AUTH_API_URL ||
  "https://svc-01kc6rbecv0s5k4yk6ksdaqyz15.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

const CHAT_SERVICE_URL =
  process.env.NEXT_PUBLIC_CHAT_API_URL ||
  "https://svc-01kc6rbecv0s5k4yk6ksdaqyzk.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

// Type definitions for memory responses
interface UserContext {
  userId: string;
  location: {
    state: string | null;
    district: number | null;
    zipcode: string | null;
  };
  policyInterests: string[];
  trackedBillsCount: number;
  hasCompletedOnboarding: boolean;
}

interface ConversationSummary {
  sessionId: string;
  billId: number;
  billTitle: string;
  messageCount: number;
  lastMessage: string;
  updatedAt: number;
}

interface TrackedBill {
  id: number;
  billId: string;
  congress: number;
  type: string;
  number: number;
  title: string;
  status: string;
  trackedAt: number;
}

interface Representative {
  id: string;
  name: string;
  party: string;
  state: string;
  district: number | null;
  chamber: string;
  role: string;
  imageUrl: string | null;
}

/**
 * Get User Context Tool - Retrieves semantic memory about the user
 *
 * Fetches user's location, policy interests, and tracked bills count
 * to provide personalized responses.
 */
export const getUserContextTool = createTool({
  id: "getUserContext",
  description: `Retrieve the current user's context including their location (state, district),
policy interests, and tracked bills. Use this to personalize responses and understand
what the user cares about.

This is essential for:
- "Who are my representatives?" - Need user's state/district
- "Show me bills I might be interested in" - Need policy interests
- "What's happening with my tracked bills?" - Need tracked bills info`,
  inputSchema: z.object({
    authToken: z
      .string()
      .optional()
      .describe("Auth token for the current user session"),
  }),
  execute: async ({ context }) => {
    const { authToken } = context;

    if (!authToken) {
      return {
        success: false,
        error: "No auth token provided - user context requires authentication",
        context: null,
      };
    }

    try {
      // Fetch data in parallel: dashboard overview, representatives, and SmartMemory profile
      const [overviewRes, repsRes, memoryProfileRes] = await Promise.all([
        fetch(`${DASHBOARD_SERVICE_URL}/dashboard/overview`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch(`${DASHBOARD_SERVICE_URL}/dashboard/representatives`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch(`${CHAT_SERVICE_URL}/memory/profile`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }).catch(() => null), // Don't fail if memory service unavailable
      ]);

      if (!overviewRes.ok) {
        return {
          success: false,
          error: `Failed to get user context: ${overviewRes.statusText}`,
          context: null,
        };
      }

      const data = await overviewRes.json();

      // Get location from representatives
      let location = { state: null, district: null, zipcode: null };
      if (repsRes.ok) {
        const repsData = await repsRes.json();
        if (repsData.userLocation) {
          location = {
            state: repsData.userLocation.state || null,
            district: repsData.userLocation.district || null,
            zipcode: null,
          };
        }
      }

      // Get interests from SmartMemory profile
      let policyInterests: string[] = [];
      let smartMemoryProfile = null;
      if (memoryProfileRes && memoryProfileRes.ok) {
        const profileData = await memoryProfileRes.json();
        if (profileData.success && profileData.profile) {
          smartMemoryProfile = profileData.profile;
          policyInterests = profileData.profile.interests || [];
        }
      }

      return {
        success: true,
        context: {
          location,
          policyInterests, // From SmartMemory
          trackedBillsCount: data.totalBills || 0,
          recentActivityCount: data.recentActivity || 0,
          hasCompletedOnboarding: !!location.state,
        },
        smartMemoryProfile, // Full profile if available
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        context: null,
      };
    }
  },
});

/**
 * Get User Representatives Tool - Retrieves the user's elected officials
 *
 * Fetches federal and state representatives based on user's location.
 */
export const getUserRepresentativesTool = createTool({
  id: "getUserRepresentatives",
  description: `Get the user's federal and state representatives based on their registered location.
Returns Senators, House Representatives, and state legislators.

Use this for queries like:
- "Who are my representatives?"
- "Who is my Senator?"
- "Show me my elected officials"`,
  inputSchema: z.object({
    authToken: z
      .string()
      .optional()
      .describe("Auth token for the current user session"),
    includeState: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include state legislators in results"),
  }),
  execute: async ({ context }) => {
    const { authToken, includeState = true } = context;

    if (!authToken) {
      return {
        success: false,
        error: "No auth token provided - requires authentication",
        federal: [],
        state: [],
      };
    }

    try {
      const response = await fetch(
        `${DASHBOARD_SERVICE_URL}/dashboard/representatives`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to get representatives: ${response.statusText}`,
          federal: [],
          state: [],
        };
      }

      const data = await response.json();

      return {
        success: true,
        federal: data.federal || [],
        state: includeState ? data.state || [] : [],
        userLocation: data.userLocation,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        federal: [],
        state: [],
      };
    }
  },
});

/**
 * Get Tracked Bills Tool - Retrieves user's tracked legislation
 *
 * Fetches all federal and state bills the user is tracking.
 */
export const getTrackedBillsTool = createTool({
  id: "getTrackedBills",
  description: `Get all bills the user is currently tracking, including federal and state legislation.
Returns bill details, status, and tracking timestamp.

Use this for queries like:
- "Show me my tracked bills"
- "What legislation am I following?"
- "Any updates on bills I'm tracking?"`,
  inputSchema: z.object({
    authToken: z
      .string()
      .optional()
      .describe("Auth token for the current user session"),
    type: z
      .enum(["all", "federal", "state"])
      .optional()
      .default("all")
      .describe("Filter by bill type"),
  }),
  execute: async ({ context }) => {
    const { authToken, type = "all" } = context;

    if (!authToken) {
      return {
        success: false,
        error: "No auth token provided - requires authentication",
        federal: [],
        state: [],
        bookmarks: [],
      };
    }

    try {
      const response = await fetch(`${DASHBOARD_SERVICE_URL}/dashboard/tracked`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to get tracked bills: ${response.statusText}`,
          federal: [],
          state: [],
          bookmarks: [],
        };
      }

      const data = await response.json();
      const tracked = data.tracked || { federal: [], state: [], bookmarks: [] };

      // Filter based on type parameter
      if (type === "federal") {
        return {
          success: true,
          federal: tracked.federal || [],
          state: [],
          bookmarks: [],
          count: tracked.federal?.length || 0,
        };
      } else if (type === "state") {
        return {
          success: true,
          federal: [],
          state: tracked.state || [],
          bookmarks: [],
          count: tracked.state?.length || 0,
        };
      }

      return {
        success: true,
        federal: tracked.federal || [],
        state: tracked.state || [],
        bookmarks: tracked.bookmarks || [],
        count:
          (tracked.federal?.length || 0) +
          (tracked.state?.length || 0) +
          (tracked.bookmarks?.length || 0),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        federal: [],
        state: [],
        bookmarks: [],
      };
    }
  },
});

/**
 * Get Conversation History Tool - Retrieves past chat sessions (episodic memory)
 *
 * Fetches previous conversations about bills for context continuity.
 */
export const getConversationHistoryTool = createTool({
  id: "getConversationHistory",
  description: `Retrieve past conversation sessions about bills.
Provides context about what the user has discussed before.

Use this for:
- Understanding previous discussions
- Continuing a previous conversation
- Referencing past questions and answers`,
  inputSchema: z.object({
    authToken: z
      .string()
      .optional()
      .describe("Auth token for the current user session"),
    sessionId: z
      .string()
      .optional()
      .describe("Specific session ID to retrieve messages from"),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum number of sessions/messages to return"),
  }),
  execute: async ({ context }) => {
    const { authToken, sessionId, limit = 10 } = context;

    if (!authToken) {
      return {
        success: false,
        error: "No auth token provided - requires authentication",
        sessions: [],
        messages: [],
      };
    }

    try {
      if (sessionId) {
        // Get messages for a specific session
        const response = await fetch(
          `${CHAT_SERVICE_URL}/chat/sessions/${sessionId}/messages`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (!response.ok) {
          return {
            success: false,
            error: `Failed to get messages: ${response.statusText}`,
            sessions: [],
            messages: [],
          };
        }

        const data = await response.json();
        return {
          success: true,
          sessionId,
          messages: data.messages || [],
          count: data.count || 0,
        };
      } else {
        // Get list of sessions
        const response = await fetch(`${CHAT_SERVICE_URL}/chat/sessions`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!response.ok) {
          return {
            success: false,
            error: `Failed to get sessions: ${response.statusText}`,
            sessions: [],
            messages: [],
          };
        }

        const data = await response.json();
        return {
          success: true,
          sessions: (data.sessions || []).slice(0, limit),
          count: data.count || 0,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        sessions: [],
        messages: [],
      };
    }
  },
});

/**
 * Store Working Memory Tool - Stores context in the current session
 *
 * Saves important context that should be remembered during the conversation.
 * This is in-memory storage that persists for the conversation duration.
 */
export const storeWorkingMemoryTool = createTool({
  id: "storeWorkingMemory",
  description: `Store important context in working memory for the current conversation.
Use this to remember user preferences, decisions, or important context
that should be available throughout the conversation.

Examples:
- User mentioned they're interested in healthcare bills
- User asked to compare two specific bills
- User's preferred level of detail for explanations`,
  inputSchema: z.object({
    key: z.string().describe("Unique key for this memory item"),
    value: z.string().describe("The value/content to remember"),
    category: z
      .enum(["preference", "context", "decision", "reference"])
      .optional()
      .default("context")
      .describe("Category of the memory item"),
  }),
  execute: async ({ context }) => {
    const { key, value, category = "context" } = context;

    // Working memory is managed in-memory by the agent
    // This tool just validates and structures the data
    return {
      success: true,
      stored: {
        key,
        value,
        category,
        timestamp: Date.now(),
      },
      message: `Stored in working memory: ${key}`,
    };
  },
});

/**
 * Get Briefing Templates Tool - Retrieves procedural memory templates
 *
 * Provides templates for generating consistent, well-formatted responses.
 */
export const getBriefingTemplatesTool = createTool({
  id: "getBriefingTemplates",
  description: `Get templates for generating structured responses like bill summaries,
voting record analyses, or weekly briefings.

This is procedural memory - patterns for how to format and structure responses.`,
  inputSchema: z.object({
    templateType: z
      .enum([
        "bill_summary",
        "vote_analysis",
        "weekly_briefing",
        "representative_profile",
        "comparison",
      ])
      .describe("Type of template to retrieve"),
  }),
  execute: async ({ context }) => {
    const { templateType } = context;

    // Procedural memory templates
    const templates: Record<string, string> = {
      bill_summary: `
## Bill Summary Template
1. **Bill Number & Title**: {billNumber} - {title}
2. **Sponsor**: {sponsor} ({party}-{state})
3. **Status**: {status}
4. **Key Provisions**:
   - {provision1}
   - {provision2}
5. **Latest Action**: {latestAction} ({date})
6. **Why It Matters**: {impact}
`,
      vote_analysis: `
## Vote Analysis Template
**Bill**: {billNumber} - {title}
**Vote Date**: {date}
**Result**: {result}

### Vote Breakdown
| Party | Yea | Nay | Present |
|-------|-----|-----|---------|
| Democrat | {dYea} | {dNay} | {dPresent} |
| Republican | {rYea} | {rNay} | {rPresent} |

### Your Representatives' Votes
{representativeVotes}
`,
      weekly_briefing: `
## Weekly Congressional Briefing
**Week of**: {weekStart} - {weekEnd}

### Key Bills to Watch
{keyBills}

### Votes This Week
{votes}

### Your Representatives' Activity
{repActivity}

### Coming Up Next Week
{upcoming}
`,
      representative_profile: `
## Representative Profile
**Name**: {name}
**Party**: {party}
**State/District**: {stateDistrict}
**Chamber**: {chamber}

### Committee Assignments
{committees}

### Recent Sponsored Legislation
{recentBills}

### Voting Record Highlights
{votingHighlights}

### Contact Information
- Phone: {phone}
- Website: {website}
`,
      comparison: `
## Bill Comparison
| Aspect | {bill1Number} | {bill2Number} |
|--------|---------------|---------------|
| Title | {bill1Title} | {bill2Title} |
| Sponsor | {bill1Sponsor} | {bill2Sponsor} |
| Status | {bill1Status} | {bill2Status} |
| Key Provisions | {bill1Provisions} | {bill2Provisions} |
| Fiscal Impact | {bill1Fiscal} | {bill2Fiscal} |

### Analysis
{analysisText}
`,
    };

    const template = templates[templateType];

    if (!template) {
      return {
        success: false,
        error: `Unknown template type: ${templateType}`,
        template: null,
      };
    }

    return {
      success: true,
      templateType,
      template,
      usage: "Replace {placeholders} with actual values when generating response",
    };
  },
});

/**
 * Get Personalized Recommendations Tool - AI-powered content recommendations
 *
 * Returns bills and news tailored to user's interests and location.
 */
export const getPersonalizedRecommendationsTool = createTool({
  id: "getPersonalizedRecommendations",
  description: `Get personalized bill and news recommendations based on user's
policy interests and location.

Use for:
- "What bills should I know about?"
- "Show me relevant legislation"
- "What's happening in my policy areas?"`,
  inputSchema: z.object({
    authToken: z
      .string()
      .optional()
      .describe("Auth token for the current user session"),
    contentType: z
      .enum(["bills", "news", "both"])
      .optional()
      .default("both")
      .describe("Type of content to recommend"),
    limit: z.number().optional().default(5).describe("Max recommendations per type"),
  }),
  execute: async ({ context }) => {
    const { authToken, contentType = "both", limit = 5 } = context;

    if (!authToken) {
      return {
        success: false,
        error: "No auth token provided - requires authentication",
        bills: [],
        news: [],
      };
    }

    try {
      const results: { bills?: unknown[]; news?: unknown[] } = {};

      if (contentType === "bills" || contentType === "both") {
        const billsResponse = await fetch(
          `${DASHBOARD_SERVICE_URL}/dashboard/bills?limit=${limit}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (billsResponse.ok) {
          const billsData = await billsResponse.json();
          results.bills = billsData.bills || [];
        }
      }

      if (contentType === "news" || contentType === "both") {
        const newsResponse = await fetch(
          `${DASHBOARD_SERVICE_URL}/dashboard/news?limit=${limit}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (newsResponse.ok) {
          const newsData = await newsResponse.json();
          results.news = newsData.articles || [];
        }
      }

      return {
        success: true,
        bills: results.bills || [],
        news: results.news || [],
        contentType,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        bills: [],
        news: [],
      };
    }
  },
});

/**
 * Update User Profile Tool - Updates user interests in SmartMemory
 *
 * Saves user preferences and interests to semantic memory for personalization.
 */
export const updateUserProfileTool = createTool({
  id: "updateUserProfile",
  description: `Update the user's profile in SmartMemory including their policy interests,
tracked bills, and tracked legislators. Use this when the user expresses interest in
specific topics or wants to track certain legislation or legislators.

Examples:
- User says "I'm interested in healthcare" - add "healthcare" to interests
- User discusses immigration frequently - add "immigration" to interests
- User asks to follow a specific bill - add to trackedBills`,
  inputSchema: z.object({
    authToken: z
      .string()
      .optional()
      .describe("Auth token for the current user session"),
    interests: z
      .array(z.string())
      .optional()
      .describe("Policy interests to set (e.g., ['healthcare', 'immigration'])"),
    trackedBills: z
      .array(z.string())
      .optional()
      .describe("Bill IDs to track (e.g., ['hr-1234', 's-5678'])"),
    trackedLegislators: z
      .array(z.string())
      .optional()
      .describe("Legislator IDs to track"),
    state: z.string().optional().describe("User's state (e.g., 'TX')"),
    district: z.string().optional().describe("User's congressional district"),
  }),
  execute: async ({ context }) => {
    const { authToken, interests, trackedBills, trackedLegislators, state, district } =
      context;

    if (!authToken) {
      return {
        success: false,
        error: "No auth token provided - requires authentication",
      };
    }

    try {
      const response = await fetch(`${CHAT_SERVICE_URL}/memory/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          interests,
          trackedBills,
          trackedLegislators,
          state,
          district,
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to update profile: ${response.statusText}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        profile: data.profile,
        message: "User profile updated in SmartMemory",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Search Past Sessions Tool - Searches episodic memory for relevant past conversations
 *
 * Uses vector search to find previous conversations about specific topics.
 */
export const searchPastSessionsTool = createTool({
  id: "searchPastSessions",
  description: `Search past conversation sessions for relevant context.
Use this when the user references previous discussions or when you need
historical context about what the user has researched before.

Examples:
- "What did we discuss about healthcare last time?"
- "Continue our conversation about that immigration bill"
- Understanding user's prior knowledge on a topic`,
  inputSchema: z.object({
    authToken: z
      .string()
      .optional()
      .describe("Auth token for the current user session"),
    searchTerms: z
      .string()
      .describe("Topics or keywords to search for in past sessions"),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe("Maximum number of past sessions to return"),
  }),
  execute: async ({ context }) => {
    const { authToken, searchTerms, limit = 5 } = context;

    if (!authToken) {
      return {
        success: false,
        error: "No auth token provided - requires authentication",
        sessions: [],
      };
    }

    try {
      const response = await fetch(`${CHAT_SERVICE_URL}/memory/episodic/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          terms: searchTerms,
          nMostRecent: limit,
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to search past sessions: ${response.statusText}`,
          sessions: [],
        };
      }

      const data = await response.json();

      return {
        success: true,
        searchTerms,
        sessions: data.results || [],
        totalFound: data.pagination?.total || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        sessions: [],
      };
    }
  },
});

// Export all SmartMemory tools
export const smartMemoryTools = {
  getUserContext: getUserContextTool,
  getUserRepresentatives: getUserRepresentativesTool,
  getTrackedBills: getTrackedBillsTool,
  getConversationHistory: getConversationHistoryTool,
  storeWorkingMemory: storeWorkingMemoryTool,
  getBriefingTemplates: getBriefingTemplatesTool,
  getPersonalizedRecommendations: getPersonalizedRecommendationsTool,
  updateUserProfile: updateUserProfileTool,
  searchPastSessions: searchPastSessionsTool,
};
