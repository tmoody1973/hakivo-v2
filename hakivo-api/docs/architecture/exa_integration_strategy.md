# Exa.ai News Search Integration Strategy

## Overview

Exa.ai provides neural search capabilities for discovering relevant news articles based on user policy interests. The system uses semantic keyword queries with domain filtering to find high-quality news coverage of Congressional activity.

## Integration Pattern

### API Configuration

```python
from exa_py import Exa

exa = Exa(api_key=env.EXA_API_KEY)
```

### Search Parameters

```python
result = exa.search_and_contents(
  query,                    # Constructed from policy interest keywords
  category="news",          # News-specific search
  text=True,                # Return full article text
  user_location="US",       # US-based news sources
  type="auto",              # Auto-detect search type
  context=True,             # Include contextual snippets
  exclude_domains=[...]     # Filter out mainstream sources
)
```

## Query Construction by Policy Interest

Each of the 12 policy interests maps to specific search keywords from `policy_interest_mapping.json`:

### Example: Economy & Finance

```python
keywords = ["economy", "inflation", "taxes", "public finance", "financial institutions", "budget", "economic development"]

query = " OR ".join(keywords) + " (news headline OR article OR bill OR legislation OR law OR congress OR act) site:news headline OR site:article"

# Result:
# "economy OR inflation OR taxes OR public finance OR financial institutions OR budget OR economic development (news headline OR article OR bill OR legislation OR law OR congress OR act) site:news headline OR site:article"
```

### Domain Exclusions

Mainstream outlets excluded to surface diverse sources:
- `politico.com`
- `thehill.com`
- `rollcall.com`
- `cnn.com`
- `npr.org`
- `nytimes.com`
- `edweek.org`
- `theguardian.com`

## Response Format

Each search result contains:

```typescript
interface ExaSearchResult {
  id: string;                    // URL (used as unique identifier)
  title: string;                 // Article headline
  url: string;                   // Full article URL
  publishedDate: string;         // ISO 8601 timestamp
  author: string;                // Article author
  text: string;                  // Full article text content
  image?: string;                // Featured image URL
  favicon?: string;              // Source favicon
  crawlDate: string;             // When Exa indexed the article
}
```

### Example Response

```json
{
  "id": "https://www.cnn.com/2025/11/12/business/video/donald-trump-economy-recession-mortgage-inflation-grocery-jake-tapper-lead",
  "title": "Is the U.S. heading for a recession? | CNN Business",
  "url": "https://www.cnn.com/2025/11/12/business/video/donald-trump-economy-recession-mortgage-inflation-grocery-jake-tapper-lead",
  "publishedDate": "2025-11-12T00:00:00.000Z",
  "author": "Camila Moreno-Lizarazo",
  "text": "[Full article text content...]",
  "image": "https://media.cnn.com/api/v1/images/stellar/prod/sorkin.jpg?c=16x9&q=w_800,c_fill",
  "favicon": "https://www.cnn.com/media/sites/cnn/apple-touch-icon.png",
  "crawlDate": "2025-11-14T09:11:55.000Z"
}
```

## Implementation in exa-client Service

```typescript
// src/exa-client/index.ts
import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Exa } from 'exa-js';

export default class ExaClient extends Service<Env> {
  private exa: Exa;

  constructor(ctx: ExecutionContext, env: Env) {
    super(ctx, env);
    this.exa = new Exa(env.EXA_API_KEY);
  }

  async fetch(request: Request): Promise<Response> {
    return new Response('Not Implemented', { status: 501 });
  }

  /**
   * Search news articles for user's policy interests
   * Returns top 5-10 articles from last 24-48 hours
   */
  async searchNews(params: {
    policyInterests: string[];
    dateRange?: { start: string; end: string };
    limit?: number;
  }): Promise<ExaSearchResult[]> {
    const { policyInterests, dateRange, limit = 10 } = params;

    // Load policy interest mapping
    const policyMapping = await this.loadPolicyMapping();

    // Collect all keywords for user's interests
    const allKeywords: string[] = [];
    for (const interest of policyInterests) {
      const mapping = policyMapping.find(m => m.interest === interest);
      if (mapping) {
        allKeywords.push(...mapping.keywords);
      }
    }

    // Build search query
    const keywordQuery = allKeywords.join(' OR ');
    const contextQuery = '(news headline OR article OR bill OR legislation OR law OR congress OR act) site:news headline OR site:article';
    const query = `${keywordQuery} ${contextQuery}`;

    this.env.logger.info('Exa.ai news search', {
      policyInterests,
      keywordCount: allKeywords.length,
      queryLength: query.length
    });

    try {
      // Execute search
      const result = await this.exa.searchAndContents(query, {
        category: 'news',
        text: true,
        userLocation: 'US',
        type: 'auto',
        context: true,
        numResults: limit,
        excludeDomains: [
          'politico.com',
          'thehill.com',
          'rollcall.com',
          'cnn.com',
          'npr.org',
          'nytimes.com',
          'edweek.org',
          'theguardian.com'
        ],
        // Date filtering if provided
        ...(dateRange && {
          startPublishedDate: dateRange.start,
          endPublishedDate: dateRange.end
        })
      });

      // Log usage for cost tracking
      await this.logApiUsage({
        service: 'exa',
        endpoint: 'searchAndContents',
        responseTime: result.responseTime,
        resultsCount: result.results.length,
        cost: this.calculateExaCost(result.results.length)
      });

      return result.results;

    } catch (error) {
      this.env.logger.error(error as Error, {
        service: 'exa',
        operation: 'searchNews',
        policyInterests
      });
      throw error;
    }
  }

  /**
   * Load policy interest to keyword mapping
   */
  private async loadPolicyMapping() {
    // Read from architecture directory or environment
    // For now, return from bundled JSON
    return [
      {
        interest: "Economy & Finance",
        keywords: ["economy", "inflation", "taxes", "public finance", "financial institutions", "budget", "economic development"]
      },
      {
        interest: "Health & Social Welfare",
        keywords: ["healthcare", "insurance", "public health", "welfare", "Medicaid", "mental health", "family services"]
      }
      // ... rest of mappings from policy_interest_mapping.json
    ];
  }

  /**
   * Calculate approximate Exa.ai cost
   * Based on pricing tier
   */
  private calculateExaCost(resultCount: number): number {
    // Example: $0.01 per search result
    return resultCount * 0.01;
  }

  /**
   * Log API usage for cost monitoring
   */
  private async logApiUsage(params: {
    service: string;
    endpoint: string;
    responseTime?: number;
    resultsCount: number;
    cost: number;
  }) {
    await this.env.APP_DB.exec(`
      INSERT INTO api_usage_logs (id, service, endpoint, tokens_used, cost_usd, response_time, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      crypto.randomUUID(),
      params.service,
      params.endpoint,
      params.resultsCount,
      params.cost,
      params.responseTime || 0,
      200,
      Date.now()
    ]);
  }
}

