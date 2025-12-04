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
    console.log("[API] CEREBRAS_API_KEY set:", !!process.env.CEREBRAS_API_KEY);
    console.log("[API] OPENAI_API_KEY set:", !!process.env.OPENAI_API_KEY);
    console.log("[API] ANTHROPIC_API_KEY set:", !!process.env.ANTHROPIC_API_KEY);

    let stream;
    let streamError: Error | null = null;

    console.log("[API] Agent model info:", agent.model);

    try {
      console.log("[API] Calling agent.stream()...");
      stream = await agent.stream(promptWithContext, {
        onError: ({ error }) => {
          console.error("[API] Stream onError callback:", error);
          streamError = error instanceof Error ? error : new Error(String(error));
        },
        onFinish: (result) => {
          console.log("[API] Stream onFinish callback, text length:", result?.text?.length || 0);
        },
      });
      console.log("[API] Stream created successfully, type:", typeof stream);
    } catch (err) {
      console.error("[API] Failed to create stream:", err);
      console.error("[API] Error details:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
      streamError = err instanceof Error ? err : new Error(String(err));
    }

    if (streamError || !stream) {
      // Return error as SSE
      const encoder = new TextEncoder();
      const errorStream = new ReadableStream({
        start(controller) {
          const errorMsg = streamError?.message || "Failed to create stream";
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

    // Create a ReadableStream for SSE using textStream directly
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let chunkCount = 0;
          let totalContent = "";

          console.log("[API] Starting to consume textStream");

          // Use textStream directly - the recommended approach
          for await (const chunk of stream.textStream) {
            chunkCount++;
            totalContent += chunk;
            if (chunkCount <= 5 || chunkCount % 10 === 0) {
              console.log("[API] Chunk", chunkCount, ":", chunk?.substring(0, 50));
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
          }

          console.log("[API] Stream complete, chunks:", chunkCount, "total length:", totalContent.length);

          if (totalContent.length === 0) {
            console.error("[API] WARNING: No content was generated! Checking stream.text...");
            // Try getting full text as fallback
            try {
              const fullText = await stream.text;
              console.log("[API] stream.text result:", fullText?.substring(0, 100) || "empty");
              if (fullText) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: fullText })}\n\n`));
                totalContent = fullText;
              }
            } catch (textError) {
              console.error("[API] stream.text failed:", textError);
            }

            if (totalContent.length === 0) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "No response generated. Check API key and model configuration." })}\n\n`));
            }
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
