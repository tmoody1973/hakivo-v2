# Real-Time Alerts & Personalized Newsletter System

## Overview

Build an email notification system using [Resend](https://resend.com) that delivers personalized legislative updates to users based on their interests, district, and tracked bills.

---

## User Personas & Use Cases

### 1. Casual Citizen
**Who:** Average voter who wants to stay informed without effort
**Needs:**
- Weekly digest of what their Representative/Senators did
- Plain English summaries, not legal jargon
- Audio option for commute listening

**Email frequency:** Weekly (Sunday evening)

**Example email:**
```
Subject: Your Week in Congress - Rep. Nancy Pelosi voted on 3 bills

Hi Sarah,

Here's what your representatives did this week:

REP. NANCY PELOSI (CA-11)
✅ Voted YES on H.R. 1234 - Infrastructure Investment Act
❌ Voted NO on H.R. 5678 - Tax Reform Bill
🎤 Co-sponsored H.R. 9012 - Climate Action Now

[Listen to Audio Summary] [Read Full Brief]
```

---

### 2. Journalist / Reporter
**Who:** Political reporter covering Congress
**Needs:**
- Real-time alerts when specific bills move
- Alerts when tracked members take action
- Breaking: floor votes, committee hearings, bill introductions

**Email frequency:** Real-time (within minutes)

**Example alert:**
```
Subject: 🚨 BREAKING: H.R. 1234 passed House (220-215)

The Infrastructure Investment Act just passed the House.

Vote breakdown:
- Democrats: 218 YES, 2 NO
- Republicans: 2 YES, 213 NO

Your tracked members:
- Rep. Alexandria Ocasio-Cortez: YES
- Rep. Kevin McCarthy: NO

[Full vote record] [Bill summary] [Member statements]
```

---

### 3. Advocacy Group / Lobbyist
**Who:** Organizations tracking specific policy areas
**Needs:**
- Track bills by keyword/topic (e.g., "climate", "healthcare", "guns")
- Alert when bills in their area get committee hearings
- Track specific members on key committees

**Email frequency:** Daily digest + real-time for critical events

**Example email:**
```
Subject: Daily Climate Policy Tracker - 3 new developments

CLIMATE & ENVIRONMENT WATCHLIST

🆕 NEW BILLS (2)
- H.R. 4521 - Clean Energy Tax Credit Extension
- S. 891 - Methane Emissions Reduction Act

📅 UPCOMING HEARINGS (1)
- Tomorrow 10am: Senate EPW Committee hearing on S. 891

⚡ ACTIONS TODAY
- H.R. 1234 moved from committee to House floor

[Customize alerts] [Export to spreadsheet]
```

---

## Alert Types

| Alert Type | Trigger | Frequency | Who wants it |
|------------|---------|-----------|--------------|
| **Weekly Digest** | Cron (Sunday 6pm) | Weekly | Casual users |
| **Daily Briefing** | Cron (7am) | Daily | Power users, journalists |
| **Vote Alert** | Bill passes/fails | Real-time | Journalists, advocates |
| **Bill Movement** | Status change | Real-time | Anyone tracking that bill |
| **Member Action** | Rep introduces/votes | Real-time | District constituents |
| **Keyword Alert** | New bill matches topic | Daily batch | Advocacy groups |

---

## Technical Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                             │
├─────────────────────────────────────────────────────────────────┤
│  congress-sync-scheduler ──► Detects new bills, votes, actions  │
│  congress-actions-scheduler ──► Detects status changes          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ALERT QUEUE                                 │
├─────────────────────────────────────────────────────────────────┤
│  New queue: "alert-queue"                                        │
│  Messages: { type, billId, memberId, action, timestamp }        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ALERT PROCESSOR                               │
├─────────────────────────────────────────────────────────────────┤
│  alert-observer (new Raindrop observer)                         │
│  1. Receive alert event                                          │
│  2. Query: which users care about this?                         │
│  3. Group by user preferences (real-time vs digest)             │
│  4. Queue emails or send immediately                            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EMAIL SERVICE                                 │
├─────────────────────────────────────────────────────────────────┤
│  resend-client (new Raindrop service)                           │
│  - Send transactional emails via Resend API                     │
│  - React Email templates for beautiful formatting               │
│  - Track opens/clicks for engagement metrics                    │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- User notification preferences
CREATE TABLE user_alert_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),

    -- Frequency preferences
    weekly_digest BOOLEAN DEFAULT true,
    daily_briefing BOOLEAN DEFAULT false,
    realtime_alerts BOOLEAN DEFAULT false,

    -- What to track
    track_district_members BOOLEAN DEFAULT true,
    track_keywords TEXT,  -- JSON array: ["climate", "healthcare"]

    -- Delivery preferences
    email_enabled BOOLEAN DEFAULT true,
    preferred_time INTEGER DEFAULT 7,  -- Hour in user's timezone
    timezone TEXT DEFAULT 'America/New_York',

    created_at INTEGER,
    updated_at INTEGER
);

