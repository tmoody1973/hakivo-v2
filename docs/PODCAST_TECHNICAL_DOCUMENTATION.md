# Signed Into Law - Podcast Technical Documentation

## About the Podcast

**Signed Into Law** is a daily podcast series from Hakivo that tells the stories of the 100 most consequential pieces of US legislation from 1900 to 2000.

### Podcast Description

> Every law tells a story—of movements that demanded change, crises that forced action, and compromises that shaped a nation.
>
> **Signed Into Law** is a daily podcast from Hakivo, the AI-powered civic engagement platform that turns dense legislative text into clear, listenable audio briefings.
>
> Each episode unpacks one of the 100 most consequential pieces of US legislation from 1900 to 2000: the debates behind them, the provisions within them, and the legacy they left.
>
> From the Antiquities Act to the Americans with Disabilities Act, each episode offers a 10-12 minute deep dive into the laws that shaped the American experience.
>
> Subscribe and start your 100-day civic education journey.

### Key Features

| Feature | Description |
|---------|-------------|
| **Episodes** | 100 total (one per historic law) |
| **Duration** | 10-12 minutes per episode |
| **Format** | Two-host conversational dialogue (Sarah & David) |
| **Style** | Narrative storytelling, "This American Life" inspired |
| **Content** | Written article + audio + transcript per episode |
| **Access** | Publicly accessible (no account required) |

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CONTENT GENERATION                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐    ┌───────────────────┐    ┌──────────────┐ │
│  │ podcast-scheduler│───▶│ podcast-generator │───▶│ claude-client│ │
│  │   (Cron 2AM)     │    │    (Script +      │    │  (AI Text)   │ │
│  └──────────────────┘    │     Article)      │    └──────────────┘ │
│                          └─────────┬─────────┘                      │
│                                    │                                 │
│                                    ▼                                 │
│                          ┌─────────────────┐                        │
│                          │   app-db        │                        │
│                          │ (podcast_episodes│                        │
│                          │  historic_laws)  │                        │
│                          └─────────┬────────┘                        │
│                                    │                                 │
└────────────────────────────────────┼─────────────────────────────────┘
                                     │
┌────────────────────────────────────┼─────────────────────────────────┐
│                        AUDIO GENERATION                              │
├────────────────────────────────────┼─────────────────────────────────┤
│                                    ▼                                 │
│  ┌──────────────────┐    ┌─────────────────┐    ┌────────────────┐  │
│  │audio-retry-sched │───▶│ Netlify Bgnd    │───▶│  Gemini TTS    │  │
│  │  (Cron 5min)     │    │ Function        │    │  API           │  │
│  └──────────────────┘    │ (15min timeout) │    └────────────────┘  │
│                          └─────────┬────────┘                        │
│                                    │                                 │
│                                    ▼                                 │
│                          ┌─────────────────┐                        │
│                          │ vultr-storage   │                        │
│                          │ (MP3 files)     │                        │
│                          └─────────────────┘                        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼─────────────────────────────────┐
│                        API & FRONTEND                                │
├────────────────────────────────────┼─────────────────────────────────┤
│                                    ▼                                 │
│  ┌──────────────────┐    ┌─────────────────┐    ┌────────────────┐  │
│  │ briefs-service   │◀───│ Next.js API     │◀───│  /podcast      │  │
│  │ (Public API)     │    │ Routes          │    │  /podcast/[id] │  │
│  └──────────────────┘    └─────────────────┘    └────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Raindrop Services

### 1. podcast-scheduler (Cron Task)

**Location:** `hakivo-api/src/podcast-scheduler/index.ts`

**Schedule:** Daily at 2 AM UTC (`0 2 * * *`)

**Purpose:** Triggers the podcast-generator service to create the next episode in the series.

**Logic:**
1. Check how many episodes remain (100 - generated count)
2. Verify no episode is currently being generated
3. Call `podcast-generator.generate()` to create next episode

### 2. podcast-generator (Private Service)

**Location:** `hakivo-api/src/podcast-generator/index.ts`

**Purpose:** Generates the script and article content for each episode.

**Process:**
1. Select next ungenerated law from `historic_laws` table (ordered by year)
2. Generate engaging headline using Claude
3. Generate 10-12 minute dialogue script (SARAH:/DAVID: format)
4. Generate 600-900 word written article
5. Create `podcast_episodes` record with `status: 'script_ready'`
6. Mark law as `episode_generated = 1`

**Output Fields:**
- `headline` - Engaging episode title
- `description` - Brief summary
- `script` - Full dialogue script (~2500 characters)
- `content` - Written article for reading

### 3. briefs-service (Public Service)

**Location:** `hakivo-api/src/briefs-service/index.ts`

