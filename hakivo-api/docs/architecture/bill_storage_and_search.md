# Bill Storage and Search Architecture

## Overview

Hakivo uses **dual storage** for Congressional bill data to support different use cases:

1. **Raindrop SQL** - Structured data for filtering, search, and metadata queries
2. **SmartBucket** - Chunked bill text for semantic search and AI assistant

## Storage Systems Comparison

| Aspect | Raindrop SQL | SmartBucket |
|--------|-------------|-------------|
| **Data Type** | Structured metadata | Unstructured text chunks |
| **Content** | Bill titles, sponsors, dates, actions, votes | Full bill text split into chunks |
| **Search Type** | SQL queries, exact match, filters | Semantic similarity search |
| **Use Cases** | Bill listing, filtering, tracking | AI Q&A, semantic search |
| **Access Pattern** | Direct SQL queries | Vector similarity search |
| **Size per Bill** | ~5-10 KB metadata | ~50-500 KB full text |

## Complete Data Flow

### Phase 1: Daily Sync (External Script)
```
┌─────────────────────────────────────────────────────────────┐
│ External Sync Script (Python/Node.js)                      │
│                                                             │
│ 1. Fetch from Congress.gov API                             │
│    GET /v3/bill/118/hr/1                                    │
│                                                             │
│ 2. Extract two types of data:                              │
│    a) Metadata → Insert into Raindrop SQL                   │
│    b) Full text → Upload to SmartBucket                     │
└─────────────────────────────────────────────────────────────┘
                    ↓                           ↓
         ┌──────────────────┐       ┌─────────────────────┐
         │  Raindrop SQL    │       │   SmartBucket       │
         │  (app-db)        │       │  (bill-texts)       │
         └──────────────────┘       └─────────────────────┘
```

### Phase 2: User Queries

**Bill Search/Filter (uses SQL):**
```
User: "Show me all healthcare bills from California sponsors"
       ↓
bills-service → Query Raindrop SQL
       ↓
SELECT b.*, m.* FROM bills b
JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
JOIN bill_subjects bs ON b.id = bs.bill_id
JOIN subjects s ON bs.subject_id = s.id
WHERE m.state = 'CA' AND s.name LIKE '%health%'
       ↓
Return structured results
```

**AI Assistant Q&A (uses SmartBucket):**
```
User: "What does HR 1234 say about Medicare eligibility?"
       ↓
chat-service → Search SmartBucket for bill chunks
       ↓
SmartBucket semantic search: "Medicare eligibility HR 1234"
       ↓
Return top 5 relevant chunks
       ↓
Send chunks to Cerebras LLM for answer generation
       ↓
Return AI-generated answer
```

## SmartBucket Structure

### Document Organization
```
SmartBucket: "bill-texts"

Documents:
- bill-118-hr-1.md
  Content: Full text of HR 1 from 118th Congress
  Chunks: 45 chunks (automatically created by SmartBucket)

- bill-118-s-500.md
  Content: Full text of S 500 from 118th Congress
  Chunks: 23 chunks

Each chunk metadata:
{
  "bill_id": 1234,
  "congress": 118,
  "bill_type": "hr",
  "bill_number": 1,
  "section": "Title III - Healthcare Provisions",
  "chunk_index": 12
}
```

### How SmartBucket Works (Raindrop MCP)

SmartBucket is a **Raindrop resource** that provides:
1. **Object storage** (like S3) for documents
2. **Automatic chunking** of documents
3. **Automatic embedding** generation (via OpenAI)
4. **Vector similarity search** built-in

**No manual vector database needed!** SmartBucket handles chunking, embeddings, and search automatically.

## Implementation Details

### 1. External Sync Script: Populate Both Systems

