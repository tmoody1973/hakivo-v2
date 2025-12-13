# User Analytics Plan - PostHog Only

## Overview

Use **PostHog** as the single analytics solution. No custom database tables needed.

---

## Why PostHog Only?

- **Session Recording** - See exactly what users do
- **Event Tracking** - Automatic + custom events
- **User Identification** - Link events to users
- **Funnels** - Visual conversion tracking
- **Retention** - Cohort analysis built-in
- **Dashboards** - Build custom dashboards in PostHog UI
- **Feature Flags** - A/B testing ready
- **No maintenance** - Hosted solution

---

## Implementation

### Step 1: Install PostHog

```bash
cd /Users/tarikmoody/Documents/Projects/hakivo-v2
npm install posthog-js
```

### Step 2: Create PostHog Provider

```tsx
// lib/analytics/posthog-provider.tsx
'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
    capture_pageview: false, // We'll capture manually for Next.js
    capture_pageleave: true,
    autocapture: true,
  });
}

export function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url = url + '?' + searchParams.toString();
      }
      posthog.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
```

### Step 3: Add to Layout

```tsx
// app/layout.tsx
import { PostHogProvider, PostHogPageview } from '@/lib/analytics/posthog-provider';
import { Suspense } from 'react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PostHogProvider>
          <Suspense fallback={null}>
            <PostHogPageview />
          </Suspense>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
```

### Step 4: Identify Users on Login

```tsx
// lib/auth/auth-context.tsx (add to login success)
import posthog from 'posthog-js';

// After successful login:
posthog.identify(user.id, {
  email: user.email,
  name: `${user.firstName} ${user.lastName}`,
  plan: subscription.isPro ? 'pro' : 'free',
  created_at: user.createdAt,
});
```

### Step 5: Track Key Events

```tsx
// lib/analytics/track.ts
import posthog from 'posthog-js';

export const analytics = {
  // Bills
  billViewed: (billId: string, billTitle: string) => {
    posthog.capture('bill_viewed', { bill_id: billId, bill_title: billTitle });
  },
  billTracked: (billId: string) => {
    posthog.capture('bill_tracked', { bill_id: billId });
  },

  // Representatives
  memberViewed: (memberId: string, memberName: string) => {
    posthog.capture('member_viewed', { member_id: memberId, member_name: memberName });
  },
  memberFollowed: (memberId: string) => {
    posthog.capture('member_followed', { member_id: memberId });
  },

  // Briefs & Audio
  briefPlayed: (briefId: string, briefType: string) => {
    posthog.capture('brief_played', { brief_id: briefId, brief_type: briefType });
  },
  briefCompleted: (briefId: string, duration: number) => {
    posthog.capture('brief_completed', { brief_id: briefId, duration_seconds: duration });
  },

  // Chat
  chatMessageSent: (sessionId: string) => {
    posthog.capture('chat_message_sent', { session_id: sessionId });
  },
  artifactCreated: (artifactType: string) => {
    posthog.capture('artifact_created', { artifact_type: artifactType });
  },

  // Subscription
  upgradeModalViewed: () => {
    posthog.capture('upgrade_modal_viewed');
  },
  checkoutStarted: () => {
    posthog.capture('checkout_started');
  },
  subscriptionStarted: (plan: string) => {
    posthog.capture('subscription_started', { plan });
  },

  // Onboarding
  onboardingStarted: () => {
    posthog.capture('onboarding_started');
  },
  onboardingCompleted: () => {
    posthog.capture('onboarding_completed');
  },
};
```

### Step 6: Add Environment Variables

```bash
# .env.local
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

## Events to Track

| Event | When | Properties |
|-------|------|------------|
| `$pageview` | Every page | Auto-captured |
| `bill_viewed` | Bill detail page | bill_id, bill_title |
| `bill_tracked` | User tracks bill | bill_id |
| `bill_searched` | Search performed | query, results_count |
| `member_viewed` | Rep detail page | member_id, member_name |
| `member_followed` | User follows rep | member_id |
| `brief_played` | Audio starts | brief_id, brief_type |
| `brief_completed` | Audio finishes | brief_id, duration |
| `chat_message_sent` | User sends message | session_id |
| `artifact_created` | Report generated | artifact_type |
| `upgrade_modal_viewed` | Modal shown | - |
| `checkout_started` | Stripe redirect | - |
| `subscription_started` | Payment success | plan |
| `onboarding_completed` | Onboarding done | - |

---

## PostHog Dashboards to Create

### 1. User Overview
- Daily/Weekly/Monthly Active Users
- New signups over time
- User retention cohorts

### 2. Feature Adoption
- Bills viewed/tracked per day
- Members followed per day
- Briefs played completion rate
- Chat usage trends

### 3. Conversion Funnel
- Visit → Signup → Onboarding → First Action → Pro

### 4. Engagement
- Session duration
- Pages per session
- Most viewed bills/members

---

## Files to Create/Modify

### New Files
```
lib/analytics/posthog-provider.tsx
lib/analytics/track.ts
```

### Modified Files
```
app/layout.tsx (add PostHog provider)
lib/auth/auth-context.tsx (identify user on login)
components/bill-header.tsx (track bill views)
app/representatives/[id]/page.tsx (track member views)
components/persistent-audio-player.tsx (track brief plays)
app/chat/c1/page.tsx (track chat events)
components/upgrade-modal.tsx (track upgrade flow)
```

---

## Timeline

| Task | Time |
|------|------|
| Install + setup provider | 30 min |
| Add user identification | 15 min |
| Add key event tracking | 1-2 hours |
| Create PostHog dashboards | 1 hour |
| **Total** | **~3-4 hours** |

---

## Quick Start

```bash
# 1. Install
npm install posthog-js

# 2. Get your PostHog key from https://app.posthog.com
# 3. Add to .env.local

# 4. Create the provider and add to layout
# 5. Start tracking!
```
