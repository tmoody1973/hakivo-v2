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
 * Persist message to backend database
 */
async function persistMessage(
  threadId: string,
  message: DBMessage,
  accessToken: string
): Promise<void> {
  try {
    const response = await fetch(
      `${CHAT_SERVICE_URL}/chat/c1/threads/${threadId}/messages`,
      {
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
      }
    );

    if (!response.ok) {
      console.warn("[C1 API] Failed to persist message:", response.status);
    }
  } catch (error) {
    console.warn("[C1 API] Error persisting message:", error);
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
    const response = await fetch(
      `${CHAT_SERVICE_URL}/chat/c1/threads/${threadId}/messages`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      }
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
    console.warn("[C1 API] Error loading messages:", error);
    return null;
  }
}

/**
 * Fetch user interests from SmartMemory profile
 */
async function fetchUserInterests(accessToken: string): Promise<string[]> {
  try {
    const response = await fetch(
      `${CHAT_SERVICE_URL}/memory/profile`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.warn("[C1 API] Failed to fetch user interests:", response.status);
      return [];
    }

    const data = await response.json();
    if (data.success && data.profile && data.profile.interests) {
      return data.profile.interests;
    }
    return [];
  } catch (error) {
    console.warn("[C1 API] Error fetching user interests:", error);
    return [];
  }
}

/**
 * Fetch user context (profile, preferences, representatives) from backend
 */
async function fetchUserContext(accessToken: string): Promise<UserContext | null> {
  try {
    const repsResponse = await fetch(
      `${DASHBOARD_SERVICE_URL}/dashboard/representatives?token=${encodeURIComponent(accessToken)}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      }
    );

    if (!repsResponse.ok) {
      console.warn("[C1 API] Failed to fetch representatives:", repsResponse.status);
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
    console.warn("[C1 API] Error fetching user context:", error);
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
      // Fetch in parallel for performance
      const [context, interests] = await Promise.all([
        userContext ? Promise.resolve(userContext) : fetchUserContext(accessToken),
        fetchUserInterests(accessToken),
      ]);
      userContext = context;
      userInterests = interests;
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

    // Build system message with user data so C1 has it upfront
    // This prevents C1 from showing "find representatives" forms
    let systemContent = "";

    const hasReps = userContext && userContext.representatives && userContext.representatives.length > 0;
    const hasInterests = userInterests && userInterests.length > 0;

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

      systemContent = `USER DATA (already fetched - DO NOT ask for location or show location forms):
${userDataParts.join("\n\n")}

IMPORTANT: Use this data when responding to personalized queries:
- When they ask "who are my representatives", display the representatives listed above directly. DO NOT show a form asking for their location.
- When they ask about "bills related to my interests", search for bills matching their policy interests: ${userInterests.join(", ") || "not specified"}.
- When personalizing responses, consider their location and interests.`;

      console.log("[C1 API] Injected user data - reps:", hasReps ? userContext!.representatives!.length : 0, "interests:", userInterests.length);
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

    // Create ReadableStream following Thesys/Mastra pattern
    const encoder = new TextEncoder();
    let fullText = "";

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Stream text chunks using textStream property
          for await (const chunk of stream.textStream) {
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
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

          console.log("[C1 API] Stream completed, response length:", fullText.length);
          controller.close();
        } catch (error) {
          console.error("[C1 API] Stream error:", error);
          controller.error(error);
        }
      },
    });

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
