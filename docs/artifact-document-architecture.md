# Artifact Document Architecture

## Overview

This document explains the architecture for creating consistent, reliable artifacts (reports, decks, briefings) in Hakivo. Instead of sending raw tool data directly to the artifact renderer, we first create a structured document that gets saved to the database, then render that document as an artifact.

---

## The Problem with Direct Rendering

### Old Flow (What We Had)

```
User Request → Agent → Tools gather raw data → Raw data → Thesys Artifact Renderer → Visual Output
```

**Issues:**
1. **Inconsistent structure** - Raw tool data varies in format and completeness
2. **No persistence** - If rendering fails, all research is lost
3. **Hard to debug** - Can't see what data was sent to the renderer
4. **No reusability** - Same query requires re-searching everything
5. **Quality varies** - Renderer has to interpret messy data on the fly

---

## The Solution: Document-First Architecture

### New Flow

```
User Request
    ↓
Agent calls research tools (Gemini search, bill search, member lookup)
    ↓
Agent processes raw data into structured document
    ↓
Document saved to user's database
    ↓
Document ID sent to artifact renderer
    ↓
Renderer reads document and creates visual output
```

**Benefits:**
1. **Consistent structure** - Every document follows a predictable schema
2. **Persistent** - Documents are saved, users can revisit them
3. **Debuggable** - You can inspect the document that produced any artifact
4. **Reusable** - Regenerate artifacts from existing documents
5. **Editable** - Users could modify documents before rendering (future feature)

---

## Core Concepts

### 1. Document Types

A document type defines what kind of output you're creating:

| Type | Description | Example Use Case |
|------|-------------|------------------|
| `policy_report` | In-depth analysis of a policy area | "AI policy report" |
| `bill_summary` | Summary of one or more bills | "Summarize H.R. 123" |
| `member_profile` | Profile of a Congress member | "Tell me about Rep. Smith" |
| `news_briefing` | Current events summary | "Latest healthcare news" |
| `comparison` | Side-by-side comparison | "Compare these two bills" |
| `slide_deck` | Presentation slides | "Create deck on immigration" |

### 2. Sections

Every document is made of **sections**. Sections are the building blocks that get rendered into visual components.

```typescript
interface Section {
  id: string;           // Unique identifier
  type: SectionType;    // What kind of section
  title: string;        // Display title
  content: any;         // The actual data (flexible)
  order: number;        // Display order (lower = first)
}
```

**Available Section Types:**

| Section Type | Content Structure | Renders As |
|--------------|-------------------|------------|
| `summary` | `{ text: string }` | Text paragraph |
| `key_points` | `{ points: string[] }` | Bullet list |
| `bills` | `{ bills: Bill[] }` | Bill cards grid |
| `members` | `{ members: Member[] }` | Member cards grid |
| `news` | `{ articles: Article[] }` | News article cards |
| `timeline` | `{ events: Event[] }` | Timeline visualization |
| `statistics` | `{ stats: Stat[] }` | Stats cards |
| `quote` | `{ text: string, attribution: string }` | Blockquote |
| `custom` | `{ markdown: string }` | Markdown content |

### 3. Document Schema

The complete document structure:

```typescript
interface UserDocument {
  // Identity
  id: string;                    // UUID
  userId: string;                // Owner's user ID

  // Classification
  documentType: DocumentType;    // report, deck, briefing, etc.
  title: string;                 // Display title

  // Metadata
  metadata: {
    generatedAt: string;         // ISO timestamp
    query: string;               // Original user query
    focus?: string;              // Topic focus area
    sources: string[];           // Where data came from
  };

  // Content
  sections: Section[];           // Ordered list of sections

  // Debugging
  rawToolResults?: any;          // Original tool outputs (optional)

  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

---

## How It Works (Step by Step)

### Step 1: User Makes a Request

User types in the chat:
> "Create a policy report on U.S. AI policy, legislation, and include related news stories along with members of Congress who sponsor AI bills"

### Step 2: Agent Calls Research Tools

The agent identifies what tools to call:

```typescript
// Tool 1: Search for AI policy news
const newsResults = await geminiSearch({
  query: "U.S. AI policy legislation 2024",
  focus: "policy"
});

