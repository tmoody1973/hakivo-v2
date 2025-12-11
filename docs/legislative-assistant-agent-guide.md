# Legislative Assistant AI Agent - Complete Implementation Guide

> **Purpose**: This comprehensive guide provides everything needed to build a Mastra-based legislative assistant agent with Thesys C1 generative UI components. Give this document to Claude Code to implement the full system.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Environment Setup](#3-environment-setup)
4. [Database Schema](#4-database-schema)
5. [API Reference](#5-api-reference)
6. [Tool Implementations](#6-tool-implementations)
7. [Web Search Tool for News](#7-web-search-tool-for-news)
8. [Thesys C1 UI Components](#8-thesys-c1-ui-components)
9. [News Carousel Component](#9-news-carousel-component)
10. [Complete Agent Assembly](#10-complete-agent-assembly)
11. [Testing & Deployment](#11-testing--deployment)

---

## 1. Project Overview

### What We're Building

A comprehensive legislative assistant AI agent that:

- **Tracks legislation**: Bills, amendments, votes, sponsors
- **Monitors executive actions**: Regulations, Executive Orders, agency rules
- **Provides member intelligence**: Voting records, committee assignments, contact info
- **Searches news**: Real-time coverage of legislative issues, policies, members
- **Generates outputs**: Constituent letters, briefings, vote recommendations
- **Renders dynamic UI**: Interactive components via Thesys C1

### Target Users

- Congressional staffers and legislative aides
- Journalists covering Congress
- Civic technology platforms (like Hakivo)
- Advocacy organizations
- Researchers and students

### Tech Stack

| Component | Technology |
|-----------|------------|
| Agent Framework | Mastra (TypeScript) |
| LLM | Claude Sonnet 4 (Anthropic) |
| Generative UI | Thesys C1 + Crayon SDK |
| Database | SQLite3 (local cache) |
| APIs | Congress.gov, LegiScan, Federal Register, Regulations.gov |
| News Search | Google Gemini with Google Search Grounding |

---

## 2. Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Thesys C1 React SDK                       │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │    │
│  │  │Bill Card │ │Vote Chart│ │Member    │ │News Carousel │   │    │
│  │  │Component │ │Component │ │Profile   │ │Component     │   │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      MASTRA AGENT LAYER                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              Legislative Assistant Agent                     │    │
│  │                                                              │    │
│  │  Instructions (System Prompt)                                │    │
│  │  Model: Claude Sonnet 4                                      │    │
│  │  Tools: [see below]                                          │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         TOOL LAYER                                   │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │ LEGISLATION    │  │ MEMBERS        │  │ VOTES          │        │
│  │ ─────────────  │  │ ─────────────  │  │ ─────────────  │        │
│  │ billLookup     │  │ memberLookup   │  │ getVoteDetails │        │
│  │ billSearch     │  │ membersByState │  │ getBillVotes   │        │
│  │ billTextSearch │  │ committeeLookup│  │ memberVotes    │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │ EXECUTIVE      │  │ NEWS           │  │ OUTPUT         │        │
│  │ ─────────────  │  │ ─────────────  │  │ ─────────────  │        │
│  │ fedRegSearch   │  │ newsSearch     │  │ constituentDraft│       │
│  │ getExecOrders  │  │ memberNews     │  │ briefingGen    │        │
│  │ searchRulemaking│ │ issueNews      │  │ voteRecGenerator│       │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                     │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Congress.gov │  │ LegiScan     │  │ Federal      │              │
│  │ API          │  │ API          │  │ Register API │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Regulations  │  │ Gemini       │  │ Local SQLite │              │
│  │ .gov API     │  │ API          │  │ (Members)    │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
legislative-assistant/
├── src/
│   ├── mastra/
│   │   ├── index.ts                 # Mastra instance configuration
│   │   ├── agents/
│   │   │   └── legislativeAssistant.ts
│   │   ├── tools/
│   │   │   ├── legislation/
│   │   │   │   ├── billLookup.ts
│   │   │   │   ├── billSearch.ts
│   │   │   │   └── billTextSearch.ts
│   │   │   ├── members/
│   │   │   │   ├── memberLookup.ts
│   │   │   │   ├── membersByState.ts
│   │   │   │   └── committeeLookup.ts
│   │   │   ├── votes/
│   │   │   │   ├── getVoteDetails.ts
│   │   │   │   ├── getBillVotes.ts
│   │   │   │   └── memberVotingRecord.ts
│   │   │   ├── executive/
│   │   │   │   ├── federalRegisterSearch.ts
│   │   │   │   ├── federalRegisterDocument.ts
│   │   │   │   ├── getExecutiveOrders.ts
│   │   │   │   └── searchRulemaking.ts
│   │   │   ├── news/
│   │   │   │   ├── newsSearch.ts
│   │   │   │   ├── memberNews.ts
│   │   │   │   └── issueNews.ts
│   │   │   └── output/
│   │   │       ├── constituentDraft.ts
│   │   │       ├── briefingGenerator.ts
│   │   │       └── voteRecommendation.ts
│   │   └── stores.ts                # Database configuration
│   ├── components/
│   │   ├── c1/
│   │   │   ├── BillStatusCard.tsx
│   │   │   ├── VoteChart.tsx
│   │   │   ├── MemberProfile.tsx
│   │   │   ├── NewsCarousel.tsx
│   │   │   ├── RegulationCard.tsx
│   │   │   └── ExecutiveOrderCard.tsx
│   │   └── layouts/
│   │       └── DashboardLayout.tsx
│   └── lib/
│       ├── api/
│       │   ├── congressGov.ts
│       │   ├── legiScan.ts
│       │   ├── federalRegister.ts
│       │   └── geminiSearch.ts
│       └── utils/
│           ├── billParser.ts
│           └── dateUtils.ts
├── data/
│   └── members.db                   # SQLite database
├── .env.local
├── package.json
└── tsconfig.json
```

---

## 3. Environment Setup

### Required Environment Variables

Create `.env.local`:

```bash
# LLM Provider
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Congress.gov API (free - get at api.congress.gov)
CONGRESS_GOV_API_KEY=xxxxx

# LegiScan API (free tier - get at legiscan.com)
LEGISCAN_API_KEY=xxxxx

# Regulations.gov API (free - get at api.data.gov)
REGULATIONS_GOV_API_KEY=xxxxx

# Google Gemini (for grounded search)
GOOGLE_AI_API_KEY=xxxxx

# Thesys C1
THESYS_API_KEY=xxxxx

# Local Database
MEMBERS_DB_PATH=./data/members.db
```

### Package Dependencies

```json
{
  "name": "legislative-assistant",
  "version": "1.0.0",
  "dependencies": {
    "@mastra/core": "^0.21.0",
    "@ai-sdk/anthropic": "^0.0.30",
    "@thesys/react": "^1.0.0",
    "better-sqlite3": "^9.4.0",
    "zod": "^3.22.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0"
  }
}
```

### Installation Commands

```bash
# Create project
npm create mastra@latest legislative-assistant \
  --components agents,tools \
  --llm anthropic

cd legislative-assistant

# Install additional dependencies
npm install better-sqlite3 date-fns
npm install -D @types/better-sqlite3

# Install Thesys
npm install @thesys/react
```

---

## 4. Database Schema

### SQLite Schema for Members Cache

Create `data/schema.sql`:

```sql
-- Members table (cache from Congress.gov)
CREATE TABLE IF NOT EXISTS members (
  bioguide_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  party TEXT CHECK(party IN ('D', 'R', 'I', 'L')),
  state TEXT NOT NULL,
  district TEXT,
  chamber TEXT CHECK(chamber IN ('house', 'senate')),
  
  -- Contact info
  office_address TEXT,
  phone TEXT,
  website TEXT,
  twitter_handle TEXT,
  
  -- Term info
  term_start DATE,
  term_end DATE,
  
  -- Leadership
  leadership_role TEXT,
  
  -- Cross-references to other APIs
  legiscan_people_id INTEGER,
  votesmart_id INTEGER,
  fec_id TEXT,
  
  -- Metadata
  photo_url TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_members_state ON members(state);
CREATE INDEX IF NOT EXISTS idx_members_state_district ON members(state, district);
CREATE INDEX IF NOT EXISTS idx_members_name ON members(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_members_party ON members(party);
CREATE INDEX IF NOT EXISTS idx_members_chamber ON members(chamber);

-- Committee assignments
CREATE TABLE IF NOT EXISTS committee_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bioguide_id TEXT NOT NULL,
  committee_code TEXT NOT NULL,
  committee_name TEXT NOT NULL,
  subcommittee_code TEXT,
  subcommittee_name TEXT,
  rank TEXT,
  is_chair BOOLEAN DEFAULT FALSE,
  is_ranking_member BOOLEAN DEFAULT FALSE,
  
  FOREIGN KEY (bioguide_id) REFERENCES members(bioguide_id)
);

CREATE INDEX IF NOT EXISTS idx_committee_member ON committee_assignments(bioguide_id);
CREATE INDEX IF NOT EXISTS idx_committee_code ON committee_assignments(committee_code);

-- Bill tracking cache (optional - for frequently accessed bills)
CREATE TABLE IF NOT EXISTS bills_cache (
  bill_id TEXT PRIMARY KEY,  -- e.g., "hr1234-118"
  congress INTEGER NOT NULL,
  bill_type TEXT NOT NULL,
  bill_number INTEGER NOT NULL,
  title TEXT,
  short_title TEXT,
  sponsor_bioguide_id TEXT,
  introduced_date DATE,
  latest_action_date DATE,
  latest_action_text TEXT,
  status TEXT,
  
  -- JSON fields for complex data
  cosponsors_json TEXT,  -- JSON array of bioguide IDs
  subjects_json TEXT,    -- JSON array of subjects
  committees_json TEXT,  -- JSON array of committee codes
  
  cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (sponsor_bioguide_id) REFERENCES members(bioguide_id)
);

CREATE INDEX IF NOT EXISTS idx_bills_congress ON bills_cache(congress);
CREATE INDEX IF NOT EXISTS idx_bills_sponsor ON bills_cache(sponsor_bioguide_id);

-- Vote records cache
CREATE TABLE IF NOT EXISTS votes_cache (
  roll_call_id TEXT PRIMARY KEY,
  source TEXT CHECK(source IN ('congress_gov', 'legiscan')),
  chamber TEXT NOT NULL,
  congress INTEGER,
  session INTEGER,
  roll_number INTEGER,
  vote_date DATE,
  vote_question TEXT,
  vote_result TEXT,
  
  -- Totals
  yea_count INTEGER,
  nay_count INTEGER,
  present_count INTEGER,
  not_voting_count INTEGER,
  
  -- Related bill
  bill_id TEXT,
  
  -- Individual votes as JSON
  votes_json TEXT,
  
  cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_votes_date ON votes_cache(vote_date);
CREATE INDEX IF NOT EXISTS idx_votes_bill ON votes_cache(bill_id);
```

### Database Initialization Script

Create `src/lib/db/init.ts`:

```typescript
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export function initializeDatabase(dbPath: string): Database.Database {
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  
  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');
  
  // Read and execute schema
  const schemaPath = path.join(__dirname, '../../../data/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  
  return db;
}

export function getDatabase(): Database.Database {
  const dbPath = process.env.MEMBERS_DB_PATH || './data/members.db';
  return new Database(dbPath);
}
```

---

## 5. API Reference

### 5.1 Congress.gov API

**Base URL**: `https://api.congress.gov/v3`
**Auth**: API key as query parameter (`?api_key=YOUR_KEY`)
**Rate Limit**: 5,000 requests/hour
**Documentation**: https://api.congress.gov/

#### Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/bill/{congress}/{type}/{number}` | Get bill details |
| `/bill/{congress}/{type}/{number}/actions` | Bill action history |
| `/bill/{congress}/{type}/{number}/cosponsors` | Cosponsor list |
| `/bill/{congress}/{type}/{number}/summaries` | CRS summaries |
| `/bill/{congress}/{type}/{number}/subjects` | Subject terms |
| `/member` | List/search members |
| `/member/{bioguideId}` | Member details |
| `/committee` | List committees |
| `/nomination` | Presidential nominations |

#### Bill Types

| Code | Description |
|------|-------------|
| `hr` | House Bill |
| `s` | Senate Bill |
| `hjres` | House Joint Resolution |
| `sjres` | Senate Joint Resolution |
| `hconres` | House Concurrent Resolution |
| `sconres` | Senate Concurrent Resolution |
| `hres` | House Simple Resolution |
| `sres` | Senate Simple Resolution |

### 5.2 LegiScan API

**Base URL**: `https://api.legiscan.com/`
**Auth**: API key as query parameter (`?key=YOUR_KEY`)
**Rate Limit**: 30,000 requests/month (free tier)
**Documentation**: https://legiscan.com/legiscan

#### Key Operations

| Operation | Parameters | Purpose |
|-----------|------------|---------|
| `getSessionList` | state | List legislative sessions |
| `getMasterList` | state, session_id | All bills in session |
| `getBill` | id | Bill details including votes |
| `getBillText` | id | Bill text (base64) |
| `getRollcall` | id | Vote details with individual votes |
| `getSponsor` | id | Legislator info |
| `search` | state, query | Full-text bill search |

#### Vote Values

| Code | Meaning |
|------|---------|
| 1 | Yea |
| 2 | Nay |
| 3 | Not Voting / Abstain |
| 4 | Absent / Excused |

### 5.3 Federal Register API

**Base URL**: `https://www.federalregister.gov/api/v1`
**Auth**: None required
**Rate Limit**: Reasonable use
**Documentation**: https://www.federalregister.gov/developers/documentation/api/v1

#### Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/documents.json` | Search documents |
| `/documents/{number}.json` | Get specific document |
| `/public-inspection-documents.json` | Pre-publication docs |
| `/agencies.json` | List all agencies |

#### Document Types

| Type | Description |
|------|-------------|
| `RULE` | Final rules |
| `PRORULE` | Proposed rules |
| `NOTICE` | Agency notices |
| `PRESDOCU` | Presidential documents |

#### Presidential Document Subtypes

- `executive_order`
- `memorandum`
- `proclamation`
- `determination`
- `notice`

### 5.4 Regulations.gov API

**Base URL**: `https://api.regulations.gov/v4`
**Auth**: API key in `X-Api-Key` header
**Rate Limit**: 1,000 requests/hour
**Documentation**: https://open.gsa.gov/api/regulationsgov/

#### Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/documents` | Search regulatory documents |
| `/documents/{id}` | Document details |
| `/comments` | Search public comments |
| `/dockets` | Rulemaking dockets |
| `/dockets/{id}` | Docket details |

### 5.5 Google Gemini API with Search Grounding (for News)

**Models**:
- `gemini-2.0-flash` - Fast, cost-effective for most news queries
- `gemini-2.5-pro` - Most capable, best for complex research queries

**Auth**: API key via Google AI Studio (https://aistudio.google.com/)
**Documentation**: https://ai.google.dev/gemini-api/docs/grounding

#### Google Search Grounding

Gemini models can use Google Search as a grounding tool to retrieve real-time information. This provides:
- Real-time news and current events
- Source URLs with citations
- Automatic relevance filtering

#### Configuration

```typescript
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

// Use Gemini 2.0 Flash for news search with grounding
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  tools: [{ googleSearch: {} }], // Enable Google Search grounding
});

// For more complex research, use Gemini 2.5 Pro
const researchModel = genAI.getGenerativeModel({
  model: "gemini-2.5-pro-preview-05-06",
  tools: [{ googleSearch: {} }],
});
```

#### Key Features

| Feature | Description |
|---------|-------------|
| `googleSearch` tool | Enables real-time Google Search during generation |
| `groundingMetadata` | Returns source URLs and citations |
| `searchEntryPoint` | Provides rendered search results link |
| Dynamic retrieval | Model decides when to search based on query |

---

## 6. Tool Implementations

### 6.1 Bill Lookup Tool

```typescript
// src/mastra/tools/legislation/billLookup.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const billLookup = createTool({
  id: "bill-lookup",
  description: `Retrieves detailed information about a specific bill from Congress.gov.
    Returns title, sponsor, status, actions, committees, summaries, and vote references.
    Use when user asks about a specific bill by number (e.g., "HR 1234", "S 567").`,

  inputSchema: z.object({
    congress: z.number()
      .min(93)
      .max(119)
      .describe("Congress number (e.g., 118 for 118th Congress). Current is 119."),
    billType: z.enum(["hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres"])
      .describe("Bill type code"),
    billNumber: z.number()
      .min(1)
      .describe("Bill number without prefix"),
  }),

  outputSchema: z.object({
    billId: z.string(),
    title: z.string(),
    shortTitle: z.string().optional(),
    sponsor: z.object({
      name: z.string(),
      party: z.string(),
      state: z.string(),
      bioguideId: z.string(),
    }),
    introducedDate: z.string(),
    latestAction: z.object({
      date: z.string(),
      text: z.string(),
    }),
    status: z.string(),
    cosponsors: z.object({
      total: z.number(),
      byParty: z.record(z.number()),
      bipartisan: z.boolean(),
    }),
    committees: z.array(z.string()),
    summaryText: z.string().optional(),
    subjects: z.array(z.string()),
    recordedVotes: z.array(z.object({
      chamber: z.string(),
      date: z.string(),
      rollNumber: z.number(),
      url: z.string(),
    })),
    textVersions: z.array(z.object({
      type: z.string(),
      date: z.string(),
      url: z.string(),
    })),
  }),

  execute: async ({ context }) => {
    const { congress, billType, billNumber } = context;
    const apiKey = process.env.CONGRESS_GOV_API_KEY;
    
    if (!apiKey) {
      throw new Error("CONGRESS_GOV_API_KEY not configured");
    }
    
    const baseUrl = `https://api.congress.gov/v3/bill/${congress}/${billType}/${billNumber}`;

    // Fetch bill details and related data in parallel
    const [billRes, actionsRes, cosponsorsRes, summariesRes, subjectsRes] = 
      await Promise.all([
        fetch(`${baseUrl}?api_key=${apiKey}`),
        fetch(`${baseUrl}/actions?api_key=${apiKey}&limit=100`),
        fetch(`${baseUrl}/cosponsors?api_key=${apiKey}&limit=250`),
        fetch(`${baseUrl}/summaries?api_key=${apiKey}`),
        fetch(`${baseUrl}/subjects?api_key=${apiKey}`),
      ]);

    // Check for errors
    if (!billRes.ok) {
      const error = await billRes.text();
      throw new Error(`Bill not found: ${error}`);
    }

    const [billData, actionsData, cosponsorsData, summariesData, subjectsData] = 
      await Promise.all([
        billRes.json(),
        actionsRes.json(),
        cosponsorsRes.json(),
        summariesRes.json(),
        subjectsRes.json(),
      ]);

    const bill = billData.bill;
    
    // Extract recorded votes from actions
    const recordedVotes = (actionsData.actions || [])
      .filter((a: any) => a.recordedVotes?.length > 0)
      .flatMap((a: any) => a.recordedVotes.map((v: any) => ({
        chamber: v.chamber,
        date: v.date,
        rollNumber: v.rollNumber,
        url: v.url,
      })));

    // Analyze cosponsors by party
    const cosponsors = cosponsorsData.cosponsors || [];
    const byParty = cosponsors.reduce((acc: Record<string, number>, c: any) => {
      const party = c.party || 'Unknown';
      acc[party] = (acc[party] || 0) + 1;
      return acc;
    }, {});

    // Derive status from latest action
    const status = deriveStatus(bill);

    return {
      billId: `${billType}${billNumber}-${congress}`,
      title: bill.title || "Untitled",
      shortTitle: bill.shortTitle,
      
      sponsor: {
        name: bill.sponsors?.[0]?.fullName || "Unknown",
        party: bill.sponsors?.[0]?.party || "Unknown",
        state: bill.sponsors?.[0]?.state || "Unknown",
        bioguideId: bill.sponsors?.[0]?.bioguideId || "",
      },
      
      introducedDate: bill.introducedDate || "",
      
      latestAction: {
        date: bill.latestAction?.actionDate || "",
        text: bill.latestAction?.text || "",
      },
      
      status,
      
      cosponsors: {
        total: cosponsors.length,
        byParty,
        bipartisan: Object.keys(byParty).length > 1,
      },
      
      committees: (bill.committees || []).map((c: any) => c.name),
      
      summaryText: summariesData.summaries?.[0]?.text,
      
      subjects: (subjectsData.subjects || []).map((s: any) => s.name),
      
      recordedVotes,
      
      textVersions: (bill.textVersions || []).map((t: any) => ({
        type: t.type,
        date: t.date,
        url: t.url,
      })),
    };
  },
});

function deriveStatus(bill: any): string {
  // Check if enacted
  if (bill.laws?.length > 0) return "Enacted";
  
  const action = bill.latestAction?.text?.toLowerCase() || "";
  
  if (action.includes("became public law")) return "Enacted";
  if (action.includes("vetoed")) return "Vetoed";
  if (action.includes("veto overridden")) return "Veto Overridden";
  if (action.includes("passed senate") && action.includes("passed house")) 
    return "Passed Both Chambers";
  if (action.includes("passed senate")) return "Passed Senate";
  if (action.includes("passed house")) return "Passed House";
  if (action.includes("cloture")) return "Cloture Vote";
  if (action.includes("reported by") || action.includes("ordered to be reported")) 
    return "Reported from Committee";
  if (action.includes("markup")) return "In Markup";
  if (action.includes("hearing")) return "Hearing Held";
  if (action.includes("referred to")) return "In Committee";
  
  return "Introduced";
}
```

### 6.2 Bill Search Tool

```typescript
// src/mastra/tools/legislation/billSearch.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const billSearch = createTool({
  id: "bill-search",
  description: `Searches for bills by keyword, subject, sponsor, or other criteria.
    Use when user wants to find bills on a topic or by a specific member.`,

  inputSchema: z.object({
    query: z.string().optional().describe("Search terms"),
    congress: z.number().optional().describe("Limit to specific Congress"),
    chamber: z.enum(["house", "senate"]).optional(),
    sponsor: z.string().optional().describe("Sponsor name or bioguide ID"),
    subject: z.string().optional().describe("Legislative subject term"),
    status: z.enum([
      "introduced",
      "in_committee", 
      "passed_one_chamber",
      "passed_both",
      "enacted",
      "vetoed"
    ]).optional(),
    limit: z.number().default(20).describe("Max results to return"),
  }),

  execute: async ({ context }) => {
    const { query, congress, chamber, sponsor, subject, status, limit } = context;
    const apiKey = process.env.CONGRESS_GOV_API_KEY;

    // Build search URL
    let url = `https://api.congress.gov/v3/bill?api_key=${apiKey}&limit=${limit}`;
    
    if (congress) url += `&congress=${congress}`;
    
    // Note: Congress.gov API has limited search capabilities
    // For better search, consider using LegiScan's search endpoint
    
    const res = await fetch(url);
    const data = await res.json();
    
    let bills = data.bills || [];
    
    // Client-side filtering (Congress.gov API doesn't support all filters)
    if (query) {
      const queryLower = query.toLowerCase();
      bills = bills.filter((b: any) => 
        b.title?.toLowerCase().includes(queryLower) ||
        b.shortTitle?.toLowerCase().includes(queryLower)
      );
    }
    
    if (chamber) {
      const chamberPrefix = chamber === 'house' ? 'h' : 's';
      bills = bills.filter((b: any) => 
        b.type?.toLowerCase().startsWith(chamberPrefix)
      );
    }
    
    return {
      count: bills.length,
      bills: bills.slice(0, limit).map((b: any) => ({
        billId: `${b.type}${b.number}-${b.congress}`,
        congress: b.congress,
        type: b.type,
        number: b.number,
        title: b.title,
        introducedDate: b.introducedDate,
        latestAction: b.latestAction,
        sponsor: b.sponsors?.[0]?.fullName,
        url: b.url,
      })),
    };
  },
});
```

### 6.3 Member Lookup Tool

```typescript
// src/mastra/tools/members/memberLookup.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getDatabase } from "../../lib/db/init";

export const memberLookup = createTool({
  id: "member-lookup",
  description: `Retrieves detailed information about a member of Congress.
    Checks local SQLite cache first for speed, falls back to Congress.gov API.
    Use when user asks about a specific representative or senator.`,

  inputSchema: z.object({
    identifier: z.string().describe(
      "Member identifier: name, bioguide ID, or state+district (e.g., 'WI-04', 'Gwen Moore', 'M001160')"
    ),
    chamber: z.enum(["house", "senate"]).optional()
      .describe("Filter by chamber if name is ambiguous"),
    useCache: z.boolean().default(true)
      .describe("Check local SQLite cache first"),
  }),

  outputSchema: z.object({
    source: z.enum(["local_cache", "congress_gov_api"]),
    bioguideId: z.string(),
    name: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    party: z.string(),
    state: z.string(),
    district: z.string().optional(),
    chamber: z.string(),
    office: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().optional(),
    twitter: z.string().optional(),
    termStart: z.string().optional(),
    termEnd: z.string().optional(),
    leadershipRole: z.string().optional(),
    committees: z.array(z.object({
      name: z.string(),
      code: z.string(),
      isChair: z.boolean(),
      isRankingMember: z.boolean(),
    })).optional(),
  }),

  execute: async ({ context }) => {
    const { identifier, chamber, useCache } = context;
    
    // Try local SQLite cache first
    if (useCache) {
      try {
        const db = getDatabase();
        let member: any;
        
        // Check if bioguide ID pattern (letter + 6 digits)
        if (identifier.match(/^[A-Z]\d{6}$/i)) {
          member = db.prepare(`
            SELECT * FROM members WHERE bioguide_id = ? COLLATE NOCASE
          `).get(identifier.toUpperCase());
        }
        // Check if state+district pattern (e.g., WI-04)
        else if (identifier.match(/^[A-Z]{2}-\d+$/i)) {
          const [state, district] = identifier.toUpperCase().split('-');
          member = db.prepare(`
            SELECT * FROM members 
            WHERE state = ? AND district = ? AND chamber = 'house'
          `).get(state, district.replace(/^0+/, '')); // Remove leading zeros
        }
        // Search by name
        else {
          const nameParts = identifier.toLowerCase().split(' ');
          let query = `
            SELECT * FROM members 
            WHERE (LOWER(name) LIKE ? OR LOWER(last_name) LIKE ? OR LOWER(first_name) LIKE ?)
          `;
          const params = [
            `%${identifier.toLowerCase()}%`,
            `%${nameParts[nameParts.length - 1]}%`,
            `%${nameParts[0]}%`,
          ];
          
          if (chamber) {
            query += ` AND chamber = ?`;
            params.push(chamber);
          }
          
          query += ` LIMIT 1`;
          member = db.prepare(query).get(...params);
        }
        
        if (member) {
          // Get committee assignments
          const committees = db.prepare(`
            SELECT * FROM committee_assignments WHERE bioguide_id = ?
          `).all(member.bioguide_id);
          
          db.close();
          
          return {
            source: "local_cache" as const,
            bioguideId: member.bioguide_id,
            name: member.name,
            firstName: member.first_name,
            lastName: member.last_name,
            party: member.party,
            state: member.state,
            district: member.district,
            chamber: member.chamber,
            office: member.office_address,
            phone: member.phone,
            website: member.website,
            twitter: member.twitter_handle,
            termStart: member.term_start,
            termEnd: member.term_end,
            leadershipRole: member.leadership_role,
            committees: committees.map((c: any) => ({
              name: c.committee_name,
              code: c.committee_code,
              isChair: c.is_chair,
              isRankingMember: c.is_ranking_member,
            })),
          };
        }
        
        db.close();
      } catch (error) {
        console.warn("Cache lookup failed, falling back to API:", error);
      }
    }

    // Fall back to Congress.gov API
    const apiKey = process.env.CONGRESS_GOV_API_KEY;
    
    // Search for member
    const searchUrl = `https://api.congress.gov/v3/member?api_key=${apiKey}&currentMember=true&limit=50`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    // Find matching member
    const searchLower = identifier.toLowerCase();
    const match = searchData.members?.find((m: any) => {
      if (m.bioguideId?.toUpperCase() === identifier.toUpperCase()) return true;
      if (m.name?.toLowerCase().includes(searchLower)) return true;
      if (`${m.state}-${m.district}`.toLowerCase() === searchLower) return true;
      return false;
    });
    
    if (!match) {
      throw new Error(`Member not found: ${identifier}`);
    }
    
    // Get full details
    const detailUrl = `https://api.congress.gov/v3/member/${match.bioguideId}?api_key=${apiKey}`;
    const detailRes = await fetch(detailUrl);
    const detailData = await detailRes.json();
    const member = detailData.member;
    
    // Get current term
    const currentTerm = member.terms?.slice(-1)[0];
    
    return {
      source: "congress_gov_api" as const,
      bioguideId: member.bioguideId,
      name: member.directOrderName || member.invertedOrderName,
      firstName: member.firstName,
      lastName: member.lastName,
      party: member.partyHistory?.[0]?.partyName || member.party,
      state: member.state,
      district: member.district,
      chamber: currentTerm?.chamber?.toLowerCase(),
      office: member.addressInformation?.officeAddress,
      phone: member.addressInformation?.phoneNumber,
      website: member.officialWebsiteUrl,
      twitter: null, // Not in Congress.gov API
      termStart: currentTerm?.startYear?.toString(),
      termEnd: currentTerm?.endYear?.toString(),
      leadershipRole: member.leadership?.[0]?.type,
      committees: [], // Would need separate API call
    };
  },
});
```

### 6.4 Vote Details Tool (LegiScan)

```typescript
// src/mastra/tools/votes/getVoteDetails.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const getVoteDetails = createTool({
  id: "get-vote-details",
  description: `Retrieves detailed roll call vote information from LegiScan.
    Shows how each member voted on a specific roll call.
    Works for Congress and all 50 state legislatures.`,

  inputSchema: z.object({
    rollCallId: z.number().describe("LegiScan roll_call_id"),
  }),

  outputSchema: z.object({
    rollCallId: z.number(),
    billId: z.number(),
    billNumber: z.string(),
    date: z.string(),
    description: z.string(),
    chamber: z.string(),
    yea: z.number(),
    nay: z.number(),
    nv: z.number(),
    absent: z.number(),
    passed: z.boolean(),
    votes: z.array(z.object({
      peopleId: z.number(),
      name: z.string(),
      party: z.string(),
      vote: z.enum(["Yea", "Nay", "NV", "Absent"]),
    })),
    partyBreakdown: z.object({
      democratic: z.object({
        yea: z.number(),
        nay: z.number(),
        nv: z.number(),
        absent: z.number(),
      }),
      republican: z.object({
        yea: z.number(),
        nay: z.number(),
        nv: z.number(),
        absent: z.number(),
      }),
      independent: z.object({
        yea: z.number(),
        nay: z.number(),
        nv: z.number(),
        absent: z.number(),
      }),
    }),
  }),

  execute: async ({ context }) => {
    const { rollCallId } = context;
    const apiKey = process.env.LEGISCAN_API_KEY;
    
    if (!apiKey) {
      throw new Error("LEGISCAN_API_KEY not configured");
    }

    const res = await fetch(
      `https://api.legiscan.com/?key=${apiKey}&op=getRollcall&id=${rollCallId}`
    );
    
    if (!res.ok) {
      throw new Error(`LegiScan API error: ${res.status}`);
    }
    
    const data = await res.json();
    
    if (data.status === "ERROR") {
      throw new Error(`LegiScan error: ${data.alert?.message || "Unknown error"}`);
    }
    
    const rc = data.roll_call;

    // Map vote codes to labels
    const voteLabels: Record<number, "Yea" | "Nay" | "NV" | "Absent"> = {
      1: "Yea",
      2: "Nay",
      3: "NV",
      4: "Absent",
    };

    // Process individual votes
    const votes = (rc.votes || []).map((v: any) => ({
      peopleId: v.people_id,
      name: v.name,
      party: v.party,
      vote: voteLabels[v.vote] || "NV",
    }));

    // Calculate party breakdown
    const partyBreakdown = {
      democratic: { yea: 0, nay: 0, nv: 0, absent: 0 },
      republican: { yea: 0, nay: 0, nv: 0, absent: 0 },
      independent: { yea: 0, nay: 0, nv: 0, absent: 0 },
    };

    votes.forEach((v: any) => {
      const partyKey = v.party === 'D' ? 'democratic' 
                     : v.party === 'R' ? 'republican' 
                     : 'independent';
      const voteKey = v.vote.toLowerCase() as 'yea' | 'nay' | 'nv' | 'absent';
      partyBreakdown[partyKey][voteKey]++;
    });

    return {
      rollCallId: rc.roll_call_id,
      billId: rc.bill_id,
      billNumber: rc.bill_number || "",
      date: rc.date,
      description: rc.desc,
      chamber: rc.chamber,
      yea: rc.yea,
      nay: rc.nay,
      nv: rc.nv,
      absent: rc.absent,
      passed: rc.passed === 1,
      votes,
      partyBreakdown,
    };
  },
});
```

### 6.5 Federal Register Search Tool

```typescript
// src/mastra/tools/executive/federalRegisterSearch.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const federalRegisterSearch = createTool({
  id: "federal-register-search",
  description: `Searches the Federal Register for regulations, proposed rules,
    executive orders, and agency notices. Use this to:
    - Find regulations implementing a law
    - Track agency rulemaking activity
    - Find Executive Orders on a topic
    - Monitor public comment periods
    - Research regulatory history`,

  inputSchema: z.object({
    searchTerms: z.string().optional()
      .describe("Keywords to search in title, abstract, and full text"),
    documentType: z.enum(["RULE", "PRORULE", "NOTICE", "PRESDOCU"]).optional()
      .describe("RULE=Final rules, PRORULE=Proposed rules, NOTICE=Notices, PRESDOCU=Presidential docs"),
    presidentialDocType: z.enum([
      "executive_order",
      "memorandum", 
      "proclamation",
      "determination",
      "notice"
    ]).optional()
      .describe("For presidential documents only"),
    agencies: z.array(z.string()).optional()
      .describe("Agency slugs (e.g., 'environmental-protection-agency', 'department-of-labor')"),
    publicationDateGte: z.string().optional()
      .describe("Published on or after (YYYY-MM-DD)"),
    publicationDateLte: z.string().optional()
      .describe("Published on or before (YYYY-MM-DD)"),
    effectiveDateGte: z.string().optional()
      .describe("Effective on or after (YYYY-MM-DD)"),
    commentEndDateGte: z.string().optional()
      .describe("Comment period ends on or after (YYYY-MM-DD)"),
    significantOnly: z.boolean().optional()
      .describe("Only economically significant rules"),
    perPage: z.number().default(20).describe("Results per page (max 1000)"),
    page: z.number().default(1).describe("Page number"),
  }),

  outputSchema: z.object({
    count: z.number(),
    totalPages: z.number(),
    currentPage: z.number(),
    results: z.array(z.object({
      documentNumber: z.string(),
      title: z.string(),
      type: z.string(),
      subtype: z.string().optional(),
      abstract: z.string().optional(),
      agencies: z.array(z.string()),
      publicationDate: z.string(),
      effectiveDate: z.string().optional(),
      commentEndDate: z.string().optional(),
      pdfUrl: z.string(),
      htmlUrl: z.string(),
      citation: z.string(),
      significant: z.boolean(),
      executiveOrderNumber: z.string().optional(),
      president: z.string().optional(),
    })),
  }),

  execute: async ({ context }) => {
    const params = new URLSearchParams();
    params.set("per_page", context.perPage.toString());
    params.set("page", context.page.toString());
    params.set("order", "newest");
    
    // Build conditions
    if (context.searchTerms) {
      params.set("conditions[term]", context.searchTerms);
    }
    if (context.documentType) {
      params.append("conditions[type][]", context.documentType);
    }
    if (context.presidentialDocType) {
      params.append("conditions[presidential_document_type][]", context.presidentialDocType);
    }
    if (context.agencies) {
      context.agencies.forEach(a => {
        params.append("conditions[agencies][]", a);
      });
    }
    if (context.publicationDateGte) {
      params.set("conditions[publication_date][gte]", context.publicationDateGte);
    }
    if (context.publicationDateLte) {
      params.set("conditions[publication_date][lte]", context.publicationDateLte);
    }
    if (context.effectiveDateGte) {
      params.set("conditions[effective_date][gte]", context.effectiveDateGte);
    }
    if (context.commentEndDateGte) {
      params.set("conditions[comment_date][gte]", context.commentEndDateGte);
    }
    if (context.significantOnly) {
      params.set("conditions[significant]", "1");
    }

    const res = await fetch(
      `https://www.federalregister.gov/api/v1/documents.json?${params.toString()}`
    );
    
    if (!res.ok) {
      throw new Error(`Federal Register API error: ${res.status}`);
    }
    
    const data = await res.json();

    return {
      count: data.count || 0,
      totalPages: data.total_pages || 1,
      currentPage: context.page,
      results: (data.results || []).map((doc: any) => ({
        documentNumber: doc.document_number,
        title: doc.title,
        type: doc.type,
        subtype: doc.subtype,
        abstract: doc.abstract,
        agencies: (doc.agencies || []).map((a: any) => a.name),
        publicationDate: doc.publication_date,
        effectiveDate: doc.effective_on,
        commentEndDate: doc.comments_close_on,
        pdfUrl: doc.pdf_url,
        htmlUrl: doc.html_url,
        citation: doc.citation,
        significant: doc.significant || false,
        executiveOrderNumber: doc.executive_order_number,
        president: doc.president?.name,
      })),
    };
  },
});
```

### 6.6 Executive Orders Tool

```typescript
// src/mastra/tools/executive/getExecutiveOrders.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const getExecutiveOrders = createTool({
  id: "get-executive-orders",
  description: `Retrieves Executive Orders from the Federal Register.
    Filter by president, date range, or search terms.
    Useful for tracking executive actions related to legislation.`,

  inputSchema: z.object({
    president: z.enum([
      "joe-biden",
      "donald-trump",
      "barack-obama",
      "george-w-bush",
      "william-j-clinton"
    ]).optional()
      .describe("Filter by president"),
    searchTerms: z.string().optional()
      .describe("Search terms in EO title and content"),
    dateGte: z.string().optional()
      .describe("Signed/published on or after (YYYY-MM-DD)"),
    dateLte: z.string().optional()
      .describe("Signed/published on or before (YYYY-MM-DD)"),
    perPage: z.number().default(20),
  }),

  execute: async ({ context }) => {
    const { president, searchTerms, dateGte, dateLte, perPage } = context;

    const params = new URLSearchParams();
    params.set("per_page", perPage.toString());
    params.set("order", "executive_order_number");
    params.append("conditions[type][]", "PRESDOCU");
    params.append("conditions[presidential_document_type][]", "executive_order");
    
    if (president) {
      params.append("conditions[president][]", president);
    }
    if (searchTerms) {
      params.set("conditions[term]", searchTerms);
    }
    if (dateGte) {
      params.set("conditions[publication_date][gte]", dateGte);
    }
    if (dateLte) {
      params.set("conditions[publication_date][lte]", dateLte);
    }

    const res = await fetch(
      `https://www.federalregister.gov/api/v1/documents.json?${params.toString()}`
    );
    
    const data = await res.json();

    return {
      count: data.count || 0,
      executiveOrders: (data.results || []).map((doc: any) => ({
        eoNumber: doc.executive_order_number,
        title: doc.title,
        signingDate: doc.signing_date,
        publicationDate: doc.publication_date,
        president: doc.president?.name,
        abstract: doc.abstract,
        pdfUrl: doc.pdf_url,
        htmlUrl: doc.html_url,
        citation: doc.citation,
        disposition: doc.disposition_notes,
      })),
    };
  },
});
```

---

## 7. Web Search Tool for News (Gemini with Google Search Grounding)

This section uses Google Gemini with Google Search grounding for news search, replacing the previous Brave Search implementation. Gemini provides:
- Real-time search grounded in Google's index
- Inline citations and source attribution
- Structured JSON output for consistent parsing
- High-quality summaries with key findings

### 7.1 Gemini Search Client Setup

```typescript
// src/lib/api/geminiSearch.ts
import { GoogleGenAI } from "@google/genai";

// Gemini configuration
const GEMINI_MODEL = "gemini-2.0-flash"; // Fast, cost-effective for news
// For complex research, use: "gemini-2.5-pro-preview-05-06"

// Lazy-initialized Gemini client
let _geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY not set");
  }

  if (!_geminiClient) {
    _geminiClient = new GoogleGenAI({ apiKey });
  }

  return _geminiClient;
}

