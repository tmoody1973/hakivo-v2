# Task Breakdown & Implementation Plan
# Hakivo Legislative Intelligence Suite

**Version:** 1.0
**Date:** December 23, 2025
**Status:** Planning

---

## Overview

This document breaks down the Legislative Intelligence Suite into actionable development tasks organized by feature and priority. Each task includes estimated complexity, dependencies, and acceptance criteria.

---

## Task Complexity Guide

| Complexity | Description | Typical Scope |
|------------|-------------|---------------|
| **XS** | Trivial change | Config, copy, single file |
| **S** | Small task | 1-2 files, straightforward |
| **M** | Medium task | 3-5 files, some complexity |
| **L** | Large task | Multiple files, integration |
| **XL** | Very large | Major feature, multiple systems |

---

## Phase 1: Foundation & MVP (Appropriations Tracker)

### 1.1 Database Setup (Convex)

#### Task 1.1.1: Create Convex Project
- **Complexity:** S
- **Dependencies:** None
- **Description:** Set up Convex project for legislative data
- **Subtasks:**
  - [ ] Run `npx convex dev` to initialize
  - [ ] Configure Convex dashboard
  - [ ] Set up environment variables in Convex
  - [ ] Add CONVEX_URL to Hakivo env
  - [ ] Install `convex` package in Next.js app
- **Acceptance:** Can connect from Next.js app, Convex dashboard accessible

#### Task 1.1.2: Create Core Schema & Functions
- **Complexity:** M
- **Dependencies:** 1.1.1
- **Description:** Create appropriations and bill_versions schema in Convex
- **File:** `/convex/schema.ts`
- **Subtasks:**
  - [ ] Define `appropriations_tracking` table schema
  - [ ] Define `bill_versions` table schema
  - [ ] Create indexes for fiscal year, status queries
  - [ ] Create mutation functions for upsert
  - [ ] Create query functions for fetching
- **Acceptance:** Schema deployed, queries work

#### Task 1.1.3: Create Document Schema & Functions
- **Complexity:** M
- **Dependencies:** 1.1.1
- **Description:** Create schema for CRS reports, CBO estimates
- **Subtasks:**
  - [ ] Define `crs_reports` table schema
  - [ ] Define `cbo_estimates` table schema
  - [ ] Set up Convex search indexes for full-text search
  - [ ] Create query/mutation functions
- **Acceptance:** Can insert and search CRS reports

#### Task 1.1.4: Create Calendar & Transcript Schema
- **Complexity:** M
- **Dependencies:** 1.1.1
- **Description:** Create schema for events and transcripts
- **Subtasks:**
  - [ ] Define `calendar_events` table schema
  - [ ] Define `transcripts` table schema with segments
  - [ ] Set up search indexes for transcripts
  - [ ] Create query/mutation functions
- **Acceptance:** Schema deployed, real-time updates work

---

### 1.2 External API Integration

#### Task 1.2.1: Congress.gov API Client
- **Complexity:** M
- **Dependencies:** None
- **Description:** Create typed API client for Congress.gov
- **File:** `/lib/apis/congress.ts`
- **Subtasks:**
  - [ ] Create base fetch wrapper with API key
  - [ ] Implement `fetchBill()` function
  - [ ] Implement `fetchBillVersions()` function
  - [ ] Implement `searchBills()` function
  - [ ] Add rate limiting logic
  - [ ] Add error handling and retries
- **Acceptance:** Can fetch bill data from Congress.gov

#### Task 1.2.2: GovInfo API Client
- **Complexity:** M
- **Dependencies:** None
- **Description:** Create typed API client for GovInfo
- **File:** `/lib/apis/govinfo.ts`
- **Subtasks:**
  - [ ] Create base fetch wrapper
  - [ ] Implement `fetchBillText()` for XML/HTML/PDF
  - [ ] Implement `fetchPackages()` for collections
  - [ ] Add error handling
- **Acceptance:** Can fetch bill text from GovInfo

#### Task 1.2.3: USASpending API Client
- **Complexity:** S
- **Dependencies:** None
- **Description:** Create API client for federal spending data
- **File:** `/lib/apis/usaspending.ts`
- **Subtasks:**
  - [ ] Implement `fetchAgencySpending()`
  - [ ] Implement `fetchSpendingByCategory()`
  - [ ] Implement `fetchSpendingByState()`
