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

        // Process the stream
        for await (const chunk of stream.fullStream) {
          // Cast to unknown first for flexible type handling
          const chunkAny = chunk as unknown as { type: string; payload?: { textDelta?: string; toolName?: string } };

          if (chunkAny.type === "text-delta") {
            const textDelta = chunkAny.payload?.textDelta || "";
            if (textDelta) {
              fullContent += textDelta;
              // Stream content incrementally
              await c1Response.writeContent(textDelta);
            }
          } else if (chunkAny.type === "tool-call") {
            // Progress indicator for tool execution
            const toolName = chunkAny.payload?.toolName;
            if (toolName) {
              const progressMessages: Record<string, { title: string; description: string }> = {
                smartSql: { title: "Searching Database", description: "Querying congressional data..." },
                getBillDetail: { title: "Fetching Bill", description: "Getting bill details..." },
                getMemberDetail: { title: "Member Lookup", description: "Finding member information..." },
                semanticSearch: { title: "Semantic Search", description: "Searching bill text..." },
                billTextRag: { title: "Analyzing", description: "Reading bill content..." },
                compareBills: { title: "Comparing", description: "Analyzing differences..." },
                searchNews: { title: "Searching News", description: "Finding current coverage..." },
                searchCongressionalNews: { title: "Congressional News", description: "Getting latest updates..." },
                webSearch: { title: "Web Search", description: "Searching the web..." },
                searchStateBills: { title: "State Bills", description: "Searching state legislation..." },
                getStateBillDetails: { title: "State Bill Details", description: "Getting state bill info..." },
                getStateLegislatorsByLocation: { title: "State Legislators", description: "Finding your representatives..." },
                trackBill: { title: "Tracking", description: "Setting up bill tracking..." },
                getUserContext: { title: "Context", description: "Loading your preferences..." },
                getTrackedBills: { title: "Your Bills", description: "Getting your tracked bills..." },
              };
              if (progressMessages[toolName]) {
                await c1Response.writeThinkItem({
                  title: progressMessages[toolName].title,
                  description: progressMessages[toolName].description,
                  ephemeral: true,
                });
              }
            }
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
