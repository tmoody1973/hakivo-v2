# Hakivo Feature Roadmap for Partnership Attractiveness

**Purpose:** Features to build that make Hakivo attractive to potential partners, acquirers, and news outlets
**Date:** December 2025

---

## Target Partners & What They Need

| Partner Type | What They Want | Priority Features |
|--------------|----------------|-------------------|
| **BallotReady** | Year-round engagement, accountability tracking | Promise Tracker, Rep Report Cards |
| **News Outlets** | Embeddable content, data licensing | Widgets, API, Syndication |
| **Advocacy Orgs** | Action tools, issue tracking | Contact integration, Campaign tools |
| **Enterprise (Quorum/FiscalNote)** | Team features, analytics | SSO, Dashboards, Reporting |
| **Podcast Networks** | Content, distribution | RSS feeds, Cross-promotion |

---

## Phase 1: Foundation Features (Weeks 1-4)

### 1.1 Embeddable Widgets

**Why:** News outlets and partners want to embed your content without sending users away

**Widgets to Build:**

```
┌─────────────────────────────────────────┐
│  REP VOTING WIDGET                      │
│  ┌─────┐                                │
│  │ 📷  │  Sen. John Smith (D-WI)       │
│  └─────┘  Last 5 Votes:                │
│           ✅ HR 1234 - Climate Act     │
│           ❌ HR 5678 - Tax Reform      │
│           ✅ S 910 - Healthcare        │
│                                         │
│  [View Full Record on Hakivo]          │
└─────────────────────────────────────────┘
```

| Widget | Description | Embed Code |
|--------|-------------|------------|
| **Rep Voting Record** | Recent votes for any representative | `<hakivo-rep id="S001234">` |
| **Bill Status Tracker** | Live status of any bill | `<hakivo-bill id="hr1234-119">` |
| **District Dashboard** | All reps for an address | `<hakivo-district zip="53202">` |
| **Trending Bills** | Most-tracked legislation | `<hakivo-trending>` |
| **Policy Pulse** | Bills by topic area | `<hakivo-pulse topic="healthcare">` |

**Technical Implementation:**
- Web Components (framework-agnostic)
- JavaScript embed script
- iFrame fallback for restrictive sites
- Customizable themes (light/dark)
- Mobile-responsive

**Files to Create:**
- `public/embed.js` - Widget loader
- `app/embed/[widget]/page.tsx` - Widget routes
- `components/embeds/*` - Widget components

---

### 1.2 Public API for Data Licensing

**Why:** News outlets want raw data for their own analysis/visualization

**Endpoints:**

```
GET /api/public/bills
  - Search bills with filters
  - Returns: bill_id, title, status, sponsor, ai_summary

GET /api/public/bills/:id
  - Full bill details
  - Returns: complete bill data + AI analysis

GET /api/public/representatives/:bioguide_id
  - Rep profile + voting record
  - Returns: bio, votes, sponsored bills, scores

GET /api/public/votes
  - Recent roll call votes
  - Returns: vote details with rep positions

GET /api/public/trending
  - Most-tracked bills
  - Returns: bills ranked by user engagement
```

**Rate Limits:**
- Free: 100 requests/day
- Media Partner: 10,000 requests/day
- Enterprise: Unlimited

**Licensing Tiers:**
| Tier | Price | Use Case |
|------|-------|----------|
| **Attribution** | Free | Must link back to Hakivo |
| **Media License** | $500/month | News organizations |
| **Commercial** | $2,000/month | For-profit redistribution |
| **Enterprise** | Custom | Full data access + SLA |

---

### 1.3 RSS/Syndication Feeds

**Why:** News outlets, podcasters, and aggregators consume RSS

**Feeds to Create:**

| Feed | URL | Content |
|------|-----|---------|
| **Trending Bills** | `/rss/trending` | Top 20 most-tracked bills |
| **New Legislation** | `/rss/new-bills` | Bills introduced today |
| **Major Votes** | `/rss/votes` | Roll call votes |
| **By Topic** | `/rss/topic/healthcare` | Topic-filtered bills |
| **By State** | `/rss/state/wi` | State-specific legislation |
| **Podcast Episodes** | `/rss/podcast` | 100 Laws episodes |
| **Daily Brief Summaries** | `/rss/briefs` | Text summaries (public) |

**Format:** Atom/RSS 2.0 with enclosures for audio

---

## Phase 2: BallotReady-Specific Features (Weeks 4-8)

### 2.1 Campaign Promise Tracker

**Why:** THE killer feature for election accountability

**Data Model:**