- **Acceptance:** Can fetch spending data

#### Task 1.2.4: OpenStates API Client
- **Complexity:** M
- **Dependencies:** None
- **Description:** Create GraphQL client for state legislation
- **File:** `/lib/apis/openstates.ts`
- **Subtasks:**
  - [ ] Set up GraphQL client
  - [ ] Implement `searchStateBills()` query
  - [ ] Implement `getBillDetails()` query
  - [ ] Add error handling
- **Acceptance:** Can search state bills

---

### 1.3 Background Sync Jobs

#### Task 1.3.1: Appropriations Sync Job
- **Complexity:** L
- **Dependencies:** 1.1.2, 1.2.1
- **Description:** Daily job to sync appropriations bill status
- **File:** `/netlify/functions/scheduled/sync-appropriations.ts`
- **Subtasks:**
  - [ ] Create scheduled function structure
  - [ ] Map 12 subcommittees to bill search queries
  - [ ] Fetch House appropriations bills status
  - [ ] Fetch Senate appropriations bills status
  - [ ] Parse bill status to pipeline stage
  - [ ] Extract funding amounts from bill text
  - [ ] Upsert to database
  - [ ] Add error handling and logging
- **Acceptance:** Database updated daily with accurate status

#### Task 1.3.2: Bill Versions Sync Job
- **Complexity:** L
- **Dependencies:** 1.1.2, 1.2.1, 1.2.2
- **Description:** Sync new bill versions every 4 hours
- **File:** `/netlify/functions/scheduled/sync-bill-versions.ts`
- **Subtasks:**
  - [ ] Query recently updated bills from Congress.gov
  - [ ] Check for new versions not in database
  - [ ] Fetch text content from GovInfo
  - [ ] Calculate version order
  - [ ] Store in database
- **Acceptance:** New bill versions captured within 4 hours

#### Task 1.3.3: CRS Reports Sync Job
- **Complexity:** M
- **Dependencies:** 1.1.3
- **Description:** Daily sync of new CRS reports
- **File:** `/netlify/functions/scheduled/sync-crs.ts`
- **Subtasks:**
  - [ ] Scrape EveryCRSReport.com for new reports
  - [ ] Download PDFs to S3
  - [ ] Extract text content
  - [ ] Store metadata in database
- **Acceptance:** New CRS reports captured daily

#### Task 1.3.4: Calendar Sync Job
- **Complexity:** M
- **Dependencies:** 1.1.4
- **Description:** Hourly sync of congressional calendar
- **File:** `/netlify/functions/scheduled/sync-calendar.ts`
- **Subtasks:**
  - [ ] Fetch House calendar RSS
  - [ ] Fetch Senate calendar RSS
  - [ ] Parse hearing notices from committee websites
  - [ ] Merge and deduplicate events
  - [ ] Upsert to database
- **Acceptance:** Calendar events current within 1 hour

---

### 1.4 Appropriations Tracker UI

#### Task 1.4.1: Create Budget Route Structure
- **Complexity:** S
- **Dependencies:** None
- **Description:** Set up Next.js routes for budget features
- **Subtasks:**
  - [ ] Create `/app/budget/page.tsx` (dashboard)
  - [ ] Create `/app/budget/appropriations/page.tsx`
  - [ ] Create `/app/budget/explorer/page.tsx`
  - [ ] Create `/app/budget/layout.tsx`
- **Acceptance:** Routes accessible, show placeholder

#### Task 1.4.2: Appropriations API Route
- **Complexity:** M
- **Dependencies:** 1.1.2
- **Description:** API to fetch appropriations pipeline data
- **File:** `/app/api/budget/appropriations/route.ts`
- **Subtasks:**
  - [ ] Create GET handler
  - [ ] Query database for current fiscal year
  - [ ] Format response with House/Senate tracks
  - [ ] Add caching (1 hour)
- **Acceptance:** Returns structured appropriations data

#### Task 1.4.3: Appropriations Pipeline Component
- **Complexity:** L
- **Dependencies:** 1.4.2
- **Description:** Visual pipeline showing bill progress
- **File:** `/app/budget/components/AppropriationsPipeline.tsx`
- **Subtasks:**
  - [ ] Design component layout (12 rows, 2 tracks)
  - [ ] Create stage indicators (5 stages)
  - [ ] Add progress visualization
  - [ ] Implement click to expand details
  - [ ] Add filtering by policy area
  - [ ] Make responsive for mobile
