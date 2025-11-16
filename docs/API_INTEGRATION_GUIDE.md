1# Hakivo API Integration Guide

Complete guide for integrating all APIs used in the Hakivo platform to transform Congressional legislation into personalized audio briefings.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [API Authentication](#api-authentication)
4. [Environment Setup](#environment-setup)
5. [Core Workflows](#core-workflows)
6. [API Reference](#api-reference)
7. [Rate Limits & Costs](#rate-limits--costs)
8. [Error Handling](#error-handling)
9. [Testing Recommendations](#testing-recommendations)

---

## Overview

Hakivo uses 9 different APIs to deliver its functionality:

| API | Purpose | Tier/Cost |
|-----|---------|-----------|
| **WorkOS** | User authentication (OAuth, email/password) | Free tier available |
| **Congress.gov** | Legislative data (bills, members, votes) | Free (5,000/hour) |
| **Geocodio** | Zip code → Congressional district lookup | Free tier (2,500/day) |
| **Claude (Anthropic)** | Podcast script generation | Usage-based |
| **ElevenLabs** | Text-to-dialogue audio generation | Character-based pricing |
| **Cerebras** | Bill analysis & RAG chat | Usage-based |
| **Exa.ai** | Personalized news search | Usage-based |
| **Custom Backend** | User data, tracking, briefs, chat history | Self-hosted |
| **Vultr Storage** | S3-compatible audio file storage with CDN | Usage-based |

---

## Architecture

### Data Flow for Daily Brief Generation (7-9 minutes)

```
1. User Preferences (Backend)
   ↓
2. Fetch Tracked Bills (Congress.gov) + Personalized News (Exa.ai)
   ↓
3. Generate Script (Claude 4.5 Sonnet)
   ↓
4. Generate Audio (ElevenLabs eleven_v3 - Sarah & James)
   ↓
5. Upload to Storage (Vultr S3)
   ↓
6. Save Brief Metadata (Backend)
   ↓
7. Deliver via CDN
```

### RAG Chat Flow

```
1. User Question
   ↓
2. Vector Search  - Get relevant bill sections
   ↓
3. Generate Answer (Cerebras gpt-oss-120b) with context
   ↓
4. Return Response with Sources
   ↓
5. Save Chat History (Backend)
```

---

## API Authentication

### WorkOS
- **Method**: API Key + OAuth
- **Header**: `Authorization: Bearer {WORKOS_API_KEY}`
- **Docs**: https://workos.com/docs/reference

### Congress.gov
- **Method**: API Key
- **Header**: `X-Api-Key: {CONGRESS_API_KEY}`
- **Docs**: https://api.congress.gov/

### Geocodio
- **Method**: API Key (query parameter)
- **Parameter**: `api_key={GEOCODIO_API_KEY}`
- **Docs**: https://www.geocod.io/docs/

### Claude (Anthropic)
- **Method**: API Key
- **Headers**:
  - `x-api-key: {ANTHROPIC_API_KEY}`
  - `anthropic-version: 2023-06-01`
- **Model**: `claude-sonnet-4-5-20250929`
- **Docs**: https://docs.anthropic.com/claude/reference

### ElevenLabs
- **Method**: API Key
- **Header**: `xi-api-key: {ELEVENLABS_API_KEY}`
- **Model**: `eleven_v3` (text-to-dialogue)
- **Docs**: https://elevenlabs.io/docs

### Cerebras
- **Method**: API Key (Bearer token)
- **Header**: `Authorization: Bearer {CEREBRAS_API_KEY}`
- **Model**: `llama3.1-70b`
- **Docs**: https://inference-docs.cerebras.ai/

### Exa.ai
- **Method**: API Key
- **Header**: `x-api-key: {EXA_API_KEY}`
- **Docs**: https://docs.exa.ai/

### Custom Backend
- **Method**: JWT + API Key
- **Headers**:
  - `Authorization: Bearer {access_token}` (from WorkOS)
  - `X-API-Key: {BACKEND_API_KEY}` (optional, for server-to-server)

### Vultr Storage
- **Method**: S3-compatible (AWS SDK)
- **Credentials**: Access Key + Secret Key
- **SDK**: `@aws-sdk/client-s3`
- **Docs**: https://www.vultr.com/docs/vultr-object-storage/

---

## Environment Setup

1. Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

2. Fill in all API keys (see [Environment Variables](#environment-variables) section)

3. Install dependencies:
```bash
npm install
```

4. Test API connections:
```bash
npm run test:api
```

### Required Environment Variables

See `.env.example` for the complete list. Critical variables:

```bash
# Auth
WORKOS_API_KEY=sk_test_...
WORKOS_CLIENT_ID=client_...

# Data Sources
CONGRESS_API_KEY=...
GEOCODIO_API_KEY=...

# AI/ML
ANTHROPIC_API_KEY=sk-ant-...  # Claude 4.5 Sonnet
ELEVENLABS_API_KEY=...        # Text-to-dialogue
CEREBRAS_API_KEY=...          # gpt-oss-120b
EXA_API_KEY=...               # News search

# Storage
VULTR_ACCESS_KEY=...
VULTR_SECRET_KEY=...
VULTR_BUCKET=hakivo-audio
VULTR_REGION=ewr1
VULTR_CDN_URL=

# Backend
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

---

## Core Workflows

### 1. Daily Brief Generation (7-9 minutes)

**Goal**: Generate personalized 7-9 minute audio briefing with news + tracked bills

**Implementation** (see `/lib/api/*` for API calls):

```typescript
import { generateDailyBrief } from '@/lib/workflows/daily-brief';

async function createDailyBrief(userId: string, date: string) {
  // 1. Get user preferences & tracked bills
  const [preferences, trackedBills] = await Promise.all([
    getUserPreferences(accessToken),
    getTrackedBills(accessToken),
  ]);

  // 2. Fetch data in parallel
  const [newsArticles, billUpdates] = await Promise.all([
    // Exa.ai: Last 24 hours, user interests
    getPersonalizedNews(
      preferences.policyInterests,
      { from: yesterday, to: today }
    ),
    // Congress.gov: Updates for tracked bills
    Promise.all(
      trackedBills.map(bill =>
        fetchBillById(bill.congress, bill.billType, bill.billNumber)
      )
    ),
  ]);

  // 3. Generate script with Claude 4.5 Sonnet (1400-1800 words)
  const script = await generateDailyBriefScript({
    userInterests: preferences.policyInterests,
    trackedBills: trackedBills.map(b => b.billId),
    newsArticles,
    billUpdates,
    date,
  });

  // 4. Generate audio with ElevenLabs (text-to-dialogue, Sarah & James)
  const audio = await generateDialogueAudio(script, {
    format: 'mp3_44100_128',
    voiceSettings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.5,
      use_speaker_boost: true,
    },
  });

  // 5. Upload to Vultr storage
  const { cdnUrl } = await uploadAudio({
    briefId: `daily_${date}`,
    audioData: audio.audioData,
    format: 'mp3',
    metadata: {
      duration: script.estimatedDuration,
      title: script.title,
      date,
    },
  });

  // 6. Save brief to backend
  const brief = await createBrief(accessToken, {
    type: 'daily',
    date,
    script,
    audioUrl: cdnUrl,
    duration: script.estimatedDuration,
  });

  return brief;
}
```

**Estimated Costs per Daily Brief**:
- Claude 4.5 Sonnet: ~10,000 tokens @ $3/MTok input, $15/MTok output ≈ $0.15
- ElevenLabs: ~1,600 words × 6 chars/word = 9,600 chars ≈ $0.29
- Exa.ai: 10 searches ≈ $0.10
- **Total**: ~$0.54 per daily brief

### 2. Weekly Brief Generation (15-20 minutes)

**Goal**: Comprehensive weekly roundup of enacted laws and presidential actions

Similar to daily brief but:
- Longer script (3000-4000 words)
- Focus on enacted laws, presidential actions, major votes
- Generated weekly on Sundays

**Implementation**:
```typescript
const weeklyScript = await generateWeeklyBriefScript({
  enactedLaws: await fetchEnactedLaws(weekStart, weekEnd),
  presidentialActions: await fetchPresidentialActions(weekStart, weekEnd),
  majorVotes: await fetchMajorVotes(weekStart, weekEnd),
  weekOf: weekStart,
});
```

### 3. Bill Chat with RAG

**Goal**: Answer user questions about bills using vector search + LLM

**Flow**:
```typescript
import { chatWithBill } from '@/lib/api/cerebras';
import { searchVectors } from '@/lib/vector-db/pinecone';

async function answerQuestion(billId: string, question: string) {
  // 1. Vector search for relevant bill sections
  const relevantChunks = await searchVectors({
    query: question,
    filter: { billId },
    topK: 5,
  });

  // 2. Call Cerebras with context
  const response = await chatWithBill({
    question,
    context: {
      chunks: relevantChunks.map(c => c.text),
      metadata: relevantChunks.map(c => ({ section: c.metadata.section })),
    },
  });

  // 3. Return answer with sources
  return {
    answer: response.data.answer,
    sources: response.data.sources,
  };
}
```

**Vector DB Setup** (Pinecone):
```typescript
// 1. Create index (one-time setup)
// Dimensions: 1536 (OpenAI ada-002) or 3072 (Voyage AI)
// Metric: cosine

// 2. Index bill text
import { embed } from '@/lib/embeddings';

async function indexBill(billText: string, billId: string) {
  const chunks = splitIntoChunks(billText, 500); // 500 words per chunk

  for (const chunk of chunks) {
    const embedding = await embed(chunk.text);
    await upsertVector({
      id: chunk.id,
      values: embedding,
      metadata: {
        billId,
        section: chunk.section,
        text: chunk.text,
      },
    });
  }
}
```

---

## API Reference

### WorkOS Authentication

**Login with Google**:
```typescript
// Get OAuth URL
const { url } = await loginWithGoogle('http://localhost:3000/auth/callback');
// Redirect user to url

// Handle callback
const { session, user } = await handleOAuthCallback({ code, state });
```

**Email/Password**:
```typescript
// Register
const { session, user } = await register({
  email: 'user@example.com',
  password: 'SecurePass123!',
  firstName: 'John',
  lastName: 'Doe',
});

// Login
const { session, user } = await login({
  email: 'user@example.com',
  password: 'SecurePass123!',
});
```

**Session Management**:
```typescript
// Get current user
const user = await getCurrentUser(accessToken);

// Refresh token
const { accessToken, refreshToken } = await refreshAccessToken(oldRefreshToken);

// Logout
await logout(accessToken);
```

### Congress.gov

**Search Bills**:
```typescript
const bills = await searchBills('climate change', {
  congress: 119,
  sort: 'updateDate',
  limit: 20,
});
```

**Get Bill Details**:
```typescript
const bill = await fetchBillById(119, 'hr', '1234');
// Returns: bill with actions, sponsors, summaries, text versions
```

**Get Members by District**:
```typescript
// First get district from zip
const district = await lookupByZipCode('94102');
// Then get members
const members = await fetchMembersByDistrict(district.state, district.district);
```

### Geocodio

**Zip to District**:
```typescript
const result = await lookupByZipCode('94102');
// Returns: { state: 'CA', district: 12, representatives: [...] }
```

**Get Representatives**:
```typescript
const reps = await getRepresentatives('94102');
// Returns: [{ type: 'senator', name, party, bioguideId, ... }]
```

### Claude (Script Generation)

**Daily Brief Script**:
```typescript
const script = await generateDailyBriefScript({
  userInterests: ['climate', 'healthcare'],
  trackedBills: ['hr-1234-119'],
  newsArticles: [{ title, summary, url, ... }],
  billUpdates: [{ billId, title, latestAction, ... }],
  date: '2025-01-16',
});
// Returns: { dialogue: [{ speaker, text }], sections, wordCount, estimatedDuration }
```

### ElevenLabs (Audio Generation)

**Generate Dialogue Audio**:
```typescript
const audio = await generateDialogueAudio(script, {
  format: 'mp3_44100_128',
  voiceSettings: {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.5,
    use_speaker_boost: true,
  },
});
// Returns: { audioData: base64, format, sizeBytes }

// Save audio
const buffer = Buffer.from(audio.audioData, 'base64');
fs.writeFileSync('brief.mp3', buffer);
```

### Cerebras (Bill Analysis & Chat)

**Analyze Bill**:
```typescript
const analysis = await analyzeBill({
  billText: fullBillText,
  analysisType: 'comprehensive',
});
// Returns: { summary, keyProvisions, potentialImpact, stakeholders, fiscalImpact }
```

**RAG Chat**:
```typescript
const response = await chatWithBill({
  question: 'What are the tax credit provisions?',
  context: {
    chunks: [...relevantSections],
  },
});
// Returns: { answer, sources, confidence }
```

### Exa.ai (News Search)

**Search News**:
```typescript
const news = await getPersonalizedNews(
  ['climate', 'healthcare'],
  { from: '2025-01-15T00:00:00Z', to: '2025-01-16T00:00:00Z' }
);
// Returns: { results: [{ title, url, publishedDate, summary, ... }] }
```

### Vultr Storage

**Upload Audio**:
```typescript
const result = await uploadAudio({
  briefId: 'daily_2025-01-16',
  audioData: base64Audio,
  format: 'mp3',
  metadata: { duration: 480, title: 'Daily Brief' },
});
// Returns: { url, cdnUrl, key, size }
```

### Backend API

**User Preferences**:
```typescript
// Get
const prefs = await getUserPreferences(accessToken);

// Update
await updateUserPreferences(accessToken, {
  policyInterests: ['climate', 'healthcare', 'education'],
  briefingTime: '08:00',
});
```

**Bill Tracking**:
```typescript
// Track bill
await trackBill(accessToken, {
  billId: 'hr-1234-119',
  congress: 119,
  billType: 'hr',
  billNumber: '1234',
  title: 'Clean Energy Innovation Act',
});

// Get tracked bills
const tracked = await getTrackedBills(accessToken);
```

**Briefs**:
```typescript
// Get briefs
const briefs = await getBriefs(accessToken, { type: 'daily', limit: 20 });

// Get specific brief
const brief = await getBriefById(accessToken, 'brief_123');

// Mark as listened
await markBriefAsListened(accessToken, 'brief_123');
```

**Dashboard**:
```typescript
const dashboard = await getDashboardData(accessToken);
// Returns: {
//   user, upcomingBrief, recentBriefs, trackedBills, newsHighlights,
//   stats: { totalBriefsListened, trackedBillsCount, minutesListened, currentStreak }
// }
```

---

## Rate Limits & Costs

### WorkOS
- **Free Tier**: 10,000 MAUs
- **Paid**: $0.035/MAU
- **Rate Limit**: No published limit

### Congress.gov
- **Free**: 5,000 requests/hour
- **Cost**: Free
- **Rate Limit**: 5,000/hour per API key

### Geocodio
- **Free Tier**: 2,500 lookups/day
- **Paid**: $0.50/1,000 lookups
- **Rate Limit**: Based on plan

### Claude (Anthropic)
- **Model**: claude-sonnet-4-5-20250929
- **Input**: $3.00/million tokens
- **Output**: $15.00/million tokens
- **Rate Limit**: 50 requests/minute (standard tier)
- **Est. Cost**: $0.15/brief

### ElevenLabs
- **Free**: 10,000 characters/month
- **Creator**: $5/month for 30,000 chars
- **Pro**: $22/month for 100,000 chars
- **Rate Limit**: Based on plan
- **Est. Cost**: ~$0.29/brief (9,600 chars)

### Cerebras
- **Pricing**: Usage-based
- **Model**: llama3.1-70b
- **Rate Limit**: Varies by plan

### Exa.ai
- **Free**: 1,000 searches/month
- **Growth**: $49/month for 10,000 searches
- **Rate Limit**: Based on plan
- **Est. Cost**: ~$0.10/brief (10 searches)

### Vultr Storage
- **Pricing**: $5/month for 250 GB + 1 TB transfer
- **Additional**: $0.02/GB storage, $0.01/GB transfer
- **CDN**: Included

### Summary: Cost per Daily Brief
- Claude: $0.15
- ElevenLabs: $0.29
- Exa.ai: $0.10
- **Total**: ~$0.54/brief
- **Monthly** (30 briefs): ~$16.20

---

## Error Handling

### Common Error Patterns

```typescript
import { APIResponse, isAPIError } from '@/lib/api-specs/common.types';

async function handleAPICall<T>(apiCall: () => Promise<APIResponse<T>>): Promise<T> {
  try {
    const response = await apiCall();

    if (isAPIError(response)) {
      // Handle API error
      switch (response.error.code) {
        case 'RATE_LIMIT_EXCEEDED':
          // Implement exponential backoff
          await sleep(calculateBackoff(retryCount));
          return handleAPICall(apiCall); // Retry

        case 'AUTH_UNAUTHORIZED':
          // Refresh token and retry
          await refreshTokens();
          return handleAPICall(apiCall);

        case 'RESOURCE_NOT_FOUND':
          throw new NotFoundError(response.error.message);

        default:
          throw new APIError(response.error);
      }
    }

    return response.data!;
  } catch (error) {
    // Handle network errors, timeouts, etc.
    if (error.name === 'TimeoutError') {
      // Retry with longer timeout
    }
    throw error;
  }
}
```

### Retry Strategy

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = Math.min(1000 * 2 ** i, 10000); // Max 10s
      await sleep(delay);
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Testing Recommendations

### 1. Mock API Calls in Development

All API clients in `/lib/api/*` return mock data by default. To enable real API calls:

```typescript
// lib/config.ts
export const USE_REAL_APIS = process.env.NODE_ENV === 'production';

// In each API client
if (!USE_REAL_APIS) {
  return { success: true, data: MOCK_DATA };
}
// ... actual API call
```

### 2. Unit Tests

```typescript
// __tests__/api/congress.test.ts
import { fetchBills } from '@/lib/api/congress';

describe('Congress API', () => {
  it('should fetch bills', async () => {
    const result = await fetchBills({ congress: 119, limit: 10 });
    expect(result.success).toBe(true);
    expect(result.data.bills).toHaveLength(10);
  });
});
```

### 3. Integration Tests

Test full workflows with real APIs (use separate test keys):

```typescript
// __tests__/workflows/daily-brief.test.ts
describe('Daily Brief Workflow', () => {
  it('should generate complete daily brief', async () => {
    const brief = await generateDailyBrief(testUserId, testDate);

    expect(brief.status).toBe('completed');
    expect(brief.audioUrl).toBeTruthy();
    expect(brief.duration).toBeGreaterThan(400); // At least 7 minutes
  });
});
```

### 4. Rate Limit Testing

```typescript
// Test rate limit handling
it('should handle rate limits with backoff', async () => {
  const promises = Array(100).fill(null).map(() => fetchBills());
  const results = await Promise.allSettled(promises);

  const failures = results.filter(r => r.status === 'rejected');
  expect(failures.length).toBe(0); // Should retry automatically
});
```

---

## Next Steps

1. **Set up environment variables** - Copy `.env.example` to `.env.local` and fill in API keys
2. **Install dependencies** - Run `npm install`
3. **Test API connections** - Run `npm run test:api` to verify all APIs are accessible
4. **Implement backend** - Build the custom backend API endpoints
5. **Set up vector DB** - Create Pinecone index and implement embedding pipeline
6. **Build workflows** - Implement daily brief generation and RAG chat
7. **Test end-to-end** - Generate a test brief and verify all systems work

---

## Support & Resources

- **WorkOS**: https://workos.com/docs
- **Congress.gov**: https://api.congress.gov/
- **Geocodio**: https://www.geocod.io/docs/
- **Anthropic**: https://docs.anthropic.com/
- **ElevenLabs**: https://elevenlabs.io/docs
- **Cerebras**: https://inference-docs.cerebras.ai/
- **Exa.ai**: https://docs.exa.ai/
- **Vultr**: https://www.vultr.com/docs/

For questions or issues, please open a GitHub issue.
