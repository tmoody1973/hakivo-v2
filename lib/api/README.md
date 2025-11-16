# Hakivo API Documentation

Complete API integration documentation for the Hakivo platform.

## Directory Structure

```
lib/
├── api-specs/          # TypeScript type definitions
│   ├── common.types.ts     # Shared types (APIResponse, Error, Pagination)
│   ├── workos.types.ts     # WorkOS authentication types
│   ├── congress.types.ts   # Congress.gov legislative data types
│   ├── geocodio.types.ts   # Geocodio district lookup types
│   ├── claude.types.ts     # Claude script generation types
│   ├── elevenlabs.types.ts # ElevenLabs audio generation types
│   ├── cerebras.types.ts   # Cerebras bill analysis types
│   ├── exa.types.ts        # Exa.ai news search types
│   ├── storage.types.ts    # Vultr S3 storage types
│   └── backend.types.ts    # Custom backend API types
│
└── api/                # API client implementations
    ├── workos.ts           # WorkOS authentication client
    ├── congress.ts         # Congress.gov data client
    ├── geocodio.ts         # Geocodio lookup client
    ├── claude.ts           # Claude script generation client
    ├── elevenlabs.ts       # ElevenLabs audio client
    ├── cerebras.ts         # Cerebras analysis client
    ├── exa.ts              # Exa.ai news search client
    ├── storage.ts          # Vultr storage client
    └── backend.ts          # Custom backend client
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env.local
# Edit .env.local and add your API keys
```

### 3. Import and Use

```typescript
// Authentication
import { login, getCurrentUser } from '@/lib/api/workos';

// Legislative data
import { searchBills, fetchBillById } from '@/lib/api/congress';

// Script generation
import { generateDailyBriefScript } from '@/lib/api/claude';

// Audio generation
import { generateDialogueAudio } from '@/lib/api/elevenlabs';
```

## API Overview

| API | Purpose | Mock Data | Docs |
|-----|---------|-----------|------|
| **WorkOS** | User auth (OAuth, email/password) | ✅ | [workos.ts](./workos.ts) |
| **Congress.gov** | Bills, members, votes | ✅ | [congress.ts](./congress.ts) |
| **Geocodio** | Zip → Congressional district | ✅ | [geocodio.ts](./geocodio.ts) |
| **Claude** | Podcast script generation | ✅ | [claude.ts](./claude.ts) |
| **ElevenLabs** | Text-to-dialogue audio | ✅ | [elevenlabs.ts](./elevenlabs.ts) |
| **Cerebras** | Bill analysis & RAG chat | ✅ | [cerebras.ts](./cerebras.ts) |
| **Exa.ai** | Personalized news search | ✅ | [exa.ts](./exa.ts) |
| **Backend** | User data, tracking, briefs | ✅ | [backend.ts](./backend.ts) |
| **Vultr** | Audio file storage (S3) | ✅ | [storage.ts](./storage.ts) |

## Using Mock Data

All API clients return mock data by default. Every function includes:
- Detailed API documentation comments
- Request/response type definitions
- Full endpoint URLs and headers
- Error response formats
- `// TODO: Replace with actual API call` comments

This allows you to:
1. **Develop the UI** without API keys
2. **See the data structure** that will be returned
3. **Plan integration** by reading the comments
4. **Swap to real APIs** by implementing the TODO sections

## Example: Implementing Real API Calls

### Before (Mock Data):
```typescript
export async function login(data: LoginRequest): Promise<APIResponse<AuthResponse>> {
  // API ENDPOINT: POST https://api.workos.com/user_management/authenticate
  // HEADERS: { ... }
  // REQUEST BODY: { ... }

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      session: MOCK_SESSION,
      user: MOCK_USER,
    },
  };
}
```

### After (Real API):
```typescript
export async function login(data: LoginRequest): Promise<APIResponse<AuthResponse>> {
  try {
    const response = await fetch('https://api.workos.com/user_management/authenticate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WORKOS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.WORKOS_CLIENT_ID,
        client_secret: process.env.WORKOS_API_KEY,
        grant_type: 'password',
        email: data.email,
        password: data.password,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error };
    }

    const authData = await response.json();
    return {
      success: true,
      data: {
        session: {
          accessToken: authData.access_token,
          refreshToken: authData.refresh_token,
          user: authData.user,
          expiresAt: new Date(Date.now() + authData.expires_in * 1000).toISOString(),
        },
        user: authData.user,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
      },
    };
  }
}
```

