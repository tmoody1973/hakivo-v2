# Hakivo Stripe & Subscription Implementation Plan

## Overview

This document outlines the complete implementation plan for Stripe subscription billing integrated with the newsletter/alert system for Hakivo.

---

## 1. Stripe Product Setup

### Products & Prices

| Product | Price | Billing | Stripe Price ID |
|---------|-------|---------|-----------------|
| Hakivo Pro | $9.00 | Monthly | `price_xxx` (create in dashboard) |

### What Each Tier Gets

| Feature | Free | Pro ($9/mo) |
|---------|------|-------------|
| Podcast access | ✅ | ✅ |
| Basic bill search | ✅ | ✅ |
| AI briefs | 3/month | Unlimited |
| Weekly digest email | ✅ | ✅ |
| Daily briefing email | ❌ | ✅ |
| Real-time vote alerts | ❌ | ✅ |
| Audio briefs | ❌ | ✅ |
| Bill tracking | 3 bills | Unlimited |
| Rep following | 3 members | Unlimited |
| Keyword alerts | 1 keyword | Unlimited |

---

## 2. Database Schema

### New Tables

```sql
-- User subscription info (add to existing users table or create separate)
ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN subscription_current_period_end INTEGER;
ALTER TABLE users ADD COLUMN briefs_used_this_month INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN briefs_reset_date INTEGER;

-- User notification preferences
CREATE TABLE user_alert_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),

    -- Email frequency
    weekly_digest BOOLEAN DEFAULT true,
    daily_briefing BOOLEAN DEFAULT false,  -- Pro only
    realtime_alerts BOOLEAN DEFAULT false, -- Pro only

    -- What to track
    track_district_members BOOLEAN DEFAULT true,
    track_keywords TEXT,  -- JSON array: ["climate", "healthcare"]

    -- Delivery settings
    email_enabled BOOLEAN DEFAULT true,
    preferred_hour INTEGER DEFAULT 7,  -- Hour in user's timezone
    timezone TEXT DEFAULT 'America/New_York',

    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);

-- Bills user is tracking
CREATE TABLE user_bill_tracking (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    bill_id TEXT NOT NULL,
    congress INTEGER NOT NULL,
    notify_on_vote BOOLEAN DEFAULT true,
    notify_on_status_change BOOLEAN DEFAULT true,
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(user_id, bill_id, congress)
);

-- Members user is following
CREATE TABLE user_member_following (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    bioguide_id TEXT NOT NULL,
    notify_on_vote BOOLEAN DEFAULT true,
    notify_on_sponsor BOOLEAN DEFAULT true,
    is_district_rep BOOLEAN DEFAULT false,  -- Auto-followed based on address
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(user_id, bioguide_id)
);

-- Web notifications (bell icon)
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,  -- 'vote_alert', 'bill_update', 'brief_ready', 'new_episode'
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    read BOOLEAN DEFAULT false,
    created_at INTEGER DEFAULT (unixepoch())
);

-- Email send log
CREATE TABLE email_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email_type TEXT NOT NULL,  -- 'weekly_digest', 'vote_alert', 'daily_briefing'
    subject TEXT,
    resend_id TEXT,
    status TEXT DEFAULT 'sent',  -- 'sent', 'delivered', 'opened', 'bounced'
    sent_at INTEGER DEFAULT (unixepoch()),
    opened_at INTEGER,
    clicked_at INTEGER
);

-- Stripe webhook events log (for idempotency)
CREATE TABLE stripe_events (
    id TEXT PRIMARY KEY,  -- Stripe event ID
    type TEXT NOT NULL,
    processed_at INTEGER DEFAULT (unixepoch())
);
```

---

## 3. Raindrop Manifest Additions

