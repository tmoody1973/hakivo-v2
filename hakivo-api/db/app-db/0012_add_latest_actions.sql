-- Latest bill actions table (shared across all users)
-- Populated by congress-actions-scheduler twice daily
-- Shows most recent legislative activity from Congress.gov API

CREATE TABLE IF NOT EXISTS latest_bill_actions (
    id TEXT PRIMARY KEY,
    bill_congress INTEGER NOT NULL, -- Congress number (e.g., 119)
    bill_type TEXT NOT NULL, -- Bill type (hr, s, hjres, sjres, hconres, sconres, hres, sres)
    bill_number INTEGER NOT NULL, -- Bill number
    bill_title TEXT NOT NULL, -- Short title of the bill

    -- Action details
    action_date TEXT NOT NULL, -- ISO 8601 date when action occurred
    action_code TEXT, -- Congress.gov action code (e.g., "H11100", "E40000")
    action_text TEXT NOT NULL, -- Description of the action
    action_type TEXT, -- Type of action (e.g., "IntroReferral", "Floor", "Committee")

    -- Status information
    latest_action_status TEXT, -- Current status (e.g., "Passed House", "In Committee", "Introduced")
    chamber TEXT NOT NULL, -- Chamber where action occurred (House, Senate, Both)

    -- Metadata
    fetched_at INTEGER NOT NULL, -- Timestamp when action was fetched
    source_url TEXT, -- Link to bill on Congress.gov

    UNIQUE(bill_congress, bill_type, bill_number, action_date) -- Prevent duplicate actions
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_latest_actions_date ON latest_bill_actions(action_date DESC);
CREATE INDEX IF NOT EXISTS idx_latest_actions_fetched ON latest_bill_actions(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_latest_actions_chamber ON latest_bill_actions(chamber);
CREATE INDEX IF NOT EXISTS idx_latest_actions_status ON latest_bill_actions(latest_action_status);
