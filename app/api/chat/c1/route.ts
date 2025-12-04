import { NextRequest } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * C1 Chat API Route
 *
 * Uses thesys C1 for generative UI with tool calling.
 * Returns streaming responses with interactive UI components.
 */

// Initialize OpenAI client with thesys C1 endpoint
const getC1Client = () => {
  const apiKey = process.env.THESYS_API_KEY;
  if (!apiKey) {
    throw new Error("THESYS_API_KEY not configured");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://api.thesys.dev/v1/embed",
  });
};

// System prompt for congressional assistant with C1 generative UI - Optimized for Journalists
const systemPrompt = `You are Hakivo, a powerful AI assistant for civic journalists and researchers investigating congressional legislation, voting patterns, and money in politics.

## Your Identity
- Name: Hakivo
- Role: Congressional Research AI with Generative UI capabilities
- Tone: Professional, precise, fact-based, investigative
- Primary Users: Journalists, researchers, civic watchdogs

## Current Congressional Session
The current Congress is the **119th Congress** (January 2025 - January 2027).
- ALWAYS use congress=119 for current legislation unless user specifies otherwise

## Core Journalist Capabilities

### 1. Bill Intelligence
- Search, compare, and analyze legislation
- Track bill status through the legislative process
- Explain complex provisions in plain language
- Compare House vs Senate versions

### 2. Voting Pattern Analysis
- Legislator voting records and party-line deviations
- Geographic and demographic voting patterns
- Historical voting trends on issues
- Cross-party coalition identification

### 3. Money & Influence Tracking
- Campaign finance connections to votes
- Lobbying activity on specific bills
- PAC and donor analysis
- Conflict of interest indicators

### 4. Source & Citation
- Link directly to Congress.gov, OpenStates, FEC
- Congressional Record quotes with attribution
- Committee hearing transcripts
- Official legislator statements

### 5. Real-Time Intelligence
- Breaking legislative news
- Bill movement alerts
- Committee activity
- Floor vote schedules

## C1 Generative UI Rules

You MUST use these specific C1 components based on data type:

### Data Visualization Components:
- **Bar Chart**: For vote counts (Yea/Nay by party), bill counts by category
- **Pie Chart**: For party breakdowns, vote distribution percentages
- **Line Chart**: For trends over time (voting patterns, bill activity)
- **Area Chart**: For cumulative legislative activity over time

### Display Components:
- **Cards**: For individual bills, legislators, news items - with title, subtitle, image, badges
- **Tables**: For structured data - voting records, bill comparisons, legislator lists
- **Steps**: For legislative process flow (Introduced → Committee → Floor → Signed)
- **Accordions**: For expandable bill sections, detailed provisions
- **Carousels**: For multiple related bills or legislators
- **Tag blocks**: For bill status badges, party affiliation, policy areas
- **List blocks**: For bullet points of key provisions or findings

### Trigger Components:
- **Buttons**: "Track Bill", "Export Data", "See Full Record", "Compare"
- **Follow-up prompts**: Suggest related queries the journalist might ask

## Component Usage Rules

1. **Voting Data** → Use Bar Chart (party breakdown) + Table (individual votes)
2. **Bill Status** → Use Steps component (legislative progress) + Card (summary)
3. **Multiple Bills** → Use Carousel (overview) or Table (comparison)
4. **Legislator Profile** → Use Card (bio) + Bar Chart (voting record) + Table (sponsored bills)
5. **Timeline/History** → Use Steps or Line Chart
6. **News/Updates** → Use Cards in a list layout
7. **Source Citations** → Use Cards with links or Accordion for expandable sources
8. **Numeric Comparisons** → Use appropriate Chart type (Bar, Pie, Line)

## Layout Guidelines

- Lead with the most important visual (chart or key card)
- Group related components logically
- Include action buttons for next steps
- Always end with suggested follow-up queries
- Keep text concise; let components tell the story

## Response Guidelines for Journalists

1. **Lead with Data**: Start with the most newsworthy facts
2. **Cite Everything**: Every claim needs a source link
3. **Visual First**: Use UI components over paragraphs when data is involved
4. **Highlight Anomalies**: Flag party-line breaks, unusual coalitions, funding connections
5. **Suggest Story Angles**: Offer follow-up investigation directions
6. **Enable Export**: Always offer downloadable data when showing tables
7. **Time Context**: Note recency of data, upcoming deadlines, expiring legislation

## Sample Interaction Patterns

**User asks about a bill:**
→ Show Bill Card + Status Timeline + Sponsor Info + Related Bills + News Context

**User asks about voting patterns:**
→ Show Vote Breakdown Chart + Party Analysis + Notable Deviations Table + Historical Comparison

**User asks for comparison:**
→ Show Side-by-Side Comparison Table + Key Differences Highlighted + Both Bill Timelines

**User asks about a legislator:**
→ Show Profile Card + Voting Record Chart + Key Bills Sponsored + Committee Assignments + Funding Sources

**User asks for investigation help:**
→ Show Connection Map + Source Cards + Data Export Button + Suggested Follow-up Queries`;

