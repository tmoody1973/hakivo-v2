# Hakivo: Powered by Raindrop on Vultr

> A Demo Narrative: How LiquidMetal's Raindrop Framework and Vultr's Cloud Infrastructure Power Civic Intelligence at Scale

---

## The Vision

Imagine a platform where every American citizen can truly understand what's happening in their government. Not through dense legal jargon, but through personalized audio briefings, AI-powered analysis, and an intelligent assistant that speaks plain English.

That's **Hakivo** - and it's powered entirely by **Raindrop** running on **Vultr**.

---

## The Challenge

Building a civic intelligence platform at scale requires solving several hard problems:

1. **Real-time data ingestion** from Congress.gov (12,000+ bills in the 119th Congress alone)
2. **AI enrichment** of every bill with plain-language summaries and deep analysis
3. **Personalized audio generation** - creating unique briefings for each user
4. **Semantic search** - finding relevant legislation using natural language
5. **Multi-model AI orchestration** - Claude, Gemini, Cerebras, and more
6. **Event-driven processing** - queues, observers, and scheduled jobs
7. **Zero infrastructure management** - focus on features, not servers

Traditional architectures would require dozens of services, complex orchestration, and significant DevOps overhead. With Raindrop on Vultr, we deploy the entire platform with a single command.

---

## The Architecture: 58 Raindrop Modules

Hakivo leverages the full power of Raindrop's serverless primitives:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VULTR CLOUD                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   RAINDROP FRAMEWORK                         │   │
│  │                                                               │   │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │   │
│  │   │ Services │  │ Observers │  │ Schedulers│  │  Queues  │   │   │
│  │   │    24    │  │     4    │  │     8     │  │    5     │   │   │
│  │   └──────────┘  └──────────┘  └──────────┘  └──────────┘   │   │
│  │                                                               │   │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │   │
│  │   │ KvCache  │  │SmartSql  │  │SmartBucket│  │SmartMemory│   │   │
│  │   │    9     │  │    1     │  │     1     │  │    1     │   │   │
│  │   └──────────┘  └──────────┘  └──────────┘  └──────────┘   │   │
│  │                                                               │   │
│  │   ┌──────────┐  ┌──────────┐                                │   │
│  │   │SqlDatabase│  │ Buckets │                                │   │
│  │   │    1     │  │    3     │                                │   │
│  │   └──────────┘  └──────────┘                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  VULTR OBJECT STORAGE                        │   │
│  │     Audio Briefs  │  Bill Texts  │  Podcast Episodes         │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Feature Walkthrough: How Raindrop Powers Each Experience

### 1. User Opens the Dashboard

**What the user sees:** A personalized dashboard with their representatives, tracked bills, and news.

**What Raindrop does:**

```
Request → dashboard-service → DASHBOARD_CACHE (KvCache)
                           ↓ (cache miss)
                           → APP_DB (SqlDatabase)
                           → GEOCODIO_CLIENT (Service)
                           → Response in <100ms
```

- **dashboard-service**: Handles the API request
- **DASHBOARD_CACHE**: KvCache for sub-millisecond lookups
- **APP_DB**: D1 database with user preferences and tracked bills
- **GEOCODIO_CLIENT**: Service wrapper for district lookups

### 2. User Requests a Daily Brief

**What the user sees:** A "Generating your brief..." animation, then an audio player appears.

**What Raindrop does:**

```
POST /briefs/generate
        ↓
  briefs-service
        ↓
  BRIEF_QUEUE (Queue) ──────────────────────────────┐
        ↓                                            │
  brief-generator (Observer)                        │
        │                                            │
        ├── claude-client → AI script generation    │
        │                                            │
        ├── gemini-tts-client → Audio synthesis     │
        │                                            │
        ├── AUDIO_BRIEFS (Bucket) → Store MP3       │
        │                                            │
        └── vultr-storage-client → CDN upload       │
                                                     │
  User polls /briefs/status/:id ←────────────────────┘
```

**Services involved:**
- **briefs-service**: Creates brief record, queues generation
- **BRIEF_QUEUE**: Raindrop Queue for async processing
- **brief-generator**: Observer that processes queue messages
- **claude-client**: Service wrapper for Claude AI
- **gemini-tts-client**: Service for Google TTS
- **AUDIO_BRIEFS**: Raindrop Bucket for audio storage
- **vultr-storage-client**: Uploads to Vultr Object Storage for CDN delivery