- **Acceptance:** Visual pipeline matches design, interactive

#### Task 1.4.4: Subcommittee Detail View
- **Complexity:** M
- **Dependencies:** 1.4.3
- **Description:** Detailed view for single subcommittee
- **File:** `/app/budget/appropriations/[subcommittee]/page.tsx`
- **Subtasks:**
  - [ ] Create detail page layout
  - [ ] Show House and Senate bills side-by-side
  - [ ] Display funding amounts comparison
  - [ ] Show vote history
  - [ ] Link to bill text
- **Acceptance:** Can drill into any subcommittee

#### Task 1.4.5: Budget Dashboard Page
- **Complexity:** M
- **Dependencies:** 1.4.3
- **Description:** Main budget landing page
- **File:** `/app/budget/page.tsx`
- **Subtasks:**
  - [ ] Summary statistics cards
  - [ ] Mini pipeline view
  - [ ] Recent updates feed
  - [ ] Quick links to features
- **Acceptance:** Dashboard provides overview of budget status

---

### 1.5 Navigation Integration

#### Task 1.5.1: Update Main Navigation
- **Complexity:** S
- **Dependencies:** 1.4.1
- **Description:** Add legislative features to site navigation
- **Subtasks:**
  - [ ] Add "Legislative" dropdown to main nav
  - [ ] Include Budget, Compare, Documents links
  - [ ] Style consistently with existing nav
  - [ ] Make mobile-friendly
- **Acceptance:** Can navigate to new features from anywhere

---

## Phase 2: Bill Comparison

### 2.1 Diff Engine

#### Task 2.1.1: Text Diff Library Setup
- **Complexity:** S
- **Dependencies:** None
- **Description:** Set up diff library for bill comparison
- **File:** `/lib/diff/index.ts`
- **Subtasks:**
  - [ ] Install diff-match-patch library
  - [ ] Create wrapper function for clean diffs
  - [ ] Add semantic cleanup
  - [ ] Handle XML structure
- **Acceptance:** Can diff two text strings

#### Task 2.1.2: AI Diff Summary
- **Complexity:** M
- **Dependencies:** 2.1.1
- **Description:** Generate AI summaries of bill changes
- **File:** `/lib/ai/diff-summary.ts`
- **Subtasks:**
  - [ ] Create prompt template for change summary
  - [ ] Extract significant changes from diff
  - [ ] Call Claude API for summary
  - [ ] Cache results
- **Acceptance:** Generates accurate, readable summaries

---

### 2.2 Version Comparison UI

#### Task 2.2.1: Bill Compare Route Structure
- **Complexity:** S
- **Dependencies:** None
- **Description:** Set up compare page routes
- **Subtasks:**
  - [ ] Create `/app/compare/page.tsx`
  - [ ] Create `/app/compare/[billId]/page.tsx`
  - [ ] Create `/app/compare/states/page.tsx`
  - [ ] Create `/app/compare/custom/page.tsx`
- **Acceptance:** Routes accessible

#### Task 2.2.2: Version Comparison API
- **Complexity:** M
- **Dependencies:** 1.1.2, 2.1.1
- **Description:** API to compare two bill versions
- **File:** `/app/api/compare/versions/route.ts`
- **Subtasks:**
  - [ ] Accept bill ID and version codes
  - [ ] Fetch both versions from database
  - [ ] Generate diff
  - [ ] Include AI summary if available
  - [ ] Add caching
- **Acceptance:** Returns diff data for any bill versions

#### Task 2.2.3: Bill Diff Viewer Component
- **Complexity:** XL
- **Dependencies:** 2.2.2
- **Description:** Side-by-side diff viewer for bills
- **File:** `/app/compare/components/BillDiffViewer.tsx`
- **Subtasks:**
  - [ ] Create split-pane layout
  - [ ] Render diff with color coding
  - [ ] Add section navigation
  - [ ] Implement synchronized scrolling
  - [ ] Add expand/collapse for sections
  - [ ] Handle large bills (virtual scrolling)
  - [ ] Export to PDF option
