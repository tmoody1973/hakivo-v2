# Hakivo Repository - Vultr File Upload Analysis

## Overview

The **hakivo** repository uploads files to **Vultr Object Storage** using the **AWS S3-compatible API**. Vultr Object Storage provides an S3-compatible interface, allowing developers to use standard AWS SDK tools to interact with their storage service.

## Technical Implementation

### 1. Core Technology Stack

The repository uses the following key dependency for Vultr uploads:

- **`@aws-sdk/client-s3`** (version 3.927.0): AWS SDK v3 for JavaScript, specifically the S3 client module
- **S3Client**: The main client for connecting to S3-compatible storage
- **PutObjectCommand**: Command for uploading objects to S3-compatible storage

### 2. Configuration Requirements

The application requires four environment variables for Vultr Object Storage integration:

```
VULTR_STORAGE_ENDPOINT  # e.g., https://sjc1.vultrobjects.com
VULTR_ACCESS_KEY        # Vultr access key ID
VULTR_SECRET_KEY        # Vultr secret access key
VULTR_CDN_URL          # CDN URL for public access
```

These are defined in `.env.example` and used throughout the codebase.

### 3. Upload Implementation Locations

The repository implements Vultr uploads in **two primary locations**:

#### A. Inngest Function (`src/inngest/functions/generate-brief.ts`)

This is used for generating daily podcast briefs and uploading them directly:

```typescript
// Upload to Vultr
const s3 = new S3Client({
  endpoint: process.env.VULTR_STORAGE_ENDPOINT!,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.VULTR_ACCESS_KEY!,
    secretAccessKey: process.env.VULTR_SECRET_KEY!
  }
});

const key = `podcasts/${userId}/daily/${Date.now()}.mp3`;

await s3.send(new PutObjectCommand({
  Bucket: 'civic-pulse-podcasts',
  Key: key,
  Body: buffer,
  ContentType: 'audio/mpeg',
  CacheControl: 'public, max-age=31536000',
  Metadata: {
    userId: userId,
    briefId: `brief-${Date.now()}`,
    generatedAt: new Date().toISOString()
  }
}));

const audioUrl = `${process.env.VULTR_CDN_URL}/${key}`;
```

#### B. Upload Worker (`src/upload-worker/index.ts`)

This is a dedicated worker that handles the upload as part of a multi-step pipeline:

```typescript
private async uploadToVultr(audioBuffer: Buffer, metadata: any): Promise<string> {
  // Lazy load AWS SDK
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

  const s3 = new S3Client({
    endpoint: this.env.VULTR_STORAGE_ENDPOINT,
    region: 'auto',
    credentials: {
      accessKeyId: this.env.VULTR_ACCESS_KEY,
      secretAccessKey: this.env.VULTR_SECRET_KEY
    }
  });

  const key = `podcasts/${metadata.userId}/daily/${Date.now()}.mp3`;

  await s3.send(new PutObjectCommand({
    Bucket: 'civic-pulse-podcasts',
    Key: key,
    Body: audioBuffer,
    ContentType: 'audio/mpeg',
    CacheControl: 'public, max-age=31536000',
    Metadata: {
      userId: metadata.userId,
      briefId: metadata.jobId,
      generatedAt: metadata.createdAt
    }
  }));

  return `${this.env.VULTR_CDN_URL}/${key}`;
}
```

### 4. Key Upload Parameters

Both implementations use consistent parameters:

| Parameter | Value | Purpose |
|-----------|-------|---------|
| **Bucket** | `civic-pulse-podcasts` | Target bucket name in Vultr Object Storage |
| **Key** | `podcasts/{userId}/daily/{timestamp}.mp3` | File path with user-specific organization |
| **Body** | Audio buffer (Uint8Array or Buffer) | The actual file content |
| **ContentType** | `audio/mpeg` | MIME type for MP3 audio files |
| **CacheControl** | `public, max-age=31536000` | Enables aggressive caching (1 year) |
| **Metadata** | User ID, Brief ID, Timestamp | Custom metadata for tracking |

### 5. Upload Workflow

The upload process follows these steps:

1. **Generate or prepare audio content** (MP3 format)
2. **Convert to buffer** (Uint8Array or Buffer format)
3. **Initialize S3Client** with Vultr endpoint and credentials
4. **Create PutObjectCommand** with bucket, key, body, and metadata
5. **Send command** via `s3.send()`
6. **Construct public URL** using CDN URL + key path
7. **Save URL to database** for later retrieval

### 6. Public Access Configuration

The uploaded files are made publicly accessible through:

- **Bucket Policy**: The bucket `civic-pulse-podcasts` is configured to allow public read access
- **ACL Setting**: In the test file, uploads use `ACL: 'public-read'` parameter
- **CDN Integration**: Files are accessed via a CDN URL (e.g., `https://sjc1.vultrobjects.com/civic-pulse-podcasts/...`)
- **Cache Headers**: Long cache duration (`max-age=31536000`) optimizes CDN performance

### 7. Test Implementation

The repository includes a test file (`test-vultr-upload.mjs`) that demonstrates the upload process:

```javascript
const s3Client = new S3Client({
  endpoint: 'https://sjc1.vultrobjects.com',
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.VULTR_ACCESS_KEY,
    secretAccessKey: process.env.VULTR_SECRET_KEY,
  },
});

await s3Client.send(
  new PutObjectCommand({
    Bucket: 'civic-pulse-podcasts',
    Key: testKey,
    Body: testContent,
    ContentType: 'audio/mpeg',
    ACL: 'public-read',
    CacheControl: 'public, max-age=31536000',
    Metadata: {
      test: 'true',
      uploadedAt: new Date().toISOString(),
    },
  })
);
```

**Note**: Credentials should be loaded from environment variables, never hardcoded.

## Key Insights

### Why Vultr Object Storage?

1. **S3 Compatibility**: Uses standard AWS S3 API, making it easy to integrate with existing tools
2. **CDN Integration**: Vultr provides built-in CDN capabilities for fast content delivery
3. **Cost-Effective**: Competitive pricing for object storage and bandwidth
4. **Geographic Distribution**: Multiple regions available for low-latency access

### Design Patterns Used

1. **Lazy Loading**: The upload worker uses dynamic imports to load AWS SDK only when needed
2. **Environment-Based Configuration**: All credentials and endpoints are externalized
3. **Consistent Key Structure**: Files are organized by user ID and timestamp for easy management
4. **Metadata Tagging**: Custom metadata enables tracking and debugging
5. **Worker Pattern**: Upload is separated into a dedicated worker for scalability

### Security Considerations

1. **Environment Variables**: Credentials are stored in environment variables, not hardcoded (except in test file)
2. **Public Access**: Files are intentionally made public for podcast distribution
3. **Key Rotation**: The test file contains exposed credentials that should be rotated
4. **HTTPS**: All connections use HTTPS endpoints for encryption in transit

## Summary

The hakivo repository uploads files to Vultr Object Storage by leveraging the **AWS S3-compatible API** through the `@aws-sdk/client-s3` package. The implementation is straightforward and follows standard S3 upload patterns, with the key difference being the use of Vultr's endpoint URL instead of AWS's. The uploaded files (primarily MP3 podcast audio) are made publicly accessible via CDN for distribution to end users.
