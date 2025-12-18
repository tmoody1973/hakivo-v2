# Hakivo ChatGPT App Strategy

## Executive Summary

Build a ChatGPT app called **"Hakivo Legislative Intelligence"** that provides real-time access to legislative data, bill analysis, and member voting records. The app serves as a gateway to the full Hakivo platform, converting engaged ChatGPT users into Hakivo subscribers through demonstrated value.

---

## Strategic Rationale

### Why ChatGPT?

1. **Massive Reach**: 200M+ weekly active users on ChatGPT
2. **Intent-Rich Audience**: Users asking about legislation are high-intent prospects
3. **Natural Discovery**: People already ask ChatGPT about bills and politics—we intercept that intent
4. **Trust Transfer**: Being in the ChatGPT app store signals legitimacy
5. **Conversational Fit**: Legislative research is naturally conversational

### The Funnel

```
ChatGPT User → Asks about legislation → Hakivo app activated
       ↓
   Gets valuable answer with Hakivo attribution
       ↓
   Sees CTA: "Track this bill" or "Get full brief"
       ↓
   Clicks through to Hakivo → Sign up → Paid conversion
```

---

## Value Proposition (Know/Do/Show Framework)

### Know: Data ChatGPT Doesn't Have

| Data Type | ChatGPT Alone | With Hakivo App |
|-----------|---------------|-----------------|
| Bill status | Outdated (training cutoff) | **Real-time from Congress API** |
| Voting records | Limited historical | **Current session + history** |
| Campaign finance | None | **FEC data + bill connections** |
| Related legislation | Guesswork | **Semantic similarity analysis** |
| Member positions | General knowledge | **Voting patterns + statements** |

### Do: Actions We Enable

| Action | Value |
|--------|-------|
| Search legislation semantically | "Find bills about AI regulation" |
| Track bill progress | Alert when status changes |
| Generate legislative briefs | AI-enriched context documents |
| Compare legislation | Side-by-side analysis |

### Show: Visual Clarity

| Visualization | Purpose |
|---------------|---------|
| Bill status timeline | Track legislative journey |
| Voting breakdown charts | See party-line vs. bipartisan |
| Campaign finance connections | Follow the money |
| Comparison tables | Evaluate similar bills |

---

## Core Capabilities (5 Tools)

Following OpenAI's guidance: **focused, not comprehensive**.

### 1. `search_legislation`

**Purpose**: Semantic search across all Congressional bills

```
User: "What bills are being proposed about cryptocurrency?"
→ Returns top 5 relevant bills with title, status, sponsors, summary
```

**Parameters**:
- `query` (required): Natural language search
- `congress` (optional): Limit to specific Congress (default: current)
- `status` (optional): Filter by status (introduced, passed_house, etc.)

**Response**: Structured list with `bill_id`, `title`, `status`, `sponsors`, `summary`, `hakivo_url`

### 2. `get_bill_details`

**Purpose**: Deep dive on specific legislation

```
User: "Tell me about HR 1234"
→ Returns comprehensive bill analysis
```

**Parameters**:
- `bill_id` (required): e.g., "hr1234-119" or "S.567"

**Response**:
- Full summary (AI-generated)
- Current status with timeline
- Sponsors and cosponsors
- Related bills
- Recent actions
- Key provisions
- `hakivo_url` for full brief

### 3. `find_member_votes`

**Purpose**: Voting records and positions

```
User: "How did AOC vote on the debt ceiling bill?"
→ Returns vote with context
```

**Parameters**:
- `member` (required): Name or bioguide ID
- `bill_id` (optional): Specific bill
- `topic` (optional): Topic area for voting pattern

**Response**:
- Vote (Yea/Nay/Present/Not Voting)
- Voting context (party breakdown, outcome)
- Member's stated position if available
- Pattern analysis if topic provided

### 4. `explain_impact`

**Purpose**: What does legislation mean for specific groups/topics?

```
User: "How would the RESTRICT Act affect TikTok users?"
→ Returns impact analysis with sources
```

**Parameters**:
- `bill_id` (required): The legislation
- `perspective` (required): Group, industry, or topic

**Response**:
- Impact summary
- Key provisions affecting this group
- News context (from Perplexity/Exa)
- Stakeholder positions
- `hakivo_url` for full report