- **Acceptance:** Can view and navigate bill diffs

#### Task 2.2.4: Version Selector Component
- **Complexity:** M
- **Dependencies:** None
- **Description:** UI to select versions to compare
- **File:** `/app/compare/components/VersionSelector.tsx`
- **Subtasks:**
  - [ ] Dropdown for version selection
  - [ ] Show version dates and names
  - [ ] Visual timeline of versions
  - [ ] Quick compare buttons
- **Acceptance:** Easy to select any two versions

#### Task 2.2.5: Bill Search for Compare
- **Complexity:** M
- **Dependencies:** 1.2.1
- **Description:** Search to find bills to compare
- **File:** `/app/compare/components/BillSearch.tsx`
- **Subtasks:**
  - [ ] Search input with autocomplete
  - [ ] Filter by congress, type
  - [ ] Show recent searches
  - [ ] Display bill title and sponsor
- **Acceptance:** Can find any bill quickly

---

### 2.3 Cross-State Comparison

#### Task 2.3.1: State Bill Sync Job
- **Complexity:** L
- **Dependencies:** 1.2.4
- **Description:** Sync state legislation from OpenStates
- **File:** `/netlify/functions/scheduled/sync-state-bills.ts`
- **Subtasks:**
  - [ ] Define topic categories to track
  - [ ] Query OpenStates for each topic
  - [ ] Store in state_bills table
  - [ ] Generate topic vectors for matching
- **Acceptance:** State bills tracked for key topics

#### Task 2.3.2: State Comparison API
- **Complexity:** M
- **Dependencies:** 2.3.1
- **Description:** API to find similar bills across states
- **File:** `/app/api/compare/states/route.ts`
- **Subtasks:**
  - [ ] Accept topic or keywords
  - [ ] Query state_bills by topic/subject
  - [ ] Group by state
  - [ ] Return comparison data
- **Acceptance:** Returns similar bills across states

#### Task 2.3.3: State Comparison Map
- **Complexity:** L
- **Dependencies:** 2.3.2
- **Description:** US map showing legislation status by state
- **File:** `/app/compare/components/StateComparisonMap.tsx`
- **Subtasks:**
  - [ ] Integrate US map SVG or library
  - [ ] Color states by legislation status
  - [ ] Add tooltip with bill info
  - [ ] Click to see state details
  - [ ] Add legend
- **Acceptance:** Interactive map showing bill spread

---

## Phase 3: Documents Library

### 3.1 CRS Reports

#### Task 3.1.1: CRS Reports API
- **Complexity:** M
- **Dependencies:** 1.1.3
- **Description:** API for searching and retrieving CRS reports
- **File:** `/app/api/documents/crs/route.ts`
- **Subtasks:**
  - [ ] Full-text search endpoint
  - [ ] Filter by topic, date, author
  - [ ] Pagination
  - [ ] Single report endpoint
- **Acceptance:** Can search and retrieve CRS reports

#### Task 3.1.2: CRS Reports List Page
- **Complexity:** M
- **Dependencies:** 3.1.1
- **Description:** Searchable list of CRS reports
- **File:** `/app/documents/crs/page.tsx`
- **Subtasks:**
  - [ ] Search bar with filters
  - [ ] Report cards with summary
  - [ ] Topic tags
  - [ ] Sort options
  - [ ] Pagination
- **Acceptance:** Can browse and search CRS reports

#### Task 3.1.3: CRS Report Viewer
- **Complexity:** M
- **Dependencies:** 3.1.1
- **Description:** Full report viewer page
- **File:** `/app/documents/crs/[reportNumber]/page.tsx`
- **Subtasks:**
  - [ ] Display full report content
  - [ ] Related bills sidebar
  - [ ] Download PDF button
  - [ ] Share functionality
  - [ ] Related reports
- **Acceptance:** Can read full CRS report

---

### 3.2 CBO Estimates

#### Task 3.2.1: CBO Estimates Sync
- **Complexity:** M
- **Dependencies:** 1.1.3
- **Description:** Sync CBO cost estimates
- **File:** `/netlify/functions/scheduled/sync-cbo.ts`
- **Subtasks:**
  - [ ] Scrape CBO.gov for new estimates
  - [ ] Parse cost projections
  - [ ] Link to bills
  - [ ] Store in database
