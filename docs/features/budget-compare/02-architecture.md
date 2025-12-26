# Technical Architecture Document
# Hakivo Legislative Intelligence Suite

**Version:** 1.0
**Date:** December 23, 2025
**Author:** Tarik Moody
**Status:** Draft

---

## Overview

This document outlines the technical architecture for building the Legislative Intelligence Suite using Next.js 15 and Netlify, without Raindrop dependencies. The system will handle data ingestion, storage, AI processing, and real-time user interfaces.

---

## Architecture Principles

1. **Serverless-First**: Netlify Functions for all backend logic
2. **Edge-Optimized**: Static generation where possible, edge functions for dynamic content
3. **Cache Aggressively**: Minimize API calls to rate-limited sources
4. **Graceful Degradation**: System works even when external APIs fail
5. **Mobile-First**: All UIs responsive, touch-friendly

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Budget View │  │ Compare UI  │  │ Documents   │  │ Calendar/Transcripts│ │
│  │ (React)     │  │ (React)     │  │ (React)     │  │ (React)             │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼────────────────┼─────────────────────┼───────────┘
          │                │                │                     │
          ▼                ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            NEXT.JS API LAYER                                 │
│  /app/api/                                                                   │
│  ├── budget/                                                                 │
│  │   ├── appropriations/route.ts      GET - Pipeline status                 │
│  │   ├── spending/route.ts            GET - USASpending data                │
│  │   └── cbo-estimates/route.ts       GET - CBO cost estimates              │
│  ├── compare/                                                                │
│  │   ├── versions/route.ts            GET - Bill version diff               │
│  │   ├── states/route.ts              GET - Cross-state comparison          │
│  │   └── custom/route.ts              POST - Custom text comparison         │
│  ├── documents/                                                              │
│  │   ├── crs/route.ts                 GET - CRS reports                     │
│  │   ├── committee/route.ts           GET - Committee reports               │
│  │   └── search/route.ts              GET - Full-text search                │
│  ├── calendar/                                                               │
│  │   ├── events/route.ts              GET - All calendar events             │
│  │   ├── hearings/route.ts            GET - Hearing schedule                │
│  │   └── export/route.ts              GET - iCal export                     │
│  └── transcripts/                                                            │
│      ├── [id]/route.ts                GET - Single transcript               │
│      └── search/route.ts              GET - Search transcripts              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKGROUND JOBS (Netlify Scheduled Functions)       │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐ │
│  │ sync-appropriations  │  │ sync-calendar        │  │ sync-documents     │ │
│  │ Daily @ 6 AM EST     │  │ Hourly               │  │ Daily @ 5 AM EST   │ │
│  └──────────────────────┘  └──────────────────────┘  └────────────────────┘ │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐ │
│  │ sync-transcripts     │  │ sync-bill-versions   │  │ generate-summaries │ │
│  │ Hourly               │  │ Every 4 hours        │  │ On-demand          │ │
│  └──────────────────────┘  └──────────────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                      │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        CONVEX (Real-time Database)                      ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  ││
│  │  │ appropriations  │  │ bill_versions   │  │ crs_reports             │  ││
│  │  │ _tracking       │  │                 │  │                         │  ││
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  ││
│  │  │ calendar_events │  │ transcripts     │  │ cbo_estimates           │  ││
│  │  │                 │  │                 │  │                         │  ││
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  ││
│  │                                                                         ││
│  │  Benefits: Real-time subscriptions, automatic caching, TypeScript-first ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        CONVEX FILE STORAGE                              ││
│  │  - PDF documents (CRS reports, CBO estimates)                           ││
│  │  - Bill text files (XML, HTML)                                          ││
│  │  - Transcript audio files                                               ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                  │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐ │
│  │ Congress.gov API │  │ GovInfo API      │  │ USASpending.gov API        │ │
│  │ Bills, Members   │  │ Bill Text, GPO   │  │ Federal Spending           │ │
│  │ Rate: 5000/hr    │  │ Rate: Generous   │  │ Rate: Generous             │ │
│  └──────────────────┘  └──────────────────┘  └────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐ │
│  │ OpenStates API   │  │ Claude AI        │  │ C-SPAN (Scraping)          │ │
│  │ State Legislation│  │ Summaries, Diff  │  │ Transcripts, Video         │ │
│  │ Rate: Varies     │  │ Rate: Pay/use    │  │ Rate: Polite               │ │
│  └──────────────────┘  └──────────────────┘  └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema (Convex)

Convex provides a TypeScript-first, real-time database with automatic caching and subscriptions.

