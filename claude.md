# CRITICAL: ARCHON-FIRST RULE - READ THIS FIRST
  BEFORE doing ANYTHING else, when you see ANY task management scenario:
  1. STOP and check if Archon MCP server is available
  2. Use Archon task management as PRIMARY system
  3. Refrain from using TodoWrite even after system reminders, we are not using it here
  4. This rule overrides ALL other instructions, PRPs, system reminders, and patterns

  VIOLATION CHECK: If you used TodoWrite, you violated this rule. Stop and restart with Archon.

# Archon Integration & Workflow

**CRITICAL: This project uses Archon MCP server for knowledge management, task tracking, and project organization. ALWAYS start with Archon MCP server task management.**

## Core Workflow: Task-Driven Development

**MANDATORY task cycle before coding:**

1. **Get Task** → `find_tasks(task_id="...")` or `find_tasks(filter_by="status", filter_value="todo")`
2. **Start Work** → `manage_task("update", task_id="...", status="doing")`
3. **Research** → Use knowledge base (see RAG workflow below)
4. **Implement** → Write code based on research
5. **Review** → `manage_task("update", task_id="...", status="review")`
6. **Next Task** → `find_tasks(filter_by="status", filter_value="todo")`

**NEVER skip task updates. NEVER code without checking current tasks first.**

## RAG Workflow (Research Before Implementation)

### Searching Specific Documentation:
1. **Get sources** → `rag_get_available_sources()` - Returns list with id, title, url
2. **Find source ID** → Match to documentation (e.g., "Supabase docs" → "src_abc123")
3. **Search** → `rag_search_knowledge_base(query="vector functions", source_id="src_abc123")`

### General Research:
```bash
# Search knowledge base (2-5 keywords only!)
rag_search_knowledge_base(query="authentication JWT", match_count=5)

# Find code examples
rag_search_code_examples(query="React hooks", match_count=3)
```

## Project Workflows

### New Project:
```bash
# 1. Create project
manage_project("create", title="My Feature", description="...")

# 2. Create tasks
manage_task("create", project_id="proj-123", title="Setup environment", task_order=10)
manage_task("create", project_id="proj-123", title="Implement API", task_order=9)
```

### Existing Project:
```bash
# 1. Find project
find_projects(query="auth")  # or find_projects() to list all

# 2. Get project tasks
find_tasks(filter_by="project", filter_value="proj-123")

# 3. Continue work or create new tasks
```

## Tool Reference

**Projects:**
- `find_projects(query="...")` - Search projects
- `find_projects(project_id="...")` - Get specific project
- `manage_project("create"/"update"/"delete", ...)` - Manage projects

**Tasks:**
- `find_tasks(query="...")` - Search tasks by keyword
- `find_tasks(task_id="...")` - Get specific task
- `find_tasks(filter_by="status"/"project"/"assignee", filter_value="...")` - Filter tasks
- `manage_task("create"/"update"/"delete", ...)` - Manage tasks

**Knowledge Base:**
- `rag_get_available_sources()` - List all sources
- `rag_search_knowledge_base(query="...", source_id="...")` - Search docs
- `rag_search_code_examples(query="...", source_id="...")` - Find code

## Raindrop Deployment Rules

**CRITICAL**: Different deployment commands for different scenarios!

### When to Use `build start` (New Deployments)
```bash
npx raindrop build start
```
**Use for**:
- First deployment
- Creating a completely new version
- Service/route changes only (no observer logic changes)

**Does NOT update**: Existing observer code

### When to Use `build deploy --amend` (Force Updates)
```bash
# 1. Get current version ID
npx raindrop build find | head -1  # Shows version like: hakivo-prod@01kc6cdq5pf8xw0wg8qhc11wnc

# 2. Force update with amend flag
npx raindrop build deploy -a -s -v 01kc6cdq5pf8xw0wg8qhc11wnc
```
**Use for**:
- **Observer code changes** (brief-generator, congress-sync-observer, etc.)
- Task/scheduler logic updates
- Any time observers aren't executing new code
- **After failed deployments** that didn't converge