### 5. `compare_bills`

**Purpose**: Side-by-side legislation comparison

```
User: "Compare the House and Senate AI bills"
→ Returns structured comparison
```

**Parameters**:
- `bill_ids` (required): Array of 2-4 bill IDs

**Response**:
- Comparison table (sponsors, status, key differences)
- Shared provisions
- Conflicting provisions
- Likelihood of reconciliation

---

## User Experience Design

### First Interaction

When Hakivo is first invoked:

> "I'm Hakivo, your legislative intelligence assistant. I can search bills, explain legislation, check voting records, and analyze policy impacts using real-time Congressional data. What would you like to know?"

**One line. Immediate value. No onboarding.**

### Handling Vague Intent

```
User: "What's Congress doing about AI?"

Response: "Here are the 5 most significant AI-related bills in the current Congress:

1. **S.2714 - AI Research Act** (In Committee)
   Sponsors: Sen. Schumer, Sen. Rounds
   Summary: Establishes federal AI research priorities...

[... 4 more bills ...]

Want me to dive deeper into any of these, or search for something more specific?"
```

### Handling Specific Intent

```
User: "Did my representative vote for the infrastructure bill?"

Response: "I'll need to know your representative. Who represents you, or what's your ZIP code?"

User: "Mike Johnson, Louisiana"

Response: "Rep. Mike Johnson (R-LA-04) voted **NAY** on H.R.3684 - Infrastructure Investment and Jobs Act.

**Vote breakdown**: 228-206 (13 Republicans voted Yes)
**Date**: November 5, 2021
**Bill Status**: Signed into law

Track Rep. Johnson's votes on Hakivo → [link]"
```

### Call-to-Action Strategy

Every response includes a contextual, non-intrusive CTA:

| Context | CTA |
|---------|-----|
| Bill lookup | "Track this bill's progress on Hakivo →" |
| Member votes | "See [Member]'s full voting record →" |
| Impact analysis | "Get the complete legislative brief →" |
| Search results | "Set up alerts for [topic] bills →" |

---

## Technical Architecture

### Design Philosophy: Gateway Pattern

**Don't rebuild what exists.** Hakivo already has robust services for bills, members, search, and enrichment running on Raindrop. The ChatGPT app should be a **thin gateway layer** that:

1. Receives ChatGPT action requests
2. Translates them to existing Hakivo API calls
3. Formats responses for ChatGPT consumption
4. Adds CTAs and deep links to hakivo.com

### Architecture Diagram

```
┌─────────────────┐     ┌─────────────────────────────────────────┐
│   ChatGPT       │     │           hakivo.com (Netlify)          │
│   (OpenAI)      │────▶│  /api/chatgpt/* (Next.js API Routes)    │
└─────────────────┘     │                                         │
                        │  ┌─────────────────────────────────┐    │
                        │  │  ChatGPT Gateway Layer          │    │
                        │  │  - Request translation          │    │
                        │  │  - Response formatting          │    │
                        │  │  - CTA injection                │    │
                        │  │  - Analytics tracking           │    │
                        │  └──────────────┬──────────────────┘    │
                        └─────────────────┼───────────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
        ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
        │ bills-service     │ │ members-service   │ │ briefs-service    │
        │ (Raindrop)        │ │ (Raindrop)        │ │ (Raindrop)        │
        │                   │ │                   │ │                   │
        │ • Bill search     │ │ • Member lookup   │ │ • Brief generation│
        │ • Bill details    │ │ • Voting records  │ │ • Enrichment      │
        │ • Semantic search │ │ • Positions       │ │ • News context    │
        └───────────────────┘ └───────────────────┘ └───────────────────┘
```

### Why This Architecture?

| Approach | Pros | Cons |
|----------|------|------|
| **Gateway to existing APIs** ✅ | Fast to build, single source of truth, no duplicate data | Depends on Raindrop uptime |
| Standalone rebuild | Independent | Duplicates work, data sync issues, slower |
| Direct Raindrop exposure | Simplest | No customization for ChatGPT, no CTA injection |

### Implementation: Next.js API Routes

The gateway lives in the existing hakivo.com Next.js app:

