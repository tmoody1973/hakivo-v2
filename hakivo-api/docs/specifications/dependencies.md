# Dependencies

## External Packages

| Package/Service | Version | Purpose |
|-----------------|---------|---------|
| @liquidmetal-ai/raindrop-framework | latest | Core Raindrop framework for services, observers, resources |
| hono | ^4.x | HTTP routing and middleware for services |
| zod | ^3.x | Runtime type validation and schema definitions |
| jose | ^5.x | JWT token generation and validation |
| @anthropic-ai/sdk | ^0.x | Anthropic Claude API client |
| @cerebras/cloud-sdk | latest | Cerebras Cloud SDK for fast LLM inference (gpt-oss-120b) |
| exa-js | latest | Exa.ai neural search SDK for news discovery |
| pexels | ^1.x | Pexels API client for fallback images |
| @aws-sdk/client-s3 | ^3.x | S3-compatible SDK for Vultr Object Storage |

## External Services

| Service | Purpose |
|---------|---------|
| WorkOS | OAuth authentication and user management |
| Congress.gov API | Legislative bill data and member information |
| Geocodio API | Zip code to Congressional district lookup |
| Anthropic Claude API | Script and article generation for briefs |
| ElevenLabs API | Text-to-dialogue audio synthesis (v3) |
| Cerebras API | Fast LLM inference for RAG chat (gpt-oss-120b with streaming, 65536 max tokens) |
| Exa.ai API | Neural search for news articles with searchAndContents |
| Pexels API | Stock image fallback for news articles missing images |
| Vultr Object Storage | S3-compatible object storage for audio files (MP3 briefs) |

## Required Credentials

```
WORKOS_API_KEY
WORKOS_CLIENT_ID
JWT_PRIVATE_KEY (RS256)
JWT_PUBLIC_KEY (RS256)
CONGRESS_API_KEY
GEOCODIO_API_KEY
ANTHROPIC_API_KEY
ELEVENLABS_API_KEY
CEREBRAS_API_KEY
EXA_API_KEY
PEXELS_API_KEY
VULTR_ACCESS_KEY
VULTR_SECRET_KEY
VULTR_ENDPOINT (e.g., ewr1.vultrobjects.com)
VULTR_BUCKET_NAME
```