- **Acceptance:** CBO estimates captured and linked

#### Task 3.2.2: CBO Estimates API
- **Complexity:** S
- **Dependencies:** 3.2.1
- **Description:** API to fetch CBO estimates
- **File:** `/app/api/documents/cbo/route.ts`
- **Subtasks:**
  - [ ] By bill ID endpoint
  - [ ] Search by date/amount
  - [ ] Include cost projections
- **Acceptance:** Can retrieve CBO estimates

#### Task 3.2.3: CBO Estimate Component
- **Complexity:** M
- **Dependencies:** 3.2.2
- **Description:** Visual cost estimate display
- **File:** `/app/documents/components/CBOEstimateCard.tsx`
- **Subtasks:**
  - [ ] 10-year cost chart
  - [ ] Key findings summary
  - [ ] Link to full PDF
  - [ ] Comparison to request
- **Acceptance:** Clear visualization of cost estimates

---

## Phase 4: Calendar

### 4.1 Calendar Features

#### Task 4.1.1: Calendar API
- **Complexity:** M
- **Dependencies:** 1.1.4
- **Description:** API for congressional calendar
- **File:** `/app/api/calendar/events/route.ts`
- **Subtasks:**
  - [ ] Date range query
  - [ ] Filter by chamber/committee
  - [ ] Filter by event type
  - [ ] Include witness info
- **Acceptance:** Can query calendar events

#### Task 4.1.2: iCal Export API
- **Complexity:** S
- **Dependencies:** 4.1.1
- **Description:** Export calendar as iCal
- **File:** `/app/api/calendar/export/route.ts`
- **Subtasks:**
  - [ ] Generate ICS format
  - [ ] Filter by subscription
  - [ ] Set proper headers
- **Acceptance:** Calendar subscribable in apps

#### Task 4.1.3: Calendar Grid Component
- **Complexity:** L
- **Dependencies:** 4.1.1
- **Description:** Monthly/weekly calendar view
- **File:** `/app/calendar/components/CalendarGrid.tsx`
- **Subtasks:**
  - [ ] Month view with event dots
  - [ ] Week view with time slots
  - [ ] Day view detail
  - [ ] Navigation between views
  - [ ] Mobile swipe support
- **Acceptance:** Full-featured calendar UI

#### Task 4.1.4: Event Card Component
- **Complexity:** M
- **Dependencies:** None
- **Description:** Event preview card
- **File:** `/app/calendar/components/EventCard.tsx`
- **Subtasks:**
  - [ ] Title, time, location
  - [ ] Committee info
  - [ ] Witness list
  - [ ] Related bills
  - [ ] Watch/transcript links
- **Acceptance:** Informative event previews

#### Task 4.1.5: Live Now Banner
- **Complexity:** S
- **Dependencies:** 4.1.1
- **Description:** Shows currently happening events
- **File:** `/app/calendar/components/LiveNowBanner.tsx`
- **Subtasks:**
  - [ ] Poll for current events
  - [ ] Show live indicator
  - [ ] Link to stream
- **Acceptance:** Highlights live events

---

## Phase 5: Transcripts

### 5.1 Transcript Features

#### Task 5.1.1: Transcript Sync Job
- **Complexity:** L
- **Dependencies:** 1.1.4
- **Description:** Sync hearing transcripts
- **File:** `/netlify/functions/scheduled/sync-transcripts.ts`
- **Subtasks:**
  - [ ] Monitor GPO for new transcripts
  - [ ] Scrape C-SPAN transcripts
  - [ ] Parse speaker segments
  - [ ] Store in database
- **Acceptance:** Transcripts captured within 24 hours

#### Task 5.1.2: Transcript Search API
- **Complexity:** M
- **Dependencies:** 1.1.4
- **Description:** Full-text search across transcripts
- **File:** `/app/api/transcripts/search/route.ts`
- **Subtasks:**
  - [ ] Full-text search endpoint
  - [ ] Filter by speaker, date, committee
  - [ ] Return matching segments
  - [ ] Highlight search terms
- **Acceptance:** Can search transcript content

