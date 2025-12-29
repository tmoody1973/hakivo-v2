# Perplexity News Integration for Daily Briefs

## Overview

This feature enhances daily briefs by adding personalized news headlines via Perplexity API, in addition to the legislative bills we already include. Users receive a comprehensive briefing that combines:

1. **Legislative Updates** - Actual federal and state bills
2. **Legislative News** - News coverage about those bills
3. **Policy News** - General news in user's interest areas

## Architecture

### Current Brief Generation Flow

```
Daily Brief Generator (Cloudflare Workers - 60s timeout)
├── Stage 1: Fetch user preferences
├── Stage 2: Fetch federal bills (Congress API)
├── Stage 3: Fetch state bills (OpenStates API)
├── Stage 4: Fetch congressional actions
├── Stage 5: Generate script (Gemini 3 Flash)
├── Stage 6: Generate article (Gemini 3 Flash)
└── Stage 7: Trigger audio processing (Netlify)
```

### Enhanced Flow with Perplexity News

```
Daily Brief Generator
├── Stage 1: Fetch user preferences
├── Stage 2: Fetch federal bills
├── Stage 3: Fetch state bills
├── Stage 4: Fetch congressional actions
├── Stage 4.5: Fetch news headlines (NEW)
│   ├── Federal legislation news
│   ├── State legislation news (user's state)
│   ├── Policy news (user interests)
│   └── Deduplicate against recent news
├── Stage 5: Generate script (with news JSON)
├── Stage 6: Generate article (with news JSON)
└── Stage 7: Trigger audio processing
```

## News Categories

### 1. Federal Legislation News

**Purpose:** News articles about Congressional activity, bill debates, votes

**Perplexity Query:**
```typescript
const federalLegislationNews = await perplexity.search({
  query: "US Congress latest bills federal legislation news 2025",
  maxResults: 3,
  recency: "day" // Last 24 hours
});
```

**Example Results:**
- "Senate Passes Medicare Expansion Bill H.R. 1234"
- "House Debates Student Loan Relief Legislation"
- "Congressional Budget Committee Approves Infrastructure Bill"

### 2. State Legislation News

**Purpose:** News about state legislative activity in user's state

**Perplexity Query:**
```typescript
// For Wisconsin user
const stateLegislationNews = await perplexity.search({
  query: `${userState} state legislature latest bills news 2025`,
  maxResults: 3,
  recency: "day"
});
```

**Example Results:**
- "Wisconsin Assembly Passes Worker Ownership Bill AB 662"
- "State Senate Debates Education Funding SB 21"
- "Governor Signs Healthcare Expansion Bill AB 564"

### 3. Policy Topic News

**Purpose:** General policy news based on user's specific interests

**Perplexity Query:**
```typescript
// User interested in healthcare, education
const policyNews = [];
for (const interest of userInterests) {
  const news = await perplexity.search({
    query: `latest ${interest} policy news United States`,
    maxResults: 2,
    recency: "day"
  });
  policyNews.push(...news);
}
```

**Example Results:**
- "Medicare Announces Coverage Expansion for Mental Health"
- "Department of Education Releases New Student Loan Guidelines"
- "CDC Updates Public Health Recommendations"

## Deduplication Strategy

### Problem

Without deduplication, users would see the same news stories across multiple briefs:
- Dec 28 brief: "Senate passes H.R. 1234"
- Dec 29 brief: "Senate passes H.R. 1234" ← Duplicate!
- Dec 30 brief: "Senate passes H.R. 1234" ← Duplicate!

### Solution: News Cache Table

**Schema:**
```sql
CREATE TABLE news_cache (
  user_id TEXT NOT NULL,
  news_url TEXT NOT NULL,
  headline TEXT,
  category TEXT, -- 'federal_legislation', 'state_legislation', 'policy'
  included_at INTEGER NOT NULL, -- Unix timestamp
  brief_id TEXT,
  PRIMARY KEY (user_id, news_url)
);

CREATE INDEX idx_news_cache_user_date ON news_cache(user_id, included_at);
CREATE INDEX idx_news_cache_cleanup ON news_cache(included_at);
```

