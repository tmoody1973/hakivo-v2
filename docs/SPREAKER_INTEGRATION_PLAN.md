# Spreaker Integration Plan

## Overview

Integrate Spreaker podcast distribution to automatically upload "Signed Into Law" episodes. This includes backfilling the existing 9 episodes and auto-uploading future episodes.

## Authentication Flow

Spreaker uses OAuth2 with a **one-time** interactive login, then server-to-server token refresh:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ONE-TIME SETUP (Manual)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Admin visits: /api/spreaker/auth                                │
│                          │                                           │
│                          ▼                                           │
│  2. Redirect to Spreaker login dialog                               │
│     https://www.spreaker.com/oauth2/authorize                       │
│                          │                                           │
│                          ▼                                           │
│  3. User authorizes app → Spreaker redirects with code              │
│     YOUR_REDIRECT_URI?code=OAUTH2_CODE&state=...                    │
│                          │                                           │
│                          ▼                                           │
│  4. Exchange code for tokens (server-to-server)                     │
│     POST https://api.spreaker.com/oauth2/token                      │
│                          │                                           │
│                          ▼                                           │
│  5. Store access_token + refresh_token in KV cache                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                   ONGOING (Automated)                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Token expired? → Refresh automatically                             │
│  POST https://api.spreaker.com/oauth2/token                         │
│  grant_type=refresh_token                                           │
│                                                                      │
│  Upload episode → Use Bearer token                                  │
│  POST https://api.spreaker.com/v2/shows/{SHOW_ID}/episodes          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Phase 1: Raindrop Service Setup

#### 1.1 Add Environment Variables to Manifest

```hcl
# Add to raindrop.manifest
env "SPREAKER_CLIENT_ID" {
  secret = true
}

env "SPREAKER_CLIENT_SECRET" {
  secret = true
}

env "SPREAKER_SHOW_ID" {
  secret = true
}

env "SPREAKER_REDIRECT_URI" {
  secret = true
}
```

#### 1.2 Create spreaker-client Service

**Location:** `hakivo-api/src/spreaker-client/index.ts`

```typescript
// Service methods:
// - initiateAuth() → Returns authorization URL
// - exchangeCode(code) → Exchange code for tokens, store in KV
// - refreshToken() → Refresh expired token
// - uploadEpisode(episodeData) → Upload episode to Spreaker
// - getAuthStatus() → Check if tokens are valid
```

#### 1.3 Add KV Cache for Token Storage

```hcl
# Add to raindrop.manifest
kv_cache "spreaker-tokens" {}
```

**Stored Keys:**
- `spreaker_access_token` - Current access token
- `spreaker_refresh_token` - Refresh token (long-lived)
- `spreaker_token_expires` - Expiration timestamp

---

### Phase 2: OAuth Flow Implementation

#### 2.1 Auth Initiation Endpoint

**Endpoint:** `GET /spreaker/auth`

```typescript
// Generate state for CSRF protection
// Store state in KV with short TTL
// Redirect to:
// https://www.spreaker.com/oauth2/authorize?
//   client_id={CLIENT_ID}&
//   response_type=code&
//   redirect_uri={REDIRECT_URI}&
//   scope=basic&
//   state={STATE}
```

#### 2.2 OAuth Callback Endpoint

**Endpoint:** `GET /spreaker/callback`

```typescript
// Verify state matches stored value
// Exchange code for tokens:
// POST https://api.spreaker.com/oauth2/token
// {
//   grant_type: 'authorization_code',
//   client_id: CLIENT_ID,
//   client_secret: CLIENT_SECRET,
//   redirect_uri: REDIRECT_URI,
//   code: CODE
// }
// Store tokens in KV cache
// Return success page
```

#### 2.3 Token Refresh Logic

```typescript
async function getValidToken(): Promise<string> {
  const accessToken = await kv.get('spreaker_access_token');
  const expiresAt = await kv.get('spreaker_token_expires');

  // Check if token expires within 5 minutes
  if (Date.now() > parseInt(expiresAt) - 300000) {
    return await refreshToken();
  }

  return accessToken;
}

async function refreshToken(): Promise<string> {
  const refreshToken = await kv.get('spreaker_refresh_token');

  const response = await fetch('https://api.spreaker.com/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken
    })
  });

  const data = await response.json();
  // Store new tokens
  await storeTokens(data);
  return data.access_token;
}
```

---

### Phase 3: Episode Upload

#### 3.1 Upload Episode Method

**Endpoint:** `POST /spreaker/upload/:episodeId`