```hcl
# ===========================================
# STRIPE INTEGRATION
# ===========================================

env "STRIPE_SECRET_KEY" {
  secret = true
}

env "STRIPE_WEBHOOK_SECRET" {
  secret = true
}

env "STRIPE_PRICE_ID" {
  # price_xxx from Stripe dashboard
}

# ===========================================
# RESEND EMAIL INTEGRATION
# ===========================================

env "RESEND_API_KEY" {
  secret = true
}

# ===========================================
# NEW SERVICES
# ===========================================

service "stripe-webhook" {
  visibility = "public"  # Must be public for Stripe webhooks
}

service "subscription-api" {
  visibility = "private"
}

service "email-service" {
  visibility = "private"
}

service "notifications-api" {
  visibility = "private"
}

# ===========================================
# ALERT SYSTEM
# ===========================================

queue "alert-queue" {}

observer "alert-observer" {
  source {
    queue = "alert-queue"
  }
}

# ===========================================
# SCHEDULED EMAIL TASKS
# ===========================================

task "weekly-digest-scheduler" {
  type = "cron"
  cron = "0 23 * * 0"  # Sunday 11pm UTC (6pm EST)
}

task "daily-briefing-scheduler" {
  type = "cron"
  cron = "0 12 * * *"  # Noon UTC (7am EST)
}

task "monthly-brief-reset" {
  type = "cron"
  cron = "0 0 1 * *"  # 1st of each month
}
```

---

## 4. Implementation Tasks

### Phase 1: Stripe Foundation

#### Task 1.1: Create Stripe Product
```bash
# In Stripe Dashboard:
1. Create Product: "Hakivo Pro"
2. Create Price: $9.00/month recurring
3. Copy price_id for env variable
```

#### Task 1.2: Set Environment Variables
```bash
npx raindrop build env set STRIPE_SECRET_KEY sk_live_xxx
npx raindrop build env set STRIPE_WEBHOOK_SECRET whsec_xxx
npx raindrop build env set STRIPE_PRICE_ID price_xxx
npx raindrop build env set RESEND_API_KEY re_xxx
```

#### Task 1.3: Create stripe-webhook Service

```typescript
// hakivo-api/src/stripe-webhook/index.ts
import { Hono } from 'hono';
import Stripe from 'stripe';

const app = new Hono();

app.post('/webhook', async (c) => {
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
  const signature = c.req.header('stripe-signature');
  const body = await c.req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      c.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed');
    return c.json({ error: 'Invalid signature' }, 400);
  }

  // Check idempotency
  const existing = await c.env.DB.prepare(
    'SELECT id FROM stripe_events WHERE id = ?'
  ).bind(event.id).first();

  if (existing) {
    return c.json({ received: true, duplicate: true });
  }

  // Process event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutComplete(c, session);
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionChange(c, subscription);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(c, invoice);
      break;
    }
  }

  // Log event for idempotency
  await c.env.DB.prepare(
    'INSERT INTO stripe_events (id, type) VALUES (?, ?)'
  ).bind(event.id, event.type).run();

  return c.json({ received: true });
});

async function handleCheckoutComplete(c: any, session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  if (!userId) return;

  await c.env.DB.prepare(`
    UPDATE users SET
      subscription_status = 'active',
      stripe_customer_id = ?,
      stripe_subscription_id = ?
    WHERE id = ?
  `).bind(
    session.customer,
    session.subscription,
    userId
  ).run();

  // Create notification
  await c.env.DB.prepare(`
    INSERT INTO notifications (id, user_id, type, title, body, link)
    VALUES (?, ?, 'subscription', 'Welcome to Pro!',
      'You now have unlimited access to AI briefs, alerts, and more.',
      '/settings')
  `).bind(crypto.randomUUID(), userId).run();
}

async function handleSubscriptionChange(c: any, subscription: Stripe.Subscription) {
  const status = subscription.status === 'active' ? 'active' : 'free';

  await c.env.DB.prepare(`
    UPDATE users SET
      subscription_status = ?,
      subscription_current_period_end = ?
    WHERE stripe_subscription_id = ?
  `).bind(
    status,
    subscription.current_period_end,
    subscription.id
  ).run();
}

async function handlePaymentFailed(c: any, invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // Get user by customer ID
  const user = await c.env.DB.prepare(
    'SELECT id, email FROM users WHERE stripe_customer_id = ?'
  ).bind(customerId).first();

  if (user) {
    // Create notification
    await c.env.DB.prepare(`
      INSERT INTO notifications (id, user_id, type, title, body, link)
      VALUES (?, ?, 'billing', 'Payment Failed',
        'Please update your payment method to continue Pro access.',
        '/settings/billing')
    `).bind(crypto.randomUUID(), user.id).run();
  }
}

export default app;
```

