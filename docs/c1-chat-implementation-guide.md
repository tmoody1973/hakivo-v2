# C1 Chat Implementation Guide

## Overview

This guide documents how Thesys C1 builds chat experiences with artifacts and tools. Use this as a reference for implementing similar patterns in Hakivo.

**Reference Template:** `docs/c1-template/` - Official Thesys starter template

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (Next.js)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              C1Chat Component                        │   │
│  │  - Handles user input                                │   │
│  │  - Renders streaming responses                       │   │
│  │  - Displays artifacts (reports, cards, etc.)         │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           API Route (/api/chat)                      │   │
│  │  - Connects to Thesys API                            │   │
│  │  - Manages tool execution                            │   │
│  │  - Streams responses back                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Tools Layer                         │   │
│  │  - Web search                                        │   │
│  │  - Image search                                      │   │
│  │  - Weather                                           │   │
│  │  - Custom tools (bills, members, etc.)               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. Client-Side: C1Chat

The `C1Chat` component from `@thesysai/genui-sdk` handles the entire chat UI:

```tsx
// src/app/page.tsx
"use client";

import { C1Chat, ThemeProvider } from "@thesysai/genui-sdk";
import "@crayonai/react-ui/styles/index.css";

export default function Home() {
  return (
    <ThemeProvider theme={theme} darkTheme={darkTheme} mode="auto">
      <C1Chat
        apiUrl="/api/chat"      // Your API endpoint
        disableThemeProvider    // We provide our own theme
      />
    </ThemeProvider>
  );
}
```

**What C1Chat provides:**
- Message input and send
- Streaming response display
- Tool execution indicators
- Artifact rendering (reports, cards, charts)
- Thread management
- Theming support

### 2. Server-Side: API Route

```typescript
// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { transformStream } from "@crayonai/stream";
import { tools } from "./tools";

export async function POST(req: NextRequest) {
  const { prompt, threadId, responseId } = await req.json();

  // Connect to Thesys API (OpenAI-compatible)
  const client = new OpenAI({
    baseURL: "https://api.thesys.dev/v1/embed/",
    apiKey: process.env.THESYS_API_KEY,
  });

  // Get message history
  const messageStore = getMessageStore(threadId);
  messageStore.addMessage(prompt);

  // Call Thesys with tools
  const llmStream = await client.beta.chat.completions.runTools({
    model: "c1/anthropic/claude-sonnet-4/v-20251130",
    messages: messageStore.getOpenAICompatibleMessageList(),
    stream: true,
    tool_choice: tools.length > 0 ? "auto" : "none",
    tools,
  });

  // Transform and return stream
  const responseStream = transformStream(
    llmStream,
    (chunk) => chunk.choices?.[0]?.delta?.content ?? "",
    {
      onEnd: ({ accumulated }) => {
        messageStore.addMessage({
          role: "assistant",
          content: accumulated.join(""),
          id: responseId,
        });
      },
    }
  );

  return new NextResponse(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

### 3. Tool Definition Pattern

Tools follow the OpenAI function calling pattern with Zod schemas:

```typescript
// src/app/api/chat/tools/webSearchTool.ts
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { RunnableToolFunctionWithParse } from "openai/lib/RunnableFunction.mjs";

export const googleWebSearchTool = (
  writeProgress: (progress: { title: string; content: string }) => void
): RunnableToolFunctionWithParse<{ query: string }> => ({
  type: "function",
  function: {
    name: "google_web_search",
    description: "Performs a real-time web search...",
    parse: JSON.parse,
    parameters: zodToJsonSchema(
      z.object({
        query: z.string().describe("The search query"),
      })
    ),
    function: async ({ query }) => {
      // Write progress update (shows in UI)
      writeProgress({
        title: "Searching",
        content: `Finding results for: ${query}`,
      });

      // Execute search
      const results = await googleWebSearch({ query });

      // Return results to LLM
      return JSON.stringify(results);
    },
  },
});
```

---

## Progress Updates

The `writeProgress` callback lets you show step-by-step updates in the UI:

```typescript
writeProgress({
  title: "Initiating Query Resolution",
  content: `Finding the most relevant pages for: ${query}`,
});

// ... do work ...

writeProgress({
  title: "Structured Content Extraction",
  content: `Parsing content from ${url}...`,
});

// ... do work ...

writeProgress({
  title: "Semantic Abstraction via LLM",
  content: `Summarizing content from ${url}`,
});

// ... do work ...

writeProgress({
  title: "Aggregating Insights",
  content: "Merging summaries into a coherent answer.",
});
```

---

## Message Store

Simple in-memory message store for thread management:

```typescript
// src/app/api/chat/messageStore.ts
export interface DBMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

