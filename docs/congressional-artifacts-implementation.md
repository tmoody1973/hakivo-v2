# Congressional Artifacts: Document Generation System

**Purpose:** Enable journalists, advocacy groups, educators, and students to create professional documents, reports, and presentations from the Congressional Assistant using Thesys.dev Artifacts
**Date:** December 2025
**Status:** Implementation Specification

---

## Executive Summary

This feature extends the Hakivo Congressional Assistant with document generation capabilities powered by Thesys.dev Artifacts. Users can create:

- **Reports** - Bill analysis, representative scorecards, policy briefings
- **Presentations** - Slide decks for classes, advocacy campaigns, newsroom briefings
- **Export-ready documents** - Professional-quality outputs for external use

---

## Target Audience Use Cases

### Journalists

| Artifact | Use Case | Content Source |
|----------|----------|----------------|
| **Bill Analysis Report** | Deep dive for story research | Bill data + AI analysis |
| **Rep Voting Record Deck** | Visual for TV segment | Voting history + charts |
| **Congressional Comparison** | Side-by-side rep comparison | Multiple rep data |
| **Issue Brief** | Background for story pitch | Topic-filtered bills |
| **Source Pack** | Expert contacts + key facts | Stakeholder analysis |

**Example Prompts:**
- "Create a report on Senator Smith's voting record on healthcare bills"
- "Generate a presentation comparing the 5 key climate bills this session"
- "Build a briefing document on HR 1234 for my editor"

### Advocacy Groups

| Artifact | Use Case | Content Source |
|----------|----------|----------------|
| **Campaign Deck** | Mobilize supporters | Bill + talking points |
| **Legislator Scorecard** | Hold reps accountable | Voting records |
| **Call-to-Action Brief** | Phone banking scripts | Bill impact + contact info |
| **Coalition Report** | Share with partner orgs | Multi-bill analysis |
| **Testimony Template** | Committee hearing prep | Bill analysis + arguments |

**Example Prompts:**
- "Create a presentation for our climate advocacy meeting on the Clean Energy Act"
- "Generate a scorecard report for all Wisconsin representatives on environmental votes"
- "Build talking points deck for volunteers calling about HR 5678"

### Educators

| Artifact | Use Case | Content Source |
|----------|----------|----------------|
| **Lesson Plan** | Classroom teaching | Bill + civics context |
| **Student Handout** | Simplified explanation | Plain-language summary |
| **Comparison Activity** | Critical thinking exercise | Multiple perspectives |
| **Current Events Deck** | Weekly civics update | Trending legislation |
| **Research Guide** | Student project starter | Sources + methodology |

**Example Prompts:**
- "Create a lesson plan deck about how a bill becomes a law using HR 1234 as an example"
- "Generate a student-friendly report explaining the debate over immigration policy"
- "Build a presentation comparing Democratic and Republican positions on the budget"

### Students

| Artifact | Use Case | Content Source |
|----------|----------|----------------|
| **Research Paper Outline** | Academic assignment | Bill analysis + sources |
| **Presentation for Class** | Oral presentation | Key points + visuals |
| **Debate Prep** | Model UN / Debate team | Arguments for/against |
| **Infographic Brief** | Visual learning | Statistics + impacts |
| **Bibliography Report** | Source documentation | Citations + links |

**Example Prompts:**
- "Create a presentation about my representative's first 100 days for Government class"
- "Generate a debate prep report with arguments for and against the minimum wage bill"
- "Build a research outline on federal education policy for my term paper"

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONGRESSIONAL ASSISTANT                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     Chat Interface                         │  │
│  │  User: "Create a report on HR 1234 for my news story"    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              ARTIFACT GENERATION SERVICE                   │  │
│  │                                                            │  │
│  │  1. Parse user request                                    │  │
│  │  2. Gather data from Hakivo services                      │  │
│  │  3. Build context + system prompt                         │  │
│  │  4. Call Thesys Artifact API                              │  │
│  │  5. Stream response to frontend                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              ARTIFACT RENDERER (C1Component)               │  │
│  │                                                            │  │
│  │  - Real-time streaming display                            │  │
│  │  - Edit/refine capability                                 │  │
│  │  - Export options (PDF, PPTX, etc.)                       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Prompt
    │
    ▼
