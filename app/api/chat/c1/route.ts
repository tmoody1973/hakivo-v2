import { NextRequest, NextResponse } from "next/server";
import { UserContext } from "@/lib/c1/user-context";
import {
  chatProtection,
  authenticatedChatProtection,
  handleArcjetDecision,
  extractUserIdFromAuth,
} from "@/lib/security/arcjet";
import { makeC1Response } from "@thesysai/genui-sdk/server";
// Artifact generation import removed - all requests now use runTools() to prevent hallucination
import OpenAI from "openai";
import type { RunnableToolFunctionWithParse } from "openai/lib/RunnableFunction";
import type { JSONSchema } from "openai/lib/jsonschema";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Create OpenAI client pointing to C1 API
const c1Client = new OpenAI({
  apiKey: process.env.THESYS_API_KEY,
  baseURL: "https://api.thesys.dev/v1/embed",
});

// C1 Model to use
const C1_MODEL = "c1/anthropic/claude-sonnet-4/v-20251130";

// System prompt for C1 Congressional Assistant (streamlined for speed)
const C1_SYSTEM_PROMPT = `You are Hakivo, an intelligent, non-partisan congressional assistant that helps citizens understand and engage with their government.

## Your Identity
- Name: Hakivo
- Role: Congressional Assistant
- Tone: Professional, accessible, non-partisan, helpful

## Core Capabilities
1. **Bill Information**: Search and explain bills in plain language
2. **Representative Lookup**: Find representatives by location
3. **Vote Tracking**: Display how representatives voted
4. **News Context**: Provide current news via web search

## User Personalization
User data (representatives, interests, location) is typically provided in the system context.
If user data is NOT in the context, use SmartMemory tools as fallback:
- \`getUserContext\` - Get user's location, policy interests
- \`getUserRepresentatives\` - Get user's senators and house representative

Look for \`[AUTH_TOKEN: xxx]\` in the context to use with SmartMemory tools.

## C1 Generative UI
Use rich UI components: Cards, Tables, Charts, Accordions.
Lead with the most important visual. Be concise - let the UI tell the story.

## Reports & Presentations
CRITICAL: When users ask for reports, analysis, or presentations about bills or legislation:
1. ALWAYS use smartSql or semanticSearch tools FIRST to fetch REAL bill data
2. NEVER make up or guess bill numbers - only reference bills returned by tools
3. Include only verified information from tool results in your response
4. If no relevant bills are found, say so honestly instead of inventing data

## Follow-Up Suggestions
At the end of EVERY response, include 2-3 suggested follow-up questions as clickable buttons.
These help users explore related topics and discover what they can ask.

Format as a horizontal row of outline-styled buttons at the bottom of your response:
- Questions should be contextual based on the current conversation
- Keep each suggestion SHORT (under 40 characters)
- Make them actionable and specific

Examples of good follow-up suggestions:
- After showing representatives: "How did they vote on [topic]?" | "View recent bills" | "Compare voting records"
- After bill info: "Track this bill" | "Who sponsored it?" | "Related legislation"
- After news: "More on this topic" | "Official bill text" | "Representative stance"

Render these as a ButtonGroup or Row of Buttons component at the very end of your response.`;

// Service URLs for tool execution
const BILLS_SERVICE_URL = process.env.NEXT_PUBLIC_BILLS_API_URL ||
  "https://svc-01kc6rbecv0s5k4yk6ksdaqyz16.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";
const SMART_MEMORY_URL = process.env.NEXT_PUBLIC_CHAT_API_URL ||
  "https://svc-01kc6rbecv0s5k4yk6ksdaqyzk.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// Tool execution functions (direct service calls, no Mastra dependency)
async function executeSmartSql(params: { query: string; customSql?: string }): Promise<string> {
  try {
    const url = `${BILLS_SERVICE_URL}/search/query`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: params.query, customSql: params.customSql }),
    });
    if (!response.ok) throw new Error(`SmartSQL error: ${response.status}`);
    return JSON.stringify(await response.json());
  } catch (error) {
    return JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}