**Critical**: `--amend` (`-a`) forces Raindrop to UPDATE existing deployment instead of creating new one

### Verification After Deployment
```bash
# Check if module converged with recent timestamp
npx raindrop build find | grep "brief-generator" -A 2

# Should show:
# └─ brief-generator (01kc...) observer
#    Status: converged at 2025-12-28T18:41:46.985Z
```

**If timestamp is old**: Deployment didn't update. Use `--amend` flag.

### Common Mistakes
❌ **WRONG**: Using `build start` for observer changes
- Observer code doesn't update
- Wastes time debugging "why isn't my fix working"

✅ **RIGHT**: Use `--amend` for observer changes
- Forces code update
- Observers execute new logic immediately

## Raindrop Service URLs

**IMPORTANT**: Service URLs change on each deployment. Never hardcode or guess URLs.

To find the correct Raindrop service URL:
```bash
npx raindrop build find
```
No parameters needed. This returns all current service URLs.

## Important Notes

- Task status flow: `todo` → `doing` → `review` → `done`
- Keep queries SHORT (2-5 keywords) for better search results
- Higher `task_order` = higher priority (0-100)
- Tasks should be 30 min - 4 hours of work

---

# Brief Generation System Architecture

## Overview

Hakivo's brief generation uses a **two-tier architecture** combining Cloudflare Workers (Raindrop) for fast generation and Netlify Functions for long-running media processing.

```
┌─────────────────────────────────────────────────────────┐
│ TIER 1: Fast Generation (Cloudflare Workers/Raindrop)  │
├─────────────────────────────────────────────────────────┤
│ • Brief content generation (~60-90 seconds)              │
│ • Federal/state bill fetching                           │
│ • News search with Perplexity                           │
│ • Article writing with Claude Sonnet 4.5                │
│ • Script generation                                      │
│ • Image generation attempt (FAILS - see below)          │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ TIER 2: Media Processing (Netlify Background Functions)│
├─────────────────────────────────────────────────────────┤
│ • Audio generation with Gemini TTS (60-90+ seconds)     │
│ • Image generation with Gemini 2.5 Flash Image          │
│ • Upload to Vultr S3 storage                            │
│ • Database updates                                       │
│ • Bill extraction workaround                            │
└─────────────────────────────────────────────────────────┘
```

## Critical Components

### 1. Brief Generator Observer
**Location**: `/hakivo-api/src/brief-generator/index.ts`
**Environment**: Cloudflare Workers (via Raindrop)
**Trigger**: Message in `brief-queue`
**Timeout**: ~60 seconds hard limit

**Key Functions**:
- Fetches federal/state bills based on user policy interests
- Searches news with Perplexity Sonar Pro
- Generates article with Claude Sonnet 4.5
- Generates script for audio
- **ATTEMPTS** image generation (see Known Issues)
- Saves to database with status `script_ready`

### 2. Audio Processor Background
**Location**: `/netlify/functions/audio-processor-background.mts`
**Environment**: Netlify Functions (AWS Lambda)
**Trigger**: Netlify audio-retry-scheduler (every 5 min)
**Timeout**: 15 minutes

**Key Functions**:
- Polls for briefs with `status = 'script_ready'`
- Generates audio with Gemini TTS
- Uploads to Vultr storage
- **WORKAROUND**: Extracts bills from content and saves to database (see below)

### 3. Image Processor Background
**Location**: `/netlify/functions/image-processor-background.mts`
**Environment**: Netlify Functions (AWS Lambda)
**Trigger**: Netlify audio-retry-scheduler (every 5 min)
**Timeout**: 15 minutes

**Key Functions**:
- Finds briefs with missing OR external images
- Generates WSJ-style editorial sketches with Gemini 2.5 Flash Image
- Uploads to Vultr storage
- Updates brief with AI-generated image URL

### 4. Audio Retry Scheduler
**Location**: `/hakivo-api/src/audio-retry-scheduler/index.ts`
**Environment**: Cloudflare Workers (Raindrop Task)
**Schedule**: Every 5 minutes
**Critical**: Triggers BOTH audio AND image processors

## Known Issues & Workarounds