### 3. User Searches for Bills

**What the user sees:** Instant search results as they type "climate change legislation".

**What Raindrop does:**

```
GET /bills/search?q=climate change
        ↓
  bills-service
        ↓
  LEGISLATION_SEARCH (SmartBucket)
        │
        └── Vector embedding → Semantic search
        │       ↓
        └── Returns ranked bill IDs
        ↓
  APP_DB → Fetch full bill details
        ↓
  Response with AI-ranked results
```

**The magic:** SmartBucket performs semantic vector search, not just keyword matching. "Climate change" finds bills about "environmental protection", "carbon emissions", and "renewable energy".

### 4. User Asks the AI Assistant a Question

**What the user sees:** C1 Congressional Assistant responds: "Let me look that up for you..." then shows real-time results.

**What Raindrop does:**

```
POST /chat/message
  "Who are the sponsors of recent healthcare bills?"
        ↓
  chat-service
        ↓
  claude-client → Tool calling decision
        │
        ├── Tool: searchBills(query: "healthcare")
        │       ↓
        │   bills-service → LEGISLATION_SEARCH
        │
        ├── Tool: searchMembers(filter: sponsors)
        │       ↓
        │   members-service → APP_DB
        │
        └── claude-client → Generate response with context
        ↓
  CIVIC_MEMORY (SmartMemory) → Save conversation context
        ↓
  Streaming response to user
```

**Services involved:**
- **chat-service**: Handles conversation flow
- **claude-client**: AI orchestration with tool calling
- **CIVIC_MEMORY**: SmartMemory for contextual conversation history
- **bills-service, members-service**: Tool execution

### 5. New Bills Are Synced from Congress.gov

**What happens:** Every day at 2 AM UTC, new legislation is automatically indexed.

**What Raindrop does:**

```
congress-sync-scheduler (Cron: 0 2 * * *)
        ↓
  SYNC_QUEUE (Queue) ────────────────────┐
        ↓                                 │
  congress-sync-observer (Observer)      │
        │                                 │
        ├── congress-api-client          │
        │       ↓                        │
        │   Fetch new bills from API     │
        │                                 │
        ├── APP_DB → Insert bills        │
        │                                 │
        └── ENRICHMENT_QUEUE ─────────────┤
                ↓                         │
        enrichment-observer              │
                │                         │
                ├── claude-client        │
                │   AI enrichment        │
                │                         │
                └── BILL_INDEXING_QUEUE ──┤
                        ↓                 │
                bill-indexing-observer   │
                        │                 │
                        └── LEGISLATION_SEARCH
                            Update vectors
```

**The pipeline:**
1. **Scheduler** triggers daily sync
2. **Observer** processes sync queue, fetches from Congress.gov
3. **Enrichment Observer** adds AI-generated summaries
4. **Indexing Observer** updates semantic search vectors

All fully automated. Zero manual intervention.

---

## The AI Stack: Multi-Model Orchestration

Hakivo uses multiple AI providers, each wrapped in a Raindrop Service:

| Service | Provider | Purpose |
|---------|----------|---------|
| `claude-client` | Anthropic Claude | Deep analysis, chat, tool calling |
| `cerebras-client` | Cerebras | Fast inference for trivia, quick responses |
| `perplexity-client` | Perplexity | News aggregation with web search |
| `gemini-tts-client` | Google Gemini | High-quality text-to-speech |
| `elevenlabs-client` | ElevenLabs | Alternative TTS (fallback) |

Each service is:
- **Type-safe**: Full TypeScript definitions
- **Automatically scaled**: Raindrop handles concurrency
- **Cached**: Response caching where appropriate
- **Retryable**: Built-in error handling and retries

---

## Data at Scale: The Numbers

| Metric | Value |
|--------|-------|
| **119th Congress Bills** | 11,972 bills indexed |
| **Bills with Full Text** | 7,500+ extracted |
| **AI Enrichments** | 7,000+ with summaries |
| **Cosponsors Tracked** | 40,000+ relationships |
| **State Legislators** | 7,262 across 49 states |
| **Policy Categories** | 12 personalization dimensions |

All powered by:
- **1 SqlDatabase** (D1) for structured data
- **1 SmartSql** for natural language queries
- **1 SmartBucket** for semantic search
- **9 KvCaches** for performance optimization

---

## Storage: Vultr Object Storage Integration

Audio briefs and podcast episodes are stored on Vultr Object Storage:

