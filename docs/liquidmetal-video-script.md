# Hakivo - LiquidMetal Hackathon Video Script
## 3-Minute Demo for AI Championship

**Target Categories:**
- Best AI Solution for Public Good
- Best AI App by Solopreneur

---

## [0:00 - 0:20] HOOK: The Problem

**[SCREEN: Show news headlines about voter confusion, low civic engagement stats]**

**NARRATION:**
> "Only 36% of Americans can name all three branches of government. Congressional bills are thousands of pages long, and finding what affects YOU is nearly impossible."
>
> "I built Hakivo to change that."

**[SCREEN: Transition to Hakivo logo and landing page]**

---

## [0:20 - 0:45] INTRODUCTION: What is Hakivo?

**[SCREEN: Show hakivo.com homepage]**

**NARRATION:**
> "Hakivo is an AI-powered congressional assistant that makes democracy accessible. Ask questions in plain English, get real answers from real legislation."
>
> "Built entirely on the LiquidMetal Raindrop platform with Vultr storage and Cerebras for ultra-fast inference."

**[SCREEN: Show architecture diagram briefly - Raindrop + Vultr + Cerebras logos]**

---

## [0:45 - 1:15] DEMO 1: AI Chat with Real Legislative Data

**[SCREEN: Navigate to /chat]**

**NARRATION:**
> "Let's find healthcare bills. Watch how the AI uses SmartSQL to query our database of 31,000+ real bills from Congress.gov."

**[TYPE: "What healthcare bills are being considered right now?"]**

**[SCREEN: Show the query executing, bills appearing as interactive cards]**

**NARRATION:**
> "Instantly, Hakivo searches using Raindrop SmartSQL - no complex SQL needed. The AI translates my question into a database query and returns real legislation."
>
> "Each card shows the bill number, sponsor, status, and I can click to dive deeper."

---

## [1:15 - 1:45] DEMO 2: Semantic Search with SmartBucket

**[SCREEN: Click on a bill or start new query]**

**[TYPE: "Find bills about protecting Social Security benefits"]**

**NARRATION:**
> "Here's where SmartBucket shines. This uses vector search to find bills by MEANING, not just keywords."

**[SCREEN: Show bills appearing with similarity scores]**

**NARRATION:**
> "Raindrop SmartBucket has indexed the full text of every bill. Even if a bill doesn't mention 'Social Security' directly, semantic search finds relevant legislation."
>
> "The matched content shows exactly why each bill is relevant to my query."

---

## [1:45 - 2:10] DEMO 3: AI Audio Briefs (Voice Integration)

**[SCREEN: Navigate to Dashboard or Audio Briefs section]**

**NARRATION:**
> "Hakivo generates personalized audio briefs so you can stay informed while commuting."

**[SCREEN: Show audio player with a brief, play a few seconds]**

**NARRATION:**
> "The brief generator uses Cerebras for ultra-fast script generation - under 200ms per response. Then ElevenLabs creates natural-sounding audio."
>
> "Audio files are stored on Vultr Object Storage for instant global delivery."

**[SCREEN: Show Vultr storage bucket URL briefly]**

---

## [2:10 - 2:35] DEMO 4: SmartMemory Personalization

**[SCREEN: Track a bill, then show it appearing in user's tracked list]**

**NARRATION:**
> "Track bills that matter to you. Hakivo uses SmartMemory to remember your interests across sessions."

**[TYPE: "Track this bill" or click Track button]**

**[SCREEN: Show Settings page with usage stats and tracked bills]**

**NARRATION:**
> "SmartMemory has four layers - working memory for current conversations, episodic for session history, semantic for your preferences, and procedural for learned actions."
>
> "Next time I log in, Hakivo remembers what I care about."

---

## [2:35 - 2:55] Technical Architecture Recap

**[SCREEN: Show quick architecture overview or code snippet of raindrop.manifest]**

**NARRATION:**
> "Under the hood: 20+ Raindrop services, SmartSQL for natural language queries, SmartBucket for bill text search, SmartMemory for personalization."
>
> "Vultr Object Storage for audio files. Cerebras for sub-200ms AI inference. All deployed on the Raindrop platform."

**[SCREEN: Show deployed services list briefly]**

---

## [2:55 - 3:00] CLOSING: Call to Action

**[SCREEN: Show hakivo.com with signup]**

**NARRATION:**
> "Democracy should be accessible to everyone. Try Hakivo free at hakivo.com."
>
> "Built for the LiquidMetal AI Championship. Thank you."

**[SCREEN: Hakivo logo + LiquidMetal + Vultr + Cerebras logos]**

---

## Technical Integration Checklist (for judges)

### Raindrop Smart Components Used:
- **SmartSQL** (`congressional-db`) - Natural language to SQL for bill queries
- **SmartBucket** (`bill-texts`, `audio-briefs`) - Vector search for semantic bill lookup + audio storage
- **SmartMemory** (`congressional_memory`) - User preferences, tracked bills, conversation history
- **SmartInference** - via Cerebras integration for fast AI responses

### Vultr Integration:
- **Vultr Object Storage** - Stores audio brief MP3 files
- 4 env vars: `VULTR_ENDPOINT`, `VULTR_ACCESS_KEY`, `VULTR_SECRET_KEY`, `VULTR_BUCKET_NAME`
- Public URLs for audio streaming

### Cerebras Integration:
- **Cerebras API** for ultra-low latency inference
- `CEREBRAS_API_KEY` configured
- Used in `cerebras-client` service
- Sub-200ms response times for brief script generation

### Additional Integrations:
- **ElevenLabs** - Text-to-speech for audio briefs
- **Congress.gov API** - Real legislative data (31,000+ bills)
- **OpenStates API** - State legislation
- **Perplexity API** - Real-time news search
- **Stripe** - Subscription payments (Pro tier at $12/month)
- **WorkOS** - Authentication

---

## B-Roll Suggestions

1. Dashboard with usage stats
2. Bills carousel scrolling
3. Audio player playing a brief
4. Settings page showing tracked bills
5. Chat interface with typing animation
6. Mobile responsive view

---

## Key Talking Points for Judges

1. **Real Problem**: Civic engagement is broken - people can't engage with government because the information is inaccessible
2. **Real Data**: 31,000+ actual bills from Congress.gov, updated daily
3. **Raindrop-Native**: Built specifically for Raindrop - uses SmartSQL, SmartBucket, SmartMemory
4. **Launch Ready**: Working auth, payments, real users
5. **Public Good**: Making democracy accessible to everyone, not just lobbyists with researchers
