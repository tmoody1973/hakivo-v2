# Hakivo Congressional Assistant - thesys.dev Generative UI Implementation Guide

## Table of Contents

1. [What is thesys.dev C1?](#what-is-thesysdev-c1)
2. [Architecture Overview](#architecture-overview)
3. [Project Setup](#project-setup)
4. [Backend Integration with Mastra](#backend-integration-with-mastra)
5. [Frontend React SDK Setup](#frontend-react-sdk-setup)
6. [Creating Custom UI Components for Legislative Data](#creating-custom-ui-components)
7. [System Prompts for Consistent UI Generation](#system-prompts)
8. [Tool Calls and Actions](#tool-calls-and-actions)
9. [Streaming and Real-Time Updates](#streaming)
10. [Theming and Customization](#theming)
11. [Complete Working Example](#complete-example)
12. [Best Practices](#best-practices)

---

## 1. What is thesys.dev C1? <a name="what-is-thesysdev-c1"></a>

C1 by Thesys is the first production-ready **Generative UI API**. Instead of returning plain text like traditional LLM endpoints, C1 outputs structured UI components that render as live, interactive interfaces.

### Key Concepts

| Traditional LLM | C1 Generative UI |
|-----------------|------------------|
| Returns plain text or markdown | Returns UI specification (JSON/XML) |
| You manually build UI templates | UI is generated dynamically |
| Static, one-size-fits-all | Adaptive to each query and context |
| Manual maintenance of UI code | Self-maintaining, context-aware |

### What C1 Can Generate for Hakivo

- **Tables**: Voting records, bill lists, representative comparisons
- **Cards**: Bill summaries, representative profiles
- **Charts**: Voting patterns over time, bill progress visualization
- **Forms**: Track bill, set location, notification preferences
- **Lists**: Search results, committee assignments
- **Interactive Buttons**: "Generate Audio Briefing", "Track This Bill"

### How It Works

```
User Query: "Show me how my senators voted on the infrastructure bill"
     ↓
Mastra Agent (processes query, calls Congress.gov API)
     ↓
C1 API (receives data + context, generates UI spec)
     ↓
React SDK (renders interactive voting table with charts)
     ↓
User sees: Sortable table + voting breakdown chart + action buttons
```

---

## 2. Architecture Overview <a name="architecture-overview"></a>

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  @thesysai/genui-sdk                                      │  │
│  │  ├── <C1Chat />        - Full chat interface              │  │
│  │  ├── <C1Component />   - Single response renderer         │  │
│  │  └── <ThemeProvider /> - Styling and theming              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              │ HTTP Stream                       │
│                              ↓                                   │
├─────────────────────────────────────────────────────────────────┤
│                        BACKEND (Next.js API)                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  /api/chat                                                │  │
│  │  ├── Receives user message                                │  │
│  │  ├── Calls Mastra Agent (tool execution)                  │  │
│  │  ├── Forwards to C1 API (UI generation)                   │  │
│  │  └── Streams response back to frontend                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ↓                                   │
├─────────────────────────────────────────────────────────────────┤
│                     MASTRA AGENT LAYER                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Congressional Assistant Agent                            │  │
│  │  ├── Congress.gov Tools   → Bill data, votes              │  │
│  │  ├── Raindrop Tools       → SmartSQL, SmartBucket, Memory │  │
│  │  ├── Tavily Tools         → News context                  │  │
│  │  └── Audio Tools          → ElevenLabs briefings          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ↓                                   │
├─────────────────────────────────────────────────────────────────┤
│                        C1 API (thesys.dev)                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Endpoint: https://api.thesys.dev/v1/embed                │  │
│  │  ├── Receives: messages[] + system prompt + tool results  │  │
│  │  ├── Generates: UI specification (streaming)              │  │
│  │  └── Returns: Interactive components ready for rendering  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Project Setup <a name="project-setup"></a>

### 3.1 Install Dependencies

```bash
# Create Next.js project (if not already done)
npx create-next-app@latest hakivo-chat --typescript --tailwind --app

cd hakivo-chat

# Install thesys.dev SDK packages
npm install @thesysai/genui-sdk @crayonai/react-ui

# Install OpenAI client (C1 uses OpenAI-compatible API)
npm install openai

# Install Mastra (agent framework)
npm install @mastra/core @ai-sdk/anthropic

# Other dependencies
npm install zod axios
```

### 3.2 Environment Variables

Create `.env.local`:

```env
# Thesys C1 API
THESYS_API_KEY=your_thesys_api_key

# Anthropic (for Mastra agent)
ANTHROPIC_API_KEY=your_anthropic_key

# Raindrop
RAINDROP_API_KEY=your_raindrop_key
RAINDROP_APP_NAME=hakivo
RAINDROP_VERSION=1.0.0

# Congress.gov
CONGRESS_GOV_API_KEY=your_congress_api_key

# Tavily
TAVILY_API_KEY=your_tavily_key

# ElevenLabs
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id
```

### 3.3 Project Structure

```
hakivo-chat/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/
│   │   │       ├── route.ts           # Main chat API endpoint
│   │   │       ├── messageStore.ts    # Conversation history
│   │   │       └── systemPrompt.ts    # C1 system prompt
│   │   ├── layout.tsx
│   │   └── page.tsx                   # Main chat page
│   ├── components/
│   │   ├── HakivoChat.tsx             # Main chat component
│   │   └── custom/                    # Custom C1 components
│   │       ├── BillCard.tsx
│   │       ├── VotingTable.tsx
│   │       ├── RepresentativeProfile.tsx
│   │       └── AudioBriefingPlayer.tsx
│   ├── mastra/
│   │   ├── agents/
│   │   │   └── congressional-assistant.ts
│   │   ├── tools/
│   │   │   ├── congress-gov.ts
│   │   │   ├── raindrop.ts
│   │   │   └── tavily.ts
│   │   └── index.ts
│   └── lib/
│       └── c1-client.ts               # C1 API client
├── .env.local
├── package.json
└── tailwind.config.ts
```

---

## 4. Backend Integration with Mastra <a name="backend-integration-with-mastra"></a>

### 4.1 C1 Client Setup

Create `src/lib/c1-client.ts`:

```typescript
import OpenAI from "openai";

// C1 uses OpenAI-compatible API
export const c1Client = new OpenAI({
  apiKey: process.env.THESYS_API_KEY,
  baseURL: "https://api.thesys.dev/v1/embed",
});

// Available C1 models
export const C1_MODELS = {
  // Use the model that best fits your needs
  // Check https://docs.thesys.dev/guides/models-pricing for current options
  DEFAULT: "c1-nightly",
  CLAUDE_SONNET: "claude-sonnet-4-20250514",
  GPT4O: "gpt-4o",
} as const;
```

### 4.2 Message Store (Conversation History)

Create `src/app/api/chat/messageStore.ts`:

```typescript
import OpenAI from "openai";
import { congressionalSystemPrompt } from "./systemPrompt";

export type DBMessage = OpenAI.Chat.ChatCompletionMessageParam & {
  id?: string;
};

// In-memory store (use Redis/DB in production)
const messagesStore: {
  [threadId: string]: DBMessage[];
} = {};

export function getMessageStore(threadId: string) {
  // Initialize with system prompt if new thread
  if (!messagesStore[threadId]) {
    messagesStore[threadId] = [
      {
        role: "system",
        content: congressionalSystemPrompt,
      },
    ];
  }

  return {
    getMessages: () => messagesStore[threadId],
    
    addMessage: (message: DBMessage) => {
      messagesStore[threadId].push(message);
    },
    
    addMessages: (messages: DBMessage[]) => {
      messagesStore[threadId].push(...messages);
    },
    
    clear: () => {
      messagesStore[threadId] = [
        {
          role: "system",
          content: congressionalSystemPrompt,
        },
      ];
    },
  };
}
```

### 4.3 System Prompt for C1 UI Generation

Create `src/app/api/chat/systemPrompt.ts`:

```typescript
export const congressionalSystemPrompt = `You are Hakivo, an intelligent, non-partisan congressional assistant that helps citizens understand and engage with their government.

## Your Identity
- Name: Hakivo
- Role: Congressional Assistant
- Tone: Professional, accessible, non-partisan, helpful

## Core Capabilities
1. **Bill Information**: Look up and explain bills in plain language
2. **Representative Lookup**: Find representatives by location, show voting records
3. **Vote Tracking**: Display how representatives voted on specific bills
4. **Legislative Status**: Track where bills are in the process
5. **News Context**: Provide current news around legislation
6. **Audio Briefings**: Generate NPR-style audio summaries

## UI Generation Guidelines

### When to Use Tables
- Voting records (Representative | Party | Vote | Date)
- Bill search results (Bill # | Title | Status | Sponsor)
- Committee membership lists
- Comparison of positions between representatives

### When to Use Cards
- Single bill summaries (title, status, key points, sponsor)
- Representative profiles (name, party, contact, photo placeholder)
- News article summaries

### When to Use Charts
- Voting patterns over time (line chart)
- Party breakdown of votes (pie chart)
- Bill progress through chambers (progress/funnel)
- Representative voting alignment (bar chart)

### When to Use Lists
- Recent actions on a bill
- Committee assignments
- Cosponsors list
- Related bills

### When to Use Forms
- Set user location (state, district inputs)
- Track a bill (checkbox + bill selector)
- Set notification preferences
- Request audio briefing options

### Interactive Elements
Always include actionable buttons where appropriate:
- "Track This Bill" - adds bill to user's tracked list
- "Generate Audio Briefing" - creates audio summary
- "View Full Text" - links to Congress.gov
- "Contact Representative" - shows contact info
- "Compare Votes" - shows voting comparison

## Data Formatting Rules
1. Always cite bill numbers in official format: "H.R. 1234" or "S. 567"
2. Include dates in human-readable format: "March 15, 2024"
3. Show vote counts clearly: "Passed 234-201" or "Yea: 234 | Nay: 201 | Present: 0"
4. For percentages, round to one decimal: "78.5%"
5. Status should be clear: "In Committee", "Passed House", "Awaiting Senate Vote", "Signed into Law"

## Response Structure
For complex queries, structure your response as:
1. **Direct Answer** - Brief summary answering the question
2. **Visual Data** - Table, chart, or card with detailed information
3. **Context** - Relevant background or news
4. **Actions** - Buttons for follow-up actions

## User Context
The user may have set preferences stored in memory:
- Location (state, district) - use for "my representative" queries
- Tracked bills - highlight updates on these
- Policy interests - prioritize relevant information

## Important Rules
- Always be non-partisan and factual
- Cite sources when providing specific data
- Acknowledge when data might be outdated
- Offer to generate audio briefings for complex topics
- If unsure about something, say so and offer alternatives`;
```

### 4.4 Main Chat API Route

Create `src/app/api/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getMessageStore, DBMessage } from "./messageStore";
import { mastra } from "@/mastra";

// Initialize C1 client
const c1Client = new OpenAI({
  apiKey: process.env.THESYS_API_KEY,
  baseURL: "https://api.thesys.dev/v1/embed",
});

// Tool definitions for C1
const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "searchBills",
      description: "Search for bills in Congress by keyword, subject, or bill number",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query - keywords, bill number, or subject",
          },
          congress: {
            type: "number",
            description: "Congress number (e.g., 118). Defaults to current.",
          },
          limit: {
            type: "number",
            description: "Number of results to return (default: 10)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getBillDetails",
      description: "Get detailed information about a specific bill",
      parameters: {
        type: "object",
        properties: {
          billId: {
            type: "string",
            description: "Bill identifier like 'HR-118-1234' or 'S-118-567'",
          },
        },
        required: ["billId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getRepresentative",
      description: "Get information about a member of Congress",
      parameters: {
        type: "object",
        properties: {
          state: {
            type: "string",
            description: "Two-letter state code (e.g., 'WI')",
          },
          district: {
            type: "string",
            description: "District number for House members",
          },
          chamber: {
            type: "string",
            enum: ["house", "senate"],
            description: "Chamber of Congress",
          },
          name: {
            type: "string",
            description: "Name to search for",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getVotingRecord",
      description: "Get voting record for a representative on specific bills or topics",
      parameters: {
        type: "object",
        properties: {
          representativeId: {
            type: "string",
            description: "Bioguide ID of the representative",
          },
          billId: {
            type: "string",
            description: "Specific bill to check vote on",
          },
          topic: {
            type: "string",
            description: "Topic area to filter votes",
          },
        },
        required: ["representativeId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trackBill",
      description: "Add a bill to the user's tracked bills list",
      parameters: {
        type: "object",
        properties: {
          billId: {
            type: "string",
            description: "Bill ID to track",
          },
          userId: {
            type: "string",
            description: "User ID",
          },
        },
        required: ["billId", "userId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generateAudioBriefing",
      description: "Generate an NPR-style audio briefing about legislation",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "Topic or bill to create briefing about",
          },
          style: {
            type: "string",
            enum: ["brief", "standard", "detailed"],
            description: "Length of briefing",
          },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchNews",
      description: "Search for current news about legislation or representatives",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query",
          },
          maxResults: {
            type: "number",
            description: "Maximum results to return",
          },
        },
        required: ["query"],
      },
    },
  },
];

// Tool execution handler
async function executeTool(
  toolName: string,
  args: Record<string, any>
): Promise<string> {
  const agent = await mastra.getAgent("congressionalAssistant");
  
  switch (toolName) {
    case "searchBills": {
      const result = await agent.tools.searchBills.execute(args);
      return JSON.stringify(result);
    }
    case "getBillDetails": {
      const [type, congress, number] = args.billId.split("-");
      const result = await agent.tools.getBillDetails.execute({
        congress: parseInt(congress),
        billType: type.toLowerCase(),
        billNumber: parseInt(number),
      });
      return JSON.stringify(result);
    }
    case "getRepresentative": {
      const result = await agent.tools.getMemberInfo.execute(args);
      return JSON.stringify(result);
    }
    case "getVotingRecord": {
      const result = await agent.tools.getVotesByMember.execute(args);
      return JSON.stringify(result);
    }
    case "trackBill": {
      const result = await agent.tools.saveUserPreference.execute({
        userId: args.userId,
        preferenceType: "tracked_bill",
        value: args.billId,
      });
      return JSON.stringify({ success: true, message: `Now tracking ${args.billId}` });
    }
    case "generateAudioBriefing": {
      const result = await agent.tools.generateAudioBriefing.execute({
        title: `Briefing: ${args.topic}`,
        content: args.topic,
        style: args.style || "standard",
      });
      return JSON.stringify(result);
    }
    case "searchNews": {
      const result = await agent.tools.searchNews.execute(args);
      return JSON.stringify(result);
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, threadId, userId } = await req.json();

    // Get or create message store for this thread
    const messageStore = getMessageStore(threadId);
    
    // Add user message to history
    const userMessage: DBMessage = {
      role: "user",
      content: prompt,
      id: `user-${Date.now()}`,
    };
    messageStore.addMessage(userMessage);

    // Get all messages for context
    const messages = messageStore.getMessages();

    // Initial C1 API call
    let response = await c1Client.chat.completions.create({
      model: "c1-nightly", // or your preferred model
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      tools,
      stream: false, // First call without streaming to handle tool calls
    });

    let assistantMessage = response.choices[0].message;

    // Handle tool calls in a loop
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Add assistant message with tool calls to history
      messageStore.addMessage(assistantMessage as DBMessage);

      // Execute each tool call
      const toolResults: DBMessage[] = [];
      
      for (const toolCall of assistantMessage.tool_calls) {
        const toolResult = await executeTool(
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments)
        );

        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }

      // Add tool results to history
      messageStore.addMessages(toolResults);

      // Get next response from C1
      response = await c1Client.chat.completions.create({
        model: "c1-nightly",
        messages: messageStore.getMessages() as OpenAI.Chat.ChatCompletionMessageParam[],
        tools,
        stream: false,
      });

      assistantMessage = response.choices[0].message;
    }

    // Now stream the final response with UI generation
    const stream = await c1Client.chat.completions.create({
      model: "c1-nightly",
      messages: [
        ...messageStore.getMessages(),
        {
          role: "assistant",
          content: assistantMessage.content || "",
        },
      ] as OpenAI.Chat.ChatCompletionMessageParam[],
      stream: true,
    });

    // Add final assistant message to history
    messageStore.addMessage({
      role: "assistant",
      content: assistantMessage.content || "",
      id: `assistant-${Date.now()}`,
    });

    // Return streaming response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new NextResponse(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
```

---

## 5. Frontend React SDK Setup <a name="frontend-react-sdk-setup"></a>

### 5.1 Root Layout with CSS

Update `src/app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// IMPORTANT: Import Crayon UI styles
import "@crayonai/react-ui/styles/index.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hakivo - Congressional Assistant",
  description: "Your intelligent guide to Congress",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

### 5.2 Simple Chat Page with C1Chat

Create `src/app/page.tsx`:

```typescript
"use client";

import { C1Chat } from "@thesysai/genui-sdk";

export default function Home() {
  return (
    <main className="h-screen">
      <C1Chat
        apiUrl="/api/chat"
        theme={{
          mode: "light",
          colors: {
            primary: "#3B82F6", // Blue
            secondary: "#6366F1", // Indigo
          },
        }}
        placeholder="Ask about bills, representatives, or votes..."
        welcomeMessage="👋 Hi! I'm Hakivo, your congressional assistant. I can help you understand bills, find your representatives, check voting records, and generate audio briefings. What would you like to know?"
      />
    </main>
  );
}
```

### 5.3 Custom Chat Component (More Control)

Create `src/components/HakivoChat.tsx`:

```typescript
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { 
  C1Component, 
  ThemeProvider,
  useC1Actions 
} from "@thesysai/genui-sdk";
import "@crayonai/react-ui/styles/index.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface HakivoChatProps {
  userId?: string;
}

export function HakivoChat({ userId = "anonymous" }: HakivoChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [threadId] = useState(() => `thread-${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Create placeholder for assistant response
    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
      },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: input,
          threadId,
          userId,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;

        // Update the streaming message
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: fullContent }
              : msg
          )
        );
      }

      // Mark streaming as complete
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, isStreaming: false }
            : msg
        )
      );
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: "Sorry, I encountered an error. Please try again.",
                isStreaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, threadId, userId]);

  // Handle action callbacks from C1 components
  const handleAction = useCallback(async (action: { type: string; payload: any }) => {
    console.log("Action triggered:", action);
    
    switch (action.type) {
      case "trackBill":
        // Send to backend to track bill
        await fetch("/api/track-bill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            billId: action.payload.billId,
            userId,
          }),
        });
        // Trigger a confirmation message
        setInput(`I just tracked bill ${action.payload.billId}. Can you give me a summary?`);
        break;
        
      case "generateAudio":
        // Trigger audio briefing generation
        setInput(`Generate an audio briefing about ${action.payload.topic}`);
        break;
        
      case "viewFullText":
        // Open Congress.gov link
        window.open(action.payload.url, "_blank");
        break;
        
      default:
        console.log("Unknown action:", action.type);
    }
  }, [userId]);

  return (
    <ThemeProvider
      theme={{
        mode: "light",
        colors: {
          primary: "#2563EB",    // Blue-600
          secondary: "#4F46E5",  // Indigo-600
          background: "#FFFFFF",
          surface: "#F9FAFB",
          text: "#111827",
          textSecondary: "#6B7280",
          border: "#E5E7EB",
          success: "#10B981",
          warning: "#F59E0B",
          error: "#EF4444",
        },
        borderRadius: "0.5rem",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
          <div>
            <h1 className="text-2xl font-bold">Hakivo</h1>
            <p className="text-sm text-blue-100">Your Congressional Assistant</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setInput("What bills are being voted on this week?")}
              className="px-3 py-1.5 text-sm bg-white/20 rounded-full hover:bg-white/30 transition"
            >
              📋 This Week
            </button>
            <button
              onClick={() => setInput("Generate a daily legislative briefing")}
              className="px-3 py-1.5 text-sm bg-white/20 rounded-full hover:bg-white/30 transition"
            >
              🎧 Daily Briefing
            </button>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Welcome message */}
          {messages.length === 0 && (
            <div className="max-w-2xl mx-auto text-center py-12">
              <div className="text-6xl mb-4">🏛️</div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                Welcome to Hakivo
              </h2>
              <p className="text-gray-600 mb-6">
                Your intelligent guide to Congress. Ask about bills, find your
                representatives, check voting records, or get audio briefings.
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                {[
                  "Who are my representatives?",
                  "What is the CHIPS Act?",
                  "How did senators vote on infrastructure?",
                  "Track bills about healthcare",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="p-3 text-sm text-left bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-3xl ${
                  message.role === "user"
                    ? "bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-3"
                    : "bg-white rounded-2xl rounded-bl-md shadow-sm border border-gray-100 p-4"
                }`}
              >
                {message.role === "assistant" ? (
                  // Render C1 component for assistant messages
                  <C1Component
                    c1Response={message.content}
                    onAction={handleAction}
                    isStreaming={message.isStreaming}
                  />
                ) : (
                  // User message
                  <p>{message.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && messages[messages.length - 1]?.content === "" && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl rounded-bl-md shadow-sm border border-gray-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white p-4">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about bills, representatives, or votes..."
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isLoading ? "..." : "Send"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ThemeProvider>
  );
}
```

---

## 6. Creating Custom UI Components <a name="creating-custom-ui-components"></a>

### 6.1 Bill Card Component

Create `src/components/custom/BillCard.tsx`:

```typescript
import React from "react";

interface BillCardProps {
  billId: string;
  title: string;
  shortTitle?: string;
  status: string;
  sponsor: {
    name: string;
    party: string;
    state: string;
  };
  introducedDate: string;
  summary?: string;
  policyArea?: string;
  onTrack?: () => void;
  onViewFull?: () => void;
  onGenerateAudio?: () => void;
}

export function BillCard({
  billId,
  title,
  shortTitle,
  status,
  sponsor,
  introducedDate,
  summary,
  policyArea,
  onTrack,
  onViewFull,
  onGenerateAudio,
}: BillCardProps) {
  const statusColors: Record<string, string> = {
    introduced: "bg-gray-100 text-gray-800",
    in_committee: "bg-yellow-100 text-yellow-800",
    passed_house: "bg-blue-100 text-blue-800",
    passed_senate: "bg-indigo-100 text-indigo-800",
    passed_both: "bg-purple-100 text-purple-800",
    enacted: "bg-green-100 text-green-800",
    vetoed: "bg-red-100 text-red-800",
  };

  const partyColors: Record<string, string> = {
    D: "text-blue-600",
    R: "text-red-600",
    I: "text-purple-600",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-sm font-mono text-blue-600 font-semibold">
              {billId}
            </span>
            {policyArea && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                {policyArea}
              </span>
            )}
          </div>
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              statusColors[status.toLowerCase().replace(" ", "_")] ||
              statusColors.introduced
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1">
          {shortTitle || title}
        </h3>
        {shortTitle && title !== shortTitle && (
          <p className="text-sm text-gray-500 mb-2">{title}</p>
        )}

        {summary && (
          <p className="text-sm text-gray-600 mt-2 line-clamp-3">{summary}</p>
        )}

        {/* Sponsor Info */}
        <div className="mt-3 flex items-center text-sm">
          <span className="text-gray-500">Sponsor:</span>
          <span className={`ml-2 font-medium ${partyColors[sponsor.party] || ""}`}>
            {sponsor.name} ({sponsor.party}-{sponsor.state})
          </span>
        </div>

        <div className="text-sm text-gray-500 mt-1">
          Introduced: {new Date(introducedDate).toLocaleDateString()}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
        <button
          onClick={onTrack}
          className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
        >
          📌 Track Bill
        </button>
        <button
          onClick={onGenerateAudio}
          className="flex-1 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition"
        >
          🎧 Audio Summary
        </button>
        <button
          onClick={onViewFull}
          className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
        >
          ↗️
        </button>
      </div>
    </div>
  );
}
```

### 6.2 Voting Table Component

Create `src/components/custom/VotingTable.tsx`:

```typescript
import React, { useState } from "react";

interface VoteRecord {
  representative: {
    name: string;
    party: string;
    state: string;
    district?: string;
  };
  vote: "yea" | "nay" | "present" | "not_voting";
  date: string;
}

interface VotingTableProps {
  title: string;
  billId: string;
  chamber: "house" | "senate";
  result: string;
  votes: VoteRecord[];
  summary?: {
    yea: number;
    nay: number;
    present: number;
    notVoting: number;
  };
}

export function VotingTable({
  title,
  billId,
  chamber,
  result,
  votes,
  summary,
}: VotingTableProps) {
  const [sortBy, setSortBy] = useState<"name" | "party" | "vote">("party");
  const [filterParty, setFilterParty] = useState<string>("all");

  const voteColors: Record<string, string> = {
    yea: "bg-green-100 text-green-800",
    nay: "bg-red-100 text-red-800",
    present: "bg-yellow-100 text-yellow-800",
    not_voting: "bg-gray-100 text-gray-500",
  };

  const partyColors: Record<string, string> = {
    D: "bg-blue-100 text-blue-800",
    R: "bg-red-100 text-red-800",
    I: "bg-purple-100 text-purple-800",
  };

  // Sort and filter votes
  const processedVotes = votes
    .filter((v) => filterParty === "all" || v.representative.party === filterParty)
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.representative.name.localeCompare(b.representative.name);
        case "party":
          return a.representative.party.localeCompare(b.representative.party);
        case "vote":
          return a.vote.localeCompare(b.vote);
        default:
          return 0;
      }
    });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">
              {billId} • {chamber === "house" ? "House" : "Senate"} Vote
            </p>
          </div>
          <span
            className={`px-3 py-1 text-sm font-semibold rounded-full ${
              result.toLowerCase().includes("passed")
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {result}
          </span>
        </div>
      </div>

      {/* Vote Summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-2 p-4 bg-gray-50 border-b">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{summary.yea}</div>
            <div className="text-xs text-gray-500 uppercase">Yea</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{summary.nay}</div>
            <div className="text-xs text-gray-500 uppercase">Nay</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{summary.present}</div>
            <div className="text-xs text-gray-500 uppercase">Present</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-400">{summary.notVoting}</div>
            <div className="text-xs text-gray-500 uppercase">Not Voting</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 p-3 bg-white border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="party">By Party</option>
            <option value="name">By Name</option>
            <option value="vote">By Vote</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Filter:</span>
          <select
            value={filterParty}
            onChange={(e) => setFilterParty(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="all">All Parties</option>
            <option value="D">Democrats</option>
            <option value="R">Republicans</option>
            <option value="I">Independents</option>
          </select>
        </div>
        <span className="ml-auto text-sm text-gray-500">
          Showing {processedVotes.length} of {votes.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Representative
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Party
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                State
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Vote
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {processedVotes.map((record, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-sm font-medium text-gray-900">
                  {record.representative.name}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      partyColors[record.representative.party]
                    }`}
                  >
                    {record.representative.party}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  {record.representative.state}
                  {record.representative.district &&
                    `-${record.representative.district}`}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      voteColors[record.vote]
                    }`}
                  >
                    {record.vote.replace("_", " ").toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### 6.3 Representative Profile Component

Create `src/components/custom/RepresentativeProfile.tsx`:

```typescript
import React from "react";

interface RepresentativeProfileProps {
  bioguideId: string;
  name: string;
  party: string;
  state: string;
  district?: string;
  chamber: "house" | "senate";
  imageUrl?: string;
  contact: {
    phone?: string;
    website?: string;
    twitter?: string;
    office?: string;
  };
  nextElection?: string;
  committees?: string[];
  recentVotes?: {
    billId: string;
    billTitle: string;
    vote: string;
    date: string;
  }[];
  onContact?: () => void;
  onViewVotes?: () => void;
}

export function RepresentativeProfile({
  bioguideId,
  name,
  party,
  state,
  district,
  chamber,
  imageUrl,
  contact,
  nextElection,
  committees,
  recentVotes,
  onContact,
  onViewVotes,
}: RepresentativeProfileProps) {
  const partyConfig: Record<string, { color: string; bg: string; name: string }> = {
    D: { color: "text-blue-600", bg: "bg-blue-100", name: "Democrat" },
    R: { color: "text-red-600", bg: "bg-red-100", name: "Republican" },
    I: { color: "text-purple-600", bg: "bg-purple-100", name: "Independent" },
  };

  const partyInfo = partyConfig[party] || partyConfig.I;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header with gradient based on party */}
      <div
        className={`relative h-24 ${
          party === "D"
            ? "bg-gradient-to-r from-blue-500 to-blue-600"
            : party === "R"
            ? "bg-gradient-to-r from-red-500 to-red-600"
            : "bg-gradient-to-r from-purple-500 to-purple-600"
        }`}
      >
        {/* Chamber badge */}
        <div className="absolute top-3 right-3">
          <span className="px-2 py-1 text-xs font-semibold bg-white/20 text-white rounded-full backdrop-blur">
            {chamber === "house" ? "House" : "Senate"}
          </span>
        </div>
      </div>

      {/* Profile section */}
      <div className="relative px-4 pb-4">
        {/* Avatar */}
        <div className="absolute -top-12 left-4">
          <div className="w-24 h-24 rounded-full bg-white p-1 shadow-lg">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <div
                className={`w-full h-full rounded-full ${partyInfo.bg} flex items-center justify-center`}
              >
                <span className={`text-3xl font-bold ${partyInfo.color}`}>
                  {name.charAt(0)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Name and info */}
        <div className="pt-14">
          <h3 className="text-xl font-bold text-gray-900">{name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${partyInfo.bg} ${partyInfo.color}`}>
              {partyInfo.name}
            </span>
            <span className="text-sm text-gray-600">
              {state}
              {district && `-${district}`}
            </span>
          </div>
          {nextElection && (
            <p className="text-sm text-gray-500 mt-1">
              Next election: {nextElection}
            </p>
          )}
        </div>

        {/* Contact info */}
        <div className="mt-4 space-y-2">
          {contact.phone && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">📞</span>
              <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">
                {contact.phone}
              </a>
            </div>
          )}
          {contact.website && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">🌐</span>
              <a
                href={contact.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate"
              >
                {contact.website.replace("https://", "")}
              </a>
            </div>
          )}
          {contact.twitter && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">𝕏</span>
              <a
                href={`https://twitter.com/${contact.twitter}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                @{contact.twitter}
              </a>
            </div>
          )}
        </div>

        {/* Committees */}
        {committees && committees.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Committees</h4>
            <div className="flex flex-wrap gap-1">
              {committees.slice(0, 4).map((committee, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full"
                >
                  {committee}
                </span>
              ))}
              {committees.length > 4 && (
                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded-full">
                  +{committees.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Recent votes preview */}
        {recentVotes && recentVotes.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Recent Votes</h4>
            <div className="space-y-2">
              {recentVotes.slice(0, 3).map((vote, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2"
                >
                  <div className="truncate flex-1 mr-2">
                    <span className="font-medium text-blue-600">{vote.billId}</span>
                    <span className="text-gray-500 ml-2">{vote.billTitle}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      vote.vote.toLowerCase() === "yea"
                        ? "bg-green-100 text-green-700"
                        : vote.vote.toLowerCase() === "nay"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {vote.vote}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
        <button
          onClick={onContact}
          className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
        >
          📧 Contact
        </button>
        <button
          onClick={onViewVotes}
          className="flex-1 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition"
        >
          📊 Full Voting Record
        </button>
      </div>
    </div>
  );
}
```

### 6.4 Audio Briefing Player Component

Create `src/components/custom/AudioBriefingPlayer.tsx`:

```typescript
import React, { useState, useRef, useEffect } from "react";

interface AudioBriefingPlayerProps {
  title: string;
  audioSrc?: string; // URL or base64
  audioBase64?: string;
  duration?: number; // in seconds
  transcript?: string;
  onRegenerate?: () => void;
  onShare?: () => void;
}

export function AudioBriefingPlayer({
  title,
  audioSrc,
  audioBase64,
  duration,
  transcript,
  onRegenerate,
  onShare,
}: AudioBriefingPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Determine audio source
  const actualSrc = audioSrc || (audioBase64 ? `data:audio/mpeg;base64,${audioBase64}` : "");

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const skipTime = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, audioDuration));
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-indigo-100 bg-white/50">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎧</span>
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500">Legislative Audio Briefing</p>
          </div>
        </div>
      </div>

      {/* Player */}
      <div className="p-4">
        <audio ref={audioRef} src={actualSrc} preload="metadata" />

        {/* Waveform placeholder / progress */}
        <div className="relative h-16 bg-white/50 rounded-lg mb-4 overflow-hidden">
          {/* Fake waveform visualization */}
          <div className="absolute inset-0 flex items-center justify-center gap-1 px-4">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-150 ${
                  i / 40 < currentTime / audioDuration
                    ? "bg-indigo-500"
                    : "bg-indigo-200"
                }`}
                style={{
                  height: `${20 + Math.sin(i * 0.5) * 15 + Math.random() * 10}px`,
                }}
              />
            ))}
          </div>

          {/* Seek slider overlay */}
          <input
            type="range"
            min={0}
            max={audioDuration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Time display */}
        <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(audioDuration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => skipTime(-15)}
            className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-white rounded-full transition"
            title="Rewind 15s"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
          </button>

          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-14 h-14 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 transition shadow-lg"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => skipTime(15)}
            className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-white rounded-full transition"
            title="Forward 15s"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Transcript toggle */}
      {transcript && (
        <div className="border-t border-indigo-100">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-white/50 transition flex items-center justify-center gap-2"
          >
            {showTranscript ? "Hide" : "Show"} Transcript
            <svg
              className={`w-4 h-4 transition-transform ${showTranscript ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showTranscript && (
            <div className="px-4 pb-4">
              <div className="bg-white rounded-lg p-3 text-sm text-gray-700 max-h-48 overflow-y-auto">
                {transcript}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 bg-white/50 border-t border-indigo-100 flex items-center gap-2">
        <button
          onClick={onRegenerate}
          className="flex-1 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition"
        >
          🔄 Regenerate
        </button>
        <button
          onClick={onShare}
          className="flex-1 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
        >
          📤 Share
        </button>
      </div>
    </div>
  );
}
```

---

## 7. System Prompts for Consistent UI Generation <a name="system-prompts"></a>

### 7.1 Understanding C1 System Prompts

C1's behavior is heavily influenced by system prompts. They control:
- **What UI components** get generated
- **When** to use tables vs cards vs charts
- **Styling preferences**
- **Interactive elements** to include

### 7.2 Legislative-Specific System Prompt Enhancements

Add these sections to your system prompt for better results:

```typescript
export const uiGenerationRules = `
## UI Component Selection Rules

### Use TABLE for:
- Any list of 3+ items with multiple attributes
- Voting records (always sortable by party, name, vote)
- Bill search results
- Committee membership
- Comparison data

### Use CARD for:
- Single entity display (one bill, one rep)
- Highlighted/featured content
- Summary information
- News articles

### Use CHART for:
- Voting patterns over time → Line Chart
- Party breakdown of votes → Pie Chart
- Bill status progress → Progress/Funnel
- Voting alignment between reps → Bar Chart
- Geographic distribution → Map (if available)

### Use LIST for:
- Simple enumerations
- Action history (timeline style)
- Quick bullet points

### Use FORM for:
- User input collection
- Preference settings
- Location setup
- Bill tracking toggles

## Data Presentation Rules

1. **Dates**: Always format as "Month Day, Year" (e.g., "March 15, 2024")
2. **Bill IDs**: Format as "H.R. 1234" or "S. 567" (include chamber prefix)
3. **Votes**: Show as "Passed 234-201" with breakdown available
4. **Percentages**: Round to one decimal (e.g., "78.5%")
5. **Party**: Always color-code (D=blue, R=red, I=purple)

## Interactive Element Requirements

Every substantial response should include at least one actionable element:
- Bills → "Track This Bill" button
- Reps → "View Voting Record" button
- Complex topics → "Generate Audio Briefing" button
- Data → "Download/Export" option
- External sources → "View on Congress.gov" link

## Accessibility

- Always include alt text for visual elements
- Ensure sufficient color contrast
- Provide text alternatives for charts
- Use semantic headings
`;
```

---

## 8. Tool Calls and Actions <a name="tool-calls-and-actions"></a>

### 8.1 Defining Tools for C1

Tools let C1 fetch data and trigger actions. Define them in your API route:

```typescript
// Extended tool definitions
const legislativeTools: OpenAI.Chat.ChatCompletionTool[] = [
  // Data retrieval tools
  {
    type: "function",
    function: {
      name: "searchBills",
      description: "Search for bills in Congress",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          congress: { type: "number" },
          status: { 
            type: "string",
            enum: ["introduced", "in_committee", "passed_house", "passed_senate", "enacted"]
          },
          sponsor_party: { type: "string", enum: ["D", "R", "I"] },
          limit: { type: "number", default: 10 }
        },
        required: ["query"]
      }
    }
  },
  
  // Action tools
  {
    type: "function",
    function: {
      name: "trackBill",
      description: "Add a bill to user's tracked list",
      parameters: {
        type: "object",
        properties: {
          billId: { type: "string" },
          notifyOnUpdates: { type: "boolean", default: true }
        },
        required: ["billId"]
      }
    }
  },
  
  {
    type: "function",
    function: {
      name: "generateAudioBriefing",
      description: "Create an NPR-style audio briefing",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string" },
          style: { type: "string", enum: ["brief", "standard", "detailed"] },
          includeContext: { type: "boolean", default: true }
        },
        required: ["topic"]
      }
    }
  },
  
  {
    type: "function",
    function: {
      name: "setUserLocation",
      description: "Set user's location for personalized rep info",
      parameters: {
        type: "object",
        properties: {
          state: { type: "string", description: "Two-letter state code" },
          district: { type: "string", description: "Congressional district number" },
          zipCode: { type: "string" }
        },
        required: ["state"]
      }
    }
  },
  
  {
    type: "function", 
    function: {
      name: "compareVotes",
      description: "Compare voting records between representatives",
      parameters: {
        type: "object",
        properties: {
          repIds: { 
            type: "array",
            items: { type: "string" },
            description: "Bioguide IDs of representatives to compare"
          },
          topic: { type: "string", description: "Policy area to focus on" },
          timeframe: { type: "string", description: "Time period (e.g., '2024', 'last_year')" }
        },
        required: ["repIds"]
      }
    }
  }
];
```

### 8.2 Handling Actions from C1 Components

```typescript
// In your chat component
const handleAction = useCallback(async (action: { 
  type: string; 
  payload: Record<string, any> 
}) => {
  switch (action.type) {
    case "trackBill":
      // Call API to track bill
      const trackResult = await fetch("/api/track-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billId: action.payload.billId,
          userId: currentUserId,
        }),
      });
      
      if (trackResult.ok) {
        // Show success toast
        showToast(`Now tracking ${action.payload.billId}`);
        // Optionally trigger a follow-up message
        appendMessage({
          role: "user",
          content: `I just started tracking ${action.payload.billId}. Can you summarize it for me?`,
        });
      }
      break;
      
    case "generateAudio":
      // Show loading state
      setIsGeneratingAudio(true);
      
      const audioResult = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: action.payload.topic,
          style: action.payload.style || "standard",
        }),
      });
      
      const audioData = await audioResult.json();
      
      // Render audio player
      appendMessage({
        role: "assistant",
        content: "", // Empty content
        customComponent: (
          <AudioBriefingPlayer
            title={`Briefing: ${action.payload.topic}`}
            audioBase64={audioData.audioBase64}
            transcript={audioData.transcript}
          />
        ),
      });
      
      setIsGeneratingAudio(false);
      break;
      
    case "setLocation":
      // Update user preferences
      await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: action.payload.state,
          district: action.payload.district,
        }),
      });
      
      // Trigger rep lookup
      appendMessage({
        role: "user",
        content: "Now show me my representatives.",
      });
      break;
      
    case "openExternalLink":
      window.open(action.payload.url, "_blank", "noopener,noreferrer");
      break;
      
    default:
      console.warn("Unknown action type:", action.type);
  }
}, [currentUserId, appendMessage, showToast]);
```

---

## 9. Streaming and Real-Time Updates <a name="streaming"></a>

### 9.1 Server-Side Streaming

```typescript
// In your API route
export async function POST(req: NextRequest) {
  const { prompt, threadId, userId } = await req.json();
  
  // ... tool call handling ...
  
  // Create streaming response
  const stream = await c1Client.chat.completions.create({
    model: "c1-nightly",
    messages: messageStore.getMessages(),
    stream: true,
  });
  
  // Create a TransformStream for processing
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  
  // Process stream in background
  (async () => {
    try {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          await writer.write(encoder.encode(content));
        }
      }
    } catch (error) {
      console.error("Stream error:", error);
    } finally {
      await writer.close();
    }
  })();
  
  return new NextResponse(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
```

### 9.2 Client-Side Stream Handling

```typescript
// Enhanced stream reader with progressive rendering
async function streamMessage(
  response: Response,
  onChunk: (content: string) => void,
  onComplete: () => void
) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  if (!reader) {
    throw new Error("No response body");
  }
  
  let buffer = "";
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) {
      // Flush remaining buffer
      if (buffer) {
        onChunk(buffer);
      }
      onComplete();
      break;
    }
    
    buffer += decoder.decode(value, { stream: true });
    
    // C1 sends complete UI specs, so we can render progressively
    // Look for complete component boundaries
    const lastCompleteIdx = buffer.lastIndexOf("}}");
    if (lastCompleteIdx > 0) {
      const completeContent = buffer.substring(0, lastCompleteIdx + 2);
      buffer = buffer.substring(lastCompleteIdx + 2);
      onChunk(completeContent);
    }
  }
}
```

---

## 10. Theming and Customization <a name="theming"></a>

### 10.1 Custom Theme Configuration

```typescript
import { ThemeProvider } from "@thesysai/genui-sdk";

