import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { transformStream } from "@crayonai/stream";
import { defaultTools } from "@/lib/c1/tools";
import { HAKIVO_SYSTEM_PROMPT } from "@/lib/c1/system-prompt";
import { buildSystemPromptWithContext, UserContext } from "@/lib/c1/user-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * C1 Chat API Route - OpenAI SDK with Tool Calling
 *
 * Uses OpenAI SDK with runTools for C1 generative UI with Hakivo tools.
 * Based on thesys template-c1-next pattern.
 *
 * Features:
 * - Tool calling for news, bills, members, and images
 * - Persists messages to backend database when authenticated
 * - Falls back to in-memory storage for anonymous users
 * - User-isolated chat history
 * - System prompt guides tone, tool usage, and component selection
 */

// Uses NEXT_PUBLIC_CHAT_API_URL from .env.local
const CHAT_SERVICE_URL = process.env.NEXT_PUBLIC_CHAT_API_URL ||
  "https://svc-01kc6rbecv0s5k4yk6ksdaqyzk.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

// Uses NEXT_PUBLIC_DASHBOARD_API_URL from .env.local
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
  useTools?: boolean; // Option to enable/disable tools
  userContext?: UserContext; // User profile, preferences, representatives
}

// System prompt is now imported from lib/c1/system-prompt.ts

// In-memory message store per thread (fallback for anonymous users)
const messageStores = new Map<string, DBMessage[]>();

function getMessageStore(threadId: string, userContext?: UserContext) {
  if (!messageStores.has(threadId)) {
    // Initialize with empty array
    messageStores.set(threadId, []);
  }

  // Build personalized system prompt with user context
  const systemPrompt = buildSystemPromptWithContext(HAKIVO_SYSTEM_PROMPT, userContext || null);

  return {
    addMessage: (msg: DBMessage) => {
      const store = messageStores.get(threadId)!;
      store.push(msg);
    },
    getOpenAICompatibleMessageList: (includeSystemPrompt: boolean = true): OpenAI.Chat.ChatCompletionMessageParam[] => {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      // Add personalized system prompt if requested
      if (includeSystemPrompt) {
        messages.push({
          role: "system",
          content: systemPrompt,
        });
      }

      // Add conversation history
      messages.push(...messageStores.get(threadId)!.map(m => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })));

      return messages;
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
    // Non-blocking - continue even if persistence fails
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
        // Thread doesn't exist in backend yet - that's ok
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
 * Fetch user context (profile, preferences, representatives) from backend
 * This is used to personalize the system prompt for each user
 */
async function fetchUserContext(accessToken: string): Promise<UserContext | null> {
  try {
    // Fetch representatives (which includes user's state/district info)
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

    // Build user context from representatives response
    const userContext: UserContext = {
      profile: {
        id: "", // Will be extracted from token if needed
        name: "", // Not returned from this endpoint
        email: "",
        location: {
          state: repsData.state || undefined,
          district: repsData.district?.toString() || undefined,
        },
      },
      representatives: [],
    };

    // Map senators
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

    // Map house representative
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
    const { prompt, threadId, responseId, userContext: clientUserContext } = (await req.json()) as ChatRequest;

    // Check for auth token
    const authHeader = req.headers.get("Authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

    const client = new OpenAI({
      baseURL: "https://api.thesys.dev/v1/embed/",
      apiKey: process.env.THESYS_API_KEY,
    });

    // Fetch user context server-side when authenticated
    // This ensures the assistant knows the user's representatives, location, etc.
    let userContext: UserContext | null = clientUserContext || null;
    if (accessToken && !userContext) {
      userContext = await fetchUserContext(accessToken);
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

    // Get or create message store with user context for personalized system prompt
    const messageStore = getMessageStore(threadId, userContext || undefined);

    // If authenticated, try to load history from backend and persist new message
    if (accessToken) {
      // Ensure thread exists and load previous messages if this is a new session
      const backendMessages = await loadMessagesFromBackend(threadId, accessToken);
      if (backendMessages && backendMessages.length > 0) {
        // Replace in-memory store with backend messages (NO system message)
        messageStores.set(threadId, backendMessages.filter(m => m.role !== "system"));
      }

      // Persist the user message
      persistMessage(threadId, prompt, accessToken);
    }

    messageStore.addMessage(prompt);

    // Use runTools for tool calling - follows C1 template pattern
    // Tools return data, C1 renders as UI components (Cards, Reports, etc.)
    const llmStream = await client.beta.chat.completions.runTools({
      model: "c1/anthropic/claude-sonnet-4/v-20251130",
      temperature: 0.5,
      messages: messageStore.getOpenAICompatibleMessageList(),
      stream: true,
      tool_choice: defaultTools.length > 0 ? "auto" : "none",
      tools: defaultTools,
    });

    const responseStream = transformStream(
      llmStream,
      (chunk) => {
        return chunk.choices?.[0]?.delta?.content ?? "";
      },
      {
        onEnd: ({ accumulated }) => {
          const message = accumulated.filter((m) => m).join("");
          const assistantMessage: DBMessage = {
            role: "assistant",
            content: message,
            id: responseId,
          };

          messageStore.addMessage(assistantMessage);

          // Persist assistant response if authenticated
          if (accessToken) {
            persistMessage(threadId, assistantMessage, accessToken);
          }
        },
      }
    ) as ReadableStream<string>;

    return new NextResponse(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
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