#### Task 5.1.3: Transcript Viewer
- **Complexity:** L
- **Dependencies:** 5.1.2
- **Description:** Full transcript reading interface
- **File:** `/app/transcripts/[id]/page.tsx`
- **Subtasks:**
  - [ ] Display full transcript
  - [ ] Speaker highlighting
  - [ ] Timestamp navigation
  - [ ] Search within transcript
  - [ ] Jump to speaker
  - [ ] Video sync if available
- **Acceptance:** Easy to read and navigate transcripts

#### Task 5.1.4: Quote Export Component
- **Complexity:** S
- **Dependencies:** None
- **Description:** Export quotes with citation
- **File:** `/app/transcripts/components/QuoteExport.tsx`
- **Subtasks:**
  - [ ] Select text to quote
  - [ ] Generate citation
  - [ ] Copy to clipboard
  - [ ] Share options
- **Acceptance:** Can easily cite transcript quotes

---

## Phase 6: Integration & Polish

### 6.1 Raindrop Integration

#### Task 6.1.1: User Preferences Fetcher
- **Complexity:** M
- **Dependencies:** Raindrop endpoints exist
- **Description:** Fetch user preferences from Raindrop
- **File:** `/lib/raindrop/user-preferences.ts`
- **Subtasks:**
  - [ ] Create preference interface
  - [ ] Implement fetch function
  - [ ] Add caching
  - [ ] Handle errors gracefully
- **Acceptance:** Can fetch user preferences

#### Task 6.1.2: Personalize Legislative Data
- **Complexity:** M
- **Dependencies:** 6.1.1
- **Description:** Add personalization to APIs
- **Subtasks:**
  - [ ] Add relevance scoring to appropriations
  - [ ] Highlight user's state in maps
  - [ ] Filter calendar by interests
  - [ ] Add "why this matters" context
- **Acceptance:** Logged-in users see personalized content

#### Task 6.1.3: Cross-Link Daily Briefs
- **Complexity:** M
- **Dependencies:** 6.1.2
- **Description:** Link briefs to legislative features
- **Subtasks:**
  - [ ] Add legislative links to brief articles
  - [ ] Create "Add to Brief" button
  - [ ] Sync tracked bills with preferences
- **Acceptance:** Briefs link to relevant legislative pages

---

### 6.2 AI Features

#### Task 6.2.1: AI Report Summaries
- **Complexity:** M
- **Dependencies:** 3.1.3
- **Description:** Generate AI summaries for CRS reports
- **File:** `/lib/ai/summarize-report.ts`
- **Subtasks:**
  - [ ] Create summary prompt
  - [ ] Implement streaming summary
  - [ ] Cache results
  - [ ] Handle long documents
- **Acceptance:** CRS reports have AI summaries

#### Task 6.2.2: AI Bill Explainer
- **Complexity:** M
- **Dependencies:** 2.2.3
- **Description:** Explain bill sections in plain language
- **Subtasks:**
  - [ ] Create explainer prompt
  - [ ] Add "Explain this" button
  - [ ] Show explanation inline
- **Acceptance:** Users can get plain-language explanations

---

### 6.3 Performance & Polish

#### Task 6.3.1: Add Caching Layer
- **Complexity:** M
- **Dependencies:** All APIs
- **Description:** Implement caching for API responses
- **Subtasks:**
  - [ ] Set up Upstash Redis
  - [ ] Add cache wrapper function
  - [ ] Configure TTLs per endpoint
  - [ ] Add cache invalidation
- **Acceptance:** API responses cached appropriately

#### Task 6.3.2: Error Handling
- **Complexity:** M
- **Dependencies:** All features
- **Description:** Comprehensive error handling
- **Subtasks:**
  - [ ] Add error boundaries
  - [ ] Create error pages
  - [ ] Add retry logic to fetches
  - [ ] Graceful degradation
- **Acceptance:** Errors handled gracefully

#### Task 6.3.3: Mobile Optimization
- **Complexity:** M
- **Dependencies:** All UI
- **Description:** Ensure mobile-first experience
- **Subtasks:**
  - [ ] Test all pages on mobile
  - [ ] Fix layout issues
  - [ ] Optimize touch targets
  - [ ] Add swipe gestures
- **Acceptance:** All features work well on mobile

