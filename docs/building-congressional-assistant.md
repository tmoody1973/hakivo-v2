# Building the Congressional Assistant: A Deep Dive into AI-Powered Civic Engagement

*How we built an intelligent assistant that makes congressional information accessible to everyone*

---

## The Vision

Imagine having a personal aide who knows everything about Congress—every bill, every representative, every vote—and can explain it all in plain English. That's what we built with the Congressional Assistant, an AI-powered tool that democratizes access to legislative information.

This document explains how we built it, the technology choices we made, and how each piece works together.

---

## The Technology Stack

### Mastra: The AI Framework

[Mastra](https://mastra.ai) is an open-source TypeScript framework for building AI agents. Think of it as the "brain orchestrator"—it connects our AI model to tools that can search databases, fetch news, and remember user preferences.

**Why Mastra?**
- **Tool-based architecture**: We define "tools" that the AI can use to gather information
- **Type-safe**: Built with TypeScript, so we catch errors before they happen
- **Flexible**: Works with any AI model provider
- **Production-ready**: Built for real applications, not just demos

### Raindrop: The Infrastructure

[Raindrop](https://liquidmetal.ai) by LiquidMetal AI provides our backend infrastructure. It's like having a fully-managed cloud platform specifically designed for AI applications.

**What Raindrop Provides:**
- **SmartSQL**: Databases that understand natural language
- **SmartBucket**: Document storage with built-in semantic search
- **SmartMemory**: AI memory that remembers users across sessions
- **KV Cache**: Fast key-value storage for session data
- **Queue System**: Background job processing for heavy tasks

### Cerebras: The Speed Engine

We use [Cerebras](https://cerebras.ai) for AI inference—they're 10x faster than typical cloud AI providers. This means our assistant responds almost instantly, even for complex questions.

**Model**: GPT-OSS 120B (an open-source 120 billion parameter model)

---

## How It All Works Together

```
User Question
     ↓
┌─────────────────────────────────────────────────────┐
│                 Congressional Assistant              │
│    (Mastra Agent with Cerebras GPT-OSS 120B)        │
└─────────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────────┐
│                    Tool Selection                    │
│  The AI decides which tools to use based on the     │
│  question. It might use multiple tools together.    │
└─────────────────────────────────────────────────────┘
     ↓
┌──────────────┬──────────────┬──────────────┬────────┐
│   SmartSQL   │ SmartBucket  │ SmartMemory  │  News  │
│  (Database)  │   (Search)   │  (Memory)    │(Search)│
└──────────────┴──────────────┴──────────────┴────────┘
     ↓
┌─────────────────────────────────────────────────────┐
│              Response Generation                     │
│  The AI synthesizes all gathered information into   │
│  a clear, personalized answer for the user.         │
└─────────────────────────────────────────────────────┘
     ↓
User Response
```

---

## The Tools: What Powers the Assistant

### 1. SmartSQL Tools - The Database Connection

These tools let the assistant query our congressional database using natural language.

#### `smartSql` - Natural Language Database Search

**What it does**: Converts questions like "What bills did Bernie Sanders sponsor about healthcare?" into database queries.

**How it works**:
1. Takes your question in plain English
2. Detects intent (bill search, member lookup, sponsor query, etc.)
3. Generates the appropriate SQL query
4. Returns structured results

**Example**:
```
User: "Show me climate bills from this year"
AI: Uses smartSql to query bills WHERE policy_area = 'Environmental Protection'
    AND congress = 119
Result: List of relevant bills with titles, sponsors, and status
```

#### `getBillDetail` - Deep Bill Information

**What it does**: Fetches comprehensive information about a specific bill.

**Returns**: Title, summary, sponsor info, cosponsors, actions, related bills, voting records

#### `getMemberDetail` - Representative Profiles

**What it does**: Gets detailed information about any member of Congress.

**Returns**: Biography, committee assignments, recent bills, voting history, contact information

---

### 2. SmartBucket Tools - Semantic Search

These tools enable searching through bill text using AI-powered semantic understanding—not just keyword matching.

#### `semanticSearch` - Find Bills by Meaning

**What it does**: Searches bill text using natural language, understanding concepts and meaning.

**How it's different**: Traditional search finds exact words. Semantic search understands that "climate change" relates to "global warming," "carbon emissions," and "environmental protection."

**Example**:
```
User: "Find bills about protecting kids online"
AI: Searches for semantically similar content
Result: Bills about internet safety, social media regulations,
        COPPA updates—even if they don't use the exact phrase
```

#### `billTextRag` - Ask Questions About Bills

**What it does**: RAG (Retrieval-Augmented Generation) lets users ask specific questions about bill text.

**Example**:
```
User: "What does the CHIPS Act say about semiconductor manufacturing?"
AI: Retrieves relevant sections of the bill text
    Generates a comprehensive answer based on the actual text
```

#### `compareBills` - Side-by-Side Analysis

**What it does**: Compares two bills to find similarities and differences.

**Use case**: Understanding competing versions of legislation or tracking how a bill changed from House to Senate.

#### `policyAreaSearch` - Topic-Based Discovery

**What it does**: Finds all bills in a specific policy area with semantic understanding.

---

### 3. SmartMemory Tools - Personalization

This is where the magic of personalization happens. SmartMemory enables the assistant to remember users across sessions, building up knowledge about their interests over time.

#### The Four Layers of Memory

```
┌────────────────────────────────────────────────────────┐
│                    SMARTMEMORY                          │
├────────────────────────────────────────────────────────┤
│ WORKING MEMORY (Session)                               │
│ - Current conversation context                         │
│ - Temporary facts for this session                     │
│ - Cleared when session ends                            │
├────────────────────────────────────────────────────────┤
│ EPISODIC MEMORY (Past Conversations)                   │
│ - Previous conversation summaries                      │
│ - What the user asked about before                     │
│ - Historical interaction patterns                      │
├────────────────────────────────────────────────────────┤
│ SEMANTIC MEMORY (Preferences & Facts)                  │
│ - User's location and representatives                  │
│ - Policy interests (healthcare, climate, etc.)         │
│ - Tracked bills and legislators                        │
├────────────────────────────────────────────────────────┤
│ PROCEDURAL MEMORY (Templates & Patterns)               │
│ - Preferred briefing formats                           │
│ - Communication style preferences                      │
│ - Custom templates for reports                         │
└────────────────────────────────────────────────────────┘
```

#### `getUserContext` - Know Your User

**What it does**: Retrieves comprehensive user context including:
- Dashboard overview (district, representatives)
- Current representatives (House member, Senators)
- Memory profile (interests, preferences, past conversations)

**How it's used**: The assistant calls this at the start of conversations to personalize responses.

#### `getUserRepresentatives` - Local Representation

**What it does**: Gets the user's specific elected officials based on their address.

**Returns**: House representative, both Senators, with full contact information

#### `getTrackedBills` - Following Legislation

**What it does**: Retrieves bills the user is actively following.

**Use case**: "What's the status of bills I'm tracking?" The assistant knows exactly which bills matter to you.

#### `getConversationHistory` - Context Continuity

**What it does**: Retrieves past conversation summaries.

**Example**:
```
User: "What did we discuss about healthcare last week?"
AI: Retrieves episodic memory of past conversations
    Provides summary with relevant context
```

#### `storeWorkingMemory` - Remember for Later

**What it does**: Stores facts from the current session for future reference.

**Example**: User mentions they're particularly interested in education policy. The assistant stores this for personalization in future sessions.

#### `updateUserProfile` - Preference Management

**What it does**: Updates the user's profile with new preferences, interests, or settings.

#### `searchPastSessions` - Historical Lookup

**What it does**: Searches through all past conversations for specific topics.

---

### 4. News Search Tools - Current Events

These tools connect to the Perplexity API for AI-powered news search.

#### `searchNews` - General News

**What it does**: Searches for news on any topic with progressive recency—tries recent news first, expands if nothing found.

**Progressive Search**:
1. Last 24 hours
2. Last week
3. Last month

#### `searchCongressionalNews` - Capitol Hill Coverage

**What it does**: Searches specifically for congressional news—floor activity, committee hearings, legislative developments.

#### `searchLegislatorNews` - Member-Specific News

**What it does**: Finds news about a specific representative or senator.

---

### 5. State Legislation Tools - Beyond Federal

We integrate with [OpenStates](https://openstates.org) to cover state-level legislation.

#### `searchStateBills` - State Bill Search

**What it does**: Searches state legislation across all 50 states.

#### `getStateBillDetails` - State Bill Deep Dive

**What it does**: Gets full details on a specific state bill.

#### `getStateLegislatorsByLocation` - Local Representatives

**What it does**: Finds state legislators based on address.

---

### 6. Content Generation Tools

#### `generateBillReport` - Professional Reports

**What it does**: Creates comprehensive, formatted reports on bills—perfect for sharing or printing.

#### `generateBriefingSlides` - Presentation Ready

**What it does**: Generates slide deck content for briefings and presentations.

#### Audio Briefing Tools

- `generateAudioBriefing` - Text-to-speech briefings
- `generateBillAudioSummary` - Audio summaries of specific bills
- `generateDailyBriefingAudio` - Personalized daily updates

---

## The Agent: Bringing It Together

Here's a simplified view of how we define the Congressional Assistant:

```typescript
import { Agent } from "@mastra/core/agent";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Connect to Cerebras for fast inference
const cerebras = createOpenAICompatible({
  name: "cerebras",
  baseURL: "https://api.cerebras.ai/v1",
  apiKey: process.env.CEREBRAS_API_KEY,
});

// Define the agent with all its tools
export const congressionalAssistant = new Agent({
  name: "congressional-assistant",
  instructions: systemPrompt,  // Detailed instructions for behavior
  model: cerebras.chatModel("gpt-oss-120b"),
  tools: {
    // Database tools
    smartSql,
    getBillDetail,
    getMemberDetail,

    // Search tools
    semanticSearch,
    billTextRag,
    compareBills,

    // Memory tools
    getUserContext,
    getUserRepresentatives,
    getTrackedBills,
    storeWorkingMemory,

    // News tools
    searchNews,
    searchCongressionalNews,

    // State tools
    searchStateBills,
    getStateBillDetails,

    // Generation tools
    generateBillReport,
    generateAudioBriefing,
  },
});
```

---

## The System Prompt: Teaching the AI

The system prompt is like a detailed job description for the AI. Here's the structure:

### Core Identity
```
You are the Hakivo Congressional Assistant, an expert on the U.S. Congress
and legislative process. Your role is to help users understand bills,
track legislation, and stay informed about their representatives.
```

### Behavioral Guidelines
- Always prioritize accuracy over speed
- Cite sources and provide bill numbers
- Personalize responses based on user context
- Explain complex legislative procedures simply

### Tool Usage Instructions
- When to use each tool
- How to combine tools for complex queries
- Fallback strategies when tools return no results

### Response Formatting
- Use clear headers and bullet points
- Include relevant links
- Highlight action items
- Summarize key points at the end

---

## SmartMemory Implementation: The Technical Details

### Backend Architecture

SmartMemory is implemented as a Raindrop resource in our manifest:

```hcl
# raindrop.manifest
smartmemory "congressional_memory" {}
```

This single line creates a fully-managed memory system with:
- Automatic vector embeddings for semantic search
- Multi-layer storage (working, episodic, semantic, procedural)
- Per-user isolation
- Automatic cleanup policies

### API Endpoints

Our chat service exposes SmartMemory through REST endpoints:

```typescript
// Store a memory
POST /memory/store
{
  "sessionId": "user-session-123",
  "content": "User is interested in climate legislation",
  "timeline": "semantic"  // Which memory layer
}

// Search memories
POST /memory/search
{
  "sessionId": "user-session-123",
  "terms": "climate interests",
  "timeline": "semantic"
}

// Get conversation history
GET /memory/history?sessionId=user-session-123&limit=10
```

### Memory Flow

```
User sends message
        ↓
┌───────────────────────────────────────┐
│  1. Retrieve User Context              │
│     - Fetch working memory            │
│     - Load relevant episodic memories │
│     - Get semantic preferences        │
└───────────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│  2. Process with Context               │
│     - AI uses memories for context    │
│     - Personalizes response           │
└───────────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│  3. Store New Information              │
│     - Update working memory           │
│     - Extract learnings for semantic  │
│     - Log interaction to episodic     │
└───────────────────────────────────────┘
        ↓
Personalized response to user
```

### Profile Storage

User profiles are stored in a fast KV cache for quick access:

```typescript
// Store profile
await env.SESSION_CACHE.put(
  `profile:${userId}`,
  JSON.stringify(profileData),
  { expirationTtl: 60 * 60 * 24 * 30 } // 30 days
);

// Retrieve profile
const profile = await env.SESSION_CACHE.get(`profile:${userId}`);
```

---

## Real-World Usage Examples

### Example 1: New User Onboarding

```
User: "I live in Milwaukee and want to track climate legislation"

Assistant Actions:
1. getUserContext → Retrieves existing profile (new user, limited data)
2. Stores location preference in semantic memory
3. semanticSearch → Finds climate bills
4. getUserRepresentatives → Gets WI-04, Senators Johnson & Baldwin
5. storeWorkingMemory → Saves climate interest for session
6. Generates personalized onboarding response with local context
```

### Example 2: Returning User Follow-up

```
User: "Any updates on the bills we discussed?"

Assistant Actions:
1. getUserContext → Full profile with history
2. getTrackedBills → User's tracked legislation
3. getConversationHistory → What bills were discussed
4. smartSql → Get current status of those bills
5. searchCongressionalNews → Recent news on those bills
6. Generates update with personalized context from memory
```

### Example 3: Complex Research Query

```
User: "Compare the House and Senate versions of the infrastructure bill"

Assistant Actions:
1. smartSql → Find both versions of the bill
2. billTextRag → Get detailed text from both
3. compareBills → Generate side-by-side analysis
4. searchNews → Get analysis from news sources
5. Synthesizes comprehensive comparison
```

---

## Key Design Decisions

### 1. Tool-Based Architecture
Instead of one monolithic AI, we built specialized tools that the AI orchestrates. This makes the system:
- **Debuggable**: We can see exactly which tools were called
- **Extensible**: Adding new capabilities is just adding new tools
- **Reliable**: Each tool can be tested independently

### 2. Caching Strategy
We cache aggressively to provide fast responses:
- **Bill data**: 15-minute cache (legislation doesn't change that fast)
- **Member data**: 1-hour cache
- **User sessions**: 30-day cache
- **News**: 5-minute cache (stays fresh)

### 3. Progressive Enhancement
If a tool fails or returns no results, the AI gracefully degrades:
- No semantic search results? Fall back to keyword search
- News API down? Acknowledge and continue with database info
- Memory service unavailable? Continue without personalization

### 4. Privacy by Design
- User data is isolated per user
- Memories are encrypted at rest
- Users can delete their data anytime
- No data sharing between users

---

## Performance Metrics

- **Response Time**: ~2-3 seconds average (thanks to Cerebras)
- **Tool Execution**: ~500ms per tool call
- **Memory Retrieval**: ~100ms
- **Semantic Search**: ~300ms

---

## What's Next

We're continuing to enhance the Congressional Assistant with:
- **Multi-turn memory**: Better context across longer conversations
- **Proactive updates**: Notifications when tracked bills move
- **Committee tracking**: Deep dive into committee activities
- **Voting predictions**: AI-powered analysis of likely vote outcomes
- **Collaboration features**: Share research with colleagues

---

## Conclusion

Building the Congressional Assistant taught us that the future of civic technology isn't about replacing human understanding—it's about augmenting it. By combining:

- **Mastra** for intelligent orchestration
- **Raindrop** for scalable infrastructure
- **SmartMemory** for personalization
- **Cerebras** for speed

We created an assistant that makes congressional information accessible, understandable, and personally relevant. The same architecture can power assistants for any complex domain—healthcare policy, local government, corporate compliance—anywhere humans need to navigate complex information landscapes.

The code is open for exploration, and we're excited to see what the community builds with these tools.

---

*Built with Mastra, Raindrop, and a belief that democracy works better when citizens are informed.*