async function executeGetMemberDetail(params: { bioguideId: string }): Promise<string> {
  try {
    const url = `${BILLS_SERVICE_URL}/members/${params.bioguideId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Member not found: ${params.bioguideId}`);
    return JSON.stringify(await response.json());
  } catch (error) {
    return JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}

async function executeGetBillDetail(params: { congress: number; billType: string; billNumber: number }): Promise<string> {
  try {
    const url = `${BILLS_SERVICE_URL}/bills/${params.congress}/${params.billType}/${params.billNumber}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Bill not found: ${params.congress}-${params.billType}-${params.billNumber}`);
    return JSON.stringify(await response.json());
  } catch (error) {
    return JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}

async function executeSemanticSearch(params: { query: string; limit?: number; congress?: number }): Promise<string> {
  try {
    const url = `${BILLS_SERVICE_URL}/search/semantic`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: params.query,
        limit: params.limit || 10,
        congress: params.congress,
      }),
    });
    if (!response.ok) throw new Error(`Semantic search error: ${response.status}`);
    return JSON.stringify(await response.json());
  } catch (error) {
    return JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}

async function executeSearchNews(params: { query: string; topic?: string; focus?: string }): Promise<string> {
  try {
    if (!PERPLEXITY_API_KEY) {
      return JSON.stringify({ error: "Perplexity API key not configured" });
    }
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          { role: "system", content: "You are a helpful news research assistant focused on U.S. politics and legislation." },
          { role: "user", content: params.query },
        ],
        return_citations: true,
      }),
    });
    if (!response.ok) throw new Error(`News search error: ${response.status}`);
    const data = await response.json();
    return JSON.stringify({
      answer: data.choices?.[0]?.message?.content || "No results found",
      citations: data.citations || [],
    });
  } catch (error) {
    return JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}

async function executeGetUserContext(params: { authToken?: string }): Promise<string> {
  try {
    if (!params.authToken) return JSON.stringify({ error: "Auth token required" });
    const url = `${SMART_MEMORY_URL}/memory/profile`;
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${params.authToken}` },
    });
    if (!response.ok) throw new Error(`User context error: ${response.status}`);
    return JSON.stringify(await response.json());
  } catch (error) {
    return JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}

async function executeGetUserRepresentatives(params: { authToken?: string; includeState?: boolean }): Promise<string> {
  try {
    if (!params.authToken) return JSON.stringify({ error: "Auth token required" });
    const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_API_URL ||
      "https://svc-01kc6rbecv0s5k4yk6ksdaqyzm.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";
    const url = `${dashboardUrl}/dashboard/representatives`;
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${params.authToken}` },
    });
    if (!response.ok) throw new Error(`Representatives error: ${response.status}`);
    return JSON.stringify(await response.json());
  } catch (error) {
    return JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}

// Tool type definitions for type safety
type SmartSqlParams = { query: string; customSql?: string };
type MemberDetailParams = { bioguideId: string };
type BillDetailParams = { congress: number; billType: string; billNumber: number };
type SemanticSearchParams = { query: string; limit?: number; congress?: number };
type SearchNewsParams = { query: string; topic?: string; focus?: string };
type UserContextParams = { authToken?: string };
type UserRepsParams = { authToken?: string; includeState?: boolean };

// 7 Tools for C1 using OpenAI's RunnableToolFunctionWithParse format
// These are compatible with c1Client.beta.chat.completions.runTools()
const smartSqlTool: RunnableToolFunctionWithParse<SmartSqlParams> = {
  type: "function",
  function: {
    name: "smartSql",
    description: `Search the Hakivo database for bill lookups and member queries.
Best for: Bills by sponsor name, specific bill numbers, members by state.
For topic searches like "agriculture bills", use semanticSearch instead.`,
    parameters: zodToJsonSchema(z.object({
      query: z.string().describe("Natural language query"),
      customSql: z.string().optional().describe("Advanced: Direct SQL query"),
    })) as JSONSchema,
    parse: (input: string) => JSON.parse(input) as SmartSqlParams,
    function: executeSmartSql,
    strict: true,
  },
};

