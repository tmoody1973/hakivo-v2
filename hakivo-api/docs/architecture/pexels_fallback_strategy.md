# Pexels API Fallback Strategy for News Images

## Overview

When Exa.ai search results don't include an `image` field, we fallback to Pexels API to find relevant stock images. The system implements three-tier deduplication to ensure no duplicate images across news articles.

## Deduplication Strategy

### Tier 1: URL Tracking
- Store all used Pexels image URLs in `image-cache` KV
- Key: `pexels:used:{image_id}`
- TTL: 7 days (allow reuse after cooldown)
- Prevents exact same image from being used twice

### Tier 2: Brief-Level Uniqueness
- Track images used within the same brief generation
- In-memory set during brief-generator execution
- Ensures articles in the same brief have unique images

### Tier 3: Query Diversification
- Extract different keywords from article title for Pexels search
- Use policy area tags as search terms
- Rotate through search strategies (title keywords → policy tags → general fallback)

## Pexels API Integration

### API Configuration

```typescript
import { createClient } from 'pexels';

const pexels = createClient(env.PEXELS_API_KEY);
```

### Search Parameters

```typescript
const result = await pexels.photos.search({
  query,           // Article keywords or policy area
  per_page: 15,    // Get multiple options for deduplication
  orientation: 'landscape',  // Better for news article headers
  size: 'large'    // High quality images
});
```

### Response Format

```typescript
interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;              // Pexels page URL
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  avg_color: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  liked: boolean;
  alt: string;
}
```

## Implementation in exa-client Service

```typescript
// src/exa-client/index.ts
import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Exa } from 'exa-js';
import { createClient } from 'pexels';

export default class ExaClient extends Service<Env> {
  private exa: Exa;
  private pexels: any;
  private usedImagesInBrief: Set<number> = new Set();

  constructor(ctx: ExecutionContext, env: Env) {
    super(ctx, env);
    this.exa = new Exa(env.EXA_API_KEY);
    this.pexels = createClient(env.PEXELS_API_KEY);
  }

  /**
   * Search news with image fallback
   */
  async searchNewsWithImages(params: {
    policyInterests: string[];
    dateRange?: { start: string; end: string };
    limit?: number;
  }): Promise<ExaSearchResultWithImage[]> {
    const { policyInterests, dateRange, limit = 10 } = params;

    // Reset in-brief image tracking
    this.usedImagesInBrief = new Set();

    // Execute Exa.ai search
    const newsArticles = await this.searchNews({ policyInterests, dateRange, limit });

    // Process each article for images
    const articlesWithImages = await Promise.all(
      newsArticles.map(article => this.ensureArticleHasImage(article, policyInterests))
    );

    return articlesWithImages;
  }

  /**
   * Ensure article has an image (Exa.ai or Pexels fallback)
   */
  private async ensureArticleHasImage(
    article: ExaSearchResult,
    policyInterests: string[]
  ): Promise<ExaSearchResultWithImage> {
    // If Exa.ai already provided image, use it
    if (article.image) {
      return {
        ...article,
        imageSource: 'exa',
        imageCredit: null
      };
    }

    // Fallback to Pexels
    this.env.logger.info('Exa.ai image missing, using Pexels fallback', {
      articleTitle: article.title
    });

    const pexelsImage = await this.searchPexelsImage(article.title, policyInterests);

    return {
      ...article,
      image: pexelsImage.url,
      imageSource: 'pexels',
      imageCredit: {
        photographer: pexelsImage.photographer,
        photographerUrl: pexelsImage.photographer_url,
        pexelsUrl: pexelsImage.url
      }
    };
  }

  /**
   * Search Pexels for unique image
   */
  private async searchPexelsImage(
    articleTitle: string,
    policyInterests: string[]
  ): Promise<PexelsPhoto> {
    // Strategy 1: Use article title keywords
    const titleKeywords = this.extractKeywords(articleTitle);
    let image = await this.findUniqueImage(titleKeywords.slice(0, 3).join(' '));

    if (image) return image;

    // Strategy 2: Use policy interest keywords
    const policyMapping = await this.loadPolicyMapping();
    for (const interest of policyInterests) {
      const mapping = policyMapping.find(m => m.interest === interest);
      if (mapping && mapping.keywords.length > 0) {
        image = await this.findUniqueImage(mapping.keywords[0]);
        if (image) return image;
      }
    }

    // Strategy 3: Generic fallback
    image = await this.findUniqueImage('politics congress government');

    if (image) return image;

    // Strategy 4: Last resort - any political image
    const fallback = await this.pexels.photos.search({
      query: 'washington dc capitol',
      per_page: 15,
      orientation: 'landscape'
    });

    // Return first unused image from fallback
    for (const photo of fallback.photos) {
      if (!this.usedImagesInBrief.has(photo.id)) {
        const isUsedRecently = await this.checkImageUsedRecently(photo.id);
        if (!isUsedRecently) {
          await this.markImageAsUsed(photo.id);
          this.usedImagesInBrief.add(photo.id);
          return photo;
        }
      }
    }

    // Absolute fallback - just return first photo
    return fallback.photos[0];
  }

  /**
   * Find unique Pexels image by query
   */
  private async findUniqueImage(query: string): Promise<PexelsPhoto | null> {
    try {
      const result = await this.pexels.photos.search({
        query,
        per_page: 15,
        orientation: 'landscape',
        size: 'large'
      });

      if (!result.photos || result.photos.length === 0) {
        return null;
      }

      // Find first unused image
      for (const photo of result.photos) {
        // Check tier 2: not used in current brief
        if (this.usedImagesInBrief.has(photo.id)) {
          continue;
        }

        // Check tier 1: not used in last 7 days
        const isUsedRecently = await this.checkImageUsedRecently(photo.id);
        if (isUsedRecently) {
          continue;
        }

        // Mark as used and return
        await this.markImageAsUsed(photo.id);
        this.usedImagesInBrief.add(photo.id);
        return photo;
      }

      return null;

    } catch (error) {
      this.env.logger.error(error as Error, {
        service: 'pexels',
        operation: 'findUniqueImage',
        query
      });
      return null;
    }
  }

  /**
   * Check if image was used in last 7 days
   */
  private async checkImageUsedRecently(imageId: number): Promise<boolean> {
    const key = `pexels:used:${imageId}`;
    const cached = await this.env.IMAGE_CACHE.get(key);
    return cached !== null;
  }

  /**
   * Mark image as used with 7-day TTL
   */
  private async markImageAsUsed(imageId: number): Promise<void> {
    const key = `pexels:used:${imageId}`;
    await this.env.IMAGE_CACHE.put(key, Date.now().toString(), {
      expirationTtl: 604800  // 7 days
    });
  }

  /**
   * Extract keywords from article title
   */
  private extractKeywords(title: string): string[] {
    // Remove common stop words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'been', 'be'
    ]);

    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 5);
  }
}

interface ExaSearchResultWithImage extends ExaSearchResult {
  imageSource: 'exa' | 'pexels';
  imageCredit: {
    photographer: string;
    photographerUrl: string;
    pexelsUrl: string;
  } | null;
}
```