**Podcast API Endpoints:**

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/podcast` | GET | No | List all episodes |
| `/podcast/:id` | GET | No | Get episode details |
| `/podcast/latest` | GET | No | Get most recent episode |
| `/podcast/stats` | GET | No | Episode statistics |

### 4. claude-client (Private Service)

**Location:** `hakivo-api/src/claude-client/index.ts`

**Purpose:** AI text generation for scripts and articles using Claude API.

### 5. vultr-storage-client (Public Service)

**Location:** `hakivo-api/src/vultr-storage-client/index.ts`

**Purpose:** S3-compatible storage for audio MP3 files.

**File Path Pattern:** `podcast/100-laws/{episodeId}-{timestamp}.mp3`

---

## Audio Processing (Netlify Background Function)

**Location:** `netlify/functions/audio-processor-background.mts`

**Why Netlify instead of Raindrop?**
- Raindrop Tasks have 10-second timeout
- Gemini TTS can take 60-90+ seconds for long scripts
- Netlify Background Functions have 15-minute timeout

### Audio Generation Flow

1. **Trigger:** `audio-retry-scheduler` runs every 5 minutes
2. **Check:** Query for `podcast_episodes` with `status = 'script_ready'`
3. **Process:**
   - Convert SARAH:/DAVID: script to Gemini speaker format (Kore/Puck)
   - Chunk dialogue into ~4000 character segments (Gemini limit)
   - Call Gemini TTS API for each chunk
   - Concatenate PCM audio buffers
   - Convert PCM to MP3 using lamejs (pure JavaScript)
4. **Upload:** Store MP3 in Vultr S3-compatible storage
5. **Update:** Set `status = 'completed'` and `audio_url`

### Voice Configuration

| Speaker | Gemini Voice | Display Name |
|---------|--------------|--------------|
| SARAH | Kore | Sarah |
| DAVID | Puck | David |

---

## Database Schema

### historic_laws Table

```sql
CREATE TABLE historic_laws (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    public_law TEXT,
    president_signed TEXT,
    category TEXT,
    description TEXT,
    key_provisions TEXT,      -- JSON array
    historical_impact TEXT,
    episode_generated BOOLEAN DEFAULT FALSE,
    episode_id TEXT,          -- FK to podcast_episodes
    created_at INTEGER,
    updated_at INTEGER
);
```

### podcast_episodes Table

```sql
CREATE TABLE podcast_episodes (
    id TEXT PRIMARY KEY,
    law_id INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    headline TEXT NOT NULL,
    description TEXT,
    content TEXT,             -- Written article
    script TEXT,              -- Dialogue script
    audio_url TEXT,
    audio_duration INTEGER,   -- Seconds
    thumbnail_url TEXT,
    character_count INTEGER,
    status TEXT,              -- pending, script_ready, audio_processing, completed, audio_failed
    created_at INTEGER,
    updated_at INTEGER,
    published_at INTEGER
);
```

### Episode Status Flow

```
pending → script_ready → audio_processing → completed
                                         ↘ audio_failed
```

---

## Frontend Routes

### Public Pages (No Auth Required)

| Route | Component | Description |
|-------|-----------|-------------|
| `/podcast` | `app/podcast/page.tsx` | Episode listing with NPR-style layout |
| `/podcast/[id]` | `app/podcast/[id]/page.tsx` | Episode detail with player |

### Features

- **Public Header:** Unauthenticated visitors see simplified header with Sign In/Get Started buttons
- **Audio Player:** Integrated with global audio player context
- **Tabs:** Article, About, Provisions, Transcript
- **Progress:** Shows X/100 episodes completed

---

## Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | Netlify Function | Gemini TTS API authentication |
| `ANTHROPIC_API_KEY` | claude-client | Claude API for text generation |
| `VULTR_ENDPOINT` | vultr-storage-client | S3 endpoint (sjc1.vultrobjects.com) |
| `VULTR_ACCESS_KEY` | vultr-storage-client | S3 access key |
| `VULTR_SECRET_KEY` | vultr-storage-client | S3 secret key |
| `VULTR_BUCKET_NAME` | vultr-storage-client | Bucket name (hakivo) |

---

## Manifest Configuration

From `hakivo-api/raindrop.manifest`:

```hcl
# Podcast generator service
service "podcast-generator" {
  visibility = "private"
}

# Podcast scheduler task
task "podcast-scheduler" {
  type = "cron"
  cron = "0 2 * * *"  # Daily at 2 AM UTC
}

# Audio retry scheduler (triggers Netlify function)
task "audio-retry-scheduler" {
  type = "cron"
  cron = "*/5 * * * *"  # Every 5 minutes
}
```

---

## Related Documentation

- [100 Laws Implementation Plan](./100-laws-podcast-implementation-plan.md) - Original implementation plan
- [Database Schema](./database_schema.md) - Full database documentation
- [API Endpoints Specification](./API_ENDPOINTS_SPECIFICATION.md) - Complete API docs