### Schema Definition

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Fiscal year appropriations tracking
  appropriations_tracking: defineTable({
    fiscalYear: v.number(),
    chamber: v.union(v.literal("house"), v.literal("senate")),
    subcommittee: v.string(),
    billNumber: v.optional(v.string()),
    congressBillId: v.optional(v.string()),

    // Pipeline status
    status: v.union(
      v.literal("not_started"),
      v.literal("subcommittee"),
      v.literal("committee"),
      v.literal("floor"),
      v.literal("passed"),
      v.literal("conference"),
      v.literal("enacted")
    ),
    subcommitteeDate: v.optional(v.number()), // Unix timestamp
    committeeDate: v.optional(v.number()),
    floorDate: v.optional(v.number()),
    passedDate: v.optional(v.number()),

    // Amounts (in dollars)
    presidentRequest: v.optional(v.number()),
    subcommitteeMark: v.optional(v.number()),
    committeeMark: v.optional(v.number()),
    floorPassed: v.optional(v.number()),
    enactedAmount: v.optional(v.number()),

    // Metadata
    lastAction: v.optional(v.string()),
    lastActionDate: v.optional(v.number()),
  })
    .index("by_fiscal_year", ["fiscalYear"])
    .index("by_status", ["status"])
    .index("by_fiscal_year_chamber", ["fiscalYear", "chamber"]),

  // Bill versions for comparison
  bill_versions: defineTable({
    billId: v.string(), // e.g., "hr1234-119"
    congress: v.number(),
    billType: v.string(), // hr, s, hjres, sjres, etc.
    billNumber: v.number(),

    // Version info
    versionCode: v.string(), // IH, RH, RS, EH, ES, ENR, etc.
    versionName: v.optional(v.string()),
    versionDate: v.optional(v.number()),
    versionOrder: v.optional(v.number()),

    // Content
    textUrl: v.optional(v.string()),
    xmlUrl: v.optional(v.string()),
    pdfUrl: v.optional(v.string()),
    textContent: v.optional(v.string()),
    xmlContent: v.optional(v.string()),
    wordCount: v.optional(v.number()),

    // AI-generated
    summary: v.optional(v.string()),
    changesFromPrevious: v.optional(v.object({
      added: v.array(v.string()),
      removed: v.array(v.string()),
      modified: v.array(v.string()),
    })),
    keyProvisions: v.optional(v.array(v.string())),

    fetchedAt: v.optional(v.number()),
  })
    .index("by_bill", ["billId"])
    .index("by_congress", ["congress"])
    .index("by_bill_version", ["billId", "versionCode"]),

  // CRS Reports
  crs_reports: defineTable({
    reportNumber: v.string(), // e.g., "R47123"
    title: v.string(),

    // Authors and metadata
    authors: v.optional(v.array(v.object({
      name: v.string(),
      role: v.optional(v.string()),
    }))),
    publishDate: v.optional(v.number()),
    coverDate: v.optional(v.number()),
    versionDate: v.optional(v.number()),

    // Classification
    topics: v.optional(v.array(v.string())),
    type: v.optional(v.string()), // Report, In Focus, Legal Sidebar, etc.

    // Content
    summary: v.optional(v.string()),
    htmlUrl: v.optional(v.string()),
    pdfUrl: v.optional(v.string()),
    pdfStorageId: v.optional(v.id("_storage")), // Convex file storage
    htmlContent: v.optional(v.string()),

    // Relations
    relatedBills: v.optional(v.array(v.string())),
    supersededBy: v.optional(v.string()),
    supersedes: v.optional(v.string()),

    source: v.optional(v.string()),
    fetchedAt: v.optional(v.number()),
  })
    .index("by_report_number", ["reportNumber"])
    .index("by_publish_date", ["publishDate"])
    .searchIndex("search_content", {
      searchField: "title",
      filterFields: ["topics", "type"],
    }),

  // CBO Cost Estimates
  cbo_estimates: defineTable({
    billId: v.string(),
    congress: v.number(),

    title: v.optional(v.string()),
    publishDate: v.optional(v.number()),
    pdfUrl: v.optional(v.string()),
    pdfStorageId: v.optional(v.id("_storage")),

    // Cost data
    tenYearCost: v.optional(v.number()),
    costByYear: v.optional(v.object({})), // Flexible object for year: amount
    revenueByYear: v.optional(v.object({})),

    // AI summary
    summary: v.optional(v.string()),
    keyFindings: v.optional(v.array(v.string())),

    fetchedAt: v.optional(v.number()),
  })
    .index("by_bill", ["billId"])
    .index("by_congress", ["congress"]),

  // Calendar events (hearings, markups, floor activity)
  calendar_events: defineTable({
    chamber: v.optional(v.union(
      v.literal("house"),
      v.literal("senate"),
      v.literal("joint")
    )),
    eventType: v.union(
      v.literal("hearing"),
      v.literal("markup"),
      v.literal("floor"),
      v.literal("conference"),
      v.literal("business_meeting"),
      v.literal("other")
    ),
    committeeCode: v.optional(v.string()),
    committeeName: v.optional(v.string()),
    subcommitteeName: v.optional(v.string()),

    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    building: v.optional(v.string()),
    room: v.optional(v.string()),

    startTime: v.number(), // Unix timestamp
    endTime: v.optional(v.number()),
    timezone: v.optional(v.string()),
    isAllDay: v.optional(v.boolean()),
    isCancelled: v.optional(v.boolean()),

    relatedBills: v.optional(v.array(v.string())),
    witnesses: v.optional(v.array(v.object({
      name: v.string(),
      title: v.optional(v.string()),
      organization: v.optional(v.string()),
    }))),
    documents: v.optional(v.array(v.object({
      title: v.string(),
      url: v.string(),
      type: v.optional(v.string()),
    }))),

    videoUrl: v.optional(v.string()),
    liveStreamUrl: v.optional(v.string()),
    transcriptId: v.optional(v.id("transcripts")),

    sourceUrl: v.optional(v.string()),
    source: v.optional(v.string()),
    externalId: v.optional(v.string()),
  })
    .index("by_start_time", ["startTime"])
    .index("by_committee", ["committeeCode"])
    .index("by_event_type", ["eventType"])
    .index("by_external_id", ["externalId", "source"]),

  // Transcripts
  transcripts: defineTable({
    eventId: v.optional(v.id("calendar_events")),

    type: v.union(
      v.literal("hearing"),
      v.literal("markup"),
      v.literal("floor"),
      v.literal("press_conference")
    ),
    chamber: v.optional(v.string()),
    committeeCode: v.optional(v.string()),

    title: v.string(),
    date: v.number(),
    durationSeconds: v.optional(v.number()),

    fullText: v.optional(v.string()),
    segments: v.optional(v.array(v.object({
      speakerId: v.optional(v.string()),
      speakerName: v.string(),
      text: v.string(),
      startTime: v.optional(v.number()),
      endTime: v.optional(v.number()),
    }))),
    speakers: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      role: v.optional(v.string()),
      party: v.optional(v.string()),
      state: v.optional(v.string()),
    }))),

    relatedBills: v.optional(v.array(v.string())),
    videoUrl: v.optional(v.string()),

    source: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    fetchedAt: v.optional(v.number()),
  })
    .index("by_date", ["date"])
    .index("by_committee", ["committeeCode"])
    .index("by_event", ["eventId"])
    .searchIndex("search_content", {
      searchField: "fullText",
      filterFields: ["committeeCode", "type"],
    }),

  // State legislation (for cross-state comparison)
  state_bills: defineTable({
    state: v.string(), // 2-letter code
    session: v.optional(v.string()),
    billId: v.string(), // OpenStates bill ID
    identifier: v.optional(v.string()), // e.g., "HB 1234"

    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    subjects: v.optional(v.array(v.string())),

    status: v.optional(v.string()),
    statusDate: v.optional(v.number()),

    latestVersionUrl: v.optional(v.string()),
    latestVersionDate: v.optional(v.number()),

    topicVector: v.optional(v.array(v.number())), // For similarity search
    matchedFederalBills: v.optional(v.array(v.string())),

    source: v.optional(v.string()),
    fetchedAt: v.optional(v.number()),
  })
    .index("by_state", ["state"])
    .index("by_state_bill", ["state", "billId"])
    .searchIndex("search_content", {
      searchField: "title",
      filterFields: ["state", "subjects"],
    }),
});
```

### Convex Query Functions

```typescript
// convex/appropriations.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all appropriations for a fiscal year
export const getByFiscalYear = query({
  args: { fiscalYear: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("appropriations_tracking")
      .withIndex("by_fiscal_year", (q) => q.eq("fiscalYear", args.fiscalYear))
      .collect();
  },
});