**Deduplication Logic:**
```typescript
async function deduplicateNews(
  userId: string,
  newsItems: NewsItem[],
  lookbackDays: number = 7
): Promise<NewsItem[]> {
  const cutoffTime = Date.now() - (lookbackDays * 24 * 60 * 60 * 1000);

  // Get recently used news URLs for this user
  const recentNewsUrls = await db.query(
    `SELECT news_url FROM news_cache
     WHERE user_id = ? AND included_at > ?`,
    [userId, cutoffTime]
  );

  const usedUrls = new Set(recentNewsUrls.map(r => r.news_url));

  // Filter out duplicates
  return newsItems.filter(item => !usedUrls.has(item.url));
}
```

**Cache Cleanup:**
```typescript
// Run daily via scheduler
async function cleanupOldNewsCache() {
  const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
  await db.query(
    `DELETE FROM news_cache WHERE included_at < ?`,
    [cutoffTime]
  );
}
```

## News JSON Structure

**Format passed to Gemini for script/article generation:**

```json
{
  "date_generated": "2025-12-29T15:30:00Z",
  "user_state": "Wisconsin",
  "categories": {
    "federal_legislation": [
      {
        "headline": "Senate Passes Medicare Expansion Bill H.R. 1234",
        "summary": "The Senate voted 65-35 to pass sweeping Medicare reforms that would expand coverage to dental and vision care for 12 million seniors...",
        "url": "https://apnews.com/article/senate-medicare-expansion-12345",
        "source": "Associated Press",
        "date": "2025-12-29T10:15:00Z"
      }
    ],
    "state_legislation": [
      {
        "headline": "Wisconsin Assembly Approves Worker Ownership Bill",
        "summary": "The Wisconsin State Assembly passed AB 662 with bipartisan support, creating tax incentives for employee-owned businesses...",
        "url": "https://www.jsonline.com/story/news/ab662-worker-ownership",
        "source": "Milwaukee Journal Sentinel",
        "date": "2025-12-29T09:00:00Z"
      }
    ],
    "policy_news": {
      "healthcare": [
        {
          "headline": "CDC Updates COVID-19 Vaccination Guidelines",
          "summary": "The Centers for Disease Control issued new recommendations for booster shots targeting vulnerable populations...",
          "url": "https://www.reuters.com/health/cdc-updates-covid-guidelines",
          "source": "Reuters",
          "date": "2025-12-29T08:30:00Z"
        }
      ],
      "education": [
        {
          "headline": "Education Department Expands Student Loan Forgiveness",
          "summary": "The Department of Education announced expanded eligibility for Public Service Loan Forgiveness affecting 200,000 borrowers...",
          "url": "https://www.npr.org/education/student-loan-forgiveness",
          "source": "NPR",
          "date": "2025-12-28T16:45:00Z"
        }
      ]
    }
  },
  "total_items": 12,
  "deduplication_stats": {
    "total_fetched": 18,
    "duplicates_removed": 6,
    "new_items_included": 12
  }
}
```

## Prompt Updates

### Script Generation Prompt (Stage 5)

**Current:** Generates script from legislation only

**Enhanced:**
```typescript
const systemPrompt = `You are creating a daily news briefing for ${userName}.

This briefing has TWO main sections:

1. FEATURED LEGISLATION
   - Federal bills: ${federalBills.map(b => b.billNumber).join(', ')}
   - State bills: ${stateBills.map(b => b.billNumber).join(', ')}
   - Integrate these bills into the narrative (not list format)
   - Explain what each bill does and why it matters to ${userState} residents

2. LATEST HEADLINES
   - Use the following news JSON:
   ${JSON.stringify(newsJSON, null, 2)}

   - Structure the news section by category:
     * Federal Legislation News (news ABOUT Congressional bills)
     * State Legislation News (news ABOUT ${userState} bills)
     * Policy Updates (healthcare, education, etc.)

   - For each news item:
     * Use headline as basis for spoken segment
     * Expand using summary
     * Latest news first (already sorted by date)
     * Combine related items into single paragraph for flow

SCRIPT STRUCTURE:
- Opening teaser (1 sentence mentioning legislation + top headline)
- Brief intro with date
- Legislation section (2-3 minutes)
- News headlines section (2-3 minutes)
- Closing invitation to check back tomorrow

