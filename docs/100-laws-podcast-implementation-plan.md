# 100 Laws That Shaped America - Podcast Implementation Plan

## Overview
A daily audio podcast series telling the stories of 100 historic US laws (1900-2000) in an engaging "This American Life" narrative style. Each episode is a 10-12 minute multi-host conversational podcast grounded entirely in verified JSON source data to prevent hallucination.

## Key Differentiators from Daily Brief
| Aspect | Daily Brief | 100 Laws Podcast |
|--------|-------------|------------------|
| Content | Personalized current legislation | Fixed historic law series |
| Style | News briefing format | Narrative storytelling |
| Duration | 5-7 minutes | 10-12 minutes |
| Voices | Arabella & Mark (Kore/Puck) | Different hosts (Aoede/Charon) |
| Generation | On-demand per user | Nightly for all users |
| Image | AI/stock from news | AI-generated per episode |

## Architecture

### Phase 1: Database & Data Import

#### 1.1 Create `historic_laws` table
```sql
CREATE TABLE IF NOT EXISTS historic_laws (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    public_law TEXT,
    president_signed TEXT,
    category TEXT,
    description TEXT,
    key_provisions TEXT, -- JSON array
    historical_impact TEXT,
    episode_generated BOOLEAN DEFAULT FALSE,
    episode_id TEXT, -- FK to podcast_episodes
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_historic_laws_year ON historic_laws(year);
CREATE INDEX IF NOT EXISTS idx_historic_laws_episode ON historic_laws(episode_generated);
```

#### 1.2 Create `podcast_episodes` table
```sql
CREATE TABLE IF NOT EXISTS podcast_episodes (
    id TEXT PRIMARY KEY,
    law_id INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    headline TEXT NOT NULL, -- Engaging episode title
    description TEXT, -- Written summary/transcript
    script TEXT, -- Full dialogue script
    audio_url TEXT,
    audio_duration INTEGER, -- seconds
    thumbnail_url TEXT,
    character_count INTEGER,
    status TEXT DEFAULT 'pending', -- pending, generating, script_ready, completed, failed
    created_at INTEGER NOT NULL,
    published_at INTEGER,
    FOREIGN KEY (law_id) REFERENCES historic_laws(id)
);

CREATE INDEX IF NOT EXISTS idx_podcast_episodes_status ON podcast_episodes(status);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_number ON podcast_episodes(episode_number);
```

#### 1.3 Import JSON data script
Location: `hakivo-api/scripts/import-historic-laws.ts`
- Read JSON from `docs/us_legislation_1900_2000.json`
- Insert 100 records into `historic_laws` table
- Set `episode_generated = FALSE` for all

### Phase 2: Backend Services

#### 2.1 Podcast Generator Service
Location: `hakivo-api/src/podcast-generator/index.ts`

**Core Pipeline:**
1. Fetch next ungenerated law from `historic_laws` (ORDER BY year, id)
2. Generate engaging headline with Claude
3. Generate 10-12 min script with Claude (facts from law data only)
4. Generate unique thumbnail with Gemini Flash 2.5
5. Set status to `script_ready` for audio processing
6. Audio processed by existing audio-processor function
7. Update status to `completed`

**Anti-Hallucination Strategy:**
- Pass ONLY the structured law data to Claude
- Prompt explicitly states: "Use ONLY the facts provided below"
- Include verbatim: name, year, president, key_provisions, historical_impact
- Claude's job: Make it ENGAGING, not make up facts

#### 2.2 Script Generation Prompt
```
You are writing a podcast script for "100 Laws That Shaped America" - a narrative
documentary podcast in the style of This American Life.

YOUR ROLE: You are a STORYTELLER, not a fact-finder. All facts have been verified
and provided below. Your job is to make these facts COMPELLING, not to add new ones.

=== VERIFIED LAW DATA (DO NOT ADD OR CHANGE FACTS) ===
Name: ${law.name}
Year: ${law.year}
Public Law: ${law.public_law}
President: ${law.president_signed}
Category: ${law.category}
Description: ${law.description}
Key Provisions: ${law.key_provisions.join(', ')}
Historical Impact: ${law.historical_impact}

=== YOUR TASK ===
Create a 10-12 minute two-host podcast script that:
1. Opens with a compelling hook (what was America like before this law?)
2. Sets the historical scene (what was happening in ${law.year}?)
3. Explains WHY this law was needed (the problem it solved)
4. Describes the key provisions in plain language
5. Explores the impact (how did it change America?)
6. Connects it to today (does this law still affect us?)

HOSTS: Sarah (lead narrator) and David (color commentary, asks questions)
FORMAT: Every line starts with "SARAH:" or "DAVID:" + [emotional cue] + dialogue
LENGTH: ~2000-2400 words (10-12 minutes when spoken)

FORBIDDEN:
- Making up dates, names, numbers, or events not in the data above
- Claiming specific vote counts unless provided
- Inventing quotes from historical figures
- Adding "facts" from your training data

ALLOWED:
- Describing the general historical context of the era
- Using vivid language and storytelling techniques
- Making reasonable inferences about daily life
- Connecting to broadly known historical events of the era
```

