# Public Laws Tab & Bill Text Comparison Implementation Plan

**Created**: December 30, 2025
**Status**: Planning

---

## Overview

Two interconnected features to enhance Hakivo's legislative tracking:

1. **Public Laws Tab** - Third tab in Personalized Content widget showing bills signed into law
2. **Bill Text Comparison** - Compare multiple versions of bill text on bill detail page

---

## Feature 1: Public Laws Tab

### Location
`/components/widgets/personalized-content-widget.tsx` - Add "Laws" tab next to existing "News" and "Legislation" tabs

### User Experience
- Tab displays bills that became public law (119th Congress)
- **Filter by user's policy interests** (default) - maps to Congress.gov `policy_area`
- **"Show All" toggle** - display ALL 119th Congress public laws regardless of interests
- Click on law navigates to bill detail page
- Shows: Law number (P.L. 119-XX), title, enactment date, policy area

### Data Source
Congress.gov API: `https://api.congress.gov/v3/law/119/pub`

Response includes:
```json
{
  "laws": [{
    "number": "1",
    "congress": 119,
    "type": "pub",
    "originChamber": "House",
    "title": "...",
    "bill": {
      "congress": 119,
      "type": "hr",
      "number": 1
    }
  }]
}
```

### Database Schema

**New table: `public_laws`**
```sql
CREATE TABLE public_laws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  congress INTEGER NOT NULL,
  law_number INTEGER NOT NULL,
  law_type TEXT DEFAULT 'pub',
  title TEXT NOT NULL,
  bill_type TEXT NOT NULL,
  bill_number INTEGER NOT NULL,
  bill_id UUID REFERENCES bills(id),
  policy_area TEXT,
  enacted_date TIMESTAMP,
  origin_chamber TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(congress, law_type, law_number)
);

CREATE INDEX idx_public_laws_policy_area ON public_laws(policy_area);
CREATE INDEX idx_public_laws_congress ON public_laws(congress);
CREATE INDEX idx_public_laws_enacted ON public_laws(enacted_date DESC);
```

### API Endpoints

**New route: `/app/api/congress/public-laws/route.ts`**
- `GET /api/congress/public-laws` - Fetch public laws
- Query params: `?interests=healthcare,education` or `?all=true`
- Returns laws filtered by policy area or all laws

### Daily Sync Scheduler

**New Raindrop observer: `/hakivo-api/src/public-laws-sync/index.ts`**
- Triggered by daily task (similar to `congress-sync-observer`)
- Fetches new public laws from Congress.gov API
- Maps each law to its bill record in database
- Extracts policy_area from linked bill
- Stores in `public_laws` table

### UI Components

**Modifications to `personalized-content-widget.tsx`:**
1. Add third tab "Laws" with `Scale` icon (from lucide-react)
2. Add state: `publicLaws`, `publicLawsLoading`, `showAllLaws`
3. Add lazy loading pattern (fetch on tab select)
4. Add "Show All" toggle button in Laws tab
5. Map policy interests to filter laws

---

## Feature 2: Bill Text Comparison

### Location
`/app/bills/[id]/bill-detail-client.tsx` - New section in bill detail page

### User Experience
1. User sees "Compare Text Versions" section (collapsed by default)
2. Available versions listed: Introduced, Reported, Engrossed, Enrolled, Public Law
3. User selects two versions to compare
4. Side-by-side or inline diff view shows:
   - **Structural changes** (added/removed/modified text)
   - **AI Summary** explaining legislative significance
5. Option to expand full text of each version

### Text Version Sources
Congress.gov API text formats endpoint:
```
https://api.congress.gov/v3/bill/{congress}/{type}/{number}/text
```

Returns array of text versions with URLs to XML/HTML/PDF

### Storage Architecture

**Raindrop SmartBucket: `bill-texts`** (already exists)
- Store chunked text after fetch-on-demand
- Key format: `{congress}-{type}-{number}-{version}`
- Example: `119-hr-1-ih` (introduced in house)

**Version codes:**
- `ih` - Introduced in House
- `is` - Introduced in Senate
- `rh` - Reported in House
- `rs` - Reported in Senate
- `eh` - Engrossed in House
- `es` - Engrossed in Senate
- `enr` - Enrolled
- `pl` - Public Law

