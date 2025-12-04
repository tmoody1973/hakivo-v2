import { createCongressionalAssistant } from "@/mastra/agents/congressional-assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  sessionId?: string; // Reserved for future session management
}

export async function POST(request: Request) {
  try {
    const body: ChatRequest = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "user") {
      return new Response(
        JSON.stringify({ error: "Last message must be from user" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create the congressional assistant agent with query-based model selection
    const agent = createCongressionalAssistant(lastMessage.content);

    // Build conversation context from previous messages
    const conversationContext = messages
      .slice(0, -1) // All messages except the last one
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    // Create the prompt with context
    const promptWithContext = conversationContext
      ? `Previous conversation:\n${conversationContext}\n\nUser: ${lastMessage.content}`
      : lastMessage.content;

    // Stream the response
    console.log("[API] Starting stream for query:", promptWithContext.substring(0, 100));

    let stream;
    try {
      stream = await agent.stream(promptWithContext);
      console.log("[API] Stream created, keys:", Object.keys(stream));
    } catch (streamError) {
      console.error("[API] Failed to create stream:", streamError);
      // Return error as SSE
      const encoder = new TextEncoder();
      const errorStream = new ReadableStream({
        start(controller) {
          const errorMsg = streamError instanceof Error ? streamError.message : "Failed to create stream";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        }
      });
      return new Response(errorStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Create a ReadableStream for SSE
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let chunkCount = 0;
          let totalContent = "";

          // Try fullStream first for more detailed events
          if (stream.fullStream) {
            console.log("[API] Using fullStream");
            for await (const part of stream.fullStream) {
              console.log("[API] Part type:", part.type, "payload:", JSON.stringify((part as unknown as { payload?: unknown }).payload)?.substring(0, 100));
              if (part.type === "text-delta") {
                // Mastra payload may be string or object - extract the text
                const payload = (part as unknown as { payload: unknown }).payload;
                const textContent = typeof payload === "string" ? payload :
                  (payload && typeof payload === "object" && "textDelta" in payload)
                    ? String((payload as { textDelta: string }).textDelta)
                    : String(payload);
                if (textContent) {
                  chunkCount++;
                  totalContent += textContent;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: textContent })}\n\n`));
                }
              } else if (part.type === "error") {
                console.error("[API] Stream error part:", part);
                const errorPayload = (part as unknown as { payload: unknown }).payload;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(errorPayload) })}\n\n`));
              }
            }
          } else if (stream.textStream) {
            console.log("[API] Using textStream");
            for await (const chunk of stream.textStream) {
              chunkCount++;
              totalContent += chunk;
              console.log("[API] Chunk", chunkCount, ":", chunk?.substring(0, 50));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
            }
          } else {
            // Fallback to getting full text
            console.log("[API] No stream available, trying text property");
            const text = await stream.text;
            if (text) {
              console.log("[API] Got text:", text.substring(0, 100));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
              totalContent = text;
            }
          }

          console.log("[API] Stream complete, chunks:", chunkCount, "total length:", totalContent.length);

          if (totalContent.length === 0) {
            console.error("[API] WARNING: No content was generated!");
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "No response generated. Check API key configuration." })}\n\n`));
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error("[API] Streaming error:", error);
          const errorData = JSON.stringify({
            error: error instanceof Error ? error.message : "Streaming failed",
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
