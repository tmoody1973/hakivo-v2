# Web Notifications System (Bell Icon)

## Overview

Activate the bell icon in the header to show in-app notifications. These are different from email alerts - they appear when the user is actively on the site.

---

## Notification Types

| Type | Trigger | Icon | Example |
|------|---------|------|---------|
| **Vote Alert** | User's rep voted | 🗳️ | "Rep. Pelosi voted YES on H.R. 1234" |
| **Bill Update** | Tracked bill status changed | 📋 | "H.R. 1234 passed the House" |
| **New Brief** | Daily/weekly brief ready | 📰 | "Your weekly brief is ready" |
| **New Episode** | Podcast episode published | 🎙️ | "New episode: The Civil Rights Act" |
| **Member News** | Tracked member action | 👤 | "Sen. Feinstein introduced S. 567" |
| **System** | Account/subscription | ⚙️ | "Welcome to Hakivo Pro!" |

---

## UI Design

### Bell Icon States

```
Empty:        🔔      (gray, no badge)
Has notifications: 🔔 ③  (badge with count)
New/unread:   🔔 ●    (dot indicator for new)
```

### Dropdown Panel

When user clicks the bell:

```
┌─────────────────────────────────────────────┐
│  Notifications                    Mark all  │
├─────────────────────────────────────────────┤
│ ● 🗳️ Rep. Pelosi voted YES on H.R. 1234   │
│      Infrastructure Investment Act          │
│      2 hours ago                            │
├─────────────────────────────────────────────┤
│ ● 📋 H.R. 5678 moved to Senate             │
│      Climate Action Now Act                 │
│      5 hours ago                            │
├─────────────────────────────────────────────┤
│   📰 Your weekly brief is ready            │
│      Dec 1, 2024                            │
├─────────────────────────────────────────────┤
│          View all notifications →           │
└─────────────────────────────────────────────┘

● = unread (bold, with dot)
  = read (normal weight)
```

### Full Notifications Page

`/notifications` - Shows all notifications with filters:

```
┌─────────────────────────────────────────────────────────┐
│  Notifications                                           │
├─────────────────────────────────────────────────────────┤
│  [All] [Votes] [Bills] [Briefs] [Podcast]               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  TODAY                                                   │
│  ────────────────────────────────────────────────       │
│  🗳️ Rep. Pelosi voted YES on H.R. 1234                 │
│     Infrastructure Investment Act                        │
│     2 hours ago                              [View Bill] │
│                                                          │
│  📋 H.R. 5678 moved to Senate                           │
│     Climate Action Now Act                               │
│     5 hours ago                              [View Bill] │
│                                                          │
│  YESTERDAY                                               │
│  ────────────────────────────────────────────────       │
│  📰 Your weekly brief is ready                          │
│     Covering Dec 1-7, 2024                               │
│     Yesterday at 6:00 PM                   [Read Brief] │
│                                                          │
│  THIS WEEK                                               │
│  ────────────────────────────────────────────────       │
│  🎙️ New podcast episode                                 │
│     Episode 9: The Federal Reserve Act                   │
│     Dec 5, 2024                            [Listen Now] │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),

    -- Notification content
    type TEXT NOT NULL,  -- 'vote', 'bill_update', 'brief', 'episode', 'member', 'system'
    title TEXT NOT NULL,
    message TEXT,

    -- Related entities (for linking)
    bill_id TEXT,
    member_id TEXT,
    brief_id TEXT,
    episode_id TEXT,

    -- Status
    read BOOLEAN DEFAULT false,
    read_at INTEGER,

    -- Metadata
    icon TEXT,  -- emoji or icon name
    action_url TEXT,  -- where to go when clicked

    created_at INTEGER NOT NULL,

    -- Index for fast queries
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_notifications_user_unread
ON notifications(user_id, read, created_at DESC);
```

---

## API Endpoints

```typescript
// Get user's notifications
GET /api/notifications
Query params: ?unread_only=true&limit=20&offset=0
Response: {
  notifications: [...],
  unread_count: 3,
  total: 45
}

// Mark notification as read
POST /api/notifications/:id/read
Response: { success: true }

// Mark all as read
POST /api/notifications/read-all
Response: { success: true, marked: 5 }

// Get unread count (for badge)
GET /api/notifications/count
Response: { unread: 3 }

// Delete notification
DELETE /api/notifications/:id
Response: { success: true }
```

---

## Real-Time Updates (Optional Enhancement)

For live notification updates without page refresh:

### Option A: Polling (Simple)
```typescript
// Poll every 30 seconds
useEffect(() => {
  const interval = setInterval(async () => {
    const { unread } = await fetch('/api/notifications/count').then(r => r.json());
    setUnreadCount(unread);
  }, 30000);
  return () => clearInterval(interval);
}, []);
```

### Option B: Server-Sent Events (Better)
```typescript
// Subscribe to notification stream
useEffect(() => {
  const eventSource = new EventSource('/api/notifications/stream');
  eventSource.onmessage = (event) => {
    const notification = JSON.parse(event.data);
    addNotification(notification);
    setUnreadCount(c => c + 1);
  };
  return () => eventSource.close();
}, []);
```

### Option C: WebSocket via Raindrop (Best, if supported)
Real-time push from server when events occur.

**Recommendation:** Start with polling, upgrade to SSE later if needed.

---

## Component Implementation

### NotificationBell Component

```tsx
// components/notification-bell.tsx
'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();
    // Poll for updates
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    const res = await fetch('/api/notifications?limit=5');
    const data = await res.json();
    setNotifications(data.notifications);
    setUnreadCount(data.unread_count);
  };

  const fetchUnreadCount = async () => {
    const res = await fetch('/api/notifications/count');
    const { unread } = await res.json();
    setUnreadCount(unread);
  };

  const markAsRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    setUnreadCount(c => Math.max(0, c - 1));
  };

  const markAllAsRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-xs text-primary-foreground flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-4 text-center text-muted-foreground">
              No notifications yet
            </p>
          ) : (
            notifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={markAsRead}
              />
            ))
          )}
        </div>
        <div className="p-2 border-t">
          <Button variant="ghost" className="w-full" asChild>
            <Link href="/notifications">View all</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

---

## When to Create Notifications

Integrate with existing services:

### congress-sync-observer
```typescript
// When a vote is recorded
if (voteData.member_id && isTrackedByUser(voteData.member_id)) {
  await createNotification({
    user_id: userId,
    type: 'vote',
    title: `${memberName} voted ${vote} on ${billNumber}`,
    message: billTitle,
    bill_id: billId,
    member_id: memberId,
    action_url: `/bills/${billId}`,
    icon: '🗳️'
  });
}
```

### brief-generator
```typescript
// When brief is generated
await createNotification({
  user_id: brief.user_id,
  type: 'brief',
  title: 'Your weekly brief is ready',
  message: `Covering ${dateRange}`,
  brief_id: brief.id,
  action_url: `/briefs/${brief.id}`,
  icon: '📰'
});
```

### podcast-scheduler
```typescript
// When new episode is published
const users = await getAllUsers(); // or subscribed users
for (const user of users) {
  await createNotification({
    user_id: user.id,
    type: 'episode',
    title: 'New podcast episode',
    message: episode.headline,
    episode_id: episode.id,
    action_url: `/podcast/${episode.id}`,
    icon: '🎙️'
  });
}
```

---

## Notification Settings Integration

Add to user settings page:

```
┌─────────────────────────────────────────────┐
│  In-App Notifications                        │
├─────────────────────────────────────────────┤
│                                              │
│  🗳️ Vote alerts                   [ON/OFF]  │
│  When your representatives vote              │
│                                              │
│  📋 Bill updates                  [ON/OFF]  │
│  When tracked bills change status            │
│                                              │
│  📰 Brief ready                   [ON/OFF]  │
│  When your daily/weekly brief is ready       │
│                                              │
│  🎙️ New episodes                  [ON/OFF]  │
│  When new podcast episodes are published     │
│                                              │
└─────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Phase 1: Basic Infrastructure
- [ ] Create notifications table
- [ ] Create notification API endpoints
- [ ] Build NotificationBell component
- [ ] Add to header (replace placeholder)
- [ ] Build /notifications page

### Phase 2: Integrate with Existing Services
- [ ] Add notification creation to brief-generator
- [ ] Add notification creation to podcast-scheduler
- [ ] Add notification creation to congress-sync (vote alerts)

### Phase 3: Polish
- [ ] Add notification preferences to settings
- [ ] Implement "mark all as read"
- [ ] Add notification filtering on /notifications page
- [ ] Add polling or SSE for real-time updates

---

## Free vs Pro Notifications

| Notification Type | Free | Pro |
|-------------------|------|-----|
| Weekly brief ready | ✅ | ✅ |
| New podcast episodes | ✅ | ✅ |
| Daily brief ready | ❌ | ✅ |
| Real-time vote alerts | ❌ | ✅ |
| Bill status updates | Limited (3 bills) | ✅ Unlimited |

---

## Bill & Rep Tracking Feature

### Overview

Allow users to "follow" specific bills and representatives to get notifications when activity occurs.