const getMemberDetailTool: RunnableToolFunctionWithParse<MemberDetailParams> = {
  type: "function",
  function: {
    name: "getMemberDetail",
    description: "Get detailed information about a congressional member by bioguide ID.",
    parameters: zodToJsonSchema(z.object({
      bioguideId: z.string().describe("Bioguide ID of the member, e.g., P000197"),
    })) as JSONSchema,
    parse: (input: string) => JSON.parse(input) as MemberDetailParams,
    function: executeGetMemberDetail,
    strict: true,
  },
};

const getBillDetailTool: RunnableToolFunctionWithParse<BillDetailParams> = {
  type: "function",
  function: {
    name: "getBillDetail",
    description: "Get comprehensive details about a specific federal bill.",
    parameters: zodToJsonSchema(z.object({
      congress: z.number().describe("Congress number (119 for current)"),
      billType: z.string().describe("Bill type: hr, s, hjres, sjres, etc."),
      billNumber: z.number().describe("Bill number"),
    })) as JSONSchema,
    parse: (input: string) => JSON.parse(input) as BillDetailParams,
    function: executeGetBillDetail,
    strict: true,
  },
};

const semanticSearchTool: RunnableToolFunctionWithParse<SemanticSearchParams> = {
  type: "function",
  function: {
    name: "semanticSearch",
    description: `PREFERRED for topic-based bill searches like "agriculture bills" or "healthcare legislation".
Uses AI semantic similarity to find relevant bills even when exact keywords don't match.`,
    parameters: zodToJsonSchema(z.object({
      query: z.string().describe("Natural language topic query"),
      limit: z.number().optional().describe("Max results (1-50), default 10"),
      congress: z.number().optional().describe("Filter by Congress number"),
    })) as JSONSchema,
    parse: (input: string) => JSON.parse(input) as SemanticSearchParams,
    function: executeSemanticSearch,
    strict: true,
  },
};

const searchNewsTool: RunnableToolFunctionWithParse<SearchNewsParams> = {
  type: "function",
  function: {
    name: "searchNews",
    description: `Search for current news about legislation, representatives, or political topics.
Returns AI-summarized answer with citations and source articles.`,
    parameters: zodToJsonSchema(z.object({
      query: z.string().describe("News search query"),
      topic: z.enum(["bills", "legislators", "votes", "policy", "state"]).optional(),
      focus: z.enum(["news", "general", "policy"]).optional().describe("Focus area, default news"),
    })) as JSONSchema,
    parse: (input: string) => JSON.parse(input) as SearchNewsParams,
    function: executeSearchNews,
    strict: true,
  },
};

const getUserContextTool: RunnableToolFunctionWithParse<UserContextParams> = {
  type: "function",
  function: {
    name: "getUserContext",
    description: `Get user's location, policy interests, and tracked bills. Use when personalizing responses.
Requires auth token from context [AUTH_TOKEN: xxx].`,
    parameters: zodToJsonSchema(z.object({
      authToken: z.string().optional().describe("Auth token from context [AUTH_TOKEN: xxx]"),
    })) as JSONSchema,
    parse: (input: string) => JSON.parse(input) as UserContextParams,
    function: executeGetUserContext,
    strict: true,
  },
};

const getUserRepresentativesTool: RunnableToolFunctionWithParse<UserRepsParams> = {
  type: "function",
  function: {
    name: "getUserRepresentatives",
    description: `Get user's federal representatives based on their location.
Requires auth token from context [AUTH_TOKEN: xxx].`,
    parameters: zodToJsonSchema(z.object({
      authToken: z.string().optional().describe("Auth token from context [AUTH_TOKEN: xxx]"),
      includeState: z.boolean().optional().describe("Include state officials, default true"),
    })) as JSONSchema,
    parse: (input: string) => JSON.parse(input) as UserRepsParams,
    function: executeGetUserRepresentatives,
    strict: true,
  },
};

// Array of all tools for runTools()
const c1Tools = [
  smartSqlTool,
  getMemberDetailTool,
  getBillDetailTool,
  semanticSearchTool,
  searchNewsTool,
  getUserContextTool,
  getUserRepresentativesTool,
];

// NOTE: detectArtifactIntent removed - all requests go through runTools() to prevent hallucination

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // Increased timeout for tool execution