const hakivoTheme = {
  mode: "light" as const,
  colors: {
    // Primary brand colors
    primary: "#2563EB",      // Blue-600 (main actions)
    primaryHover: "#1D4ED8", // Blue-700
    primaryLight: "#DBEAFE", // Blue-100 (backgrounds)
    
    // Secondary colors
    secondary: "#4F46E5",    // Indigo-600
    secondaryLight: "#E0E7FF",
    
    // Semantic colors
    success: "#10B981",      // Green-500
    successLight: "#D1FAE5",
    warning: "#F59E0B",      // Amber-500
    warningLight: "#FEF3C7",
    error: "#EF4444",        // Red-500
    errorLight: "#FEE2E2",
    
    // Neutral colors
    background: "#FFFFFF",
    surface: "#F9FAFB",      // Gray-50
    surfaceHover: "#F3F4F6", // Gray-100
    border: "#E5E7EB",       // Gray-200
    
    // Text colors
    text: "#111827",         // Gray-900
    textSecondary: "#6B7280", // Gray-500
    textMuted: "#9CA3AF",    // Gray-400
    
    // Party colors (for political data)
    democrat: "#2563EB",
    republican: "#DC2626",
    independent: "#7C3AED",
  },
  
  // Typography
  fontFamily: "'Inter', -apple-system, sans-serif",
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  // Spacing & Layout
  borderRadius: {
    sm: "0.25rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    full: "9999px",
  },
  
  // Shadows
  shadow: {
    sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
    md: "0 4px 6px rgba(0, 0, 0, 0.07)",
    lg: "0 10px 15px rgba(0, 0, 0, 0.1)",
  },
  
  // Component-specific overrides
  components: {
    table: {
      headerBg: "#F9FAFB",
      rowHoverBg: "#F3F4F6",
      borderColor: "#E5E7EB",
    },
    card: {
      borderRadius: "0.75rem",
      shadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    },
    button: {
      borderRadius: "0.5rem",
      fontWeight: 500,
    },
    input: {
      borderRadius: "0.5rem",
      focusRing: "#2563EB",
    },
  },
};

