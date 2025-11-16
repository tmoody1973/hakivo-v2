# Congress Data Ingestion - Version 2 Improvements

## Issues Fixed

### ❌ Issue 1: Only 250 Members Were Being Fetched
**Problem**: The original script only fetched members for specific congresses (118th and 119th), resulting in ~250 members total.

**Root Cause**: Using `/member/congress/{congress}` endpoint only returns members who served in that specific congress.

**Fix**: Changed to use `/member` endpoint with pagination to fetch **ALL members** from the complete Congress database (current + historical). This ensures we have complete member data for foreign key relationships when bills reference sponsors from earlier congresses.

### ❌ Issue 2: Full Bill Text Was Not Being Stored
**Problem**: Bill text was being truncated to 50,000 characters, and many bills had no text at all.

**Root Cause**:
1. Text was being artificially truncated: `.substring(0, 50000)`
2. Script wasn't properly logging which bills had text vs which didn't

**Fix**:
1. Removed truncation - now stores **FULL bill text** regardless of length
2. Added detailed logging showing character count for each bill text stored
3. Added stats tracking: `billsWithText` counter to monitor how many bills successfully got their full text

### ❌ Issue 3: Policy Areas Were Not Being Captured
**Problem**: Policy areas (like "Healthcare", "Education", "Defense") were not being stored in the database.

**Root Cause**:
1. The `bills` table didn't have a `policy_area` column
2. The ingestion script wasn't extracting this field from the API response

**Fix**:
1. Created migration file `0003_add_policy_area.sql` to add `policy_area TEXT` column
2. Updated ingestion script to extract `policyArea.name` from bill details
3. Added stats tracking: `billsWithPolicyArea` counter

## What's New in V2

### 1. **Comprehensive Member Data**
```typescript
// OLD (v1): Only fetched members for specific congress
await fetchCongressAPI(`/member/congress/${congress}?limit=600`)

// NEW (v2): Fetches ALL members with pagination
let offset = 0;
while (hasMore) {
  await fetchCongressAPI(`/member?offset=${offset}&limit=${limit}`);
  offset += limit;
}
```

**Result**: Now fetches **ALL members** (thousands, including historical) instead of just 250

### 2. **Full Bill Text Storage**
```typescript
// OLD (v1): Truncated to 50,000 chars
await executeSQL(`
  UPDATE bills
  SET text = '${billText.replace(/'/g, "''").substring(0, 50000)}'
  WHERE id = '${billId}'
`);

// NEW (v2): Stores FULL text + logs character count
const escapedText = billText.replace(/'/g, "''");
await executeSQL(`
  UPDATE bills
  SET text = ${escapeSQLString(escapedText)}
  WHERE id = ${escapeSQLString(billId)}
`);
stats.billsWithText++;
console.log(`✅ Stored ${billText.length} chars of text for ${billId}`);
```

**Result**: Complete bill text preserved, with detailed logging of what was stored

### 3. **Policy Area Tracking**
```typescript
// NEW: Extract and store policy areas
const policyArea = billDetails.policyArea?.name || null;

await executeSQL(`
  INSERT OR REPLACE INTO bills (
    ...,
    policy_area
  ) VALUES (
    ...,
    ${escapeSQLString(policyArea)}
  )
`);

if (policyArea) {
  stats.billsWithPolicyArea++;
}
```

**Result**: Bills now tagged with policy areas (e.g., "Health", "Commerce", "Armed Forces")

### 4. **Better Stats Tracking**
```
📊 Statistics:
   Bills:              15,234
   Bills w/ Full Text: 12,891
   Bills w/ Policy:    14,567
   Members:            12,345
   Committees:         500
```

Now you can see:
- How many bills have full text stored
- How many bills have policy areas
- Total member count (including historical)

## Database Schema Changes

### Migration: 0003_add_policy_area.sql
```sql
ALTER TABLE bills ADD COLUMN policy_area TEXT;
```

This allows us to categorize bills by their policy domain.

## Verification Queries

After ingestion completes, run these queries in the admin dashboard:

```sql
-- Total bills
SELECT COUNT(*) FROM bills;

-- Bills with full text
SELECT COUNT(*) FROM bills WHERE text IS NOT NULL;

-- Bills with policy areas
SELECT COUNT(*) FROM bills WHERE policy_area IS NOT NULL;

-- View bills with full text and policy areas
SELECT
  bill_type,
  bill_number,
  title,
  policy_area,
  LENGTH(text) as text_length
FROM bills
WHERE text IS NOT NULL
  AND policy_area IS NOT NULL
LIMIT 10;

-- Total members (should be much higher than 250!)
SELECT COUNT(*) FROM members;

-- Policy area distribution
SELECT policy_area, COUNT(*) as count
FROM bills
WHERE policy_area IS NOT NULL
GROUP BY policy_area
ORDER BY count DESC;
```

## Running the New Script

```bash
# Stop the old script if it's running
# Then run the improved version:
CONGRESS_API_KEY=your-key-here npx tsx scripts/ingest-congress-data-v2.ts
```

## Expected Results

- **Members**: 10,000+ (all historical + current)
- **Bills**: 15,000+ (118th + 119th Congress)
- **Bills with Full Text**: 12,000+ (~80% coverage)
- **Bills with Policy Areas**: 14,000+ (~95% coverage)
- **Committees**: 500

## Performance Notes

- Full text fetching adds significant time (~2-3x longer)
- Fetching all members takes longer initially but prevents foreign key errors
- Rate limiting (100ms between requests) prevents API throttling
