-- User bill bookmarks table
-- Allows users to save bills to their profile

CREATE TABLE IF NOT EXISTS user_bill_bookmarks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    bill_id TEXT NOT NULL, -- Reference to bills table
    title TEXT NOT NULL,
    policy_area TEXT NOT NULL,
    latest_action_text TEXT,
    latest_action_date TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
    UNIQUE(user_id, bill_id) -- Prevent duplicate bookmarks
);

CREATE INDEX IF NOT EXISTS idx_bill_bookmarks_user ON user_bill_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_bookmarks_created ON user_bill_bookmarks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bill_bookmarks_policy_area ON user_bill_bookmarks(policy_area);
