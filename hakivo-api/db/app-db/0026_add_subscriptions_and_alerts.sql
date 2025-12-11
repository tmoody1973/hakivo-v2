-- Subscriptions and Alerts System
-- Migration: 0026_add_subscriptions_and_alerts.sql
-- Adds Stripe subscription tracking, notifications, and alert preferences

-- NOTE: Subscription columns are now defined in 0000_core_tables.sql
-- Only create indexes here (columns already exist)
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Stripe events log for idempotency and audit trail
CREATE TABLE IF NOT EXISTS stripe_events (
    id TEXT PRIMARY KEY,
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    payload TEXT NOT NULL,
    processed_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_user ON stripe_events(user_id);

-- User alert preferences (extends user_preferences for alerts)
CREATE TABLE IF NOT EXISTS user_alert_preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    weekly_digest_enabled INTEGER DEFAULT 1,
    daily_briefing_enabled INTEGER DEFAULT 0,
    realtime_vote_alerts INTEGER DEFAULT 0,
    realtime_bill_updates INTEGER DEFAULT 0,
    email_alerts_enabled INTEGER DEFAULT 1,
    push_alerts_enabled INTEGER DEFAULT 0,
    alert_time_preference TEXT DEFAULT '08:00',
    timezone TEXT DEFAULT 'America/New_York',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- User member following (for vote alerts)
CREATE TABLE IF NOT EXISTS user_member_following (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL,
    bioguide_id TEXT,
    member_name TEXT,
    notifications_enabled INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_member_following_user ON user_member_following(user_id);
CREATE INDEX IF NOT EXISTS idx_member_following_member ON user_member_following(member_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_following_unique ON user_member_following(user_id, member_id);

-- Notifications table (in-app notification bell)
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'vote_alert', 'bill_update', 'new_brief', 'subscription', 'system'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    metadata TEXT, -- JSON for extra context (bill_id, member_id, etc.)
    read INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- Email log for tracking sent emails
CREATE TABLE IF NOT EXISTS email_log (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    email_type TEXT NOT NULL, -- 'weekly_digest', 'daily_briefing', 'vote_alert', 'welcome', 'subscription'
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    resend_id TEXT,
    status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'bounced', 'failed'
    metadata TEXT, -- JSON for extra context
    sent_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_log_user ON email_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_log_type ON email_log(email_type);
CREATE INDEX IF NOT EXISTS idx_email_log_sent ON email_log(sent_at);

-- Newsletter subscribers (for non-registered users)
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    subscribed INTEGER DEFAULT 1,
    source TEXT DEFAULT 'website', -- 'website', 'signup', 'import'
    preferences TEXT, -- JSON for topic preferences
    confirmed INTEGER DEFAULT 0,
    confirmation_token TEXT,
    unsubscribe_token TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribed ON newsletter_subscribers(subscribed);