```sql
CREATE TABLE campaign_promises (
  id TEXT PRIMARY KEY,
  candidate_bioguide TEXT,
  promise_text TEXT,
  source_url TEXT,
  date_made DATE,
  policy_category TEXT,  -- healthcare, taxes, etc.
  status TEXT,           -- pending, kept, broken, in_progress
  evidence_notes TEXT,
  ai_analysis TEXT,
  created_at DATETIME,
  updated_at DATETIME
);

CREATE TABLE promise_votes (
  promise_id TEXT,
  vote_id TEXT,
  alignment_score INTEGER,  -- -100 to +100
  ai_explanation TEXT,
  PRIMARY KEY (promise_id, vote_id)
);
```

**UI Components:**
- Promise entry form (for researchers/users)
- Promise-to-vote matching (AI-powered)
- Alignment score visualization
- "Promise Kept" / "Promise Broken" badges
- Shareable report cards

**AI Workflow:**
1. User/researcher enters campaign promise
2. AI categorizes by policy area
3. System monitors all votes in that category
4. AI scores each vote's alignment with promise
5. Aggregate into "Promise Alignment Score"

---

### 2.2 Representative Report Cards

**Why:** Simple, shareable accountability metrics

**Report Card Components:**

```
┌─────────────────────────────────────────────────────┐
│  REPRESENTATIVE REPORT CARD                         │
│  Sen. Jane Doe (D-CA) | 119th Congress             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ATTENDANCE        ████████████░░ 87%              │
│  Bills Sponsored   ████████░░░░░░ 23 bills         │
│  Bipartisan Score  ██████░░░░░░░░ 45%              │
│  Promise Alignment ████████████░░ 78%              │
│                                                     │
│  TOP ISSUES VOTED ON:                              │
│  🏥 Healthcare (12 votes)                          │
│  💰 Economy (8 votes)                              │
│  🌍 Climate (6 votes)                              │
│                                                     │
│  [Download PDF] [Share] [Compare to Challenger]    │
└─────────────────────────────────────────────────────┘
```

**Metrics to Calculate:**
- Attendance rate (% of votes participated)
- Bills sponsored (total + passed)
- Bipartisan cosponsorship score
- Committee activity score
- Constituent response score (if available)
- Promise alignment score

**Output Formats:**
- Web view (shareable URL)
- PDF download
- Social media card (OG image)
- Embeddable widget

---

### 2.3 Election Integration Module

**Why:** Direct tie-in to BallotReady's election data

**Features:**
- Import candidate positions from BallotReady API
- Show incumbent record vs. challenger promises
- "Informed Voter Guide" generation
- Election countdown with activity summary
- Post-election transition tracking

**Integration Points:**
```
BallotReady API                    Hakivo Features
─────────────────────────────────────────────────────
Candidate positions      →         Promise Tracker baseline
Election dates           →         Countdown + summary triggers
Ballot measures          →         Bill tracking for measures
Voter registration       →         Engagement score component
Polling locations        →         Cross-link in briefs
```

---

## Phase 3: News Outlet Features (Weeks 8-12)

### 3.1 Data Visualization Library

**Why:** News outlets need charts/graphics for stories

**Visualizations to Build:**

| Chart Type | Use Case | Example |
|------------|----------|---------|
| **Vote Breakdown** | Party-line vs. bipartisan | Pie/donut chart |
| **Bill Timeline** | Legislation journey | Horizontal timeline |
| **Rep Comparison** | Side-by-side voting | Bar chart |
| **State Heatmap** | State-by-state support | Choropleth map |
| **Topic Trend** | Bills over time by topic | Line chart |
| **Influence Network** | Cosponsor relationships | Force-directed graph |

**Implementation:**
- D3.js or Chart.js components
- Export as PNG, SVG, or embed code
- Customizable colors/branding
- Mobile-responsive
- Animation options

---

### 3.2 Journalist Toolkit

**Why:** Make it easy for reporters to cover legislation

**Features:**

**Bill Deep Dive Export:**
```
One-click export of:
- Plain-language summary (AI-generated)
- Key stakeholder impacts
- Arguments for/against
- Related historical legislation
- Expert contact suggestions
- Social media angles
```

**Story Leads Feed:**
```
AI-generated story suggestions:
- "Unusual bipartisan vote on HR 1234"
- "Senator X broke with party on key issue"
- "Bill Y gaining unexpected momentum"
- "Major policy shift: 5 new bills on topic Z"
```

**Expert Source Database:**
```
For each bill/topic:
- Academic experts
- Think tank analysts
- Affected industry reps
- Advocacy group contacts
(Aggregated from public sources)
```

**Deadline Tracker:**
```
Upcoming legislative events:
- Committee hearings this week
- Floor votes scheduled
- Comment periods closing
- Amendment deadlines
```

---

### 3.3 Newsroom API & Webhooks

**Why:** Real-time alerts for breaking legislative news

**Webhook Events:**