const messageStores = new Map<string, DBMessage[]>();

export function getMessageStore(threadId: string) {
  if (!messageStores.has(threadId)) {
    messageStores.set(threadId, []);
  }

  return {
    addMessage(message: DBMessage) {
      messageStores.get(threadId)!.push(message);
    },
    getOpenAICompatibleMessageList() {
      return messageStores.get(threadId)!.map(m => ({
        role: m.role,
        content: m.content,
      }));
    },
  };
}
```

---

## Artifact Types

C1 can generate various artifact types:

### Report
Multi-page document with sections:
```json
{
  "component": "Report",
  "props": {
    "metadata": {
      "title": { "id": "t1", "text": "Report Title" }
    },
    "pages": [
      {
        "id": "p1",
        "variant": "ContentPage",
        "children": [...]
      }
    ]
  }
}
```

### Cards
Grid of interactive cards:
```json
{
  "component": "Cards",
  "props": {
    "variant": "grid",
    "children": [
      {
        "component": "Card",
        "props": {
          "title": "Card Title",
          "description": "Description text",
          "href": "https://example.com"
        }
      }
    ]
  }
}
```

### List
Bulleted or numbered list:
```json
{
  "component": "List",
  "props": {
    "heading": "Key Points",
    "variant": "bullet",
    "items": [
      { "title": "Point 1" },
      { "title": "Point 2" }
    ]
  }
}
```

---

## Thesys API Configuration

### Environment Variables

```bash
# .env
THESYS_API_KEY=your_api_key_here
```

### API Endpoint

```
Base URL: https://api.thesys.dev/v1/embed/
Model: c1/anthropic/claude-sonnet-4/v-20251130
```

### Get API Key

1. Go to https://chat.thesys.dev/console/keys
2. Create a new API key
3. Add to environment variables

---

## Adapting for Hakivo

### 1. Replace Tools

Instead of generic web search, use Hakivo-specific tools:

```typescript
// mastra/tools/index.ts
export const hakivoTools = [
  geminiSearchTool,      // News search with grounding
  searchBillsTool,       // Congressional bills
  searchMembersTool,     // Congress members
  createDocumentTool,    // Document generation
];
```

### 2. Add Progress Notifications

Use the progress pattern for document generation:

```typescript
async function generateDocument(query: string, writeProgress: Function) {
  writeProgress({ title: "Starting", content: "Analyzing request..." });

  writeProgress({ title: "Researching", content: "Searching news..." });
  const news = await searchNews(query);

  writeProgress({ title: "Researching", content: "Finding bills..." });
  const bills = await searchBills(query);

  writeProgress({ title: "Building", content: "Creating document..." });
  const doc = await buildDocument({ news, bills });

  writeProgress({ title: "Rendering", content: "Generating artifact..." });
  const artifact = await renderToC1(doc);

  return artifact;
}
```

### 3. Persist Documents

Save generated documents to the database:

```typescript
// After building document
await saveDocument({
  userId,
  documentType: "policy_report",
  title: doc.title,
  sections: doc.sections,
  rawToolResults: { news, bills },
});
```

---

## File Structure Reference

```
docs/c1-template/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/
│   │   │       ├── route.ts           # API endpoint
│   │   │       ├── messageStore.ts    # Thread management
│   │   │       ├── tools.ts           # Tool exports
│   │   │       ├── systemPrompts.ts   # System prompts
│   │   │       ├── tools/
│   │   │       │   ├── index.ts       # Tool exports
│   │   │       │   ├── googleImage.ts # Image search
│   │   │       │   ├── weather.ts     # Weather tool
│   │   │       │   └── webSearchTool.ts
│   │   │       ├── services/
│   │   │       │   ├── googleSearch.ts
│   │   │       │   └── websiteContent.ts
│   │   │       └── types/
│   │   │           └── search.ts
│   │   ├── page.tsx                   # Chat page
│   │   ├── layout.tsx                 # App layout
│   │   └── font.ts                    # Font config
│   └── theme.ts                       # Theme config
├── public/                            # Static assets
├── package.json
├── .env.example
└── README.md
```

---

## Summary

The C1 template demonstrates:

1. **OpenAI-compatible API** - Use standard OpenAI SDK with Thesys endpoint
2. **Tool calling** - Define tools with Zod schemas, handle with callbacks
3. **Progress updates** - Show step-by-step progress during tool execution
4. **Streaming responses** - Transform LLM stream for client consumption
5. **Artifact rendering** - C1Chat automatically renders JSON artifacts

For Hakivo, adapt this pattern by:
- Using Mastra tools instead of raw OpenAI tools
- Adding document persistence
- Implementing the document-first architecture
- Adding user-specific progress notifications
