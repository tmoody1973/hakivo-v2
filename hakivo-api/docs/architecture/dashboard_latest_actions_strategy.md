# Dashboard Latest Congressional Actions Strategy

## Overview

The dashboard should display the latest Congressional actions from Congress.gov API, updated daily. This provides users with real-time awareness of legislative activity beyond just their tracked bills.

## Requirements

1. **Daily Refresh**: Fetch latest actions from Congress.gov API daily at 2 AM (aligned with congress-sync-scheduler)
2. **Dashboard Display**: Show top 10-15 latest actions across all of Congress
3. **Caching**: Cache results in KV for 24 hours to minimize API calls
4. **Filtering**: Focus on significant actions (votes, passage, signatures, vetoes)
5. **Integration**: Add to existing dashboard endpoint response

## Data Source

### Congress.gov API Endpoint

```typescript
// Latest actions across all bills
GET https://api.congress.gov/v3/bill?limit=20&sort=latestAction.actionDate+desc
```

### Response Format

```json
{
  "bills": [
    {
      "congress": 118,
      "type": "hr",
      "number": 1234,
      "title": "Climate Action Act of 2024",
      "latestAction": {
        "actionDate": "2024-01-15",
        "text": "Passed House by vote of 245-180",
        "actionCode": "H12410"
      },
      "sponsors": [{
        "bioguideId": "S000123",
        "fullName": "Rep. Smith, Jane",
        "state": "CA",
        "party": "D"
      }],
      "policyArea": {
        "name": "Environmental Protection"
      }
    }
  ]
}
```

## Implementation Strategy

### 1. Create Latest Actions Cache Service

Add new method to `congress-api-client`:

```typescript
// src/congress-api-client/index.ts

/**
 * Fetch latest Congressional actions from last 24 hours
 * Cached in KV for 24 hours
 */
async getLatestActions(limit: number = 15): Promise<CongressionalAction[]> {
  // Check cache first
  const cacheKey = 'congress:latest_actions';
  const cached = await this.env.ACTIONS_CACHE.get(cacheKey, 'json');

  if (cached) {
    this.env.logger.info('Latest actions cache hit');
    return cached;
  }

  // Fetch from Congress.gov API
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateFilter = yesterday.toISOString().split('T')[0];

  const response = await fetch(
    `https://api.congress.gov/v3/bill?limit=${limit * 2}&sort=latestAction.actionDate+desc&fromDateTime=${dateFilter}T00:00:00Z&format=json`,
    {
      headers: {
        'X-Api-Key': this.env.CONGRESS_API_KEY
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Congress.gov API error: ${response.status}`);
  }

  const data = await response.json();

  // Filter for significant actions only
  const significantActions = data.bills
    .filter(bill => this.isSignificantAction(bill.latestAction))
    .slice(0, limit)
    .map(bill => ({
      billId: `${bill.type}${bill.number}-${bill.congress}`,
      title: bill.title,
      type: bill.type,
      number: bill.number,
      congress: bill.congress,
      latestAction: {
        date: bill.latestAction.actionDate,
        text: bill.latestAction.text,
        actionCode: bill.latestAction.actionCode
      },
      sponsor: bill.sponsors?.[0] ? {
        name: bill.sponsors[0].fullName,
        state: bill.sponsors[0].state,
        party: bill.sponsors[0].party
      } : null,
      policyArea: bill.policyArea?.name || null
    }));

  // Cache for 24 hours
  await this.env.ACTIONS_CACHE.put(cacheKey, JSON.stringify(significantActions), {
    expirationTtl: 86400  // 24 hours
  });

  this.env.logger.info('Latest actions fetched and cached', {
    count: significantActions.length,
    dateFilter
  });

  return significantActions;
}

/**
 * Determine if action is significant enough to display
 */
private isSignificantAction(action: any): boolean {
  const significantCodes = [
    'H12410',  // Passed House
    'S12410',  // Passed Senate
    'E30000',  // Signed by President
    'E40000',  // Vetoed by President
    'H11100',  // Referred to committee
    'H12200',  // Reported by committee
    'S11100',  // Referred to committee
    'S12200',  // Reported by committee
    'H14000',  // Failed passage in House
    'S14000'   // Failed passage in Senate
  ];

  // Check if action code matches significant actions
  if (action.actionCode && significantCodes.includes(action.actionCode)) {
    return true;
  }

  // Check if action text contains key phrases
  const significantPhrases = [
    'passed',
    'vote',
    'signed',
    'vetoed',
    'reported',
    'enacted',
    'approved'
  ];

  const actionTextLower = action.text.toLowerCase();
  return significantPhrases.some(phrase => actionTextLower.includes(phrase));
}
```

### 2. Update Dashboard Service

Add latest actions to dashboard aggregation:

```typescript
// src/dashboard-service/index.ts

async getDashboard(userId: string): Promise<DashboardResponse> {
  // Check cache
  const cacheKey = `dashboard:${userId}`;
  const cached = await this.env.DASHBOARD_CACHE.get(cacheKey, 'json');

  if (cached) {
    return cached;
  }

  // Fetch all dashboard data in parallel
  const [
    userStats,
    trackedBills,
    recentBriefs,
    newsHighlights,
    recommendations,
    latestActions  // NEW: Latest Congressional actions
  ] = await Promise.all([
    this.getUserStats(userId),
    this.getTrackedBills(userId),
    this.getRecentBriefs(userId),
    this.getNewsHighlights(userId),
    this.getRecommendations(userId),
    this.env.CONGRESS_API_CLIENT.getLatestActions(15)  // NEW
  ]);

  const dashboard = {
    upcomingBriefs: this.calculateUpcomingBriefs(userStats.preferences),
    recentBriefs,
    trackedBills: {
      total: trackedBills.length,
      recentActivity: trackedBills
        .filter(b => this.hasRecentActivity(b))
        .slice(0, 5)
    },
    newsHighlights,
    latestActions,  // NEW: Add to response
    statistics: {
      totalBriefs: userStats.totalBriefs,
      totalListenTime: userStats.totalListenTime,
      completionRate: userStats.completionRate,
      activeInterests: userStats.preferences.policyInterests,
      trackedBillsCount: trackedBills.length
    },
    recommendations
  };

  // Cache for 5 minutes
  await this.env.DASHBOARD_CACHE.put(cacheKey, JSON.stringify(dashboard), {
    expirationTtl: 300
  });

  return dashboard;
}
```

### 3. Update Dashboard Response Schema

```typescript
// Updated dashboard response
interface DashboardResponse {
  upcomingBriefs: {
    nextGeneration: string;
    schedule: string[];
  };
  recentBriefs: Brief[];
  trackedBills: {
    total: number;
    recentActivity: TrackedBill[];
  };
  newsHighlights: NewsArticle[];
  latestActions: CongressionalAction[];  // NEW
  statistics: {
    totalBriefs: number;
    totalListenTime: number;
    completionRate: number;
    activeInterests: string[];
    trackedBillsCount: number;
  };
  recommendations: {
    bills: string[];
    topics: string[];
  };
}

interface CongressionalAction {
  billId: string;
  title: string;
  type: string;
  number: number;
  congress: number;
  latestAction: {
    date: string;
    text: string;
    actionCode: string;
  };
  sponsor: {
    name: string;
    state: string;
    party: string;
  } | null;
  policyArea: string | null;
}
```

## Updated API Response Example

```json
{
  "upcomingBriefs": {
    "nextGeneration": "2024-01-16T08:00:00Z",
    "schedule": ["Monday", "Wednesday", "Friday"]
  },
  "recentBriefs": [...],
  "trackedBills": {
    "total": 12,
    "recentActivity": [...]
  },
  "newsHighlights": [...],
  "latestActions": [
    {
      "billId": "hr1234-118",
      "title": "Climate Action Act of 2024",
      "type": "hr",
      "number": 1234,
      "congress": 118,
      "latestAction": {
        "date": "2024-01-15",
        "text": "Passed House by vote of 245-180",
        "actionCode": "H12410"
      },
      "sponsor": {
        "name": "Rep. Smith, Jane",
        "state": "CA",
        "party": "D"
      },
      "policyArea": "Environmental Protection"
    },
    {
      "billId": "s5678-118",
      "title": "Healthcare Access Improvement Act",
      "type": "s",
      "number": 5678,
      "congress": 118,
      "latestAction": {
        "date": "2024-01-15",
        "text": "Signed by President",
        "actionCode": "E30000"
      },
      "sponsor": {
        "name": "Sen. Johnson, Robert",
        "state": "NY",
        "party": "D"
      },
      "policyArea": "Health"
    }
  ],
  "statistics": {...},
  "recommendations": {...}
}
```

## Caching Strategy

### Two-Level Cache

1. **Latest Actions Cache** (ACTIONS_CACHE KV):
   - Key: `congress:latest_actions`
   - TTL: 24 hours
   - Refreshed by daily sync at 2 AM

2. **Dashboard Cache** (DASHBOARD_CACHE KV):
   - Key: `dashboard:{userId}`
   - TTL: 5 minutes
   - Per-user caching for personalized data

### Cache Invalidation

```typescript
// Invalidate latest actions cache during daily sync
// src/congress-sync-observer/index.ts

async processSync() {
  // ... existing sync logic ...

  // After sync completes, invalidate latest actions cache
  await this.env.ACTIONS_CACHE.delete('congress:latest_actions');

  this.env.logger.info('Latest actions cache invalidated, will refresh on next dashboard request');
}
```

## Rate Limiting

- **Daily sync**: 1 request per day (aligned with 2 AM sync)
- **Dashboard requests**: Cached for 24 hours in ACTIONS_CACHE
- **Per-user dashboard**: Cached for 5 minutes in DASHBOARD_CACHE
- **Total API calls**: ~1 request/day + occasional cache misses

Stays well within Congress.gov 5000 req/hour limit.

## Frontend Display

### Dashboard Component

```typescript
// Example React component
function LatestActionsWidget({ actions }) {
  return (
    <div className="latest-actions">
      <h2>Latest Congressional Actions</h2>
      <div className="actions-list">
        {actions.map(action => (
          <div key={action.billId} className="action-item">
            <div className="action-header">
              <span className="bill-type">{action.type.toUpperCase()} {action.number}</span>
              <span className="action-date">{formatDate(action.latestAction.date)}</span>
            </div>
            <h3 className="bill-title">{action.title}</h3>
            <p className="action-text">{action.latestAction.text}</p>
            {action.sponsor && (
              <p className="sponsor">
                Sponsor: {action.sponsor.name} ({action.sponsor.party}-{action.sponsor.state})
              </p>
            )}
            {action.policyArea && (
              <span className="policy-area">{action.policyArea}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Error Handling

```typescript
try {
  const latestActions = await this.env.CONGRESS_API_CLIENT.getLatestActions(15);
  return latestActions;
} catch (error) {
  this.env.logger.error(error as Error, {
    service: 'congress-api-client',
    operation: 'getLatestActions'
  });

  // Return empty array on error, don't block dashboard
  return [];
}
```

## Monitoring

Track API usage and cache performance:

```typescript
await this.env.APP_DB.exec(`
  INSERT INTO api_usage_logs (id, service, endpoint, status, response_time, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`, [
  crypto.randomUUID(),
  'congress-api',
  'getLatestActions',
  200,
  responseTime,
  Date.now()
]);
```

## Summary

**Integration Points:**
1. ✅ congress-api-client: New `getLatestActions()` method
2. ✅ dashboard-service: Add latest actions to aggregation
3. ✅ ACTIONS_CACHE KV: 24-hour cache for latest actions
4. ✅ congress-sync-observer: Invalidate cache after daily sync

**Cache Strategy:**
- Latest actions cached 24 hours globally
- Dashboard cached 5 minutes per user
- Auto-refresh on daily 2 AM sync

**API Efficiency:**
- ~1 request/day for latest actions
- Filtered to show only significant actions (votes, passage, signatures)
- Stays well under 5000 req/hour limit

**Frontend Display:**
- Top 15 latest Congressional actions
- Show bill title, action text, date, sponsor, policy area
- Sortable and filterable by policy area