```python
import requests
import os
from raindrop_client import RaindropSQL, SmartBucket

CONGRESS_API_KEY = os.environ.get("CONGRESS_API_KEY")
sql = RaindropSQL("app-db")
bucket = SmartBucket("bill-texts")

def sync_bill(congress, bill_type, bill_number):
    """Sync single bill to both SQL and SmartBucket"""

    # Fetch from Congress.gov
    url = f"https://api.congress.gov/v3/bill/{congress}/{bill_type}/{bill_number}"
    resp = requests.get(url, params={"api_key": CONGRESS_API_KEY})
    bill_data = resp.json()["bill"]

    # 1. Insert metadata into Raindrop SQL
    sql.execute("""
        INSERT OR REPLACE INTO bills (
            congress_id, bill_type, bill_number, title,
            sponsor_bioguide_id, introduced_date, latest_action_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        bill_data["congress"],
        bill_data["type"],
        bill_data["number"],
        bill_data["title"],
        bill_data["sponsor"]["bioguideId"],
        bill_data["introducedDate"],
        bill_data["latestAction"]["actionDate"]
    ))

    # 2. Get full bill text
    text_url = bill_data["textVersions"][0]["formats"][0]["url"]
    text_resp = requests.get(text_url)
    bill_full_text = text_resp.text

    # 3. Upload full text to SmartBucket (automatic chunking!)
    bill_id = f"bill-{congress}-{bill_type}-{bill_number}"
    bucket.put_object(
        key=f"{bill_id}.md",
        content=bill_full_text,
        metadata={
            "bill_id": bill_data["id"],
            "congress": congress,
            "bill_type": bill_type,
            "bill_number": bill_number,
            "title": bill_data["title"]
        }
    )

    print(f"✓ Synced {bill_type.upper()} {bill_number} to SQL and SmartBucket")

# Sync all bills
for bill in get_bills_to_sync():
    sync_bill(bill["congress"], bill["type"], bill["number"])
```

### 2. bills-service: Query SQL for Structured Data

```typescript
// bills-service/src/index.ts
import { sql } from '@raindrop/sql';

export async function searchBills(req, res) {
  const { query, congress, sponsor_state, subject } = req.query;

  // Query Raindrop SQL for structured search
  const results = await sql.query(`
    SELECT
      b.id, b.title, b.bill_type, b.bill_number,
      b.introduced_date, b.latest_action_date,
      m.first_name, m.last_name, m.party, m.state
    FROM bills b
    LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
    WHERE 1=1
      ${query ? "AND b.title LIKE '%' || ? || '%'" : ""}
      ${congress ? "AND b.congress_id = ?" : ""}
      ${sponsor_state ? "AND m.state = ?" : ""}
    ORDER BY b.latest_action_date DESC
    LIMIT 50
  `, [query, congress, sponsor_state].filter(Boolean));

  res.json({ bills: results });
}

export async function getBillDetail(req, res) {
  const { bill_id } = req.params;

  // Get comprehensive bill details from SQL
  const bill = await sql.query(`
    SELECT
      b.*,
      m.first_name, m.last_name, m.party, m.state,
      (SELECT COUNT(*) FROM bill_cosponsors WHERE bill_id = b.id) as cosponsor_count,
      (SELECT COUNT(*) FROM actions WHERE bill_id = b.id) as action_count
    FROM bills b
    LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
    WHERE b.id = ?
  `, [bill_id]);

  // Get actions
  const actions = await sql.query(`
    SELECT action_date, action_text, action_time
    FROM actions
    WHERE bill_id = ?
    ORDER BY action_date DESC
  `, [bill_id]);

  // Get cosponsors
  const cosponsors = await sql.query(`
    SELECT m.first_name, m.last_name, m.party, m.state, bc.cosponsor_date
    FROM bill_cosponsors bc
    JOIN members m ON bc.member_bioguide_id = m.bioguide_id
    WHERE bc.bill_id = ?
    ORDER BY bc.cosponsor_date DESC
  `, [bill_id]);

  res.json({
    bill: bill[0],
    actions,
    cosponsors
  });
}
```

### 3. chat-service: Query SmartBucket for Semantic Search

```typescript
// chat-service/src/index.ts
import { smartbucket } from '@raindrop/smartbucket';

export async function chatWithBill(req, res) {
  const { bill_id, question } = req.body;

  // 1. Get bill metadata from SQL
  const bill = await sql.query(`
    SELECT congress_id, bill_type, bill_number
    FROM bills WHERE id = ?
  `, [bill_id]);

  const { congress_id, bill_type, bill_number } = bill[0];
  const document_id = `bill-${congress_id}-${bill_type}-${bill_number}.md`;

  // 2. Search SmartBucket for relevant chunks
  const searchResults = await smartbucket.search("bill-texts", {
    query: question,
    document_id: document_id,  // Limit search to this bill
    limit: 5  // Top 5 relevant chunks
  });

  // 3. Build context from chunks
  const context = searchResults.map(chunk => chunk.content).join("\n\n");

  // 4. Call Cerebras LLM for answer
  const answer = await cerebrasClient.chat({
    system: "You are a helpful assistant answering questions about US Congressional bills.",
    user: `Context from bill:\n${context}\n\nQuestion: ${question}`,
    temperature: 0.7
  });

  res.json({
    answer: answer.content,
    sources: searchResults.map(r => ({
      section: r.metadata.section,
      chunk_index: r.metadata.chunk_index
    }))
  });
}
```