### UI: Track Button on Bills

On every bill page (`/bills/:id`), show a track button:

```
┌─────────────────────────────────────────────────────────┐
│  H.R. 1234 - Infrastructure Investment Act              │
│  117th Congress                                          │
│                                                          │
│  Status: Passed House, In Senate Committee              │
│                                                          │
│  [🔔 Track This Bill]     [Share]     [PDF]             │
│                                                          │
└─────────────────────────────────────────────────────────┘

When tracked:

│  [✓ Tracking]  ▼                                        │
│  ┌─────────────────────────┐                            │
│  │ ✓ Status changes        │                            │
│  │ ✓ Votes                 │                            │
│  │ ✓ Amendments            │                            │
│  │ ─────────────────────── │                            │
│  │ 🔕 Stop tracking        │                            │
│  └─────────────────────────┘                            │
```

### UI: Track Button on Member Pages

On member pages (`/members/:id`):

```
┌─────────────────────────────────────────────────────────┐
│  👤 Rep. Nancy Pelosi                                    │
│  California's 11th District (D)                          │
│                                                          │
│  [🔔 Follow]     [Contact]     [Voting Record]          │
│                                                          │
└─────────────────────────────────────────────────────────┘

When following:

│  [✓ Following]  ▼                                       │
│  ┌─────────────────────────┐                            │
│  │ ✓ Votes                 │                            │
│  │ ✓ Bills sponsored       │                            │
│  │ ✓ Statements            │                            │
│  │ ─────────────────────── │                            │
│  │ 👤 Unfollow             │                            │
│  └─────────────────────────┘                            │
```

### Tracking Dashboard

New page: `/dashboard/tracking` or section on main dashboard:

```
┌─────────────────────────────────────────────────────────┐
│  Your Watchlist                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  TRACKED BILLS (3/3 free limit)          [Upgrade →]    │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  📋 H.R. 1234 - Infrastructure Investment Act           │
│     Status: In Senate Committee                          │
│     Last activity: 2 days ago              [Untrack]    │
│                                                          │
│  📋 S. 567 - Climate Action Now Act                     │
│     Status: Passed Senate                                │
│     Last activity: 1 week ago              [Untrack]    │
│                                                          │
│  📋 H.R. 890 - Voting Rights Act                        │
│     Status: In House Committee                           │
│     Last activity: 3 days ago              [Untrack]    │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│  FOLLOWED MEMBERS (5)                                    │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  👤 Rep. Nancy Pelosi (D-CA-11)    ← Your district      │
│     Last vote: H.R. 1234 (YES)             [Following]  │
│                                                          │
│  👤 Sen. Dianne Feinstein (D-CA)   ← Your senator       │
│     Last vote: S. 567 (YES)                [Following]  │
│                                                          │
│  👤 Sen. Alex Padilla (D-CA)       ← Your senator       │
│     Last vote: S. 567 (YES)                [Following]  │
│                                                          │
│  👤 Rep. Alexandria Ocasio-Cortez (D-NY-14)             │
│     Last vote: H.R. 1234 (YES)             [Unfollow]   │
│                                                          │
│  👤 Sen. Bernie Sanders (I-VT)                          │
│     Last vote: S. 567 (YES)                [Unfollow]   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Database Schema for Tracking

```sql
-- Bill tracking (already in plan, shown for reference)
CREATE TABLE user_bill_watches (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    bill_id TEXT NOT NULL,

    -- What to notify on
    notify_on_status_change BOOLEAN DEFAULT true,
    notify_on_vote BOOLEAN DEFAULT true,
    notify_on_amendment BOOLEAN DEFAULT true,

    created_at INTEGER,

    UNIQUE(user_id, bill_id)
);

