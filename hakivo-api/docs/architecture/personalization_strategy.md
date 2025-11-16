# Personalization Strategy with Policy Interest Mapping

## Overview

Hakivo uses a **three-layer mapping system** to personalize content for users:
1. **User-friendly interests** - Simple categories users select in onboarding
2. **Congress.gov policy areas** - Official taxonomy for filtering bills
3. **Keywords** - Semantic terms for news search and content matching

## Policy Interest Mapping File

Location: `architecture/policy_interest_mapping.json`

This JSON file maps 12 user interests to Congress.gov policy areas and semantic keywords.

### Example Mapping:
```json
{
  "interest": "Environment & Energy",
  "policy_areas": [
    "Environmental Protection",
    "Energy",
    "Water Resources Development",
    "Public Lands and Natural Resources"
  ],
  "keywords": [
    "climate", "pollution", "renewables", "conservation",
    "clean water", "natural resources", "sustainability",
    "energy policy", "greenhouse gases"
  ]
}
```

## How Personalization Works

### 1. User Onboarding
```
Frontend (onboarding page):
  User selects interests: ["Environment & Energy", "Health & Social Welfare"]
       ↓
  POST /api/users/preferences
       ↓
  Stored in user_preferences.policy_interests (JSON array)
```

### 2. Bill Filtering (SQL Query)
```typescript
// bills-service: Filter bills by user's policy interests

// Load mapping
const mapping = require('./policy_interest_mapping.json');

// Get user's selected interests
const userInterests = ["Environment & Energy", "Health & Social Welfare"];

// Map to policy areas
const policyAreas = userInterests.flatMap(interest => {
  const entry = mapping.find(m => m.interest === interest);
  return entry ? entry.policy_areas : [];
});
// Result: ["Environmental Protection", "Energy", "Water Resources Development", ..., "Health", "Social Welfare", "Families"]

// SQL query with IN clause
const bills = await sql.query(`
  SELECT DISTINCT b.*
  FROM bills b
  JOIN bill_subjects bs ON b.id = bs.bill_id
  JOIN subjects s ON bs.subject_id = s.id
  WHERE s.name IN (${policyAreas.map(() => '?').join(',')})
    AND b.congress_id = 118
  ORDER BY b.latest_action_date DESC
  LIMIT 50
`, policyAreas);
```

### 3. News Search (Exa.ai with Keywords)
```typescript
// brief-generator: Search news with semantic keywords

// Load mapping
const mapping = require('./policy_interest_mapping.json');

// Get user's selected interests
const userInterests = ["Environment & Energy", "Health & Social Welfare"];

// Map to keywords
const keywords = userInterests.flatMap(interest => {
  const entry = mapping.find(m => m.interest === interest);
  return entry ? entry.keywords : [];
});
// Result: ["climate", "pollution", "renewables", ..., "healthcare", "insurance", "public health"]

// Search Exa.ai with combined keywords
const newsResults = await exaClient.search({
  query: keywords.join(' OR '),  // "climate OR pollution OR renewables OR healthcare..."
  numResults: 20,
  type: 'neural',
  category: 'news',
  startPublishedDate: getDateXDaysAgo(7)
});
```

### 4. Dashboard Recommendations
```typescript
// dashboard-service: Recommend bills based on trending topics in user's interests

async function getRecommendedBills(userId: string) {
  // 1. Get user's interests
  const prefs = await sql.query('SELECT policy_interests FROM user_preferences WHERE user_id = ?', [userId]);
  const userInterests = JSON.parse(prefs[0].policy_interests);

  // 2. Map to policy areas
  const mapping = require('./policy_interest_mapping.json');
  const policyAreas = userInterests.flatMap(interest => {
    const entry = mapping.find(m => m.interest === interest);
    return entry ? entry.policy_areas : [];
  });

  // 3. Find trending bills (most actions in last 7 days)
  const trendingBills = await sql.query(`
    SELECT
      b.id, b.title, b.bill_type, b.bill_number,
      COUNT(a.id) as recent_actions
    FROM bills b
    JOIN bill_subjects bs ON b.id = bs.bill_id
    JOIN subjects s ON bs.subject_id = s.id
    LEFT JOIN actions a ON b.id = a.bill_id
      AND a.action_date >= date('now', '-7 days')
    WHERE s.name IN (${policyAreas.map(() => '?').join(',')})
      AND b.congress_id = 118
    GROUP BY b.id
    HAVING recent_actions > 0
    ORDER BY recent_actions DESC
    LIMIT 10
  `, policyAreas);

  return trendingBills;
}
```