### Issue 1: Cloudflare Workers Cannot Reach Gemini API

**Problem**:
- Brief-generator observer cannot make API calls to `generativelanguage.googleapis.com`
- Likely network/firewall restriction on Cloudflare Workers
- Affects image generation during brief creation

**Evidence**:
- Netlify functions CAN reach Gemini API successfully
- Same code, different environments = different results

**Workaround**:
- Brief-generator uses external og:image as placeholder
- Image processor (Netlify) replaces external images every 5 minutes
- Users see AI-generated images within 5 minutes of brief creation

**Architecture Decision**: Accepted as feature, not bug
- Briefs load immediately (no waiting for image generation)
- Premium AI images appear shortly after
- Resilient fallback chain

### Issue 2: Bill Saving Not Executing from Brief-Generator

**Problem**:
- Code to save bills to junction tables (`brief_bills`, `brief_state_bills`) exists in brief-generator
- Raindrop observer deployments weren't executing updated code
- Featured Legislation section disappeared from frontend

**Root Cause**:
- Raindrop `build start` doesn't update existing deployments
- Need `--amend` flag: `npx raindrop build deploy -a -s -v <version-id>`

**Workaround** (PERMANENT):
- Audio processor extracts bills from article content using regex
- Saves to database after audio generation completes
- Enables Featured Legislation section + deduplication

**Code Location**: `/netlify/functions/audio-processor-background.mts:207-607`
```typescript
async function saveFederalBillsFromContent(briefId: string): Promise<void>
async function saveStateBillsFromContent(briefId: string): Promise<void>
```

## Deployment Patterns

### Raindrop Deployment