/**
 * C1 Chat API Route - Native C1 Tool Calling with Thesys Generative UI
 *
 * Uses OpenAI-compatible runTools() API with 7 optimized tools:
 * - SmartSQL: Database queries for bills, members, votes
 * - getMemberDetail: Congress member lookups by bioguide ID
 * - getBillDetail: Bill details and status
 * - semanticSearch: Topic-based bill search via embeddings
 * - searchNews: Current news via Perplexity
 * - getUserContext: User profile from SmartMemory
 * - getUserRepresentatives: User's elected officials
 *
 * Features:
 * - Native C1 runTools() for reliable tool execution
 * - Thinking states for tool progress visualization
 * - Direct artifact generation (reports/slides)
 * - User context personalization
 * - Message persistence
 */

// Backend service URLs
const CHAT_SERVICE_URL = process.env.NEXT_PUBLIC_CHAT_API_URL ||
  "https://svc-01kc6rbecv0s5k4yk6ksdaqyzk.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

const DASHBOARD_SERVICE_URL = process.env.NEXT_PUBLIC_DASHBOARD_API_URL ||
  "https://svc-01kc6rbecv0s5k4yk6ksdaqyzm.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

interface DBMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  prompt: DBMessage;
  threadId: string;
  responseId: string;
  useTools?: boolean;
  userContext?: UserContext;
}

// In-memory message store per thread (fallback for anonymous users)
const messageStores = new Map<string, DBMessage[]>();

// OpenAI message type for C1 API
type OpenAIMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

function getMessageStore(threadId: string) {
  if (!messageStores.has(threadId)) {
    messageStores.set(threadId, []);
  }

  return {
    addMessage: (msg: DBMessage) => {
      const store = messageStores.get(threadId)!;
      store.push(msg);
    },
    getMessages: () => messageStores.get(threadId)!,
    getOpenAIMessages: (): OpenAIMessage[] => {
      return messageStores.get(threadId)!.map(m => ({
        role: m.role,
        content: m.content,
      }));
    }
  };
}

/**
 * Fetch with timeout helper to prevent blocking
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 3000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Persist message to backend database
 */
async function persistMessage(
  threadId: string,
  message: DBMessage,
  accessToken: string
): Promise<void> {
  const url = `${CHAT_SERVICE_URL}/chat/c1/threads/${threadId}/messages`;
  console.log("[C1 API] Persisting message to:", url, "role:", message.role);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        role: message.role,
        content: message.content,
        messageId: message.id,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[C1 API] Failed to persist message:", response.status, errorText);
    } else {
      console.log("[C1 API] Message persisted successfully");
    }
  } catch (error) {
    console.error("[C1 API] Error persisting message:", error);
  }
}

/**
 * Load messages from backend database
 */
async function loadMessagesFromBackend(
  threadId: string,
  accessToken: string
): Promise<DBMessage[] | null> {
  try {
    const response = await fetchWithTimeout(
      `${CHAT_SERVICE_URL}/chat/c1/threads/${threadId}/messages`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      },
      5000 // 5 second timeout
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.warn("[C1 API] Failed to load messages:", response.status);
      return null;
    }

    const data = await response.json();
    return data.messages?.map((m: { id: string; role: string; content: string }) => ({
      id: m.id,
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })) || null;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("[C1 API] Timeout loading messages");
    } else {
      console.warn("[C1 API] Error loading messages:", error);
    }
    return null;
  }
}

/**
 * Fetch user interests from SmartMemory profile
 */
async function fetchUserInterests(accessToken: string): Promise<string[]> {
  try {
    console.log("[C1 API] Fetching user interests from:", `${CHAT_SERVICE_URL}/memory/profile`);

    const response = await fetchWithTimeout(
      `${CHAT_SERVICE_URL}/memory/profile`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      },
      5000 // 5 second timeout (increased from 3s)
    );

    if (!response.ok) {
      console.warn("[C1 API] Failed to fetch user interests:", response.status);
      return [];
    }

    const data = await response.json();
    console.log("[C1 API] User profile response:", JSON.stringify(data));

    if (data.success && data.profile && data.profile.interests) {
      console.log("[C1 API] Found interests:", data.profile.interests);
      return data.profile.interests;
    }

    console.log("[C1 API] No interests found in profile");
    return [];
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("[C1 API] Timeout fetching user interests");
    } else {
      console.warn("[C1 API] Error fetching user interests:", error);
    }
    return [];
  }
}