STYLE:
- Conversational dialogue between ${hostA} and ${hostB}
- Public radio tone: neutral, informative, calm
- Use emotional cues like [warmly], [concerned], [hopeful]
- Smooth transitions between sections
- Total length: 5-7 minutes (roughly 750-1000 words)

OUTPUT FORMAT:
HEADLINE: [extracted headline for brief title]

SCRIPT:
${hostA.toUpperCase()}: [dialogue...]
${hostB.toUpperCase()}: [dialogue...]
...`;
```

### Article Generation Prompt (Stage 6)

**Enhanced:**
```typescript
const systemPrompt = `Write a comprehensive news article for ${userName}'s daily brief.

CONTENT TO INCLUDE:

1. Featured Legislation (opening section)
   - Federal bills: ${federalBills.map(b => `[${b.billNumber}](${b.url})`).join(', ')}
   - State bills: ${stateBills.map(b => `[${b.billNumber}](${b.url})`).join(', ')}
   - Integrate into narrative, explain impact on ${userState}

2. Latest Headlines (separate sections)
   Use this news JSON:
   ${JSON.stringify(newsJSON, null, 2)}

   Create subsections:
   ## Federal Legislation Update
   [Discuss federal legislation news with hyperlinked sources]

   ## ${userState} State Legislature
   [Discuss state legislation news with hyperlinked sources]

   ## Policy Updates
   ### Healthcare
   [Healthcare news with sources]

   ### Education
   [Education news with sources]

REQUIREMENTS:
- Hyperlink ALL sources: [Headline](url) or "According to [Source](url)..."
- Minimum 7 total citations across all sections
- For personal quotes: "Quote," [Person told Source](url), "more quote"
- NPR-style narrative structure with rich, atmospheric writing
- Total length: 800-1200 words
- End with empowering note about staying informed

CRITICAL:
- NO markdown formatting in headlines (no **, __, *, _)
- Every factual claim must cite source
- Explain technical terms in simple language`;
```

## Implementation Steps

### Phase 1: Database Schema (10 min)

**File:** `/hakivo-api/db/app-db/migrations/006_news_cache.sql`

```sql
-- News cache for deduplication
CREATE TABLE IF NOT EXISTS news_cache (
  user_id TEXT NOT NULL,
  news_url TEXT NOT NULL,
  headline TEXT,
  category TEXT,
  included_at INTEGER NOT NULL,
  brief_id TEXT,
  PRIMARY KEY (user_id, news_url)
);

CREATE INDEX IF NOT EXISTS idx_news_cache_user_date
  ON news_cache(user_id, included_at);

CREATE INDEX IF NOT EXISTS idx_news_cache_cleanup
  ON news_cache(included_at);
```

### Phase 2: News Fetching Functions (30 min)

**File:** `/hakivo-api/src/brief-generator/index.ts`

**Add helper functions:**

