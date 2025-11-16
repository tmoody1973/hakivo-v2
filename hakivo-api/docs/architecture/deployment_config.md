# Deployment Configuration

## Environment Variables

```
WORKOS_API_KEY: WorkOS API key for OAuth and authentication
WORKOS_CLIENT_ID: WorkOS client ID for OAuth flow
WORKOS_REDIRECT_URI: OAuth callback URL
JWT_PRIVATE_KEY: RS256 private key for signing JWTs
JWT_PUBLIC_KEY: RS256 public key for verifying JWTs
CONGRESS_API_KEY: Congress.gov API key
GEOCODIO_API_KEY: Geocodio API key for district lookup
ANTHROPIC_API_KEY: Anthropic Claude API key
ELEVENLABS_API_KEY: ElevenLabs API key
CEREBRAS_API_KEY: Cerebras API key
EXA_API_KEY: Exa.ai API key
PEXELS_API_KEY: Pexels API key for image fallback
VULTR_ACCESS_KEY: Vultr S3-compatible access key
VULTR_SECRET_KEY: Vultr S3-compatible secret key
VULTR_ENDPOINT: Vultr object storage endpoint (e.g., ewr1.vultrobjects.com)
VULTR_BUCKET_NAME: Bucket name for audio storage
CORS_ALLOWED_ORIGINS: Comma-separated list of allowed CORS origins
RATE_LIMIT_LOGIN: Max login attempts per window (default: 10)
RATE_LIMIT_WINDOW: Rate limit window in seconds (default: 900)
ACCOUNT_LOCKOUT_ATTEMPTS: Failed login attempts before lockout (default: 5)
CACHE_TTL_BILLS: Bill cache TTL in seconds (default: 900)
CACHE_TTL_MEMBERS: Congress members cache TTL in seconds (default: 3600)
CACHE_TTL_NEWS: News search cache TTL in seconds (default: 21600)
CACHE_TTL_DASHBOARD: Dashboard cache TTL in seconds (default: 300)
MAX_TRACKED_BILLS: Maximum bills per user (default: 100)
BRIEF_GENERATION_TIMEOUT: Brief generation timeout in seconds (default: 300)
LOG_LEVEL: Logging level (debug, info, warn, error)
```

## Secrets

```
JWT_PRIVATE_KEY
JWT_PUBLIC_KEY
WORKOS_API_KEY
WORKOS_CLIENT_ID
CONGRESS_API_KEY
GEOCODIO_API_KEY
ANTHROPIC_API_KEY
ELEVENLABS_API_KEY
CEREBRAS_API_KEY
EXA_API_KEY
PEXELS_API_KEY
VULTR_ACCESS_KEY
VULTR_SECRET_KEY
```

## Resource Requirements

All components use default Raindrop resource allocations.