| Event | Trigger | Payload |
|-------|---------|---------|
| `bill.introduced` | New bill filed | Bill summary + sponsor |
| `bill.passed_chamber` | Bill passes House/Senate | Vote tally + next steps |
| `bill.signed` | President signs | Full bill + impact analysis |
| `vote.recorded` | Roll call vote | Vote breakdown by party |
| `rep.unusual_vote` | Rep breaks with party | Context + analysis |
| `topic.trending` | Spike in topic activity | Related bills + summary |

**Integration:**
- Slack webhook support
- Microsoft Teams connector
- Email digest option
- Custom webhook endpoints

---

## Phase 4: Advocacy & Action Features (Weeks 12-16)

### 4.1 Contact Your Rep Integration

**Why:** Turn insight into action

**Features:**
- One-click contact buttons (email, phone, X/Twitter)
- Pre-written message templates
- AI-generated talking points
- Track which bills drove most contact
- Deep links to Resistbot

**UI:**
```
┌─────────────────────────────────────────┐
│  TAKE ACTION ON HR 1234                 │
│                                         │
│  Your Rep: Rep. Smith voted YES ✅      │
│                                         │
│  [📧 Email Thanks]  [📞 Call Office]   │
│  [🐦 Tweet at Rep]  [📱 Text via Bot]  │
│                                         │
│  AI-Generated Message:                  │
│  "Thank you for supporting the Clean    │
│   Energy Act. As your constituent..."   │
│                                         │
│  [Copy Message] [Customize]             │
└─────────────────────────────────────────┘
```

---

### 4.2 Issue Campaign Builder

**Why:** Advocacy orgs want to mobilize around specific bills

**Features:**
- Custom landing pages per campaign
- Bill tracking with org branding
- Supporter signup + email collection
- Action metrics dashboard
- Embeddable action widgets

**Use Case:**
Sierra Club wants to track climate bills:
```
sierraclub.hakivo.app/climate-action

- Curated list of climate bills
- Sierra Club messaging/framing
- Action buttons with their templates
- Supporter engagement metrics
```

---

### 4.3 Civic Action Score

**Why:** Gamification drives engagement

**Score Components:**

| Action | Points |
|--------|--------|
| Create account | 10 |
| Complete onboarding | 20 |
| Track first bill | 10 |
| Listen to daily brief | 5/day |
| Read bill analysis | 5/bill |
| Contact representative | 25 |
| Share on social media | 10 |
| Attend town hall (self-report) | 50 |
| Vote in election (self-report) | 100 |
| Refer a friend | 50 |

**Leaderboards:**
- Local (by ZIP code)
- State
- National
- Friends (social connections)

**Badges:**
- "First Vote" - Tracked first bill
- "Civic Starter" - 100 points
- "Engaged Citizen" - 500 points
- "Democracy Champion" - 1,000 points
- "Election Hero" - Voted + tracked reps

---

## Phase 5: Enterprise Features (Weeks 16-20)

### 5.1 Team/Organization Accounts

**Why:** Required for B2B sales

**Features:**
- Organization creation
- Team member invites
- Role-based access (Admin, Editor, Viewer)
- Shared bill tracking lists
- Team activity dashboard
- Consolidated billing

**Data Model:**
```sql
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT,
  plan TEXT,  -- pro, team, enterprise
  created_at DATETIME
);

CREATE TABLE org_members (
  org_id TEXT,
  user_id TEXT,
  role TEXT,  -- admin, editor, viewer
  invited_at DATETIME,
  joined_at DATETIME,
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE org_bill_lists (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  name TEXT,
  description TEXT,
  created_by TEXT,
  created_at DATETIME
);
```

---

### 5.2 Custom Reporting & Analytics

**Why:** Enterprise buyers need tailored insights

**Report Types:**

| Report | Content | Frequency |
|--------|---------|-----------|
| **Weekly Legislative Summary** | All tracked bills activity | Weekly email |
| **Issue Briefing** | Deep dive on topic | On-demand |
| **Representative Dossier** | Full profile + analysis | On-demand |
| **Competitive Intelligence** | Bills affecting industry | Monthly |
| **Regulatory Radar** | Upcoming regulations | Weekly |

**Export Formats:**
- PDF (branded)
- PowerPoint slides
- Word document
- Excel data dump
- API/JSON

---

### 5.3 SSO & Security

**Why:** Enterprise requirement for procurement

**Features:**
- SAML 2.0 support
- OIDC support
- Okta integration
- Azure AD integration
- Google Workspace integration
- Audit logs
- IP allowlisting
- 2FA enforcement

**Implementation:**
- WorkOS already supports this
- Enable enterprise SSO tier
- Add audit logging table
- Build admin security dashboard

---

