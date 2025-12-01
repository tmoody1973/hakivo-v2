-- State legislation tables
-- For OpenStates API integration
-- Note: State bills are fetched ON-DEMAND per user's state (not bulk sync)

-- State bills table
CREATE TABLE IF NOT EXISTS state_bills (
    id TEXT PRIMARY KEY,                    -- OpenStates bill ID
    state TEXT NOT NULL,                    -- State abbreviation (CA, TX, etc.)
    identifier TEXT NOT NULL,               -- Bill identifier (e.g., "AB 123")
    title TEXT,
    session TEXT NOT NULL,                  -- Legislative session
    chamber TEXT,                           -- lower/upper
    abstract TEXT,
    introduced_date TEXT,
    latest_action_date TEXT,
    latest_action_text TEXT,
    subjects TEXT,                          -- JSON array of subject tags
    sponsors TEXT,                          -- JSON array of sponsors
    text TEXT,                              -- Full bill text for AI analysis
    text_url TEXT,                          -- URL where text was fetched from
    update_date TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_state_bills_unique ON state_bills(state, session, identifier);
CREATE INDEX IF NOT EXISTS idx_state_bills_state ON state_bills(state);
CREATE INDEX IF NOT EXISTS idx_state_bills_session ON state_bills(state, session);
CREATE INDEX IF NOT EXISTS idx_state_bills_update ON state_bills(update_date);

-- State legislators table
CREATE TABLE IF NOT EXISTS state_legislators (
    id TEXT PRIMARY KEY,                    -- OpenStates person ID
    name TEXT NOT NULL,
    party TEXT,
    state TEXT NOT NULL,
    chamber TEXT,                           -- lower/upper
    district TEXT,
    image_url TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_state_legislators_state ON state_legislators(state);
CREATE INDEX IF NOT EXISTS idx_state_legislators_district ON state_legislators(state, chamber, district);

-- User's state legislators (many-to-many)
CREATE TABLE IF NOT EXISTS user_state_legislators (
    user_id TEXT NOT NULL,
    legislator_id TEXT NOT NULL,
    PRIMARY KEY (user_id, legislator_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (legislator_id) REFERENCES state_legislators(id) ON DELETE CASCADE
);

-- User's tracked state bills (bills matched to user interests)
CREATE TABLE IF NOT EXISTS user_state_bills (
    user_id TEXT NOT NULL,
    bill_id TEXT NOT NULL,
    relevance_score REAL,                   -- AI-determined relevance to user interests (0-1)
    matched_interests TEXT,                 -- JSON array of matched policy interests
    added_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    PRIMARY KEY (user_id, bill_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (bill_id) REFERENCES state_bills(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_state_bills_user ON user_state_bills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_state_bills_relevance ON user_state_bills(user_id, relevance_score DESC);