export { getGeminiClient, GEMINI_MODEL };
```

### 7.2 News Search Tool (Gemini + Google Search)

```typescript
// src/mastra/tools/news/newsSearch.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = "gemini-2.0-flash";

// Structured output schema for news search
const newsSearchSchema = {
  type: "object" as const,
  properties: {
    summary: {
      type: "string",
      description: "Comprehensive summary with [n] citation markers",
    },
    keyFindings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          point: { type: "string" },
          citationIndex: { type: "integer" },
        },
        required: ["point"],
      },
    },
    articles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          source: { type: "string" },
          url: { type: "string" },
          date: { type: "string" },
          snippet: { type: "string" },
        },
        required: ["title", "source", "url"],
      },
    },
    relatedTopics: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["summary", "articles"],
};

export const newsSearch = createTool({
  id: "news-search",
  description: `Searches for recent news using Gemini with Google Search grounding.
    Returns comprehensive results with inline citations and structured output.
    Best for current events, policy news, and legislative coverage.`,

  inputSchema: z.object({
    query: z.string().describe("Search query for news articles"),
    focus: z.enum(["news", "general", "policy"]).optional().default("news")
      .describe("Search focus: news (recent), general (comprehensive), policy (government sources)"),
    maxArticles: z.number().optional().default(10).describe("Maximum articles to return"),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    summary: z.string(),
    summaryWithCitations: z.string(),
    articles: z.array(z.object({
      title: z.string(),
      source: z.string(),
      url: z.string(),
      date: z.string().optional(),
      snippet: z.string().optional(),
    })),
    citations: z.array(z.object({
      index: z.number(),
      title: z.string(),
      url: z.string(),
    })),
    keyFindings: z.array(z.object({
      point: z.string(),
      citationIndex: z.number().optional(),
    })).optional(),
    relatedTopics: z.array(z.string()).optional(),
    error: z.string().optional(),
  }),

  execute: async ({ context }) => {
    const { query, focus = "news", maxArticles = 10 } = context;

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "Gemini API key not configured" };
    }

    const client = new GoogleGenAI({ apiKey });

    // Focus-specific instructions
    const focusInstructions = {
      news: "Focus on recent news articles and current events coverage.",
      general: "Search for comprehensive information from authoritative sources.",
      policy: "Focus on government sources, policy documents, and legislative news.",
    };

    const searchPrompt = `Search for: "${query}"

${focusInstructions[focus]}

Provide:
1. A comprehensive summary with inline citations [n]
2. Key findings with citation references
3. List of the most relevant articles (up to ${maxArticles})
4. Related topics for further exploration

Be factual and cite sources accurately.`;

    try {
      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: searchPrompt,
        config: {
          tools: [{ googleSearch: {} }], // Enable Google Search grounding
          responseMimeType: "application/json",
          responseSchema: newsSearchSchema,
        },
      });

      const responseText = response.text || "{}";
      let parsedResponse;

      try {
        parsedResponse = JSON.parse(responseText);
      } catch {
        parsedResponse = { summary: responseText, articles: [] };
      }

      // Process grounding metadata for citations
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata || {};
      const chunks = groundingMetadata.groundingChunks || [];

      const citations = chunks.map((chunk: any, index: number) => ({
        index: index + 1,
        title: chunk.web?.title || "Source",
        url: chunk.web?.uri || "",
      }));

      // Enrich articles from grounding chunks if needed
      const articles = parsedResponse.articles?.length > 0
        ? parsedResponse.articles
        : chunks.slice(0, maxArticles).map((chunk: any) => ({
            title: chunk.web?.title || "Article",
            source: chunk.web?.uri ? new URL(chunk.web.uri).hostname.replace("www.", "") : "Unknown",
            url: chunk.web?.uri || "",
          }));

      return {
        success: true,
        summary: parsedResponse.summary || "",
        summaryWithCitations: parsedResponse.summary || "",
        articles,
        citations,
        keyFindings: parsedResponse.keyFindings,
        relatedTopics: parsedResponse.relatedTopics,
      };
    } catch (error) {
      console.error("[Gemini Search] Error:", error);
      return {
        success: false,
        summary: "",
        summaryWithCitations: "",
        articles: [],
        citations: [],
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  },
});
```

### 7.3 Member News Tool (Gemini)

```typescript
// src/mastra/tools/news/memberNews.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