// Get appropriations by chamber
export const getByChamber = query({
  args: { fiscalYear: v.number(), chamber: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("appropriations_tracking")
      .withIndex("by_fiscal_year_chamber", (q) =>
        q.eq("fiscalYear", args.fiscalYear).eq("chamber", args.chamber)
      )
      .collect();
  },
});

// Upsert appropriation tracking
export const upsert = mutation({
  args: {
    fiscalYear: v.number(),
    chamber: v.union(v.literal("house"), v.literal("senate")),
    subcommittee: v.string(),
    data: v.object({
      billNumber: v.optional(v.string()),
      status: v.optional(v.string()),
      // ... other fields
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appropriations_tracking")
      .withIndex("by_fiscal_year_chamber", (q) =>
        q.eq("fiscalYear", args.fiscalYear).eq("chamber", args.chamber)
      )
      .filter((q) => q.eq(q.field("subcommittee"), args.subcommittee))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args.data);
      return existing._id;
    } else {
      return await ctx.db.insert("appropriations_tracking", {
        fiscalYear: args.fiscalYear,
        chamber: args.chamber,
        subcommittee: args.subcommittee,
        status: "not_started",
        ...args.data,
      });
    }
  },
});
```

```typescript
// convex/crs_reports.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Full-text search on CRS reports
export const search = query({
  args: {
    searchQuery: v.string(),
    topics: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("crs_reports")
      .withSearchIndex("search_content", (q) => {
        let search = q.search("title", args.searchQuery);
        if (args.topics?.length) {
          // Filter by topics if provided
        }
        return search;
      });

    return await query.take(args.limit ?? 20);
  },
});

// Get report by number
export const getByNumber = query({
  args: { reportNumber: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crs_reports")
      .withIndex("by_report_number", (q) => q.eq("reportNumber", args.reportNumber))
      .first();
  },
});
```

### Real-Time Subscriptions in React

```typescript
// app/budget/components/AppropriationsPipeline.tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function AppropriationsPipeline({ fiscalYear }: { fiscalYear: number }) {
  // Real-time subscription - automatically updates when data changes
  const appropriations = useQuery(api.appropriations.getByFiscalYear, {
    fiscalYear,
  });

  if (appropriations === undefined) {
    return <div>Loading...</div>;
  }

  const houseBills = appropriations.filter((a) => a.chamber === "house");
  const senateBills = appropriations.filter((a) => a.chamber === "senate");

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <h3>House</h3>
        {houseBills.map((bill) => (
          <PipelineRow key={bill._id} bill={bill} />
        ))}
      </div>
      <div>
        <h3>Senate</h3>
        {senateBills.map((bill) => (
          <PipelineRow key={bill._id} bill={bill} />
        ))}
      </div>
    </div>
  );
}
```

### Convex Advantages for Legislative Intelligence

1. **Real-time updates**: Calendar events, bill status changes update instantly
2. **TypeScript end-to-end**: Schema types flow to frontend automatically
3. **Built-in file storage**: Store PDFs, transcripts directly
4. **Search indexes**: Full-text search on reports, transcripts
5. **Automatic caching**: No need for separate Redis layer
6. **Serverless functions**: Background jobs run in Convex

---

## API Routes Structure

### `/app/api/budget/`

```typescript
// /app/api/budget/appropriations/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fiscalYear = searchParams.get('fy') || currentFiscalYear();

  // Returns pipeline status for all 12 appropriations bills
  // Both House and Senate tracks
  // Cached for 1 hour
}

// /app/api/budget/spending/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agency = searchParams.get('agency');
  const year = searchParams.get('year');

  // Proxies USASpending.gov API
  // Returns spending data by agency/program
  // Cached for 24 hours
}

// /app/api/budget/cbo-estimates/[billId]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { billId: string } }
) {
  // Returns CBO estimate for specific bill
  // Includes AI summary
}
```

### `/app/api/compare/`

```typescript
// /app/api/compare/versions/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const billId = searchParams.get('bill');
  const from = searchParams.get('from'); // Version code
  const to = searchParams.get('to'); // Version code

  // Returns:
  // - Both version texts
  // - Diff data (added, removed, changed sections)
  // - AI summary of changes
}

