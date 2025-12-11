/**
 * C1 Chat API Route Helper
 *
 * This module provides a reusable pattern for creating C1-powered chat endpoints
 * that stream responses with tool calling and progress updates.
 *
 * Based on the official Thesys C1 template pattern.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { transformStream } from "@crayonai/stream";
import { HAKIVO_SYSTEM_PROMPT } from "./system-prompt";
import { createToolsWithProgress, defaultTools } from "./tools";
import { C1_CONFIG } from "./index";

/**
 * Message type matching OpenAI format with optional ID
 */
export type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam & {
  id?: string;
};

/**
 * In-memory message store for conversation history
 *
 * In production, replace with database storage (Supabase, D1, etc.)
 */
const messageStores: Record<string, ChatMessage[]> = {};

/**
 * Get or create a message store for a thread
 */
export function getMessageStore(threadId: string) {
  if (!messageStores[threadId]) {
    messageStores[threadId] = [];
  }

  const messageList = messageStores[threadId];

  return {
    /**
     * Add a message to the conversation history
     */
    addMessage: (message: ChatMessage) => {
      messageList.push(message);
    },

    /**
     * Get all messages
     */
    messageList,

    /**
     * Get messages formatted for OpenAI API (without custom id field)
     */
    getOpenAICompatibleMessageList: (): OpenAI.Chat.ChatCompletionMessageParam[] => {
      return messageList.map((m) => {
        const { id, ...rest } = m;
        return rest as OpenAI.Chat.ChatCompletionMessageParam;
      });
    },

    /**
     * Clear conversation history
     */
    clear: () => {
      messageStores[threadId] = [];
    },
  };
}

/**
 * Request body shape for chat endpoint
 */
export interface ChatRequestBody {
  prompt: ChatMessage;
  threadId: string;
  responseId: string;
  useProgress?: boolean;
}

/**
 * Create a streaming chat response using C1
 *
 * This function handles:
 * - Message history management
 * - Tool calling with the Hakivo tools
 * - Streaming the response back to the client
 * - Saving the assistant's response to history
 *
 * @example
 * ```ts
 * // In app/api/c1-chat/route.ts
 * import { createC1ChatHandler } from '@/lib/c1/chat-route';
 *
 * export const POST = createC1ChatHandler();
 * ```
 */
export function createC1ChatHandler(options?: {
  systemPrompt?: string;
  includeSystemPrompt?: boolean;
}) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const { prompt, threadId, responseId, useProgress } =
        (await req.json()) as ChatRequestBody;

      // Validate required fields
      if (!prompt || !threadId || !responseId) {
        return NextResponse.json(
          { error: "Missing required fields: prompt, threadId, responseId" },
          { status: 400 }
        );
      }

      // Initialize OpenAI client with Thesys base URL
      const client = new OpenAI({
        baseURL: C1_CONFIG.baseURL,
        apiKey: process.env.THESYS_API_KEY,
      });

      // Get message store for this thread
      const messageStore = getMessageStore(threadId);

      // Add user message to history
      messageStore.addMessage(prompt);

      // Build messages array
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      // Optionally include system prompt
      if (options?.includeSystemPrompt !== false) {
        messages.push({
          role: "system",
          content: options?.systemPrompt || HAKIVO_SYSTEM_PROMPT,
        });
      }

      // Add conversation history
      messages.push(...messageStore.getOpenAICompatibleMessageList());

      // Get tools - with or without progress callback
      // Note: In the basic streaming pattern, progress updates happen during tool execution
      // but aren't streamed to the client separately. The transformStream handles the
      // main content streaming.
      const tools = useProgress ? createToolsWithProgress(() => {}) : defaultTools;

      // Create streaming response with tool calling
      const llmStream = await client.beta.chat.completions.runTools({
        model: C1_CONFIG.model,
        temperature: C1_CONFIG.temperature as unknown as number,
        messages,
        stream: true,
        tool_choice: tools.length > 0 ? "auto" : "none",
        tools,
      });

      // Transform the stream to extract content
      const responseStream = transformStream(
        llmStream,
        (chunk) => {
          // Extract content from delta
          return chunk.choices?.[0]?.delta?.content ?? "";
        },
        {
          onEnd: ({ accumulated }) => {
            // Combine all accumulated content
            const message = accumulated.filter(Boolean).join("");

            // Save assistant response to history
            messageStore.addMessage({
              role: "assistant",
              content: message,
              id: responseId,
            });
          },
        }
      ) as ReadableStream<string>;

      // Return streaming response with SSE headers
      return new NextResponse(responseStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    } catch (error) {
      console.error("[C1 Chat] Error:", error);

      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Internal server error",
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Helper to clear a conversation's history
 */
export function clearConversation(threadId: string): void {
  const store = getMessageStore(threadId);
  store.clear();
}

/**
 * Helper to get conversation history
 */
export function getConversationHistory(threadId: string): ChatMessage[] {
  const store = getMessageStore(threadId);
  return store.messageList;
}

/**
 * Default export - create handler with Hakivo system prompt
 */
export default createC1ChatHandler;