#### Task 1.4: Create subscription-api Service

```typescript
// hakivo-api/src/subscription-api/index.ts
import { Hono } from 'hono';
import Stripe from 'stripe';

const app = new Hono();

// Create checkout session
app.post('/create-checkout', async (c) => {
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
  const { userId, email, successUrl, cancelUrl } = await c.req.json();

  // Check if user already has customer ID
  const user = await c.env.DB.prepare(
    'SELECT stripe_customer_id FROM users WHERE id = ?'
  ).bind(userId).first();

  let customerId = user?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({ email });
    customerId = customer.id;

    await c.env.DB.prepare(
      'UPDATE users SET stripe_customer_id = ? WHERE id = ?'
    ).bind(customerId, userId).run();
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{
      price: c.env.STRIPE_PRICE_ID,
      quantity: 1,
    }],
    success_url: successUrl || 'https://hakivo.com/settings?upgraded=true',
    cancel_url: cancelUrl || 'https://hakivo.com/pricing',
    metadata: { user_id: userId },
  });

  return c.json({ url: session.url });
});

// Create billing portal session
app.post('/create-portal', async (c) => {
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
  const { userId, returnUrl } = await c.req.json();

  const user = await c.env.DB.prepare(
    'SELECT stripe_customer_id FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!user?.stripe_customer_id) {
    return c.json({ error: 'No subscription found' }, 400);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: returnUrl || 'https://hakivo.com/settings',
  });

  return c.json({ url: session.url });
});

// Check subscription status
app.get('/status/:userId', async (c) => {
  const userId = c.req.param('userId');

  const user = await c.env.DB.prepare(`
    SELECT
      subscription_status,
      subscription_current_period_end,
      briefs_used_this_month
    FROM users WHERE id = ?
  `).bind(userId).first();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const isPro = user.subscription_status === 'active';
  const briefsRemaining = isPro ? -1 : Math.max(0, 3 - (user.briefs_used_this_month || 0));

  return c.json({
    isPro,
    status: user.subscription_status,
    periodEnd: user.subscription_current_period_end,
    briefsRemaining,
    briefsUsed: user.briefs_used_this_month || 0,
  });
});

// Increment brief usage (called when generating brief)
app.post('/use-brief/:userId', async (c) => {
  const userId = c.req.param('userId');

  const user = await c.env.DB.prepare(`
    SELECT subscription_status, briefs_used_this_month
    FROM users WHERE id = ?
  `).bind(userId).first();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const isPro = user.subscription_status === 'active';
  const currentUsage = user.briefs_used_this_month || 0;

  // Pro users: unlimited
  if (isPro) {
    return c.json({ allowed: true, remaining: -1 });
  }

  // Free users: check limit
  if (currentUsage >= 3) {
    return c.json({ allowed: false, remaining: 0 });
  }

  // Increment usage
  await c.env.DB.prepare(`
    UPDATE users SET briefs_used_this_month = ? WHERE id = ?
  `).bind(currentUsage + 1, userId).run();

  return c.json({ allowed: true, remaining: 2 - currentUsage });
});

export default app;
```

---

### Phase 2: Email Service

#### Task 2.1: Create email-service