#### Task 6.3.4: Accessibility Audit
- **Complexity:** M
- **Dependencies:** All UI
- **Description:** Ensure WCAG 2.1 AA compliance
- **Subtasks:**
  - [ ] Run axe accessibility tests
  - [ ] Fix contrast issues
  - [ ] Add ARIA labels
  - [ ] Test keyboard navigation
  - [ ] Test with screen reader
- **Acceptance:** Passes accessibility audit

---

## Task Dependencies Graph

```
Phase 1: Foundation
┌─────────────────┐
│ 1.1 Database    │
│   ├─ 1.1.1 ────┬─► 1.1.2 ─► 1.3.1 Appropriations Sync
│   │            │
│   │            ├─► 1.1.3 ─► 1.3.3 CRS Sync
│   │            │
│   │            └─► 1.1.4 ─► 1.3.4 Calendar Sync
└───┴─────────────┘

┌─────────────────┐
│ 1.2 APIs        │
│   ├─ 1.2.1 ────┬─► 1.3.1 Appropriations Sync
│   │            └─► 1.3.2 Bill Versions Sync
│   ├─ 1.2.2 ────► 1.3.2 Bill Versions Sync
│   ├─ 1.2.3 ────► Budget Explorer
│   └─ 1.2.4 ────► 2.3.1 State Bill Sync
└─────────────────┘

┌─────────────────┐
│ 1.4 UI          │
│   ├─ 1.4.1 ────► 1.4.2 ─► 1.4.3 Pipeline Component
│   │                       │
│   │                       └─► 1.4.4 Subcommittee Detail
│   │                       │
│   │                       └─► 1.4.5 Dashboard
└───┴─────────────┘

Phase 2: Comparison (depends on Phase 1)
┌─────────────────┐
│ 2.1 Diff Engine │
│   ├─ 2.1.1 ────► 2.1.2 AI Summary
│   │            │
│   │            └─► 2.2.2 Version API
└───┴─────────────┘

Phase 3-5: Features (can run in parallel after Phase 1)

Phase 6: Integration (depends on all features)
```

---

## Suggested Sprint Plan

### Sprint 1: Convex & APIs (Week 1)
- Task 1.1.1 - 1.1.4 (Convex setup & schema)
- Task 1.2.1 - 1.2.3 (Core API clients)

### Sprint 2: Sync Jobs (Week 2)
- Task 1.3.1 - 1.3.4 (All sync jobs)
- Task 1.4.1 (Route structure)

### Sprint 3: Appropriations UI (Week 3)
- Task 1.4.2 - 1.4.5 (Appropriations tracker)
- Task 1.5.1 (Navigation)

### Sprint 4: Bill Comparison (Week 4)
- Task 2.1.1 - 2.1.2 (Diff engine)
- Task 2.2.1 - 2.2.5 (Comparison UI)

### Sprint 5: State Comparison & Documents (Week 5-6)
- Task 2.3.1 - 2.3.3 (State comparison)
- Task 3.1.1 - 3.1.3 (CRS reports)
- Task 3.2.1 - 3.2.3 (CBO estimates)

### Sprint 6: Calendar (Week 7)
- Task 4.1.1 - 4.1.5 (Calendar features)

### Sprint 7: Transcripts (Week 8)
- Task 5.1.1 - 5.1.4 (Transcript features)

### Sprint 8: Integration & Polish (Week 9-10)
- Task 6.1.1 - 6.1.3 (Raindrop integration)
- Task 6.2.1 - 6.2.2 (AI features)
- Task 6.3.1 - 6.3.4 (Performance & polish)

---

## Risk Mitigation Tasks

### High Priority Risks

| Risk | Mitigation Task |
|------|-----------------|
| Congress.gov rate limits | Implement aggressive caching, batch requests |
| Large bill text performance | Virtual scrolling, lazy loading |
| AI costs | Selective AI use, caching summaries |
| CRS scraping blocked | Multiple source fallbacks, cache locally |

---

## Testing Requirements

Each feature should include:
- [ ] Unit tests for core logic
- [ ] Integration tests for API routes
- [ ] E2E tests for critical flows
- [ ] Performance benchmarks
- [ ] Accessibility tests

---

## Definition of Done

A task is complete when:
1. Code is written and passes linting
2. Tests pass
3. Feature works on desktop and mobile
4. Accessibility checked
5. PR reviewed and merged
6. Deployed to staging and tested