-- Member following
CREATE TABLE user_member_follows (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    member_id TEXT NOT NULL,

    -- What to notify on
    notify_on_vote BOOLEAN DEFAULT true,
    notify_on_sponsor BOOLEAN DEFAULT true,
    notify_on_statement BOOLEAN DEFAULT false,

    -- Is this an auto-follow (user's district)?
    is_district_rep BOOLEAN DEFAULT false,

    created_at INTEGER,

    UNIQUE(user_id, member_id)
);
```

### API Endpoints for Tracking

```typescript
// === BILL TRACKING ===

// Track a bill
POST /api/bills/:billId/track
Body: { notify_on_status_change: true, notify_on_vote: true }
Response: { success: true, tracked: true }

// Untrack a bill
DELETE /api/bills/:billId/track
Response: { success: true, tracked: false }

// Get user's tracked bills
GET /api/user/tracked-bills
Response: {
  bills: [...],
  count: 3,
  limit: 3,  // Free tier limit
  can_track_more: false
}

// Check if bill is tracked
GET /api/bills/:billId/track/status
Response: { tracked: true, settings: {...} }


// === MEMBER FOLLOWING ===

// Follow a member
POST /api/members/:memberId/follow
Body: { notify_on_vote: true, notify_on_sponsor: true }
Response: { success: true, following: true }

// Unfollow a member
DELETE /api/members/:memberId/follow
Response: { success: true, following: false }

// Get user's followed members
GET /api/user/followed-members
Response: {
  members: [...],
  district_members: [...],  // Auto-followed based on district
  count: 5
}
```

### Component: TrackBillButton

```tsx
// components/track-bill-button.tsx
'use client';

import { useState } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TrackBillButtonProps {
  billId: string;
  isTracked: boolean;
  isPro: boolean;
  trackedCount: number;
  trackLimit: number;
}

export function TrackBillButton({
  billId,
  isTracked: initialTracked,
  isPro,
  trackedCount,
  trackLimit
}: TrackBillButtonProps) {
  const [isTracked, setIsTracked] = useState(initialTracked);
  const [settings, setSettings] = useState({
    status_change: true,
    votes: true,
    amendments: true,
  });

  const canTrack = isPro || trackedCount < trackLimit;

  const handleTrack = async () => {
    if (!canTrack && !isTracked) {
      // Show upgrade modal
      return;
    }

    const res = await fetch(`/api/bills/${billId}/track`, {
      method: isTracked ? 'DELETE' : 'POST',
      body: isTracked ? undefined : JSON.stringify(settings),
    });

    if (res.ok) {
      setIsTracked(!isTracked);
    }
  };

  if (!isTracked) {
    return (
      <Button
        onClick={handleTrack}
        variant="outline"
        disabled={!canTrack}
      >
        <Bell className="h-4 w-4 mr-2" />
        {canTrack ? 'Track This Bill' : `Limit Reached (${trackLimit})`}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">
          <Check className="h-4 w-4 mr-2" />
          Tracking
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuCheckboxItem
          checked={settings.status_change}
          onCheckedChange={(c) => setSettings(s => ({...s, status_change: c}))}
        >
          Status changes
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={settings.votes}
          onCheckedChange={(c) => setSettings(s => ({...s, votes: c}))}
        >
          Votes
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={settings.amendments}
          onCheckedChange={(c) => setSettings(s => ({...s, amendments: c}))}
        >
          Amendments
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleTrack} className="text-destructive">
          <BellOff className="h-4 w-4 mr-2" />
          Stop tracking
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Auto-Follow District Representatives

When a user sets their address/district, automatically follow their:
- 1 House Representative
- 2 Senators

```typescript
// When user updates their district
async function onDistrictUpdated(userId: string, district: District) {
  const members = await getMembersForDistrict(district);

  for (const member of members) {
    await db.run(`
      INSERT OR IGNORE INTO user_member_follows
      (id, user_id, member_id, is_district_rep, notify_on_vote, notify_on_sponsor, created_at)
      VALUES (?, ?, ?, true, true, true, ?)
    `, [generateId(), userId, member.id, Date.now()]);
  }
}
```

### Free vs Pro Tracking Limits

| Feature | Free | Pro |
|---------|------|-----|
| Track bills | 3 max | Unlimited |
| Follow members | District only (3) | Unlimited |
| Bill notifications | Weekly digest only | Real-time |
| Member notifications | Weekly digest only | Real-time |

### Upgrade Prompt

When free user hits limit:

```
┌─────────────────────────────────────────────────────────┐
│  📋 Track More Bills with Pro                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  You're tracking 3/3 bills on the free plan.            │
│                                                          │
│  Upgrade to Pro for:                                     │
│  ✓ Unlimited bill tracking                              │
│  ✓ Follow any member of Congress                        │
│  ✓ Real-time notifications                              │
│  ✓ Daily briefings                                      │
│                                                          │
│  Just $9/month                                           │
│                                                          │
│  [Upgrade to Pro]              [Maybe Later]            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Implementation Checklist for Tracking

- [ ] Create user_bill_watches table
- [ ] Create user_member_follows table
- [ ] Build TrackBillButton component
- [ ] Build FollowMemberButton component
- [ ] Add track button to bill detail page
- [ ] Add follow button to member detail page
- [ ] Build /dashboard/tracking page
- [ ] Add tracking count to user profile
- [ ] Implement free tier limits
- [ ] Add upgrade prompts when limit reached
- [ ] Auto-follow district members on signup
- [ ] Integrate with notification system
