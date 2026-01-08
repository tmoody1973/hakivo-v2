# Building Audio Podcast & Brief Generation Systems

> A comprehensive guide for AI coding agents to build robust, scalable audio content generation systems.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Content Generation Pipeline](#content-generation-pipeline)
4. [Audio/TTS Integration](#audiotts-integration)
5. [Image Generation](#image-generation)
6. [Storage & CDN](#storage--cdn)
7. [Database Schema Patterns](#database-schema-patterns)
8. [Background Job Processing](#background-job-processing)
9. [Error Handling & Resilience](#error-handling--resilience)
10. [API & Model Selection](#api--model-selection)
11. [Common Pitfalls](#common-pitfalls)
12. [Production Checklist](#production-checklist)

---

## Architecture Overview

### The Two-Tier Pattern

Audio/podcast generation systems benefit from a **two-tier architecture** that separates fast operations from slow media processing:

```
┌─────────────────────────────────────────────────────────┐
│ TIER 1: Fast Content Generation (< 60 seconds)         │
├─────────────────────────────────────────────────────────┤
│ • Content fetching (APIs, databases, web scraping)     │
│ • AI text generation (articles, summaries)             │
│ • Script generation for TTS                            │
│ • Metadata creation                                     │
│ • Queue media jobs for Tier 2                          │
└─────────────────────────────────────────────────────────┘
                         ↓ Queue Message
┌─────────────────────────────────────────────────────────┐
│ TIER 2: Media Processing (60 seconds - 15 minutes)     │
├─────────────────────────────────────────────────────────┤
│ • Text-to-Speech generation                            │
│ • Audio encoding/processing                            │
│ • Image generation                                      │
│ • File upload to storage                               │
│ • Database updates with media URLs                     │
└─────────────────────────────────────────────────────────┘
```

### Why Two Tiers?

| Concern | Tier 1 (Fast) | Tier 2 (Background) |
|---------|---------------|---------------------|
| Timeout | 10-60 seconds | 5-15 minutes |
| User experience | Immediate feedback | Async completion |
| Failure impact | User-facing error | Retry silently |
| Scaling | Serverless/edge | Queue-based workers |
| Cost | Pay per request | Batch processing |

### Platform Options

**Tier 1 (Fast Response):**
- Cloudflare Workers (60s timeout)
- Vercel Edge Functions (30s timeout)
- AWS Lambda (15 min, but optimize for speed)
- Netlify Functions (10s default)

**Tier 2 (Background Processing):**
- Netlify Background Functions (15 min timeout)
- AWS Lambda with SQS
- Google Cloud Run Jobs
- Cloudflare Queues + Workers
- BullMQ with Redis

---

## Core Components

### 1. Content Generator
Fetches source material and generates written content.

```typescript
interface ContentGenerator {
  // Fetch raw source material
  fetchSources(params: SourceParams): Promise<SourceMaterial[]>;

  // Generate written content from sources
  generateArticle(sources: SourceMaterial[], config: ArticleConfig): Promise<Article>;

  // Generate TTS-optimized script from article
  generateScript(article: Article): Promise<Script>;
}
```

### 2. Audio Processor
Converts scripts to audio files.

```typescript
interface AudioProcessor {
  // Convert text to speech
  textToSpeech(script: Script, voice: VoiceConfig): Promise<AudioBuffer>;

  // Process audio (normalize, add intro/outro, encode)
  processAudio(buffer: AudioBuffer, config: AudioConfig): Promise<ProcessedAudio>;

  // Upload to storage
  uploadAudio(audio: ProcessedAudio, metadata: Metadata): Promise<AudioUrl>;
}
```

### 3. Image Generator
Creates visual assets for the content.

```typescript
interface ImageGenerator {
  // Generate image from prompt
  generateImage(prompt: string, style: ImageStyle): Promise<ImageBuffer>;

  // Upload to storage
  uploadImage(buffer: ImageBuffer, metadata: Metadata): Promise<ImageUrl>;
}
```

### 4. Job Queue
Manages async processing between tiers.

```typescript
interface JobQueue {
  // Enqueue media processing job
  enqueue(job: MediaJob): Promise<JobId>;

  // Process job (called by worker)
  process(jobId: JobId): Promise<JobResult>;

  // Check job status
  getStatus(jobId: JobId): Promise<JobStatus>;
}
```

---

## Content Generation Pipeline

### Step 1: Source Aggregation

```typescript
async function aggregateSources(config: BriefConfig): Promise<SourceMaterial[]> {
  const sources: SourceMaterial[] = [];

  // Parallel fetch from multiple sources
  const [newsResults, apiData, dbRecords] = await Promise.all([
    fetchNews(config.topics),
    fetchExternalAPIs(config.apis),
    fetchDatabaseRecords(config.queries)
  ]);

  sources.push(...newsResults, ...apiData, ...dbRecords);

  // Deduplicate and rank by relevance
  return deduplicateAndRank(sources, config.relevanceThreshold);
}
```

### Step 2: Article Generation

```typescript
async function generateArticle(
  sources: SourceMaterial[],
  config: ArticleConfig
): Promise<Article> {
  const prompt = buildArticlePrompt(sources, config);

  const response = await llm.generate({
    model: config.model, // e.g., 'claude-sonnet-4-20250514'
    messages: [
      { role: 'system', content: ARTICLE_SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    max_tokens: config.maxTokens || 4000,
    temperature: config.temperature || 0.7
  });

  // Post-process: validate links, strip unwanted formatting
  return postProcessArticle(response.content);
}

const ARTICLE_SYSTEM_PROMPT = `You are a professional journalist writing engaging, well-sourced articles.

REQUIREMENTS:
1. Write in clear, accessible language
2. Include hyperlinks to sources using markdown: [text](url)
3. Structure with clear sections using ## headers
4. NO markdown formatting in headlines (no ** or __)
5. Minimum 5 cited sources with hyperlinks
6. Target length: 800-1200 words

OUTPUT: Return ONLY the article in markdown format.`;
```

### Step 3: Script Generation

```typescript
async function generateScript(article: Article): Promise<Script> {
  const prompt = buildScriptPrompt(article);

  const response = await llm.generate({
    model: 'claude-haiku-4-5-20251001', // Faster model for scripts
    messages: [
      { role: 'system', content: SCRIPT_SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    max_tokens: 3000,
    temperature: 0.5
  });

  return {
    text: response.content,
    estimatedDuration: estimateDuration(response.content),
    wordCount: countWords(response.content)
  };
}

const SCRIPT_SYSTEM_PROMPT = `Convert this article into a natural podcast script.

REQUIREMENTS:
1. Conversational, spoken-word style
2. NO URLs or markdown - spell out source names
3. Use natural transitions between topics
4. Include brief pauses indicated by [PAUSE]
5. Pronunciation guides for difficult names: "Ketanji [keh-TAHN-jee]"
6. Target: 5-8 minutes when read aloud (~750-1000 words)

OUTPUT: Return ONLY the script text, ready for TTS.`;
```

### Step 4: Queue Media Jobs

```typescript
async function queueMediaProcessing(brief: Brief): Promise<void> {
  // Update status to indicate script is ready
  await db.update('briefs', brief.id, { status: 'script_ready' });

  // Queue audio generation (Tier 2 will pick this up)
  await queue.enqueue({
    type: 'audio_generation',
    briefId: brief.id,
    script: brief.script,
    priority: 'normal'
  });

  // Queue image generation if needed
  if (!brief.featuredImage) {
    await queue.enqueue({
      type: 'image_generation',
      briefId: brief.id,
      title: brief.title,
      priority: 'low'
    });
  }
}
```

---

## Audio/TTS Integration

### Provider Comparison

| Provider | Quality | Speed | Cost | Best For |
|----------|---------|-------|------|----------|
| ElevenLabs | Excellent | Medium | $$$ | Premium podcasts |
| Google Cloud TTS | Good | Fast | $$ | Scalable production |
| Amazon Polly | Good | Fast | $ | AWS-integrated systems |
| OpenAI TTS | Excellent | Medium | $$ | Simple integration |
| Gemini TTS | Good | Fast | $ | Google ecosystem |
| Azure Speech | Excellent | Fast | $$ | Enterprise |

### Implementation Pattern

```typescript
interface TTSProvider {
  synthesize(text: string, options: TTSOptions): Promise<AudioBuffer>;
}

interface TTSOptions {
  voice: string;
  speed?: number;      // 0.5 - 2.0
  pitch?: number;      // -20 to +20
  format?: 'mp3' | 'wav' | 'ogg';
  sampleRate?: number; // 16000, 22050, 44100
}

// Example: Google Gemini TTS
async function synthesizeWithGemini(
  script: string,
  voice: string = 'Puck'
): Promise<AudioBuffer> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: script }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } }
          }
        }
      })
    }
  );

  const result = await response.json();
  const audioData = result.candidates[0].content.parts[0].inlineData.data;

  return Buffer.from(audioData, 'base64');
}
```

### Audio Processing Pipeline

```typescript
async function processAudio(rawAudio: Buffer): Promise<ProcessedAudio> {
  // 1. Normalize audio levels
  const normalized = await normalizeAudio(rawAudio, {
    targetLoudness: -16, // LUFS
    truePeak: -1.5       // dB
  });

  // 2. Add intro/outro (optional)
  const withBranding = await addIntroOutro(normalized, {
    intro: await loadAudio('assets/intro.mp3'),
    outro: await loadAudio('assets/outro.mp3'),
    fadeMs: 500
  });

  // 3. Encode to final format
  const encoded = await encodeAudio(withBranding, {
    format: 'mp3',
    bitrate: 128,
    sampleRate: 44100
  });

  return {
    buffer: encoded,
    duration: calculateDuration(encoded),
    format: 'mp3',
    size: encoded.length
  };
}
```

### Chunking Long Scripts

TTS APIs often have character limits. Chunk intelligently:

```typescript
function chunkScript(script: string, maxChars: number = 4000): string[] {
  const chunks: string[] = [];
  const sentences = script.split(/(?<=[.!?])\s+/);

  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChars) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += ' ' + sentence;
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());

  return chunks;
}

async function synthesizeLongScript(script: string): Promise<Buffer> {
  const chunks = chunkScript(script);
  const audioChunks: Buffer[] = [];

  for (const chunk of chunks) {
    const audio = await synthesize(chunk);
    audioChunks.push(audio);

    // Rate limiting
    await sleep(500);
  }

  return concatenateAudio(audioChunks);
}
```

---

## Image Generation

### Provider Options

| Provider | Quality | Speed | Cost | Style Control |
|----------|---------|-------|------|---------------|
| DALL-E 3 | Excellent | Slow | $$$ | Good |
| Midjourney | Excellent | Medium | $$ | Excellent |
| Stable Diffusion | Good | Fast | $ | Excellent |
| Gemini Imagen | Good | Fast | $ | Good |
| Flux | Excellent | Medium | $$ | Excellent |

### Implementation Pattern

```typescript
async function generateFeaturedImage(
  title: string,
  context: string,
  style: ImageStyle = 'editorial'
): Promise<string> {
  const prompt = buildImagePrompt(title, context, style);

  // Generate with Gemini (example)
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-image:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE']
        }
      })
    }
  );

  const result = await response.json();
  const imagePart = result.candidates[0].content.parts.find(
    p => p.inlineData?.mimeType?.startsWith('image/')
  );

  if (!imagePart) throw new Error('No image generated');

  const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');

  // Upload to storage
  return await uploadToStorage(imageBuffer, {
    contentType: imagePart.inlineData.mimeType,
    folder: 'images'
  });
}

function buildImagePrompt(title: string, context: string, style: ImageStyle): string {
  const styleGuides = {
    editorial: 'Wall Street Journal style editorial illustration, hand-drawn sketch aesthetic, clean composition',
    photorealistic: 'Professional photography, high quality, editorial style',
    abstract: 'Abstract modern art, bold colors, conceptual representation',
    minimalist: 'Minimalist design, simple shapes, limited color palette'
  };

  return `${styleGuides[style]}. Visual representation of: "${title}". ${context}. No text in the image.`;
}
```

### Fallback Chain

Always have fallbacks for image generation:

```typescript
async function getImage(brief: Brief): Promise<string> {
  // 1. Try AI generation
  try {
    return await generateFeaturedImage(brief.title, brief.summary);
  } catch (e) {
    console.warn('AI image generation failed:', e);
  }

  // 2. Try extracting from source content
  try {
    const ogImage = extractOGImage(brief.sources);
    if (ogImage) return ogImage;
  } catch (e) {
    console.warn('OG image extraction failed:', e);
  }

  // 3. Try stock photo API
  try {
    return await searchStockPhoto(brief.keywords);
  } catch (e) {
    console.warn('Stock photo search failed:', e);
  }

  // 4. Return default placeholder
  return DEFAULT_PLACEHOLDER_IMAGE;
}
```

---

## Storage & CDN

### S3-Compatible Storage Pattern

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

interface StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string; // CDN URL prefix
}

class StorageService {
  private client: S3Client;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  async upload(
    buffer: Buffer,
    options: UploadOptions
  ): Promise<string> {
    const key = this.generateKey(options);

    await this.client.send(new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: buffer,
      ContentType: options.contentType,
      CacheControl: 'public, max-age=31536000', // 1 year
      Metadata: options.metadata
    }));

    return `${this.config.publicUrl}/${key}`;
  }

  private generateKey(options: UploadOptions): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const timestamp = Date.now();

    // Organized by date: audio/2025/01/06/brief-abc123-1704556800.mp3
    return `${options.folder}/${year}/${month}/${day}/${options.prefix}-${options.id}-${timestamp}.${options.extension}`;
  }
}
```

### Storage Providers

| Provider | Cost | Speed | CDN Included | Best For |
|----------|------|-------|--------------|----------|
| Cloudflare R2 | Very Low | Fast | Yes (free) | New projects |
| AWS S3 + CloudFront | Medium | Fast | Extra cost | AWS ecosystem |
| Vultr Object Storage | Low | Medium | No | Budget projects |
| Backblaze B2 | Very Low | Medium | Cloudflare integration | Archival |
| DigitalOcean Spaces | Low | Fast | Yes | Simple setup |

---

## Database Schema Patterns

### Core Tables

```sql
-- Briefs/Episodes table
CREATE TABLE briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),

  -- Content
  title TEXT NOT NULL,
  content TEXT,              -- Markdown article
  script TEXT,               -- TTS-ready script
  summary TEXT,              -- Short description

  -- Media URLs
  audio_url TEXT,
  featured_image TEXT,

  -- Metadata
  word_count INTEGER,
  audio_duration INTEGER,    -- Seconds

  -- Processing status
  status TEXT DEFAULT 'pending',
  -- pending -> processing -> content_ready -> script_ready ->
  -- audio_processing -> completed | failed

  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP
);

-- Source materials
CREATE TABLE brief_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES briefs(id) ON DELETE CASCADE,

  source_type TEXT,          -- 'news', 'api', 'database'
  source_name TEXT,
  source_url TEXT,
  title TEXT,
  content TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Processing jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES briefs(id) ON DELETE CASCADE,

  job_type TEXT,             -- 'audio', 'image', 'content'
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 0,

  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,

  error_message TEXT,
  result JSONB,

  scheduled_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_briefs_status ON briefs(status);
CREATE INDEX idx_briefs_user_created ON briefs(user_id, created_at DESC);
CREATE INDEX idx_jobs_status_priority ON jobs(status, priority DESC, scheduled_at);
```

### Status State Machine

```
                    ┌──────────────┐
                    │   pending    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  processing  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼───────┐    │     ┌──────▼───────┐
       │content_ready │    │     │    failed    │
       └──────┬───────┘    │     └──────────────┘
              │            │
       ┌──────▼───────┐    │
       │ script_ready │◄───┘
       └──────┬───────┘
              │
       ┌──────▼────────────┐
       │ audio_processing  │
       └──────┬────────────┘
              │
       ┌──────▼───────┐
       │  completed   │
       └──────────────┘
```

---

## Background Job Processing

### Polling Pattern (Simple)

```typescript
// Background function that runs on a schedule (e.g., every 5 minutes)
export async function processMediaJobs() {
  // Find pending jobs
  const jobs = await db.query(`
    SELECT * FROM jobs
    WHERE status = 'pending'
    AND scheduled_at <= NOW()
    ORDER BY priority DESC, scheduled_at ASC
    LIMIT 5
  `);

  for (const job of jobs) {
    try {
      // Mark as processing
      await db.update('jobs', job.id, {
        status: 'processing',
        started_at: new Date()
      });

      // Process based on type
      let result;
      switch (job.job_type) {
        case 'audio':
          result = await processAudioJob(job);
          break;
        case 'image':
          result = await processImageJob(job);
          break;
      }

      // Mark complete
      await db.update('jobs', job.id, {
        status: 'completed',
        result: result,
        completed_at: new Date()
      });

    } catch (error) {
      // Handle failure
      const attempts = job.attempts + 1;
      await db.update('jobs', job.id, {
        status: attempts >= job.max_attempts ? 'failed' : 'pending',
        attempts,
        error_message: error.message,
        scheduled_at: new Date(Date.now() + exponentialBackoff(attempts))
      });
    }
  }
}

function exponentialBackoff(attempt: number): number {
  // 1min, 5min, 25min, etc.
  return Math.min(60000 * Math.pow(5, attempt - 1), 3600000);
}
```

### Queue Pattern (Scalable)

```typescript
// Using a message queue (e.g., Cloudflare Queues, SQS)
interface QueueMessage {
  type: 'audio' | 'image' | 'content';
  briefId: string;
  data: Record<string, any>;
  attempt: number;
}

// Producer: Enqueue job
async function enqueueJob(job: QueueMessage) {
  await queue.send({
    body: job,
    delaySeconds: 0
  });
}

// Consumer: Process job
export async function handleQueueMessage(message: QueueMessage) {
  const { type, briefId, data, attempt } = message;

  try {
    switch (type) {
      case 'audio':
        await processAudio(briefId, data);
        break;
      case 'image':
        await processImage(briefId, data);
        break;
    }
  } catch (error) {
    if (attempt < 3) {
      // Re-queue with delay
      await queue.send({
        body: { ...message, attempt: attempt + 1 },
        delaySeconds: exponentialBackoff(attempt)
      });
    } else {
      // Max retries exceeded
      await db.update('briefs', briefId, {
        status: 'failed',
        error_message: error.message
      });
    }
  }
}
```

---

## Error Handling & Resilience

### Retry with Exponential Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    shouldRetry = () => true
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      const delay = Math.min(
        baseDelay * Math.pow(2, attempt - 1),
        maxDelay
      );

      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError;
}

// Usage
const audio = await withRetry(
  () => synthesizeSpeech(script),
  {
    maxAttempts: 3,
    shouldRetry: (e) => e.code !== 'INVALID_INPUT'
  }
);
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure: Date | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private resetTimeout: number = 60000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure!.getTime() > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = new Date();

    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}

// Usage
const ttsBreaker = new CircuitBreaker(5, 60000);

async function synthesizeWithBreaker(script: string) {
  return ttsBreaker.execute(() => synthesizeSpeech(script));
}
```

### Graceful Degradation

```typescript
async function generateBrief(config: BriefConfig): Promise<Brief> {
  const brief: Partial<Brief> = {
    id: generateId(),
    status: 'processing'
  };

  // Critical: Must succeed
  try {
    brief.content = await generateArticle(config);
    brief.script = await generateScript(brief.content);
  } catch (error) {
    brief.status = 'failed';
    brief.errorMessage = error.message;
    return await saveBrief(brief);
  }

  // Non-critical: Can fail gracefully
  try {
    brief.audioUrl = await generateAudio(brief.script);
  } catch (error) {
    console.warn('Audio generation failed, will retry later');
    // Queue for background retry
    await queueJob({ type: 'audio', briefId: brief.id });
  }

  try {
    brief.featuredImage = await generateImage(brief.title);
  } catch (error) {
    console.warn('Image generation failed, using placeholder');
    brief.featuredImage = PLACEHOLDER_IMAGE;
  }

  brief.status = brief.audioUrl ? 'completed' : 'audio_pending';
  return await saveBrief(brief);
}
```

---

## API & Model Selection

### Model Recommendations by Task

| Task | Recommended Model | Fallback | Notes |
|------|-------------------|----------|-------|
| Article Generation | Claude Sonnet 4 | GPT-4o | Best reasoning, long-form |
| Script Generation | Claude Haiku 4.5 | GPT-4o-mini | Fast, good for conversion |
| Summarization | Claude Haiku 4.5 | Gemini Flash | Cost-effective |
| TTS | Gemini TTS / ElevenLabs | Google Cloud TTS | Quality vs. cost tradeoff |
| Image Generation | Gemini Imagen / DALL-E 3 | Stable Diffusion | Style consistency |

### Model ID Reference

```typescript
const MODELS = {
  // Anthropic Claude
  claude: {
    opus: 'claude-opus-4-5-20251001',
    sonnet: 'claude-sonnet-4-20250514',
    haiku: 'claude-haiku-4-5-20251001'
  },

  // OpenAI
  openai: {
    gpt4o: 'gpt-4o',
    gpt4oMini: 'gpt-4o-mini',
    tts: 'tts-1-hd'
  },

  // Google
  google: {
    geminiPro: 'gemini-2.5-pro',
    geminiFlash: 'gemini-2.5-flash',
    geminiFlashImage: 'gemini-2.5-flash-preview-image',
    geminiTTS: 'gemini-2.5-flash-preview-tts'
  }
};
```

### API Key Management

```typescript
// Environment-based configuration
interface APIConfig {
  anthropic?: string;
  openai?: string;
  google?: string;
}

function getAPIKey(provider: string): string {
  const key = process.env[`${provider.toUpperCase()}_API_KEY`];

  if (!key) {
    throw new Error(`Missing API key for ${provider}`);
  }

  return key;
}

// Check key availability at startup
function validateAPIKeys(required: string[]) {
  const missing = required.filter(p => !process.env[`${p.toUpperCase()}_API_KEY`]);

  if (missing.length > 0) {
    throw new Error(`Missing required API keys: ${missing.join(', ')}`);
  }
}
```

---

## Common Pitfalls

### 1. Wrong Model IDs

**Problem:** Model IDs change. Using outdated IDs causes silent failures.

```typescript
// ❌ Wrong - outdated model ID
model: 'claude-3-haiku-20240307'

// ✅ Correct - current model ID
model: 'claude-haiku-4-5-20251001'
```

**Solution:** Centralize model IDs, check provider documentation regularly.

### 2. Environment Variable Mismatch

**Problem:** Different environments have different variables set.

```typescript
// ❌ Fails silently if key is missing
const apiKey = process.env.ANTHROPIC_API_KEY;
const response = await anthropic.messages.create({ ... });

// ✅ Fail fast with clear error
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY not configured');
}
```

**Solution:** Validate required environment variables at startup.

### 3. Timeout Mismatches

**Problem:** Long-running tasks in short-timeout environments.

```typescript
// ❌ TTS takes 90 seconds, but serverless function times out at 60s
export async function handler() {
  const audio = await synthesizeSpeech(longScript); // Timeout!
}

// ✅ Separate into fast response + background processing
export async function handler() {
  await queueJob({ type: 'audio', script: longScript });
  return { status: 'queued' }; // Fast response
}
```

### 4. Missing Error Context

**Problem:** Errors without enough context to debug.

```typescript
// ❌ No context
} catch (error) {
  console.error('Error:', error.message);
}

// ✅ Full context
} catch (error) {
  console.error('Audio generation failed:', {
    briefId,
    scriptLength: script.length,
    error: error.message,
    stack: error.stack
  });
}
```

### 5. No Idempotency

**Problem:** Retries create duplicate content.

```typescript
// ❌ Creates new audio every time
async function processAudio(briefId: string) {
  const audio = await synthesize(script);
  await upload(audio);
}

// ✅ Idempotent - checks before processing
async function processAudio(briefId: string) {
  const brief = await db.get('briefs', briefId);

  if (brief.audioUrl) {
    console.log('Audio already exists, skipping');
    return brief.audioUrl;
  }

  const audio = await synthesize(brief.script);
  const url = await upload(audio);
  await db.update('briefs', briefId, { audioUrl: url });

  return url;
}
```

### 6. Unbounded Concurrency

**Problem:** Too many parallel API calls cause rate limits.

```typescript
// ❌ 100 parallel API calls = rate limited
await Promise.all(briefs.map(b => generateAudio(b)));

// ✅ Controlled concurrency
import pLimit from 'p-limit';
const limit = pLimit(3); // Max 3 concurrent

await Promise.all(briefs.map(b => limit(() => generateAudio(b))));
```

---

## Production Checklist

### Pre-Launch

- [ ] All API keys configured in all environments
- [ ] Model IDs verified against current documentation
- [ ] Timeout values appropriate for each environment
- [ ] Error logging includes sufficient context
- [ ] Retry logic implemented for all external calls
- [ ] Fallback chains for non-critical features
- [ ] Database indexes for common query patterns
- [ ] Storage lifecycle policies configured
- [ ] Rate limiting implemented for user-facing APIs

### Monitoring

- [ ] Job queue depth monitoring
- [ ] Processing time histograms
- [ ] Error rate by job type
- [ ] API provider availability
- [ ] Storage usage trends
- [ ] Cost tracking by provider

### Scaling Triggers

- [ ] Queue depth > 100 → Add workers
- [ ] P95 latency > 30s → Investigate bottlenecks
- [ ] Error rate > 5% → Check provider status
- [ ] Storage > 80% → Review lifecycle policies

---

## Quick Reference

### Minimal Viable Implementation

```typescript
// 1. Generate content
const article = await generateArticle(sources);
const script = await generateScript(article);

// 2. Save to database with 'script_ready' status
await db.insert('briefs', { content: article, script, status: 'script_ready' });

// 3. Background job picks up and generates audio
// (runs on schedule, e.g., every 5 minutes)
const brief = await db.query("SELECT * FROM briefs WHERE status = 'script_ready' LIMIT 1");
const audio = await synthesize(brief.script);
const url = await upload(audio);
await db.update('briefs', brief.id, { audioUrl: url, status: 'completed' });
```

### Environment Variables Template

```bash
# LLM Providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...

# Storage
S3_ENDPOINT=https://...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=my-bucket
S3_PUBLIC_URL=https://cdn.example.com

# Database
DATABASE_URL=postgres://...

# Optional: Monitoring
SENTRY_DSN=https://...
```

---

*Guide Version: 1.0*
*Last Updated: January 2026*