// /app/api/compare/states/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic');
  const states = searchParams.getAll('state');

  // Returns similar legislation across states
  // Uses topic matching and AI similarity
}

// /app/api/compare/custom/route.ts
export async function POST(request: Request) {
  const { text1, text2, billId } = await request.json();

  // Compare custom text against bill or another text
  // Rate limited to prevent abuse
}
```

### `/app/api/documents/`

```typescript
// /app/api/documents/crs/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const topic = searchParams.get('topic');
  const page = parseInt(searchParams.get('page') || '1');

  // Full-text search across CRS reports
  // Returns paginated results with summaries
}

// /app/api/documents/crs/[reportNumber]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { reportNumber: string } }
) {
  // Returns full CRS report content
  // HTML or PDF redirect
}
```

### `/app/api/calendar/`

```typescript
// /app/api/calendar/events/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const chamber = searchParams.get('chamber');
  const committee = searchParams.get('committee');

  // Returns calendar events for date range
  // Filterable by chamber and committee
}

// /app/api/calendar/export/route.ts
export async function GET(request: Request) {
  // Returns iCal format for subscription
  // Filterable by committee
}
```

### `/app/api/transcripts/`

```typescript
// /app/api/transcripts/search/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const speaker = searchParams.get('speaker');
  const dateFrom = searchParams.get('from');
  const dateTo = searchParams.get('to');

  // Full-text search across transcripts
  // Returns matching segments with context
}

// /app/api/transcripts/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Returns full transcript with segments
  // Includes speaker metadata
}
```

---

## Background Jobs (Netlify Scheduled Functions)

### `/netlify/functions/scheduled/sync-appropriations.ts`

```typescript
import { schedule } from "@netlify/functions";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

// Runs daily at 6 AM EST
export const handler = schedule("0 11 * * *", async () => {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  const fiscalYear = getFiscalYear();

  // 12 Appropriations Subcommittees
  const subcommittees = [
    'Agriculture',
    'Commerce, Justice, Science',
    'Defense',
    'Energy and Water Development',
    'Financial Services',
    'Homeland Security',
    'Interior, Environment',
    'Labor, HHS, Education',
    'Legislative Branch',
    'Military Construction, VA',
    'State, Foreign Operations',
    'Transportation, HUD'
  ];

  for (const subcommittee of subcommittees) {
    // Fetch from Congress.gov API
    const houseBill = await fetchAppropriationsBill('house', subcommittee, fiscalYear);
    const senateBill = await fetchAppropriationsBill('senate', subcommittee, fiscalYear);

    // Upsert to Convex
    await convex.mutation(api.appropriations.upsert, {
      fiscalYear,
      chamber: "house",
      subcommittee,
      data: houseBill
    });
    await convex.mutation(api.appropriations.upsert, {
      fiscalYear,
      chamber: "senate",
      subcommittee,
      data: senateBill
    });
  }

  return { statusCode: 200 };
});
```

### `/netlify/functions/scheduled/sync-calendar.ts`

```typescript
import { schedule } from "@netlify/functions";

// Runs hourly
export const handler = schedule("0 * * * *", async () => {
  // Fetch from multiple sources:
  // 1. House Calendar API
  // 2. Senate Calendar RSS
  // 3. Committee websites

  const houseEvents = await fetchHouseCalendar();
  const senateEvents = await fetchSenateCalendar();
  const committeeEvents = await fetchCommitteeHearings();

  // Deduplicate and merge
  // Upsert to calendar_events table

  return { statusCode: 200 };
});
```

### `/netlify/functions/scheduled/sync-crs.ts`

```typescript
import { schedule } from "@netlify/functions";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

// Runs daily at 5 AM EST
export const handler = schedule("0 10 * * *", async () => {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  // Fetch new reports from EveryCRSReport.com
  const newReports = await fetchNewCRSReports();

  for (const report of newReports) {
    // Upload PDF to Convex file storage
    const pdfStorageId = await convex.mutation(api.files.uploadFromUrl, {
      url: report.pdf_url,
    });

    // Extract text
    const text = await extractPdfText(report.pdf_url);

    // Generate AI summary
    const summary = await generateSummary(text);

    // Save to Convex
    await convex.mutation(api.crsReports.upsert, {
      reportNumber: report.report_number,
      title: report.title,
      pdfStorageId,
      htmlContent: text,
      summary,
      publishDate: new Date(report.publish_date).getTime(),
      topics: report.topics,
    });
  }

  return { statusCode: 200 };
});
```

### `/netlify/functions/scheduled/sync-bill-versions.ts`

```typescript
import { schedule } from "@netlify/functions";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

// Runs every 4 hours
export const handler = schedule("0 */4 * * *", async () => {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  // Get bills updated in last 4 hours from Congress.gov
  const recentBills = await fetchRecentlyUpdatedBills();

  for (const bill of recentBills) {
    const versions = await fetchBillVersions(bill.bill_id);

    for (const version of versions) {
      // Check if we have this version in Convex
      const existing = await convex.query(api.billVersions.getByBillVersion, {
        billId: bill.bill_id,
        versionCode: version.code
      });
      if (existing) continue;

      // Fetch text content
      const text = await fetchBillText(version.text_url);

      // Generate diff from previous version
      const previousVersion = await convex.query(api.billVersions.getPrevious, {
        billId: bill.bill_id,
        versionOrder: version.order
      });
      const changes = previousVersion
        ? await generateDiff(previousVersion.textContent, text)
        : null;

      // AI summary of changes
      const changeSummary = changes
        ? await summarizeChanges(changes)
        : null;

      await convex.mutation(api.billVersions.insert, {
        billId: bill.bill_id,
        versionCode: version.code,
        textContent: text,
        changesFromPrevious: changes,
        summary: changeSummary,
        versionOrder: version.order,
        versionDate: new Date(version.date).getTime(),
      });
    }
  }

  return { statusCode: 200 };
});
```

---

## Frontend Components

### Budget Dashboard

```
/app/budget/
├── page.tsx                    # Main budget dashboard
├── appropriations/
│   ├── page.tsx               # Pipeline tracker
│   └── [subcommittee]/page.tsx # Subcommittee detail
├── explorer/
│   └── page.tsx               # Interactive treemap
└── components/
    ├── AppropriationsPipeline.tsx
    ├── BudgetTreemap.tsx
    ├── SpendingByAgency.tsx
    ├── YearComparison.tsx
    └── CBOEstimateCard.tsx
