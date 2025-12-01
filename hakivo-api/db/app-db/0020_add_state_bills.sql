-- State legislation tables (expanded schema)
-- For OpenStates API integration
-- Note: State bills are fetched ON-DEMAND per user's state (not bulk sync)
-- Schema aligned with OpenStates PostgreSQL dump structure

-- State jurisdictions (cached state metadata)
CREATE TABLE IF NOT EXISTS state_jurisdictions (
    id TEXT PRIMARY KEY,                    -- OCD jurisdiction ID
    name TEXT NOT NULL,                     -- e.g., 'Wisconsin'
    abbreviation TEXT NOT NULL,             -- e.g., 'WI'
    classification TEXT,                    -- 'state', 'territory'
    url TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_state_jurisdictions_abbrev ON state_jurisdictions(abbreviation);

-- Legislative sessions per state
CREATE TABLE IF NOT EXISTS state_legislative_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jurisdiction_id TEXT NOT NULL,
    identifier TEXT NOT NULL,               -- e.g., '2023', '2023s1'
    name TEXT,                              -- e.g., '2023 Regular Session'
    classification TEXT,                    -- 'primary', 'special'
    start_date TEXT,
    end_date TEXT,
    FOREIGN KEY (jurisdiction_id) REFERENCES state_jurisdictions(id),
    UNIQUE(jurisdiction_id, identifier)
);

-- State legislators table
CREATE TABLE IF NOT EXISTS state_legislators (
    id TEXT PRIMARY KEY,                    -- OpenStates OCD person ID
    name TEXT NOT NULL,
    party TEXT,
    state TEXT NOT NULL,                    -- State abbreviation
    current_role_title TEXT,                -- e.g., 'Senator', 'Representative'
    current_role_district TEXT,
    current_role_chamber TEXT,              -- 'upper', 'lower'
    jurisdiction_id TEXT,
    image_url TEXT,
    email TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (jurisdiction_id) REFERENCES state_jurisdictions(id)
);

CREATE INDEX IF NOT EXISTS idx_state_legislators_state ON state_legislators(state);
CREATE INDEX IF NOT EXISTS idx_state_legislators_district ON state_legislators(state, current_role_chamber, current_role_district);

-- State bills table
CREATE TABLE IF NOT EXISTS state_bills (
    id TEXT PRIMARY KEY,                    -- OpenStates OCD bill ID
    jurisdiction_id TEXT,
    state TEXT NOT NULL,                    -- State abbreviation (CA, TX, etc.)
    session_identifier TEXT NOT NULL,       -- Legislative session
    identifier TEXT NOT NULL,               -- Bill identifier (e.g., "AB 123")
    title TEXT,
    classification TEXT,                    -- JSON array: ['bill', 'resolution']
    subjects TEXT,                          -- JSON array of subject tags
    abstract TEXT,
    from_organization TEXT,                 -- Originating committee/body
    chamber TEXT,                           -- 'upper', 'lower'

    -- Status tracking
    latest_action_date TEXT,
    latest_action_description TEXT,
    first_action_date TEXT,

    -- Full text content (for AI analysis)
    full_text TEXT,                         -- Extracted bill text
    full_text_url TEXT,                     -- URL to official text
    full_text_format TEXT,                  -- 'pdf', 'html', etc.
    full_text_hash TEXT,                    -- SHA256 for deduplication
    text_extracted_at INTEGER,

    -- OpenStates URL
    openstates_url TEXT,

    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),

    FOREIGN KEY (jurisdiction_id) REFERENCES state_jurisdictions(id),
    UNIQUE(state, session_identifier, identifier)
);

CREATE INDEX IF NOT EXISTS idx_state_bills_state ON state_bills(state);
CREATE INDEX IF NOT EXISTS idx_state_bills_session ON state_bills(state, session_identifier);
CREATE INDEX IF NOT EXISTS idx_state_bills_latest_action ON state_bills(latest_action_date DESC);
CREATE INDEX IF NOT EXISTS idx_state_bills_identifier ON state_bills(identifier);

