# Congress.gov Daily Sync Strategy

## Overview

The Hakivo backend uses a **daily sync strategy** where an external ingestion script populates **Raindrop's cloud SQLite database** with comprehensive Congress.gov data. This eliminates the need for repeated API calls during user requests, enabling fast queries and complex multi-table joins.

**Important**: "Raindrop SQL" refers to the cloud-hosted SQLite database managed by Raindrop. It is NOT local to your machine - all data lives in Raindrop's cloud infrastructure and is accessed by services via `env.APP_DB`.

## Architecture Components

### 1. External Ingestion Script
- **Location**: Separate from Raindrop application (e.g., Python script with `requests` library)
- **Execution**: Scheduled cron job running daily (e.g., 2 AM ET when Congress.gov is less active)
- **Purpose**: Fetch data from Congress.gov API and insert/update Raindrop SQL database

### 2. congress-sync-observer (Raindrop Observer)
- **Trigger**: sync-queue messages (enqueued by external script or internal scheduler)
- **Purpose**: Process sync jobs, coordinate with bill-indexer for new/updated bills
- **Responsibilities**:
  - Validate sync data
  - Coordinate indexing of new/updated bills (enqueue to indexing-queue)
  - Log sync metrics (bills added, bills updated, errors)
  - Handle retry for failed API calls

### 3. Raindrop SQL Database (app-db)
- **Storage**: Cloud SQLite database managed by Raindrop (NOT local to your machine)
- **Location**: Raindrop's cloud infrastructure
- **Size**: 43 tables (13 user/app tables + 30 Congress.gov tables)
- **Access**: All Raindrop services query this cloud database via `env.APP_DB`
- **Durability**: Automatic backups, ACID compliance
- **Connection**: External script connects via Raindrop SQL API or database URL

## Daily Sync Workflow

### Phase 1: Check for New Bills
```
External Script:
1. Call Congress.gov API: GET /v3/bill/{congress}?limit=250&offset=0&sort=updateDate:desc
2. Filter bills updated since last sync (based on updateDate field)
3. For each new bill:
   - INSERT INTO bills (congress_id, bill_type, bill_number, title, ...)
   - INSERT INTO actions (bill_id, action_date, action_text, ...)
   - INSERT INTO bill_sponsors, bill_cosponsors, bill_committees, bill_subjects
4. Enqueue new bills to sync-queue for indexing
```

### Phase 2: Update Existing Bills
```
External Script:
1. Query Raindrop SQL: SELECT id, congress_id, bill_type, bill_number, update_date FROM bills
2. For each bill, check Congress.gov: GET /v3/bill/{congress}/{type}/{number}
3. Compare update_date - if Congress.gov > SQL, update:
   - UPDATE bills SET latest_action_date=?, latest_action_text=?, text=?, update_date=?
   - INSERT new actions, cosponsors, committee assignments
4. Enqueue updated bills to sync-queue for re-indexing
```

### Phase 3: Sync Members (Enriched with Social Media & Contact Info)
```
External Script:
1. Fetch base member data from Congress.gov API:
   GET /v3/member?limit=250&currentMember=true

2. Enrich with legislators-current.json (unitedstates/congress-legislators):
   GET https://unitedstates.github.io/congress-legislators/legislators-current.json
   - Match on bioguide_id
   - Extract: phone, office, contact_form, fax, rss_url, thomas_id, govtrack_id, etc.
   - Extract latest term info: party, state, district, senate_class, senate_rank
   - Extract leadership roles if present

3. Enrich with legislators-social-media.json:
   GET https://unitedstates.github.io/congress-legislators/legislators-social-media.json
   - Match on bioguide_id
   - Extract: twitter, facebook, youtube, instagram, mastodon handles

4. Merge all data sources and INSERT OR REPLACE INTO members

### Phase 4: Sync Committees, Votes
```
External Script:
1. Committees: GET /v3/committee/{congress}
   - INSERT OR REPLACE INTO committees (id, name, chamber, committee_code, url)
   - INSERT INTO committee_meetings, committee_reports for new committee data

