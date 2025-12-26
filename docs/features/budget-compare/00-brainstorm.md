# Hakivo Legislative Intelligence Suite - Brainstorming Session

## Date: December 23, 2025
## Status: Ideation Phase
## Architecture: Next.js + Netlify (No Raindrop)

---

## The Vision

Build a comprehensive legislative intelligence platform that rivals enterprise tools like Quorum, FiscalNote, and Bloomberg Government—but accessible to everyday citizens, journalists, and advocates.

---

## Feature Categories

### 1. Budget & Appropriations
> "Get the complete financial picture. Track bills, access summaries, monitor appropriations, and explore budget tables."

- 12 annual appropriations bills tracking
- House/Senate subcommittee → committee → floor vote pipeline
- Budget tables and spending data
- CBO cost estimates integration
- Historical comparison

### 2. Bill Summaries, Text Comparisons & Heatmaps
> "Spot differences between bill versions, compare legislation across states, and visualize laws in the making."

- Side-by-side bill version diff
- Cross-state legislation comparison
- "Add your own text" comparison feature
- Visual heatmaps of bill activity
- AI-generated change summaries

### 3. Congressional Documents Library
> "Access CRS Reports, CBO cost estimates, committee reports, congressional press releases, member memos, and more."

- CRS (Congressional Research Service) reports
- CBO cost estimates and projections
- Committee reports and hearing records
- Press releases by member/committee
- Member memos and dear colleague letters

### 4. Session Timelines & Calendars
> "Stay informed on chamber sessions and track scheduled meetings, markups, and other important events in real time."

- House and Senate floor schedules
- Committee hearing calendar
- Markup sessions
- Conference committee meetings
- Recess and session dates

### 5. Transcripts & Records
> "Quickly access complete, verbatim transcripts of congressional hearings, mark-ups, press conferences, key news events, and more – all updated within hours."

- Hearing transcripts
- Markup transcripts
- Floor debate (Congressional Record)
- Press conferences
- Searchable with timestamps

---

## Competitive Analysis

| Feature | Quorum | FiscalNote | GovTrack | Congress.gov | **Hakivo** |
|---------|--------|------------|----------|--------------|------------|
| Bill tracking | ✅ | ✅ | ✅ | ✅ | ✅ |
| Budget tracking | ✅ | ✅ | ❌ | Partial | 🎯 |
| Text comparison | ✅ | ✅ | ❌ | ❌ | 🎯 |
| State comparison | ✅ | ✅ | ❌ | ❌ | 🎯 |
| CRS Reports | ✅ | ✅ | ✅ | ❌ | 🎯 |
| Transcripts | ✅ | ✅ | ❌ | Via GPO | 🎯 |
| Calendars | ✅ | ✅ | ✅ | ✅ | 🎯 |
| AI Summaries | Partial | Partial | ❌ | ❌ | ✅ |
| Personalization | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Price** | $$$$ | $$$$ | Free | Free | **Free** |

**Hakivo Differentiator**: Enterprise-level features with consumer accessibility and AI-native experience.

---

## Data Sources

### Primary APIs

| Source | Data | API Type | Auth | Rate Limits |
|--------|------|----------|------|-------------|
| **Congress.gov** | Bills, members, votes | REST | API Key | 5000/hour |
| **GovInfo** | Bill text, reports, records | REST | None | Generous |
| **USASpending.gov** | Federal spending | REST | None | Generous |
| **OpenStates** | State legislation | GraphQL | API Key | Varies |
| **EveryCRSReport.com** | CRS Reports | Scraping | None | N/A |
| **CBO.gov** | Cost estimates | Scraping | None | N/A |
| **House/Senate calendars** | Schedules | RSS/iCal | None | N/A |

> Note: ProPublica Congress API was previously a data source but is no longer available.

### Secondary Sources

| Source | Data | Method |
|--------|------|--------|
| **C-SPAN** | Video, transcripts | API + scraping |
| **GPO Federal Register** | Regulations | API |
| **House.gov/Senate.gov** | Press releases | RSS feeds |
| **Committee websites** | Hearing info | Scraping |

---

## Technical Architecture (Next.js + Netlify)

### Why No Raindrop?
- Faster iteration without deploy locks
- Direct control over data pipeline
- Simpler debugging
- Can still use Cloudflare D1 or Supabase directly

