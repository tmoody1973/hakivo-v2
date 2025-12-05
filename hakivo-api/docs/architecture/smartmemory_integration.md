# SmartMemory Integration for Congressional Assistant

## What is SmartMemory?

SmartMemory is like giving your AI assistant a real brain with different types of memory - just like humans have. Instead of forgetting everything after each conversation, the assistant remembers who you are, what you've discussed, and what matters to you.

Think of it like the difference between:
- **Without SmartMemory**: Talking to a stranger every time
- **With SmartMemory**: Talking to a personal assistant who knows you

---

## The Four Types of Memory

### 1. Working Memory (Short-term - "What we're talking about right now")

**What it is:** The current conversation you're having.

**Real-world analogy:** Like your scratch pad or whiteboard during a meeting.

**Example in Hakivo:**
```
User: "What healthcare bills is Ted Cruz working on?"
[Agent searches and responds]
User: "What about immigration?"
[Agent remembers we're still talking about Ted Cruz - doesn't need to ask again]
```

**Key features:**
- Tracks the current conversation in real-time
- Remembers context within a session
- Can be organized into "timelines" (like tabs for different topics)

---

### 2. Episodic Memory (Long-term sessions - "What we talked about before")

**What it is:** Summaries of past conversations, stored for future reference.

**Real-world analogy:** Like your meeting notes from last week.

**Example in Hakivo:**
```
Day 1: User researches healthcare bills extensively
Day 3: User returns and asks "What were those healthcare bills again?"
[Agent finds the previous session and recalls the context]
```

**How it works:**
1. When a session ends, AI summarizes the key points
2. Summary is stored with searchable keywords
3. Later, agent can search "healthcare bills" and find that old conversation
4. Can even "rehydrate" (restore) the full conversation if needed

---

### 3. Semantic Memory (Knowledge - "Facts I know")

**What it is:** Structured information the agent "knows" about you and the world.

**Real-world analogy:** Like your contact book or a reference manual.

**Example in Hakivo:**
```json
// User's profile stored in semantic memory
{
  "user_id": "user_123",
  "district": "TX-21",
  "representatives": ["Ted Cruz", "Chip Roy"],
  "interests": ["healthcare", "immigration", "tax policy"],
  "preferred_party_filter": null,
  "notification_settings": {
    "bill_updates": true,
    "vote_alerts": true
  }
}
```

**Use cases:**
- Remember user's location/district
- Store tracked bills per user
- Keep user preferences (topics they care about)
- Store reference information about legislators

---

### 4. Procedural Memory (Skills - "How I do things")

**What it is:** Templates, procedures, and learned patterns.

**Real-world analogy:** Like your SOPs or checklists.

**Example in Hakivo:**
```markdown
# Bill Summary Template (stored procedure)
## Overview
{bill_title} ({bill_number}) was introduced by {sponsor} on {date}.

## Key Points
- Primary goal: {main_objective}
- Affected groups: {stakeholders}
- Current status: {status}

## Your Representative's Position
{rep_stance_if_available}
```

**Use cases:**
- Consistent formatting for bill summaries
- Standard response templates
- Analysis frameworks the agent has learned work well

---

## How It All Works Together

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER CONVERSATION                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      WORKING MEMORY                              │
│  "User asked about Ted Cruz healthcare bills"                    │
│  "Found 3 relevant bills: S.1234, S.5678, S.9012"               │
│  "User seems interested in bipartisan efforts"                   │
└─────────────────────────────────────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ EPISODIC MEMORY  │ │ SEMANTIC MEMORY  │ │PROCEDURAL MEMORY │
│                  │ │                  │ │                  │
│ Past sessions:   │ │ User profile:    │ │ Templates:       │
│ - Dec 1: taxes   │ │ - District: TX   │ │ - Bill summary   │
│ - Dec 3: health  │ │ - Interests:     │ │ - Vote analysis  │
│ - Dec 5: Cruz    │ │   healthcare,    │ │ - News digest    │
│                  │ │   immigration    │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## Implementation Plan for Hakivo

### Phase 1: Add SmartMemory to Manifest

```hcl
# In raindrop.manifest
application "hakivo" {
  smartmemory "congressional_memory" {}
}
```

### Phase 2: Working Memory Integration

**Goal:** Remember context within a chat session