```typescript
// vultr-storage-client service
const vultr = new S3Client({
  endpoint: env.VULTR_ENDPOINT,       // sjc1.vultrobjects.com
  region: 'sjc1',
  credentials: {
    accessKeyId: env.VULTR_ACCESS_KEY,
    secretAccessKey: env.VULTR_SECRET_KEY
  }
});

// Upload audio brief
await vultr.send(new PutObjectCommand({
  Bucket: 'hakivo',
  Key: `briefs/${userId}/${briefId}.mp3`,
  Body: audioBuffer,
  ContentType: 'audio/mpeg',
  ACL: 'public-read'
}));
```

**Benefits:**
- **CDN-ready**: Direct public URLs for streaming
- **Cost-effective**: Pay only for storage used
- **S3-compatible**: Standard SDK, zero learning curve
- **Raindrop-wrapped**: Service abstraction for clean code

---

## Scheduled Jobs: Set It and Forget It

Hakivo runs 8 scheduled jobs using Raindrop's Task primitive:

| Scheduler | Cron | Purpose |
|-----------|------|---------|
| `congress-sync-scheduler` | `0 2 * * *` | Daily bill sync |
| `congress-actions-scheduler` | `0 6,18 * * *` | Track new actions |
| `news-sync-scheduler` | `0 6,18 * * *` | Refresh news feeds |
| `daily-brief-scheduler` | `0 7 * * *` | Generate daily briefs |
| `weekly-brief-scheduler` | `0 7 * * 1` | Weekly summaries |
| `podcast-scheduler` | Weekly | 100 Laws podcast |
| `state-sync-scheduler` | Weekly | State legislator updates |
| `audio-retry-scheduler` | `0 * * * *` | Retry failed TTS |

**No cron servers. No job queues to manage. Just YAML configuration.**

---

## Deployment: One Command

The entire Hakivo backend - 58 modules, 24 services, 4 observers, 8 schedulers - deploys with:

```bash
npx raindrop build push
```

**What happens:**
1. TypeScript compiles to JavaScript
2. Raindrop packages each module
3. Services deploy to Cloudflare Workers
4. Databases and caches are provisioned
5. Queues and triggers are configured
6. Environment variables are injected

**Time:** ~2 minutes for full deployment.

---

## The Developer Experience

### Before Raindrop (Traditional Architecture):
- Set up Kubernetes cluster
- Configure Redis, PostgreSQL, message queues
- Write Dockerfiles for each service
- Manage load balancers and auto-scaling
- Set up monitoring and alerting
- Handle service mesh complexity

### With Raindrop:
```yaml
# raindrop.yaml (simplified)
services:
  - name: dashboard-service
    path: src/dashboard-service

observers:
  - name: brief-generator
    queue: BRIEF_QUEUE
    path: src/brief-generator

schedulers:
  - name: daily-brief-scheduler
    cron: "0 7 * * *"
    path: src/daily-brief-scheduler

databases:
  - name: APP_DB
    type: sql

caches:
  - name: DASHBOARD_CACHE
    type: kv
```

**Focus on features, not infrastructure.**

---

## Why This Matters

Hakivo's mission is civic engagement. Every hour spent on infrastructure is an hour not spent building features that help citizens understand their government.

**With Raindrop on Vultr:**
- **58 modules** deployed and managed automatically
- **Zero infrastructure code** to maintain
- **Automatic scaling** for viral moments
- **Pay-per-use pricing** - no idle server costs
- **Single source of truth** - one YAML file

---

## Summary

Hakivo demonstrates what's possible when modern AI meets serverless infrastructure:

| Traditional | With Raindrop |
|-------------|---------------|
| Weeks of setup | Deploy in minutes |
| Complex DevOps | Zero infrastructure |
| Manual scaling | Automatic |
| Service mesh | Service stubs |
| Database admin | Managed D1 |
| Queue management | Raindrop Queues |
| Cron servers | Raindrop Schedulers |
| Vector search setup | SmartBucket |
| AI orchestration | Service wrappers |

**Hakivo is proof that a single developer can build enterprise-grade civic technology using Raindrop and Vultr.**

---

## Try It Yourself

- **Live Demo**: [hakivo.com](https://hakivo.com)
- **Raindrop Framework**: [raindrop.dev](https://raindrop.dev)
- **Vultr Cloud**: [vultr.com](https://vultr.com)

---

*Built with Raindrop on Vultr by Tarik Moody*