3. Votes: GET /v3/vote/{congress}/{chamber}
   - INSERT INTO votes (congress_id, session, vote_number, bill_id, vote_result, ...)
   - INSERT INTO vote_members (vote_id, member_bioguide_id, vote_cast)
```

### Phase 4: Indexing (Handled by Raindrop)
```
congress-sync-observer (Raindrop):
1. Process sync-queue messages
2. For each new/updated bill:
   - Enqueue to indexing-queue with payload: { bill_id, action: "index" }

bill-indexer (Raindrop):
1. Process indexing-queue messages
2. Fetch bill.text from SQL
3. Chunk bill text (semantic chunking)
4. Generate embeddings via OpenAI
5. Upsert to Pinecone vector database
```

## Rate Limiting Strategy

Congress.gov enforces **5000 requests/hour** (83 requests/minute).

### Sync Strategy:
1. **Incremental Updates**: Only check bills updated since last sync
   - First sync: Full import (~10,000 bills from current Congress)
   - Daily sync: ~100-500 bills updated per day

2. **Batching**: Fetch 250 bills per request (max pagination limit)
   - 500 updated bills = 2 API calls
   - Well within 5000 req/hour limit

3. **Prioritization**:
   - Priority 1: Bills users are tracking (check tracked_bills table)
   - Priority 2: Recently introduced bills (last 30 days)
   - Priority 3: All other bills (bulk update once per week)

4. **Retry Logic**:
   - 429 Rate Limit: Exponential backoff (wait 60s, 120s, 240s)
   - 5xx Server Error: Retry 3 times with jitter
   - Network timeout: Retry with increasing timeout (10s, 30s, 60s)

## Example External Script (Python)

```python
import requests
import sqlite3
from datetime import datetime, timedelta
import time
import os

CONGRESS_API_KEY = os.environ.get("CONGRESS_API_KEY")
RAINDROP_SQL_URL = "raindrop-cloud-sql://app-db"  # Raindrop cloud SQL connection (NOT local)
CONGRESS_NUM = 118

def sync_new_bills():
    """Check for new bills introduced since last sync"""
    last_sync = get_last_sync_timestamp()
    url = f"https://api.congress.gov/v3/bill/{CONGRESS_NUM}"
    params = {
        "api_key": CONGRESS_API_KEY,
        "limit": 250,
        "offset": 0,
        "sort": "updateDate:desc"
    }

    while True:
        resp = requests.get(url, params=params)
        if resp.status_code == 429:
            time.sleep(60)  # Rate limit hit, wait 1 minute
            continue

        data = resp.json()
        bills = data.get("bills", [])

        for bill in bills:
            update_date = bill["updateDate"]
            if update_date <= last_sync:
                return  # Reached bills we already have

            # Insert into Raindrop SQL
            insert_bill(bill)
            enqueue_for_indexing(bill["id"])

        if len(bills) < 250:
            break  # No more pages

        params["offset"] += 250
        time.sleep(0.5)  # Rate limiting courtesy

