-- Core user and application tables
-- SQLite compatible schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    password_hash TEXT,
    email_verified INTEGER DEFAULT 0,
    onboarding_completed INTEGER DEFAULT 0,
    workos_user_id TEXT,
    stripe_customer_id TEXT,
    subscription_status TEXT DEFAULT 'free',
    subscription_plan TEXT,
    subscription_period_end INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    briefing_frequency TEXT DEFAULT 'daily', -- 'daily', 'weekly', 'none'
    notification_email INTEGER DEFAULT 1,
    notification_sms INTEGER DEFAULT 0,
    phone_number TEXT,
    zipcode TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- User district tracking
CREATE TABLE IF NOT EXISTS user_districts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state TEXT NOT NULL,
    district INTEGER,
    congressional_district TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_districts_user ON user_districts(user_id);

-- Bill tracking
CREATE TABLE IF NOT EXISTS bill_tracking (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bill_id TEXT NOT NULL,
    bill_congress INTEGER NOT NULL,
    bill_type TEXT NOT NULL,
    bill_number INTEGER NOT NULL,
    tracked_at INTEGER NOT NULL,
    notifications_enabled INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_bill_tracking_user ON bill_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_tracking_bill ON bill_tracking(bill_id);

-- Chat sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

-- Scheduler logs
CREATE TABLE IF NOT EXISTS scheduler_logs (
    id TEXT PRIMARY KEY,
    scheduler_type TEXT NOT NULL, -- 'daily_brief', 'weekly_brief', 'congress_sync'
    executed_at INTEGER NOT NULL,
    users_processed INTEGER DEFAULT 0,
    jobs_enqueued INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_scheduler_logs_type ON scheduler_logs(scheduler_type);
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_executed ON scheduler_logs(executed_at);