```typescript
async function uploadEpisode(episodeId: string): Promise<SpeakerEpisodeResponse> {
  // 1. Get episode from database
  const episode = await getEpisodeById(episodeId);

  // 2. Generate Spreaker-optimized metadata using Claude
  const metadata = await generateSpeakerMetadata(episode);

  // 3. Fetch audio file from Vultr
  const audioBuffer = await fetchAudioFromVultr(episode.audio_url);

  // 4. Get valid Spreaker token
  const token = await getValidToken();

  // 5. Upload to Spreaker
  const formData = new FormData();
  formData.append('title', metadata.title);           // Max 140 chars
  formData.append('description', metadata.description);
  formData.append('tags', metadata.tags);             // Comma-separated
  formData.append('episode_number', episode.episode_number.toString());
  formData.append('media_file', audioBuffer, `episode-${episode.episode_number}.mp3`);
  formData.append('download_enabled', 'true');
  formData.append('visibility', 'PUBLIC');

  // Optional: Upload thumbnail
  if (episode.thumbnail_url) {
    const imageBuffer = await fetchImage(episode.thumbnail_url);
    formData.append('image_file', imageBuffer, 'thumbnail.png');
  }

  const response = await fetch(
    `https://api.spreaker.com/v2/shows/${SHOW_ID}/episodes`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    }
  );

  // 6. Store Spreaker episode ID in database
  const result = await response.json();
  await updateEpisodeWithSpreakerData(episodeId, result);

  return result;
}
```

#### 3.2 AI-Optimized Metadata Generation

```typescript
async function generateSpeakerMetadata(episode: PodcastEpisode): Promise<SpeakerMetadata> {
  const prompt = `Generate Spreaker podcast metadata for this episode:

Episode: ${episode.episodeNumber} - ${episode.headline}
Law: ${episode.law.name} (${episode.law.year})
Description: ${episode.description}

Generate:
1. title (max 140 chars, engaging, include episode number)
2. description (2-3 paragraphs, podcast platform optimized, include call to action)
3. tags (10-15 comma-separated keywords for discoverability)

Format as JSON: { "title": "...", "description": "...", "tags": "..." }`;

  const result = await claudeClient.generateCompletion(systemPrompt, prompt);
  return JSON.parse(result.content);
}
```

---

### Phase 4: Database Schema Updates

#### 4.1 Add Spreaker Fields to podcast_episodes

```sql
ALTER TABLE podcast_episodes ADD COLUMN spreaker_episode_id TEXT;
ALTER TABLE podcast_episodes ADD COLUMN spreaker_url TEXT;
ALTER TABLE podcast_episodes ADD COLUMN spreaker_uploaded_at INTEGER;
```

---

### Phase 5: Backfill Existing Episodes

#### 5.1 Backfill Endpoint

**Endpoint:** `POST /spreaker/backfill`

```typescript
// Upload all completed episodes to Spreaker in order
async function backfillEpisodes(): Promise<BackfillResult> {
  const episodes = await db.prepare(`
    SELECT * FROM podcast_episodes
    WHERE status = 'completed'
      AND spreaker_episode_id IS NULL
    ORDER BY episode_number ASC
  `).all();

  const results = [];
  for (const episode of episodes) {
    try {
      // Add delay between uploads to avoid rate limiting
      await sleep(5000);

      const result = await uploadEpisode(episode.id);
      results.push({ episodeId: episode.id, success: true, spreakerId: result.episode_id });
    } catch (error) {
      results.push({ episodeId: episode.id, success: false, error: error.message });
    }
  }

  return { total: episodes.length, results };
}
```

---

### Phase 6: Auto-Upload Integration

#### 6.1 Modify Audio Processor

After audio generation completes successfully, trigger Spreaker upload:

```typescript
// In audio-processor-background.mts
// After: await updatePodcastStatus(episode.id, 'completed', audioUrl);
// Add:
try {
  await triggerSpeakerUpload(episode.id);
} catch (error) {
  console.error('[AUDIO] Spreaker upload failed (non-blocking):', error);
}
```

#### 6.2 Alternative: Spreaker Upload Scheduler

Create a scheduled task that checks for completed episodes not yet uploaded:

```hcl
# Add to raindrop.manifest
task "spreaker-upload-scheduler" {
  type = "cron"
  cron = "0 4 * * *"  # Daily at 4 AM (after podcast generation at 2 AM)
}
```

---

## File Structure

```
hakivo-api/src/
├── spreaker-client/
│   ├── index.ts          # Main service with all methods
│   └── raindrop.gen.ts   # Generated types
├── spreaker-upload-scheduler/  # Optional: auto-upload cron
│   ├── index.ts
│   └── raindrop.gen.ts
```

---

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `SPREAKER_CLIENT_ID` | OAuth2 application ID |
| `SPREAKER_CLIENT_SECRET` | OAuth2 application secret |
| `SPREAKER_SHOW_ID` | Target show ID for uploads |
| `SPREAKER_REDIRECT_URI` | OAuth callback URL (e.g., `https://api.hakivo.com/spreaker/callback`) |

---

## Implementation Order

1. [ ] Add env variables to `raindrop.manifest`
2. [ ] Create `spreaker-tokens` KV cache in manifest
3. [ ] Add `spreaker_*` columns to `podcast_episodes` table
4. [ ] Create `spreaker-client` service with OAuth flow
5. [ ] Test OAuth flow manually (one-time auth)
6. [ ] Implement episode upload with AI metadata
7. [ ] Run backfill for 9 existing episodes
8. [ ] Add auto-upload integration (scheduler or hook)
9. [ ] Update documentation

---

## API Endpoints Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/spreaker/auth` | GET | Admin | Initiate OAuth flow |
| `/spreaker/callback` | GET | None | OAuth callback (receives code) |
| `/spreaker/status` | GET | Admin | Check token status |
| `/spreaker/upload/:id` | POST | Admin | Upload single episode |
| `/spreaker/backfill` | POST | Admin | Upload all pending episodes |

---

## Notes

- **Rate Limiting**: Add 5-second delay between uploads during backfill
- **Error Handling**: Spreaker upload failures should not block podcast generation
- **Monitoring**: Log all upload attempts for debugging
- **Thumbnail**: Use static podcast artwork (`/podcast-hakivo.png`) for consistent branding