## Core Workflows

### Daily Brief Generation (7-9 minutes)

```typescript
import { getUserPreferences, getTrackedBills } from '@/lib/api/backend';
import { getPersonalizedNews } from '@/lib/api/exa';
import { fetchBillById } from '@/lib/api/congress';
import { generateDailyBriefScript } from '@/lib/api/claude';
import { generateDialogueAudio } from '@/lib/api/elevenlabs';
import { uploadAudio } from '@/lib/api/storage';

async function generateDailyBrief(userId: string, accessToken: string) {
  // 1. Get user data
  const [prefs, tracked] = await Promise.all([
    getUserPreferences(accessToken),
    getTrackedBills(accessToken),
  ]);

  // 2. Fetch content
  const [news, bills] = await Promise.all([
    getPersonalizedNews(prefs.data.policyInterests, {
      from: yesterday,
      to: today,
    }),
    Promise.all(tracked.data.data.map(b =>
      fetchBillById(b.congress, b.billType, b.billNumber)
    )),
  ]);

  // 3. Generate script
  const script = await generateDailyBriefScript({
    userInterests: prefs.data.policyInterests,
    trackedBills: tracked.data.data.map(b => b.billId),
    newsArticles: news.data.results,
    billUpdates: bills.map(b => b.data),
    date: today,
  });

  // 4. Generate audio
  const audio = await generateDialogueAudio(script.data);

  // 5. Upload
  const upload = await uploadAudio({
    briefId: `daily_${today}`,
    audioData: audio.data.audioData,
    format: 'mp3',
  });

  return upload.data.cdnUrl;
}
```

### RAG Chat with Bills

```typescript
import { chatWithBill } from '@/lib/api/cerebras';
import { searchVectors } from '@/lib/vector-db/pinecone'; // You'll implement this

async function askBillQuestion(billId: string, question: string) {
  // 1. Search vector DB for relevant sections
  const chunks = await searchVectors({
    query: question,
    filter: { billId },
    topK: 5,
  });

  // 2. Call Cerebras with context
  const answer = await chatWithBill({
    question,
    context: {
      chunks: chunks.map(c => c.text),
    },
  });

  return answer.data;
}
```

## Error Handling

All API responses use the `APIResponse<T>` type:

```typescript
import { APIResponse, isAPIError, isAPISuccess } from '@/lib/api-specs/common.types';

const response = await fetchBills();

if (isAPIError(response)) {
  console.error(response.error);
  // Handle error
} else if (isAPISuccess(response)) {
  const bills = response.data.bills;
  // Use data
}
```

## Type Safety

All APIs are fully typed:

```typescript
import { Bill, BillSearchParams } from '@/lib/api-specs/congress.types';

const params: BillSearchParams = {
  congress: 119,
  billType: 'hr',
  limit: 20,
};

const response: APIResponse<BillsResponse> = await fetchBills(params);
```

## Next Steps

1. ✅ Review API documentation in each file
2. ✅ Copy `.env.example` to `.env.local`
3. ⬜ Obtain API keys from providers
4. ⬜ Implement real API calls by replacing `// TODO` sections
5. ⬜ Build backend API endpoints (see `backend.types.ts` for schema)
6. ⬜ Set up vector database for RAG
7. ⬜ Test end-to-end workflows

## Additional Documentation

- **[API Integration Guide](../../docs/API_INTEGRATION_GUIDE.md)** - Complete integration guide with workflows, costs, and testing
- **[Environment Variables](.env.example)** - All required environment variables
- **[Type Definitions](./api-specs/)** - TypeScript type definitions for all APIs

## Support

For questions or issues:
1. Check the detailed comments in each API file
2. Review the [API Integration Guide](../../docs/API_INTEGRATION_GUIDE.md)
3. Consult the official API documentation (links in comments)
4. Open a GitHub issue

---

**Note**: This codebase uses mock data by default to allow frontend development without API keys. Replace the `// TODO` sections with actual API calls when ready to integrate.