-- Bill versions (Introduced, Engrossed, Enrolled, etc.)
CREATE TABLE IF NOT EXISTS state_bill_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id TEXT NOT NULL,
    note TEXT,                              -- e.g., 'Introduced', 'Engrossed', 'Enrolled'
    date TEXT,
    url TEXT,
    media_type TEXT,                        -- 'application/pdf', 'text/html'
    full_text TEXT,                         -- Extracted text for this version
    full_text_hash TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (bill_id) REFERENCES state_bills(id) ON DELETE CASCADE,
    UNIQUE(bill_id, note, media_type)
);

CREATE INDEX IF NOT EXISTS idx_state_bill_versions_bill ON state_bill_versions(bill_id);

-- Bill sponsorships (links bills to legislators)
CREATE TABLE IF NOT EXISTS state_bill_sponsorships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id TEXT NOT NULL,
    person_id TEXT,                         -- Reference to state_legislators
    name TEXT NOT NULL,                     -- Raw name as provided
    entity_type TEXT,                       -- 'person', 'organization'
    is_primary INTEGER DEFAULT 0,           -- Boolean: primary sponsor
    classification TEXT,                    -- 'sponsor', 'cosponsor'
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (bill_id) REFERENCES state_bills(id) ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES state_legislators(id),
    UNIQUE(bill_id, person_id, classification)
);

CREATE INDEX IF NOT EXISTS idx_state_bill_sponsorships_bill ON state_bill_sponsorships(bill_id);
CREATE INDEX IF NOT EXISTS idx_state_bill_sponsorships_person ON state_bill_sponsorships(person_id);

-- Bill actions (history of actions taken)
CREATE TABLE IF NOT EXISTS state_bill_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    classification TEXT,                    -- JSON array: ['introduction', 'reading-1']
    organization_name TEXT,
    chamber TEXT,                           -- 'upper', 'lower'
    order_index INTEGER,                    -- Maintain chronological order
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (bill_id) REFERENCES state_bills(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_state_bill_actions_bill ON state_bill_actions(bill_id);
CREATE INDEX IF NOT EXISTS idx_state_bill_actions_date ON state_bill_actions(date DESC);

-- Bill votes
CREATE TABLE IF NOT EXISTS state_bill_votes (
    id TEXT PRIMARY KEY,                    -- OCD vote ID
    bill_id TEXT NOT NULL,
    motion_text TEXT,
    motion_classification TEXT,             -- JSON array
    start_date TEXT,
    result TEXT,                            -- 'pass', 'fail'
    yes_count INTEGER,
    no_count INTEGER,
    other_count INTEGER,
    absent_count INTEGER,
    chamber TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (bill_id) REFERENCES state_bills(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_state_bill_votes_bill ON state_bill_votes(bill_id);

-- Individual vote records (how each legislator voted)
CREATE TABLE IF NOT EXISTS state_vote_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vote_id TEXT NOT NULL,
    person_id TEXT,
    voter_name TEXT,
    option TEXT NOT NULL,                   -- 'yes', 'no', 'abstain', 'absent', 'other'
    note TEXT,
    FOREIGN KEY (vote_id) REFERENCES state_bill_votes(id) ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES state_legislators(id),
    UNIQUE(vote_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_state_vote_records_vote ON state_vote_records(vote_id);
CREATE INDEX IF NOT EXISTS idx_state_vote_records_person ON state_vote_records(person_id);

-- User's state legislators (many-to-many)
CREATE TABLE IF NOT EXISTS user_state_legislators (
    user_id TEXT NOT NULL,
    legislator_id TEXT NOT NULL,
    PRIMARY KEY (user_id, legislator_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (legislator_id) REFERENCES state_legislators(id) ON DELETE CASCADE
);

-- User's tracked state bills (bills matched to user interests by AI)
CREATE TABLE IF NOT EXISTS user_state_bills (
    user_id TEXT NOT NULL,
    bill_id TEXT NOT NULL,
    relevance_score REAL,                   -- AI-determined relevance (0-1)
    matched_interests TEXT,                 -- JSON array of matched policy interests
    added_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    PRIMARY KEY (user_id, bill_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (bill_id) REFERENCES state_bills(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_state_bills_user ON user_state_bills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_state_bills_relevance ON user_state_bills(user_id, relevance_score DESC);
