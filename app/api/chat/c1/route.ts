import { NextRequest, NextResponse } from "next/server";
import { c1CongressionalAssistant } from "@/mastra";
import { UserContext } from "@/lib/c1/user-context";
import type { CoreMessage } from "ai";
import {
  chatProtection,
  authenticatedChatProtection,
  handleArcjetDecision,
  extractUserIdFromAuth,
} from "@/lib/security/arcjet";
import { makeC1Response } from "@thesysai/genui-sdk/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // Increased timeout for tool execution

/**
 * C1 Chat API Route - Mastra Agent with Thesys C1 Generative UI
 *
 * Uses c1CongressionalAssistant Mastra agent with 30+ tools.
 * Tools include SmartSQL, SmartBucket, SmartMemory, Perplexity, OpenStates, C1 Artifacts.
 *
 * Features:
 * - Full tool orchestration via Mastra
 * - Proper streaming with timeout handling
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
    getMastraMessages: (): CoreMessage[] => {
      return messageStores.get(threadId)!.map(m => ({
        role: m.role,
        content: m.content,
      })) as CoreMessage[];
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
      3000 // 3 second timeout
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
      3000 // 3 second timeout
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
      `${DASHBOARD_SERVICE_URL}/dashboard/representatives?token=${encodeURIComponent(accessToken)}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      },
      3000 // 3 second timeout
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

    // Build messages for Mastra agent
    const messages = messageStore.getMastraMessages();

    // Build system message with user data and auth token for SmartMemory tools
    // This prevents C1 from showing "find representatives" forms
    let systemContent = "";

    const hasReps = userContext && userContext.representatives && userContext.representatives.length > 0;
    const hasInterests = userInterests && userInterests.length > 0;

    // Always inject auth token if available so agent can use SmartMemory tools
    if (accessToken) {
      systemContent = `[AUTH_TOKEN: ${accessToken}]

`;
    }

    if (hasReps || hasInterests) {
      let userDataParts: string[] = [];

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

    // Add system message with user data at the start
    const messagesWithContext: CoreMessage[] = [];
    if (systemContent) {
      messagesWithContext.push({
        role: "system",
        content: systemContent,
      } as CoreMessage);
    }
    messagesWithContext.push(...messages);

    console.log("[C1 API] Streaming with Mastra agent, messages:", messagesWithContext.length, "hasUserData:", !!systemContent);

    // Use Mastra agent stream with context-enriched messages
    const stream = await c1CongressionalAssistant.stream(messagesWithContext, {
      maxSteps: 10, // Allow multiple tool calls
      toolChoice: "auto",
    });

    // Track message content for persistence
    let fullText = "";
    let artifactContent = ""; // Track artifact content separately

    // Artifact tool names that return C1 DSL content
    const ARTIFACT_TOOLS = ["createArtifact", "editArtifact", "generateBillReport", "generateBriefingSlides"];

    // Tool name to friendly thinking state message mapping
    const TOOL_THINKING_STATES: Record<string, { title: string; description: string }> = {
      // Data lookup tools
      getMemberDetail: { title: "Looking up legislator", description: "Searching congressional member database..." },
      getBillDetail: { title: "Fetching bill details", description: "Retrieving legislation information..." },
      smartSql: { title: "Querying database", description: "Running database query for congressional data..." },
      // Search tools
      semanticSearch: { title: "Searching documents", description: "Performing semantic search across bills and documents..." },
      searchNews: { title: "Searching news", description: "Finding recent news and updates..." },
      webSearch: { title: "Searching the web", description: "Looking up information online..." },
      // Memory tools
      getUserContext: { title: "Loading your profile", description: "Retrieving your preferences and location..." },
      getUserRepresentatives: { title: "Finding your representatives", description: "Looking up your elected officials..." },
      getConversationHistory: { title: "Loading history", description: "Retrieving past conversation context..." },
      storeWorkingMemory: { title: "Saving context", description: "Storing session information..." },
      // Artifact tools
      createArtifact: { title: "Creating document", description: "Generating your document..." },
      editArtifact: { title: "Editing document", description: "Updating your document..." },
      generateBillReport: { title: "Generating report", description: "Creating comprehensive bill analysis..." },
      generateBriefingSlides: { title: "Building presentation", description: "Creating briefing slides..." },
    };

    // Use makeC1Response for proper thinking state support
    const c1Response = makeC1Response();

    // Process stream in background and write to c1Response
    (async () => {
      try {
        // Use fullStream to get all parts including tool calls and results
        for await (const part of stream.fullStream) {
          if (part.type === "text-delta") {
            // Stream text chunks
            const payload = part.payload as { textDelta?: string };
            const text = payload.textDelta || "";
            fullText += text;
            await c1Response.writeContent(text);
          } else if (part.type === "tool-call") {
            // Show thinking state when tool is called
            const payload = part.payload as { toolName?: string };
            const toolName = payload.toolName || "";
            const thinkState = TOOL_THINKING_STATES[toolName];
            if (thinkState) {
              console.log("[C1 API] Writing thinking state for tool:", toolName);
              await c1Response.writeThinkItem({
                title: thinkState.title,
                description: thinkState.description,
                ephemeral: true, // Disappears when tool completes
              });
            }
          } else if (part.type === "tool-result") {
            // Check if this is an artifact tool result
            const payload = part.payload as { toolName?: string; result?: unknown };
            const toolName = payload.toolName || "";
            if (ARTIFACT_TOOLS.includes(toolName)) {
              console.log("[C1 API] Artifact tool result detected:", toolName);
              const result = payload.result as { success?: boolean; content?: string; id?: string; type?: string };

              if (result && result.success && result.content) {
                // Stream artifact content as C1 DSL for C1Chat to render
                artifactContent = result.content;
                await c1Response.writeContent("\n\n");
                await c1Response.writeContent(result.content);
                await c1Response.writeContent("\n\n");
                console.log("[C1 API] Streamed artifact content, id:", result.id, "type:", result.type, "length:", result.content.length);
              }
            }
          }
        }

        // Build full message content including any artifacts
        const fullContent = artifactContent ? `${fullText}\n\n${artifactContent}` : fullText;

        // Store assistant message after streaming completes
        const assistantMessage: DBMessage = {
          role: "assistant",
          content: fullContent,
          id: responseId,
        };

        messageStore.addMessage(assistantMessage);

        // Persist assistant response if authenticated
        if (accessToken) {
          persistMessage(threadId, assistantMessage, accessToken);
        }

        console.log("[C1 API] Stream completed, text length:", fullText.length, "artifact length:", artifactContent.length);
        await c1Response.end();
      } catch (error) {
        console.error("[C1 API] Stream error:", error);
        await c1Response.end();
      }
    })();

    // Return the C1 response stream
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
