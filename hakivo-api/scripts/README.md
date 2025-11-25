# News Population Script

Standalone script to populate news articles into Raindrop SQL database.

## Features

- Fetches Congressional news from Exa.ai for all 12 policy interests
- Uses Cerebras AI to semantically categorize articles
- Generates SQL INSERT statements ready to run in Raindrop database
- Configurable date range and articles per interest

## Prerequisites

Set environment variables in `.env` file:

```bash
EXA_API_KEY=your_exa_api_key
CEREBRAS_API_KEY=your_cerebras_api_key
```

## Usage

### Run the script

```bash
cd hakivo-api
npm run populate-news
```

### What it does

1. **Fetches articles** from Exa.ai
   - Date range: Last 3 days (configurable)
   - Articles per interest: 25 (configurable)
   - Total: ~300 articles across 12 policy interests

2. **AI categorization** with Cerebras
   - Semantic understanding of article content
   - Fixes miscategorization from keyword-only search
   - Example: Epstein articles won't appear under "Commerce & Labor"

3. **Generates SQL** INSERT statements
   - Output ready to copy-paste into Raindrop SQL admin
   - Or save to file and run via Wrangler D1

## Running the SQL

### Option 1: Copy-paste into database admin

```bash
npm run populate-news > insert-news.sql
# Then copy contents and paste into Raindrop SQL admin
```

### Option 2: Admin API endpoint (easiest)

If you have a JWT token, use the admin endpoint:

```bash
# Get token from browser localStorage after logging in
curl -X POST https://svc-01ka8k5e6tr0kgy0jkzj9m4q19.01k66gywmx8x4r0w31fdjjfekf.lmapp.run/admin/trigger-news-sync \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Configuration

Edit `scripts/populate-news.ts` to customize:

```typescript
const DAYS_BACK = 3;              // Fetch articles from last X days
const ARTICLES_PER_INTEREST = 25; // Articles per policy interest
```

## Cost Estimate

- **Exa.ai**: 300 searches × $0.01 = ~$3.00
- **Cerebras AI**: 300 categorizations × $0.0001 = ~$0.03
- **Total**: ~$3.03 per run
