# Hakivo Architecture

This document explains how Hakivo is built, how data flows through the system, and key architectural decisions.

## Table of Contents

- [System Overview](#system-overview)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Data Flow](#data-flow)
- [Database Schema](#database-schema)
- [Caching Strategy](#caching-strategy)
- [Scheduled Jobs](#scheduled-jobs)
- [Key Design Decisions](#key-design-decisions)

## System Overview

Hakivo uses a **modern full-stack architecture** with a clear separation between frontend and backend:

```
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Next.js Frontend (Port 3000)               │    │
│  │  - React Components                                │    │
│  │  - Server Components for SEO                       │    │
│  │  - Client Components for interactivity            │    │
│  │  - shadcn/ui for beautiful UI                     │    │
│  └────────────────┬───────────────────────────────────┘    │
└───────────────────┼───────────────────────────────────────┘
                    │
                    │ HTTP Requests
                    │
    ┌───────────────┴────────────────┐
    │                                 │
    ▼                                 ▼
┌─────────┐                  ┌─────────────┐
│ Next.js │                  │  Raindrop   │
│   API   │                  │   Backend   │
│ Routes  │                  │  (Cloud)    │
└─────────┘                  └─────────────┘
    │                                 │
    │                                 │
    ▼                                 ▼
┌──────────────┐              ┌──────────────┐
│  Congress.gov│              │   SQLite DB  │
│      API     │              │   KV Caches  │
│  (External)  │              │SmartBuckets  │
└──────────────┘              └──────────────┘
```

### Why This Architecture?

**Separation of Concerns**:
- Frontend handles UI/UX
- Backend handles data processing, external APIs, and scheduled jobs
- Each can scale independently

**Performance**:
- Next.js Server Components reduce client-side JS
- Raindrop KV caches prevent redundant API calls
- Background jobs don't block user requests

**Cost Efficiency**:
- Serverless backend only runs when needed
- Shared news pool (not per-user API calls)
- Aggressive caching reduces external API usage

## Frontend Architecture

### Technology Stack

```
Next.js 16 (App Router)
  ├── React 19 (UI library)
  ├── TypeScript (Type safety)
  ├── Tailwind CSS v4 (Styling)
  ├── shadcn/ui (Component library)
  │   └── Radix UI (Primitives)
  ├── date-fns (Date formatting)
  ├── recharts (Data visualization)
  └── WorkOS (Authentication)
```

### Directory Structure

```
app/
├── (auth)/              # Authentication routes
│   ├── signin/          # Sign-in page
│   └── callback/        # OAuth callback
│
├── dashboard/           # Main app (protected)
│   └── page.tsx        # Dashboard with widgets
│
├── representatives/     # Find your reps
│   ├── page.tsx        # Search interface
│   └── [id]/           # Rep detail page
│
├── legislation/         # Browse bills
│   ├── page.tsx        # Bill list
│   └── [id]/           # Bill detail
│
├── api/                 # Next.js API routes (proxy layer)
│   └── congress/        # Congress.gov proxies
│       └── latest-actions/
│
├── layout.tsx           # Root layout
└── page.tsx             # Landing page

components/
├── ui/                  # Base UI components (shadcn)
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
│
└── widgets/             # Dashboard widgets
    ├── latest-actions-widget.tsx
    ├── personalized-content-widget.tsx
    ├── representatives-horizontal-widget.tsx
    └── daily-brief-widget.tsx

lib/
├── api/                 # Backend API clients
│   └── backend.ts       # Raindrop API wrapper
│
├── auth/                # Authentication
│   ├── auth-context.tsx # React Context
│   └── workos.ts        # WorkOS helpers
│
└── utils.ts             # Utility functions
```

### Authentication Flow

```
1. User clicks "Sign In"
   ↓
2. Redirect to WorkOS OAuth
   ↓
3. User authenticates (Google, GitHub, etc.)
   ↓
4. WorkOS redirects to /api/auth/callback
   ↓
5. Exchange code for JWT token
   ↓
6. Store token in localStorage + AuthContext
   ↓
7. All backend requests include: Authorization: Bearer <token>
```

**Implementation**:
```typescript
// lib/auth/auth-context.tsx
export function useAuth() {
  const { accessToken, isAuthenticated } = useContext(AuthContext);

  // Include token in all requests
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  return { headers, isAuthenticated };
}
```

### Widget Architecture

Each widget is a **self-contained React component** that:
1. Fetches its own data
2. Handles loading and error states
3. Refreshes independently
4. Gracefully degrades if backend is unavailable

**Example**: Latest Actions Widget

```typescript
// components/widgets/latest-actions-widget.tsx
export function LatestActionsWidget() {
  const [actions, setActions] = useState<BillAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch from Next.js API route (which proxies to Congress.gov)
    fetch('/api/congress/latest-actions?limit=10')
      .then(res => res.json())
      .then(data => setActions(data.actions))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Render with Tabs for different views
  return (
    <Card>
      <Tabs>
        <TabsList>
          <TabsTrigger value="latest">Latest Actions</TabsTrigger>
          <TabsTrigger value="tracked">Tracked Bills</TabsTrigger>
        </TabsList>
        {/* ... */}
      </Tabs>
    </Card>
  );
}
```

## Backend Architecture

### Raindrop Framework

Raindrop is a **serverless microservices framework** that provides:
- HTTP services (similar to AWS Lambda + API Gateway)
- SQL databases (SQLite)
- KV caches (Redis-like)
- SmartBuckets (S3 + vector search)
- Cron tasks
- Message queues

**All defined in** `hakivo-api/raindrop.manifest`

### Service Architecture

```
hakivo-api/src/
├── Public HTTP Services (Frontend-facing)
│   ├── auth-service/           # User auth (login, register, token refresh)
│   ├── dashboard-service/      # Dashboard data (news, actions, overview)
│   ├── bills-service/          # Bill search, details, tracking
│   ├── briefs-service/         # Daily/weekly briefs
│   ├── chat-service/           # AI chat with Claude
│   └── admin-dashboard/        # Admin UI
│
├── Private Internal Services (Service-to-service only)
│   ├── user-service/           # User CRUD operations
│   ├── congress-api-client/    # Congress.gov API wrapper
│   ├── geocodio-client/        # Address geocoding
│   ├── claude-client/          # Claude AI
│   ├── elevenlabs-client/      # Text-to-speech
│   ├── cerebras-client/        # Fast LLM inference
│   ├── exa-client/             # News search API
│   └── vultr-storage-client/   # Object storage
│
├── Background Workers (Queue-based)
│   ├── brief-generator/        # Generate briefs (observer)
│   └── congress-sync-observer/ # Process sync jobs (observer)
│
└── Scheduled Tasks (Cron)
    ├── daily-brief-scheduler/     # 7 AM UTC daily
    ├── weekly-brief-scheduler/    # Mon 7 AM UTC
    ├── congress-sync-scheduler/   # 2 AM UTC daily
    ├── news-sync-scheduler/       # 6 AM & 6 PM UTC
    └── congress-actions-scheduler/ # 6 AM & 6 PM UTC
```

### Service Communication

**Public Services** are accessible via HTTPS:
```
https://svc-{service-id}.lmapp.run
```

**Private Services** are only accessible from other services:
```typescript
// Inside another service
const response = await this.env.USER_SERVICE.fetch(request);
```

### Example Service

```typescript
// src/dashboard-service/index.ts
import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

// GET /dashboard/news - Get personalized news
app.get('/dashboard/news', async (c) => {
  // 1. Verify JWT token
  const auth = await verifyToken(c.req.header('Authorization'));

  // 2. Get user's policy interests
  const user = await c.env.USER_SERVICE.getPreferences(auth.userId);

  // 3. Query news articles
  const articles = await c.env.APP_DB
    .prepare(`
      SELECT * FROM news_articles
      WHERE interest IN (...)
      AND id NOT IN (SELECT article_id FROM user_article_views WHERE user_id = ?)
      LIMIT 10
    `)
    .bind(auth.userId)
    .all();

  return c.json({ articles });
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
```

## Data Flow

### News Aggregation Flow

```
┌──────────────────────────────────────────────────────────┐
│  TWICE DAILY (6 AM & 6 PM UTC)                          │
│  news-sync-scheduler runs                                │
└────────────┬─────────────────────────────────────────────┘
             │
             ▼
  ┌──────────────────────┐
  │  For each of 12      │
  │  policy interests:   │
  │  - Environment       │
  │  - Healthcare        │
  │  - Economy           │
  │  - etc.              │
  └──────┬───────────────┘
         │
         ▼
  ┌────────────────────────┐
  │  Call Exa.ai API       │
  │  with keywords:        │
  │  ["climate change",    │
  │   "carbon emissions"]  │
  └──────┬─────────────────┘
         │
         ▼
  ┌────────────────────────────┐
  │  Get 15 articles/interest  │
  │  = 180 total articles      │
  └──────┬─────────────────────┘
         │
         ▼
  ┌─────────────────────────────┐
  │  Store in news_articles     │
  │  table with metadata:       │
  │  - interest category        │
  │  - published date           │
  │  - relevance score          │
  └──────┬──────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │  Clean up old articles       │
  │  (delete > 7 days old)       │
  └──────┬───────────────────────┘
         │
         ▼
  ┌──────────────────────────────────┐
  │  Clear user_article_views table  │
  │  (reset "already seen" state)    │
  │  This gives users a fresh feed!  │
  └──────────────────────────────────┘
```

**Why clear view history?**
- New users wouldn't see enough articles (only 180 total pool)
- Returning users deserve to see important stories again
- Articles update twice daily, so repeats are fresh content

### User Dashboard Flow

```
1. User visits /dashboard
   ↓
2. AuthContext checks for valid JWT
   ↓ (if invalid)
3. Redirect to /auth/signin
   ↓ (if valid)
4. Dashboard page loads
   ↓
5. Multiple widgets fetch in parallel:
   │
   ├─→ PersonalizedContentWidget
   │   └─→ GET /dashboard-service/news
   │       ├─ Filters by user's policy interests
   │       ├─ Excludes already-viewed articles
   │       └─ Returns 10 articles
   │
   ├─→ LatestActionsWidget
   │   └─→ GET /api/congress/latest-actions
   │       ├─ Fetches from Congress.gov API
   │       ├─ Caches for 4 hours
   │       └─ Returns 10 recent bill actions
   │
   ├─→ RepresentativesWidget
   │   └─→ GET /dashboard-service/representatives
   │       ├─ Gets user's saved location
   │       ├─ Queries members database
   │       └─ Returns 3 reps (2 Senators + 1 House)
   │
   └─→ DailyBriefWidget
       └─→ GET /briefs-service/daily
           ├─ Fetches today's brief from cache
           ├─ If not cached, generates new brief
           └─ Returns text + audio URL
```

### Bill Search Flow

```
User types "climate" in search
   ↓
Frontend debounces input (300ms)
   ↓
GET /bills-service/search?q=climate&limit=20
   ↓
┌─────────────────────────────────────┐
│  bills-service checks:              │
│  1. Is query cached? (KV cache)     │
│     YES → Return cached results     │
│     NO → Continue...                │
└───────────┬─────────────────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  Query SQLite database:              │
│  SELECT * FROM bills                 │
│  WHERE title MATCH 'climate'         │
│  OR summary MATCH 'climate'          │
│  ORDER BY introduced_date DESC       │
│  LIMIT 20                            │
└───────────┬──────────────────────────┘
            │
            ▼
┌────────────────────────────┐
│  Cache results for 1 hour  │
│  (popular searches cached) │
└───────────┬────────────────┘
            │
            ▼
Return results to frontend
```

## Database Schema

### Main Tables

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- User preferences
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  policy_interests TEXT NOT NULL,  -- JSON array: ["Environment", "Healthcare"]
  location TEXT,                    -- JSON: {"address": "...", "district": "CA-12"}
  notification_settings TEXT,       -- JSON
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- News articles (shared pool)
CREATE TABLE news_articles (
  id TEXT PRIMARY KEY,
  interest TEXT NOT NULL,           -- "Environment", "Healthcare", etc.
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  author TEXT,
  summary TEXT,
  image_url TEXT,
  published_date TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,      -- When we fetched it
  score REAL,                        -- Relevance score from Exa.ai
  source_domain TEXT,
  UNIQUE(url, interest)              -- Same article can appear in multiple interests
);

-- Track which articles each user has seen
CREATE TABLE user_article_views (
  user_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  viewed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, article_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (article_id) REFERENCES news_articles(id)
);

-- Congressional bills
CREATE TABLE bills (
  id TEXT PRIMARY KEY,               -- "hr-1234-119"
  congress INTEGER NOT NULL,         -- 119
  bill_type TEXT NOT NULL,           -- "hr", "s", etc.
  bill_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  introduced_date TEXT,
  latest_action_date TEXT,
  latest_action_text TEXT,
  status TEXT,                       -- "Introduced", "Passed House", etc.
  policy_area TEXT,                  -- "Environment and Public Works"
  url TEXT,
  UNIQUE(congress, bill_type, bill_number)
);

-- Members of Congress
CREATE TABLE members (
  id TEXT PRIMARY KEY,               -- ProPublica ID
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  party TEXT,                        -- "R", "D", "I"
  state TEXT NOT NULL,              -- "CA"
  district TEXT,                    -- "12" (null for Senators)
  chamber TEXT NOT NULL,             -- "house" or "senate"
  phone TEXT,
  office TEXT,
  url TEXT,
  image_url TEXT,
  next_election TEXT,
  in_office BOOLEAN DEFAULT true
);

-- User bill bookmarks
CREATE TABLE user_bill_bookmarks (
  user_id TEXT NOT NULL,
  bill_id TEXT NOT NULL,
  bookmarked_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, bill_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (bill_id) REFERENCES bills(id)
);
```

### Indexes for Performance

```sql
-- News queries filtered by interest + date
CREATE INDEX idx_news_interest_date
  ON news_articles(interest, published_date DESC);

-- Bill searches
CREATE INDEX idx_bills_policy
  ON bills(policy_area);

CREATE INDEX idx_bills_status
  ON bills(status);

-- Member lookups by location
CREATE INDEX idx_members_state_district
  ON members(state, district);
```

## Caching Strategy

### KV Caches

```hcl
# raindrop.manifest
kv_cache "news-cache" {}          # News API responses (1 hour)
kv_cache "dashboard-cache" {}     # Dashboard aggregations (15 min)
kv_cache "district-cache" {}      # Geocoding results (30 days)
kv_cache "session-cache" {}       # User sessions (7 days)
kv_cache "image-cache" {}         # External images (24 hours)
kv_cache "actions-cache" {}       # Bill actions (4 hours)
```

### Cache Usage

```typescript
// Check cache first
const cached = await c.env.NEWS_CACHE.get(`news:${userId}`);
if (cached) {
  return c.json(JSON.parse(cached));
}

// If not cached, fetch fresh data
const articles = await fetchNews(userId);

// Store in cache with expiration
await c.env.NEWS_CACHE.put(
  `news:${userId}`,
  JSON.stringify(articles),
  { expirationTtl: 3600 } // 1 hour
);

return c.json(articles);
```

### Cache Invalidation

**Time-based**: All caches have TTL (time-to-live)
**Event-based**: When data changes, explicitly delete cache:

```typescript
// User updates preferences → invalidate their news cache
await c.env.NEWS_CACHE.delete(`news:${userId}`);
```

## Scheduled Jobs

### Job Schedule (UTC)

```
00:00 ─────────────────────────────────────
      │
02:00 │  congress-sync-scheduler
      │  └─ Sync all bills from Congress.gov
      │     (runs daily, takes ~10 minutes)
      │
04:00 ─────────────────────────────────────
      │
06:00 │  news-sync-scheduler
      │  └─ Fetch 180 new articles (12 interests × 15)
      │
      │  congress-actions-scheduler
      │  └─ Update latest bill actions
      │
07:00 │  daily-brief-scheduler
      │  └─ Generate AI summary of yesterday's activity
      │
12:00 ─────────────────────────────────────
      │
18:00 │  news-sync-scheduler (again)
      │  └─ Fresh articles for evening readers
      │
      │  congress-actions-scheduler (again)
      │  └─ Update bill actions
      │
00:00 ─────────────────────────────────────
```

### Job Implementation

```typescript
// src/news-sync-scheduler/index.ts
export default class extends Task<Env> {
  async handle(event: Event): Promise<void> {
    console.log('📰 Starting news sync...');

    for (const { interest, keywords } of policyInterestMapping) {
      // 1. Fetch articles from Exa.ai
      const articles = await this.env.EXA_CLIENT.searchNews(
        keywords,
        startDate,
        endDate,
        15
      );

      // 2. Store each article
      for (const article of articles) {
        await this.env.APP_DB
          .prepare(`INSERT OR IGNORE INTO news_articles (...)`)
          .bind(...)
          .run();
      }
    }

    // 3. Cleanup old articles
    await this.env.APP_DB
      .prepare('DELETE FROM news_articles WHERE fetched_at < ?')
      .bind(sevenDaysAgo)
      .run();

    // 4. Reset view history for fresh feed
    await this.env.APP_DB
      .prepare('DELETE FROM user_article_views')
      .run();

    console.log('✅ News sync complete');
  }
}
```

## Key Design Decisions

### Decision 1: Shared News Pool vs Per-User Fetching

**Choice**: Shared news pool (180 articles across 12 interests)

**Reasoning**:
- **Cost**: 24 API calls/day instead of N users × 12 interests
- **Consistency**: All users see same news sources
- **Performance**: Pre-fetched, no wait time

**Trade-off**: Less personalization (everyone in "Environment" sees same articles)

### Decision 2: View History Reset on Sync

**Choice**: Clear all user view history when news syncs

**Reasoning**:
- **Fresh content**: Important stories deserve to be seen again
- **Small pool**: Only 180 total articles, need rotation
- **Twice daily**: Frequent enough that repeats aren't annoying

**Trade-off**: Users might see some articles twice

### Decision 3: Real-time Bill Actions vs Database Cache

**Choice**: Real-time API calls with 4-hour cache

**Reasoning**:
- **Freshness**: Congressional action happens fast
- **API limits**: Congress.gov allows 5000 req/hour
- **Cache duration**: 4 hours balances freshness vs cost

**Implementation**:
```typescript
// Next.js API route
export async function GET() {
  const response = await fetch(
    `https://api.congress.gov/v3/bill/119?format=json`,
    {
      next: { revalidate: 14400 } // 4 hours
    }
  );
}
```

### Decision 4: Next.js API Routes as Proxy

**Choice**: Frontend calls Next.js API routes, which call Raindrop backend

**Reasoning**:
- **Secret protection**: API keys never exposed to browser
- **CORS**: No cross-origin issues
- **Type safety**: Shared TypeScript types
- **Caching**: Next.js cache layer in addition to backend cache

**Flow**:
```
Browser → Next.js API Route → Raindrop Service → External API
  (HTTPS)      (Server-side)       (HTTPS)        (HTTPS)
```

### Decision 5: Microservices vs Monolith

**Choice**: 15 separate Raindrop services

**Reasoning**:
- **Independent scaling**: News sync doesn't affect dashboard performance
- **Clear boundaries**: Each service has one responsibility
- **Easier debugging**: Isolated logs per service
- **Team scalability**: Different devs can own services

**Trade-off**: More complex deployment, more files

---

## Extending the Architecture

### Adding a New Feature

1. **Identify services needed**:
   - Will it need a new database table?
   - Does it require external API calls?
   - Is it user-facing or background?

2. **Create service** in `hakivo-api/src/`:
   ```typescript
   import { Service } from '@liquidmetal-ai/raindrop-framework';
   // ...
   ```

3. **Add to manifest**:
   ```hcl
   service "my-feature" {
     visibility = "public"
   }
   ```

4. **Create frontend widget**:
   ```typescript
   export function MyFeatureWidget() {
     // Fetch from backend
     // Render UI
   }
   ```

5. **Add to dashboard**:
   ```typescript
   <MyFeatureWidget />
   ```

### Scaling Considerations

**Current limits**:
- SQLite: ~1GB database, fine for thousands of users
- KV caches: Fast but limited storage
- SmartBuckets: Good for large files (PDFs, audio)

**When to scale**:
- 10K+ users → Consider PostgreSQL
- High traffic → Add CDN for static assets
- Complex searches → Add Elasticsearch

**Raindrop handles**:
- Auto-scaling of services
- Geographic distribution
- Load balancing

---

**Questions?** See [README.md](./README.md) for general docs or open an issue!