// Tool 2: Search for AI-related bills
const billResults = await searchBills({
  query: "artificial intelligence",
  congress: 118
});

// Tool 3: Find AI bill sponsors
const memberResults = await searchMembers({
  query: "artificial intelligence sponsor"
});
```

### Step 3: Agent Builds Structured Document

Instead of sending raw results to the artifact renderer, the agent calls the **Document Builder Tool**:

```typescript
const document = await buildDocument({
  type: "policy_report",
  title: "U.S. AI Policy Report",
  query: "U.S. AI policy, legislation, news, sponsors",
  sections: [
    {
      type: "summary",
      title: "Executive Summary",
      content: {
        text: "This report analyzes the current state of AI policy in the United States, including pending legislation, key sponsors, and recent news developments."
      }
    },
    {
      type: "key_points",
      title: "Key Findings",
      content: {
        points: [
          "15 AI-related bills introduced in the 118th Congress",
          "Bipartisan support for AI safety legislation",
          "Focus areas: safety, workforce, national security"
        ]
      }
    },
    {
      type: "bills",
      title: "Pending Legislation",
      content: {
        bills: billResults.bills.map(bill => ({
          id: bill.id,
          number: bill.number,
          title: bill.title,
          sponsor: bill.sponsor,
          status: bill.status,
          summary: bill.summary
        }))
      }
    },
    {
      type: "members",
      title: "Key Sponsors",
      content: {
        members: memberResults.members.map(m => ({
          id: m.bioguideId,
          name: m.name,
          party: m.party,
          state: m.state,
          role: m.role,
          imageUrl: m.imageUrl
        }))
      }
    },
    {
      type: "news",
      title: "Recent News",
      content: {
        articles: newsResults.articles.map(a => ({
          title: a.title,
          source: a.source,
          url: a.url,
          date: a.date,
          snippet: a.snippet
        }))
      }
    }
  ]
});
```

### Step 4: Document Saved to Database

The document builder saves to the `user_documents` table:

```sql
INSERT INTO user_documents (
  id, user_id, document_type, title, metadata, sections, raw_data
) VALUES (
  'doc_abc123',
  'user_xyz',
  'policy_report',
  'U.S. AI Policy Report',
  '{"generatedAt": "2024-12-10", "query": "...", "sources": ["gemini", "congress"]}',
  '[{"type": "summary", ...}, {"type": "bills", ...}]',
  '{"newsResults": {...}, "billResults": {...}}'
);
```

### Step 5: Document Sent to Artifact Renderer

Now we send the clean, structured document to Thesys:

```typescript
const artifact = await generateArtifact({
  documentId: "doc_abc123",
  format: "report"  // or "deck" for slides
});
```

### Step 6: Renderer Maps Sections to Components

The artifact renderer reads the document and maps each section to a C1 component:

| Section Type | C1 Component |
|--------------|--------------|
| `summary` | `TextContent` |
| `key_points` | `List` (bullet) |
| `bills` | `Cards` (grid) |
| `members` | `Cards` (grid) |
| `news` | `Cards` (list) |
| `timeline` | `Timeline` |
| `statistics` | `Cards` (stats) |

The result is a consistent, well-structured visual artifact.

---

## Database Schema

### user_documents Table

```sql
CREATE TABLE user_documents (
  -- Primary key
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Document classification
  document_type TEXT NOT NULL CHECK (document_type IN (
    'policy_report', 'bill_summary', 'member_profile',
    'news_briefing', 'comparison', 'slide_deck'
  )),

  -- Content
  title TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  sections JSONB NOT NULL DEFAULT '[]',

  -- Optional: store raw tool results for debugging
  raw_tool_results JSONB,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE INDEX idx_user_documents_user_id ON user_documents(user_id);
CREATE INDEX idx_user_documents_type ON user_documents(document_type);
CREATE INDEX idx_user_documents_created ON user_documents(created_at DESC);
```

---

## File Structure

```
lib/
  documents/
    types.ts              # TypeScript interfaces
    document-builder.ts   # Core document building logic
    section-mappers.ts    # Map raw data to section formats

mastra/
  tools/
    create-document.ts    # Mastra tool for agent to call

app/
  api/
    documents/
      route.ts            # List user documents
      [id]/
        route.ts          # Get/update/delete document
```

---

## TypeScript Types

### lib/documents/types.ts

```typescript
// Document types
export type DocumentType =
  | 'policy_report'
  | 'bill_summary'
  | 'member_profile'
  | 'news_briefing'
  | 'comparison'
  | 'slide_deck';

// Section types
export type SectionType =
  | 'summary'
  | 'key_points'
  | 'bills'
  | 'members'
  | 'news'
  | 'timeline'
  | 'statistics'
  | 'quote'
  | 'custom';

// Section content types (union based on section type)
export interface SummaryContent {
  text: string;
}

export interface KeyPointsContent {
  points: string[];
}

export interface BillsContent {
  bills: Array<{
    id: string;
    number: string;
    title: string;
    sponsor?: string;
    status?: string;
    summary?: string;
    url?: string;
  }>;
}

export interface MembersContent {
  members: Array<{
    id: string;
    name: string;
    party: string;
    state: string;
    role?: string;
    imageUrl?: string;
  }>;
}

export interface NewsContent {
  articles: Array<{
    title: string;
    source: string;
    url: string;
    date?: string;
    snippet?: string;
    imageUrl?: string;
  }>;
}

export interface TimelineContent {
  events: Array<{
    date: string;
    title: string;
    description?: string;
  }>;
}

export interface StatisticsContent {
  stats: Array<{
    label: string;
    value: string | number;
    change?: string;
    trend?: 'up' | 'down' | 'neutral';
  }>;
}

export interface QuoteContent {
  text: string;
  attribution: string;
}

export interface CustomContent {
  markdown: string;
}

// Generic section
export interface Section<T = any> {
  id: string;
  type: SectionType;
  title: string;
  content: T;
  order: number;
}

// Complete document
export interface UserDocument {
  id: string;
  userId: string;
  documentType: DocumentType;
  title: string;
  metadata: {
    generatedAt: string;
    query: string;
    focus?: string;
    sources: string[];
  };
  sections: Section[];
  rawToolResults?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
```

---

## How to Add New Section Types

If you need a new type of section (e.g., `chart` or `image`):

### 1. Add the type to `SectionType`

```typescript
export type SectionType =
  | 'summary'
  | 'key_points'
  // ... existing types
  | 'chart';  // NEW
```

### 2. Define the content interface

```typescript
export interface ChartContent {
  chartType: 'bar' | 'line' | 'pie';
  title: string;
  data: Array<{ label: string; value: number }>;
}
```

### 3. Add a section mapper

```typescript
// In section-mappers.ts
export function mapToChartSection(rawData: any): Section<ChartContent> {
  return {
    id: generateId(),
    type: 'chart',
    title: rawData.title || 'Chart',
    content: {
      chartType: rawData.chartType || 'bar',
      title: rawData.title,
      data: rawData.data
    },
    order: rawData.order || 99
  };
}
```

### 4. Add C1 component mapping

```typescript
// In artifact renderer
case 'chart':
  return {
    component: 'Chart',
    props: {
      type: section.content.chartType,
      title: section.content.title,
      data: section.content.data
    }
  };
```

---

## How to Add New Document Types

If you need a new document type (e.g., `committee_report`):

### 1. Add to DocumentType

```typescript
export type DocumentType =
  | 'policy_report'
  // ... existing types
  | 'committee_report';  // NEW
```

### 2. Create a document template

```typescript
// In document-builder.ts
const DOCUMENT_TEMPLATES: Record<DocumentType, SectionType[]> = {
  policy_report: ['summary', 'key_points', 'bills', 'members', 'news'],
  bill_summary: ['summary', 'key_points', 'timeline', 'members'],
  // ... existing templates
  committee_report: ['summary', 'members', 'bills', 'timeline', 'statistics']  // NEW
};
```

### 3. Add any special handling

If the new document type needs special processing (e.g., different API calls), add logic in the document builder.

---

## Debugging

### View Document Contents

Documents are stored in JSON format. You can query them directly:

```sql
-- Get document with sections
SELECT id, title, sections
FROM user_documents
WHERE id = 'doc_abc123';

-- View raw tool results for debugging
SELECT raw_tool_results
FROM user_documents
WHERE id = 'doc_abc123';
```

### Common Issues

| Problem | Likely Cause | Solution |
|---------|--------------|----------|
| Missing section | Tool returned no data | Check raw_tool_results |
| Wrong order | Order values not set | Set explicit order values |
| Blank content | Content mapping failed | Check section mapper |
| Render fails | Invalid section type | Ensure type is in enum |

---

## API Endpoints

### List User Documents

```
GET /api/documents?type=policy_report&limit=10
```

### Get Single Document

```
GET /api/documents/[id]
```

### Generate Artifact from Document

```
POST /api/documents/[id]/artifact
Body: { format: "report" | "deck" }
```

### Delete Document

```
DELETE /api/documents/[id]
```

---

---

## Progress Notification System

When generating documents and artifacts, users need to know what's happening. The process can take 10-30 seconds, and without feedback, users think the app is frozen.

### Notification Flow

```
User clicks "Generate Report"
    ↓
[Starting research...]                    ← Notification 1
    ↓
[Searching for AI policy news...]         ← Notification 2
    ↓
[Finding related legislation...]          ← Notification 3
    ↓
[Looking up bill sponsors...]             ← Notification 4
    ↓
[Building your document...]               ← Notification 5
    ↓
[Generating visual report...]             ← Notification 6
    ↓
[Complete! Opening your report...]        ← Notification 7
```

### Progress Event Types

Each step sends a progress event to the client:

```typescript
interface ProgressEvent {
  type: 'progress';
  step: number;        // Current step (1-7)
  totalSteps: number;  // Total steps (7)
  message: string;     // Human-readable message
  detail?: string;     // Optional detail
  phase: ProgressPhase;
}

type ProgressPhase =
  | 'starting'      // Initial
  | 'researching'   // Calling search tools
  | 'building'      // Creating document structure
  | 'saving'        // Saving to database
  | 'rendering'     // Generating artifact
  | 'complete'      // Done
  | 'error';        // Something failed
```

### Progress Messages by Phase

| Phase | Step | Message | Detail |
|-------|------|---------|--------|
| `starting` | 1 | "Starting research..." | "Analyzing your request" |
| `researching` | 2 | "Searching news sources..." | "Finding recent policy news" |
| `researching` | 3 | "Finding legislation..." | "Searching Congressional bills" |
| `researching` | 4 | "Looking up sponsors..." | "Finding relevant members" |
| `building` | 5 | "Building your document..." | "Organizing research results" |
| `rendering` | 6 | "Generating visual report..." | "Creating your artifact" |
| `complete` | 7 | "Complete!" | "Opening your report" |

### Implementation: Server-Side

Progress events are sent via Server-Sent Events (SSE) during the streaming response:

```typescript
// In the chat API route
async function generateDocumentWithProgress(
  request: DocumentRequest,
  sendProgress: (event: ProgressEvent) => void
) {
  // Step 1: Starting
  sendProgress({
    type: 'progress',
    step: 1,
    totalSteps: 7,
    message: 'Starting research...',
    detail: 'Analyzing your request',
    phase: 'starting'
  });

  // Step 2: Search news
  sendProgress({
    type: 'progress',
    step: 2,
    totalSteps: 7,
    message: 'Searching news sources...',
    detail: 'Finding recent policy news',
    phase: 'researching'
  });
  const newsResults = await geminiSearch(request.query);

  // Step 3: Search bills
  sendProgress({
    type: 'progress',
    step: 3,
    totalSteps: 7,
    message: 'Finding legislation...',
    detail: 'Searching Congressional bills',
    phase: 'researching'
  });
  const billResults = await searchBills(request.query);

  // Step 4: Search members
  sendProgress({
    type: 'progress',
    step: 4,
    totalSteps: 7,
    message: 'Looking up sponsors...',
    detail: 'Finding relevant members',
    phase: 'researching'
  });
  const memberResults = await searchMembers(request.query);

  // Step 5: Build document
  sendProgress({
    type: 'progress',
    step: 5,
    totalSteps: 7,
    message: 'Building your document...',
    detail: 'Organizing research results',
    phase: 'building'
  });
  const document = await buildDocument({ newsResults, billResults, memberResults });

  // Step 6: Render artifact
  sendProgress({
    type: 'progress',
    step: 6,
    totalSteps: 7,
    message: 'Generating visual report...',
    detail: 'Creating your artifact',
    phase: 'rendering'
  });
  const artifact = await renderArtifact(document);

  // Step 7: Complete
  sendProgress({
    type: 'progress',
    step: 7,
    totalSteps: 7,
    message: 'Complete!',
    detail: 'Opening your report',
    phase: 'complete'
  });

  return { document, artifact };
}
```

### Implementation: Client-Side

The client receives progress events and displays them:

```typescript
// In the chat component
interface DocumentProgress {
  step: number;
  totalSteps: number;
  message: string;
  detail?: string;
  phase: string;
}

const [documentProgress, setDocumentProgress] = useState<DocumentProgress | null>(null);

// When processing SSE events
if (event.type === 'progress') {
  setDocumentProgress({
    step: event.step,
    totalSteps: event.totalSteps,
    message: event.message,
    detail: event.detail,
    phase: event.phase
  });
}

// When complete or error, clear progress
if (event.type === 'artifact' || event.type === 'error') {
  setDocumentProgress(null);
}
```

### UI Component: Progress Indicator

```tsx
function DocumentProgressIndicator({ progress }: { progress: DocumentProgress }) {
  const percentage = (progress.step / progress.totalSteps) * 100;

  return (
    <div className="document-progress">
      {/* Progress bar */}
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Step indicator */}
      <div className="progress-steps">
        Step {progress.step} of {progress.totalSteps}
      </div>

      {/* Message */}
      <div className="progress-message">
        {progress.message}
      </div>

      {/* Detail */}
      {progress.detail && (
        <div className="progress-detail">
          {progress.detail}
        </div>
      )}

      {/* Phase icon */}
      <PhaseIcon phase={progress.phase} />
    </div>
  );
}

function PhaseIcon({ phase }: { phase: string }) {
  switch (phase) {
    case 'researching':
      return <SearchIcon className="animate-pulse" />;
    case 'building':
      return <DocumentIcon className="animate-pulse" />;
    case 'rendering':
      return <SparklesIcon className="animate-spin" />;
    case 'complete':
      return <CheckIcon className="text-green-500" />;
    case 'error':
      return <XIcon className="text-red-500" />;
    default:
      return <Loader2 className="animate-spin" />;
  }
}
```

### Error Handling

If any step fails, send an error event:

```typescript
try {
  // ... processing
} catch (error) {
  sendProgress({
    type: 'progress',
    step: currentStep,
    totalSteps: 7,
    message: 'Error occurred',
    detail: error.message,
    phase: 'error'
  });
}
```

### Estimated Time Display

You can also estimate remaining time based on average step durations:

```typescript
const STEP_ESTIMATES_MS = {
  1: 500,     // Starting
  2: 3000,    // News search
  3: 2000,    // Bill search
  4: 2000,    // Member search
  5: 1000,    // Building
  6: 5000,    // Rendering
  7: 500      // Complete
};

function estimateRemainingTime(currentStep: number): number {
  let remaining = 0;
  for (let i = currentStep; i <= 7; i++) {
    remaining += STEP_ESTIMATES_MS[i];
  }
  return remaining;
}

// Display: "About 10 seconds remaining..."
```

---

## Summary

The Document-First Architecture provides:

1. **Consistency** - Predictable document structure
2. **Persistence** - Documents saved for later access
3. **Debugging** - Inspect what data created any artifact
4. **Flexibility** - Easy to add new section and document types
5. **Reusability** - Regenerate artifacts from existing documents

The flow is:

```
Research → Structure → Save → Render
```

This separates concerns and makes the system more reliable and maintainable.
