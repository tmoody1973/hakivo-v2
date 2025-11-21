# Hakivo - Civic Engagement Platform

> Empowering citizens to stay informed and engaged with their government through personalized news, bill tracking, and AI-powered insights.

## What is Hakivo?

Hakivo is a full-stack civic engagement platform that makes it easy for citizens to:
- **Track Congressional Bills** - Monitor legislation that matters to you
- **Get Personalized News** - Receive news based on your policy interests (Environment, Healthcare, Economy, etc.)
- **Find Your Representatives** - Discover and connect with your elected officials
- **Daily Briefings** - Get AI-generated summaries of the day's legislative activity
- **Chat with AI** - Ask questions about bills and policies

**Built with modern technologies:**
- Next.js 16 (Frontend)
- Raindrop Framework (Serverless Backend)
- shadcn/ui (Component Library)
- WorkOS (Authentication)
- Congress.gov API (Legislative Data)
- Exa.ai (News Aggregation)

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Raindrop CLI (`npm install -g @liquidmetal-ai/raindrop-cli`)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/hakivo-v2.git
   cd hakivo-v2
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd hakivo-api
   npm install
   ```

4. **Set up environment variables**

   Create `.env.local` in the root directory:
   ```bash
   # Copy example file
   cp .env.example .env.local
   ```

   Add your API keys:
   ```env
   # WorkOS Authentication
   WORKOS_API_KEY=your_workos_api_key
   WORKOS_CLIENT_ID=your_client_id
   WORKOS_REDIRECT_URI=http://localhost:3000/api/auth/callback

   # Congress.gov API (get from https://api.congress.gov/sign-up/)
   CONGRESS_API_KEY=your_congress_api_key

   # Exa.ai for news (get from https://exa.ai)
   EXA_API_KEY=your_exa_api_key
   ```

5. **Run the development servers**

   **Frontend** (Terminal 1):
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

   **Backend** (Terminal 2):
   ```bash
   cd hakivo-api
   raindrop build dev
   ```

You should now see the Hakivo dashboard! 🎉

## Project Structure

```
hakivo-v2/
├── app/                          # Next.js App Router pages
│   ├── api/                     # Frontend API routes
│   │   └── congress/            # Congress.gov proxy endpoints
│   ├── auth/                    # Authentication pages
│   ├── dashboard/               # Main dashboard
│   ├── representatives/         # Find your reps
│   ├── legislation/             # Browse bills
│   └── settings/                # User preferences
│
├── components/                   # React components
│   ├── ui/                      # shadcn/ui base components
│   └── widgets/                 # Dashboard widgets
│       ├── latest-actions-widget.tsx    # Congressional activity
│       ├── personalized-content-widget.tsx  # News feed
│       ├── representatives-horizontal-widget.tsx
│       └── daily-brief-widget.tsx
│
├── lib/                          # Utility functions
│   ├── api/                     # Backend API clients
│   ├── auth/                    # Auth context & helpers
│   └── utils.ts                 # General utilities
│
├── hakivo-api/                   # Raindrop Backend
│   ├── src/                     # Microservices
│   │   ├── auth-service/        # User authentication
│   │   ├── bills-service/       # Bill data & search
│   │   ├── dashboard-service/   # Dashboard API
│   │   ├── briefs-service/      # Daily/weekly briefs
│   │   ├── chat-service/        # AI chat
│   │   ├── news-sync-scheduler/ # News aggregation (runs 2x/day)
│   │   ├── congress-sync-scheduler/  # Bill sync (daily at 2 AM UTC)
│   │   └── [other services]/
│   │
│   ├── db/                      # Database schema & migrations
│   │   └── app-db/              # SQL migrations
│   │
│   ├── raindrop.manifest        # Infrastructure config
│   └── package.json
│
├── public/                       # Static assets
├── docs/                         # Documentation
│   ├── architecture/            # Architecture diagrams & docs
│   └── specifications/          # Feature specs
│
├── package.json                  # Frontend dependencies
└── README.md                     # This file
```

## Key Features

### 1. Personalized News Feed
- **What it does**: Aggregates news from across the web based on your selected policy interests
- **How it works**:
  - Twice daily (6 AM & 6 PM UTC), the `news-sync-scheduler` fetches articles using Exa.ai
  - Articles are categorized by 12 policy interests: Environment, Healthcare, Economy, Education, etc.
  - Users only see articles matching their selected interests
  - View history is automatically reset each sync cycle for a fresh feed

**Location**: `components/widgets/personalized-content-widget.tsx`

### 2. Latest Bill Actions
- **What it does**: Shows the most recent congressional activity on bills
- **How it works**:
  - Real-time API fetches from Congress.gov
  - Caches data for 4 hours
  - Displays bill status (In Committee, Passed House, Became Law, etc.)

**Location**: `app/api/congress/latest-actions/route.ts`

### 3. Find Your Representatives
- **What it does**: Look up your representatives by address or zip code
- **How it works**:
  - Geocodio API converts address to coordinates
  - Matches coordinates to congressional districts
  - Fetches representative data from internal database (synced daily from ProPublica API)

**Location**: `app/representatives/page.tsx`

### 4. Daily Briefings
- **What it does**: AI-generated summaries of congressional activity
- **How it works**:
  - Scheduled task runs daily at 7 AM UTC
  - Analyzes recent bill actions and votes
  - Generates summary using Claude AI
  - Available as text or audio (ElevenLabs TTS)

**Location**: `hakivo-api/src/daily-brief-scheduler/`

## Architecture Highlights

### Frontend Architecture
- **Framework**: Next.js 16 with App Router
- **UI**: shadcn/ui components built on Radix UI
- **State Management**: React Context for auth + local state
- **Styling**: Tailwind CSS v4
- **Data Fetching**: Server Components + Client-side fetching

### Backend Architecture
- **Framework**: Raindrop (serverless microservices)
- **Services**: 15 microservices (8 public, 7 private)
- **Database**: SQLite (via Raindrop SQL)
- **Caching**: 6 KV caches for performance
- **Storage**: SmartBuckets for bill texts and audio
- **Scheduling**: Cron tasks for data sync
- **Queue Processing**: Observers for async jobs

**Full architecture details**: See [ARCHITECTURE.md](./ARCHITECTURE.md)

## Development Workflow

### Frontend Development

```bash
# Start Next.js dev server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Lint code
npm run lint
```

### Backend Development

```bash
cd hakivo-api

