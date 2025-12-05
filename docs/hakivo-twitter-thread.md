# Hakivo Building in Public - Twitter Thread

*For X Premium (expanded character limit)*

---

## Tweet 1/9

Building Hakivo in public - a congressional assistant that actually knows you and your policy interests.

Here's how we're combining LiquidMetal's Raindrop platform (SmartSQL, SmartMemory, SmartBuckets) + Mastra AI agents + CopilotKit to create personalized civic engagement that scales.

This is the future of how citizens interact with their government. Thread 🧵👇

---

## Tweet 2/9 - The Architecture

**The Architecture**

Frontend: Next.js 15 + CopilotKit for the conversational UI
Backend: Mastra agents with custom tools for each data source
Infrastructure: Raindrop's "Smart" primitives handle all the heavy lifting

The key insight: instead of building a monolithic app, we compose specialized AI tools that the agent orchestrates based on user intent. Ask anything about Congress and the right tools fire automatically.

---

## Tweet 3/9 - SmartSQL

**SmartSQL - The Congressional Database**

This is where Raindrop shines. We have:
- 50,000+ bills from the 118th and 119th Congress
- Complete member profiles with voting records
- Campaign finance data synced from FEC
- Committee assignments and leadership roles
- Bill cosponsors and action history

One natural language query → structured SQL → typed results. The agent doesn't need to know SQL - it just describes what it wants and SmartSQL figures out the query.

Example: "Find healthcare bills sponsored by California Democrats" just works.

---

## Tweet 4/9 - SmartMemory

**SmartMemory - Personalization That Persists**

This is what makes Hakivo different from ChatGPT with a Congress prompt.

SmartMemory stores per-user:
- Policy interests (healthcare, climate, education, etc.)
- Their congressional district and state legislators
- Bills they're tracking
- Representatives they follow

When you ask "what's new with my interests?" - it actually knows. The agent pulls your preferences, queries relevant bills, and filters by what matters to YOU.

No more generic responses. Your assistant, your priorities.

---

## Tweet 5/9 - SmartBuckets

**SmartBuckets - Document Intelligence at Scale**

Congress produces massive amounts of text - bill full text, committee reports, CRS summaries, hearing transcripts.

SmartBuckets provides semantic search across all of it. Not keyword matching - actual understanding.

"Find bills similar to the Inflation Reduction Act's climate provisions" searches across document embeddings to surface related legislation you might have missed.

This is RAG done right - retrieval that actually retrieves what you need.

---

## Tweet 6/9 - Mastra

**Mastra - Agent Orchestration**

Mastra is the brain that ties it all together. Each tool is defined with:
- Clear descriptions so the LLM knows when to use it
- Typed input/output schemas
- Access to RuntimeContext for user auth

The system prompt gives the agent congressional expertise - it knows the difference between HR and S bills, understands the legislative process, and can explain committee jurisdictions.

But the real power is tool composition. One question might trigger SmartMemory → SmartSQL → news search in sequence.

---

## Tweet 7/9 - CopilotKit

**CopilotKit - Frontend Magic**

CopilotKit connects React to Mastra via the AG-UI protocol. But the killer feature is Generative UI.

When the agent calls a tool, we render custom React components:
- `BillCard` for legislation with sponsor, status, last action
- `RepresentativeProfile` for members with contact info
- `NewsCard` for related articles

`useRenderToolCall` hooks watch for specific tools and render appropriate UI. The chat isn't just text - it's an interactive dashboard that builds itself based on your questions.

---

## Tweet 8/9 - User Experience

**The User Experience**

Ask: "Find bills about climate change from my senator"

Behind the scenes:
1. SmartMemory → retrieves your saved representatives
2. SmartSQL → queries bills filtered by sponsor + topic keywords
3. News search → finds recent coverage
4. Generative UI → renders interactive bill cards with actions

All in one natural conversation. No clicking through congress.gov. No searching multiple sites. Just ask.

---

## Tweet 9/9 - Call to Action

**Why Build This in Public?**

Civic tech is underfunded and underbuilt. Most people have no idea what their representatives are doing, what bills affect them, or how to engage.

AI can bridge that gap - but only if we build tools that are actually useful, not just demos.

Hakivo is open source because democracy works better when citizens are informed, and more builders should be working on this problem.

Code: github.com/tmoody1973/hakivo-v2

What congressional feature would help you stay informed? Drop ideas below 👇

---

## Suggested Hashtags

- #BuildInPublic
- #CivicTech
- #AI
- #OpenSource
- #Mastra
- #CopilotKit
- #LiquidMetal

## Suggested Mentions

- @maaboroshi (LiquidMetal/Raindrop)
- @CopilotKit
- @maaboroshi (Mastra)