## Phase 6: Content & Distribution (Ongoing)

### 6.1 Podcast Network Integration

**Why:** Podcast is organic acquisition channel

**Features:**
- Cross-promotion with civic podcasts
- Guest episode program
- Audio clip licensing
- Podcast transcript SEO
- YouTube video version

**Partnerships to Pursue:**
- Pod Save America
- The NPR Politics Podcast
- FiveThirtyEight Politics
- The Lawfare Podcast
- Strict Scrutiny

---

### 6.2 Social Media Automation

**Why:** Amplify reach, drive organic growth

**Auto-Generated Content:**

| Platform | Content Type | Frequency |
|----------|--------------|-----------|
| **X/Twitter** | Bill highlights | Daily |
| **LinkedIn** | Policy analysis | Weekly |
| **Instagram** | Infographics | 3x/week |
| **TikTok** | 60-sec explainers | Daily |
| **Threads** | Thread summaries | Weekly |

**Content Templates:**
- "Bill of the Day" card
- "Your Rep Voted" alert
- "This Week in Congress" summary
- "Did You Know" civic trivia
- Podcast episode teaser

---

### 6.3 Newsletter/Digest System

**Why:** Email is still highest-engagement channel

**Newsletter Products:**

| Newsletter | Audience | Frequency |
|------------|----------|-----------|
| **The Civic Brief** | General public | Daily |
| **Weekly Wrap** | Busy professionals | Weekly |
| **Deep Dive** | Policy wonks | Weekly |
| **State Watch** | State-specific | Weekly |
| **Industry Alert** | Sector-specific | As-needed |

**Monetization:**
- Free tier: Weekly summary
- Pro tier: Daily + archives
- Sponsor tier: Branded newsletters for orgs

---

## Implementation Priority Matrix

### Must Have (Partnership Blockers)

| Feature | Partner Dependency | Weeks |
|---------|-------------------|-------|
| Embeddable widgets | All partners | 2 |
| Public API | News outlets | 2 |
| RSS feeds | Content partners | 1 |
| Rep Report Cards | BallotReady | 3 |
| Contact integration | Advocacy orgs | 2 |

### Should Have (Competitive Advantage)

| Feature | Value | Weeks |
|---------|-------|-------|
| Promise Tracker | Unique differentiator | 4 |
| Data visualizations | Media appeal | 3 |
| Civic Action Score | User retention | 2 |
| Journalist toolkit | PR/media relations | 3 |

### Nice to Have (Scale Features)

| Feature | When Needed | Weeks |
|---------|-------------|-------|
| Team accounts | B2B sales | 4 |
| SSO | Enterprise deals | 2 |
| Custom reporting | Enterprise deals | 4 |
| Social automation | Growth stage | 3 |

---

## Success Metrics by Partner Type

### BallotReady

| Metric | Target |
|--------|--------|
| Integration demo complete | Week 4 |
| Pilot user engagement | 50% DAU |
| Promise Tracker accuracy | 85%+ |
| Cross-platform retention | 2x baseline |

### News Outlets

| Metric | Target |
|--------|--------|
| Widget embeds | 10 sites in 6 months |
| API integrations | 3 newsrooms |
| Story leads used | 20/month |
| Attribution traffic | 10K visits/month |

### Advocacy Organizations

| Metric | Target |
|--------|--------|
| Campaign pages created | 5 in 3 months |
| Contact actions taken | 1,000/month |
| Partner signups | 10 orgs |
| Conversion to paid | 30% |

---

## Budget Estimates

| Phase | Duration | Estimated Effort | Notes |
|-------|----------|------------------|-------|
| Phase 1 | 4 weeks | Solo + Claude | Foundation features |
| Phase 2 | 4 weeks | Solo + Claude | BallotReady features |
| Phase 3 | 4 weeks | Solo + Claude | News outlet features |
| Phase 4 | 4 weeks | Solo + Claude | Advocacy features |
| Phase 5 | 4 weeks | May need contractor | Enterprise complexity |
| Phase 6 | Ongoing | Solo + automation | Content/distribution |

**Total Timeline:** 20 weeks (5 months) to full partnership readiness

---

## Next Steps

### This Week
1. [ ] Build first embeddable widget (Rep Voting Record)
2. [ ] Set up public API endpoint
3. [ ] Create RSS feed for trending bills

### This Month
1. [ ] Complete Phase 1 features
2. [ ] Reach out to 3 local news outlets for pilot
3. [ ] Draft partnership one-pager for BallotReady

### This Quarter
1. [ ] Complete Phases 1-3
2. [ ] Land first news outlet integration
3. [ ] Begin BallotReady partnership discussions
4. [ ] Launch journalist toolkit beta

---

*Document maintained by Tarik Moody. Last updated: December 2025*