```typescript
/**
 * Fetch news headlines via Perplexity API
 */
async fetchNewsHeadlines(
  userId: string,
  userState: string,
  userInterests: string[]
): Promise<NewsJSON> {
  const newsItems: NewsItem[] = [];

  // 1. Federal legislation news
  const federalNews = await this.env.PERPLEXITY_CLIENT.search({
    query: "US Congress latest bills federal legislation news 2025",
    maxResults: 3,
    recency: "day"
  });
  newsItems.push(...federalNews.map(n => ({...n, category: 'federal_legislation'})));

  // 2. State legislation news
  const stateNews = await this.env.PERPLEXITY_CLIENT.search({
    query: `${userState} state legislature latest bills news 2025`,
    maxResults: 3,
    recency: "day"
  });
  newsItems.push(...stateNews.map(n => ({...n, category: 'state_legislation'})));

  // 3. Policy news by interest
  for (const interest of userInterests) {
    const policyNews = await this.env.PERPLEXITY_CLIENT.search({
      query: `latest ${interest} policy news United States`,
      maxResults: 2,
      recency: "day"
    });
    newsItems.push(...policyNews.map(n => ({...n, category: `policy_${interest}`})));
  }

  // 4. Deduplicate
  const totalFetched = newsItems.length;
  const deduplicatedNews = await this.deduplicateNews(userId, newsItems);

  // 5. Structure as JSON
  return this.structureNewsJSON(userState, deduplicatedNews, totalFetched);
}

/**
 * Deduplicate news against recent briefs
 */
async deduplicateNews(
  userId: string,
  newsItems: NewsItem[],
  lookbackDays: number = 7
): Promise<NewsItem[]> {
  const cutoffTime = Date.now() - (lookbackDays * 24 * 60 * 60 * 1000);

  const recentUrls = await this.env.APP_DB.prepare(
    `SELECT news_url FROM news_cache
     WHERE user_id = ? AND included_at > ?`
  ).bind(userId, cutoffTime).all();

  const usedUrls = new Set(recentUrls.results.map(r => r.news_url));

  return newsItems.filter(item => !usedUrls.has(item.url));
}

/**
 * Structure news into JSON format for prompts
 */
structureNewsJSON(
  userState: string,
  newsItems: NewsItem[],
  totalFetched: number
): NewsJSON {
  const structured: NewsJSON = {
    date_generated: new Date().toISOString(),
    user_state: userState,
    categories: {
      federal_legislation: [],
      state_legislation: [],
      policy_news: {}
    },
    total_items: newsItems.length,
    deduplication_stats: {
      total_fetched: totalFetched,
      duplicates_removed: totalFetched - newsItems.length,
      new_items_included: newsItems.length
    }
  };

  for (const item of newsItems) {
    if (item.category === 'federal_legislation') {
      structured.categories.federal_legislation.push(item);
    } else if (item.category === 'state_legislation') {
      structured.categories.state_legislation.push(item);
    } else if (item.category.startsWith('policy_')) {
      const topic = item.category.replace('policy_', '');
      if (!structured.categories.policy_news[topic]) {
        structured.categories.policy_news[topic] = [];
      }
      structured.categories.policy_news[topic].push(item);
    }
  }

  return structured;
}

/**
 * Save news URLs to cache after brief generation
 */
async saveNewsToCache(
  userId: string,
  briefId: string,
  newsJSON: NewsJSON
): Promise<void> {
  const now = Date.now();

  for (const category of Object.keys(newsJSON.categories)) {
    const items = category === 'policy_news'
      ? Object.values(newsJSON.categories[category]).flat()
      : newsJSON.categories[category];

    for (const item of items) {
      await this.env.APP_DB.prepare(
        `INSERT OR IGNORE INTO news_cache
         (user_id, news_url, headline, category, included_at, brief_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(userId, item.url, item.headline, category, now, briefId).run();
    }
  }
}
```

### Phase 3: Integration into Brief Generator (20 min)

**Update main process() method:**

```typescript
async process(message: Message<Body>): Promise<void> {
  const { briefId, userId, type, startDate, endDate } = message.body;

  try {
    // ... existing stages 1-4 ...

    // Stage 4.5: Fetch news headlines (NEW)
    console.log('Stage 4.5: Fetching news headlines via Perplexity...');
    const newsJSON = await this.fetchNewsHeadlines(
      userId,
      userPrefs.state || 'United States',
      userPrefs.interests
    );
    console.log(`✓ Fetched ${newsJSON.total_items} news items (${newsJSON.deduplication_stats.duplicates_removed} duplicates removed)`);

    // Stage 5: Generate script (with news)
    const { script, headline } = await this.generateScript(
      type,
      federalBills,
      stateBills,
      newsJSON, // Pass news JSON
      userPrefs
    );

    // Stage 6: Generate article (with news)
    const { article } = await this.generateArticle(
      headline,
      federalBills,
      stateBills,
      newsJSON, // Pass news JSON
      userPrefs
    );

    // Save news to cache for deduplication
    await this.saveNewsToCache(userId, briefId, newsJSON);

    // ... rest of stages ...
  } catch (error) {
    // ... error handling ...
  }
}
```

### Phase 4: Update Prompts (40 min)

Update both `generateScript()` and `generateArticle()` functions to include news JSON in their prompts (see "Prompt Updates" section above).

### Phase 5: Testing (30 min)

**Test cases:**

1. **Basic functionality**
   - Generate brief for user with interests: healthcare, education
   - Verify news JSON includes all 3 categories
   - Check script and article include news sections

2. **Deduplication**
   - Generate brief on Dec 29
   - Generate another brief on Dec 29 (should have different news)
   - Generate brief on Dec 30 (should exclude Dec 29 news)

3. **State-specific news**
   - Generate brief for Wisconsin user
   - Verify state news is Wisconsin-specific
   - Generate brief for California user
   - Verify state news is California-specific

4. **Error handling**
   - Perplexity API failure (should gracefully continue without news)
   - Empty news results (should log warning, continue)
   - Deduplication failure (should include all news as fallback)

## Deployment

### Raindrop Deployment (Brief Generator)

```bash
# Build and deploy with amend flag
cd hakivo-api
npx raindrop build deploy -a -s -v 01kc6cdq5pf8xw0wg8qhc11wnc