### 5. Brief Generation Script Personalization
```typescript
// brief-generator: Create personalized script based on user's interests

async function generateBriefScript(userId: string) {
  const mapping = require('./policy_interest_mapping.json');

  // Get user interests
  const prefs = await sql.query('SELECT policy_interests FROM user_preferences WHERE user_id = ?', [userId]);
  const userInterests = JSON.parse(prefs[0].policy_interests);

  // Get tracked bills with updates
  const updatedBills = await getUpdatedTrackedBills(userId);

  // Get relevant news using keywords
  const keywords = userInterests.flatMap(interest => {
    const entry = mapping.find(m => m.interest === interest);
    return entry ? entry.keywords : [];
  });

  const news = await exaClient.search({
    query: keywords.join(' OR '),
    numResults: 10
  });

  // Generate script with Claude
  const script = await claudeClient.generate({
    system: "You are a podcast host creating a personalized legislative briefing.",
    prompt: `
      Create a 7-9 minute podcast script about recent Congressional activity.

      User's interests: ${userInterests.join(', ')}

      Bills with recent updates:
      ${updatedBills.map(b => `- ${b.title}: ${b.latest_action_text}`).join('\n')}

      Related news:
      ${news.map(n => `- ${n.title}: ${n.summary}`).join('\n')}

      Make it conversational and focus on how these developments relate to ${userInterests[0]}.
    `
  });

  return script;
}
```

## Storing User Preferences

### Database Schema
```sql
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  policy_interests TEXT NOT NULL,  -- JSON array: ["Environment & Energy", "Health & Social Welfare"]
  briefing_time TEXT,
  briefing_days TEXT,
  playback_speed REAL DEFAULT 1.0,
  autoplay BOOLEAN DEFAULT TRUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Example Data
```json
{
  "user_id": "user_abc123",
  "policy_interests": ["Environment & Energy", "Health & Social Welfare", "Education & Science"],
  "briefing_time": "07:00",
  "briefing_days": ["Monday", "Wednesday", "Friday"]
}
```

## Benefits of This Approach

### 1. User-Friendly Categories
Users don't need to know Congress.gov taxonomy - they select simple, intuitive interests like "Environment & Energy"

### 2. Accurate Bill Filtering
Maps to official Congress.gov policy areas for precise SQL filtering:
```sql
WHERE subject IN ('Environmental Protection', 'Energy', 'Water Resources Development')
```

### 3. Semantic News Search
Keywords enable broad semantic search for related news:
```
"climate OR pollution OR renewables OR conservation"
```

### 4. Easy Updates
Single JSON file can be updated to:
- Add new interests
- Adjust policy area mappings
- Expand keyword lists
- No code changes needed

### 5. Cross-Service Consistency
All services (bills-service, brief-generator, dashboard-service) use same mapping for consistent personalization

## Implementation in Raindrop Services

### bills-service
```typescript
// src/index.ts
import policyMapping from '../architecture/policy_interest_mapping.json';

export async function getPersonalizedBills(req, res) {
  const { userId } = req.query;

  // Get user interests
  const prefs = await env.APP_DB.query(
    'SELECT policy_interests FROM user_preferences WHERE user_id = ?',
    [userId]
  );

  const userInterests = JSON.parse(prefs[0].policy_interests);

  // Map to policy areas
  const policyAreas = userInterests.flatMap(interest => {
    const entry = policyMapping.find(m => m.interest === interest);
    return entry ? entry.policy_areas : [];
  });

  // Query bills
  const bills = await env.APP_DB.query(`
    SELECT DISTINCT b.*, s.name as subject_name
    FROM bills b
    JOIN bill_subjects bs ON b.id = bs.bill_id
    JOIN subjects s ON bs.subject_id = s.id
    WHERE s.name IN (${policyAreas.map(() => '?').join(',')})
    ORDER BY b.latest_action_date DESC
    LIMIT 50
  `, policyAreas);

  res.json({ bills });
}
```

### brief-generator (Observer)
```typescript
// src/index.ts
import policyMapping from '../architecture/policy_interest_mapping.json';