export const memberNews = createTool({
  id: "member-news",
  description: `Searches for recent news about a specific member of Congress
    using Gemini with Google Search grounding. Provides categorized coverage.`,

  inputSchema: z.object({
    memberName: z.string().describe("Full name of the member of Congress"),
    state: z.string().optional().describe("State to disambiguate common names"),
    includeTopics: z.array(z.string()).optional().describe("Additional topics"),
    maxArticles: z.number().optional().default(10),
  }),

  execute: async ({ context }) => {
    const { memberName, state, includeTopics, maxArticles = 10 } = context;

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "Gemini API key not configured" };
    }

    const client = new GoogleGenAI({ apiKey });

    // Build search query
    let query = `"${memberName}"`;
    if (state) query += ` ${state}`;
    query += " Congress";
    if (includeTopics?.length) query += ` ${includeTopics.join(" ")}`;

    const searchPrompt = `Search for recent news about ${memberName}${state ? ` from ${state}` : ""}.

Provide:
1. A summary of recent coverage with inline citations [n]
2. List of news articles, categorized as:
   - "legislation" (votes, bills)
   - "campaign" (elections, polling)
   - "statement" (quotes, announcements)
   - "committee" (hearings, assignments)
   - "general" (other)
3. Key findings about their recent activities

Focus on congressional and political news.`;

    try {
      const response = await client.models.generateContent({
        model: "gemini-2.0-flash",
        contents: searchPrompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              articles: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    source: { type: "string" },
                    url: { type: "string" },
                    date: { type: "string" },
                    category: { type: "string", enum: ["legislation", "campaign", "statement", "committee", "general"] },
                    snippet: { type: "string" },
                  },
                  required: ["title", "source", "url", "category"],
                },
              },
              keyFindings: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["summary", "articles"],
          },
        },
      });

      const data = JSON.parse(response.text || "{}");
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      const citations = groundingChunks.map((chunk: any, i: number) => ({
        index: i + 1,
        title: chunk.web?.title || "Source",
        url: chunk.web?.uri || "",
      }));

      return {
        success: true,
        memberName,
        summary: data.summary || "",
        articles: (data.articles || []).slice(0, maxArticles),
        citations,
        keyFindings: data.keyFindings || [],
        topSources: [...new Set((data.articles || []).map((a: any) => a.source))].slice(0, 5),
      };
    } catch (error) {
      return {
        success: false,
        memberName,
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  },
});
```

### 7.4 Issue News Tool (Gemini)

```typescript
// src/mastra/tools/news/issueNews.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