// Usage
<ThemeProvider theme={hakivoTheme}>
  <C1Chat apiUrl="/api/chat" />
</ThemeProvider>
```

### 10.2 Dark Mode Support

```typescript
const hakivoDarkTheme = {
  ...hakivoTheme,
  mode: "dark" as const,
  colors: {
    ...hakivoTheme.colors,
    background: "#111827",   // Gray-900
    surface: "#1F2937",      // Gray-800
    surfaceHover: "#374151", // Gray-700
    border: "#374151",
    text: "#F9FAFB",
    textSecondary: "#9CA3AF",
    textMuted: "#6B7280",
  },
};

// Toggle theme based on system preference or user choice
const [theme, setTheme] = useState(hakivoTheme);

useEffect(() => {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  setTheme(mediaQuery.matches ? hakivoDarkTheme : hakivoTheme);
  
  const handler = (e: MediaQueryListEvent) => {
    setTheme(e.matches ? hakivoDarkTheme : hakivoTheme);
  };
  
  mediaQuery.addEventListener("change", handler);
  return () => mediaQuery.removeEventListener("change", handler);
}, []);
```

---

## 11. Complete Working Example <a name="complete-example"></a>

Here's a minimal but complete example you can run:

### `package.json`

```json
{
  "name": "hakivo-chat",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@crayonai/react-ui": "^0.1.0",
    "@thesysai/genui-sdk": "^0.1.0",
    "next": "14.0.0",
    "openai": "^4.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "typescript": "^5.0.0"
  }
}
```

### `src/app/page.tsx`

```typescript
"use client";