-- Track which bills user is watching
CREATE TABLE user_bill_watches (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    bill_id TEXT NOT NULL,
    notify_on_vote BOOLEAN DEFAULT true,
    notify_on_status_change BOOLEAN DEFAULT true,
    created_at INTEGER
);

-- Track which members user follows
CREATE TABLE user_member_watches (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    member_id TEXT NOT NULL,
    notify_on_vote BOOLEAN DEFAULT true,
    notify_on_sponsor BOOLEAN DEFAULT true,
    created_at INTEGER
);

-- Email send log (for analytics and preventing duplicates)
CREATE TABLE email_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email_type TEXT NOT NULL,  -- 'weekly_digest', 'vote_alert', etc.
    subject TEXT,
    resend_id TEXT,  -- Resend's message ID
    status TEXT,  -- 'sent', 'delivered', 'opened', 'clicked', 'bounced'
    sent_at INTEGER,
    opened_at INTEGER,
    clicked_at INTEGER
);
```

### Raindrop Manifest Additions

```hcl
# Environment variables
env "RESEND_API_KEY" {
  secret = true
}

# Email service
service "resend-client" {
  visibility = "private"
}

# Alert processing
queue "alert-queue" {}

observer "alert-observer" {
  source {
    queue = "alert-queue"
  }
}

# Scheduled email tasks
task "weekly-digest-scheduler" {
  type = "cron"
  cron = "0 18 * * 0"  # Sunday 6pm UTC
}

task "daily-briefing-scheduler" {
  type = "cron"
  cron = "0 12 * * *"  # Noon UTC (7am EST)
}
```

---

## Email Templates (React Email)

### Weekly Digest Template

```tsx
// emails/weekly-digest.tsx
import { Html, Head, Body, Container, Section, Text, Button, Hr } from '@react-email/components';

interface WeeklyDigestProps {
  userName: string;
  district: string;
  memberActions: MemberAction[];
  trackedBillUpdates: BillUpdate[];
  audioUrl?: string;
}

