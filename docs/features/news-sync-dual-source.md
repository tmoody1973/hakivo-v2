# News Sync: Dual-Source Strategy (Exa.ai + Perplexity)

## What This Does

The news sync system now fetches news articles from **TWO sources** instead of one:

1. **Exa.ai** - A semantic search engine that finds news articles with built-in images
2. **Perplexity** - An AI-powered search that provides summaries and uses LinkPreview API for images

This means you get **double the news coverage** and fewer gaps in topics like Agriculture & Food.

---

## How It Works (Plain English)

### The Old Way (Before)
```
For each of your 12 interests (Health, Economy, Agriculture, etc.):
  → Ask Exa.ai for 25 articles
  → If Exa doesn't find anything for Agriculture... you get nothing
```

### The New Way (After)
```
For each of your 12 interests:
  → Ask Exa.ai for 15 articles
  → Ask Perplexity for 10 articles
  → Combine them (up to 25 total)
  → Remove duplicates using AI
  → Store the unique articles
```

---

## Why This Matters

### Problem: Some Topics Had No News
- **Agriculture & Food** had 0 articles in the database
- **Foreign Policy & Defense** was missing
- Exa.ai just doesn't cover these topics well

### Solution: Use Multiple Sources
- Perplexity often finds articles Exa misses
- Different sources = better coverage
- AI deduplication removes overlapping articles

---

## The Three Phases

### Phase 1: Fetch Articles
For each of the 12 policy interests:
1. Call Exa.ai with keywords like "farming", "food security", "rural"
2. Call Perplexity with the same interest
3. Combine results from both sources

### Phase 2: Deduplicate
- Group articles by category
- Use AI to find duplicate stories (same news reported by different sources)
- Keep only the best version of each story

### Phase 3: Store
- Insert unique articles into database
- Clean up articles older than 7 days
- Ready for briefs to use

---

## Image Handling

### Exa.ai Articles
- Come with images already (og:image from the source)

### Perplexity Articles
- Don't have reliable images
- We use **LinkPreview API** to fetch the og:image from each article URL
- This ensures every article has an image for the brief

---

## AI Relevance Scoring

### The Problem
Not all articles Perplexity returns are equally relevant. A search for "Agriculture & Food" might return:
- An article directly about farm subsidies (highly relevant)
- An article mentioning food in passing (barely relevant)

### The Solution: AI Scoring
Each Perplexity article gets an **AI relevance score** from 0.0 to 1.0:

| Score | Meaning |
|-------|---------|
| 1.0 | Directly about this topic (main subject) |
| 0.8 | Strongly related (significant coverage) |
| 0.6 | Moderately related (meaningful mention) |
| 0.4 | Tangentially related (brief mention) |
| 0.2 | Barely related (loose connection) |
| 0.0 | Not related at all |

### How It Works
```
For each Perplexity article:
  → AI reads the title and summary
  → AI scores relevance to the interest (e.g., "Agriculture & Food")
  → Article gets a score from 0.0 to 1.0
  → Articles are sorted by score (highest first)
  → Only the most relevant articles make it to briefs
```

### What You See in Logs
```
🎯 [RELEVANCE] High (0.95): "USDA Announces New Farm Subsidy Program..."
📉 [RELEVANCE] Low (0.20): "Celebrity Chef Opens New Restaurant..."
📊 [PERPLEXITY] Scored 15 articles, top score: 0.95
```

### Code: `src/cerebras-client/index.ts`
```typescript
async scoreArticleRelevance(title: string, summary: string, interest: string): Promise<{
  score: number;     // 0.0 - 1.0
  reasoning: string; // Why this score was given
  tokensUsed: number;
}>
```

---

## Schedule

News sync runs **3 times daily**:
- 8:00 AM
- 2:00 PM
- 8:00 PM

Each run fetches fresh news from the last 3 days.

---

## What Changed in the Code

### File: `src/news-sync-scheduler/index.ts`

**Before:**
```typescript
// Only Exa.ai
const results = await exaClient.searchNews(keywords, startDate, endDate, 25);
```

**After:**
```typescript
// Exa.ai (15 articles)
const exaResults = await exaClient.searchNews(keywords, startDate, endDate, 15);

// Perplexity (10 articles)
const perplexityResults = await this.fetchPerplexityNews(interest, keywords);

// Combine both sources
const results = [...exaResults, ...perplexityResults];
```

---

## The 12 Policy Interests

Each of these now gets news from BOTH sources:

| Interest | Keywords |
|----------|----------|
| Environment & Energy | climate, renewables, conservation |
| Health & Social Welfare | healthcare, Medicaid, mental health |
| Economy & Finance | budget, inflation, taxes |
| Education & Science | schools, STEM, research |
| Civil Rights & Law | equality, justice, law enforcement |
| Commerce & Labor | business, jobs, workforce |
| Government & Politics | elections, legislation, representatives |
| Foreign Policy & Defense | military, diplomacy, national security |
| Housing & Urban Development | affordable housing, homelessness, infrastructure |
| **Agriculture & Food** | farming, food security, rural |
| Sports, Arts & Culture | sports, arts, heritage |
| Immigration & Indigenous Issues | immigration, border, tribal affairs |

---

## Troubleshooting

### "No articles for Agriculture & Food"
1. Check if Perplexity API key is set: `PERPLEXITY_API_KEY`
2. Check if LinkPreview API key is set: `LINKPREVIEW_API_KEY`
3. Trigger a manual sync to refresh the database

### "Articles are too old"
- The sync only keeps articles from the last 7 days
- Articles with `published_date` older than 7 days are filtered out
- The brief query now filters by `published_date >= 7 days ago`

### "Duplicate articles showing"
- AI deduplication should catch these
- If duplicates slip through, they're stored once (INSERT OR IGNORE)

---

## API Keys Required

| Key | Purpose |
|-----|---------|
| `EXA_API_KEY` | Exa.ai news search |
| `PERPLEXITY_API_KEY` | Perplexity news search |
| `LINKPREVIEW_API_KEY` | Fetch images for Perplexity articles |
| `CEREBRAS_API_KEY` | AI categorization and deduplication |

---

## Summary

**Before:** Single source (Exa.ai only), missing coverage for some topics

**After:** Dual source (Exa.ai + Perplexity), better coverage, AI deduplication, images for all articles

The result: Your daily briefs now have fresh, relevant news for ALL your policy interests, including Agriculture & Food.