```

### Bill Comparison

```
/app/compare/
├── page.tsx                    # Comparison home
├── [billId]/
│   └── page.tsx               # Version selector + diff
├── states/
│   └── page.tsx               # Cross-state map
├── custom/
│   └── page.tsx               # Text upload
└── components/
    ├── BillDiffViewer.tsx
    ├── VersionSelector.tsx
    ├── ChangeSummary.tsx
    ├── StateComparisonMap.tsx
    └── SectionNavigator.tsx
```

### Documents Library

```
/app/documents/
├── page.tsx                    # Search all documents
├── crs/
│   ├── page.tsx               # CRS reports list
│   └── [reportNumber]/page.tsx # Report viewer
├── cbo/
│   └── page.tsx               # CBO estimates
├── committee/
│   └── page.tsx               # Committee reports
└── components/
    ├── DocumentSearch.tsx
    ├── CRSReportCard.tsx
    ├── DocumentViewer.tsx
    └── RelatedBills.tsx
```

### Calendar

```
/app/calendar/
├── page.tsx                    # Monthly view
├── week/page.tsx              # Weekly view
├── today/page.tsx             # Today's events
└── components/
    ├── CalendarGrid.tsx
    ├── EventCard.tsx
    ├── LiveNowBanner.tsx
    ├── FilterPanel.tsx
    └── iCalExport.tsx
```

### Transcripts

```
/app/transcripts/
├── page.tsx                    # Search transcripts
├── [id]/page.tsx              # Transcript viewer
└── components/
    ├── TranscriptViewer.tsx
    ├── SpeakerFilter.tsx
    ├── TimestampNav.tsx
    ├── QuoteExport.tsx
    └── VideoSync.tsx
```

---

## External API Integration

### Congress.gov API

```typescript
// /lib/apis/congress.ts
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const BASE_URL = 'https://api.congress.gov/v3';

export async function fetchBill(congress: number, type: string, number: number) {
  const response = await fetch(
    `${BASE_URL}/bill/${congress}/${type}/${number}?api_key=${CONGRESS_API_KEY}`
  );
  return response.json();
}

export async function fetchBillVersions(billUrl: string) {
  const response = await fetch(`${billUrl}/text?api_key=${CONGRESS_API_KEY}`);
  return response.json();
}

export async function searchBills(query: string, options: SearchOptions) {
  const params = new URLSearchParams({
    api_key: CONGRESS_API_KEY,
    query,
    limit: options.limit?.toString() || '20',
    offset: options.offset?.toString() || '0',
  });

  const response = await fetch(`${BASE_URL}/bill?${params}`);
  return response.json();
}
```

### GovInfo API

```typescript
// /lib/apis/govinfo.ts
const GOVINFO_API_KEY = process.env.GOVINFO_API_KEY;
const BASE_URL = 'https://api.govinfo.gov';

export async function fetchBillText(packageId: string, format: 'xml' | 'html' | 'pdf') {
  const response = await fetch(
    `${BASE_URL}/packages/${packageId}/${format}?api_key=${GOVINFO_API_KEY}`
  );
  return response.text();
}

export async function fetchCRSReports(options: { publishedAfter?: string }) {
  const params = new URLSearchParams({
    api_key: GOVINFO_API_KEY,
    collection: 'CRI',
    ...(options.publishedAfter && { publishDateAfter: options.publishedAfter })
  });

  const response = await fetch(`${BASE_URL}/collections/CRI?${params}`);
  return response.json();
}
```

### USASpending API

```typescript
// /lib/apis/usaspending.ts
const BASE_URL = 'https://api.usaspending.gov/api/v2';

export async function fetchAgencySpending(fiscalYear: number) {
  const response = await fetch(`${BASE_URL}/agency/toptier_agencies/`, {
    method: 'GET'
  });
  return response.json();
}

export async function fetchSpendingByCategory(category: string, fiscalYear: number) {
  const response = await fetch(`${BASE_URL}/spending/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filters: {
        time_period: [{ start_date: `${fiscalYear - 1}-10-01`, end_date: `${fiscalYear}-09-30` }]
      },
      category
    })
  });
  return response.json();
}
```

### OpenStates API (State Legislation)

```typescript
// /lib/apis/openstates.ts
const OPENSTATES_API_KEY = process.env.OPENSTATES_API_KEY;
const BASE_URL = 'https://v3.openstates.org/graphql';

export async function searchStateBills(query: string, states?: string[]) {
  const graphqlQuery = `
    query SearchBills($query: String!, $states: [String!]) {
      bills(searchQuery: $query, jurisdiction: $states, first: 20) {
        edges {
          node {
            id
            identifier
            title
            classification
            subject
            latestActionDate
            latestActionDescription
            jurisdiction {
              name
            }
          }
        }
      }
    }
  `;

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': OPENSTATES_API_KEY
    },
    body: JSON.stringify({
      query: graphqlQuery,
      variables: { query, states }
    })
  });

  return response.json();
}
```

---

## AI Integration

### Text Diff with AI Summary

```typescript
// /lib/ai/diff-summary.ts
import { anthropic } from '@/lib/anthropic';
import { diff_match_patch } from 'diff-match-patch';

export async function generateBillDiff(oldText: string, newText: string) {
  // Compute structural diff
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(diffs);

  // Extract significant changes
  const changes = extractSignificantChanges(diffs);

  // Generate AI summary
  const summary = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Summarize the key changes between these bill versions in 3-5 bullet points. Focus on policy impact, not formatting changes.

Previous version excerpts with changes:
${changes.removed.slice(0, 5).join('\n')}

New version additions:
${changes.added.slice(0, 5).join('\n')}

Provide a clear, non-partisan summary of what changed and why it matters.`
    }]
  });

  return {
    diff: diffs,
    added: changes.added,
    removed: changes.removed,
    summary: summary.content[0].text
  };
}
```

### CRS Report Summary

```typescript
// /lib/ai/summarize-report.ts
export async function summarizeCRSReport(reportText: string, title: string) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Summarize this Congressional Research Service report in 2-3 paragraphs for a general audience.

