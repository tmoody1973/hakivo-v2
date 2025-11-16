# Hakivo - Quick Start Guide

Get your Hakivo development server running in 3 minutes.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

## Installation & Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment (Optional for Development)

The app works with mock data by default, so you can skip this step initially.

```bash
# Optional: Copy environment template
cp .env.example .env.local

# The app will use mock data if no API keys are provided
# Add API keys later when you're ready to integrate real APIs
```

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at: **http://localhost:3000**

## What You'll See

Your Hakivo app is now running with **mock data**:

- ✅ **Home Page** - Landing page
- ✅ **Dashboard** - Mock user dashboard with widgets
- ✅ **Legislation** - Mock bills and search
- ✅ **Representatives** - Mock Congressional members
- ✅ **Briefs** - Mock daily/weekly audio briefings
- ✅ **Chat** - Mock bill chat interface
- ✅ **Settings** - User preferences

## Project Structure

```
hakivo-v2/
├── app/                    # Next.js 15 app directory
│   ├── page.tsx           # Home page
│   ├── dashboard/         # Dashboard
│   ├── legislation/       # Bill search & details
│   ├── representatives/   # Member directory
│   ├── briefs/           # Audio briefings archive
│   ├── chat/             # Bill chat interface
│   └── settings/         # User settings
│
├── components/            # React components
│   └── ui/               # shadcn/ui components
│
├── lib/                   # API clients & utilities
│   ├── api/              # API client implementations
│   │   ├── workos.ts     # Auth (mock)
│   │   ├── congress.ts   # Bills (mock)
│   │   ├── claude.ts     # Scripts (mock)
│   │   ├── elevenlabs.ts # Audio (mock)
│   │   └── ...
│   └── api-specs/        # TypeScript types
│
├── docs/
│   └── API_INTEGRATION_GUIDE.md  # Full integration guide
│
├── .env.example          # Environment variables template
└── package.json
```

## Development Workflow

### Phase 1: Frontend Development (Current)

You're here! The app uses mock data for all APIs:

```typescript
// Example: lib/api/congress.ts
export async function fetchBills() {
  // Returns mock data by default
  return { success: true, data: MOCK_BILLS };
}
```

✅ **Develop UI components**
✅ **Test user flows**
✅ **Refine styling**

### Phase 2: API Integration (Next)

When ready to integrate real APIs:

1. **Get API Keys** - Sign up for services (see `.env.example`)
2. **Add to `.env.local`** - Configure environment variables
3. **Replace TODOs** - Find `// TODO: Replace with actual API call` comments
4. **Test APIs** - One at a time

Example implementation:
```typescript
// lib/api/congress.ts
export async function fetchBills(params) {
  // TODO: Replace with actual API call
  // return { success: true, data: MOCK_BILLS };

  // Real implementation:
  const response = await fetch(
    `https://api.congress.gov/v3/bill/${params.congress}?api_key=${process.env.CONGRESS_API_KEY}`
  );
  return await response.json();
}
```

### Phase 3: Backend Development

Build the custom backend API:

1. **Review** - Check `lib/api-specs/backend.types.ts` for schema
2. **Implement** - Create backend endpoints
3. **Connect** - Update `lib/api/backend.ts` with real calls

## Available Scripts

```bash
# Development server (port 3000)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Linting
npm run lint
```

## Key Features (Current with Mock Data)

### 🏠 Home Page
- Landing page with hero section
- Feature highlights
- Call-to-action

### 📊 Dashboard
- Personalized widgets
- Upcoming brief card
- Recent briefs
- Tracked bills
- News highlights
- Usage statistics

### 🏛️ Legislation
- **Search** - Find bills by keyword
- **Filters** - Congress, bill type, chamber
- **Details** - Bill information, sponsors, actions
- **Tracking** - Save bills to watch list

### 👥 Representatives
- **Directory** - Browse Congressional members
- **Search** - By name, state, party
- **Profiles** - Contact info, sponsored bills
- **District Lookup** - Enter zip code

### 🎧 Briefs
- **Archive** - Daily & weekly briefings
- **Audio Player** - Listen to briefings
- **Transcript** - Read script
- **Generation** - Request new briefs

### 💬 Chat
- **RAG Chat** - Ask questions about bills
- **Context-Aware** - Semantic search
- **Sources** - Citation of bill sections
- **History** - Conversation threads

### ⚙️ Settings
- **Profile** - Update user info
- **Preferences** - Policy interests, briefing time
- **Notifications** - Email settings
- **Playback** - Speed, autoplay

## Mock Data Examples

All API clients include realistic mock data:

```typescript
// Mock user
const MOCK_USER = {
  id: 'user_123',
  email: 'demo@hakivo.com',
  firstName: 'Alex',
  lastName: 'Johnson',
  onboardingCompleted: true,
};

// Mock bill
const MOCK_BILL = {
  congress: 119,
  type: 'hr',
  number: '1234',
  title: 'Clean Energy Innovation Act',
  sponsors: [{ name: 'Rep. Smith, Jane [D-CA-12]' }],
  latestAction: 'Referred to Committee on Energy',
};

// Mock brief
const MOCK_BRIEF = {
  id: 'brief_123',
  type: 'daily',
  title: 'Daily Briefing - January 16, 2025',
  duration: 480, // 8 minutes
  audioUrl: 'https://cdn.hakivo.com/briefs/...',
  listened: false,
};
```

## Next Steps

1. ✅ **Run dev server** - `npm run dev`
2. ✅ **Explore the UI** - Browse all pages
3. ✅ **Test features** - Try searching, tracking, playing audio
4. 📖 **Read API docs** - Review `/docs/API_INTEGRATION_GUIDE.md`
5. 🔑 **Get API keys** - When ready to integrate
6. 🔧 **Implement APIs** - Replace mock data with real calls
7. 🗄️ **Build backend** - Create custom API endpoints
8. 🧪 **Test end-to-end** - Generate real briefs

## API Integration Timeline

### Week 1: Authentication
- Set up WorkOS
- Implement OAuth (Google)
- Email/password auth
- Session management

### Week 2: Legislative Data
- Congress.gov API
- Geocodio district lookup
- Bill search & details
- Member directory

### Week 3: AI Services
- Claude 4.5 Sonnet (script generation)
- ElevenLabs (audio generation)
- Cerebras (bill analysis)
- Exa.ai (news search)

### Week 4: Backend & Storage
- Custom backend endpoints
- Vultr S3 storage
- Vector DB (Pinecone)
- RAG implementation

## Troubleshooting

### Port 3000 in use?
```bash
# Use a different port
npm run dev -- -p 3001
```

### Dependencies not installing?
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript errors?
The app is fully typed. If you see errors:
```bash
# Check TypeScript
npx tsc --noEmit
```

### Build errors?
```bash
# Clean Next.js cache
rm -rf .next
npm run dev
```

## Documentation

- **[API Integration Guide](./docs/API_INTEGRATION_GUIDE.md)** - Complete API integration guide
- **[API README](./lib/api/README.md)** - Quick API reference
- **[API Summary](./API_DOCUMENTATION_SUMMARY.md)** - What was created
- **[Environment Variables](./.env.example)** - All required env vars

## Support

For questions or issues:
1. Review the documentation above
2. Check API client comments in `/lib/api/*.ts`
3. Consult official API docs (links in comments)
4. Open a GitHub issue

---

**Ready to start?** Run `npm run dev` and visit http://localhost:3000

The UI is fully functional with mock data - no API keys required! 🚀
