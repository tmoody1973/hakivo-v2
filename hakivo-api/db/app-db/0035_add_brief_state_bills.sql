-- Junction table linking briefs to state bills
-- Mirrors brief_bills structure for federal bills
CREATE TABLE IF NOT EXISTS brief_state_bills (
    brief_id TEXT NOT NULL,
    state_bill_id TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    PRIMARY KEY (brief_id, state_bill_id),
    FOREIGN KEY (brief_id) REFERENCES briefs(id) ON DELETE CASCADE,
    FOREIGN KEY (state_bill_id) REFERENCES state_bills(id) ON DELETE CASCADE
);

-- Index for efficient lookups by brief
CREATE INDEX IF NOT EXISTS idx_brief_state_bills_brief_id ON brief_state_bills(brief_id);

-- Index for finding which briefs reference a state bill
CREATE INDEX IF NOT EXISTS idx_brief_state_bills_state_bill_id ON brief_state_bills(state_bill_id);