import { C1Chat } from "@thesysai/genui-sdk";
import "@crayonai/react-ui/styles/index.css";

export default function Home() {
  return (
    <main className="h-screen bg-gray-50">
      <C1Chat
        apiUrl="/api/chat"
        theme={{
          mode: "light",
          colors: {
            primary: "#2563EB",
            secondary: "#4F46E5",
          },
        }}
        placeholder="Ask about bills, representatives, or votes..."
        welcomeMessage="👋 Welcome to Hakivo! I can help you understand Congress. Try asking about a specific bill, your representatives, or voting records."
      />
    </main>
  );
}
```

### `src/app/api/chat/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.THESYS_API_KEY,
  baseURL: "https://api.thesys.dev/v1/embed",
});

const systemPrompt = `You are Hakivo, a congressional assistant. Help users understand legislation.

When showing bill data, use tables with columns: Bill #, Title, Status, Sponsor.
When showing voting records, use tables with: Representative, Party, Vote.
When showing a single bill or rep, use a detailed card format.
Always offer to track bills or generate audio briefings when relevant.`;

// Simple in-memory store
const conversations: Record<string, OpenAI.Chat.ChatCompletionMessageParam[]> = {};

export async function POST(req: NextRequest) {
  const { prompt, threadId = "default" } = await req.json();

  // Initialize conversation if needed
  if (!conversations[threadId]) {
    conversations[threadId] = [
      { role: "system", content: systemPrompt },
    ];
  }

  // Add user message
  conversations[threadId].push({ role: "user", content: prompt });

  // Get streaming response from C1
  const stream = await client.chat.completions.create({
    model: "c1-nightly",
    messages: conversations[threadId],
    stream: true,
  });

  // Create readable stream for response
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      let fullResponse = "";
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        fullResponse += content;
        controller.enqueue(encoder.encode(content));
      }
      
      // Save assistant response
      conversations[threadId].push({ role: "assistant", content: fullResponse });
      
      controller.close();
    },
  });

  return new NextResponse(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
```

---

## 12. Best Practices <a name="best-practices"></a>

### Do's ✅

1. **Guide UI with system prompts** - Be specific about when to use tables vs cards vs charts
2. **Handle tool calls properly** - Execute tools, return results, then let C1 render
3. **Stream responses** - Better UX with progressive rendering
4. **Implement proper error handling** - Graceful fallbacks for failed generations
5. **Cache frequently accessed data** - Don't hit Congress.gov API on every request
6. **Use semantic HTML** - C1 generates accessible components, don't break them
7. **Test with various queries** - Ensure consistent UI for similar questions

### Don'ts ❌

1. **Don't over-specify UI in prompts** - Let C1 make smart decisions
2. **Don't ignore streaming** - Waiting for full response hurts UX
3. **Don't forget conversation history** - C1 needs context for coherent responses
4. **Don't hardcode UI templates** - That defeats the purpose of Generative UI
5. **Don't skip tool definitions** - They enable dynamic data fetching
6. **Don't ignore mobile** - Test responsive behavior

### Performance Tips

```typescript
// 1. Implement request deduplication
const pendingRequests = new Map<string, Promise<any>>();

async function deduplicatedFetch(key: string, fetchFn: () => Promise<any>) {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }
  
  const promise = fetchFn();
  pendingRequests.set(key, promise);
  
  try {
    return await promise;
  } finally {
    pendingRequests.delete(key);
  }
}