### Comparison Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ User selects two versions to compare                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Check SmartBucket for cached text                           │
│ Key: {congress}-{type}-{number}-{version}                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ If not cached: Fetch from Congress.gov API                  │
│ Parse XML/HTML → plain text                                 │
│ Store chunked text in SmartBucket                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ ALGORITHMIC DIFF (diff-match-patch)                         │
│ - Fast structural comparison                                │
│ - Identifies added/removed/changed sections                 │
│ - Returns diff chunks with change markers                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ CLAUDE SONNET 4 ANALYSIS                                    │
│ - Receives diff summary                                     │
│ - Analyzes legislative significance                         │
│ - Explains what changes mean for policy                     │
│ - Returns 3-5 bullet point summary                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Display to user:                                            │
│ - AI Summary of changes (top)                               │
│ - Interactive diff view (inline or side-by-side)            │
│ - Section navigation                                        │
└─────────────────────────────────────────────────────────────┘
```

### API Endpoints

**New route: `/app/api/congress/bill-text/route.ts`**
- `GET /api/congress/bill-text?congress=119&type=hr&number=1&version=ih`
- Checks SmartBucket cache first
- Fetches and stores if not cached
- Returns text content

**New route: `/app/api/congress/bill-text/compare/route.ts`**
- `POST /api/congress/bill-text/compare`
- Body: `{ congress, type, number, version1, version2 }`
- Returns: `{ diff: [...], aiSummary: "..." }`

### Raindrop Service

**New endpoint in bills-service: `/bills/:congress/:type/:number/text/:version`**
- Handles SmartBucket storage operations
- Retrieves cached text or signals fetch needed

### UI Components

**New component: `/components/bills/text-comparison.tsx`**
- Version selector dropdowns
- Diff view toggle (inline/side-by-side)
- AI summary card
- Section navigator
- Loading states

**Modifications to `bill-detail-client.tsx`:**
- Import and add `<TextComparison />` component
- Pass bill identifier props

### Dependencies
- `diff-match-patch` - Algorithmic diff library
- Existing Claude Sonnet integration (Anthropic SDK)

---

## Implementation Task List

### Phase 1: Public Laws Infrastructure (Backend)

- [ ] **Task 1.1**: Create `public_laws` database table
  - SQL migration script
  - Add indexes for policy_area and congress
  - Run migration on production

- [ ] **Task 1.2**: Create public laws sync observer
  - New file: `/hakivo-api/src/public-laws-sync/index.ts`
  - Fetch from Congress.gov `/law/119/pub` endpoint
  - Parse response and extract policy areas
  - Link to existing bills in database
  - Store in `public_laws` table

- [ ] **Task 1.3**: Create public laws API route
  - New file: `/app/api/congress/public-laws/route.ts`
  - Query params: interests filter or all=true
  - Return formatted public laws array

- [ ] **Task 1.4**: Add daily sync task in Raindrop
  - Update `raindrop.config.json` with new observer
  - Schedule daily sync (after congress-sync-observer)
  - Deploy to Raindrop

### Phase 2: Public Laws Frontend

- [ ] **Task 2.1**: Add Laws tab to personalized-content-widget
  - Import Scale icon from lucide-react
  - Add third tab in Tabs component
  - Change grid to accommodate 3 tabs

- [ ] **Task 2.2**: Add Laws tab state management
  - `publicLaws` state array
  - `publicLawsLoading` boolean
  - `publicLawsFetched` boolean for lazy loading
  - `showAllLaws` toggle state

- [ ] **Task 2.3**: Implement Laws tab content
  - Fetch function on tab select
  - Filter by user's policy interests (default)
  - "Show All" toggle button
  - Law card component showing P.L. number, title, date

- [ ] **Task 2.4**: Add click navigation
  - Navigate to `/bills/{congress}-{type}-{number}` on law click
  - Show policy area badge on each law card

### Phase 3: Bill Text Storage (Backend)

- [ ] **Task 3.1**: Create bill text API route
  - New file: `/app/api/congress/bill-text/route.ts`
  - Check SmartBucket for cached text
  - Fetch from Congress.gov if not cached
  - Parse XML/HTML to plain text
  - Store chunked in SmartBucket
  - Return text content

- [ ] **Task 3.2**: Create text comparison API route
  - New file: `/app/api/congress/bill-text/compare/route.ts`
  - Accept two version codes
  - Fetch both texts (using Task 3.1 logic)
  - Run diff-match-patch comparison
  - Call Claude Sonnet for analysis
  - Return diff + AI summary

- [ ] **Task 3.3**: Add bills-service endpoint for text storage
  - SmartBucket read/write operations
  - Key format: `{congress}-{type}-{number}-{version}`
  - Chunking for large texts

### Phase 4: Bill Text Comparison Frontend

- [ ] **Task 4.1**: Install diff-match-patch dependency
  - `npm install diff-match-patch`
  - `npm install @types/diff-match-patch` (if needed)

- [ ] **Task 4.2**: Create TextComparison component
  - New file: `/components/bills/text-comparison.tsx`
  - Version selector dropdowns
  - Compare button
  - Loading state

- [ ] **Task 4.3**: Implement diff display
  - Inline diff view (default)
  - Side-by-side option toggle
  - Color coding: green=added, red=removed, yellow=changed
  - Section navigation

- [ ] **Task 4.4**: Add AI summary display
  - Summary card above diff
  - Bullet point format
  - "Analyzing changes..." loading state

- [ ] **Task 4.5**: Integrate into bill detail page
  - Import TextComparison component
  - Add collapsible section
  - Pass bill props (congress, type, number)

### Phase 5: Testing & Deployment

- [ ] **Task 5.1**: Test public laws sync
  - Run sync manually
  - Verify database population
  - Check policy area mapping

- [ ] **Task 5.2**: Test Laws tab
  - Verify filtering by interests
  - Test "Show All" toggle
  - Check navigation to bill detail

- [ ] **Task 5.3**: Test text comparison
  - Compare different version pairs
  - Verify SmartBucket caching
  - Check AI summary quality

- [ ] **Task 5.4**: Deploy to production
  - Raindrop: `npx raindrop build deploy -a -s -v <version>`
  - Next.js: Push to main branch
  - Verify all features working

---

## Technical Notes

### LLM Model for Comparison
**Claude Sonnet 4** (`claude-sonnet-4-20250514`) for semantic analysis
- Already integrated in brief-generator
- Good balance of speed and analysis quality
- Prompt template focuses on legislative significance

### SmartBucket Configuration
Existing `bill-texts` bucket in Raindrop config can be used
- Semantic indexing enabled for future search features
- Chunking strategy: Split by section headers

### Policy Area Mapping
Reuse existing `POLICY_AREA_MAP` from `personalized-content-widget.tsx`
- Maps user interests (e.g., "Healthcare") to Congress.gov policy_area values

### Performance Considerations
- Lazy load Laws tab content (only fetch when selected)
- Cache text in SmartBucket to avoid repeated Congress.gov API calls
- Algorithmic diff runs client-side for speed
- AI analysis runs server-side with timeout handling

---

## Files to Create

| File | Purpose |
|------|---------|
| `/hakivo-api/src/public-laws-sync/index.ts` | Raindrop observer for syncing public laws |
| `/app/api/congress/public-laws/route.ts` | API endpoint for fetching public laws |
| `/app/api/congress/bill-text/route.ts` | API endpoint for fetching bill text versions |
| `/app/api/congress/bill-text/compare/route.ts` | API endpoint for comparing text versions |
| `/components/bills/text-comparison.tsx` | React component for text comparison UI |

## Files to Modify

| File | Changes |
|------|---------|
| `/components/widgets/personalized-content-widget.tsx` | Add Laws tab |
| `/app/bills/[id]/bill-detail-client.tsx` | Add TextComparison section |
| `/hakivo-api/raindrop.config.json` | Add public-laws-sync observer |

---

## Estimated Complexity

- **Phase 1**: Medium (database + Raindrop observer)
- **Phase 2**: Low (UI modifications to existing component)
- **Phase 3**: Medium-High (SmartBucket integration + API parsing)
- **Phase 4**: Medium (diff library + Claude integration)
- **Phase 5**: Low (testing and deployment)

Total: ~15-20 tasks across 5 phases