/**
 * Fetch user context (profile, preferences, representatives) from backend
 */
async function fetchUserContext(accessToken: string): Promise<UserContext | null> {
  try {
    console.log("[C1 API] Fetching representatives from:", `${DASHBOARD_SERVICE_URL}/dashboard/representatives`);

    const repsResponse = await fetchWithTimeout(
      `${DASHBOARD_SERVICE_URL}/dashboard/representatives`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      },
      5000 // 5 second timeout (increased from 3s)
    );

    if (!repsResponse.ok) {
      const errorText = await repsResponse.text();
      console.warn("[C1 API] Failed to fetch representatives:", repsResponse.status, errorText);
      return null;
    }

    const repsData = await repsResponse.json();

    const userContext: UserContext = {
      profile: {
        id: "",
        name: "",
        email: "",
        location: {
          state: repsData.state || undefined,
          district: repsData.district?.toString() || undefined,
        },
      },
      representatives: [],
    };

    if (repsData.senators && Array.isArray(repsData.senators)) {
      for (const senator of repsData.senators) {
        userContext.representatives!.push({
          bioguideId: senator.bioguideId || "",
          name: senator.name || senator.fullName || "",
          party: senator.party || "",
          chamber: "Senate",
          state: senator.state || repsData.state || "",
          imageUrl: senator.photoUrl || senator.imageUrl || undefined,
          phone: senator.phone || undefined,
          website: senator.website || undefined,
        });
      }
    }

    if (repsData.representative) {
      const rep = repsData.representative;
      userContext.representatives!.push({
        bioguideId: rep.bioguideId || "",
        name: rep.name || rep.fullName || "",
        party: rep.party || "",
        chamber: "House",
        state: rep.state || repsData.state || "",
        district: repsData.district || undefined,
        imageUrl: rep.photoUrl || rep.imageUrl || undefined,
        phone: rep.phone || undefined,
        website: rep.website || undefined,
      });
    }

    console.log("[C1 API] Fetched user context:", {
      state: userContext.profile?.location?.state,
      district: userContext.profile?.location?.district,
      representativesCount: userContext.representatives?.length,
    });

    return userContext;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("[C1 API] Timeout fetching user context");
    } else {
      console.warn("[C1 API] Error fetching user context:", error);
    }
    return null;
  }
}

// NOTE: handleDirectArtifactGeneration removed - caused hallucinated bill numbers
// All requests now go through runTools() which fetches real data first

