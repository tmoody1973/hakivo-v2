# Hakivo Congressional Assistant - Hackathon Demo Script

## Overview

Hakivo is an AI-powered congressional assistant that helps citizens engage with democracy. It uses:
- **Mastra.ai** for agent orchestration
- **thesys C1** for generative UI
- **Raindrop** for SmartSQL, SmartBucket, and SmartMemory
- **Real Congress.gov data** with 31,000+ bills

---

## Demo Flow (5-7 minutes)

### 1. Introduction (30 seconds)

**Narrator:** "Meet Hakivo, your personal congressional assistant. Let me show you how easy it is to stay informed about legislation that matters to you."

*Navigate to: `/chat`*

---

### 2. Bill Discovery (1 minute)

**Query:** "What healthcare bills are being considered in Congress right now?"

**Expected Response:**
- AI provides summary of current healthcare legislation
- **BillCard** components render for each bill showing:
  - Bill number (e.g., H.R. 5996)
  - Title
  - Sponsor with party affiliation
  - Current status badge
  - Last action date
  - "Track" button

**Demo Points:**
- Natural language understanding
- Real-time data from Congress.gov
- Interactive UI components

---

### 3. Representative Information (1 minute)

**Query:** "Who are my representatives?" (assuming user is in California)

**Expected Response:**
- **RepresentativeProfile** cards showing:
  - Photo
  - Name and party
  - District (e.g., CA-12)
  - Contact information (phone, website)
  - Committee assignments
  - Party alignment score

**Demo Points:**
- Personalized based on user's location
- Actionable contact buttons
- Comprehensive member data

---

### 4. Voting Record Analysis (1 minute)

**Query:** "How did Nancy Pelosi vote on the One Big Beautiful Bill Act?"

**Expected Response:**
- **VotingChart** component showing:
  - Vote result (Passed/Failed)
  - Yea vs Nay breakdown
  - Party split visualization
  - User's representative highlighted
  - Expandable party breakdown

**Demo Points:**
- Deep voting data analysis
- Visual representation of partisan voting
- Personal relevance (your rep's vote)

---

### 5. Bill Tracking (45 seconds)

**Query:** "Track H.R. 5996 for me"

**Expected Response:**
- Confirmation message
- Bill added to user's tracked bills
- Stored in SmartMemory semantic layer
- User will receive updates on status changes

**Demo Points:**
- Persistent user preferences
- SmartMemory integration
- Notification capability

---

### 6. News Search (1 minute)

**Query:** "What's in the news about immigration policy?"

**Expected Response:**
- **NewsCard** grid showing:
  - Headlines from major outlets
  - Source and publication date
  - Snippets with key information
  - Relevance indicators
  - Click-through links

**Demo Points:**
- Tavily integration for current news
- Contextual relevance scoring
- Multi-source coverage

---

### 7. Conversation Memory (45 seconds)

**Action:** Start a new session, then ask:

**Query:** "What bills am I tracking?"

**Expected Response:**
- AI recalls tracked bills from previous session
- Shows H.R. 5996 (tracked earlier)
- Maintains user preferences across sessions

**Demo Points:**
- SmartMemory episodic layer
- Session persistence
- Personalized experience

---

### 8. State Legislation (Optional, 45 seconds)

**Query:** "Show me California bills about climate change"

**Expected Response:**
- State bills from OpenStates
- Similar card-based UI
- State-specific legislative data

**Demo Points:**
- Comprehensive coverage (federal + state)
- OpenStates API integration
- Same intuitive interface

---

## Technical Highlights to Mention

1. **Real Data**: 31,000+ bills from Congress.gov, updated daily
2. **AI-Powered**: Claude + GPT-4o via SmartInference routing
3. **Generative UI**: thesys C1 renders interactive components
4. **Memory**: SmartMemory with 4 layers (working, episodic, semantic, procedural)
5. **RAG**: SmartBucket for bill text search and analysis
6. **State Coverage**: 50 state legislatures via OpenStates

---

## Backup Queries (if needed)

- "What's the status of the debt ceiling bill?"
- "Show me bills sponsored by my senator"
- "Compare the voting records of both California senators"
- "Generate a briefing on this week's congressional activity"
- "What committees is Alexandria Ocasio-Cortez on?"

---

## Troubleshooting

If chat doesn't respond:
1. Check browser console for errors
2. Verify API keys in `.env.local`
3. Ensure Raindrop services are running
4. Fallback: Use pre-recorded demo

---

## Key Differentiators

1. **Not just search** - Interactive, actionable UI
2. **Personalized** - Knows your district, tracks your interests
3. **Comprehensive** - Federal AND state legislation
4. **Memory** - Remembers across sessions
5. **Real-time** - Current news + live legislative data