# Verify convergence
npx raindrop build find | grep -A 2 "brief-generator"
# Should show: Status: converged at [recent timestamp]
```

### Database Migration

```bash
# Run migration
npx wrangler d1 execute app-db --file=db/app-db/migrations/006_news_cache.sql --env=production
```

## Monitoring & Metrics

**Key metrics to track:**

1. **News fetch success rate**
   - How often Perplexity API succeeds vs fails
   - Average news items per brief

2. **Deduplication effectiveness**
   - Average duplicates removed per brief
   - Percentage of fresh news vs duplicates

3. **User engagement**
   - Do briefs with news have higher listen-through rates?
   - Are news sections being read/heard?

4. **Performance impact**
   - Additional latency from Perplexity calls
   - Brief generation time before vs after

**Logging:**

```typescript
console.log(`[NEWS] Fetched ${totalItems} items, removed ${duplicates} duplicates`);
console.log(`[NEWS] Categories: federal=${federalCount}, state=${stateCount}, policy=${policyCount}`);
console.log(`[NEWS] Perplexity API latency: ${latencyMs}ms`);
```

## Cost Analysis

**Perplexity API costs:**
- Sonar Pro: $5/1000 requests
- Estimate: 12 users × 7 searches per brief × 30 days = 2,520 searches/month
- Cost: ~$12.60/month

**Total estimated costs:**
- Brief generation (Gemini 3 Flash): ~$0.72/month
- Audio (Gemini Pro TTS): ~$5/month (with dedicated key)
- News (Perplexity Sonar): ~$12.60/month
- **Total: ~$18.32/month** (vs $38/month with Claude)

## Future Enhancements

1. **News preferences**
   - Let users opt-in/out of specific news categories
   - Adjust news-to-legislation ratio per user

2. **Smart deduplication**
   - If same story appears from multiple sources, keep only highest-quality source
   - Track "story clusters" not just URLs

3. **Trending topics**
   - Identify what's trending across all users
   - Boost trending stories in relevance

4. **Local news**
   - Add city/county-level news based on user ZIP code
   - Include local government news (mayor, city council)

5. **News quality scoring**
   - Prioritize news from trusted sources (AP, Reuters, etc.)
   - Filter out low-quality or duplicate content

## Troubleshooting

### News not appearing in briefs

**Check:**
1. Perplexity API key configured: `echo $PERPLEXITY_API_KEY`
2. News fetch logs: Look for `[NEWS]` prefix in brief-generator logs
3. Deduplication too aggressive: Check `news_cache` table size

### Duplicate news across briefs

**Check:**
1. `news_cache` table has entries: `SELECT COUNT(*) FROM news_cache`
2. Deduplication function being called
3. `saveNewsToCache()` being called after generation

### Perplexity quota exceeded

**Solution:**
- Reduce `maxResults` per query (3 → 2)
- Increase `lookbackDays` for deduplication (7 → 10)
- Batch searches to reduce API calls

### News quality issues

**Solution:**
- Add source filtering in Perplexity queries
- Adjust recency parameter (`day` vs `week`)
- Implement manual blocklist for low-quality sources

## References

- [Perplexity API Documentation](https://docs.perplexity.ai/)
- [Gemini 3 Flash Documentation](https://ai.google.dev/gemini-api/docs/models/gemini)
- [Brief Generation System Architecture](../CLAUDE.md#brief-generation-system-architecture)

---

**Last Updated:** December 29, 2025
**Author:** Claude Code
**Status:** Ready for Implementation