# Local development (watch mode)
raindrop build dev

# Deploy to cloud
raindrop build deploy

# View logs
raindrop logs --tail

# Check deployed services
raindrop build find
```

## Common Tasks

### Adding a New Policy Interest

1. Update `docs/architecture/policy_interest_mapping.json`:
   ```json
   {
     "interest": "Technology",
     "keywords": ["artificial intelligence", "cybersecurity", "tech regulation"]
   }
   ```

2. The news sync will automatically pick it up on the next run!

### Creating a New Widget

1. Create component in `components/widgets/`:
   ```tsx
   'use client';

   export function MyWidget() {
     // Your widget code
   }
   ```

2. Import in `app/dashboard/page.tsx`:
   ```tsx
   import { MyWidget } from '@/components/widgets/my-widget';

   // Add to dashboard layout
   <MyWidget />
   ```

### Adding a Backend Service

1. Create service in `hakivo-api/src/my-service/`:
   ```typescript
   import { Service } from '@liquidmetal-ai/raindrop-framework';
   import { Hono } from 'hono';

   const app = new Hono();

   app.get('/hello', (c) => c.json({ message: 'Hello!' }));

   export default class extends Service {
     async fetch(request: Request): Promise<Response> {
       return app.fetch(request, this.env);
     }
   }
   ```

2. Add to `raindrop.manifest`:
   ```hcl
   service "my-service" {
     visibility = "public"
   }
   ```

3. Deploy:
   ```bash
   raindrop build deploy
   ```

## Scheduled Jobs

The backend runs several scheduled tasks (all times in UTC):

| Task | Schedule | Purpose |
|------|----------|---------|
| `news-sync-scheduler` | 6 AM & 6 PM | Fetch latest news articles |
| `congress-sync-scheduler` | 2 AM | Update bill database |
| `congress-actions-scheduler` | 6 AM & 6 PM | Sync latest bill actions |
| `daily-brief-scheduler` | 7 AM | Generate daily brief |
| `weekly-brief-scheduler` | Mon 7 AM | Generate weekly brief |

## API Endpoints

### Public Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/auth-service/login` | User authentication |
| `/dashboard-service/news` | Get personalized news |
| `/dashboard-service/latest-actions` | Congressional activity |
| `/bills-service/search` | Search bills |
| `/briefs-service/daily` | Get daily brief |
| `/chat-service/message` | AI chat |

**Full API documentation**: See [API_GUIDE.md](./docs/API_GUIDE.md)

## Environment Variables

### Required Variables

```env
# Authentication
WORKOS_API_KEY=           # WorkOS API key
WORKOS_CLIENT_ID=         # WorkOS client ID
WORKOS_REDIRECT_URI=      # Auth callback URL

# External APIs
CONGRESS_API_KEY=         # Congress.gov API
EXA_API_KEY=             # Exa.ai for news
GEOCODIO_API_KEY=        # Address to coordinates

# Security
JWT_SECRET=              # JWT signing secret
```

### Optional Variables

```env
# Analytics
VERCEL_ANALYTICS_ID=     # Vercel Analytics

# Feature Flags
ENABLE_CHAT=true         # Enable AI chat
ENABLE_AUDIO_BRIEFS=true # Enable audio briefs
```

## Troubleshooting

### Frontend Issues

**Issue**: "Module not found" errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Issue**: Port 3000 already in use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Backend Issues

**Issue**: "Module not converged" errors
```bash
# Redeploy with fresh build
cd hakivo-api
raindrop build deploy --force
```

**Issue**: Can't find deployed services
```bash
# Check service status
raindrop build find

# View recent logs
raindrop logs --tail -f
```

**Issue**: News not updating
```bash
# Manually trigger news sync (requires authenticated request to admin endpoint)
curl -X POST https://your-dashboard-service-url/admin/sync-news
```

## Learning Resources

- **Raindrop Documentation**: https://docs.liquidmetal.ai
- **Next.js Docs**: https://nextjs.org/docs
- **shadcn/ui**: https://ui.shadcn.com
- **Congress.gov API**: https://api.congress.gov
- **WorkOS Auth Guide**: https://workos.com/docs

## Contributing

This project is part of a learning journey! Contributions, suggestions, and feedback are welcome.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - feel free to use this project for learning!

## Acknowledgments

- Built with guidance from the Raindrop community
- UI components from shadcn/ui
- Congressional data from Congress.gov
- News powered by Exa.ai
- Authentication by WorkOS

---

**Building in public?** Follow my journey on [Twitter](https://twitter.com/yourhandle) | [Blog](https://yourblog.com)
