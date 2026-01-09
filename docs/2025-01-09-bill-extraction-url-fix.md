# Bill Extraction URL Fix - January 9, 2025

## Problem

Users reported that **all accounts were covering the same bills every day** for 3+ days. The bill deduplication system was failing because bills weren't being saved to the `brief_bills` junction table.

### Root Cause

Claude's AI-generated articles changed their formatting pattern:

**OLD format** (bill identifier in visible text):
```markdown
[SRES 563](https://congress.gov/bill/119th-congress/sres/563)
```

**NEW format** (bill identifier ONLY in URL):
```markdown
[Senator Whitehouse has introduced legislation...](https://congress.gov/bill/119th-congress/sres/563)
```

The existing text-based regex patterns couldn't extract bills from the new format because the bill identifiers (HR, S, SRES, etc.) were no longer in the visible link text.

## Solution

### 1. Added URL-Based Extraction (Primary Method)

Added a new regex pattern to `audio-processor-background.mts` that extracts bill information directly from Congress.gov URLs:

```typescript
// CRITICAL: Extract from Congress.gov URLs first (most reliable)
// Pattern: congress.gov/bill/{congress}th-congress/{bill_type}/{bill_number}
const urlMatches = content.matchAll(
  /congress\.gov\/bill\/\d+(?:th|st|nd|rd)-congress\/([a-z]+)\/(\d+)/gi
);

for (const match of urlMatches) {
  const billType = match[1].toLowerCase();
  const billNumber = match[2];

  if (['hr', 's', 'hres', 'sres', 'hjres', 'sjres', 'hconres', 'sconres'].includes(billType)) {
    const key = `${billType}-${billNumber}`;
    if (!uniqueBills.has(key)) {
      uniqueBills.set(key, { type: billType, number: billNumber });
    }
  }
}
```

### 2. Fixed TypeScript Iterator Compatibility

Fixed `TS2802` errors by wrapping iterators with `Array.from()`:

```typescript
// Before (caused TS2802 error)
for (const { type, number } of uniqueBills.values()) { ... }

// After
for (const { type, number } of Array.from(uniqueBills.values())) { ... }
```

### 3. Backfill Script

Created `/scripts/backfill-bills.mjs` to populate bill associations for existing briefs that had 0 bills tracked.

**Results**: 77 bill associations saved across recent briefs.

## Files Modified

| File | Changes |
|------|---------|
| `netlify/functions/audio-processor-background.mts` | Added URL-based extraction, fixed TypeScript iterators |
| `scripts/backfill-bills.mjs` | New one-time backfill script |

## Verification

After the fix, all recent briefs show proper bill counts (1-5 bills each):

```json
[
  {"title": "The Battle Over How America's Children Get to School", "bill_count": 3},
  {"title": "A Looming Financial Storm: Lawmakers Warn of Climate-Driven Economic Collapse", "bill_count": 5},
  {"title": "The Battle Over Your Power Bill: Clean Energy Clashes With Fossil Fuels", "bill_count": 3}
]
```

## Technical Details

### URL Pattern Breakdown

```
congress.gov/bill/119th-congress/sres/563
                 ├── 119th-congress  → Congress number (ignored, we use current)
                 ├── sres            → Bill type (captured)
                 └── 563             → Bill number (captured)
```

### Supported Bill Types

- `hr` - House Resolution
- `s` - Senate Bill
- `hres` - House Simple Resolution
- `sres` - Senate Simple Resolution
- `hjres` - House Joint Resolution
- `sjres` - Senate Joint Resolution
- `hconres` - House Concurrent Resolution
- `sconres` - Senate Concurrent Resolution

### Extraction Priority

1. **URL extraction** (primary) - Most reliable since URLs have consistent format
2. **Text patterns** (fallback) - For any bills mentioned in plain text

## Impact

- **Deduplication now works**: Bills are properly tracked in `brief_bills` table
- **30-day lookback**: System can now deduplicate bills across user's recent briefs
- **Featured Legislation section**: Frontend can display related bills correctly

## Related Files

- `/netlify/functions/audio-processor-background.mts` - Main extraction logic
- `/hakivo-api/src/brief-generator/index.ts` - Brief generation (Cloudflare Workers)
- `/docs/2025-12-29-scheduler-and-deduplication-fixes.md` - Previous deduplication work