#### 2.3 Different Voice Configuration
```typescript
// Podcast-specific voice pair (different from daily brief)
const PODCAST_VOICES = {
  hostA: 'Aoede',  // Expressive female (vs Kore for daily brief)
  hostB: 'Charon', // Deep male (vs Puck for daily brief)
  names: 'Sarah & David'
};
```

#### 2.4 Thumbnail Generation Prompt
```
Generate an artistic, vintage-inspired image representing the ${law.name} (${law.year}).

The image should evoke ${law.category} themes from the ${getDecade(law.year)} era.
Style: Muted colors, period-appropriate aesthetic, documentary feel.
Include subtle visual elements related to: ${law.description.substring(0, 100)}

Do NOT include any text or words in the image.
```

### Phase 3: API Routes

#### 3.1 `/api/podcast/episodes` (GET)
- List all episodes with pagination
- Filter by status (completed only for public)
- Sort by episode_number or published_at

#### 3.2 `/api/podcast/episodes/[id]` (GET)
- Get single episode with full details
- Include law data for context

#### 3.3 `/api/podcast/latest` (GET)
- Get most recent completed episode
- Used by dashboard widget

### Phase 4: Frontend Components

#### 4.1 Dashboard Widget
Location: `components/widgets/podcast-widget.tsx`

Similar to `daily-brief-widget.tsx`:
- Shows latest episode
- Episode number badge ("Episode 47")
- Engaging headline
- Thumbnail image
- Play/Pause button
- Duration display
- "View All Episodes" link

#### 4.2 Podcast Page
Location: `app/podcast/page.tsx`

Similar to `app/briefs/page.tsx`:
- Grid of all episodes
- Filter by era/decade
- Search by law name
- Episode cards with thumbnails

#### 4.3 Episode Detail Page
Location: `app/podcast/[id]/page.tsx`

- Full episode player
- Written description/transcript
- Law details card
- "Share Episode" functionality
- Related episodes

#### 4.4 Navigation Update
Add to navigation menu alongside Daily Brief

### Phase 5: Scheduled Generation

#### 5.1 Nightly Podcast Generator
Location: `netlify/functions/podcast-generator.ts`

Scheduled function (runs at 2 AM):
1. Check if there's a pending episode to generate
2. If not, pick next law without episode
3. Create episode record with status='pending'
4. Trigger podcast-generator service
5. Audio processor picks up 'script_ready' episodes

### Phase 6: Implementation Order

**Week 1: Foundation**
- [ ] Create database migrations
- [ ] Import historic laws JSON
- [ ] Create podcast-generator service skeleton

**Week 2: Script Generation**
- [ ] Implement Claude script generation
- [ ] Implement headline generation
- [ ] Test anti-hallucination measures

**Week 3: Audio & Images**
- [ ] Configure different voice pair
- [ ] Implement thumbnail generation
- [ ] Test audio pipeline end-to-end

**Week 4: Frontend**
- [ ] Create podcast widget
- [ ] Create /podcast page
- [ ] Create episode detail page
- [ ] Add navigation menu item

**Week 5: Polish**
- [ ] Manual testing
- [ ] Edge cases
- [ ] Deploy scheduler

## File Locations Summary

```
hakivo-api/
├── db/app-db/
│   └── 00XX_podcast_tables.sql
├── scripts/
│   └── import-historic-laws.ts
├── src/
│   └── podcast-generator/
│       ├── index.ts
│       ├── index.test.ts
│       └── raindrop.gen.ts
└── netlify/functions/
    └── podcast-generator.ts

app/
├── api/podcast/
│   ├── episodes/
│   │   ├── route.ts
│   │   └── [id]/route.ts
│   └── latest/route.ts
└── podcast/
    ├── page.tsx
    └── [id]/page.tsx

components/widgets/
└── podcast-widget.tsx
```

## Success Criteria

1. **No Hallucination**: All facts in episodes match source JSON exactly
2. **Engaging Content**: Episodes feel like professional podcast productions
3. **Distinct Identity**: Clearly different from Daily Brief (voices, style, pacing)
4. **Reliable Generation**: One new episode generated every night
5. **User Experience**: Seamless playback, easy discovery, dashboard visibility
