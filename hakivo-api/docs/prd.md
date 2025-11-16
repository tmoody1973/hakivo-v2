# Product Requirements Document: Hakivo API

## Executive Summary

Hakivo addresses the critical gap in civic engagement by transforming dense Congressional legislation into accessible, personalized audio briefings. The platform serves politically engaged citizens who want to stay informed about legislative developments but lack time to monitor Congress.gov directly or parse complex bill language. The system orchestrates multiple AI services to collect relevant news, analyze tracked bills, generate conversational podcast-style scripts, synthesize professional audio, and enable interactive Q&A about specific legislation. By delivering daily 7-9 minute and weekly 15-20 minute briefings tailored to each user's policy interests and tracked bills, Hakivo makes legislative awareness practical for busy professionals, activists, and informed citizens.

## Requirements

### Functional Requirements
- User registration and authentication via OAuth (Google) and email/password
- JWT-based session management with 1-hour access tokens and 30-day refresh tokens
- User profile management with automatic Congressional district lookup from zip code
- Preference configuration for policy interests, briefing schedule, and playback settings
- Bill search across Congress.gov with filters for congress, type, chamber, status, policy area
- Bill detail retrieval including full text, summaries, sponsors, committee assignments, actions
- Bill tracking management supporting up to 100 bills per user with activity summaries
- Async audio briefing generation orchestrating Exa.ai news search, Congress.gov updates, Claude script generation (podcast dialogue + written article), ElevenLabs audio synthesis
- Scheduled daily and weekly brief generation via Task schedulers
- Brief status polling and playback progress tracking
- RAG-based chat system for bill Q&A using vector search and Cerebras LLM
- Dashboard aggregation of upcoming briefs, recent activity, tracked bills, news highlights, user statistics
- Rate-limited integration with 8 external APIs (WorkOS, Congress.gov, Geocodio, Claude, ElevenLabs, Cerebras, Exa.ai, OpenAI)
- GDPR-compliant data export and account deletion

### Non-Functional Requirements
- API response time <200ms for cached endpoints, <500ms for database queries
- Brief generation completion in 2-5 minutes with async processing
- RAG chat response <3 seconds end-to-end
- Support for 1000 concurrent brief generation requests
- Congress.gov rate limit enforcement (5000 req/hour) with queue and retry
- 15-minute TTL cache for bill data, 6-hour cache for news searches, 5-minute cache for dashboard
- SQL injection prevention via parameterized queries
- XSS protection with input sanitization
- Rate limiting: 10 login attempts per 15 minutes per IP, account lockout after 5 failed attempts
- Automatic retry with exponential backoff for failed API calls (max 3 attempts)
- Database indexes on user_id, bill_id, date, status fields for query optimization
- CORS configuration for Next.js frontend
- Detailed error logging with request IDs, structured logging via env.logger

## Architecture Approach

The Hakivo API employs a microservices architecture built on Raindrop Framework, organizing functionality into public-facing services (auth, bills, briefs, chat, dashboard), private internal services (user management, external API clients), and background observers for async processing. This separation enables independent scaling of computationally intensive operations like audio generation while maintaining responsive synchronous APIs.