Title: ${title}

Report text (first 10,000 characters):
${reportText.slice(0, 10000)}

Provide:
1. What the report is about (1 sentence)
2. Key findings (2-3 main points)
3. Why it matters (1 sentence)`
    }]
  });

  return response.content[0].text;
}
```

---

## Caching Strategy

### Convex Automatic Caching

Convex provides automatic caching out of the box:

```typescript
// Convex queries are automatically cached and invalidated
// when underlying data changes - no manual cache management needed

// In React components, useQuery automatically handles caching:
const appropriations = useQuery(api.appropriations.getByFiscalYear, {
  fiscalYear: 2025,
});
// - Results are cached client-side
// - Automatically updates when data changes via real-time subscriptions
// - No stale data issues
```

### For External API Calls (Congress.gov, etc.)

```typescript
// convex/lib/cache.ts
// Cache external API responses in Convex

import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Store cached responses
export const setCached = internalMutation({
  args: { key: v.string(), value: v.string(), expiresAt: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.insert("api_cache", args);
  },
});

export const getCached = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const cached = await ctx.db
      .query("api_cache")
      .filter((q) => q.eq(q.field("key"), args.key))
      .first();

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    return null;
  },
});
```

### Static Generation for Documents

```typescript
// /app/documents/crs/[reportNumber]/page.tsx
export async function generateStaticParams() {
  // Pre-render popular CRS reports
  const popularReports = await getPopularReports(100);
  return popularReports.map(r => ({ reportNumber: r.report_number }));
}

export const revalidate = 86400; // Revalidate daily
```

---

## Performance Targets

| Metric | Target | Implementation |
|--------|--------|----------------|
| Initial page load | < 2s | Static generation, edge caching |
| API response | < 500ms | DB indexes, query optimization |
| Diff rendering | < 3s | Web workers, virtual scrolling |
| Search results | < 1s | PostgreSQL FTS, Supabase edge |
| Calendar load | < 1s | Prefetch next 7 days |

---

## Security Considerations

1. **API Key Protection**: All external API keys in environment variables
2. **Rate Limiting**: Implement per-IP rate limits on all endpoints
3. **Input Sanitization**: Validate all search queries and parameters
4. **CORS**: Restrict to hakivo.com domain
5. **Auth for AI Features**: Rate limit AI-heavy operations per user

---

## Deployment

### Environment Variables

```bash
# Convex (includes real-time DB, file storage, and automatic caching)
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOY_KEY=

# External APIs
CONGRESS_API_KEY=
GOVINFO_API_KEY=
OPENSTATES_API_KEY=

# AI
ANTHROPIC_API_KEY=

# Existing Raindrop services
NEXT_PUBLIC_BRIEFS_API_URL=
NEXT_PUBLIC_DB_ADMIN_URL=
```

### Convex Deployment

```bash
# Deploy Convex schema and functions
npx convex deploy

# Or for development
npx convex dev
```

### Netlify Configuration

```toml
# netlify.toml

[build]
  command = "npm run build"
  publish = ".next"

[functions]
  directory = "netlify/functions"

[[plugins]]
  package = "@netlify/plugin-nextjs"

# Scheduled functions
[functions.sync-appropriations]
  schedule = "0 11 * * *"

[functions.sync-calendar]
  schedule = "0 * * * *"

[functions.sync-crs]
  schedule = "0 10 * * *"

[functions.sync-bill-versions]
  schedule = "0 */4 * * *"
```

---

## Integration with Existing Hakivo Platform

### Current Architecture Overview

Hakivo currently has two main backend services:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXISTING HAKIVO ARCHITECTURE                          │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    NEXT.JS FRONTEND (hakivo.com)                      │   │
│  │  /app/briefs/[id]/     - Daily brief viewer                          │   │
│  │  /app/api/             - Local API routes (OG images, etc.)          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                    ┌───────────────┴───────────────┐                        │
│                    ▼                               ▼                        │
│  ┌─────────────────────────────┐   ┌─────────────────────────────────────┐  │
│  │ RAINDROP BRIEFS SERVICE     │   │ RAINDROP DB-ADMIN SERVICE           │  │
│  │ (svc-...yzj)                │   │ (svc-...yzq)                        │  │
│  │                             │   │                                     │  │
│  │ - GET /briefs/:id           │   │ - POST /briefs (create)             │  │
│  │ - GET /briefs/user/:userId  │   │ - Audio generation                  │  │
│  │ - Brief retrieval           │   │ - Spreaker podcast upload           │  │
│  │                             │   │ - Admin operations                  │  │
│  └─────────────────────────────┘   └─────────────────────────────────────┘  │
│                    │                               │                        │
│                    └───────────────┬───────────────┘                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    RAINDROP SMARTSQL DATABASE                         │   │
│  │  - users, user_preferences                                           │   │
│  │  - briefs, brief_articles                                            │   │
│  │  - audio_tracks                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Integration Strategy

