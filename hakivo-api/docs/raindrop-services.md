# Hakivo Raindrop Services Architecture

> Video Demo Reference: How Hakivo leverages LiquidMetal's Raindrop framework

## Overview

**Total Raindrop Modules: 58**

Hakivo is built entirely on the Raindrop framework, utilizing its full suite of serverless primitives to power a comprehensive civic engagement platform.

---

## Raindrop Primitives Used

| Primitive | Count | Purpose |
|-----------|-------|---------|
| **Service** | 24 | API endpoints and client wrappers |
| **Observer** | 4 | Event-driven async processing |
| **Task (Scheduler)** | 8 | Cron-based background jobs |
| **Queue** | 5 | Async message passing |
| **KvCache** | 9 | Fast key-value caching |
| **SqlDatabase** | 1 | D1 relational database |
| **SmartSql** | 1 | AI-powered SQL with natural language |
| **SmartMemory** | 1 | AI-powered contextual memory |
| **SmartBucket** | 1 | AI-powered document search |
| **Bucket** | 3 | Object storage for files |
| **Env** | 1 | Environment variables |

---

## Feature-to-Service Mapping

### User Authentication & Management
- **auth-service** → WorkOS SSO integration, JWT token management
- **user-service** → User profiles, preferences, onboarding
- **session-cache** → Fast session lookups (KvCache)
- **subscription-api** → Stripe subscription management
- **stripe-webhook** → Payment event processing

### Legislation Tracking
- **bills-service** → Bill search, details, tracking, voting records
- **congress-api-client** → Congress.gov API wrapper
- **app-db** → Primary D1 database for bills, members, user data
- **legislation-search** → **SmartBucket** for semantic bill search with AI
- **bill-texts** → Full bill text storage (Bucket)
- **actions-cache** → Congressional actions caching (KvCache)

### Representative Information
- **members-service** → Congress member profiles, committees, votes
- **fec-client** → Campaign finance data from FEC
- **openstates-client** → State legislator data
- **district-cache** → Geographic district lookups (KvCache)

### AI-Powered Features
- **congressional-db** → **SmartSql** - Natural language queries on congressional data
- **civic_memory** → **SmartMemory** - Contextual AI memory for user interactions
- **claude-client** → Anthropic Claude for AI analysis
- **cerebras-client** → Fast inference for real-time features
- **perplexity-client** → Web search augmented responses

### Daily & Weekly Briefs
- **briefs-service** → Brief delivery and history
- **brief-generator** → **Observer** - Async brief generation on queue events
- **brief-queue** → Message queue for brief requests
- **daily-brief-scheduler** → Cron job for daily brief generation
- **weekly-brief-scheduler** → Cron job for weekly summary generation

### Podcast Generation
- **podcast-generator** → AI script generation + audio synthesis
- **podcast-scheduler** → Automated podcast creation schedule
- **elevenlabs-client** → Voice synthesis API
- **gemini-tts-client** → Google TTS alternative
- **audio-briefs** → Generated audio file storage (Bucket)
- **audio-retry-scheduler** → Retry failed audio generation
- **spreaker-tokens** → Podcast distribution auth (KvCache)

### Chat / Congressional Assistant (C1)
- **chat-service** → Conversational AI interface
- **dashboard-service** → Widget data, personalized content
- **dashboard-cache** → Fast dashboard data (KvCache)

### Data Synchronization
- **congress-sync-scheduler** → Daily Congress.gov data sync
- **congress-sync-observer** → **Observer** - Process sync queue events
- **sync-queue** → Async sync job queue
- **congress-actions-scheduler** → Track new congressional actions
- **news-sync-scheduler** → Aggregate relevant news
- **news-cache** → News article caching (KvCache)
- **state-sync-scheduler** → State legislature data sync

### Bill Enrichment Pipeline
- **enrichment-observer** → **Observer** - AI enrichment on new bills
- **enrichment-queue** → Queue for enrichment jobs
- **bill-indexing-observer** → **Observer** - Index bills for search
- **bill-indexing-queue** → Queue for indexing jobs
- **index-bills-service** → Manage search indexes

### Media & Storage
- **vultr-storage-client** → S3-compatible object storage
- **image-cache** → Member photos, bill images (KvCache)
- **annotation-bucket** → User annotations storage
- **annotation-service** → Annotation management

### Admin & Operations
- **admin-dashboard** → Internal admin tools
- **db-admin** → Database management utilities
- **geocodio-client** → Address to district lookup
- **exa-client** → AI-powered web search

---

## Architecture Highlights

### Event-Driven Processing
```
User Action → Queue → Observer → Background Processing
```
- Bill tracking triggers enrichment pipeline
- Brief requests queue for async generation
- New legislation triggers indexing + AI analysis

### Multi-Layer Caching
```
Request → KvCache → SqlDatabase → External API
```
- 9 dedicated caches for different data types
- Sub-millisecond response times for cached data
- Automatic cache invalidation on updates

### AI Integration Stack
```
SmartSql + SmartMemory + SmartBucket + Claude/Cerebras
```
- Natural language database queries
- Contextual conversation memory
- Semantic document search
- Real-time AI analysis

### Scheduled Data Pipelines
```
Scheduler → Sync Service → Queue → Observer → Database
```
- 8 scheduled tasks for data freshness
- Automated podcast generation
- Daily/weekly brief delivery

---

## Service Categories

### Public API Services (7)
Services with public routes for frontend consumption:
1. `auth-service`
2. `bills-service`
3. `briefs-service`
4. `chat-service`
5. `dashboard-service`
6. `members-service`
7. `subscription-api`

### Internal API Clients (12)
Services for external API integration:
1. `congress-api-client`
2. `claude-client`
3. `cerebras-client`
4. `elevenlabs-client`
5. `exa-client`
6. `fec-client`
7. `gemini-tts-client`
8. `geocodio-client`
9. `openstates-client`
10. `perplexity-client`
11. `podcast-generator`
12. `vultr-storage-client`

### Background Workers (12)
Observers and schedulers for async processing:
1. `brief-generator` (observer)
2. `bill-indexing-observer`
3. `congress-sync-observer`
4. `enrichment-observer`
5. `audio-retry-scheduler`
6. `congress-actions-scheduler`
7. `congress-sync-scheduler`
8. `daily-brief-scheduler`
9. `news-sync-scheduler`
10. `podcast-scheduler`
11. `state-sync-scheduler`
12. `weekly-brief-scheduler`

### Admin Services (3)
Internal tooling:
1. `admin-dashboard`
2. `db-admin`
3. `stripe-webhook`

---

## Key Takeaways for Demo

- **58 total modules** deployed and managed by Raindrop
- **Zero infrastructure management** - all serverless
- **AI-native architecture** with SmartSql, SmartMemory, SmartBucket
- **Event-driven design** with queues and observers
- **Automatic scaling** based on demand
- **Built-in caching** at every layer
- **Single deployment** command deploys entire platform