// Tool definitions for C1
const BILLS_API = process.env.NEXT_PUBLIC_BILLS_API_URL ||
  "https://svc-01ka8k5e6tr0kgy0jkzj9m4q16.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_bills",
      description: "Search for federal bills by keywords, policy area, or sponsor. Use congress=119 for current Congress.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keywords for bills" },
          congress: { type: "number", description: "Congress number (119 for current)" },
          limit: { type: "number", description: "Maximum results to return" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_bill_details",
      description: "Get detailed information about a specific bill including sponsors, cosponsors, actions, and full text.",
      parameters: {
        type: "object",
        properties: {
          congress: { type: "number", description: "Congress number (e.g., 119)" },
          billType: { type: "string", description: "Bill type: hr, s, hjres, sjres, hconres, sconres, hres, sres" },
          billNumber: { type: "number", description: "Bill number" },
        },
        required: ["congress", "billType", "billNumber"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_news",
      description: "Search for breaking news and current reporting on legislation, representatives, votes, or political topics. Provides citations.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query for news" },
          recency: { type: "string", enum: ["day", "week", "month"], description: "How recent (day=breaking, week=current, month=background)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_bill_statistics",
      description: "Get aggregate statistics about bills in Congress - counts by type, status, policy area, party of sponsor.",
      parameters: {
        type: "object",
        properties: {
          congress: { type: "number", description: "Congress number (119 for current)" },
          groupBy: { type: "string", enum: ["bill_type", "status", "policy_area", "sponsor_party"], description: "How to group statistics" },
        },
        required: ["congress", "groupBy"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_bills",
      description: "Compare two or more bills side by side - sponsors, status, key provisions, cosponsors.",
      parameters: {
        type: "object",
        properties: {
          bills: {
            type: "array",
            items: {
              type: "object",
              properties: {
                congress: { type: "number" },
                billType: { type: "string" },
                billNumber: { type: "number" },
              },
              required: ["congress", "billType", "billNumber"],
            },
            description: "Array of bills to compare",
          },
        },
        required: ["bills"],
      },
    },
  },
];

// Execute tool calls
async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "search_bills": {
        const { query, congress = 119, limit = 5 } = args as { query: string; congress?: number; limit?: number };
        const response = await fetch(`${BILLS_API}/bills/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, congress, limit }),
        });
        if (!response.ok) throw new Error(`Bills API error: ${response.status}`);
        return JSON.stringify(await response.json());
      }
      case "get_bill_details": {
        const { congress, billType, billNumber } = args as { congress: number; billType: string; billNumber: number };
        const response = await fetch(`${BILLS_API}/bills/${congress}/${billType}/${billNumber}`);
        if (!response.ok) throw new Error(`Bill not found: ${congress}-${billType}-${billNumber}`);
        return JSON.stringify(await response.json());
      }
      case "search_news": {
        const { query, recency = "week" } = args as { query: string; recency?: string };
        const apiKey = process.env.PERPLEXITY_API_KEY;
        if (!apiKey) {
          return JSON.stringify({ error: "Perplexity API key not configured" });
        }
        const response = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "sonar",
            messages: [
              { role: "system", content: `You are a congressional news researcher. Find recent news from the past ${recency} about the query. Focus on: legislative activity, votes, statements by legislators, policy developments. Provide source citations.` },
              { role: "user", content: query },
            ],
            max_tokens: 1500,
            return_citations: true,
            search_recency_filter: recency,
          }),
        });
        if (!response.ok) throw new Error(`Perplexity error: ${response.status}`);
        return JSON.stringify(await response.json());
      }
      case "get_bill_statistics": {
        const { congress = 119, groupBy } = args as { congress?: number; groupBy: string };
        // Query the bills database for statistics
        const response = await fetch(`${BILLS_API}/api/database/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `SELECT ${groupBy}, COUNT(*) as count FROM bills WHERE congress = ${congress} GROUP BY ${groupBy} ORDER BY count DESC LIMIT 20`,
          }),
        });
        if (!response.ok) throw new Error(`Statistics API error: ${response.status}`);
        return JSON.stringify(await response.json());
      }
      case "compare_bills": {
        const { bills } = args as { bills: Array<{ congress: number; billType: string; billNumber: number }> };
        // Fetch details for each bill and return comparison
        const billDetails = await Promise.all(
          bills.map(async (bill) => {
            try {
              const response = await fetch(`${BILLS_API}/bills/${bill.congress}/${bill.billType}/${bill.billNumber}`);
              if (!response.ok) return { error: `Bill not found: ${bill.congress}-${bill.billType}-${bill.billNumber}` };
              return await response.json();
            } catch {
              return { error: `Failed to fetch bill: ${bill.congress}-${bill.billType}-${bill.billNumber}` };
            }
          })
        );
        return JSON.stringify({ comparison: billDetails });
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    return JSON.stringify({ error: error instanceof Error ? error.message : "Tool execution failed" });
  }
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const client = getC1Client();

    // Build conversation with system prompt
    const conversationMessages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
    ];

    // Initial request with tools
    let response = await client.chat.completions.create({
      model: "c1/anthropic/claude-sonnet-4/v-20250617",
      messages: conversationMessages,
      tools,
      stream: false, // Need non-streaming for tool calling loop
    });

    // Handle tool calls in a loop
    while (response.choices[0]?.message?.tool_calls?.length) {
      const toolCalls = response.choices[0].message.tool_calls;

      // Add assistant message with tool calls
      conversationMessages.push({
        role: "assistant",
        content: response.choices[0].message.content || "",
        tool_calls: toolCalls,
      });

      // Execute each tool call and add results
      for (const toolCall of toolCalls) {
        if (toolCall.type !== "function") continue;
        const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        const result = await executeTool(toolCall.function.name, args);

        conversationMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // Continue conversation with tool results
      response = await client.chat.completions.create({
        model: "c1/anthropic/claude-sonnet-4/v-20250617",
        messages: conversationMessages,
        tools,
        stream: false,
      });
    }

    // Get final response and stream it
    const finalContent = response.choices[0]?.message?.content || "";

    // Stream the final response as SSE
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        // Send the content in chunks for a streaming feel
        const chunkSize = 50;
        for (let i = 0; i < finalContent.length; i += chunkSize) {
          const chunk = finalContent.slice(i, i + chunkSize);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
          );
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
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