The Legislative Intelligence Suite will be built as a **parallel system** that:
1. **Shares authentication** with existing Hakivo user system
2. **Uses its own database** (Supabase) for legislative data
3. **Connects to Raindrop** for user preferences and personalization
4. **Remains independent** for core functionality (works without Raindrop)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INTEGRATED ARCHITECTURE                               │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    NEXT.JS FRONTEND (hakivo.com)                      │   │
│  │                                                                       │   │
│  │  EXISTING                          NEW (Legislative Intelligence)    │   │
│  │  ├─ /briefs/[id]/                  ├─ /budget/                       │   │
│  │  ├─ /dashboard/                    │   ├─ /appropriations            │   │
│  │  └─ /settings/                     │   └─ /explorer                  │   │
│  │                                    ├─ /compare/                       │   │
│  │                                    │   ├─ /[billId]                  │   │
│  │                                    │   └─ /states                    │   │
│  │                                    ├─ /documents/                     │   │
│  │                                    │   ├─ /crs                       │   │
│  │                                    │   └─ /cbo                       │   │
│  │                                    ├─ /calendar/                      │   │
│  │                                    └─ /transcripts/                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                    │                               │                        │
│        ┌──────────┴──────────┐         ┌──────────┴──────────┐             │
│        ▼                     ▼         ▼                     ▼             │
│  ┌───────────────┐   ┌───────────────────┐   ┌───────────────────────────┐ │
│  │ RAINDROP      │   │ RAINDROP          │   │ NEXT.JS API ROUTES        │ │
│  │ BRIEFS SVC    │   │ DB-ADMIN SVC      │   │ (Legislative Features)    │ │
│  │               │   │                   │   │                           │ │
│  │ Briefs API    │   │ User preferences  │◄──│ /api/budget/*             │ │
│  │               │   │ User interests    │   │ /api/compare/*            │ │
│  │               │   │ Location data     │   │ /api/documents/*          │ │
│  │               │   │                   │   │ /api/calendar/*           │ │
│  │               │   │                   │   │ /api/transcripts/*        │ │
│  └───────┬───────┘   └─────────┬─────────┘   └─────────────┬─────────────┘ │
│          │                     │                           │               │
│          │                     │                           │               │
│          ▼                     ▼                           ▼               │
│  ┌───────────────────────────────────┐   ┌───────────────────────────────┐ │
│  │      RAINDROP SMARTSQL            │   │       CONVEX (Real-time DB)   │ │
│  │                                   │   │                               │ │
│  │  - users                          │   │  - appropriations_tracking    │ │
│  │  - user_preferences        ◄──────┼───│  - bill_versions              │ │
│  │  - briefs                         │   │  - crs_reports                │ │
│  │  - brief_articles                 │   │  - cbo_estimates              │ │
│  │  - audio_tracks                   │   │  - calendar_events            │ │
│  │                                   │   │  - transcripts                │ │
│  │                                   │   │  - state_bills                │ │
│  │                                   │   │  + Real-time subscriptions    │ │
│  │                                   │   │  + Built-in file storage      │ │
│  └───────────────────────────────────┘   └───────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### User Data Integration

#### Reading User Preferences from Raindrop

The new legislative features will fetch user preferences from Raindrop to personalize content:

```typescript
// /lib/raindrop/user-preferences.ts
const RAINDROP_DB_ADMIN_URL = process.env.NEXT_PUBLIC_DB_ADMIN_URL;

export interface UserPreferences {
  user_id: string;
  interests: string[];  // ["healthcare", "defense", "education"]
  state: string;        // "TX"
  district: string;     // "TX-23"
  senators: string[];
  representative: string;
}

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  try {
    const response = await fetch(`${RAINDROP_DB_ADMIN_URL}/users/${userId}/preferences`);
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error('Failed to fetch user preferences:', error);
    return null;
  }
}
```

#### Using Preferences in Legislative Features

```typescript
// /app/api/budget/appropriations/route.ts
import { getUserPreferences } from '@/lib/raindrop/user-preferences';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const session = await auth();

  // Get base appropriations data
  const appropriations = await getAppropriationsData();

  // If user is logged in, personalize the response
  if (session?.user?.id) {
    const preferences = await getUserPreferences(session.user.id);

    if (preferences?.interests) {
      // Highlight appropriations bills relevant to user's interests
      appropriations.bills = appropriations.bills.map(bill => ({
        ...bill,
        isRelevant: matchesUserInterests(bill.subcommittee, preferences.interests),
        relevanceReason: getRelevanceReason(bill.subcommittee, preferences.interests)
      }));
    }
  }

  return Response.json(appropriations);
}

function matchesUserInterests(subcommittee: string, interests: string[]): boolean {
  const subcommitteeToInterests: Record<string, string[]> = {
    'Defense': ['defense', 'military', 'veterans', 'national security'],
    'Labor, HHS, Education': ['healthcare', 'education', 'labor'],
    'Agriculture': ['agriculture', 'food', 'rural'],
    'Energy and Water Development': ['energy', 'environment', 'infrastructure'],
    'Homeland Security': ['immigration', 'border security', 'homeland security'],
    // ... more mappings
  };

  const relevant = subcommitteeToInterests[subcommittee] || [];
  return interests.some(interest => relevant.includes(interest.toLowerCase()));
}
```

### Shared Navigation Component

Update the main navigation to include new legislative features:

```typescript
// /components/navigation/MainNav.tsx
export function MainNav() {
  return (
    <nav className="flex items-center space-x-6">
      {/* Existing */}
      <NavLink href="/dashboard">Dashboard</NavLink>
      <NavLink href="/briefs">Daily Briefs</NavLink>

      {/* New Legislative Intelligence */}
      <NavDropdown label="Legislative">
        <NavDropdownItem href="/budget">Budget Tracker</NavDropdownItem>
        <NavDropdownItem href="/compare">Bill Compare</NavDropdownItem>
        <NavDropdownItem href="/documents">Documents</NavDropdownItem>
        <NavDropdownItem href="/calendar">Calendar</NavDropdownItem>
        <NavDropdownItem href="/transcripts">Transcripts</NavDropdownItem>
      </NavDropdown>

      {/* Existing */}
      <NavLink href="/settings">Settings</NavLink>
    </nav>
  );
}
```

### Daily Brief Integration

Connect legislative features to daily briefs:

```typescript
// In brief generation (Raindrop service), add links to legislative features