def insert_bill(bill):
    """Insert bill into Raindrop cloud SQL database (via API or connection URL)"""
    conn = sqlite3.connect(RAINDROP_SQL_URL)  # Connects to Raindrop cloud SQL, NOT local file
    cursor = conn.cursor()

    cursor.execute("""
        INSERT OR REPLACE INTO bills (
            congress_id, bill_type, bill_number, title,
            origin_chamber, introduced_date, latest_action_date,
            latest_action_text, sponsor_bioguide_id, update_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        bill["congress"],
        bill["type"],
        bill["number"],
        bill["title"],
        bill["originChamber"],
        bill["introducedDate"],
        bill["latestAction"]["actionDate"],
        bill["latestAction"]["text"],
        bill.get("sponsor", {}).get("bioguideId"),
        int(datetime.fromisoformat(bill["updateDate"]).timestamp())
    ))

    bill_id = cursor.lastrowid

    # Insert actions
    for action in bill.get("actions", {}).get("actions", []):
        cursor.execute("""
            INSERT INTO actions (bill_id, action_date, action_text, action_time)
            VALUES (?, ?, ?, ?)
        """, (bill_id, action["actionDate"], action["text"], action.get("actionTime")))

    conn.commit()
    conn.close()

def enqueue_for_indexing(bill_id):
    """Enqueue bill to sync-queue for indexing"""
    # This would call Raindrop's queue API
    requests.post("https://raindrop-api/queues/sync-queue/messages", json={
        "bill_id": bill_id,
        "action": "index"
    })

def sync_members_enriched():
    """Sync members with enriched data from multiple sources"""

    # 1. Fetch base data from Congress.gov API
    congress_members = fetch_congress_members()

    # 2. Fetch enrichment data from unitedstates/congress-legislators
    legislators_current = requests.get(
        "https://unitedstates.github.io/congress-legislators/legislators-current.json"
    ).json()

    legislators_social = requests.get(
        "https://unitedstates.github.io/congress-legislators/legislators-social-media.json"
    ).json()

    # 3. Create lookup dictionaries
    current_lookup = {leg["id"]["bioguide"]: leg for leg in legislators_current}
    social_lookup = {leg["id"]["bioguide"]: leg.get("social", {}) for leg in legislators_social}

    # 4. Merge and insert
    conn = sqlite3.connect(RAINDROP_SQL_URL)
    cursor = conn.cursor()

    for member in congress_members:
        bioguide = member["bioguideId"]

        # Get enrichment data
        current_data = current_lookup.get(bioguide, {})
        social_data = social_lookup.get(bioguide, {})

        # Extract latest term info
        terms = current_data.get("terms", [])
        latest_term = terms[-1] if terms else {}

        # Extract leadership
        leadership_roles = current_data.get("leadership_roles", [])
        latest_leadership = leadership_roles[-1] if leadership_roles else {}

        cursor.execute("""
            INSERT OR REPLACE INTO members (
                bioguide_id, first_name, middle_name, last_name, official_full_name,
                party, state, district, senate_class, senate_rank,
                url, birthday, gender, birth_year, current_member,
                phone, fax, contact_form, office, rss_url,
                thomas_id, govtrack_id, opensecrets_id, fec_ids, cspan_id, wikipedia_id,
                twitter, twitter_id, facebook, facebook_id, youtube, youtube_id,
                instagram, instagram_id, mastodon,
                leadership_title, leadership_start_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            bioguide,
            current_data.get("name", {}).get("first"),
            current_data.get("name", {}).get("middle"),
            current_data.get("name", {}).get("last"),
            current_data.get("name", {}).get("official_full"),
            latest_term.get("party"),
            latest_term.get("state"),
            latest_term.get("district"),
            latest_term.get("class"),
            latest_term.get("senate_rank"),
            member.get("url"),
            current_data.get("bio", {}).get("birthday"),
            current_data.get("bio", {}).get("gender"),
            member.get("birthYear"),
            member.get("currentMember", False),
            latest_term.get("phone"),
            latest_term.get("fax"),
            latest_term.get("contact_form"),
            latest_term.get("office"),
            latest_term.get("rss_url"),
            current_data.get("id", {}).get("thomas"),
            current_data.get("id", {}).get("govtrack"),
            current_data.get("id", {}).get("opensecrets"),
            json.dumps(current_data.get("id", {}).get("fec", [])),
            current_data.get("id", {}).get("cspan"),
            current_data.get("id", {}).get("wikipedia"),
            social_data.get("twitter"),
            social_data.get("twitter_id"),
            social_data.get("facebook"),
            social_data.get("facebook_id"),
            social_data.get("youtube"),
            social_data.get("youtube_id"),
            social_data.get("instagram"),
            social_data.get("instagram_id"),
            social_data.get("mastodon"),
            latest_leadership.get("title"),
            latest_leadership.get("start")
        ))

    conn.commit()
    conn.close()
    print(f"✓ Synced {len(congress_members)} members with enriched data")

