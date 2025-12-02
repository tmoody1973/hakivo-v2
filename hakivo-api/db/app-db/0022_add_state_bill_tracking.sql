-- State bill tracking table
-- Similar to bill_tracking but for state legislature bills
-- Uses OCD IDs from OpenStates API

CREATE TABLE IF NOT EXISTS state_bill_tracking (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bill_id TEXT NOT NULL,  -- OCD ID (e.g., "ocd-bill/...")
    state TEXT NOT NULL,    -- 2-letter state code (e.g., "WI")
    identifier TEXT NOT NULL, -- Bill identifier (e.g., "SB 123")
    tracked_at INTEGER NOT NULL,
    notifications_enabled INTEGER DEFAULT 1
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_state_bill_tracking_user ON state_bill_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_state_bill_tracking_bill ON state_bill_tracking(bill_id);
CREATE INDEX IF NOT EXISTS idx_state_bill_tracking_state ON state_bill_tracking(state);

-- Prevent duplicate tracking
CREATE UNIQUE INDEX IF NOT EXISTS idx_state_bill_tracking_unique
ON state_bill_tracking(user_id, bill_id);