export async function POST(req: NextRequest) {
  try {
    // Check for auth token first (needed for rate limiting)
    const authHeader = req.headers.get("Authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;
    const userId = extractUserIdFromAuth(authHeader);

    console.log("[C1 API] Request received - Auth token present:", !!accessToken, "userId:", userId);

    // Arcjet rate limiting - use user-based limits for authenticated users
    let decision;
    if (userId) {
      decision = await authenticatedChatProtection.protect(req, { userId });
    } else {
      decision = await chatProtection.protect(req);
    }

    const arcjetResult = handleArcjetDecision(decision);
    if (arcjetResult.blocked) {
      return new Response(
        JSON.stringify({ error: arcjetResult.message }),
        { status: arcjetResult.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const { prompt, threadId, responseId, userContext: clientUserContext } = (await req.json()) as ChatRequest;

    // Fetch user context and interests server-side when authenticated
    let userContext: UserContext | null = clientUserContext || null;
    let userInterests: string[] = [];
    if (accessToken) {
      console.log("[C1 API] Fetching user data with token (first 20 chars):", accessToken.substring(0, 20) + "...");
      // Fetch in parallel for performance
      const [context, interests] = await Promise.all([
        userContext ? Promise.resolve(userContext) : fetchUserContext(accessToken),
        fetchUserInterests(accessToken),
      ]);
      userContext = context;
      userInterests = interests;
      console.log("[C1 API] Fetch results - userContext:", userContext ? "found" : "null",
        "reps:", userContext?.representatives?.length ?? 0,
        "interests:", userInterests.length, userInterests);
    } else {
      console.log("[C1 API] No access token - skipping user data fetch");
    }

    // DEV ONLY: Use mock data for testing when not authenticated
    if (!userContext && process.env.NODE_ENV === "development") {
      console.log("[C1 API] Using mock user context for development testing");
      userContext = {
        profile: {
          id: "dev-user",
          name: "Test User",
          email: "test@example.com",
          location: {
            state: "WI",
            district: "2",
            city: "Madison",
          },
        },
        representatives: [
          {
            bioguideId: "B001230",
            name: "Tammy Baldwin",
            party: "D",
            chamber: "Senate",
            state: "WI",
            phone: "(202) 224-5653",
          },
          {
            bioguideId: "J000293",
            name: "Ron Johnson",
            party: "R",
            chamber: "Senate",
            state: "WI",
            phone: "(202) 224-5323",
          },
          {
            bioguideId: "P000607",
            name: "Mark Pocan",
            party: "D",
            chamber: "House",
            state: "WI",
            district: 2,
            phone: "(202) 225-2906",
          },
        ],
      };
    }

    // Get or create message store
    const messageStore = getMessageStore(threadId);

    // If authenticated, try to load history from backend
    if (accessToken) {
      const backendMessages = await loadMessagesFromBackend(threadId, accessToken);
      if (backendMessages && backendMessages.length > 0) {
        messageStores.set(threadId, backendMessages.filter(m => m.role !== "system"));
      }
      // Persist the user message (non-blocking)
      persistMessage(threadId, prompt, accessToken);
    }

    messageStore.addMessage(prompt);

    // Build messages for C1 API (OpenAI format)
    const messages = messageStore.getOpenAIMessages();

    // Build system message with user data and auth token for SmartMemory tools
    // This prevents C1 from showing "find representatives" forms
    let systemContent = C1_SYSTEM_PROMPT + "\n\n";

    const hasReps = userContext && userContext.representatives && userContext.representatives.length > 0;
    const hasInterests = userInterests && userInterests.length > 0;

    // Always inject auth token if available so agent can use SmartMemory tools
    if (accessToken) {
      systemContent += `[AUTH_TOKEN: ${accessToken}]\n\n`;
    }

    if (hasReps || hasInterests) {
      const userDataParts: string[] = [];

      if (hasReps) {
        const repsInfo = userContext!.representatives!.map(rep => {
          const partyFull = rep.party === "D" ? "Democrat" : rep.party === "R" ? "Republican" : rep.party;
          return `- ${rep.name} (${partyFull}, ${rep.chamber}${rep.district ? `, District ${rep.district}` : ""})`;
        }).join("\n");

        userDataParts.push(`Location:
State: ${userContext!.profile?.location?.state || "unknown"}
District: ${userContext!.profile?.location?.district || "unknown"}

Representatives:
${repsInfo}`);
      }

      if (hasInterests) {
        userDataParts.push(`Policy Interests: ${userInterests.join(", ")}`);
      }

      systemContent += `USER DATA (already fetched - DO NOT ask for location or show location forms):
${userDataParts.join("\n\n")}

IMPORTANT: Use this data when responding to personalized queries:
- When they ask "who are my representatives", display the representatives listed above directly. DO NOT show a form asking for their location.
- When they ask about "bills related to my interests", search for bills matching their policy interests: ${userInterests.join(", ") || "not specified"}.
- When personalizing responses, consider their location and interests.`;

      console.log("[C1 API] Injected user data - reps:", hasReps ? userContext!.representatives!.length : 0, "interests:", userInterests.length);
    } else if (accessToken) {
      // If authenticated but no data fetched, still tell agent to use tools
      systemContent += `The user is authenticated. Use SmartMemory tools (getUserContext, getUserRepresentatives) to fetch their profile and personalization data when they ask personalized questions like "who are my representatives" or "what are my interests".`;
    }

    // Build messages for C1 API with system message at start
    const messagesWithContext: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
      ...messages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    console.log("[C1 API] Streaming with native C1 runTools, messages:", messagesWithContext.length, "hasUserData:", hasReps || hasInterests);

    // NOTE: Artifact detection removed - all requests now go through runTools()
    // This ensures the model uses database tools to fetch REAL bill data
    // before generating any reports or analysis, preventing hallucinated bill numbers.
    // The model will generate artifacts inline using C1's generative UI capabilities.

    // Use native C1 runTools() for tool calling with streaming
    // This replaces Mastra agent streaming for better control and performance
    const runner = c1Client.beta.chat.completions.runTools({
      model: C1_MODEL,
      messages: messagesWithContext,
      tools: c1Tools,
      stream: true,
    });

    // Track message content for persistence
    let fullText = "";

    // Tool name to friendly thinking state message mapping (7 tools only)
    const TOOL_THINKING_STATES: Record<string, { title: string; description: string }> = {
      // Core data lookup (3)
      smartSql: { title: "Querying database", description: "Running database query for congressional data..." },
      getMemberDetail: { title: "Looking up legislator", description: "Searching congressional member database..." },
      getBillDetail: { title: "Fetching bill details", description: "Retrieving legislation information..." },
      // Search (2)
      semanticSearch: { title: "Searching documents", description: "Performing semantic search across bills..." },
      searchNews: { title: "Searching news", description: "Finding recent news and updates..." },
      // SmartMemory fallback (2)
      getUserContext: { title: "Loading your profile", description: "Retrieving your preferences and location..." },
      getUserRepresentatives: { title: "Finding your representatives", description: "Looking up your elected officials..." },
    };

    // Use makeC1Response for proper thinking state support
    const c1Response = makeC1Response();

    // Process stream in background and write to c1Response
    // IMPORTANT: Don't await this - let it run while we return the stream
    const processStream = async () => {
      // Add overall timeout for stream processing (90 seconds for tool calls)
      const streamTimeout = setTimeout(async () => {
        console.error("[C1 API] Stream timeout - forcing end");
        try {
          await c1Response.writeContent("\n\nI apologize, but the request timed out. Please try again.");
          await c1Response.end();
        } catch {
          // Ignore
        }
      }, 90000);

      try {
        // Set up event handlers for the runner
        runner.on("functionCall", (functionCall) => {
          const toolName = functionCall.name;
          console.log("[C1 API] Tool call:", toolName);
          const thinkState = TOOL_THINKING_STATES[toolName];
          if (thinkState) {
            // Fire and forget - don't await
            c1Response.writeThinkItem({
              title: thinkState.title,
              description: thinkState.description,
              ephemeral: true,
            }).catch(() => {});
          }
        });

        runner.on("functionCallResult", (result) => {
          console.log("[C1 API] Tool result received, length:", result?.length || 0);
        });

        // Stream content as it arrives (ChatCompletionChunk format)
        for await (const chunk of runner) {
          // Each chunk has choices array with delta
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            fullText += delta.content;
            await c1Response.writeContent(delta.content);
          }
        }

        clearTimeout(streamTimeout);

        // Get final message if streaming didn't capture all content
        const finalContent = await runner.finalContent();
        if (finalContent && finalContent !== fullText) {
          // Write any remaining content not captured during streaming
          const remaining = finalContent.substring(fullText.length);
          if (remaining) {
            fullText = finalContent;
            await c1Response.writeContent(remaining);
          }
        }

        // Store assistant message after streaming completes
        const assistantMessage: DBMessage = {
          role: "assistant",
          content: fullText,
          id: responseId,
        };

        messageStore.addMessage(assistantMessage);

        // Persist assistant response if authenticated
        if (accessToken) {
          persistMessage(threadId, assistantMessage, accessToken);
        }

        console.log("[C1 API] Stream completed, text length:", fullText.length);
        await c1Response.end();
      } catch (error) {
        clearTimeout(streamTimeout);
        console.error("[C1 API] Stream error:", error);
        // Try to write error to stream before closing
        try {
          await c1Response.writeContent(`\n\nError: ${error instanceof Error ? error.message : "Unknown error"}`);
        } catch {
          // Ignore write errors during cleanup
        }
        await c1Response.end();
      }
    };

    // Start processing but don't await - return stream immediately
    processStream().catch((error) => {
      console.error("[C1 API] Unhandled stream processing error:", error);
    });

    // Return the C1 response stream immediately
    const readableStream = c1Response.responseStream;

    return new NextResponse(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("[C1 API] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
