# Hakivo - Civic Intelligence Platform

> Empowering citizens to stay informed and engaged with their government through personalized briefings, AI-powered analysis, and the 100 Laws That Shaped America podcast.

**Live Demo**: [https://hakivo-v2.netlify.app](https://hakivo-v2.netlify.app)

## What is Hakivo?

Hakivo is a comprehensive civic intelligence platform that connects citizens with their government at both federal and state levels. The platform provides:

- **Personalized Daily Briefings** - AI-generated audio briefings tailored to your policy interests
- **100 Laws That Shaped America Podcast** - Weekly AI-generated episodes exploring landmark legislation, auto-published to Spreaker
- **Federal & State Bill Tracking** - Monitor legislation from Congress and your state legislature
- **AI-Powered Bill Analysis** - Deep forensic analysis of bills using Claude AI with extended thinking
- **Personalized News Feed** - News aggregated from Perplexity AI based on your policy interests
- **Find Your Representatives** - Discover your federal and state legislators based on your location
- **AI Chat** - Ask questions about bills and policies with Claude AI
- **Hakivo Pro Subscription** - Premium features with Stripe billing integration

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15, React 19, TypeScript |
| **UI** | shadcn/ui, Tailwind CSS v4, Radix UI |
| **Backend** | Raindrop Framework (Cloudflare Workers) |
| **Database** | Cloudflare D1 (SQLite) |
| **Authentication** | WorkOS AuthKit |
| **Payments** | Stripe (subscriptions, customer portal) |
| **AI** | Claude (Anthropic), Gemini (Google), Cerebras |
| **Text-to-Speech** | Google Gemini TTS, ElevenLabs |
| **Podcast Distribution** | Spreaker (auto-upload via OAuth) |
| **APIs** | Congress.gov, OpenStates, Geocodio, Perplexity |
| **Storage** | Vultr Object Storage, Cloudflare R2 |
| **Hosting** | Netlify (Frontend), LiquidMetal (Backend) |

## Key Features

### 1. Personalized Daily & Weekly Briefings

- AI-generated audio briefings using Gemini TTS
- Personalized based on your policy interests and tracked bills
- Visual featured images generated with Gemini AI
- Congressional trivia while briefs generate (via Cerebras)
- Welcome banner with real-time generation progress for new users

### 2. 100 Laws That Shaped America Podcast

- Weekly AI-generated podcast episodes exploring landmark U.S. legislation
- Automated pipeline: script generation, TTS audio, artwork creation
- Auto-upload to Spreaker via OAuth integration
- Episodes distributed to major podcast platforms
- AI-generated episode artwork using Gemini image generation

### 3. Bill Tracking & Analysis

**Federal Bills**
- Real-time sync from Congress.gov API (119th Congress)
- AI enrichment with plain-language summaries and key points
- Deep forensic analysis with Claude extended thinking:
  - Executive summary and status quo comparison
  - Section-by-section breakdown
  - Stakeholder impact analysis
  - Arguments for and against
  - Passage likelihood scoring
  - Implementation challenges

**State Bills**
- Integration with OpenStates API for all 50 states
- State bill analysis with the same AI-powered insights
- Filter by your home state from user preferences

### 4. Find Your Representatives

**Federal Representatives**
- 2 U.S. Senators + 1 U.S. Representative per user
- Photos, contact info, and office addresses
- Party affiliation with color coding (D/R/I)

**State Legislators**
- District-based lookup using Geocodio's `stateleg` field
- State Senator and State Representative for your exact district
- 7,262 state legislators loaded across 49 states with photos

### 5. Personalized News

- 12 policy interest categories: Environment, Healthcare, Economy, Education, Immigration, Civil Rights, Foreign Policy, Technology, Housing, Criminal Justice, Energy, Agriculture
- News sourced via Perplexity AI with interest-specific prompts
- Smart rotation system - unseen articles first, then viewed articles by recency
- Bookmark articles for later reading

### 6. Hakivo Pro Subscription

- Stripe-powered subscription management at $12/month
- Free tier: 3 briefs/month, 3 tracked bills, 3 followed members
- Pro tier: Unlimited briefs, unlimited tracking, daily briefings, real-time alerts, audio digests
- Customer portal for subscription management
- Webhook integration for real-time subscription status

### 7. Dashboard Widgets

| Widget | Description |
|--------|-------------|
| Daily Brief | Audio player with transcript and featured image |
| 100 Laws Podcast | Latest episodes with Spreaker integration |
| Your Representatives | Federal + State legislators with contact buttons |
| Latest Actions | Recent congressional and state bill activity |
| Personalized News | Interest-filtered news carousel |
| Personalized Bills | Bills matching your policy interests |

## Architecture

### Backend Services (36+ Handlers)

**Public Services**
- `auth-service` - JWT authentication with WorkOS
- `bills-service` - Federal and state bill data, search, analysis
- `briefs-service` - Daily/weekly brief generation and delivery
- `chat-service` - AI chat about bills and policies
- `dashboard-service` - Dashboard API, news, representatives
- `user-service` - User profile and preferences
- `subscription-api` - Stripe subscription management
- `stripe-webhook` - Stripe webhook handler
- `admin-dashboard` - Admin endpoints for data management
- `db-admin` - Database administration, Spreaker OAuth

**Private Services (Internal Clients)**
- `congress-api-client` - Congress.gov API wrapper
- `geocodio-client` - Address geocoding with state legislative districts
- `openstates-client` - State legislature data
- `claude-client` - Anthropic Claude AI
- `perplexity-client` - Perplexity AI for news
- `cerebras-client` - Fast inference for trivia
- `gemini-tts-client` - Google TTS for audio briefs
- `elevenlabs-client` - ElevenLabs TTS (fallback)
- `vultr-storage-client` - Object storage for audio files
- `fec-client` - FEC campaign finance data

**Observers (Queue Processors)**
- `enrichment-observer` - Bill enrichment and deep analysis queue
- `congress-sync-observer` - Bill sync from Congress.gov
- `bill-indexing-observer` - Search index updates
- `brief-generator` - Brief content and audio generation

**Schedulers (Cron Jobs)**
- `daily-brief-scheduler` - Daily at 7 AM UTC
- `weekly-brief-scheduler` - Mondays at 7 AM UTC
- `podcast-scheduler` - Weekly podcast episode generation
- `congress-sync-scheduler` - Daily at 2 AM UTC
- `congress-actions-scheduler` - 6 AM & 6 PM UTC
- `news-sync-scheduler` - 6 AM & 6 PM UTC
- `state-sync-scheduler` - Weekly state legislator sync
- `audio-retry-scheduler` - Retry failed TTS jobs

### Database Schema (25+ Migrations)

**Core Tables**
- `users`, `user_preferences`, `refresh_tokens`
- `bills`, `bill_actions`, `bill_tracking`
- `bill_enrichment`, `bill_analysis`
- `state_bills`, `state_bill_analysis`, `state_legislators`
- `members` (Congress members)
- `briefs`, `chat_sessions`, `chat_messages`
- `news_articles`, `user_article_views`, `user_bookmarks`
- `user_bill_views`, `user_bill_bookmarks`
- `latest_bill_actions`, `indexing_progress`
- `podcast_episodes` - Podcast with Spreaker integration
- `subscriptions`, `user_alerts` - Stripe subscription tracking

### Frontend Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/auth/login` | WorkOS authentication |
| `/onboarding` | New user setup (interests, location) |
| `/dashboard` | Main dashboard with widgets |
| `/legislation` | Browse and search bills |
| `/bills/[id]` | Federal bill detail with AI analysis |
| `/state-bills/[id]` | State bill detail with AI analysis |
| `/representatives` | Find your representatives |
| `/representatives/[id]` | Representative detail page |
| `/briefs` | Browse generated briefs |
| `/chat` | AI chat interface |
| `/settings` | User preferences, subscription management |

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Raindrop CLI: `npm install -g @liquidmetal-ai/raindrop-cli`

### Installation

```bash
# Clone repository
git clone https://github.com/tmoody1973/hakivo-v2.git
cd hakivo-v2

# Install frontend dependencies
npm install

# Install backend dependencies
cd hakivo-api
npm install
```

### Environment Variables

Create `.env.local` in the root directory:

```env
# WorkOS Authentication
WORKOS_API_KEY=your_workos_api_key
WORKOS_CLIENT_ID=your_workos_client_id
WORKOS_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Backend API URL
NEXT_PUBLIC_BACKEND_URL=https://your-deployed-backend.lmapp.run

# JWT Secret (must match backend)
JWT_SECRET=your_jwt_secret

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

Backend environment variables (configured in Raindrop):

```env
# External APIs
CONGRESS_API_KEY=       # Congress.gov API
GEOCODIO_API_KEY=       # Address geocoding
OPENSTATES_API_KEY=     # State legislature data
ANTHROPIC_API_KEY=      # Claude AI
GEMINI_API_KEY=         # Google Gemini TTS & image generation
PERPLEXITY_API_KEY=     # News aggregation
CEREBRAS_API_KEY=       # Fast inference

# Stripe
STRIPE_SECRET_KEY=      # Stripe API key
STRIPE_WEBHOOK_SECRET=  # Stripe webhook signing secret

# Spreaker (Podcast Distribution)
SPREAKER_CLIENT_ID=     # Spreaker OAuth client ID
SPREAKER_CLIENT_SECRET= # Spreaker OAuth client secret
SPREAKER_SHOW_ID=       # Spreaker show ID

# Storage
VULTR_OBJECT_STORAGE_HOSTNAME=
VULTR_OBJECT_STORAGE_ACCESS_KEY=
VULTR_OBJECT_STORAGE_SECRET_KEY=
```

### Running Locally

**Frontend** (Terminal 1):
```bash
npm run dev
# Open http://localhost:3000
```

**Backend** (Terminal 2):
```bash
cd hakivo-api
npm run build
npx raindrop build dev
```

## Scheduled Jobs

| Job | Schedule (UTC) | Purpose |
|-----|----------------|---------|
| `congress-sync-scheduler` | 2:00 AM | Sync bills from Congress.gov |
| `congress-actions-scheduler` | 6:00 AM, 6:00 PM | Update latest bill actions |
| `news-sync-scheduler` | 6:00 AM, 6:00 PM | Fetch news via Perplexity |
| `daily-brief-scheduler` | 7:00 AM | Generate daily audio briefs |
| `weekly-brief-scheduler` | Monday 7:00 AM | Generate weekly summary briefs |
| `podcast-scheduler` | Weekly | Generate 100 Laws podcast episode |
| `state-sync-scheduler` | Weekly | Sync state legislators from OpenStates |
| `audio-retry-scheduler` | Hourly | Retry failed TTS generation |

## Data Sources

| Source | Data | Update Frequency |
|--------|------|------------------|
| [Congress.gov API](https://api.congress.gov) | Federal bills, actions, members | Daily |
| [OpenStates API](https://openstates.org) | State bills, legislators | Daily/Weekly |
| [Geocodio](https://geocod.io) | Address to Congressional & State Districts | Real-time |
| [Perplexity AI](https://perplexity.ai) | News articles by policy interest | Twice daily |
| [FEC API](https://api.open.fec.gov) | Campaign finance data | Real-time |

## API Overview

### Public Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth-service/login` | POST | Authenticate user |
| `/auth-service/me` | GET | Get current user |
| `/dashboard-service/news` | GET | Personalized news feed |
| `/dashboard-service/representatives` | GET | User's representatives |
| `/dashboard-service/state-bills` | GET | State bills for user's state |
| `/bills-service/search` | GET | Search federal bills |
| `/bills-service/:id` | GET | Bill details |
| `/bills-service/:id/analyze` | POST | Trigger deep analysis |
| `/bills-service/state/:id` | GET | State bill details |
| `/bills-service/state/:id/analyze` | POST | Trigger state bill analysis |
| `/briefs-service/daily` | GET | Get daily brief |
| `/briefs-service/generate` | POST | Generate on-demand brief |
| `/chat-service/message` | POST | Send chat message |
| `/subscription-api/status` | GET | Get subscription status |
| `/subscription-api/checkout` | POST | Create Stripe checkout session |
| `/subscription-api/portal` | POST | Create customer portal session |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is dual-licensed:

- **AGPL-3.0** for open source use by nonprofits, civic tech organizations, academic institutions, and government agencies
- **Commercial License** for proprietary use by for-profit entities

See [LICENSE](./LICENSE) for details. For commercial licensing inquiries, contact tarik@hakivo.app.

## Acknowledgments

- **LiquidMetal** - Raindrop Framework
- **shadcn** - UI component library
- **Congress.gov** - Federal legislative data
- **OpenStates** - State legislative data
- **Anthropic** - Claude AI
- **Google** - Gemini TTS & image generation
- **Spreaker** - Podcast hosting & distribution
- **Stripe** - Payment processing
- **WorkOS** - Authentication

---

Built with care by [Tarik Moody](https://github.com/tmoody1973)
