-- Briefs and audio content tables
-- SQLite compatible schema

-- Briefs
CREATE TABLE IF NOT EXISTS briefs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'daily', 'weekly', 'custom'
    title TEXT NOT NULL,
    content TEXT, -- JSON content with sections
    script TEXT, -- Podcast script (dialogue format)
    audio_url TEXT,
    audio_duration INTEGER, -- Duration in seconds
    character_count INTEGER,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'generating', 'ready', 'failed'
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_briefs_user ON briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_briefs_type ON briefs(type);
CREATE INDEX IF NOT EXISTS idx_briefs_status ON briefs(status);
CREATE INDEX IF NOT EXISTS idx_briefs_created ON briefs(created_at);

-- Brief sections (for structured content)
CREATE TABLE IF NOT EXISTS brief_sections (
    id TEXT PRIMARY KEY,
    brief_id TEXT NOT NULL,
    section_type TEXT NOT NULL, -- 'summary', 'bills', 'votes', 'member_activity'
    title TEXT NOT NULL,
    content TEXT NOT NULL, -- JSON content
    order_index INTEGER NOT NULL,
    FOREIGN KEY (brief_id) REFERENCES briefs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_brief_sections_brief ON brief_sections(brief_id);

-- Brief bills (bills included in a brief)
CREATE TABLE IF NOT EXISTS brief_bills (
    brief_id TEXT NOT NULL,
    bill_id TEXT NOT NULL,
    section_type TEXT, -- Which section this bill appears in
    PRIMARY KEY (brief_id, bill_id),
    FOREIGN KEY (brief_id) REFERENCES briefs(id) ON DELETE CASCADE,
    FOREIGN KEY (bill_id) REFERENCES bills(id)
);

-- Sync logs (for tracking Congress.gov sync operations)
CREATE TABLE IF NOT EXISTS sync_logs (
    id TEXT PRIMARY KEY,
    sync_type TEXT NOT NULL, -- 'scheduled_sync', 'manual_sync', 'initial_sync'
    status TEXT NOT NULL, -- 'queued', 'running', 'completed', 'failed'
    started_at INTEGER,
    completed_at INTEGER,
    metadata TEXT, -- JSON metadata about the sync
    error_message TEXT,
    bills_synced INTEGER DEFAULT 0,
    members_synced INTEGER DEFAULT 0,
    committees_synced INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_type ON sync_logs(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON sync_logs(started_at);