```typescript
// hakivo-api/src/email-service/index.ts
import { Hono } from 'hono';
import { Resend } from 'resend';

const app = new Hono();

// Send weekly digest
app.post('/send-weekly-digest', async (c) => {
  const resend = new Resend(c.env.RESEND_API_KEY);
  const { userId, data } = await c.req.json();

  const user = await c.env.DB.prepare(
    'SELECT email, name FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Build email HTML (simplified - use React Email in production)
  const html = buildWeeklyDigestHtml(data);

  const { data: result, error } = await resend.emails.send({
    from: 'Hakivo <briefs@hakivo.com>',
    to: user.email,
    subject: `Your Week in Congress - ${data.dateRange}`,
    html,
  });

  if (error) {
    console.error('Email send error:', error);
    return c.json({ error: error.message }, 500);
  }

  // Log email
  await c.env.DB.prepare(`
    INSERT INTO email_log (id, user_id, email_type, subject, resend_id)
    VALUES (?, ?, 'weekly_digest', ?, ?)
  `).bind(crypto.randomUUID(), userId, `Your Week in Congress - ${data.dateRange}`, result.id).run();

  return c.json({ success: true, id: result.id });
});

// Send vote alert (real-time)
app.post('/send-vote-alert', async (c) => {
  const resend = new Resend(c.env.RESEND_API_KEY);
  const { userId, bill, voteResult } = await c.req.json();

  // Check if user is Pro and has realtime alerts enabled
  const user = await c.env.DB.prepare(`
    SELECT u.email, u.name, u.subscription_status, p.realtime_alerts
    FROM users u
    LEFT JOIN user_alert_preferences p ON u.id = p.user_id
    WHERE u.id = ?
  `).bind(userId).first();

  if (!user || user.subscription_status !== 'active' || !user.realtime_alerts) {
    return c.json({ skipped: true, reason: 'not_eligible' });
  }

  const passed = voteResult.yes > voteResult.no;
  const subject = `🚨 ${bill.number} ${passed ? 'PASSED' : 'FAILED'} (${voteResult.yes}-${voteResult.no})`;

  const html = buildVoteAlertHtml({ bill, voteResult, passed });

  const { data: result, error } = await resend.emails.send({
    from: 'Hakivo Alerts <alerts@hakivo.com>',
    to: user.email,
    subject,
    html,
  });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  // Log email
  await c.env.DB.prepare(`
    INSERT INTO email_log (id, user_id, email_type, subject, resend_id)
    VALUES (?, ?, 'vote_alert', ?, ?)
  `).bind(crypto.randomUUID(), userId, subject, result.id).run();

  return c.json({ success: true, id: result.id });
});

// Helper functions for building email HTML
function buildWeeklyDigestHtml(data: any): string {
  // Simplified HTML - use React Email templates in production
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, sans-serif; background: #f6f9fc; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { text-align: center; padding: 20px; border-bottom: 1px solid #e5e5e5; }
        .content { padding: 24px; }
        .section-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
        .bill-card { background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
        .vote-yes { background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; }
        .vote-no { background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; }
        .cta { display: block; background: #7c3aed; color: white; text-align: center; padding: 14px; border-radius: 6px; text-decoration: none; margin: 24px auto; max-width: 200px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Hakivo</h1>
          <p>Democracy, Explained</p>
        </div>
        <div class="content">
          <h2>Your Week in Congress</h2>
          <p>${data.district} • ${data.dateRange}</p>

          ${data.audioUrl ? `<a href="${data.audioUrl}" class="cta">🎧 Listen to Audio (${data.audioDuration})</a>` : ''}

          <div class="section-title">Your Representatives This Week</div>
          ${data.memberActions.map((a: any) => `
            <div style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
              <strong>${a.memberName} (${a.party})</strong><br>
              ${a.vote ? `<span class="${a.vote === 'YES' ? 'vote-yes' : 'vote-no'}">${a.vote}</span>` : ''}
              ${a.action} on ${a.billNumber}<br>
              <small>${a.billTitle}</small>
            </div>
          `).join('')}

          <div class="section-title" style="margin-top: 24px;">Bills You're Tracking</div>
          ${data.trackedBillUpdates.map((b: any) => `
            <div class="bill-card">
              <small>${b.billNumber}</small><br>
              <a href="${b.url}">${b.title}</a><br>
              <strong>Status: ${b.status}</strong><br>
              <small>${b.lastAction}</small>
            </div>
          `).join('')}

          <a href="https://hakivo.com/dashboard" class="cta">View Full Dashboard</a>
        </div>
      </div>
    </body>
    </html>
  `;
}