interface ExaSearchResult {
  id: string;
  title: string;
  url: string;
  publishedDate: string;
  author: string;
  text: string;
  image?: string;
  favicon?: string;
  crawlDate: string;
}
```

## Caching Strategy

### Cache Key Construction

```typescript
function buildCacheKey(policyInterests: string[], dateRange: { start: string; end: string }): string {
  const interestsHash = policyInterests.sort().join('|');
  const dateHash = `${dateRange.start}_${dateRange.end}`;
  return `exa:news:${interestsHash}:${dateHash}`;
}
```

### Cache Implementation

```typescript
// Check cache before search
const cacheKey = buildCacheKey(policyInterests, dateRange);
const cached = await env.NEWS_CACHE.get(cacheKey, 'json');

if (cached) {
  env.logger.info('Exa.ai cache hit', { cacheKey });
  return cached;
}

// Execute search
const results = await exaClient.searchNews({ policyInterests, dateRange });

// Store in cache with 6-hour TTL
await env.NEWS_CACHE.put(cacheKey, JSON.stringify(results), {
  expirationTtl: 21600  // 6 hours
});

return results;
```

## Usage in Brief Generator

```typescript
// src/brief-generator/index.ts

async collectNews(userId: string, briefType: 'daily' | 'weekly') {
  // Get user preferences
  const prefs = await this.env.APP_DB.query(`
    SELECT policy_interests FROM user_preferences WHERE user_id = ?
  `, [userId]);

  const policyInterests = JSON.parse(prefs.results[0].policy_interests);

  // Define date range
  const dateRange = briefType === 'daily'
    ? { start: this.getLast24Hours(), end: this.getNow() }
    : { start: this.getLast7Days(), end: this.getNow() };

  // Search with Exa.ai
  const newsArticles = await this.env.EXA_CLIENT.searchNews({
    policyInterests,
    dateRange,
    limit: briefType === 'daily' ? 5 : 10
  });

  this.env.logger.info('News articles collected', {
    userId,
    briefType,
    articleCount: newsArticles.length,
    sources: [...new Set(newsArticles.map(a => new URL(a.url).hostname))]
  });

  return newsArticles;
}
```

## Rate Limiting

Exa.ai typically has usage-based pricing with no hard rate limits, but we implement sensible limits:

- **Max results per search**: 10 articles
- **Cache TTL**: 6 hours (reduces redundant searches)
- **Daily searches per user**: Limited by brief generation frequency

## Cost Estimates

**Assumptions:**
- $0.01 per search result (approximate)
- Daily brief: 5 articles
- Weekly brief: 10 articles
- 30 briefs/month per user

**Monthly Cost Per User:**
- Daily briefs: 20 searches × 5 results × $0.01 = $1.00
- Weekly briefs: 4 searches × 10 results × $0.01 = $0.40
- **Total: ~$1.40/user/month** (lower than initial $0.30 estimate due to caching)

## Error Handling

```typescript
try {
  const results = await exa.searchAndContents(query, options);
  return results;
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // Retry with exponential backoff
    await this.retryWithBackoff(() => exa.searchAndContents(query, options));
  } else if (error.code === 'QUOTA_EXCEEDED') {
    // Fallback: return cached results or empty array
    this.env.logger.warn('Exa.ai quota exceeded, using fallback');
    return [];
  } else {
    throw error;
  }
}
```

## Testing

```typescript
// Test query construction
const testKeywords = ["economy", "inflation", "taxes"];
const query = testKeywords.join(' OR ') + ' (news headline OR article OR bill OR legislation OR law OR congress OR act) site:news headline OR site:article';

console.log(query);
// Output: "economy OR inflation OR taxes (news headline OR article OR bill OR legislation OR law OR congress OR act) site:news headline OR site:article"

// Test with Exa.ai
const results = await exa.searchAndContents(query, {
  category: 'news',
  text: true,
  numResults: 5
});

console.log(`Found ${results.results.length} articles`);
```