## Rate Limiting & Cost Management

### Pexels API Limits
- **Free tier**: 200 requests/hour
- **Rate limiting**: Implement request counter in KV cache
- **Cost**: Free (no charges for API usage)

### Rate Limit Implementation

```typescript
async checkPexelsRateLimit(): Promise<boolean> {
  const key = 'pexels:rate_limit:' + Math.floor(Date.now() / 3600000); // hourly bucket
  const current = await this.env.IMAGE_CACHE.get(key);
  const count = current ? parseInt(current) : 0;

  if (count >= 200) {
    this.env.logger.warn('Pexels rate limit reached', { count });
    return false;
  }

  await this.env.IMAGE_CACHE.put(key, (count + 1).toString(), {
    expirationTtl: 3600  // 1 hour
  });

  return true;
}
```

## Attribution Requirements

Pexels requires attribution for images. Store credit info in briefs:

```typescript
interface BriefNewsArticle {
  title: string;
  url: string;
  text: string;
  publishedDate: string;
  author: string;
  image: string;
  imageSource: 'exa' | 'pexels';
  imageCredit?: {
    photographer: string;
    photographerUrl: string;
    pexelsUrl: string;
  };
}
```

## Usage in Brief Generator

```typescript
// src/brief-generator/index.ts

async collectNews(userId: string, briefType: 'daily' | 'weekly') {
  const prefs = await this.getUserPreferences(userId);
  const dateRange = this.getDateRange(briefType);

  // Search news WITH image fallback
  const newsArticles = await this.env.EXA_CLIENT.searchNewsWithImages({
    policyInterests: prefs.policy_interests,
    dateRange,
    limit: briefType === 'daily' ? 5 : 10
  });

  this.env.logger.info('News articles collected with images', {
    userId,
    briefType,
    articleCount: newsArticles.length,
    exaImages: newsArticles.filter(a => a.imageSource === 'exa').length,
    pexelsImages: newsArticles.filter(a => a.imageSource === 'pexels').length
  });

  return newsArticles;
}
```

## Frontend Attribution Display

When displaying news articles with Pexels images:

```typescript
{article.imageSource === 'pexels' && article.imageCredit && (
  <div className="image-attribution">
    Photo by <a href={article.imageCredit.photographerUrl}>
      {article.imageCredit.photographer}
    </a> on <a href={article.imageCredit.pexelsUrl}>Pexels</a>
  </div>
)}
```

## Error Handling

```typescript
try {
  const image = await this.searchPexelsImage(articleTitle, policyInterests);
  return image;
} catch (error) {
  this.env.logger.error(error as Error, {
    service: 'pexels',
    operation: 'searchPexelsImage'
  });

  // Fallback: Use placeholder image or skip image
  return {
    image: 'https://placeholder.com/news-default.jpg',
    imageSource: 'placeholder',
    imageCredit: null
  };
}
```

## Monitoring

Track image source distribution:

```typescript
await this.env.APP_DB.exec(`
  INSERT INTO api_usage_logs (id, service, endpoint, metadata, created_at)
  VALUES (?, ?, ?, ?, ?)
`, [
  crypto.randomUUID(),
  'pexels',
  'photos.search',
  JSON.stringify({
    query,
    resultCount: result.photos.length,
    imageSource: 'fallback',
    articleTitle
  }),
  Date.now()
]);
```

## Summary

**Deduplication Strategy:**
1. ✅ URL tracking with 7-day TTL in KV cache
2. ✅ Per-brief uniqueness tracking in memory
3. ✅ Query diversification (title → policy → generic)

**API Integration:**
- Pexels SDK for stock images
- 200 requests/hour free tier
- Landscape orientation, large size
- Full attribution metadata stored

**Cost:** $0 (Pexels is free with attribution)

**Attribution:** Required, stored in brief metadata and displayed in frontend