if __name__ == "__main__":
    sync_new_bills()
    sync_updated_bills()
    sync_members_enriched()  # Updated to use enriched sync
    sync_committees()
    sync_votes()
```

## Benefits of Raindrop Cloud SQL Storage

### 1. Fast Queries (Sub-100ms Response Time)
**Note**: Services query Raindrop's cloud SQL database, not a local database. Queries are fast because data is in Raindrop's infrastructure (same network as services), not because it's on your local machine.
```sql
-- Complex multi-table join impossible via Congress.gov API
SELECT
  b.id, b.title, b.bill_type, b.bill_number,
  m.first_name, m.last_name, m.party, m.state,
  COUNT(DISTINCT bc.member_bioguide_id) as cosponsor_count,
  COUNT(DISTINCT a.id) as action_count,
  GROUP_CONCAT(DISTINCT c.name) as committees
FROM bills b
LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
LEFT JOIN bill_cosponsors bc ON b.id = bc.bill_id
LEFT JOIN actions a ON b.id = a.bill_id
LEFT JOIN bill_committees bc2 ON b.id = bc2.bill_id
LEFT JOIN committees c ON bc2.committee_id = c.id
WHERE b.congress_id = 118
  AND m.state = 'CA'
  AND b.latest_action_date >= date('now', '-30 days')
GROUP BY b.id
ORDER BY b.latest_action_date DESC
LIMIT 20;
```

### 2. Reduced API Costs
- **Before (API per request)**: 1000 users × 10 bill searches/day = 10,000 Congress.gov API calls/day
- **After (Raindrop cloud SQL)**: 1 daily sync checking ~500 updated bills = ~2 API calls/day
- **Savings**: 99.98% reduction in API calls
- **Architecture**: bills-service queries Raindrop SQL (cloud) instead of Congress.gov API (external)

### 3. Advanced Analytics with Enriched Member Data
```sql
-- Find California representatives with social media
SELECT
  first_name, last_name, party, district,
  twitter, facebook, instagram,
  phone, office, contact_form
FROM members
WHERE state = 'CA' AND current_member = true
ORDER BY last_name;

-- Find bills with most bipartisan support
SELECT
  b.title,
  COUNT(CASE WHEN m.party = 'D' THEN 1 END) as dem_cosponsors,
  COUNT(CASE WHEN m.party = 'R' THEN 1 END) as rep_cosponsors,
  COUNT(*) as total_cosponsors
FROM bills b
JOIN bill_cosponsors bc ON b.id = bc.bill_id
JOIN members m ON bc.member_bioguide_id = m.bioguide_id
WHERE b.congress_id = 118
GROUP BY b.id
HAVING dem_cosponsors > 5 AND rep_cosponsors > 5
ORDER BY total_cosponsors DESC
LIMIT 10;
```

### 4. Offline Capability
- App continues functioning even if Congress.gov API is down
- Stale data is better than no data (sync resumes when API recovers)

## Monitoring & Alerts

### Metrics to Track:
1. **Sync Success Rate**: % of successful daily syncs
2. **Bills Added**: Count of new bills inserted per sync
3. **Bills Updated**: Count of bills updated per sync
4. **Sync Duration**: Time to complete full sync (target: <30 minutes)
5. **API Rate Limit Hits**: Count of 429 responses (target: 0)
6. **Indexing Queue Depth**: Pending bills awaiting vectorization

### Alerts:
- **Critical**: Sync failed for 2+ consecutive days
- **Warning**: Sync duration >1 hour (API slowness)
- **Info**: Rate limit hit (429 response)

## Future Enhancements

1. **Real-time Updates**: Subscribe to Congress.gov webhooks (if available) for immediate updates
2. **Selective Sync**: Only sync bills users are tracking (reduce storage)
3. **Historical Data**: Backfill older Congresses (115th, 116th, 117th)
4. **Differential Sync**: Use ETags/If-Modified-Since headers to reduce bandwidth