// Example: When a brief mentions a bill, include a link to compare versions
const enrichedArticle = {
  ...article,
  legislativeLinks: {
    billCompare: article.bill_id ? `/compare/${article.bill_id}` : null,
    crsReports: article.topics ? `/documents/crs?topics=${article.topics.join(',')}` : null,
    relatedHearings: article.committee ? `/calendar?committee=${article.committee}` : null
  }
};
```

### Authentication Flow

Use existing Hakivo authentication:

```typescript
// /lib/auth.ts - Uses existing auth system
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function auth() {
  return getServerSession(authOptions);
}

// API routes check auth for personalized features
export async function GET(request: Request) {
  const session = await auth();

  // Legislative data is PUBLIC (no auth required)
  const data = await getLegislativeData();

  // But personalization requires auth
  if (session?.user) {
    return Response.json(personalizeForUser(data, session.user.id));
  }

  return Response.json(data);
}
```

### Raindrop API Endpoints to Create/Use

The Raindrop db-admin service may need new endpoints:

```typescript
// Endpoints to ADD to Raindrop db-admin if not existing:

// GET /users/:userId/preferences
// Returns user interests, location, followed legislators

// GET /users/:userId/followed-bills
// Returns bills the user is tracking

// POST /users/:userId/followed-bills
// Add a bill to user's tracking list

// GET /users/:userId/alerts
// Returns user's alert preferences

// POST /users/:userId/alerts
// Create a new alert (bill updated, hearing scheduled, etc.)
```

### Cross-Feature Links

#### From Daily Brief to Legislative Features:

```tsx
// In BriefDetailClient.tsx
<BriefArticle article={article}>
  {article.bill_id && (
    <div className="mt-4 flex gap-2">
      <Link href={`/compare/${article.bill_id}`} className="text-sm text-blue-600">
        Compare bill versions
      </Link>
      <Link href={`/documents/crs?bill=${article.bill_id}`} className="text-sm text-blue-600">
        Related CRS reports
      </Link>
    </div>
  )}
</BriefArticle>
```

#### From Legislative Features to Daily Brief:

```tsx
// In BillCompare page
<div className="mt-8">
  <h3>Stay Updated</h3>
  <p>Get daily updates on this bill and related legislation.</p>
  <Link href="/dashboard?track=hr1234-119" className="btn-primary">
    Add to Daily Brief
  </Link>
</div>
```

### Data Flow for Personalization

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      PERSONALIZATION DATA FLOW                            │
│                                                                           │
│   User Action                                                             │
│       │                                                                   │
│       ▼                                                                   │
│   ┌─────────────────┐                                                    │
│   │ Legislative     │──► Check: Is user logged in?                       │
│   │ Feature Page    │         │                                          │
│   └─────────────────┘         │                                          │
│                               ▼                                          │
│                    ┌──────────┴──────────┐                               │
│                    │                     │                               │
│                    ▼                     ▼                               │
│              YES (auth)            NO (guest)                            │
│                    │                     │                               │
│                    ▼                     │                               │
│   ┌─────────────────────────┐           │                               │
│   │ Fetch from Raindrop:    │           │                               │
│   │ - User interests        │           │                               │
│   │ - Location/district     │           │                               │
│   │ - Followed bills        │           │                               │
│   └───────────┬─────────────┘           │                               │
│               │                         │                               │
│               ▼                         │                               │
│   ┌─────────────────────────┐           │                               │
│   │ Fetch from Supabase:    │◄──────────┘                               │
│   │ - Legislative data      │                                           │
│   │ - CRS reports           │                                           │
│   │ - Calendar events       │                                           │
│   └───────────┬─────────────┘                                           │
│               │                                                          │
│               ▼                                                          │
│   ┌─────────────────────────┐                                           │
│   │ Personalize response:   │                                           │
│   │ - Highlight relevant    │                                           │
│   │ - Sort by interest      │                                           │
│   │ - Add "why this matters"│                                           │
│   └───────────┬─────────────┘                                           │
│               │                                                          │
│               ▼                                                          │
│   ┌─────────────────────────┐                                           │
│   │ Return to frontend      │                                           │
│   └─────────────────────────┘                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Environment Variables for Integration

```bash
# Existing Raindrop services
NEXT_PUBLIC_BRIEFS_API_URL=https://svc-...yzj....lmapp.run
NEXT_PUBLIC_DB_ADMIN_URL=https://svc-...yzq....lmapp.run

# Convex (Legislative data - real-time database)
NEXT_PUBLIC_CONVEX_URL=https://xxx.convex.cloud
CONVEX_DEPLOY_KEY=xxx  # For CI/CD deployments

# External APIs
CONGRESS_API_KEY=xxx
GOVINFO_API_KEY=xxx
OPENSTATES_API_KEY=xxx
ANTHROPIC_API_KEY=xxx  # Already exists for briefs
```

### Migration Path

1. **Phase 1**: Build legislative features independently with Convex
2. **Phase 2**: Add user preference fetching from Raindrop
3. **Phase 3**: Add cross-linking between briefs and legislative features
4. **Phase 4**: Add "Add to Brief" functionality (write back to Raindrop)

---

## Next Steps

1. Initialize Convex project and deploy schema
2. Implement sync-appropriations job
3. Build Appropriations Pipeline UI component with real-time subscriptions
4. Add Congress.gov API integration
5. Add Raindrop integration for user preferences

See `03-tasks.md` for detailed task breakdown.
