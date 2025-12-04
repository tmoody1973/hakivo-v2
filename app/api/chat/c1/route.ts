import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { transformStream } from "@crayonai/stream";
import { tools } from "./tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * C1 Chat API Route - Direct OpenAI SDK Integration
 *
 * Uses OpenAI SDK with runTools for proper C1 generative UI.
 * Based on thesys template-c1-next pattern.
 *
 * Features:
 * - Persists messages to backend database when authenticated
 * - Falls back to in-memory storage for anonymous users
 * - User-isolated chat history
 */

const CHAT_SERVICE_URL = process.env.NEXT_PUBLIC_CHAT_API_URL ||
  "https://svc-01ka8k5e6tr0kgy0jkzj9m4q18.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

interface DBMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  prompt: DBMessage;
  threadId: string;
  responseId: string;
}

// Minimal system prompt for C1 generative UI
// IMPORTANT: C1 is fine-tuned for UI generation. Don't override with verbose instructions.
// Let C1 use its native component library (tables, charts, cards, etc.)
const c1SystemPrompt = `You are Hakivo, a non-partisan congressional assistant helping citizens understand government.

Key facts:
- Current Congress: 119th (Jan 2025-Jan 2027)
- Always use congress=119 for current bills
- Be objective, cite Congress.gov, explain jargon

When displaying data:
- Use tables for lists of bills, voting records, comparisons
- Use charts for vote breakdowns and statistics
- Use cards for individual bills or representatives
- Keep text concise - let the UI tell the story`;

// In-memory message store per thread (fallback for anonymous users)
const messageStores = new Map<string, DBMessage[]>();

function getMessageStore(threadId: string) {
  if (!messageStores.has(threadId)) {
    messageStores.set(threadId, [
      { id: "system", role: "system", content: c1SystemPrompt }
    ]);
  }
  return {
    addMessage: (msg: DBMessage) => {
      const store = messageStores.get(threadId)!;
      store.push(msg);
    },
    getOpenAICompatibleMessageList: () => {
      return messageStores.get(threadId)!.map(m => ({
        role: m.role,
        content: m.content,
      }));
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

export async function POST(req: NextRequest) {
  try {
    const { prompt, threadId, responseId } = (await req.json()) as ChatRequest;

    // Check for auth token
    const authHeader = req.headers.get("Authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

    const client = new OpenAI({
      baseURL: "https://api.thesys.dev/v1/embed/",
      apiKey: process.env.THESYS_API_KEY,
    });

    // Get or create message store
    const messageStore = getMessageStore(threadId);

    // If authenticated, try to load history from backend and persist new message
    if (accessToken) {
      // Ensure thread exists and load previous messages if this is a new session
      const backendMessages = await loadMessagesFromBackend(threadId, accessToken);
      if (backendMessages && backendMessages.length > 0) {
        // Replace in-memory store with backend messages
        messageStores.set(threadId, [
          { id: "system", role: "system", content: c1SystemPrompt },
          ...backendMessages.filter(m => m.role !== "system"),
        ]);
      }

      // Persist the user message
      persistMessage(threadId, prompt, accessToken);
    }

    messageStore.addMessage(prompt);

    const llmStream = await client.beta.chat.completions.runTools({
      model: "c1/anthropic/claude-sonnet-4/v-20250930",
      temperature: 0.5 as unknown as number,
      messages: messageStore.getOpenAICompatibleMessageList(),
      stream: true,
      tool_choice: tools.length > 0 ? "auto" : "none",
      tools,
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