```typescript
// chat-service.ts
async function handleChat(userId: string, message: string) {
  // Get or create working memory session
  const { sessionId, workingMemory } = await memory.startWorkingMemorySession();

  // Store the user's message
  await workingMemory.putMemory({
    content: `User asked: ${message}`,
    key: "user_message",
    agent: "congressional-assistant"
  });

  // Get recent context
  const recentMemories = await workingMemory.getMemory({ nMostRecent: 10 });

  // Pass context to agent...
}
```

### Phase 3: User Profile (Semantic Memory)

**Goal:** Remember user preferences across sessions

```typescript
// Store user preferences
await memory.putSemanticMemory({
  type: "user_profile",
  user_id: userId,
  district: "TX-21",
  tracked_bills: ["hr-1234", "s-5678"],
  interests: ["healthcare", "tax_reform"],
  representatives: ["Ted Cruz", "Chip Roy"]
});

// Later, retrieve user context
const profile = await memory.searchSemanticMemory(`user_profile ${userId}`);
```

### Phase 4: Session Summaries (Episodic Memory)

**Goal:** Remember past conversations

```typescript
// When chat session ends
await workingMemory.endSession(true); // flush=true saves to episodic memory

// Later, search past sessions
const pastSessions = await memory.searchEpisodicMemory("healthcare bills", {
  nMostRecent: 5
});
```

### Phase 5: Response Templates (Procedural Memory)

**Goal:** Consistent, high-quality responses

```typescript
const proceduralMemory = await memory.getProceduralMemory();

// Store a template
await proceduralMemory.putProcedure("bill_summary_template", `
# {bill_title}
**Number:** {bill_number}
**Sponsor:** {sponsor}
**Status:** {status}

## Summary
{summary}

## Impact on Your District
{district_impact}
`);

// Retrieve template
const template = await proceduralMemory.getProcedure("bill_summary_template");
```

---

## User Experience Improvements

| Before SmartMemory | After SmartMemory |
|-------------------|-------------------|
| "What's your ZIP code?" (every session) | Knows your district automatically |
| Generic bill summaries | Personalized summaries mentioning your rep |
| No memory of past research | "Last week you looked at healthcare bills..." |
| Same experience for everyone | Learns what topics you care about |
| Can't continue conversations | "Want to continue where we left off?" |

---

## Example Conversation Flow

### Without SmartMemory:
```
User: "What bills is my senator working on?"
Agent: "Who is your senator?"
User: "Ted Cruz"
Agent: "Here are Ted Cruz's bills..."

[Next day]
User: "Any updates on those bills?"
Agent: "Which bills? Who is your senator?"
```

### With SmartMemory:
```
User: "What bills is my senator working on?"
Agent: [Checks semantic memory - knows user is in TX]
       "Senator Cruz is currently working on 3 bills..."

[Next day]
User: "Any updates on those bills?"
Agent: [Checks episodic memory - finds yesterday's session]
       "Since yesterday, S.1234 moved to committee.
        S.5678 received 2 new co-sponsors..."
```

---

## Data Privacy Considerations

1. **User data isolation**: Each user's memory is completely separate
2. **Session isolation**: Different sessions can't access each other without explicit linking
3. **Opt-out capability**: Users can request memory deletion
4. **Transparency**: Users can see what the agent "remembers" about them

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CHAT SERVICE (Hono)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CONGRESSIONAL ASSISTANT                   │
│                      (Mastra + Cerebras)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       SMARTMEMORY                            │
│  ┌───────────────┬───────────────┬───────────────┐          │
│  │   Working     │   Episodic    │   Semantic    │          │
│  │   Memory      │   Memory      │   Memory      │          │
│  │  (KV Cache)   │ (Vector DB)   │ (SmartBucket) │          │
│  └───────────────┴───────────────┴───────────────┘          │
│  ┌───────────────────────────────────────────────┐          │
│  │            Procedural Memory (KV)             │          │
│  └───────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. [ ] Add `smartmemory "congressional_memory" {}` to manifest
2. [ ] Create memory service wrapper for chat-service
3. [ ] Implement session management (start/end/resume)
4. [ ] Add user profile storage and retrieval
5. [ ] Implement session summarization on chat end
6. [ ] Add memory search to agent context
7. [ ] Create user-facing memory management UI (optional)

---

## Resources

- [Raindrop SmartMemory Docs](https://docs.liquidmetal.ai/reference/smartmemory)
- [AI Agent Architecture Pattern](https://docs.liquidmetal.ai/reference/architecture-patterns/ai-agent)
