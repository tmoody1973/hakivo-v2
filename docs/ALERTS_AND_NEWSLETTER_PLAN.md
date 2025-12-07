# Real-Time Alerts & Personalized Newsletter System

## Overview

Build an email notification system using [Resend](https://resend.com) + [React Email](https://react.email/) that delivers personalized legislative updates to users based on their interests, district, and tracked bills.

---

## Tech Stack

| Tool | Purpose | Why |
|------|---------|-----|
| [Resend](https://resend.com) | Email delivery API | Developer-friendly, great deliverability, affordable |
| [React Email](https://react.email/) | Email templates | Write emails as React components, preview in browser |

### Why React Email + Resend?

1. **Write emails like React components** - No more HTML tables and inline styles hell
2. **Preview in browser** - See exactly what emails look like before sending
3. **Type-safe** - Full TypeScript support for email props
4. **Resend integration** - Built by the same team, seamless integration
5. **Components library** - Pre-built `<Button>`, `<Section>`, `<Text>`, etc.

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

## React Email Setup

### Installation

```bash
# Install React Email and components
npm install @react-email/components resend

# Install dev server for previewing emails
npm install react-email -D
```

### Project Structure

```
hakivo-v2/
├── emails/                    # React Email templates
│   ├── components/            # Shared email components
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   ├── bill-card.tsx
│   │   ├── member-action.tsx
│   │   └── audio-button.tsx
│   ├── weekly-digest.tsx      # Weekly summary email
│   ├── daily-briefing.tsx     # Daily update email
│   ├── vote-alert.tsx         # Real-time vote notification
│   ├── bill-update.tsx        # Bill status change
│   ├── welcome.tsx            # Welcome email
│   └── upgrade-prompt.tsx     # Pro upgrade nudge
├── package.json               # Add email preview script
```

### Package.json Script

```json
{
  "scripts": {
    "email:dev": "email dev --dir emails --port 3001",
    "email:export": "email export --dir emails --outDir out/emails"
  }
}
```

Run `npm run email:dev` to preview emails at `http://localhost:3001`

---

## Email Templates (React Email)

### Shared Components

```tsx
// emails/components/header.tsx
import { Img, Section, Text } from '@react-email/components';

export function EmailHeader() {
  return (
    <Section style={headerStyle}>
      <Img
        src="https://hakivo.com/logo.png"
        width="120"
        height="40"
        alt="Hakivo"
      />
      <Text style={tagline}>Democracy, Explained</Text>
    </Section>
  );
}

const headerStyle = {
  textAlign: 'center' as const,
  padding: '20px 0',
  borderBottom: '1px solid #e5e5e5',
};

const tagline = {
  color: '#666',
  fontSize: '14px',
  margin: '8px 0 0',
};
```

```tsx
// emails/components/bill-card.tsx
import { Section, Text, Link } from '@react-email/components';

interface BillCardProps {
  billNumber: string;
  title: string;
  status: string;
  lastAction: string;
  url: string;
}

export function BillCard({ billNumber, title, status, lastAction, url }: BillCardProps) {
  return (
    <Section style={cardStyle}>
      <Text style={billNumberStyle}>{billNumber}</Text>
      <Link href={url} style={titleStyle}>{title}</Link>
      <Text style={statusStyle}>
        Status: <strong>{status}</strong>
      </Text>
      <Text style={actionStyle}>{lastAction}</Text>
    </Section>
  );
}

const cardStyle = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '12px',
};

const billNumberStyle = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '0 0 4px',
};

const titleStyle = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#111827',
  textDecoration: 'none',
};

const statusStyle = {
  fontSize: '14px',
  color: '#374151',
  margin: '8px 0 4px',
};

const actionStyle = {
  fontSize: '13px',
  color: '#6b7280',
  margin: '0',
};
```

```tsx
// emails/components/audio-button.tsx
import { Button } from '@react-email/components';

interface AudioButtonProps {
  href: string;
  duration: string;
}

export function AudioButton({ href, duration }: AudioButtonProps) {
  return (
    <Button href={href} style={buttonStyle}>
      🎧 Listen to Audio Summary ({duration})
    </Button>
  );
}

const buttonStyle = {
  backgroundColor: '#7c3aed',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '12px 24px',
  display: 'block',
  margin: '16px 0',
};
```

### Weekly Digest Template

```tsx
// emails/weekly-digest.tsx
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Preview,
} from '@react-email/components';
import { EmailHeader } from './components/header';
import { BillCard } from './components/bill-card';
import { AudioButton } from './components/audio-button';

interface MemberAction {
  id: string;
  memberName: string;
  party: string;
  action: string;
  billNumber: string;
  billTitle: string;
  vote?: 'YES' | 'NO' | 'NOT VOTING';
}

interface BillUpdate {
  id: string;
  billNumber: string;
  title: string;
  status: string;
  lastAction: string;
  url: string;
}

interface WeeklyDigestProps {
  userName: string;
  district: string;
  dateRange: string;
  memberActions: MemberAction[];
  trackedBillUpdates: BillUpdate[];
  audioUrl?: string;
  audioDuration?: string;
  unsubscribeUrl: string;
  preferencesUrl: string;
}

export default function WeeklyDigest({
  userName,
  district,
  dateRange,
  memberActions,
  trackedBillUpdates,
  audioUrl,
  audioDuration,
  unsubscribeUrl,
  preferencesUrl,
}: WeeklyDigestProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Week in Congress - {dateRange}</Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailHeader />

          <Section style={heroSection}>
            <Text style={greeting}>Hi {userName},</Text>
            <Text style={heading}>Your Week in Congress</Text>
            <Text style={subheading}>{district} • {dateRange}</Text>
          </Section>

          {audioUrl && audioDuration && (
            <AudioButton href={audioUrl} duration={audioDuration} />
          )}

          <Hr style={divider} />

          {memberActions.length > 0 && (
            <Section>
              <Text style={sectionTitle}>Your Representatives This Week</Text>
              {memberActions.map(action => (
                <Section key={action.id} style={actionRow}>
                  <Text style={memberName}>
                    {action.memberName} ({action.party})
                  </Text>
                  <Text style={actionText}>
                    {action.vote && (
                      <span style={action.vote === 'YES' ? voteYes : voteNo}>
                        {action.vote}
                      </span>
                    )}
                    {' '}{action.action} on {action.billNumber}
                  </Text>
                  <Text style={billTitleSmall}>{action.billTitle}</Text>
                </Section>
              ))}
            </Section>
          )}

          <Hr style={divider} />

          {trackedBillUpdates.length > 0 && (
            <Section>
              <Text style={sectionTitle}>Bills You're Tracking</Text>
              {trackedBillUpdates.map(bill => (
                <BillCard
                  key={bill.id}
                  billNumber={bill.billNumber}
                  title={bill.title}
                  status={bill.status}
                  lastAction={bill.lastAction}
                  url={bill.url}
                />
              ))}
            </Section>
          )}

          <Hr style={divider} />

          <Button href="https://hakivo.com/dashboard" style={ctaButton}>
            View Full Dashboard
          </Button>

          <Section style={footer}>
            <Text style={footerText}>
              You're receiving this because you signed up for Hakivo weekly updates.
            </Text>
            <Text style={footerLinks}>
              <a href={unsubscribeUrl} style={footerLink}>Unsubscribe</a>
              {' • '}
              <a href={preferencesUrl} style={footerLink}>Manage preferences</a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '600px',
};

const heroSection = {
  padding: '32px 24px',
  textAlign: 'center' as const,
};

const greeting = {
  fontSize: '16px',
  color: '#666',
  margin: '0 0 8px',
};

const heading = {
  fontSize: '28px',
  fontWeight: '700',
  color: '#111827',
  margin: '0 0 8px',
};

const subheading = {
  fontSize: '14px',
  color: '#6b7280',
  margin: '0',
};

const divider = {
  borderColor: '#e5e7eb',
  margin: '24px 0',
};

const sectionTitle = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#111827',
  padding: '0 24px',
  margin: '0 0 16px',
};

const actionRow = {
  padding: '12px 24px',
  borderBottom: '1px solid #f3f4f6',
};

const memberName = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#111827',
  margin: '0 0 4px',
};

const actionText = {
  fontSize: '14px',
  color: '#374151',
  margin: '0 0 4px',
};

const billTitleSmall = {
  fontSize: '13px',
  color: '#6b7280',
  margin: '0',
};

const voteYes = {
  backgroundColor: '#dcfce7',
  color: '#166534',
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: '600',
};

const voteNo = {
  backgroundColor: '#fee2e2',
  color: '#991b1b',
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: '600',
};

const ctaButton = {
  backgroundColor: '#7c3aed',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '14px 28px',
  display: 'block',
  margin: '24px auto',
  maxWidth: '200px',
};

const footer = {
  padding: '24px',
  textAlign: 'center' as const,
};

const footerText = {
  fontSize: '12px',
  color: '#9ca3af',
  margin: '0 0 8px',
};

const footerLinks = {
  fontSize: '12px',
  margin: '0',
};

const footerLink = {
  color: '#6b7280',
  textDecoration: 'underline',
};

// Preview props for development
WeeklyDigest.PreviewProps = {
  userName: 'Sarah',
  district: 'California 11th District',
  dateRange: 'Dec 1-7, 2024',
  memberActions: [
    {
      id: '1',
      memberName: 'Rep. Nancy Pelosi',
      party: 'D',
      action: 'Voted',
      billNumber: 'H.R. 1234',
      billTitle: 'Infrastructure Investment Act',
      vote: 'YES',
    },
    {
      id: '2',
      memberName: 'Sen. Alex Padilla',
      party: 'D',
      action: 'Co-sponsored',
      billNumber: 'S. 567',
      billTitle: 'Climate Action Now Act',
    },
  ],
  trackedBillUpdates: [
    {
      id: '1',
      billNumber: 'H.R. 1234',
      title: 'Infrastructure Investment Act',
      status: 'Passed House',
      lastAction: 'Referred to Senate Committee on Dec 5',
      url: 'https://hakivo.com/bills/hr1234-118',
    },
  ],
  audioUrl: 'https://hakivo.com/audio/weekly-digest-dec-7.mp3',
  audioDuration: '8 min',
  unsubscribeUrl: 'https://hakivo.com/unsubscribe?token=xxx',
  preferencesUrl: 'https://hakivo.com/settings/notifications',
} as WeeklyDigestProps;
```

### Vote Alert Template (Real-time)

```tsx
// emails/vote-alert.tsx
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Preview,
} from '@react-email/components';
import { EmailHeader } from './components/header';

interface VoteAlertProps {
  billNumber: string;
  billTitle: string;
  passed: boolean;
  yesVotes: number;
  noVotes: number;
  memberVotes: Array<{
    name: string;
    party: string;
    vote: 'YES' | 'NO' | 'NOT VOTING';
    isUserRep: boolean;
  }>;
  billUrl: string;
  unsubscribeUrl: string;
}

export default function VoteAlert({
  billNumber,
  billTitle,
  passed,
  yesVotes,
  noVotes,
  memberVotes,
  billUrl,
  unsubscribeUrl,
}: VoteAlertProps) {
  return (
    <Html>
      <Head />
      <Preview>
        🚨 {billNumber} {passed ? 'PASSED' : 'FAILED'} ({yesVotes}-{noVotes})
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailHeader />

          <Section style={alertBanner(passed)}>
            <Text style={alertEmoji}>{passed ? '✅' : '❌'}</Text>
            <Text style={alertTitle}>
              {billNumber} {passed ? 'PASSED' : 'FAILED'}
            </Text>
            <Text style={voteCount}>{yesVotes} - {noVotes}</Text>
          </Section>

          <Section style={content}>
            <Text style={billTitleStyle}>{billTitle}</Text>

            {memberVotes.filter(m => m.isUserRep).length > 0 && (
              <>
                <Text style={sectionLabel}>Your Representatives Voted:</Text>
                {memberVotes
                  .filter(m => m.isUserRep)
                  .map((member, i) => (
                    <Text key={i} style={memberVote}>
                      <span style={member.vote === 'YES' ? voteYes : voteNo}>
                        {member.vote}
                      </span>
                      {' '}{member.name} ({member.party})
                    </Text>
                  ))}
              </>
            )}

            <Button href={billUrl} style={ctaButton}>
              View Full Vote Record
            </Button>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              You're receiving this because you're tracking {billNumber}.
            </Text>
            <a href={unsubscribeUrl} style={footerLink}>
              Stop alerts for this bill
            </a>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  maxWidth: '600px',
};

const alertBanner = (passed: boolean) => ({
  backgroundColor: passed ? '#dcfce7' : '#fee2e2',
  padding: '32px 24px',
  textAlign: 'center' as const,
});

const alertEmoji = {
  fontSize: '48px',
  margin: '0 0 12px',
};

const alertTitle = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#111827',
  margin: '0 0 8px',
};

const voteCount = {
  fontSize: '32px',
  fontWeight: '700',
  color: '#374151',
  margin: '0',
};

const content = {
  padding: '24px',
};

const billTitleStyle = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#111827',
  margin: '0 0 24px',
};

const sectionLabel = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#6b7280',
  margin: '0 0 12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const memberVote = {
  fontSize: '16px',
  color: '#374151',
  margin: '0 0 8px',
};

const voteYes = {
  backgroundColor: '#dcfce7',
  color: '#166534',
  padding: '2px 8px',
  borderRadius: '4px',
  fontWeight: '600',
};

const voteNo = {
  backgroundColor: '#fee2e2',
  color: '#991b1b',
  padding: '2px 8px',
  borderRadius: '4px',
  fontWeight: '600',
};

const ctaButton = {
  backgroundColor: '#7c3aed',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '12px 24px',
  display: 'block',
  margin: '24px auto 0',
  maxWidth: '200px',
};

const footer = {
  padding: '24px',
  textAlign: 'center' as const,
  borderTop: '1px solid #e5e7eb',
};

const footerText = {
  fontSize: '12px',
  color: '#9ca3af',
  margin: '0 0 8px',
};

const footerLink = {
  fontSize: '12px',
  color: '#6b7280',
  textDecoration: 'underline',
};
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