## SmartBucket vs. Pinecone

**Original Plan**: Use Pinecone for vector storage
**Better Approach**: Use Raindrop SmartBucket

| Aspect | Pinecone (Original) | SmartBucket (Better) |
|--------|---------------------|----------------------|
| Setup | Manual chunking, embeddings, indexing | Automatic chunking and embeddings |
| Code | Call OpenAI, chunk text, upsert vectors | Just `bucket.put_object()` |
| Search | Query Pinecone API separately | Built-in `bucket.search()` |
| Cost | $70/month + OpenAI embeddings | Included in Raindrop |
| Maintenance | Manage vector DB separately | Managed by Raindrop |

### Updated Architecture (No Pinecone!)

```typescript
// OLD (with Pinecone):
bill-indexer observer:
  1. Fetch bill text from SQL
  2. Chunk into 500-word segments
  3. Call OpenAI for embeddings
  4. Upsert to Pinecone
  5. Store metadata

chat-service:
  1. Generate query embedding via OpenAI
  2. Search Pinecone for similar vectors
  3. Fetch chunk text
  4. Call Cerebras LLM

// NEW (with SmartBucket):
Sync script:
  1. Upload bill text to SmartBucket (chunking automatic!)

chat-service:
  1. Search SmartBucket directly (embeddings automatic!)
  2. Call Cerebras LLM
```

## Benefits of Dual Storage

### SQL Benefits
- **Fast structured queries**: Filter by sponsor, date, status
- **Exact matching**: Find bill by number, title
- **Relationships**: Join with sponsors, votes, committees
- **Analytics**: Count bills by party, state, subject

### SmartBucket Benefits
- **Semantic search**: "Find sections about healthcare funding"
- **AI Q&A**: Natural language questions about bill content
- **Context retrieval**: Get relevant passages for briefing scripts
- **Fuzzy matching**: Find similar content across bills

## Example User Flows

### Flow 1: User Searches for Bills
```
Frontend → bills-service → Raindrop SQL
"Show healthcare bills from last month"
   ↓
SQL query with filters
   ↓
Return list of 20 bills with metadata
```

### Flow 2: User Asks Question About Bill
```
Frontend → chat-service → SmartBucket → Cerebras LLM
"What does this bill say about prescription drug costs?"
   ↓
SmartBucket semantic search on bill text
   ↓
Return 5 relevant chunks mentioning "prescription drug costs"
   ↓
Send chunks to Cerebras for answer generation
   ↓
Return AI-generated answer with sources
```

### Flow 3: Daily Brief Generation
```
brief-generator observer:
  1. Get user's tracked bills from SQL
  2. Check for recent actions in SQL (last 24 hours)
  3. For each bill with updates:
     - Search SmartBucket for bill summary sections
     - Fetch vote data from SQL
     - Fetch sponsor info from SQL
  4. Send all data to Claude for script generation
  5. Send script to ElevenLabs for audio
  6. Upload MP3 to audio-briefs SmartBucket
```

## Storage Estimates

### For 10,000 Bills (1 Congress)

**Raindrop SQL:**
- Bills table: ~10 MB (10K bills × 1 KB metadata)
- Actions table: ~50 MB (10K bills × 50 actions × 100 bytes)
- Cosponsors: ~20 MB (10K bills × 20 cosponsors × 100 bytes)
- **Total SQL: ~80 MB**

**SmartBucket:**
- Bill texts: ~500 MB (10K bills × 50 KB average text)
- Embeddings: ~200 MB (automatically generated by SmartBucket)
- **Total SmartBucket: ~700 MB**

**Total Storage**: ~780 MB for entire Congress dataset

## Recommended Setup

### Manifest Updates
```hcl
application "hakivo-api" {
  // SQL for structured data
  sql_database "app-db" {}

  // SmartBucket for bill full text (automatic chunking & embeddings)
  smartbucket "bill-texts" {}

  // SmartBucket for audio briefs
  smartbucket "audio-briefs" {}

  // Remove these (no longer needed):
  // queue "indexing-queue" {}  ❌
  // observer "bill-indexer" {} ❌
}
```

### Updated Component Count
- **Before**: 15 components (with Pinecone indexing)
- **After**: 13 components (SmartBucket replaces indexing pipeline)

**Removed**:
- bill-indexer observer (SmartBucket handles this)
- indexing-queue (no manual indexing needed)

**Architecture Simplification**: SmartBucket eliminates the need for a separate vector database and manual chunking/embedding pipeline!