export const issueNews = createTool({
  id: "issue-news",
  description: `Searches for news coverage on a policy issue using Gemini
    with Google Search grounding. Includes source analysis and related terms.`,

  inputSchema: z.object({
    issue: z.string().describe("The policy issue or topic to search for"),
    relatedBills: z.array(z.string()).optional().describe("Related bill numbers"),
    relatedMembers: z.array(z.string()).optional().describe("Related member names"),
    maxArticles: z.number().optional().default(15),
  }),

  execute: async ({ context }) => {
    const { issue, relatedBills, relatedMembers, maxArticles = 15 } = context;

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "Gemini API key not configured" };
    }

    const client = new GoogleGenAI({ apiKey });

    // Build comprehensive query
    let query = `${issue} Congress legislation policy`;
    if (relatedBills?.length) {
      query += ` ${relatedBills.slice(0, 2).join(" ")}`;
    }
    if (relatedMembers?.length) {
      query += ` ${relatedMembers.slice(0, 2).map(m => `"${m}"`).join(" ")}`;
    }

    const searchPrompt = `Search for news and analysis about: ${issue}

Context:
- Related bills: ${relatedBills?.join(", ") || "none specified"}
- Related members: ${relatedMembers?.join(", ") || "none specified"}

Provide:
1. Comprehensive summary with citations [n]
2. Key findings from the coverage
3. List of relevant articles (up to ${maxArticles})
4. Source distribution analysis
5. Related topics and emerging themes

Focus on congressional and policy coverage.`;

    try {
      const response = await client.models.generateContent({
        model: "gemini-2.0-flash",
        contents: searchPrompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              keyFindings: { type: "array", items: { type: "string" } },
              articles: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    source: { type: "string" },
                    url: { type: "string" },
                    date: { type: "string" },
                    snippet: { type: "string" },
                  },
                  required: ["title", "source", "url"],
                },
              },
              relatedTopics: { type: "array", items: { type: "string" } },
            },
            required: ["summary", "articles"],
          },
        },
      });

      const data = JSON.parse(response.text || "{}");
      const articles = (data.articles || []).slice(0, maxArticles);

      // Analyze source distribution
      const sourceCount: Record<string, number> = {};
      articles.forEach((a: any) => {
        sourceCount[a.source] = (sourceCount[a.source] || 0) + 1;
      });

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const citations = groundingChunks.map((chunk: any, i: number) => ({
        index: i + 1,
        title: chunk.web?.title || "Source",
        url: chunk.web?.uri || "",
      }));

      return {
        success: true,
        issue,
        summary: data.summary || "",
        totalArticles: articles.length,
        articles,
        citations,
        keyFindings: data.keyFindings || [],
        sourceAnalysis: {
          uniqueSources: Object.keys(sourceCount).length,
          topSources: Object.entries(sourceCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([source, count]) => ({ source, count })),
        },
        relatedTopics: data.relatedTopics || [],
      };
    } catch (error) {
      return {
        success: false,
        issue,
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  },
});
```

### 7.5 Package Dependencies

Add to your `package.json`:

```json
{
  "dependencies": {
    "@google/genai": "^1.32.0"
  }
}
```

### 7.6 Environment Variables

Update your `.env.local`:

```bash
# Google Gemini (for grounded search) - choose one
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key
# OR
GEMINI_API_KEY=your-api-key
```

---

## 8. Thesys C1 UI Components

### 8.1 Setup and Configuration

```typescript
// src/lib/thesys/config.ts
export const THESYS_CONFIG = {
  apiKey: process.env.THESYS_API_KEY,
  model: "gpt-4o", // or "claude-sonnet-4-20250514"
  baseUrl: "https://api.thesys.dev/v1",
};

