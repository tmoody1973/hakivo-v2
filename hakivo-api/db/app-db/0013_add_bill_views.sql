-- User bill views table
-- Tracks which bills each user has seen to prevent showing duplicates
-- Cleaned up by scheduled tasks (keep last 7 days per user)

CREATE TABLE IF NOT EXISTS user_bill_views (
    user_id TEXT NOT NULL,
    bill_id TEXT NOT NULL,
    viewed_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, bill_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_bill_views_user ON user_bill_views(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bill_views_viewed_at ON user_bill_views(viewed_at);