export default function WeeklyDigest({ userName, district, memberActions, trackedBillUpdates, audioUrl }: WeeklyDigestProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Text style={heading}>Your Week in Congress</Text>
          <Text style={subheading}>{district}</Text>

          {audioUrl && (
            <Button href={audioUrl} style={audioButton}>
              🎧 Listen to Audio Summary (8 min)
            </Button>
          )}

          <Hr />

          <Section>
            <Text style={sectionTitle}>Your Representatives This Week</Text>
            {memberActions.map(action => (
              <MemberActionRow key={action.id} action={action} />
            ))}
          </Section>

          <Hr />

          <Section>
            <Text style={sectionTitle}>Bills You're Tracking</Text>
            {trackedBillUpdates.map(bill => (
              <BillUpdateRow key={bill.id} bill={bill} />
            ))}
          </Section>

          <Hr />

          <Button href="https://hakivo.com/dashboard" style={ctaButton}>
            View Full Dashboard
          </Button>

          <Text style={footer}>
            You're receiving this because you signed up for Hakivo weekly updates.
            <a href="{{unsubscribe_url}}">Unsubscribe</a> or <a href="https://hakivo.com/settings/notifications">manage preferences</a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

---

## Resend Integration

### Service Implementation

```typescript
// src/resend-client/index.ts
import { Resend } from 'resend';
import WeeklyDigest from './emails/weekly-digest';
import VoteAlert from './emails/vote-alert';

const resend = new Resend(env.RESEND_API_KEY);

// Send weekly digest
app.post('/send-weekly-digest', async (c) => {
  const { userId, data } = await c.req.json();

  const user = await getUser(userId);

  const { data: result, error } = await resend.emails.send({
    from: 'Hakivo <briefs@hakivo.com>',
    to: user.email,
    subject: `Your Week in Congress - ${data.district}`,
    react: WeeklyDigest(data),
  });

  // Log for analytics
  await logEmail(userId, 'weekly_digest', result.id);

  return c.json({ success: true, id: result.id });
});

// Send real-time vote alert
app.post('/send-vote-alert', async (c) => {
  const { userId, bill, voteResult } = await c.req.json();

  const user = await getUser(userId);

  // Check user preferences
  if (!user.alertPreferences.realtime_alerts) {
    return c.json({ success: false, reason: 'user_disabled_realtime' });
  }

  const { data: result } = await resend.emails.send({
    from: 'Hakivo Alerts <alerts@hakivo.com>',
    to: user.email,
    subject: `🚨 ${bill.number} ${voteResult.passed ? 'PASSED' : 'FAILED'} (${voteResult.yes}-${voteResult.no})`,
    react: VoteAlert({ bill, voteResult, user }),
  });

  return c.json({ success: true, id: result.id });
});
```

---

## User Settings UI

Users need a settings page to control their notifications:

```
/settings/notifications

┌─────────────────────────────────────────────────────────┐
│  Email Notifications                                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📬 Weekly Digest                              [ON/OFF]  │
│  Summary of your representatives' activity               │
│  Delivered: Sundays at 6pm                              │
│                                                          │
│  📰 Daily Briefing                             [ON/OFF]  │
│  Morning update on tracked bills and members            │
│  Delivered: Daily at 7am                                │
│                                                          │
│  🚨 Real-time Alerts                           [ON/OFF]  │
│  Instant notifications for votes and major events       │
│  (Pro feature)                                          │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  What to Track                                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  👥 My District Representatives               [ON/OFF]  │
│  Rep. Nancy Pelosi, Sen. Feinstein, Sen. Padilla       │
│                                                          │
│  📋 Tracked Bills (3)                         [Manage]  │
│  H.R. 1234, S. 567, H.R. 890                           │
│                                                          │
│  🏷️ Keyword Alerts                            [ON/OFF]  │
│  Topics: climate, healthcare                 [Edit]     │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Audio Preferences                                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  🎧 Include audio version in emails          [ON/OFF]  │
│  Attach MP3 link to digest emails                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Add Resend API key to Raindrop manifest
- [ ] Create resend-client service
- [ ] Create user_alert_preferences table
- [ ] Build notification settings UI
- [ ] Create basic email templates

### Phase 2: Weekly Digest (Week 2)
- [ ] Create weekly-digest-scheduler task
- [ ] Build digest generation logic (aggregate week's activity)
- [ ] Generate audio version of digest using existing TTS pipeline
- [ ] Send first test digests

### Phase 3: Real-time Alerts (Week 3)
- [ ] Create alert-queue and alert-observer
- [ ] Modify congress-sync to emit alert events
- [ ] Build vote alert template
- [ ] Build bill status change template
- [ ] Implement user preference filtering

### Phase 4: Advanced Features (Week 4)
- [ ] Keyword-based bill tracking
- [ ] Member follow/watch system
- [ ] Email analytics dashboard
- [ ] Unsubscribe handling

---

## Pricing Tie-in

| Feature | Free | Pro ($9/mo) |
|---------|------|-------------|
| Weekly Digest | ✅ | ✅ |
| Daily Briefing | ❌ | ✅ |
| Real-time Alerts | ❌ | ✅ |
| Audio in emails | ❌ | ✅ |
| Keyword tracking | 1 keyword | Unlimited |
| Bill tracking | 3 bills | Unlimited |

---

## Why This Matters

**For Hakivo's value proposition:**

1. **Retention** - Email keeps users engaged even when they don't open the app
2. **Habit formation** - Weekly digest becomes part of their Sunday routine
3. **Pro conversion** - Real-time alerts are genuinely valuable, worth paying for
4. **Differentiation** - No one else sends personalized, audio-enabled congressional updates

**For users:**

1. **Stay informed without effort** - Information comes to them
2. **Never miss important votes** - Real-time alerts for tracked bills
3. **Audio option** - Listen during commute instead of reading
4. **Personalized** - Only news about THEIR representatives and interests

---

## Resend Pricing

Resend is very affordable:
- **Free tier:** 3,000 emails/month, 100/day
- **Pro:** $20/month for 50,000 emails

For a civic app, 3,000 free emails covers ~700 weekly digest users. More than enough to start.