function buildVoteAlertHtml(data: any): string {
  const { bill, voteResult, passed } = data;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, sans-serif; background: #f6f9fc; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .alert-banner { background: ${passed ? '#dcfce7' : '#fee2e2'}; padding: 32px; text-align: center; }
        .content { padding: 24px; }
        .cta { display: block; background: #7c3aed; color: white; text-align: center; padding: 12px; border-radius: 6px; text-decoration: none; margin: 24px auto; max-width: 200px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="alert-banner">
          <div style="font-size: 48px;">${passed ? '✅' : '❌'}</div>
          <h2>${bill.number} ${passed ? 'PASSED' : 'FAILED'}</h2>
          <div style="font-size: 32px; font-weight: bold;">${voteResult.yes} - ${voteResult.no}</div>
        </div>
        <div class="content">
          <h3>${bill.title}</h3>
          <a href="https://hakivo.com/bills/${bill.id}" class="cta">View Full Vote Record</a>
        </div>
      </div>
    </body>
    </html>
  `;
}

export default app;
```

---

### Phase 3: Notifications API

#### Task 3.1: Create notifications-api Service

```typescript
// hakivo-api/src/notifications-api/index.ts
import { Hono } from 'hono';

const app = new Hono();

// Get user's notifications
app.get('/:userId', async (c) => {
  const userId = c.req.param('userId');
  const limit = parseInt(c.req.query('limit') || '20');

  const notifications = await c.env.DB.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(userId, limit).all();

  const unreadCount = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM notifications
    WHERE user_id = ? AND read = false
  `).bind(userId).first();

  return c.json({
    notifications: notifications.results,
    unreadCount: unreadCount?.count || 0,
  });
});

// Mark notification as read
app.post('/:notificationId/read', async (c) => {
  const notificationId = c.req.param('notificationId');

  await c.env.DB.prepare(`
    UPDATE notifications SET read = true WHERE id = ?
  `).bind(notificationId).run();

  return c.json({ success: true });
});

// Mark all as read
app.post('/mark-all-read/:userId', async (c) => {
  const userId = c.req.param('userId');

  await c.env.DB.prepare(`
    UPDATE notifications SET read = true WHERE user_id = ?
  `).bind(userId).run();

  return c.json({ success: true });
});