```
app/
├── api/
│   └── chatgpt/
│       ├── search/
│       │   └── route.ts      # search_legislation action
│       ├── bill/
│       │   └── [billId]/
│       │       └── route.ts  # get_bill_details action
│       ├── votes/
│       │   └── route.ts      # find_member_votes action
│       ├── impact/
│       │   └── route.ts      # explain_impact action
│       └── compare/
│           └── route.ts      # compare_bills action
```

### Example Gateway Route

```typescript
// app/api/chatgpt/search/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BILLS_API = process.env.NEXT_PUBLIC_BILLS_API_URL;

export async function POST(request: NextRequest) {
  const { query, congress, status } = await request.json();

  // Call existing Hakivo bills-service
  const response = await fetch(`${BILLS_API}/bills/semantic-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, congress, status, limit: 5 }),
  });

  const bills = await response.json();

  // Format for ChatGPT with CTAs
  const formatted = {
    results: bills.map((bill: any) => ({
      bill_id: bill.bill_id,
      title: bill.title,
      status: bill.status,
      sponsors: bill.sponsors,
      summary: bill.ai_summary || bill.summary,
      // Deep link to hakivo.com
      hakivo_url: `https://hakivo.com/bills/${bill.bill_id}?utm_source=chatgpt`,
    })),
    cta: {
      message: "Track these bills and get alerts on Hakivo",
      url: `https://hakivo.com/search?q=${encodeURIComponent(query)}&utm_source=chatgpt`,
    },
  };

  return NextResponse.json(formatted);
}
```

### Existing Raindrop Services to Leverage

| Service | Endpoint | ChatGPT Action |
|---------|----------|----------------|
| bills-service | `/bills/semantic-search` | `search_legislation` |
| bills-service | `/bills/:id` | `get_bill_details` |
| members-service | `/members/:id/votes` | `find_member_votes` |
| briefs-service | `/enrich` | `explain_impact` |
| bills-service | `/bills/compare` | `compare_bills` (may need to add) |

### Authentication

ChatGPT actions support:
1. **No auth** - For public read-only data (our case for MVP)
2. **API Key** - Simple header-based auth
3. **OAuth** - Full user authentication

**Recommendation**: Start with no auth for read operations. Add API key if abuse occurs. Consider OAuth later for user-specific features (tracking, saved searches).

### Action Schema (OpenAPI 3.1)

```yaml
openapi: 3.1.0
info:
  title: Hakivo Legislative Intelligence
  version: 1.0.0
  description: Real-time access to Congressional legislation, voting records, and policy analysis

servers:
  - url: https://hakivo.com/api/chatgpt

paths:
  /search:
    post:
      operationId: search_legislation
      summary: Search bills and legislation

  /bill/{bill_id}:
    get:
      operationId: get_bill_details
      summary: Get comprehensive bill details

  /votes:
    post:
      operationId: find_member_votes
      summary: Find voting records

  /impact:
    post:
      operationId: explain_impact
      summary: Analyze legislation impact

  /compare:
    post:
      operationId: compare_bills
      summary: Compare multiple bills