### Stack

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  Next.js 15 App Router + React 19 + TailwindCSS + shadcn/ui │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER                               │
│  Next.js API Routes (/app/api/*)                            │
│  - /api/budget/* - Budget & appropriations                  │
│  - /api/compare/* - Bill text comparison                    │
│  - /api/documents/* - CRS, CBO, reports                     │
│  - /api/calendar/* - Session schedules                      │
│  - /api/transcripts/* - Hearing transcripts                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKGROUND JOBS                           │
│  Netlify Scheduled Functions (cron)                         │
│  - sync-appropriations.ts (daily)                           │
│  - sync-calendar.ts (hourly)                                │
│  - sync-documents.ts (daily)                                │
│  - sync-transcripts.ts (hourly)                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATABASE                                │
│  Supabase (PostgreSQL)                                      │
│  - appropriations_bills                                     │
│  - bill_versions                                            │
│  - crs_reports                                              │
│  - cbo_estimates                                            │
│  - committee_hearings                                       │
│  - transcripts                                              │
│  - calendar_events                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                          │
│  - Anthropic Claude (AI summaries, comparison)              │
│  - Vultr S3 (document storage)                              │
│  - Vercel Blob (alternative storage)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema (Draft)

### appropriations_tracking
```sql
CREATE TABLE appropriations_tracking (
  id UUID PRIMARY KEY,
  fiscal_year INT NOT NULL,
  bill_type VARCHAR(10), -- 'house' or 'senate'
  subcommittee VARCHAR(100),
  bill_number VARCHAR(20),
  bill_id VARCHAR(50), -- link to bills table

  -- Pipeline status
  subcommittee_markup_date DATE,
  subcommittee_passed BOOLEAN,
  committee_markup_date DATE,
  committee_passed BOOLEAN,
  floor_vote_date DATE,
  floor_passed BOOLEAN,

  -- Amounts
  requested_amount BIGINT,
  subcommittee_amount BIGINT,
  committee_amount BIGINT,
  passed_amount BIGINT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### bill_versions
```sql
CREATE TABLE bill_versions (
  id UUID PRIMARY KEY,
  bill_id VARCHAR(50) NOT NULL,
  version_code VARCHAR(20), -- 'IH', 'RH', 'EH', 'ENR', etc.
  version_name VARCHAR(100),
  version_date DATE,
  text_url VARCHAR(500),
  text_content TEXT,
  xml_content TEXT,

  -- AI-generated
  summary TEXT,
  changes_from_previous TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);
```

### crs_reports
```sql
CREATE TABLE crs_reports (
  id UUID PRIMARY KEY,
  report_number VARCHAR(20) UNIQUE,
  title TEXT NOT NULL,
  authors TEXT[],
  publish_date DATE,
  topics TEXT[],
  summary TEXT,
  pdf_url VARCHAR(500),
  html_content TEXT,

  -- Related
  related_bills TEXT[],

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### calendar_events
```sql
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY,
  chamber VARCHAR(10), -- 'house', 'senate', 'joint'
  event_type VARCHAR(50), -- 'floor', 'hearing', 'markup', 'conference'
  committee VARCHAR(100),
  subcommittee VARCHAR(100),

  title TEXT,
  description TEXT,
  location VARCHAR(200),

  start_time TIMESTAMP,
  end_time TIMESTAMP,

  -- Related
  related_bills TEXT[],
  witnesses TEXT[],

  -- Streams/recordings
  video_url VARCHAR(500),
  transcript_id UUID,

  created_at TIMESTAMP DEFAULT NOW()
);
```

### transcripts
```sql
CREATE TABLE transcripts (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES calendar_events(id),
  source VARCHAR(50), -- 'cspan', 'committee', 'gpo'

  title TEXT,
  date DATE,
  duration_seconds INT,

  -- Content
  full_text TEXT,
  segments JSONB, -- [{speaker, text, timestamp}]

  -- Search
  search_vector TSVECTOR,

  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## UI Components Needed

### Budget Dashboard
- `<AppropriationsTracker />` - Pipeline view (subcommittee → committee → floor)
- `<BudgetTreemap />` - Interactive spending visualization
- `<BudgetTimeline />` - Historical comparison
- `<SpendingByState />` - Geographic breakdown

### Bill Comparison
- `<BillDiff />` - Side-by-side text diff
- `<VersionSelector />` - Dropdown to pick versions
- `<ChangeSummary />` - AI-generated summary
- `<StateComparisonMap />` - US map with legislation status
- `<TextUploader />` - "Add your own text" feature

### Documents Library
- `<DocumentSearch />` - Search across all document types
- `<CRSReportCard />` - Preview card for CRS reports
- `<CBOEstimateCard />` - Cost estimate display
- `<DocumentViewer />` - PDF/HTML viewer

### Calendar
- `<CongressCalendar />` - Monthly/weekly view
- `<EventCard />` - Hearing/markup preview
- `<LiveNowBanner />` - Currently happening events
- `<UpcomingEvents />` - Next 7 days list

### Transcripts
- `<TranscriptViewer />` - Full transcript with timestamps
- `<SpeakerFilter />` - Filter by who's speaking
- `<TranscriptSearch />` - Search within transcript
- `<VideoSync />` - Sync transcript with video

---

## MVP Prioritization

### Phase 1: Core (4 weeks)
**Goal: Ship something useful fast**

1. **Appropriations Tracker** - The 12 bills pipeline view
2. **Bill Version Comparison** - Federal bills only
3. **CRS Reports Browser** - Search and read

### Phase 2: Enhanced (4 weeks)
**Goal: Match competitor basics**

4. **Calendar Integration** - Hearings and markups
5. **State Bill Comparison** - Cross-state analysis
6. **CBO Estimates** - Link to bills

### Phase 3: Advanced (4 weeks)
**Goal: Differentiate**

7. **Transcripts** - Hearing transcripts with search
8. **AI Features** - Smart summaries, alerts
9. **Personalization** - Based on user interests

---

## Open Questions

1. **Transcript sources**: C-SPAN API access? GPO timing?
2. **CRS Reports**: EveryCRSReport.com scraping OK legally?
3. **State data consistency**: OpenStates quality varies—backup plan?
4. **AI costs**: Budget for Claude API calls at scale?
5. **Storage**: How much for PDFs, transcripts, video?
6. **Mobile**: PWA or native app eventually?

---

## Next Steps

1. [x] Brainstorm complete
2. [ ] Create PRD (01-prd.md)
3. [ ] Create Architecture doc (02-architecture.md)
4. [ ] Create Task Plan (03-tasks.md)
5. [ ] Prototype appropriations tracker UI
6. [ ] Set up Supabase schema
7. [ ] Build first data sync job

---

## Inspiration & References

- **Quorum** - quorum.us (enterprise legislative tracking)
- **FiscalNote** - fiscalnote.com (policy intelligence)
- **GovTrack** - govtrack.us (free bill tracking)
- **ProPublica Congress API** - projects.propublica.org/api-docs/congress-api/
- **EveryCRSReport** - everycrsreport.com
- **Congress.gov** - congress.gov (official source)