// Create notification (internal use)
app.post('/create', async (c) => {
  const { userId, type, title, body, link } = await c.req.json();

  const id = crypto.randomUUID();

  await c.env.DB.prepare(`
    INSERT INTO notifications (id, user_id, type, title, body, link)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, userId, type, title, body, link).run();

  return c.json({ success: true, id });
});

export default app;
```

---

### Phase 4: Alert Observer

#### Task 4.1: Create alert-observer

```typescript
// hakivo-api/src/alert-observer/index.ts
import { Hono } from 'hono';

const app = new Hono();

interface AlertMessage {
  type: 'vote_complete' | 'bill_status_change' | 'new_bill';
  billId?: string;
  congress?: number;
  data: any;
}

app.post('/', async (c) => {
  const messages = await c.req.json() as AlertMessage[];

  for (const message of messages) {
    switch (message.type) {
      case 'vote_complete':
        await processVoteAlert(c, message);
        break;
      case 'bill_status_change':
        await processBillStatusAlert(c, message);
        break;
      case 'new_bill':
        await processNewBillAlert(c, message);
        break;
    }
  }

  return c.json({ processed: messages.length });
});

async function processVoteAlert(c: any, message: AlertMessage) {
  const { billId, congress, data } = message;

  // Find users tracking this bill
  const trackers = await c.env.DB.prepare(`
    SELECT t.user_id, u.subscription_status, p.realtime_alerts
    FROM user_bill_tracking t
    JOIN users u ON t.user_id = u.id
    LEFT JOIN user_alert_preferences p ON t.user_id = p.user_id
    WHERE t.bill_id = ? AND t.congress = ? AND t.notify_on_vote = true
  `).bind(billId, congress).all();

  for (const tracker of trackers.results) {
    // Create web notification for all users
    await c.env.DB.prepare(`
      INSERT INTO notifications (id, user_id, type, title, body, link)
      VALUES (?, ?, 'vote_alert', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      tracker.user_id,
      `${data.billNumber} Vote Result`,
      `${data.passed ? 'Passed' : 'Failed'} ${data.yesVotes}-${data.noVotes}`,
      `/bills/${billId}`
    ).run();

    // Send email only to Pro users with realtime alerts enabled
    if (tracker.subscription_status === 'active' && tracker.realtime_alerts) {
      // Call email service
      await fetch(`${c.env.EMAIL_SERVICE_URL}/send-vote-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: tracker.user_id,
          bill: { id: billId, number: data.billNumber, title: data.billTitle },
          voteResult: { yes: data.yesVotes, no: data.noVotes },
        }),
      });
    }
  }
}

async function processBillStatusAlert(c: any, message: AlertMessage) {
  const { billId, congress, data } = message;

  // Find users tracking this bill
  const trackers = await c.env.DB.prepare(`
    SELECT user_id FROM user_bill_tracking
    WHERE bill_id = ? AND congress = ? AND notify_on_status_change = true
  `).bind(billId, congress).all();

  for (const tracker of trackers.results) {
    await c.env.DB.prepare(`
      INSERT INTO notifications (id, user_id, type, title, body, link)
      VALUES (?, ?, 'bill_update', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      tracker.user_id,
      `${data.billNumber} Status Update`,
      `New status: ${data.newStatus}`,
      `/bills/${billId}`
    ).run();
  }
}

async function processNewBillAlert(c: any, message: AlertMessage) {
  const { data } = message;

  // Find users tracking keywords that match this bill
  const users = await c.env.DB.prepare(`
    SELECT user_id, track_keywords FROM user_alert_preferences
    WHERE track_keywords IS NOT NULL
  `).all();

  for (const user of users.results) {
    const keywords = JSON.parse(user.track_keywords || '[]');
    const titleLower = data.title.toLowerCase();

    if (keywords.some((kw: string) => titleLower.includes(kw.toLowerCase()))) {
      await c.env.DB.prepare(`
        INSERT INTO notifications (id, user_id, type, title, body, link)
        VALUES (?, ?, 'new_bill', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        user.user_id,
        `New Bill: ${data.billNumber}`,
        data.title,
        `/bills/${data.billId}`
      ).run();
    }
  }
}

export default app;
```

---

### Phase 5: Scheduled Tasks

#### Task 5.1: Weekly Digest Scheduler

```typescript
// hakivo-api/src/weekly-digest-scheduler/index.ts
import { Hono } from 'hono';

const app = new Hono();

app.post('/', async (c) => {
  // Get all users who want weekly digest
  const users = await c.env.DB.prepare(`
    SELECT u.id, u.email, u.name, u.district_state, u.district_number
    FROM users u
    JOIN user_alert_preferences p ON u.id = p.user_id
    WHERE p.weekly_digest = true AND p.email_enabled = true
  `).all();

  const oneWeekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  for (const user of users.results) {
    // Get member actions for user's district
    const memberActions = await getMemberActionsForDistrict(
      c,
      user.district_state,
      user.district_number,
      oneWeekAgo
    );

    // Get updates on tracked bills
    const trackedBillUpdates = await getTrackedBillUpdates(c, user.id, oneWeekAgo);

    // Skip if nothing to report
    if (memberActions.length === 0 && trackedBillUpdates.length === 0) {
      continue;
    }

    // Generate audio digest if user is Pro
    let audioUrl, audioDuration;
    const isPro = await checkIsPro(c, user.id);
    if (isPro) {
      // Call existing TTS service
      const audio = await generateAudioDigest(c, { memberActions, trackedBillUpdates });
      audioUrl = audio.url;
      audioDuration = audio.duration;
    }

    // Send email
    await fetch(`${c.env.EMAIL_SERVICE_URL}/send-weekly-digest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        data: {
          userName: user.name || 'there',
          district: `${user.district_state}-${user.district_number}`,
          dateRange: getDateRange(),
          memberActions,
          trackedBillUpdates,
          audioUrl,
          audioDuration,
          unsubscribeUrl: `https://hakivo.com/unsubscribe?user=${user.id}`,
          preferencesUrl: 'https://hakivo.com/settings/notifications',
        },
      }),
    });
  }

  return c.json({ processed: users.results.length });
});