// 2. Cache bill data
const billCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedBill(billId: string) {
  const cached = billCache.get(billId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetchBillFromAPI(billId);
  billCache.set(billId, { data, timestamp: Date.now() });
  return data;
}

// 3. Limit conversation history
function trimConversation(messages: Message[], maxTokens: number = 4000) {
  // Keep system prompt + recent messages within token budget
  const systemPrompt = messages[0];
  const recentMessages = messages.slice(-10); // Last 10 exchanges
  return [systemPrompt, ...recentMessages];
}
```

---

## Quick Reference Card

| Task | Code |
|------|------|
| Install SDK | `npm install @thesysai/genui-sdk @crayonai/react-ui` |
| Import CSS | `import "@crayonai/react-ui/styles/index.css"` |
| Simple Chat | `<C1Chat apiUrl="/api/chat" />` |
| Custom Render | `<C1Component c1Response={response} onAction={handleAction} />` |
| Theme | `<ThemeProvider theme={{ mode: "light", colors: {...} }}>` |
| API Base URL | `https://api.thesys.dev/v1/embed` |
| Model | `c1-nightly` (or your preferred model) |

---

## Resources

- [thesys.dev Documentation](https://docs.thesys.dev)
- [C1 Playground](https://console.thesys.dev/playground)
- [Crayon UI GitHub](https://github.com/thesysdev/crayon)
- [Example Apps](https://github.com/thesysdev/examples)
- [Congress.gov API](https://api.congress.gov)

---

*This guide was created for Hakivo Congressional Assistant. For the latest thesys.dev updates, always check the official documentation.*
