# Hakivo Congressional Assistant Feature - LinkedIn Post

---

**I Built My First AI Agent: Meet Hakivo's Congressional Assistant**

Hakivo just got a major upgrade - and it's the first AI agent I've ever built.

The new Congressional Assistant feature turns Hakivo from a civic information tool into a personalized AI companion that actually knows you and your policy priorities.

**The Problem With Generic AI**

Ask ChatGPT "what bills match my interests?" and it has no idea who you are. It can't tell you what your representatives are working on because it doesn't know your representatives.

Hakivo's Congressional Assistant is different. It remembers:
- Your policy interests (healthcare, climate, education, etc.)
- Your congressional district and state legislators
- Bills you're tracking
- Representatives you follow

When you ask a question, it personalizes the response to YOU.

**Powered by LiquidMetal's Raindrop**

The assistant is built on Raindrop's "Smart" primitives - infrastructure designed specifically for AI applications:

🔷 **SmartSQL** - Natural language queries against structured data. The assistant describes what it wants, SmartSQL figures out the query. No SQL required.

🔷 **SmartMemory** - Per-user memory that persists across sessions. Your interests, tracked bills, and saved representatives are always available.

🔷 **SmartBuckets** - Semantic search across documents. Not keyword matching - actual understanding of bill text and committee reports.

**Real-Time News via Perplexity**

The assistant also integrates with Perplexity's API for real-time news search. When you ask about current events or recent coverage on a bill or representative, it queries Perplexity to find the latest articles from major outlets - complete with sources and citations.

This means the assistant can answer questions like "What's the latest news about the farm bill?" with actual recent coverage, not just database records.

**The Agent's Toolkit**

These capabilities become tools the assistant orchestrates based on your question:

📊 **Database Queries** - 50,000+ bills, voting records, FEC campaign finance data via SmartSQL
🧠 **User Memory** - Your preferences and tracked legislation via SmartMemory
📰 **News Search** - Real-time coverage from major outlets via Perplexity
📍 **Location Services** - Find your reps by address or zip code
📄 **Document Search** - Bill text and committee reports via SmartBuckets

**Dynamic UI with CopilotKit**

The frontend uses CopilotKit to connect to the Mastra agent via the AG-UI protocol. But the real magic is Generative UI.

When the agent calls a tool, the chat doesn't just return text - it renders custom React components:
- **Bill Cards** - Legislation with sponsor, status, and latest actions
- **Representative Profiles** - Member info with contact details and committee assignments
- **News Cards** - Articles with sources and publication dates

Using `useRenderToolCall` hooks, the UI watches for specific tool executions and renders the appropriate component. The result is an interactive dashboard that builds itself based on your questions - not a wall of text.

**Example**

You: *"What healthcare bills are my senators working on?"*

The assistant:
1. Pulls your saved senators from SmartMemory
2. Queries healthcare legislation via SmartSQL
3. Searches for recent news via Perplexity
4. Renders interactive bill cards through CopilotKit's Generative UI

One question. Multiple data sources. Personalized, visual results.

**What I Learned Building My First Agent**

A few takeaways from adding this feature to Hakivo:

1. **Tool design matters more than prompts** - Clear, focused tools with good descriptions let the LLM make smart decisions
2. **Memory changes everything** - The jump from stateless chatbot to personalized assistant is massive for UX
3. **Frameworks accelerate development** - Mastra and CopilotKit handled the hard parts so I could focus on the congressional domain logic
4. **Build for a real problem** - Civic engagement kept me motivated through the debugging sessions

**Why This Feature Matters**

Congress passes thousands of bills. Your representatives cast hundreds of votes. Hakivo's Congressional Assistant makes it possible to stay informed without becoming a full-time researcher.

Ask anything. Get personalized answers. Stay engaged.

**Check out Hakivo:**
🔗 GitHub: github.com/tmoody1973/hakivo-v2

What would you ask a congressional assistant? I'd love to hear what features would be most useful.

---

#BuildInPublic #CivicTech #AI #AgenticAI #Congress #Democracy #TechForGood #Mastra #CopilotKit #LiquidMetal #Raindrop
