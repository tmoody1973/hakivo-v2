# Congress Data Ingestion Scripts

Scripts for populating the Hakivo database with Congress.gov data.

## Prerequisites

1. **Congress.gov API Key**
   - Sign up at: https://api.congress.gov/sign-up/
   - You'll receive an API key via email

2. **Backend Running**
   - Make sure your Raindrop backend is deployed and running
   - Admin dashboard should be accessible

## Usage

### 1. Set up environment variable

```bash
export CONGRESS_API_KEY="your-api-key-here"
```

Or add to your `.env` file:
```
CONGRESS_API_KEY=your-api-key-here
```

### 2. Run the ingestion script

```bash
cd hakivo-api
npx tsx scripts/ingest-congress-data.ts
```

### 3. Monitor progress

Open the admin dashboard in your browser:
```
https://svc-01ka747hjpq5r2qk4ct00r3yyd.01k66gey30f48fys2tv4e412yt.lmapp.run/
```

You'll see:
- **System Overview** - Row counts updating in real-time
- **Database Tables** - All tables with current row counts
- **SQL Query Tool** - Run queries to inspect the data

## What Gets Ingested

For both 118th and 119th Congress:

- ✅ **Bills** - All bills with full text content
- ✅ **Members** - All representatives and senators
- ✅ **Committees** - House and Senate committees
- ⏳ **Votes** - Coming soon

## Example SQL Queries

Once data is ingested, try these queries in the admin dashboard:

```sql
-- Count total bills
SELECT COUNT(*) FROM bills;

-- View recent bills
SELECT bill_type, bill_number, title, introduced_date
FROM bills
ORDER BY introduced_date DESC
LIMIT 10;

-- View full bill text
SELECT title, text
FROM bills
WHERE bill_type = 'hr' AND bill_number = 1
LIMIT 1;

-- View California representatives
SELECT first_name, last_name, party, district
FROM members
WHERE state = 'CA'
ORDER BY district;

-- View all committees
SELECT name, chamber
FROM committees
ORDER BY chamber, name;
```

## Expected Results

After running the script, you should see approximately:

- **Bills**: 10,000-15,000 (both congresses combined)
- **Members**: 500-600 (current + former members)
- **Committees**: 100-150 (House + Senate)

## Troubleshooting

### API Rate Limiting
The script includes 100ms delays between API calls to avoid rate limiting. If you still get errors, increase the delay in the code.

### Database Errors
If you get database errors, make sure:
1. The backend is deployed and running
2. The admin dashboard URL is correct
3. Database migrations have run successfully

### Missing Data
Some bills may not have full text available yet. The script will log warnings for these cases but continue processing.

## Next Steps

After ingestion completes:
1. Verify data in admin dashboard
2. Test frontend pages that display the data
3. Set up the schedulers to keep data updated