// Helper functions
async function getMemberActionsForDistrict(c: any, state: string, district: number, since: number) {
  // Query votes and sponsorships by district representatives
  const result = await c.env.DB.prepare(`
    SELECT
      m.name as memberName,
      m.party,
      v.vote,
      b.bill_number as billNumber,
      b.title as billTitle
    FROM member_votes v
    JOIN members m ON v.bioguide_id = m.bioguide_id
    JOIN bills b ON v.bill_id = b.bill_id AND v.congress = b.congress
    WHERE m.state = ? AND m.district = ? AND v.vote_date >= ?
    ORDER BY v.vote_date DESC
    LIMIT 20
  `).bind(state, district, since).all();

  return result.results.map((r: any, i: number) => ({
    id: String(i),
    memberName: r.memberName,
    party: r.party,
    action: 'Voted',
    billNumber: r.billNumber,
    billTitle: r.billTitle,
    vote: r.vote,
  }));
}

async function getTrackedBillUpdates(c: any, userId: string, since: number) {
  const result = await c.env.DB.prepare(`
    SELECT
      b.bill_id as id,
      b.bill_number as billNumber,
      b.title,
      b.status,
      b.latest_action as lastAction
    FROM user_bill_tracking t
    JOIN bills b ON t.bill_id = b.bill_id AND t.congress = b.congress
    WHERE t.user_id = ? AND b.updated_at >= ?
  `).bind(userId, since).all();

  return result.results.map((r: any) => ({
    id: r.id,
    billNumber: r.billNumber,
    title: r.title,
    status: r.status,
    lastAction: r.lastAction,
    url: `https://hakivo.com/bills/${r.id}`,
  }));
}

function getDateRange(): string {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const format = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${format(oneWeekAgo)} - ${format(now)}, ${now.getFullYear()}`;
}

async function checkIsPro(c: any, userId: string): Promise<boolean> {
  const user = await c.env.DB.prepare(
    'SELECT subscription_status FROM users WHERE id = ?'
  ).bind(userId).first();
  return user?.subscription_status === 'active';
}

async function generateAudioDigest(c: any, data: any) {
  // Call existing TTS service
  // Returns { url: string, duration: string }
  return { url: null, duration: null };
}

export default app;
```

---

## 5. Next.js Frontend Integration

### API Routes

```typescript
// app/api/stripe/checkout/route.ts
import { NextResponse } from 'next/server';

const SUBSCRIPTION_API = process.env.SUBSCRIPTION_API_URL;

export async function POST(req: Request) {
  const { userId, email } = await req.json();

  const response = await fetch(`${SUBSCRIPTION_API}/create-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      email,
      successUrl: `${process.env.NEXT_PUBLIC_URL}/settings?upgraded=true`,
      cancelUrl: `${process.env.NEXT_PUBLIC_URL}/pricing`,
    }),
  });

  const data = await response.json();
  return NextResponse.json(data);
}
```

```typescript
// app/api/stripe/portal/route.ts
import { NextResponse } from 'next/server';

const SUBSCRIPTION_API = process.env.SUBSCRIPTION_API_URL;