// System prompt for legislative UI generation
export const LEGISLATIVE_UI_SYSTEM_PROMPT = `
You are a legislative assistant UI generator. Generate clean, professional 
UI components for displaying legislative information including:
- Bill status and details
- Vote visualizations
- Member profiles
- News articles
- Regulatory information

Use a professional color scheme:
- Primary: #1a365d (dark blue)
- Secondary: #2d3748 (gray)
- Success: #38a169 (green) 
- Warning: #d69e2e (amber)
- Error: #e53e3e (red)
- Democrat: #2b6cb0 (blue)
- Republican: #c53030 (red)
- Independent: #718096 (gray)

Ensure accessibility with proper contrast ratios and semantic HTML.
`;
```

### 8.2 Bill Status Card Component

```typescript
// src/components/c1/BillStatusCard.tsx
import React from 'react';
import { C1Component } from '@thesys/react';

interface BillStatusCardProps {
  billData: {
    billId: string;
    title: string;
    shortTitle?: string;
    sponsor: {
      name: string;
      party: string;
      state: string;
    };
    status: string;
    introducedDate: string;
    latestAction: {
      date: string;
      text: string;
    };
    cosponsors: {
      total: number;
      byParty: Record<string, number>;
      bipartisan: boolean;
    };
    committees: string[];
  };
  onTrackBill?: (billId: string) => void;
  onViewDetails?: (billId: string) => void;
}

export function BillStatusCard({ billData, onTrackBill, onViewDetails }: BillStatusCardProps) {
  const prompt = `
    Generate a bill status card UI component with the following data:
    
    Bill ID: ${billData.billId}
    Title: ${billData.title}
    Short Title: ${billData.shortTitle || 'N/A'}
    Sponsor: ${billData.sponsor.name} (${billData.sponsor.party}-${billData.sponsor.state})
    Status: ${billData.status}
    Introduced: ${billData.introducedDate}
    Latest Action: ${billData.latestAction.text} (${billData.latestAction.date})
    Total Cosponsors: ${billData.cosponsors.total}
    Bipartisan: ${billData.cosponsors.bipartisan ? 'Yes' : 'No'}
    Committees: ${billData.committees.join(', ')}
    
    The card should include:
    1. A header with the bill number and short title
    2. A status progress indicator showing: Introduced → Committee → Floor → Passed → Enacted
       (highlight the current status: "${billData.status}")
    3. Sponsor information with party-colored badge
    4. Cosponsor count with party breakdown as mini bar chart
    5. Latest action with date
    6. Committee assignment badges
    7. Two action buttons: "Track This Bill" and "View Full Details"
    
    Use professional styling with clear hierarchy. Party colors:
    - Democrat (D): blue
    - Republican (R): red
    - Independent (I): gray
  `;

  return (
    <C1Component
      prompt={prompt}
      context={{ billData }}
      onAction={(action: string, data: any) => {
        if (action === 'track' && onTrackBill) {
          onTrackBill(data.billId);
        } else if (action === 'viewDetails' && onViewDetails) {
          onViewDetails(data.billId);
        }
      }}
    />
  );
}
```

### 8.3 Vote Chart Component

```typescript
// src/components/c1/VoteChart.tsx
import React from 'react';
import { C1Component } from '@thesys/react';