export async function handleBriefRequest(message) {
  const { userId, briefType } = message;

  // Get user interests
  const prefs = await env.APP_DB.query(
    'SELECT policy_interests FROM user_preferences WHERE user_id = ?',
    [userId]
  );

  const userInterests = JSON.parse(prefs[0].policy_interests);

  // Get keywords for news search
  const keywords = userInterests.flatMap(interest => {
    const entry = policyMapping.find(m => m.interest === interest);
    return entry ? entry.keywords : [];
  });

  // Search news with Exa.ai
  const newsQuery = keywords.slice(0, 5).join(' OR ');  // Limit to top 5 keywords
  const news = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'x-api-key': env.EXA_API_KEY },
    body: JSON.stringify({
      query: newsQuery,
      numResults: 15,
      type: 'neural',
      category: 'news'
    })
  });

  // Generate script with personalized context
  const script = await generateScript(userInterests, news, updatedBills);

  // Continue with audio generation...
}
```

### dashboard-service
```typescript
// src/index.ts
import policyMapping from '../architecture/policy_interest_mapping.json';

export async function getDashboard(req, res) {
  const { userId } = req.query;

  // Get user interests
  const prefs = await env.APP_DB.query(
    'SELECT policy_interests FROM user_preferences WHERE user_id = ?',
    [userId]
  );

  const userInterests = JSON.parse(prefs[0].policy_interests);

  // Map to policy areas
  const policyAreas = userInterests.flatMap(interest => {
    const entry = policyMapping.find(m => m.interest === interest);
    return entry ? entry.policy_areas : [];
  });

  // Get recommended bills (trending in user's interests)
  const recommendations = await env.APP_DB.query(`
    SELECT b.*, COUNT(a.id) as action_count
    FROM bills b
    JOIN bill_subjects bs ON b.id = bs.bill_id
    JOIN subjects s ON bs.subject_id = s.id
    LEFT JOIN actions a ON b.id = a.bill_id
      AND a.action_date >= date('now', '-7 days')
    WHERE s.name IN (${policyAreas.map(() => '?').join(',')})
    GROUP BY b.id
    ORDER BY action_count DESC
    LIMIT 5
  `, policyAreas);

  res.json({
    recommendations,
    userInterests,
    upcomingBriefs: await getUpcomingBriefs(userId),
    trackedBills: await getTrackedBills(userId)
  });
}
```

## Example User Journey

### Day 1: Onboarding
1. User selects: `["Environment & Energy", "Health & Social Welfare"]`
2. Saved to `user_preferences.policy_interests`

### Day 2: Dashboard
1. Dashboard loads user's interests
2. Maps to policy areas: `["Environmental Protection", "Energy", ..., "Health", "Social Welfare"]`
3. Queries bills with those subjects
4. Shows 5 trending bills in user's interests

### Day 3: Daily Brief
1. brief-generator triggers at 7 AM
2. Maps interests to keywords: `["climate", "pollution", ..., "healthcare", "insurance"]`
3. Searches Exa.ai for news with those keywords
4. Generates script mentioning "environment and health" focus
5. User hears: "Good morning! Today's briefing focuses on your interests in environment and health..."

### Day 4: Bill Search
1. User searches for "climate bills"
2. bills-service filters by:
   - User's policy areas: `["Environmental Protection", "Energy"]`
   - Search term: "climate"
3. Returns personalized, relevant results

## Future Enhancements

1. **Dynamic Interest Weighting**
   - Track which bills user actually reads/tracks
   - Adjust keyword weights based on engagement

2. **Interest Discovery**
   - Recommend new interests based on tracked bills
   - "You might also be interested in Commerce & Labor"

3. **Temporal Relevance**
   - Boost certain interests during relevant events
   - E.g., boost "Foreign Policy & Defense" during international crises

4. **AI-Generated Summaries**
   - Use keywords to extract most relevant bill sections
   - "This bill mentions 3 of your interests: climate, energy, conservation"