```

---

## Growth & Conversion Metrics

### Key Metrics to Track

| Metric | Target | Purpose |
|--------|--------|---------|
| App activations | 10K/week | Awareness |
| Queries per session | 2.5+ | Engagement |
| Click-through to Hakivo | 15%+ | Interest |
| Sign-ups from ChatGPT | 5% of CTR | Conversion |
| Paid conversion from ChatGPT users | 2% | Revenue |

### Attribution

Add UTM parameters to all Hakivo links:
```
https://hakivo.com/bills/hr1234?utm_source=chatgpt&utm_medium=app&utm_campaign=bill_lookup
```

Track in analytics:
- Which queries drive most traffic
- Which CTAs convert best
- Drop-off points in conversion funnel

---

## Competitive Moat

### Why Hakivo Wins

1. **Data Freshness**: Real-time Congress API integration
2. **Semantic Understanding**: Not just keyword search
3. **Enrichment Layer**: News context, campaign finance connections
4. **Opinionated Summaries**: AI-generated, not raw text dumps
5. **Action Path**: From insight to tracking to briefing

### Differentiation from GovTrack, Congress.gov

| Feature | Others | Hakivo |
|---------|--------|--------|
| Raw data access | ✓ | ✓ |
| AI-powered summaries | ✗ | ✓ |
| News context | ✗ | ✓ |
| Campaign finance links | ✗ | ✓ |
| Brief/report generation | ✗ | ✓ |
| ChatGPT integration | ✗ | ✓ |

---

## Implementation Phases

### Phase 1: MVP (1 week)

Since we're building a thin gateway to existing APIs, development is fast:

- [ ] Create `/app/api/chatgpt/` directory structure
- [ ] Implement `search_legislation` gateway route (calls bills-service)
- [ ] Implement `get_bill_details` gateway route (calls bills-service)
- [ ] Create OpenAPI spec for ChatGPT
- [ ] Test with ChatGPT action builder
- [ ] Submit to ChatGPT app store

**Existing endpoints to use:**
- `GET /bills/semantic-search` → search_legislation
- `GET /bills/:id` → get_bill_details

### Phase 2: Core Features (1 week)

- [ ] Implement `find_member_votes` gateway route (calls members-service)
- [ ] Implement `explain_impact` gateway route (calls briefs-service enrichment)
- [ ] Add UTM tracking to all hakivo.com links
- [ ] Set up PostHog events for ChatGPT actions
- [ ] Optimize response formatting for ChatGPT display

**Existing endpoints to use:**
- `GET /members/:id` → member lookup
- `GET /members/:id/votes` → voting records (may need to add)
- `POST /enrich` → impact analysis

### Phase 3: Polish & Growth (1 week)

- [ ] Implement `compare_bills` gateway route
- [ ] Add `/bills/compare` endpoint to bills-service if needed
- [ ] A/B test different CTA messages
- [ ] Create landing page for ChatGPT users (`/from-chatgpt`)
- [ ] Write blog post announcing the integration

### Phase 4: Premium Features (Ongoing)

- [ ] OAuth integration for logged-in Hakivo users
- [ ] "Save to my tracked bills" action
- [ ] Direct brief generation (calls gamma integration)
- [ ] Personalized recommendations based on Hakivo history

---

## Marketing Angle

### Launch Messaging

> "Finally, real-time legislative intelligence in ChatGPT. Track bills, understand votes, and follow the money—all in conversation."

### Target Audiences for Promotion

1. **Political Twitter/X**: Journalists, analysts, wonks
2. **Civic Tech Community**: Code for America, civic hackers
3. **Policy Professionals**: LinkedIn, industry newsletters
4. **Students**: University political science departments
5. **Advocacy Groups**: Organizations tracking specific issues

### Content Marketing

- Blog post: "How to Research Legislation with ChatGPT"
- Twitter thread: "5 ways to use Hakivo in ChatGPT"
- YouTube: Demo video showing real queries
- Newsletter: Weekly "Bill of the Week" featuring ChatGPT integration

---

## Risk Mitigation

### Potential Issues

| Risk | Mitigation |
|------|------------|
| Rate limits from OpenAI | Implement caching, optimize token usage |
| Data accuracy concerns | Clear sourcing, disclaimer about real-time nature |
| Competition from OpenAI native | Focus on proprietary enrichment layer |
| Low conversion | Test different CTAs, optimize funnel |
| API costs | Usage-based limits, prioritize high-intent queries |

---

## Success Criteria

### 3-Month Goals

1. **5,000+ weekly active users** in ChatGPT app
2. **500+ click-throughs** to Hakivo per week
3. **50+ sign-ups** attributed to ChatGPT per week
4. **10+ paid conversions** from ChatGPT users per month

### 6-Month Goals

1. **25,000+ weekly active users**
2. Featured in ChatGPT "Popular Apps"
3. ChatGPT as top-3 traffic source for Hakivo
4. Self-sustaining growth from word-of-mouth

---

## Next Steps

1. **Review this strategy** - Confirm the gateway approach makes sense
2. **Audit existing Raindrop endpoints** - Verify all needed endpoints exist
3. **Create `/app/api/chatgpt/` routes** - Build the gateway layer
4. **Write OpenAPI spec** - Document actions for ChatGPT
5. **Test in ChatGPT Action Builder** - Validate the integration works
6. **Submit to ChatGPT app store** - Get listed
7. **Create `/from-chatgpt` landing page** - Optimize conversion
8. **Launch marketing campaign** - Announce on Twitter, LinkedIn, etc.

---

*Created: December 2024*
*Last Updated: December 2024*