interface VoteChartProps {
  voteData: {
    rollCallId: number;
    billNumber: string;
    date: string;
    description: string;
    chamber: string;
    yea: number;
    nay: number;
    nv: number;
    absent: number;
    passed: boolean;
    partyBreakdown: {
      democratic: { yea: number; nay: number; nv: number; absent: number };
      republican: { yea: number; nay: number; nv: number; absent: number };
      independent: { yea: number; nay: number; nv: number; absent: number };
    };
  };
  showIndividualVotes?: boolean;
  onMemberClick?: (memberId: string) => void;
}

export function VoteChart({ voteData, showIndividualVotes, onMemberClick }: VoteChartProps) {
  const prompt = `
    Generate a vote visualization component for this roll call vote:
    
    Vote Info:
    - Roll Call #${voteData.rollCallId}
    - Bill: ${voteData.billNumber}
    - Date: ${voteData.date}
    - Chamber: ${voteData.chamber}
    - Question: ${voteData.description}
    - Result: ${voteData.passed ? 'PASSED' : 'FAILED'}
    
    Vote Totals:
    - Yea: ${voteData.yea}
    - Nay: ${voteData.nay}
    - Not Voting: ${voteData.nv}
    - Absent: ${voteData.absent}
    
    Party Breakdown:
    Democrats: ${voteData.partyBreakdown.democratic.yea} Yea, ${voteData.partyBreakdown.democratic.nay} Nay
    Republicans: ${voteData.partyBreakdown.republican.yea} Yea, ${voteData.partyBreakdown.republican.nay} Nay
    Independents: ${voteData.partyBreakdown.independent.yea} Yea, ${voteData.partyBreakdown.independent.nay} Nay
    
    Create a visualization with:
    1. Header showing bill number, date, and PASSED/FAILED badge (green/red)
    2. A hemicycle/semicircle chart showing Yea (green) vs Nay (red) vs NV (gray)
    3. Total vote count prominently displayed
    4. Party breakdown as stacked horizontal bar charts
    5. Legend for colors
    ${showIndividualVotes ? '6. Option to expand and see individual member votes' : ''}
    
    The visualization should immediately communicate whether the vote passed
    and show the partisan split clearly.
  `;

  return (
    <C1Component
      prompt={prompt}
      context={{ voteData, showIndividualVotes }}
      onAction={(action: string, data: any) => {
        if (action === 'memberClick' && onMemberClick) {
          onMemberClick(data.memberId);
        }
      }}
    />
  );
}
```

### 8.4 Member Profile Component

```typescript
// src/components/c1/MemberProfile.tsx
import React from 'react';
import { C1Component } from '@thesys/react';

interface MemberProfileProps {
  memberData: {
    bioguideId: string;
    name: string;
    party: string;
    state: string;
    district?: string;
    chamber: string;
    photoUrl?: string;
    office?: string;
    phone?: string;
    website?: string;
    twitter?: string;
    leadershipRole?: string;
    committees?: Array<{
      name: string;
      isChair: boolean;
      isRankingMember: boolean;
    }>;
  };
  votingStats?: {
    votesWithParty: number;
    missedVotes: number;
  };
  onContact?: () => void;
  onViewVotes?: () => void;
  onViewBills?: () => void;
}

export function MemberProfile({ memberData, votingStats, onContact, onViewVotes, onViewBills }: MemberProfileProps) {
  const prompt = `
    Generate a member of Congress profile card with this data:
    
    Member Info:
    - Name: ${memberData.name}
    - Party: ${memberData.party} (use party color: D=blue, R=red, I=gray)
    - State: ${memberData.state}${memberData.district ? `, District ${memberData.district}` : ''}
    - Chamber: ${memberData.chamber}
    - Leadership Role: ${memberData.leadershipRole || 'None'}
    
    Contact:
    - Office: ${memberData.office || 'N/A'}
    - Phone: ${memberData.phone || 'N/A'}
    - Website: ${memberData.website || 'N/A'}
    - Twitter: ${memberData.twitter || 'N/A'}
    
    Committees:
    ${memberData.committees?.map(c => `- ${c.name}${c.isChair ? ' (Chair)' : c.isRankingMember ? ' (Ranking Member)' : ''}`).join('\n') || 'None listed'}
    
    ${votingStats ? `
    Voting Stats:
    - Votes with Party: ${votingStats.votesWithParty}%
    - Missed Votes: ${votingStats.missedVotes}%
    ` : ''}
    
    Create a profile card with:
    1. Member photo placeholder (circle) with party-colored border
    2. Name prominently displayed with party badge
    3. State and district info
    4. Leadership role badge if applicable
    5. Contact information section with clickable phone/website/twitter
    6. Committee assignments list with chair/ranking badges
    7. ${votingStats ? 'Voting statistics as small gauge charts' : ''}
    8. Action buttons: "Contact Office", "View Voting Record", "View Sponsored Bills"
    
    Make the card clean and professional, suitable for a legislative dashboard.
  `;

  return (
    <C1Component
      prompt={prompt}
      context={{ memberData, votingStats }}
      onAction={(action: string) => {
        if (action === 'contact' && onContact) onContact();
        if (action === 'viewVotes' && onViewVotes) onViewVotes();
        if (action === 'viewBills' && onViewBills) onViewBills();
      }}
    />
  );
}
```

### 8.5 Regulation Card Component

```typescript
// src/components/c1/RegulationCard.tsx
import React from 'react';
import { C1Component } from '@thesys/react';

interface RegulationCardProps {
  regulationData: {
    documentNumber: string;
    title: string;
    type: string;
    agencies: string[];
    publicationDate: string;
    effectiveDate?: string;
    commentEndDate?: string;
    abstract?: string;
    pdfUrl: string;
    htmlUrl: string;
    significant: boolean;
  };
  onViewDocument?: () => void;
  onTrackRule?: () => void;
  onSubmitComment?: () => void;
}

export function RegulationCard({ regulationData, onViewDocument, onTrackRule, onSubmitComment }: RegulationCardProps) {
  const isCommentOpen = regulationData.commentEndDate && 
    new Date(regulationData.commentEndDate) > new Date();
  
  const prompt = `
    Generate a regulation/rule card for Federal Register document:
    
    Document Info:
    - Document Number: ${regulationData.documentNumber}
    - Title: ${regulationData.title}
    - Type: ${regulationData.type} (${
      regulationData.type === 'RULE' ? 'Final Rule' :
      regulationData.type === 'PRORULE' ? 'Proposed Rule' :
      regulationData.type === 'NOTICE' ? 'Notice' : 'Presidential Document'
    })
    - Agencies: ${regulationData.agencies.join(', ')}
    - Publication Date: ${regulationData.publicationDate}
    - Effective Date: ${regulationData.effectiveDate || 'N/A'}
    - Comment Period Ends: ${regulationData.commentEndDate || 'N/A'}
    - Significant Rule: ${regulationData.significant ? 'Yes' : 'No'}
    
    Abstract: ${regulationData.abstract || 'No abstract available'}
    
    Create a card with:
    1. Header with document type badge (color-coded: Final=green, Proposed=amber, Notice=blue)
    2. Title (truncate if too long, show full on hover)
    3. Agency names as tags
    4. Key dates in a compact format
    5. ${regulationData.significant ? '"Significant Rule" warning badge' : ''}
    6. ${isCommentOpen ? '"Comment Period Open" badge with days remaining countdown' : ''}
    7. Abstract preview (first 200 chars)
    8. Action buttons: "View Document", "Track Rule"${isCommentOpen ? ', "Submit Comment"' : ''}
    
    Use Federal Register styling with clean typography.
  `;

  return (
    <C1Component
      prompt={prompt}
      context={{ regulationData, isCommentOpen }}
      onAction={(action: string) => {
        if (action === 'view' && onViewDocument) onViewDocument();
        if (action === 'track' && onTrackRule) onTrackRule();
        if (action === 'comment' && onSubmitComment) onSubmitComment();
      }}
    />
  );
}
```

---

## 9. News Carousel Component

### 9.1 News Article Card

```typescript
// src/components/c1/NewsArticleCard.tsx
import React from 'react';
import { C1Component } from '@thesys/react';

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  thumbnail?: string;
  category?: string;
}

interface NewsArticleCardProps {
  article: NewsArticle;
  onReadMore?: (url: string) => void;
  onSave?: (article: NewsArticle) => void;
  onShare?: (article: NewsArticle) => void;
}

export function NewsArticleCard({ article, onReadMore, onSave, onShare }: NewsArticleCardProps) {
  const prompt = `
    Generate a news article card with:
    
    Article Data:
    - Title: ${article.title}
    - Description: ${article.description}
    - Source: ${article.source}
    - Published: ${article.publishedAt}
    - Thumbnail: ${article.thumbnail ? 'Available' : 'None'}
    - Category: ${article.category || 'General'}
    
    Card requirements:
    1. Thumbnail image at top (or placeholder gradient if none)
    2. Source name and time ago (e.g., "2 hours ago") in small text
    3. Title in bold (max 2 lines, ellipsis overflow)
    4. Description preview (max 3 lines)
    5. Category badge if available
    6. Bottom row with: "Read More" link, Save icon button, Share icon button
    
    Card dimensions: Fixed width ~300px, variable height.
    Hover effect: Subtle shadow lift.
    Style: Clean, professional news reader aesthetic.
  `;

  return (
    <C1Component
      prompt={prompt}
      context={{ article }}
      onAction={(action: string) => {
        if (action === 'readMore' && onReadMore) onReadMore(article.url);
        if (action === 'save' && onSave) onSave(article);
        if (action === 'share' && onShare) onShare(article);
      }}
    />
  );
}
```

### 9.2 News Carousel Component

```typescript
// src/components/c1/NewsCarousel.tsx
import React, { useState, useRef } from 'react';
import { C1Component } from '@thesys/react';

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  thumbnail?: string;
  category?: string;
}

interface NewsCarouselProps {
  title: string;
  subtitle?: string;
  articles: NewsArticle[];
  isLoading?: boolean;
  error?: string;
  onReadArticle?: (url: string) => void;
  onSaveArticle?: (article: NewsArticle) => void;
  onRefresh?: () => void;
  onViewAll?: () => void;
}