export async function POST(req: Request) {
  const { userId } = await req.json();

  const response = await fetch(`${SUBSCRIPTION_API}/create-portal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      returnUrl: `${process.env.NEXT_PUBLIC_URL}/settings`,
    }),
  });

  const data = await response.json();
  return NextResponse.json(data);
}
```

### Pricing Page Component

```tsx
// app/pricing/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function PricingPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user?.id,
        email: user?.email,
      }),
    });

    const { url } = await res.json();
    window.location.href = url;
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold text-center mb-8">Choose Your Plan</h1>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Free Tier */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold">Free</h2>
          <p className="text-3xl font-bold mt-2">$0<span className="text-sm font-normal">/mo</span></p>
          <ul className="mt-4 space-y-2">
            <li>✅ Podcast access</li>
            <li>✅ Basic bill search</li>
            <li>✅ 3 AI briefs/month</li>
            <li>✅ Weekly digest email</li>
            <li>✅ Track 3 bills</li>
            <li>❌ Daily briefings</li>
            <li>❌ Real-time alerts</li>
            <li>❌ Audio briefs</li>
          </ul>
          <button
            disabled
            className="w-full mt-6 py-2 border rounded-lg text-gray-500"
          >
            Current Plan
          </button>
        </div>

        {/* Pro Tier */}
        <div className="border-2 border-purple-600 rounded-lg p-6 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-sm px-3 py-1 rounded-full">
            RECOMMENDED
          </div>
          <h2 className="text-xl font-semibold">Pro</h2>
          <p className="text-3xl font-bold mt-2">$9<span className="text-sm font-normal">/mo</span></p>
          <ul className="mt-4 space-y-2">
            <li>✅ Everything in Free</li>
            <li>✅ <strong>Unlimited</strong> AI briefs</li>
            <li>✅ Daily briefing emails</li>
            <li>✅ Real-time vote alerts</li>
            <li>✅ Audio briefs</li>
            <li>✅ Unlimited bill tracking</li>
            <li>✅ Keyword alerts</li>
            <li>✅ Priority support</li>
          </ul>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full mt-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Upgrade to Pro'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Implementation Checklist

### Phase 1: Stripe Foundation (Day 1-2)
- [ ] Create Stripe product & price in dashboard
- [ ] Set environment variables in Raindrop
- [ ] Create database tables
- [ ] Implement stripe-webhook service
- [ ] Implement subscription-api service
- [ ] Register Stripe webhook URL in dashboard
- [ ] Test checkout flow end-to-end

### Phase 2: Email Service (Day 3-4)
- [ ] Set up Resend account and verify domain
- [ ] Implement email-service
- [ ] Create email templates
- [ ] Test email sending

### Phase 3: Notifications (Day 5)
- [ ] Implement notifications-api
- [ ] Create NotificationBell component
- [ ] Add notifications dropdown UI

### Phase 4: Alert System (Day 6-7)
- [ ] Create alert-queue and alert-observer
- [ ] Modify congress-sync to emit alert events
- [ ] Implement weekly-digest-scheduler
- [ ] Implement daily-briefing-scheduler
- [ ] Test full alert flow

### Phase 5: Frontend (Day 8-9)
- [ ] Create pricing page
- [ ] Add upgrade prompts throughout app
- [ ] Create notification settings page
- [ ] Add bill tracking UI
- [ ] Add member following UI

### Phase 6: Testing & Launch (Day 10)
- [ ] End-to-end testing of all flows
- [ ] Monitor webhook events
- [ ] Soft launch to beta users
- [ ] Full launch

---

## 7. Cost Estimates

| Service | Free Tier | Estimated Monthly Cost |
|---------|-----------|------------------------|
| Stripe | 2.9% + $0.30 per transaction | ~$0.60 per $9 subscription = $0.54 net |
| Resend | 3,000 emails/month free | $0 initially, $20/mo at scale |
| Raindrop | Included | Part of existing infrastructure |

**Revenue projection at 100 Pro users:**
- Gross: 100 × $9 = $900/month
- Stripe fees: 100 × $0.56 = $56/month
- Resend: $0 (under 3,000 emails)
- Net: ~$844/month

---

## Summary

This plan provides a complete, simple subscription system that:

1. **Uses one product, one price** - No complex tier logic
2. **Gates meaningful features** - Pro unlocks real value (unlimited briefs, alerts, audio)
3. **Integrates with existing infrastructure** - Builds on Raindrop services
4. **Provides clear upgrade path** - Free users hit limits, Pro removes them
5. **Delivers ongoing value** - Weekly/daily emails keep users engaged

The implementation is broken into phases that can be deployed incrementally, with each phase delivering working functionality.