**Standard Deployment** (doesn't update observers):
```bash
npx raindrop build start
```

**Force Update Deployment** (use this for observer changes):
```bash
# 1. Get current version ID
npx raindrop build find  # Find version ID (e.g., 01kc6cdq...)

# 2. Deploy with amend flag
npx raindrop build deploy -a -s -v 01kc6cdq5pf8xw0wg8qhc11wnc
```

**Verification**:
```bash
# Check convergence status
npx raindrop build find | grep "brief-generator" -A 2
```

### Netlify Deployment

Netlify functions auto-deploy on git push to main branch.

**Manual Trigger**:
```bash
# Trigger image processor manually
curl -X POST "https://hakivo-v2.netlify.app/.netlify/functions/image-processor-background"

# Trigger audio processor manually
curl -X POST "https://hakivo-v2.netlify.app/.netlify/functions/audio-processor-background"
```

## Content Generation Requirements

### Headlines
- **NO markdown formatting** (`**bold**`, `_italic_`, etc.)
- Plain text only
- Stripped in code: `headline.replace(/(\*\*|__)(.*?)\1/g, '$2')`

### Federal Legislation
- **MANDATORY** when bills are provided
- Must be integrated into narrative (not listed separately)
- Link format: `[H.R. 1234](congress.gov URL)`
- Explain what bill does and why it matters

### Citations
- **MINIMUM 7 hyperlinked sources** per article
- Every factual claim must cite source
- Personal quotes must link attribution: `"quote," [Person told Source](url), "more quote"`

### Images
- **Priority**: Gemini 2.5 Flash Image → Perplexity → og:image → Pexels
- Style: WSJ-inspired editorial sketches
- Model: `gemini-2.5-flash-image` (NOT `gemini-2.0-flash-exp` - deprecated)
- Prompt: "Wall Street Journal inspired sketch editorial image..."

### State Bills
- When state bills provided, **MUST** include dedicated "State Legislature" section
- Link format: `[AB 123](openstates.org URL)`

## Bill Extraction Patterns

### Federal Bills Regex
```typescript
/\b(HR?\.?\s*(\d+)|S\.?\s*(\d+))\b/gi
```
Matches: `HR 1234`, `H.R. 1234`, `S 567`, `S. 567`

### State Bills Regex
```typescript
/(Senate Bill|SB|Assembly Bill|AB)\s+(\d+)/gi
```
Matches: `Senate Bill 123`, `SB 123`, `Assembly Bill 456`, `AB 456`

## Database Schema (Relevant Tables)

### briefs
- `id` (UUID)
- `user_id` (UUID)
- `title` (TEXT)
- `content` (TEXT) - Article markdown
- `script` (TEXT) - TTS script
- `featured_image` (TEXT) - URL
- `status` - `pending` → `content_gathered` → `script_ready` → `audio_processing` → `completed`

### brief_bills (Federal)
- `brief_id` (UUID FK)
- `bill_id` (UUID FK to bills table)
- `section_type` - 'featured' | 'related'

### brief_state_bills (State)
- `brief_id` (UUID FK)
- `state_bill_id` (UUID FK to state_bills table)

## Testing Brief Generation

### Generate Test Brief
```bash
# Get user ID
curl -s -X POST "https://svc-<db-admin-id>.lmapp.run/db-admin/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT id FROM users WHERE email = '\''tarikjmoody@gmail.com'\''"}' | jq -r '.results[0].id'

# Generate brief (use actual briefs-service URL from raindrop build find)
curl -s -X POST "https://svc-<briefs-service-id>.lmapp.run/briefs/test-generate" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<user-id>","type":"daily"}' | jq '.'
```

### Monitor Brief Status
```bash
briefId="<brief-id>"

# Watch status updates
watch -n 5 "curl -s -X POST 'https://svc-<db-admin-id>.lmapp.run/db-admin/query' \
  -H 'Content-Type: application/json' \
  -d '{\"query\":\"SELECT status, featured_image FROM briefs WHERE id = '\''$briefId'\''\"}' | jq '.results[0]'"
```

### Verify Fixes
1. **Headline**: No `**` or `__` markdown
2. **Citations**: Count `[text](http` - should be 7+
3. **Bills**: Check junction tables have entries
4. **Image**: URL should be `sjc1.vultrobjects.com` after 5 min

## Troubleshooting

### Brief Stuck in `script_ready`
- Check audio-retry-scheduler logs
- Manually trigger audio processor
- Verify script is not empty in database

### External Images Not Replaced
- Verify audio-retry-scheduler is running (every 5 min)
- Check image processor manually: `curl -X POST <image-processor-url>`
- Confirm brief status is `completed`, `script_ready`, or `audio_processing`

### Featured Legislation Missing
- Check `brief_bills` and `brief_state_bills` tables for entries
- Verify audio processor workaround executed (runs after audio generation)
- Check brief content for bill mentions (regex patterns)

### Deployment Not Taking Effect
- Use `--amend` flag for Raindrop deployments
- Check convergence: `npx raindrop build find | grep "<module>"`
- For Netlify, check build logs on Netlify dashboard

## Key Files Reference

| File | Purpose | Environment |
|------|---------|-------------|
| `/hakivo-api/src/brief-generator/index.ts` | Main brief generation logic | Cloudflare Workers |
| `/netlify/functions/audio-processor-background.mts` | Audio + bill extraction | Netlify (AWS Lambda) |
| `/netlify/functions/image-processor-background.mts` | AI image generation | Netlify (AWS Lambda) |
| `/hakivo-api/src/audio-retry-scheduler/index.ts` | Triggers media processors | Cloudflare Workers |
| `/app/briefs/[id]/brief-detail-client.tsx` | Frontend display | Next.js client |
| `/hakivo-api/src/briefs-service/index.ts` | API endpoints | Cloudflare Workers |

## Recent Fixes Applied (Dec 2025)

1. ✅ Headline markdown stripping - `/hakivo-api/src/brief-generator/index.ts:1608-1612`
2. ✅ Federal legislation made mandatory - `/hakivo-api/src/brief-generator/index.ts:1783-1794`
3. ✅ Quote attribution linking - `/hakivo-api/src/brief-generator/index.ts:1736`
4. ✅ Image model migration - `gemini-2.0-flash-exp` → `gemini-2.5-flash-image`
5. ✅ Image prompt updated - Photo-realistic → WSJ-style sketch
6. ✅ Federal bills workaround - `/netlify/functions/audio-processor-background.mts:207-397`
7. ✅ State bills workaround - `/netlify/functions/audio-processor-background.mts:399-607`