| Component | Type | Addresses Requirements | Solution Approach |
|-----------|------|------------------------|-------------------|
| auth-service | service (public) | User registration, OAuth flow, JWT management, rate limiting, password reset | Integrates WorkOS for OAuth, implements JWT generation/validation with jose, enforces rate limiting via KV cache counters, manages verification tokens in SQL |
| user-service | service (private) | Profile CRUD, preference management, district lookup, onboarding tracking | Stores user data in SQL, calls geocodio-client for district resolution, caches district lookups indefinitely in district-cache |
| bills-service | service (public) | Bill search, detail retrieval, tracking management, activity summaries, engagement metrics | Queries Raindrop cloud SQL database for bill data, enforces 100-bill tracking limit, maintains tracked_bills table, returns comprehensive bill details with sponsors, actions, votes from joined tables |
| briefs-service | service (public) | Brief generation requests, status polling, progress tracking, brief listing | Accepts requests and enqueues to brief-queue, returns 202 Accepted, provides polling endpoint for status updates, stores metadata in briefs table |
| chat-service | service (public) | Chat session management, message handling, conversation history | Creates sessions tied to bill_id, searches bill-texts SmartBucket for relevant chunks using semantic search, delegates answer generation to cerebras-client, stores messages in SQL |
| dashboard-service | service (public) | Data aggregation, user statistics, recommendations, latest Congressional actions | Calls user-service, bills-service, briefs-service to aggregate data, fetches latest Congressional actions from congress-api-client (cached 24h in actions-cache), implements 5-minute caching in dashboard-cache, generates personalized recommendations |
| brief-generator | observer (private) | Async orchestration of news, bill updates, script generation, audio synthesis, storage | Processes brief-queue messages, calls exa-client for news, queries SQL for tracked bill updates, searches bill-texts SmartBucket for bill summaries, calls claude-client for podcast script AND written article, elevenlabs-client for audio, uploads MP3 to Vultr Object Storage via vultr-storage-client, persists script, article, and Vultr CDN URL to briefs table |
| daily-brief-scheduler | task (private) | Schedule daily briefs at 7 AM for users | Queries users with daily briefing enabled, enqueues brief generation jobs to brief-queue based on user preferences and selected days |
| weekly-brief-scheduler | task (private) | Schedule weekly briefs every Monday at 7 AM | Queries users with weekly briefing enabled, enqueues weekly brief generation jobs covering past 7 days of legislative activity |
| congress-sync-scheduler | task (private) | Trigger daily Congress.gov sync at 2 AM | Enqueues sync job to sync-queue for congress-sync-observer to process incremental updates from Congress.gov API |
| congress-sync-observer | observer (private) | Daily sync of Congressional data from Congress.gov API to Raindrop SQL and SmartBucket | Runs daily cron job, checks for new bills introduced, checks updates to all bills in database using update_date timestamps, enforces 5000 req/hour limit, inserts new bills and updates modified bills in SQL, uploads bill full text to bill-texts SmartBucket for automatic chunking and embedding |
| geocodio-client | service (private) | Zip to district lookup, indefinite caching | Queries Geocodio API with rate limiting (2500 req/day), caches results in district-cache with no expiration |
| claude-client | service (private) | Script generation, token counting, cost tracking | Calls Anthropic API with Claude Sonnet 4.5, counts tokens, logs costs to api_usage_logs table, enforces 50 req/min limit |
| elevenlabs-client | service (private) | Audio synthesis, quota monitoring | Calls ElevenLabs text-to-dialogue API, monitors character quota, logs usage to api_usage_logs, returns MP3 stream |
| cerebras-client | service (private) | Fast LLM inference for RAG and bill analysis | Calls Cerebras gpt-oss-120b for chat completions with streaming support, bill AI analysis (what it does, who it affects, key provisions, potential benefits/concerns), dashboard summaries, enforces 100 req/min limit, provides ~1-2s response time |
| exa-client | service (private) | News search, result caching, Pexels image fallback | Calls Exa.ai neural search API, implements 6-hour cache in news-cache, filters by date range and user interests, provides Pexels image fallback with deduplication via image-cache when Exa.ai results lack images |
| vultr-storage-client | service (private) | Audio file storage to Vultr Object Storage (hackathon requirement) | S3-compatible uploads of MP3 files to Vultr, organizes by date hierarchy (daily/YYYY/MM/DD, weekly/YYYY/W##), returns public CDN URLs, monitors storage usage and bandwidth costs |
| app-db | sql_database | Persistent storage for users, bills, briefs, chat, tokens, and full Congress.gov dataset | Stores 43 tables (13 user/app tables + 30 Congress.gov tables) with proper indexes and foreign keys, supports transactional operations, handles all application state and legislative data populated by daily sync |
| news-cache | kv_cache | 6-hour TTL cache for news searches | Reduces Exa.ai API costs, caches search results keyed by interests and date range |
| dashboard-cache | kv_cache | 5-minute TTL cache for dashboard data | Improves dashboard response time by caching aggregated statistics and recommendations |
| district-cache | kv_cache | Indefinite cache for zip-to-district lookups | Minimizes Geocodio API usage since districts rarely change |
| session-cache | kv_cache | Session storage for rate limiting and auth | Stores rate limit counters, login attempts, temporary tokens with appropriate TTLs |
| image-cache | kv_cache | 7-day TTL cache for Pexels image deduplication | Tracks used Pexels image IDs to prevent duplicate images across news articles in briefs |
| actions-cache | kv_cache | 24-hour TTL cache for latest Congressional actions | Caches latest Congressional actions from Congress.gov API for dashboard display, refreshed daily at 2 AM sync |
| bill-texts | smartbucket | Bill full text storage with automatic chunking and semantic search | Stores bill full text as markdown documents, automatically chunks into searchable segments, generates embeddings, provides semantic search API for chat-service and brief-generator |
| brief-queue | queue | Async brief generation job distribution | Decouples brief requests from processing, enables horizontal scaling of brief-generator workers, supports retry and failure handling |
| sync-queue | queue | Daily Congress.gov sync job distribution | Triggers congress-sync-observer daily, manages bulk imports and incremental updates |

The architecture leverages Raindrop's observer pattern for background processing with **dual storage for Congressional data**: Raindrop cloud SQL for structured metadata and SmartBucket for full bill text. Three Task schedulers (daily-brief-scheduler, weekly-brief-scheduler, congress-sync-scheduler) trigger time-based operations, enqueuing jobs to appropriate queues. The brief-generator produces both podcast scripts and written articles for each brief, synthesizes audio via ElevenLabs, and uploads MP3 files to **Vultr Object Storage** (hackathon requirement) for global CDN delivery. News articles are sourced from Exa.ai with automatic Pexels fallback for missing images, using three-tier deduplication (URL tracking, per-brief uniqueness, query diversification) to ensure visual variety. The congress-sync-observer runs daily to check Congress.gov API for new bills and updates, populating both the comprehensive 30-table SQL schema and uploading bill full text to the bill-texts SmartBucket. SQL enables fast filtering and multi-table joins (bills + sponsors + actions + votes + committees), while SmartBucket provides automatic chunking, embedding generation, and semantic search for the AI chat assistant. This eliminates the need for external vector databases like Pinecone - SmartBucket handles all text chunking and embedding automatically. The brief-generator and bills-service query SQL for structured data, while chat-service uses SmartBucket's semantic search to find relevant bill passages for AI-powered Q&A. The dashboard aggregates data from multiple services and displays latest Congressional actions (cached 24h in actions-cache, refreshed at daily 2 AM sync) to provide real-time legislative awareness. Audio files are stored in Vultr Object Storage with S3-compatible API, organized by date hierarchy, and served via Vultr's included CDN for fast global playback (~$7.25/month for 1000 users). KV caches at strategic points (news searches, dashboard aggregations, district lookups, image deduplication, latest actions) minimize external API costs while the queue-based design ensures brief generation can scale to 1000 concurrent users.

## Detailed Artifact References

- Interface design and API contracts: `architecture/interface_design.md`
- Component architecture and responsibilities: `architecture/component_design.md`
- Database schema and relationships: `architecture/database_design.md`
- Environment configuration: `architecture/deployment_config.md`
- Deployment manifest: `tentative_manifest.txt`
- Congress.gov daily sync strategy: `architecture/congress_sync_strategy.md`
- Bill storage and search architecture: `architecture/bill_storage_and_search.md`
- Personalization strategy with policy mapping: `architecture/personalization_strategy.md`
- Policy interest mapping (JSON): `architecture/policy_interest_mapping.json`
- Exa.ai news search integration: `architecture/exa_integration_strategy.md`
- Pexels image fallback strategy: `architecture/pexels_fallback_strategy.md`
- Dashboard latest actions strategy: `architecture/dashboard_latest_actions_strategy.md`
- Cerebras RAG chat integration: `architecture/cerebras_integration_strategy.md`
- Vultr Object Storage integration: `architecture/vultr_storage_strategy.md`
- Feature acceptance criteria: `specifications/feature_specs.md`
- API request/response formats: `specifications/api_definitions.md`
- External dependencies and credentials: `specifications/dependencies.md`
