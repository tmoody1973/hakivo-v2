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

// System prompt for congressional assistant with C1 generative UI - Multi-persona
const systemPrompt = `You are Hakivo, a powerful AI assistant that makes civic engagement accessible and impactful for everyone.

## Your Identity
- Name: Hakivo
- Role: Congressional Intelligence AI with Generative UI capabilities
- Tone: Adapt to user - professional for journalists, engaging for teachers, friendly for citizens
- Mission: Empower democracy through information access

## Your Three Primary Audiences

### 🎤 Journalists & Researchers
- Need: Investigation support, data analysis, source verification
- Approach: Data-first, citations required, highlight anomalies and story angles
- Output: Charts, tables, source cards, exportable data

### 📚 Civics Teachers & Educators
- Need: Lesson planning, real-world examples, student engagement
- Approach: Educational, step-by-step explanations, make abstract concepts concrete
- Output: Steps diagrams, comparison tables, vocabulary cards, quiz suggestions

### 🗳️ Engaged Citizens
- Need: Personal relevance, action paths, understanding representatives
- Approach: Plain language, focus on "how does this affect me?", empower action
- Output: Action buttons, representative contacts, personalized alerts, simple summaries

## Persona Detection
Detect user type from their questions:
- "investigation", "voting patterns", "compare", "sources" → Journalist mode
- "explain to students", "lesson", "teach", "how does X work" → Teacher mode
- "my representative", "what can I do", "affects me", "how do I" → Citizen mode
- Default to friendly citizen mode if unclear

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

## Response Guidelines By Persona

### For Journalists:
1. **Lead with Data**: Most newsworthy facts first
2. **Cite Everything**: Every claim needs Congress.gov, OpenStates, or news source
3. **Visual First**: Charts and tables over paragraphs
4. **Highlight Anomalies**: Party-line breaks, unusual votes, funding connections
5. **Story Angles**: End with "Potential story angles:" suggestions
6. **Enable Export**: Always offer CSV/data download

### For Teachers:
1. **Start with Context**: "Here's how this connects to civics..."
2. **Use Steps**: Show processes like "How a Bill Becomes Law" with real examples
3. **Define Terms**: Explain jargon in parentheses (e.g., "cloture (a vote to end debate)")
4. **Real Examples**: Use current bills to illustrate abstract concepts
5. **Discussion Questions**: Suggest "Questions for class discussion:"
6. **Activity Ideas**: Offer "Student activity:" suggestions

### For Citizens:
1. **Personal Relevance**: Start with "Here's how this affects you..."
2. **Plain Language**: No jargon, simple explanations
3. **Action Buttons**: "Track This Bill", "Contact Your Rep", "Get Alerts"
4. **Your Representatives**: Include their stance if relevant
5. **Simple Next Steps**: Clear actions they can take
6. **Timeline**: When things will happen and deadlines

## Interaction Patterns

**"What's happening with [topic]?"** (Citizen)
→ News summary + Top 3 current bills + "How it affects you" + Action buttons

**"Explain how [process] works"** (Teacher)
→ Steps diagram + Real bill example + Vocabulary + Discussion questions

**"Compare [bill A] to [bill B]"** (Journalist)
→ Comparison table + Key differences + Sponsor analysis + Vote predictions

**"How did my representative vote?"** (Citizen)
→ Vote card + Comparison to party + Their statement + Contact button

**"I need to teach about [topic]"** (Teacher)
→ Concept explanation + Real examples + Lesson plan outline + Resources

**"Investigate [topic]"** (Journalist)
→ Data visualization + Source cards + Anomaly flags + Export options`;

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
  {
    type: "function",
    function: {
      name: "explain_civics_concept",
      description: "Explain a civics concept (like 'how a bill becomes law', 'filibuster', 'veto override') using a real current bill as an example. Great for teachers.",
      parameters: {
        type: "object",
        properties: {
          concept: { type: "string", description: "The civics concept to explain (e.g., 'filibuster', 'committee markup', 'reconciliation')" },
          exampleBillQuery: { type: "string", description: "Optional search query to find a relevant bill example" },
        },
        required: ["concept"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_civic_action_guide",
      description: "Get a guide for citizens on how to take action on a bill or issue - contact info, talking points, timeline.",
      parameters: {
        type: "object",
        properties: {
          issue: { type: "string", description: "The issue or bill the citizen wants to act on" },
          action_type: { type: "string", enum: ["support", "oppose", "learn_more"], description: "What action they want to take" },
          state: { type: "string", description: "Optional: User's state for representative lookup" },
        },
        required: ["issue"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "semantic_search",
      description: "Search bill text using natural language (meaning-based, not just keyword). Great for finding bills about specific topics even when exact words don't match.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Natural language description of what you're looking for (e.g., 'legislation protecting endangered species')" },
          congress: { type: "number", description: "Filter by Congress number (119 for current)" },
          limit: { type: "number", description: "Max results (default 10)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_state_bills",
      description: "Search state-level legislation. Requires a state code (e.g., 'CA', 'TX', 'NY').",
      parameters: {
        type: "object",
        properties: {
          state: { type: "string", description: "Two-letter state code (e.g., 'CA', 'TX')" },
          query: { type: "string", description: "Search keywords" },
          subject: { type: "string", description: "Policy area filter (optional)" },
        },
        required: ["state"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_members",
      description: "Search for congressional members (representatives and senators) by state, party, or name.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Name search" },
          state: { type: "string", description: "Two-letter state code" },
          party: { type: "string", enum: ["D", "R", "I"], description: "Party filter" },
          chamber: { type: "string", enum: ["house", "senate"], description: "Chamber filter" },
        },
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

        // Try Perplexity first
        const perplexityKey = process.env.PERPLEXITY_API_KEY;
        if (perplexityKey) {
          const response = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${perplexityKey}`,
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
          if (response.ok) {
            return JSON.stringify(await response.json());
          }
        }

        // Fallback to Exa for web search
        const exaKey = process.env.EXA_API_KEY;
        if (exaKey) {
          // Calculate date range based on recency
          const now = new Date();
          const startDate = new Date();
          if (recency === "day") startDate.setDate(now.getDate() - 1);
          else if (recency === "week") startDate.setDate(now.getDate() - 7);
          else startDate.setMonth(now.getMonth() - 1);

          const response = await fetch("https://api.exa.ai/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": exaKey,
            },
            body: JSON.stringify({
              query: `${query} congress legislation news`,
              type: "neural",
              useAutoprompt: true,
              numResults: 10,
              startPublishedDate: startDate.toISOString().split("T")[0],
              contents: {
                text: { maxCharacters: 1000 },
                highlights: { numSentences: 3 },
              },
            }),
          });
          if (response.ok) {
            const data = await response.json();
            // Transform to news format
            const news = data.results?.map((r: { title?: string; url?: string; publishedDate?: string; text?: string; highlights?: string[] }) => ({
              title: r.title,
              url: r.url,
              publishedDate: r.publishedDate,
              summary: r.text?.substring(0, 500),
              highlights: r.highlights,
            })) || [];
            return JSON.stringify({ source: "exa", news, query });
          }
        }

        return JSON.stringify({ error: "No web search API configured. Please add PERPLEXITY_API_KEY or EXA_API_KEY to environment variables.", query });
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
      case "explain_civics_concept": {
        const { concept, exampleBillQuery } = args as { concept: string; exampleBillQuery?: string };
        // Build educational content about the concept
        const civicsDefinitions: Record<string, string> = {
          "filibuster": "A filibuster is a tactic used in the Senate to delay or block a vote by extending debate. It requires 60 votes (cloture) to end.",
          "veto": "A veto is the President's power to reject a bill passed by Congress. Congress can override with a 2/3 vote in both chambers.",
          "committee markup": "A markup session is when a congressional committee reviews, amends, and votes on a bill before sending it to the full chamber.",
          "reconciliation": "Budget reconciliation is a special process that allows certain tax and spending bills to pass the Senate with only 51 votes instead of 60.",
          "cloture": "Cloture is a procedure to end debate in the Senate. It requires 60 votes and is used to overcome filibusters.",
          "conference committee": "A conference committee reconciles differences between House and Senate versions of a bill before final passage.",
          "how a bill becomes law": "1. Introduction → 2. Committee Review → 3. Floor Debate → 4. Vote in Both Chambers → 5. Conference (if needed) → 6. President Signs or Vetoes",
        };

        let result: { concept: string; definition: string; exampleBill?: unknown } = {
          concept,
          definition: civicsDefinitions[concept.toLowerCase()] || `The concept "${concept}" refers to an important part of the legislative process. Ask for more details!`,
        };

        // Find example bill if requested
        if (exampleBillQuery) {
          try {
            const billResponse = await fetch(`${BILLS_API}/bills/search`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: exampleBillQuery, congress: 119, limit: 1 }),
            });
            if (billResponse.ok) {
              const billData = await billResponse.json();
              if (billData.bills?.length > 0) {
                result.exampleBill = billData.bills[0];
              }
            }
          } catch {
            // Ignore errors, example is optional
          }
        }

        return JSON.stringify(result);
      }
      case "get_civic_action_guide": {
        const { issue, action_type = "learn_more" } = args as { issue: string; action_type?: string; state?: string };

        // Search for relevant bills
        let relevantBills: unknown[] = [];
        try {
          const billResponse = await fetch(`${BILLS_API}/bills/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: issue, congress: 119, limit: 3 }),
          });
          if (billResponse.ok) {
            const billData = await billResponse.json();
            relevantBills = billData.bills || [];
          }
        } catch {
          // Continue without bills
        }

        // Build action guide
        const actionGuide = {
          issue,
          action_type,
          relevantBills,
          actions: {
            contact_representatives: {
              description: "Contact your senators and representative",
              tips: [
                "Be specific about the bill number if known",
                "Share a personal story about how this affects you",
                "Be respectful and concise",
                "Ask for a response",
              ],
            },
            track_legislation: {
              description: "Stay informed about legislative progress",
              tips: [
                "Sign up for bill alerts",
                "Follow committee hearings",
                "Check for upcoming votes",
              ],
            },
            spread_awareness: {
              description: "Help others understand the issue",
              tips: [
                "Share factual information with sources",
                "Discuss with neighbors and community",
                "Write letters to local newspapers",
              ],
            },
          },
          resources: [
            { name: "Congress.gov", url: "https://congress.gov", description: "Official source for bill text and status" },
            { name: "GovTrack", url: "https://govtrack.us", description: "Track bills and representatives" },
          ],
        };

        return JSON.stringify(actionGuide);
      }
      case "semantic_search": {
        const { query, congress = 119, limit = 10 } = args as { query: string; congress?: number; limit?: number };
        // Use the SmartBucket semantic search endpoint
        const response = await fetch(`${BILLS_API}/bills/semantic-search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, congress, limit }),
        });
        if (!response.ok) {
          // Fallback to regular search if semantic search not available
          const fallbackResponse = await fetch(`${BILLS_API}/bills/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, congress, limit }),
          });
          if (!fallbackResponse.ok) throw new Error(`Search API error: ${fallbackResponse.status}`);
          return JSON.stringify(await fallbackResponse.json());
        }
        return JSON.stringify(await response.json());
      }
      case "search_state_bills": {
        const { state, query, subject } = args as { state: string; query?: string; subject?: string };
        // Use OpenStates API for state legislation
        const apiKey = process.env.OPENSTATES_API_KEY;
        if (!apiKey) {
          return JSON.stringify({ error: "OpenStates API key not configured", state, message: "State bill search unavailable" });
        }

        // Build GraphQL query for OpenStates
        const graphqlQuery = `
          query {
            bills(first: 10, jurisdiction: "${state.toLowerCase()}"${query ? `, searchQuery: "${query}"` : ""}${subject ? `, subject: "${subject}"` : ""}) {
              edges {
                node {
                  id
                  identifier
                  title
                  classification
                  latestActionDate
                  latestActionDescription
                  openstatesUrl
                  legislativeSession {
                    identifier
                  }
                  fromOrganization {
                    name
                  }
                }
              }
            }
          }
        `;

        const response = await fetch("https://openstates.org/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": apiKey,
          },
          body: JSON.stringify({ query: graphqlQuery }),
        });

        if (!response.ok) throw new Error(`OpenStates API error: ${response.status}`);
        const data = await response.json();

        // Transform response
        const bills = data.data?.bills?.edges?.map((edge: { node: {
          identifier: string;
          title: string;
          classification: string[];
          latestActionDate: string;
          latestActionDescription: string;
          openstatesUrl: string;
          legislativeSession: { identifier: string };
          fromOrganization: { name: string };
        } }) => ({
          identifier: edge.node.identifier,
          title: edge.node.title,
          classification: edge.node.classification,
          latestAction: {
            date: edge.node.latestActionDate,
            description: edge.node.latestActionDescription,
          },
          url: edge.node.openstatesUrl,
          session: edge.node.legislativeSession?.identifier,
          chamber: edge.node.fromOrganization?.name,
        })) || [];

        return JSON.stringify({ state, bills, count: bills.length });
      }
      case "search_members": {
        const { query, state, party, chamber } = args as { query?: string; state?: string; party?: string; chamber?: string };

        // Build SQL query for member search
        let sqlQuery = "SELECT * FROM members WHERE 1=1";
        const conditions: string[] = [];

        if (query) conditions.push(`(name ILIKE '%${query}%' OR last_name ILIKE '%${query}%')`);
        if (state) conditions.push(`state = '${state.toUpperCase()}'`);
        if (party) conditions.push(`party_code = '${party.toUpperCase()}'`);
        if (chamber) conditions.push(`chamber = '${chamber.toLowerCase()}'`);

        if (conditions.length > 0) {
          sqlQuery += " AND " + conditions.join(" AND ");
        }
        sqlQuery += " LIMIT 20";

        const response = await fetch(`${BILLS_API}/api/database/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: sqlQuery }),
        });

        if (!response.ok) throw new Error(`Members search error: ${response.status}`);
        return JSON.stringify(await response.json());
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
  const encoder = new TextEncoder();

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

    // Create streaming response
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Helper to send SSE messages
          const send = (content: string) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
          };

          // Initial request with tools
          let response = await client.chat.completions.create({
            model: "c1/anthropic/claude-sonnet-4/v-20250617",
            messages: conversationMessages,
            tools,
            stream: false,
          });

          // Handle tool calls with progress feedback
          let toolCallCount = 0;
          while (response.choices[0]?.message?.tool_calls?.length) {
            const toolCalls = response.choices[0].message.tool_calls;
            toolCallCount++;

            // Add assistant message with tool calls
            conversationMessages.push({
              role: "assistant",
              content: response.choices[0].message.content || "",
              tool_calls: toolCalls,
            });

            // Execute each tool call with progress updates
            for (const toolCall of toolCalls) {
              if (toolCall.type !== "function") continue;

              // Send progress update to user
              const toolName = toolCall.function.name;
              const progressMessages: Record<string, string> = {
                search_bills: "🔍 Searching congressional bills...\n\n",
                get_bill_details: "📜 Fetching bill details...\n\n",
                search_news: "📰 Searching recent news coverage...\n\n",
                get_bill_statistics: "📊 Analyzing bill statistics...\n\n",
                compare_bills: "⚖️ Comparing legislation...\n\n",
                explain_civics_concept: "📚 Preparing educational content...\n\n",
                get_civic_action_guide: "🗳️ Building your action guide...\n\n",
                semantic_search: "🧠 Searching bill text semantically...\n\n",
                search_state_bills: "🏛️ Searching state legislation...\n\n",
                search_members: "👤 Looking up congressional members...\n\n",
              };
              if (toolCallCount === 1 && progressMessages[toolName]) {
                send(progressMessages[toolName]);
              }

              const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
              const result = await executeTool(toolName, args);

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

          // Stream the final response
          const finalContent = response.choices[0]?.message?.content || "";
          if (finalContent) {
            // Stream in larger chunks for better C1 component rendering
            const chunkSize = 100;
            for (let i = 0; i < finalContent.length; i += chunkSize) {
              const chunk = finalContent.slice(i, i + chunkSize);
              send(chunk);
              // Small delay for smoother streaming effect
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error("[C1 API] Stream error:", error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`)
          );
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        }
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
