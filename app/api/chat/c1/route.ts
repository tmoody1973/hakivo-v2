import { NextRequest, NextResponse } from "next/server";
import { makeC1Response } from "@thesysai/genui-sdk/server";
import { mastra } from "@/mastra";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * C1 Chat API Route - Mastra Agent Pattern
 *
 * Uses the Mastra C1 Congressional Assistant agent for:
 * - Tool orchestration (bills, news, members)
 * - Streaming responses with generative UI
 * - Conversation context management
 */

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  threadId?: string;
}

// Simple in-memory message store (for conversation history)
const messageStore = new Map<string, Array<{ id: string; role: string; content: string; createdAt: Date }>>();

function getMessageStore(threadId: string) {
  if (!messageStore.has(threadId)) {
    messageStore.set(threadId, []);
  }
  return messageStore.get(threadId)!;
}

export async function POST(request: NextRequest) {
  // Create C1 response helper for proper generative UI streaming
  const c1Response = makeC1Response();

  try {
    const body: ChatRequest = await request.json();
    const { messages, threadId = crypto.randomUUID() } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get or create message store for this thread
    const store = getMessageStore(threadId);

    // Get the C1 congressional assistant from Mastra
    const agent = mastra.getAgent("c1CongressionalAssistant");

    if (!agent) {
      throw new Error("C1 Congressional Assistant agent not found");
    }

    // Get the latest user message
    const latestUserMessage = messages[messages.length - 1];

    // Build message history for the agent as CoreMessage array
    const messageHistory: Array<{ role: "user" | "assistant" | "system"; content: string }> = store.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Add current user message
    messageHistory.push({
      role: "user",
      content: latestUserMessage.content,
    });

    // Process with Mastra agent in background
    (async () => {
      try {
        // Send initial progress indicator
        await c1Response.writeThinkItem({
          title: "Processing",
          description: "Analyzing your request...",
          ephemeral: true,
        });

        // Use agent.stream() with messages - Mastra accepts string or CoreMessage[]
        const stream = await agent.stream(messageHistory as Parameters<typeof agent.stream>[0]);

        let fullContent = "";

        // Process the text stream - Mastra's textStream yields string chunks directly
        for await (const chunk of stream.textStream) {
          if (chunk) {
            fullContent += chunk;
            // Stream content incrementally to C1
            await c1Response.writeContent(chunk);
          }
        }

        // Store messages for conversation history
        store.push({
          id: crypto.randomUUID(),
          role: "user",
          content: latestUserMessage.content,
          createdAt: new Date(),
        });
        store.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: fullContent,
          createdAt: new Date(),
        });

        await c1Response.end();
      } catch (error) {
        console.error("[C1 API] Stream error:", error);
        await c1Response.writeContent(`Error: ${error instanceof Error ? error.message : "Request failed"}`);
        await c1Response.end();
      }
    })();

    // Return the C1 response stream
    return new NextResponse(c1Response.responseStream as ReadableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Thread-Id": threadId,
      },
    });
  } catch (error) {
    console.error("[C1 API] Error:", error);
    await c1Response.end();
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
