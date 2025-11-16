# Component Design

## Component Inventory

| Name | Type | Visibility | Purpose |
|------|------|------------|---------|
| auth-service | service | public | Authentication and authorization endpoints |
| user-service | service | private | User profile and preferences management |
| bills-service | service | public | Legislative data and bill tracking |
| briefs-service | service | public | Audio briefing generation and delivery |
| chat-service | service | public | RAG-based bill chat interface with SmartBucket search |
| dashboard-service | service | public | Aggregated dashboard data |
| brief-generator | observer | private | Background briefing generation worker |
| congress-sync-observer | observer | private | Daily sync of Congressional data to SQL and SmartBucket |
| daily-brief-scheduler | task | private | Schedule daily brief generation at 7 AM |
| weekly-brief-scheduler | task | private | Schedule weekly brief generation every Monday |
| congress-sync-scheduler | task | private | Trigger daily Congress.gov sync at 2 AM |
| congress-api-client | service | private | Congress.gov API integration |
| geocodio-client | service | private | Geocodio API integration |
| claude-client | service | private | Anthropic Claude API integration |
| elevenlabs-client | service | private | ElevenLabs API integration |
| cerebras-client | service | private | Cerebras API integration |
| exa-client | service | private | Exa.ai API integration |

## Component Responsibilities

**auth-service**: OAuth flow handling, JWT token generation/validation, email verification, password reset, rate limiting enforcement

**user-service**: User CRUD operations, preference management, Congressional district lookup, onboarding tracking

**bills-service**: Bill search querying Raindrop SQL, bill detail retrieval with joins, tracking management, activity summaries, engagement metrics

**briefs-service**: Brief generation requests, status polling, playback progress tracking, brief listing

**chat-service**: Chat session management, message handling, SmartBucket semantic search for bill text, conversation history

**dashboard-service**: Data aggregation from multiple services, caching layer, personalized recommendation generation using policy interests

**brief-generator**: Async orchestration of news collection (Exa.ai), SQL bill queries, SmartBucket text search, dual content generation (Claude produces both podcast script and written article), audio synthesis (ElevenLabs), storage upload

**daily-brief-scheduler**: Queries users with daily briefing preferences, enqueues brief generation jobs to brief-queue at 7 AM for users based on selected days

**weekly-brief-scheduler**: Queries users with weekly briefing enabled, enqueues weekly brief jobs every Monday at 7 AM covering past 7 days

**congress-sync-scheduler**: Enqueues sync job to sync-queue at 2 AM daily to trigger incremental Congress.gov data updates

**congress-sync-observer**: Daily sync worker that fetches from Congress.gov API, enriches with legislators JSON data, populates Raindrop SQL and uploads bill text to SmartBucket

**congress-api-client**: Rate-limited Congress.gov requests (5000/hour), error handling with retry logic, used by congress-sync-observer

**geocodio-client**: Zip code to district lookup with indefinite caching

**claude-client**: Script generation with token counting, cost tracking

**elevenlabs-client**: Text-to-dialogue conversion, quota monitoring

**cerebras-client**: Chat completion for RAG, fast inference

**exa-client**: News search with result caching

## Inter-Component Communication

```
auth-service → user-service.createUser()
auth-service → user-service.getUserById()
user-service → geocodio-client.lookupDistrict()
bills-service → congress-api-client.searchBills()
bills-service → congress-api-client.getBillDetails()
briefs-service → BRIEF_QUEUE.send()
dashboard-service → user-service.getUserStats()
dashboard-service → bills-service.getTrackedBills()
dashboard-service → briefs-service.getRecentBriefs()
brief-generator → exa-client.searchNews()
brief-generator → congress-api-client.getBillUpdates()
brief-generator → claude-client.generateScript()
brief-generator → elevenlabs-client.synthesizeAudio()
chat-service → bill-indexer.getChunks()
chat-service → cerebras-client.generateAnswer()
bill-indexer → VECTOR_DB.upsert()
```

## File Structure Per Component

### Service Components
```
src/
  auth-service/
    index.ts
    interfaces.ts
    utils.ts
  user-service/
    index.ts
    interfaces.ts
    utils.ts
  bills-service/
    index.ts
    interfaces.ts
    utils.ts
  briefs-service/
    index.ts
    interfaces.ts
    utils.ts
  chat-service/
    index.ts
    interfaces.ts
    utils.ts
  dashboard-service/
    index.ts
    interfaces.ts
    utils.ts
  congress-api-client/
    index.ts
    interfaces.ts
    utils.ts
  geocodio-client/
    index.ts
    interfaces.ts
    utils.ts
  claude-client/
    index.ts
    interfaces.ts
    utils.ts
  elevenlabs-client/
    index.ts
    interfaces.ts
    utils.ts
  cerebras-client/
    index.ts
    interfaces.ts
    utils.ts
  exa-client/
    index.ts
    interfaces.ts
    utils.ts
```

### Observer Components
```
src/
  brief-generator/
    index.ts
    interfaces.ts
    utils.ts
  bill-indexer/
    index.ts
    interfaces.ts
    utils.ts
```

### Shared Code
```
src/
  shared/
    interfaces.ts
    utils.ts
```