export function NewsCarousel({
  title,
  subtitle,
  articles,
  isLoading,
  error,
  onReadArticle,
  onSaveArticle,
  onRefresh,
  onViewAll,
}: NewsCarouselProps) {
  
  const prompt = `
    Generate a horizontal news carousel component with the following:
    
    Header:
    - Title: "${title}"
    - Subtitle: "${subtitle || ''}"
    - Right side: Refresh button (circular arrow icon), "View All" link
    
    State:
    - Loading: ${isLoading ? 'Yes - show skeleton cards' : 'No'}
    - Error: ${error ? `Yes - "${error}"` : 'No'}
    - Article Count: ${articles.length}
    
    Articles Data (for rendering cards):
    ${JSON.stringify(articles.slice(0, 10), null, 2)}
    
    Carousel Requirements:
    1. Horizontal scrollable container with smooth scroll behavior
    2. Left/Right navigation arrows (appear on hover, hide when at ends)
    3. Cards are 300px wide with 16px gap between them
    4. Show partial card at edge to indicate more content
    5. Scroll by 2 cards per arrow click
    6. Touch/swipe support for mobile
    7. Scroll indicators (dots) below carousel
    
    Each Card Should Show:
    1. Thumbnail image (or gradient placeholder)
    2. Source name and time ago (top left, small text)
    3. Title (bold, max 2 lines with ellipsis)
    4. Description (max 2 lines)
    5. Category badge (if available)
    6. "Read More" link at bottom
    
    Loading State:
    - Show 4 skeleton cards with animated pulse effect
    - Skeleton: gray placeholder for image, 2 gray bars for title, 3 shorter bars for description
    
    Error State:
    - Show error message with retry button
    - "Unable to load news. [Retry]"
    
    Empty State (0 articles):
    - "No recent news found for this topic."
    
    Styling:
    - Clean, modern news reader aesthetic
    - Subtle shadows on cards
    - Smooth transitions
    - Professional color scheme (dark blue headers, white cards)
    
    Accessibility:
    - Arrow buttons have aria-labels
    - Cards are keyboard navigable
    - Scroll position announced to screen readers
  `;

  return (
    <C1Component
      prompt={prompt}
      context={{ 
        title, 
        subtitle, 
        articles, 
        isLoading, 
        error,
        articleCount: articles.length 
      }}
      onAction={(action: string, data?: any) => {
        switch (action) {
          case 'readArticle':
            if (onReadArticle && data?.url) onReadArticle(data.url);
            break;
          case 'saveArticle':
            if (onSaveArticle && data?.article) onSaveArticle(data.article);
            break;
          case 'refresh':
            if (onRefresh) onRefresh();
            break;
          case 'viewAll':
            if (onViewAll) onViewAll();
            break;
        }
      }}
    />
  );
}
```

### 9.3 News Dashboard Integration

```typescript
// src/components/c1/NewsDashboard.tsx
import React, { useState, useEffect } from 'react';
import { NewsCarousel } from './NewsCarousel';

interface NewsDashboardProps {
  // Tool functions from Mastra agent
  searchNews: (query: string, topic: string, freshness: string) => Promise<any>;
  memberNews: (memberName: string, freshness: string) => Promise<any>;
  issueNews: (issue: string, freshness: string) => Promise<any>;
}

export function NewsDashboard({ searchNews, memberNews, issueNews }: NewsDashboardProps) {
  const [legislationNews, setLegislationNews] = useState<any[]>([]);
  const [policyNews, setPolicyNews] = useState<any[]>([]);
  const [memberSpotlight, setMemberSpotlight] = useState<any[]>([]);
  const [loading, setLoading] = useState({
    legislation: true,
    policy: true,
    member: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAllNews();
  }, []);

  async function loadAllNews() {
    // Load legislation news
    try {
      setLoading(prev => ({ ...prev, legislation: true }));
      const result = await searchNews("Congress bill legislation", "legislation", "pw");
      setLegislationNews(result.articles || []);
    } catch (err: any) {
      setErrors(prev => ({ ...prev, legislation: err.message }));
    } finally {
      setLoading(prev => ({ ...prev, legislation: false }));
    }

    // Load policy news
    try {
      setLoading(prev => ({ ...prev, policy: true }));
      const result = await issueNews("federal policy regulation", "pw");
      setPolicyNews(result.articles || []);
    } catch (err: any) {
      setErrors(prev => ({ ...prev, policy: err.message }));
    } finally {
      setLoading(prev => ({ ...prev, policy: false }));
    }

    // Load member spotlight (example with specific member)
    try {
      setLoading(prev => ({ ...prev, member: true }));
      const result = await memberNews("Chuck Schumer", "pw");
      setMemberSpotlight(result.articles || []);
    } catch (err: any) {
      setErrors(prev => ({ ...prev, member: err.message }));
    } finally {
      setLoading(prev => ({ ...prev, member: false }));
    }
  }

  function handleReadArticle(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="news-dashboard">
      <h1>Legislative News Dashboard</h1>
      
      <section className="news-section">
        <NewsCarousel
          title="Legislation & Congress"
          subtitle="Latest news on bills and congressional activity"
          articles={legislationNews}
          isLoading={loading.legislation}
          error={errors.legislation}
          onReadArticle={handleReadArticle}
          onRefresh={() => searchNews("Congress bill legislation", "legislation", "pw")
            .then(r => setLegislationNews(r.articles || []))}
        />
      </section>

      <section className="news-section">
        <NewsCarousel
          title="Policy & Regulation"
          subtitle="Federal policy and regulatory news"
          articles={policyNews}
          isLoading={loading.policy}
          error={errors.policy}
          onReadArticle={handleReadArticle}
          onRefresh={() => issueNews("federal policy regulation", "pw")
            .then(r => setPolicyNews(r.articles || []))}
        />
      </section>

      <section className="news-section">
        <NewsCarousel
          title="Member Spotlight"
          subtitle="News about key members of Congress"
          articles={memberSpotlight}
          isLoading={loading.member}
          error={errors.member}
          onReadArticle={handleReadArticle}
        />
      </section>
    </div>
  );
}
```

### 9.4 CSS Styles for News Carousel

```css
/* src/styles/news-carousel.css */

.news-carousel-container {
  position: relative;
  width: 100%;
  padding: 1rem 0;
}

.news-carousel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0 1rem;
}

.news-carousel-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a365d;
  margin: 0;
}

.news-carousel-header .subtitle {
  font-size: 0.875rem;
  color: #718096;
  margin-top: 0.25rem;
}

.news-carousel-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.news-carousel-actions button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.news-carousel-actions button:hover {
  background-color: #edf2f7;
}

.news-carousel-track {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-behavior: smooth;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
  padding: 0.5rem 1rem;
}

.news-carousel-track::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

.news-card {
  flex: 0 0 300px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
}

.news-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.news-card-thumbnail {
  width: 100%;
  height: 160px;
  object-fit: cover;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.news-card-thumbnail.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 2rem;
}

.news-card-content {
  padding: 1rem;
}

.news-card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: #718096;
  margin-bottom: 0.5rem;
}

.news-card-source {
  font-weight: 500;
}

.news-card-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 0.5rem 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-card-description {
  font-size: 0.875rem;
  color: #4a5568;
  margin: 0 0 0.75rem 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-card-category {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: #edf2f7;
  color: #4a5568;
  font-size: 0.75rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.news-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.75rem;
  border-top: 1px solid #edf2f7;
}

.news-card-read-more {
  color: #3182ce;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
}

.news-card-read-more:hover {
  text-decoration: underline;
}

.news-card-actions {
  display: flex;
  gap: 0.5rem;
}

.news-card-actions button {
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  color: #718096;
  transition: color 0.2s;
}

.news-card-actions button:hover {
  color: #3182ce;
}

/* Navigation arrows */
.carousel-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  background: white;
  border: none;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.2s;
}

.news-carousel-container:hover .carousel-nav {
  opacity: 1;
}

.carousel-nav:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.carousel-nav.prev {
  left: 0;
}

.carousel-nav.next {
  right: 0;
}

/* Loading skeleton */
.news-card-skeleton {
  flex: 0 0 300px;
  background: white;
  border-radius: 12px;
  overflow: hidden;
}