┌─────────────────────────────────────┐
│  Intent Classification              │
│  - Artifact type (report/slides)    │
│  - Subject (bill/rep/topic)         │
│  - Audience (journalist/student)    │
│  - Style (formal/casual/academic)   │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Data Gathering                     │
│  - bills-service: bill details      │
│  - members-service: rep data        │
│  - dashboard-service: voting records│
│  - SmartBucket: full bill text      │
│  - SmartMemory: conversation context│
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Thesys Artifact API                │
│  POST https://api.thesys.dev/v1/artifact│
│  model: c1/artifact/v-20251030      │
│  metadata: { c1_artifact_type }     │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Streaming Response                 │
│  - C1 DSL content                   │
│  - Rendered via C1Component         │
│  - Real-time updates                │
└─────────────────────────────────────┘
```

---

## Artifact Templates

### Report Templates

#### 1. Bill Analysis Report

```typescript
const billAnalysisTemplate = {
  type: 'report',
  sections: [
    'Executive Summary',
    'Bill Overview',
    'Current Status',
    'Key Provisions',
    'Stakeholder Impact',
    'Arguments For',
    'Arguments Against',
    'Passage Likelihood',
    'Related Legislation',
    'Sources & Citations'
  ],
  data_requirements: [
    'bill_details',
    'bill_analysis',
    'sponsor_info',
    'cosponsors',
    'committee_status',
    'vote_history'
  ]
};
```

#### 2. Representative Scorecard

```typescript
const repScorecardTemplate = {
  type: 'report',
  sections: [
    'Representative Profile',
    'Voting Summary',
    'Key Votes by Issue',
    'Bill Sponsorship',
    'Committee Assignments',
    'Attendance Record',
    'Bipartisan Score',
    'Promise Alignment (if available)',
    'Contact Information'
  ],
  data_requirements: [
    'member_details',
    'voting_record',
    'sponsored_bills',
    'committee_data',
    'attendance_stats'
  ]
};
```

#### 3. Issue Briefing

```typescript
const issueBriefingTemplate = {
  type: 'report',
  sections: [
    'Issue Overview',
    'Current Legislative Landscape',
    'Key Bills This Session',
    'Major Players',
    'Recent Developments',
    'Timeline of Events',
    'What to Watch',
    'Resources for Further Research'
  ],
  data_requirements: [
    'bills_by_topic',
    'recent_votes',
    'news_articles',
    'committee_hearings'
  ]
};
```

### Presentation Templates

#### 1. Bill Overview Deck

```typescript
const billOverviewDeck = {
  type: 'slides',
  slides: [
    { title: 'Title Slide', content: 'bill_title, sponsor, date' },
    { title: 'What This Bill Does', content: 'plain_language_summary' },
    { title: 'Key Provisions', content: 'bullet_points_3_5' },
    { title: 'Who It Affects', content: 'stakeholder_groups' },
    { title: 'The Debate', content: 'for_against_comparison' },
    { title: 'Where It Stands', content: 'status_timeline' },
    { title: 'What Happens Next', content: 'next_steps' },
    { title: 'Take Action', content: 'contact_info_resources' }
  ],
  style: 'professional',
  max_slides: 10
};
```

#### 2. Civics Lesson Deck

```typescript
const civicsLessonDeck = {
  type: 'slides',
  slides: [
    { title: 'Learning Objectives', content: 'what_students_will_learn' },
    { title: 'Key Vocabulary', content: 'terms_definitions' },
    { title: 'Real-World Example', content: 'bill_as_case_study' },
    { title: 'How Congress Works', content: 'process_explanation' },
    { title: 'Follow the Bill', content: 'step_by_step_journey' },
    { title: 'Discussion Questions', content: 'critical_thinking' },
    { title: 'Activity', content: 'hands_on_exercise' },
    { title: 'Review & Homework', content: 'summary_assignment' }
  ],
  style: 'educational',
  reading_level: 'adjustable' // 8th grade, high school, college
};
```

#### 3. Advocacy Campaign Deck

```typescript
const advocacyCampaignDeck = {
  type: 'slides',
  slides: [
    { title: 'The Issue', content: 'problem_statement' },
    { title: 'Why Now', content: 'urgency_timeline' },
    { title: 'The Solution', content: 'bill_as_solution' },
    { title: 'Who Supports This', content: 'coalition_endorsements' },
    { title: 'Opposition Arguments', content: 'counter_points' },
    { title: 'Your Rep\'s Position', content: 'local_angle' },
    { title: 'How You Can Help', content: 'action_items' },
    { title: 'Contact Scripts', content: 'talking_points' }
  ],
  style: 'persuasive',
  tone: 'mobilizing'
};
```

---

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1-2)

#### 1.1 Create Artifact Service

**File:** `hakivo-api/src/artifact-service/index.ts`

```typescript
import { Hono } from 'hono';
import OpenAI from 'openai';

