import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { transformStream } from "@crayonai/stream";
import { congressionalSystemPrompt } from "@/mastra/agents/congressional-assistant";
import { tools } from "./tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * C1 Chat API Route - Direct OpenAI SDK Integration
 *
 * Uses OpenAI SDK with runTools for proper C1 generative UI.
 * Based on thesys template-c1-next pattern.
 */

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

// Enhanced system prompt for C1 generative UI
const c1SystemPrompt = `${congressionalSystemPrompt}

## UI Generation Guidelines

When presenting information, use rich visual UI components:

- **Cards**: For individual bills, legislators, or news items - always include relevant metadata
- **Tables**: For comparing multiple items, showing voting records, or listing bills
- **Charts**: For vote breakdowns, party statistics, or trends over time
- **Buttons**: For interactive actions like "Track Bill", "View Full Text", "Contact Representative"
- **Badges/Tags**: For status indicators, party affiliations, and policy areas

IMPORTANT: Always prefer visual components over plain text lists. When you have data to display:
- Use cards for single items with rich information
- Use tables for multiple items in a list format
- Use charts for numerical comparisons
- Include action buttons for user interaction

Be concise - let the UI components tell the story visually.`;

// In-memory message store per thread
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

export async function POST(req: NextRequest) {
  try {
    const { prompt, threadId, responseId } = (await req.json()) as ChatRequest;

    const client = new OpenAI({
      baseURL: "https://api.thesys.dev/v1/embed/",
      apiKey: process.env.THESYS_API_KEY,
    });

    const messageStore = getMessageStore(threadId);
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
          messageStore.addMessage({
            role: "assistant",
            content: message,
            id: responseId,
          });
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