.skeleton-thumbnail {
  width: 100%;
  height: 160px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-content {
  padding: 1rem;
}

.skeleton-line {
  height: 1rem;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.skeleton-line.short {
  width: 60%;
}

.skeleton-line.medium {
  width: 80%;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* Scroll indicators */
.carousel-indicators {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.carousel-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #cbd5e0;
  transition: background 0.2s, transform 0.2s;
}

.carousel-indicator.active {
  background: #3182ce;
  transform: scale(1.25);
}

/* Error state */
.carousel-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #718096;
}

.carousel-error button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: #3182ce;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

/* Empty state */
.carousel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #718096;
  font-style: italic;
}
```

---

## 10. Complete Agent Assembly

### 10.1 Agent Definition

```typescript
// src/mastra/agents/legislativeAssistant.ts
import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";

// Legislation tools
import { billLookup } from "../tools/legislation/billLookup";
import { billSearch } from "../tools/legislation/billSearch";
import { billTextSearch } from "../tools/legislation/billTextSearch";

// Member tools
import { memberLookup } from "../tools/members/memberLookup";
import { membersByState } from "../tools/members/membersByState";
import { committeeLookup } from "../tools/members/committeeLookup";

// Vote tools
import { getVoteDetails } from "../tools/votes/getVoteDetails";
import { getBillVotes } from "../tools/votes/getBillVotes";
import { memberVotingRecord } from "../tools/votes/memberVotingRecord";

// Executive branch tools
import { federalRegisterSearch } from "../tools/executive/federalRegisterSearch";
import { federalRegisterDocument } from "../tools/executive/federalRegisterDocument";
import { getExecutiveOrders } from "../tools/executive/getExecutiveOrders";
import { searchRulemaking } from "../tools/executive/searchRulemaking";

// News tools
import { newsSearch } from "../tools/news/newsSearch";
import { memberNews } from "../tools/news/memberNews";
import { issueNews } from "../tools/news/issueNews";

// Output tools
import { constituentDraft } from "../tools/output/constituentDraft";
import { briefingGenerator } from "../tools/output/briefingGenerator";
import { voteRecommendation } from "../tools/output/voteRecommendation";

export const legislativeAssistant = new Agent({
  name: "Legislative Assistant",
  
  instructions: `You are an experienced Congressional legislative assistant with 
deep expertise in bill analysis, vote tracking, regulatory affairs, constituent 
services, and media monitoring. You serve as a knowledgeable aide who can help 
with all aspects of legislative work.

## Your Capabilities

### Legislative Intelligence
- **Bill Analysis**: Use billLookup for specific bills, billSearch for topic searches, 
  billTextSearch to find bills containing specific language
- **Member Information**: Use memberLookup for individual members, membersByState for 
  state delegations, committeeLookup for committee rosters
- **Vote Tracking**: Use getVoteDetails for specific roll calls, getBillVotes for all 
  votes on a bill, memberVotingRecord for voting patterns

### Executive Branch Monitoring
- **Regulations**: Use federalRegisterSearch to find rules and notices, 
  federalRegisterDocument for full details
- **Executive Orders**: Use getExecutiveOrders to track presidential actions
- **Rulemaking**: Use searchRulemaking to monitor comment periods on Regulations.gov

### News & Media Intelligence
- **General News**: Use newsSearch for broad legislative/policy news
- **Member Coverage**: Use memberNews for news about specific members of Congress
- **Issue Tracking**: Use issueNews for coverage of specific policy issues

### Output Generation
- **Constituent Mail**: Use constituentDraft for response letters
- **Briefings**: Use briefingGenerator for briefing documents
- **Vote Recommendations**: Use voteRecommendation for vote analysis memos

## Key Workflows

### "What's happening with [bill]?"
1. billLookup → Get status, sponsors, actions
2. getBillVotes → Check for recorded votes
3. newsSearch → Recent press coverage
4. If enacted: federalRegisterSearch → Implementing regulations

### "Tell me about [member]"
1. memberLookup → Bio, contact, committees
2. memberVotingRecord → Voting patterns
3. memberNews → Recent coverage
4. billSearch → Sponsored legislation

### "Track [issue/policy]"
1. billSearch → Related legislation
2. federalRegisterSearch → Related regulations
3. issueNews → Media coverage
4. searchRulemaking → Open comment periods

### "What Executive Orders affect [topic]?"
1. getExecutiveOrders → Find relevant EOs
2. federalRegisterSearch → Related agency actions
3. newsSearch → Coverage and analysis

### "Draft a response about [issue]"
1. billSearch or federalRegisterSearch → Gather context
2. constituentDraft → Generate appropriate response

## Communication Guidelines

1. **Be Nonpartisan**: Present facts objectively; note partisan perspectives without taking sides
2. **Cite Sources**: Always reference bill numbers, roll call numbers, FR citations
3. **Distinguish Summary from Analysis**: Make clear when you're summarizing vs. interpreting
4. **Tailor Depth**: Brief for principals, detailed for staff, accessible for constituents
5. **Flag Time-Sensitive Items**: Highlight upcoming votes, comment deadlines, hearings
6. **Verify Before Stating**: Use tools to confirm current status before making claims

## Formatting Guidelines

- Use structured formats for complex information (bill summaries, vote breakdowns)
- For news results, present as a curated list with source and date
- For vote data, always show party breakdown
- For regulations, note comment period status
- Keep constituent-facing language accessible; use technical terms for staff

## Error Handling

- If a bill isn't found, suggest checking bill number format or searching by title
- If member lookup fails, try alternative identifiers (name, state-district)
- If API limits are hit, inform user and suggest narrowing search
- Always provide partial results with explanation if full data unavailable`,

  model: anthropic("claude-sonnet-4-20250514"),
  
  tools: {
    // Legislation
    billLookup,
    billSearch,
    billTextSearch,
    
    // Members
    memberLookup,
    membersByState,
    committeeLookup,
    
    // Votes
    getVoteDetails,
    getBillVotes,
    memberVotingRecord,
    
    // Executive branch
    federalRegisterSearch,
    federalRegisterDocument,
    getExecutiveOrders,
    searchRulemaking,
    
    // News
    newsSearch,
    memberNews,
    issueNews,
    
    // Outputs
    constituentDraft,
    briefingGenerator,
    voteRecommendation,
  },
});
```

### 10.2 Mastra Instance Configuration

```typescript
// src/mastra/index.ts
import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { legislativeAssistant } from "./agents/legislativeAssistant";

// Configure storage (optional - for persistence)
const storage = process.env.TURSO_DB_URL 
  ? new LibSQLStore({
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  : undefined;

export const mastra = new Mastra({
  agents: {
    legislativeAssistant,
  },
  storage,
  logger: new PinoLogger({
    name: "LegislativeAssistant",
    level: process.env.LOG_LEVEL || "info",
  }),
});

// Export for use in API routes
export { legislativeAssistant };
```

### 10.3 API Routes

```typescript
// src/app/api/agent/route.ts (Next.js App Router example)
import { NextRequest, NextResponse } from "next/server";
import { mastra } from "@/mastra";

export async function POST(request: NextRequest) {
  try {
    const { message, conversationId } = await request.json();
    
    const agent = mastra.getAgent("legislativeAssistant");
    
    const response = await agent.generate({
      messages: [{ role: "user", content: message }],
      // Optional: include conversation history for context
    });
    
    return NextResponse.json({
      response: response.text,
      toolCalls: response.toolCalls,
    });
    
  } catch (error: any) {
    console.error("Agent error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Streaming version
export async function GET(request: NextRequest) {
  const message = request.nextUrl.searchParams.get("message");
  
  if (!message) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }
  
  const agent = mastra.getAgent("legislativeAssistant");
  
  const stream = await agent.stream({
    messages: [{ role: "user", content: message }],
  });
  
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

---

## 11. Testing & Deployment

### 11.1 Testing Tools Individually

```typescript
// tests/tools/billLookup.test.ts
import { billLookup } from "@/mastra/tools/legislation/billLookup";

describe("billLookup", () => {
  it("should fetch a valid bill", async () => {
    const result = await billLookup.execute({
      context: {
        congress: 118,
        billType: "hr",
        billNumber: 1,
      },
    });
    
    expect(result.billId).toBe("hr1-118");
    expect(result.title).toBeDefined();
    expect(result.sponsor).toBeDefined();
    expect(result.status).toBeDefined();
  });
  
  it("should handle bill not found", async () => {
    await expect(
      billLookup.execute({
        context: {
          congress: 118,
          billType: "hr",
          billNumber: 999999,
        },
      })
    ).rejects.toThrow("Bill not found");
  });
});
```

### 11.2 Testing the Agent

```typescript
// tests/agent/legislativeAssistant.test.ts
import { mastra } from "@/mastra";

describe("Legislative Assistant Agent", () => {
  const agent = mastra.getAgent("legislativeAssistant");
  
  it("should answer questions about bills", async () => {
    const response = await agent.generate({
      messages: [{
        role: "user",
        content: "What is the status of HR 1 in the 118th Congress?",
      }],
    });
    
    expect(response.text).toContain("HR 1");
    expect(response.toolCalls).toContainEqual(
      expect.objectContaining({ name: "bill-lookup" })
    );
  });
  
  it("should search for news", async () => {
    const response = await agent.generate({
      messages: [{
        role: "user",
        content: "What's in the news about immigration policy this week?",
      }],
    });
    
    expect(response.toolCalls).toContainEqual(
      expect.objectContaining({ name: "news-search" })
    );
  });
});
```

### 11.3 Running the Development Server

```bash
# Start Mastra development server with playground
npm run dev

# Server runs at http://localhost:4111
# Playground at http://localhost:4111/
# API docs at http://localhost:4111/swagger-ui
```

### 11.4 Deployment Options

#### Vercel (Recommended for Next.js)

```json
// vercel.json
{
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 60
    }
  },
  "env": {
    "ANTHROPIC_API_KEY": "@anthropic-api-key",
    "CONGRESS_GOV_API_KEY": "@congress-gov-api-key",
    "LEGISCAN_API_KEY": "@legiscan-api-key",
    "BRAVE_SEARCH_API_KEY": "@brave-search-api-key"
  }
}
```

#### Docker

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4111

CMD ["npm", "start"]
```

#### Railway/Render

```yaml
# railway.toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 30
```

---

## Appendix A: API Response Schemas

### Congress.gov Bill Response

```typescript
interface CongressGovBill {
  bill: {
    congress: number;
    type: string;
    number: number;
    title: string;
    shortTitle?: string;
    introducedDate: string;
    originChamber: string;
    latestAction: {
      actionDate: string;
      text: string;
    };
    sponsors: Array<{
      bioguideId: string;
      fullName: string;
      party: string;
      state: string;
    }>;
    cosponsors?: {
      count: number;
    };
    committees?: Array<{
      name: string;
      chamber: string;
    }>;
    laws?: Array<{
      number: string;
      type: string;
    }>;
  };
}
```

### LegiScan Roll Call Response

```typescript
interface LegiScanRollCall {
  roll_call: {
    roll_call_id: number;
    bill_id: number;
    date: string;
    desc: string;
    yea: number;
    nay: number;
    nv: number;
    absent: number;
    passed: 0 | 1;
    chamber: string;
    votes: Array<{
      people_id: number;
      name: string;
      party: string;
      vote: 1 | 2 | 3 | 4; // 1=Yea, 2=Nay, 3=NV, 4=Absent
    }>;
  };
}
```

### Federal Register Document Response

```typescript
interface FederalRegisterDocument {
  document_number: string;
  title: string;
  type: "RULE" | "PRORULE" | "NOTICE" | "PRESDOCU";
  subtype?: string;
  abstract?: string;
  agencies: Array<{
    name: string;
    id: number;
    slug: string;
  }>;
  publication_date: string;
  effective_on?: string;
  comments_close_on?: string;
  pdf_url: string;
  html_url: string;
  citation: string;
  significant?: boolean;
  executive_order_number?: string;
  president?: {
    name: string;
    identifier: string;
  };
}
```

---

## Appendix B: Common Queries Reference

### Bill Status Queries

```
"What's the status of HR 1234?"
"Tell me about the Infrastructure Act"
"What bills has Senator X sponsored?"
"Find bills about climate change"
"What passed the House this week?"
```

### Member Queries

```
"Who represents Wisconsin's 4th district?"
"Tell me about Gwen Moore's voting record"
"Who's on the Judiciary Committee?"
"How did Democrats vote on X?"
```

### Vote Queries

```
"How did the Senate vote on the debt ceiling?"
"Show me the roll call for HR 1234"
"Which Republicans voted against the party?"
```

### Regulation Queries

```
"What regulations has EPA proposed recently?"
"Find Executive Orders about immigration"
"What rules have comment periods open?"
```

### News Queries

```
"What's in the news about the border bill?"
"Recent coverage of Speaker Johnson"
"News about federal student loan policy"
```

---

## Appendix C: Error Codes Reference

| Error | Cause | Resolution |
|-------|-------|------------|
| `BILL_NOT_FOUND` | Invalid bill number or Congress | Verify format: hr1234-118 |
| `MEMBER_NOT_FOUND` | Member name/ID not recognized | Try alternate identifiers |
| `API_RATE_LIMIT` | Too many requests | Wait and retry |
| `INVALID_DATE_RANGE` | Date format incorrect | Use YYYY-MM-DD |
| `LEGISCAN_ERROR` | LegiScan API issue | Check API key validity |

---

## Changelog

- **v1.0.0** - Initial release with full tool suite
- Core legislation, member, and vote tools
- Federal Register and Regulations.gov integration
- News search capabilities
- Thesys C1 UI components including News Carousel

---

*This guide was generated for the Legislative Assistant Agent project. For questions or contributions, contact the development team.*