const app = new Hono();

// Initialize Thesys client
const getThesysClient = (apiKey: string) => new OpenAI({
  baseURL: 'https://api.thesys.dev/v1/artifact',
  apiKey,
});

// Generate artifact endpoint
app.post('/generate', async (c) => {
  const {
    artifactType,    // 'report' | 'slides'
    template,        // template identifier
    subject,         // bill_id, rep_id, topic, etc.
    audience,        // journalist, educator, student, advocate
    customPrompt,    // additional user instructions
    conversationId   // for context from SmartMemory
  } = await c.req.json();

  // 1. Gather data based on subject type
  const data = await gatherArtifactData(subject, c.env);

  // 2. Build system prompt based on audience
  const systemPrompt = buildSystemPrompt(template, audience, data);

  // 3. Call Thesys Artifact API
  const client = getThesysClient(c.env.THESYS_API_KEY);

  const artifact = await client.chat.completions.create({
    model: 'c1/artifact/v-20251030',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: customPrompt || `Generate ${artifactType} about ${subject}` }
    ],
    metadata: {
      thesys: JSON.stringify({
        c1_artifact_type: artifactType,
        id: `hakivo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      })
    },
    stream: true
  });

  // 4. Stream response back to client
  return streamArtifactResponse(artifact, c);
});

// Edit existing artifact
app.post('/edit', async (c) => {
  const { artifactId, existingContent, editInstructions } = await c.req.json();

  const client = getThesysClient(c.env.THESYS_API_KEY);

  const edited = await client.chat.completions.create({
    model: 'c1/artifact/v-20251030',
    messages: [
      { role: 'system', content: 'Edit the following artifact based on user instructions.' },
      { role: 'assistant', content: existingContent },
      { role: 'user', content: editInstructions }
    ],
    metadata: {
      thesys: JSON.stringify({
        c1_artifact_type: 'report', // or slides
        id: artifactId
      })
    },
    stream: true
  });

  return streamArtifactResponse(edited, c);
});

export default app;
```

#### 1.2 Add to Raindrop Manifest

```hcl
// In raindrop.manifest

service "artifact-service" {
  build = "./src/artifact-service"

  bindings = [
    "bind:kv:session-cache",
    "bind:smartmemory:congressional_memory",
    "bind:smartbucket:bill-texts",
    "bind:db:app-db",
    "secret:THESYS_API_KEY"
  ]

  public_routes = {
    "/artifact-service/*" = "/*"
  }
}
```

#### 1.3 Environment Variables

Add to Raindrop env:
```
THESYS_API_KEY=your_thesys_api_key
```

### Phase 2: Frontend Integration (Week 2-3)

#### 2.1 Install Thesys SDK

```bash
npm install @anthropic-ai/sdk  # or thesys-specific package if available
```

#### 2.2 Create Artifact Viewer Component

**File:** `components/artifacts/artifact-viewer.tsx`

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { C1Component } from '@thesys/react'; // hypothetical import

interface ArtifactViewerProps {
  artifactId: string;
  content: string;
  type: 'report' | 'slides';
  onEdit: (instructions: string) => void;
  isStreaming: boolean;
}

export function ArtifactViewer({
  artifactId,
  content,
  type,
  onEdit,
  isStreaming
}: ArtifactViewerProps) {
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');

  return (
    <div className="artifact-container">
      {/* Streaming indicator */}
      {isStreaming && (
        <div className="streaming-indicator">
          <span className="animate-pulse">Generating...</span>
        </div>
      )}

      {/* C1 Component renders the artifact */}
      <C1Component
        content={content}
        artifactType={type}
        streaming={isStreaming}
      />

      {/* Action bar */}
      <div className="artifact-actions flex gap-2 mt-4">
        <button onClick={() => setEditMode(true)}>
          Edit
        </button>
        <button onClick={() => exportArtifact(content, 'pdf')}>
          Export PDF
        </button>
        {type === 'slides' && (
          <button onClick={() => exportArtifact(content, 'pptx')}>
            Export PowerPoint
          </button>
        )}
        <button onClick={() => copyToClipboard(content)}>
          Copy
        </button>
        <button onClick={() => shareArtifact(artifactId)}>
          Share Link
        </button>
      </div>

      {/* Edit modal */}
      {editMode && (
        <div className="edit-modal">
          <textarea
            value={editInstructions}
            onChange={(e) => setEditInstructions(e.target.value)}
            placeholder="Describe what you want to change..."
          />
          <button onClick={() => {
            onEdit(editInstructions);
            setEditMode(false);
            setEditInstructions('');
          }}>
            Apply Changes
          </button>
        </div>
      )}
    </div>
  );
}
```

#### 2.3 Integrate into Chat Interface

**File:** `components/chat/artifact-trigger.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Presentation,
  GraduationCap,
  Newspaper
} from 'lucide-react';

interface ArtifactTriggerProps {
  onGenerate: (options: ArtifactOptions) => void;
  contextData: {
    billId?: string;
    repId?: string;
    topic?: string;
  };
}

export function ArtifactTrigger({ onGenerate, contextData }: ArtifactTriggerProps) {
  const [showOptions, setShowOptions] = useState(false);

  const templates = [
    {
      id: 'bill-analysis',
      name: 'Bill Analysis Report',
      icon: FileText,
      type: 'report',
      audience: 'general'
    },
    {
      id: 'news-brief',
      name: 'News Brief',
      icon: Newspaper,
      type: 'report',
      audience: 'journalist'
    },
    {
      id: 'lesson-deck',
      name: 'Lesson Plan Deck',
      icon: GraduationCap,
      type: 'slides',
      audience: 'educator'
    },
    {
      id: 'advocacy-deck',
      name: 'Advocacy Deck',
      icon: Presentation,
      type: 'slides',
      audience: 'advocate'
    }
  ];

  return (
    <div className="artifact-trigger">
      <Button
        variant="outline"
        onClick={() => setShowOptions(!showOptions)}
      >
        <FileText className="mr-2 h-4 w-4" />
        Create Document
      </Button>

      {showOptions && (
        <div className="template-grid grid grid-cols-2 gap-2 mt-2">
          {templates.map(template => (
            <Button
              key={template.id}
              variant="secondary"
              className="flex flex-col items-center p-4 h-auto"
              onClick={() => {
                onGenerate({
                  template: template.id,
                  type: template.type,
                  audience: template.audience,
                  subject: contextData
                });
                setShowOptions(false);
              }}
            >
              <template.icon className="h-6 w-6 mb-2" />
              <span className="text-sm">{template.name}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Phase 3: Template Library (Week 3-4)

#### 3.1 System Prompts by Audience

**File:** `hakivo-api/src/artifact-service/prompts.ts`

```typescript
export const audiencePrompts = {
  journalist: `
You are creating a document for a journalist researching a story.
- Lead with the most newsworthy angle
- Include direct quotes when available
- Provide context for complex legislative terms
- Highlight conflicts, controversies, and human impact
- Include suggested sources for follow-up
- Use AP style for formatting
- Be objective and balanced
- Include key dates and timeline
`,

  educator: `
You are creating educational content for a teacher or professor.
- Start with clear learning objectives
- Define key vocabulary terms
- Use the legislation as a real-world case study
- Include discussion questions
- Add activities or exercises
- Provide assessment ideas
- Adjust reading level as specified
- Connect to civics standards/curriculum
`,

  student: `
You are creating content for a student working on an assignment.
- Use clear, accessible language
- Explain legislative terms in simple words
- Provide structure for research/writing
- Include proper citations and sources
- Suggest additional research directions
- Break complex topics into digestible sections
- Avoid partisan language
`,

  advocate: `
You are creating content for an advocacy organization.
- Lead with the call to action
- Clearly state the organization's position
- Provide compelling talking points
- Include counter-arguments and rebuttals
- Make it easy to share and mobilize
- Include contact information and next steps
- Use persuasive but factual language
`,

  general: `
You are creating informative content for a general audience.
- Use plain language accessible to anyone
- Explain the significance and impact
- Provide balanced perspectives
- Include relevant context and background
- Make it engaging and informative
- Avoid jargon without explanation
`
};

export const templatePrompts = {
  'bill-analysis': `
Create a comprehensive bill analysis report with:
1. Executive Summary (2-3 paragraphs)
2. Bill Overview (official title, number, sponsor, status)
3. Key Provisions (bullet points)
4. Stakeholder Impact (who benefits, who's affected)
5. Arguments For (3-5 points with supporting evidence)
6. Arguments Against (3-5 points with supporting evidence)
7. Current Status & Next Steps
8. Related Legislation
9. Sources
`,

  'rep-scorecard': `
Create a representative scorecard/report card with:
1. Profile Summary (name, party, state, tenure)
2. Voting Statistics (attendance, party alignment, bipartisan score)
3. Key Votes by Issue Area (table format)
4. Bills Sponsored (notable legislation)
5. Committee Assignments
6. Recent Activity
7. Contact Information
`,

  'issue-briefing': `
Create an issue briefing document with:
1. Issue Overview (what's at stake)
2. Legislative Landscape (key bills, where they stand)
3. Key Players (sponsors, opponents, stakeholders)
4. Recent Developments (timeline)
5. What to Watch (upcoming votes, hearings)
6. Background Context
7. Resources for Further Research
`,

  'lesson-deck': `
Create an educational slide deck with:
1. Title Slide
2. Learning Objectives (3-4 goals)
3. Key Vocabulary (terms students need)
4. Real-World Context (why this matters)
5. Case Study: [Bill] (2-3 slides)
6. How Congress Works (relevant process)
7. Discussion Questions
8. Activity/Exercise
9. Review & Key Takeaways
10. Homework/Next Steps
`,

  'advocacy-deck': `
Create an advocacy slide deck with:
1. Title Slide with Call to Action
2. The Problem (why action is needed)
3. The Solution (the legislation)
4. Who Benefits (impact stories)
5. Common Concerns Addressed
6. Your Representative's Position
7. How to Take Action (specific steps)
8. Sample Scripts/Talking Points
9. Resources & Contact Info
`,

  'news-brief': `
Create a journalist-ready brief with:
1. Headline & Lede (newsworthy angle)
2. Key Facts (who, what, when, where, why)
3. Background & Context
4. Stakeholder Perspectives (multiple viewpoints)
5. Timeline of Events
6. What's Next
7. Suggested Sources & Experts
8. Related Coverage Links
`
};
```

#### 3.2 Data Gathering Functions

**File:** `hakivo-api/src/artifact-service/data-gathering.ts`

```typescript
export async function gatherArtifactData(
  subject: SubjectIdentifier,
  env: Env
): Promise<ArtifactData> {
  const data: ArtifactData = {};

  // Determine subject type and fetch relevant data
  if (subject.billId) {
    // Federal bill
    if (subject.billId.startsWith('hr') || subject.billId.startsWith('s')) {
      data.bill = await fetchBillDetails(subject.billId, env);
      data.analysis = await fetchBillAnalysis(subject.billId, env);
      data.sponsor = await fetchMemberDetails(data.bill.sponsorId, env);
      data.cosponsors = await fetchCosponsors(subject.billId, env);
      data.votes = await fetchBillVotes(subject.billId, env);
      data.fullText = await fetchBillText(subject.billId, env); // from SmartBucket
    }
    // State bill
    else {
      data.stateBill = await fetchStateBillDetails(subject.billId, env);
      data.stateAnalysis = await fetchStateBillAnalysis(subject.billId, env);
    }
  }

  if (subject.repId) {
    data.representative = await fetchMemberDetails(subject.repId, env);
    data.votingRecord = await fetchVotingRecord(subject.repId, env);
    data.sponsoredBills = await fetchSponsoredBills(subject.repId, env);
    data.committees = await fetchCommitteeAssignments(subject.repId, env);
  }

  if (subject.topic) {
    data.topicBills = await fetchBillsByTopic(subject.topic, env);
    data.topicNews = await fetchNewsByTopic(subject.topic, env);
    data.trendingInTopic = await fetchTrendingBills(subject.topic, env);
  }

  // Get conversation context from SmartMemory
  if (subject.conversationId) {
    data.conversationContext = await getConversationContext(
      subject.conversationId,
      env
    );
  }

  return data;
}

async function fetchBillDetails(billId: string, env: Env) {
  const result = await env.APP_DB.prepare(`
    SELECT b.*,
           e.plain_summary, e.key_points, e.impact_analysis,
           a.arguments_for, a.arguments_against, a.passage_likelihood
    FROM bills b
    LEFT JOIN bill_enrichment e ON b.bill_id = e.bill_id
    LEFT JOIN bill_analysis a ON b.bill_id = a.bill_id
    WHERE b.bill_id = ?
  `).bind(billId).first();

  return result;
}

// ... additional fetch functions
```

### Phase 4: Export & Sharing (Week 4-5)

#### 4.1 Export Service

**File:** `app/api/artifacts/export/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import pptxgen from 'pptxgenjs';

export async function POST(request: NextRequest) {
  const { content, type, format, title } = await request.json();

  if (format === 'pdf') {
    const pdf = await generatePDF(content, title);
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${title}.pdf"`
      }
    });
  }

  if (format === 'pptx' && type === 'slides') {
    const pptx = await generatePPTX(content, title);
    return new NextResponse(pptx, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${title}.pptx"`
      }
    });
  }

  if (format === 'docx') {
    const docx = await generateDOCX(content, title);
    return new NextResponse(docx, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${title}.docx"`
      }
    });
  }

  return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
}
```

#### 4.2 Shareable Artifact URLs

**Database Schema:**

```sql
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT,  -- 'report' or 'slides'
  template TEXT,
  title TEXT,
  content TEXT,  -- C1 DSL content
  subject_type TEXT,  -- 'bill', 'rep', 'topic'
  subject_id TEXT,
  audience TEXT,
  is_public INTEGER DEFAULT 0,
  share_token TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  view_count INTEGER DEFAULT 0
);

CREATE INDEX idx_artifacts_share_token ON artifacts(share_token);
CREATE INDEX idx_artifacts_user ON artifacts(user_id);
```

**Share URL Route:**

**File:** `app/artifacts/[token]/page.tsx`

```typescript
import { ArtifactViewer } from '@/components/artifacts/artifact-viewer';

export default async function SharedArtifactPage({
  params
}: {
  params: { token: string }
}) {
  const artifact = await fetchArtifactByToken(params.token);

  if (!artifact || !artifact.is_public) {
    return <div>Artifact not found or not public</div>;
  }

  // Increment view count
  await incrementViewCount(artifact.id);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">{artifact.title}</h1>
      <ArtifactViewer
        artifactId={artifact.id}
        content={artifact.content}
        type={artifact.type}
        isStreaming={false}
        onEdit={() => {}} // Read-only for shared
      />
      <div className="mt-4 text-sm text-muted-foreground">
        Created with Hakivo Congressional Assistant
      </div>
    </div>
  );
}
```

---

## User Experience Flow

### In Chat Interface

```
┌─────────────────────────────────────────────────────────────┐
│  Congressional Assistant                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User: Tell me about HR 1234, the Clean Energy Act          │
│                                                              │
│  Assistant: HR 1234, the Clean Energy Act, was introduced   │
│  by Rep. Smith on March 15, 2025. It aims to...             │
│  [Full AI response about the bill]                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  📄 Create Document from this conversation             │ │
│  │                                                        │ │
│  │  ┌──────────────┐  ┌──────────────┐                   │ │
│  │  │ 📋 Report    │  │ 📊 Slides    │                   │ │
│  │  └──────────────┘  └──────────────┘                   │ │
│  │                                                        │ │
│  │  Choose your audience:                                 │ │
│  │  [Journalist] [Educator] [Student] [Advocate]         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  User: Create a presentation for my Government class        │
│                                                              │
│  [ARTIFACT GENERATING...]                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  📊 Clean Energy Act - Lesson Deck                     │ │
│  │  ════════════════════════════════════════════════════  │ │
│  │                                                        │ │
│  │  [Slide preview rendering in real-time...]            │ │
│  │                                                        │ │
│  │  ──────────────────────────────────────────────────── │ │
│  │  [✏️ Edit] [📥 PDF] [📥 PPTX] [🔗 Share] [📋 Copy]     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Standalone Artifact Generator

**Route:** `/artifacts/create`

```
┌─────────────────────────────────────────────────────────────┐
│  Create New Document                                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  What do you want to create?                                │
│  ┌─────────────┐  ┌─────────────┐                           │
│  │   Report    │  │   Slides    │                           │
│  └─────────────┘  └─────────────┘                           │
│                                                              │
│  Select a template:                                         │
│  ○ Bill Analysis Report                                     │
│  ○ Representative Scorecard                                 │
│  ○ Issue Briefing                                           │
│  ○ Custom (describe what you need)                          │
│                                                              │
│  Subject:                                                    │
│  [Search for a bill, representative, or topic...]           │
│                                                              │
│  Who is this for?                                           │
│  ○ Journalist  ○ Educator  ○ Student  ○ Advocate           │
│                                                              │
│  Additional instructions (optional):                        │
│  [                                                    ]     │
│                                                              │
│  [Generate Document]                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Pricing & Access

### Free Tier
- 3 artifacts per month
- Basic templates only
- No export (view only)
- Watermark on shared links

### Pro Tier ($12/month)
- Unlimited artifacts
- All templates
- PDF/PPTX/DOCX export
- Clean shared links
- Edit history

### Team/Education Tier (Future)
- Shared artifact library
- Collaboration features
- Custom branding
- LMS integration
- Bulk export

---

## Success Metrics

| Metric | Target (6 months) |
|--------|-------------------|
| Artifacts created | 1,000+ |
| Export downloads | 500+ |
| Shared artifact views | 5,000+ |
| Repeat creators | 40% of users |
| Educator signups | 100+ |
| Journalist signups | 50+ |

---

## Implementation Timeline

| Week | Milestone |
|------|-----------|
| 1 | Artifact service backend + Thesys integration |
| 2 | Basic frontend component (C1Component) |
| 3 | Template library (3 reports, 3 decks) |
| 4 | Export functionality (PDF, PPTX) |
| 5 | Sharing & public URLs |
| 6 | Chat integration + polish |
| 7 | Testing + documentation |
| 8 | Launch + feedback collection |

---

## Future Enhancements

1. **Collaborative Editing** - Multiple users on same artifact
2. **Version History** - Track changes over time
3. **Template Marketplace** - User-created templates
4. **API Access** - Programmatic artifact generation
5. **Brand Customization** - Custom colors, logos
6. **LMS Integration** - Canvas, Blackboard, Google Classroom
7. **CRM Integration** - Salesforce, HubSpot for advocacy orgs
8. **Analytics Dashboard** - Track artifact engagement

---

*Document maintained by Tarik Moody. Implementation tracked in Archon MCP.*
