-- schema.sql
-- Database schema for storing OpenStates bill data with full text
-- Supports PostgreSQL (recommended) or SQLite

-- Enable full-text search extension (PostgreSQL only)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Jurisdictions (States)
CREATE TABLE IF NOT EXISTS jurisdictions (
    id VARCHAR(255) PRIMARY KEY,  -- e.g., 'ocd-jurisdiction/country:us/state:wi/government'
    name VARCHAR(255) NOT NULL,   -- e.g., 'Wisconsin'
    classification VARCHAR(50),    -- 'state', 'territory', etc.
    division_id VARCHAR(255),
    url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Legislative Sessions
CREATE TABLE IF NOT EXISTS legislative_sessions (
    id SERIAL PRIMARY KEY,
    jurisdiction_id VARCHAR(255) REFERENCES jurisdictions(id),
    identifier VARCHAR(100) NOT NULL,  -- e.g., '2023', '2023s1'
    name VARCHAR(255),                  -- e.g., '2023 Regular Session'
    classification VARCHAR(50),         -- 'primary', 'special'
    start_date DATE,
    end_date DATE,
    UNIQUE(jurisdiction_id, identifier)
);

-- People (Legislators)
CREATE TABLE IF NOT EXISTS people (
    id VARCHAR(255) PRIMARY KEY,  -- OCD ID
    name VARCHAR(255) NOT NULL,
    party VARCHAR(100),
    current_role_title VARCHAR(100),
    current_role_district VARCHAR(50),
    current_role_chamber VARCHAR(20),  -- 'upper', 'lower'
    jurisdiction_id VARCHAR(255) REFERENCES jurisdictions(id),
    image_url VARCHAR(500),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bills
CREATE TABLE IF NOT EXISTS bills (
    id VARCHAR(255) PRIMARY KEY,       -- OCD bill ID
    jurisdiction_id VARCHAR(255) REFERENCES jurisdictions(id),
    session_identifier VARCHAR(100) NOT NULL,
    identifier VARCHAR(100) NOT NULL,  -- e.g., 'AB 123', 'SB 456'
    title TEXT NOT NULL,
    
    -- Classification and subjects
    classification TEXT[],              -- PostgreSQL array, or JSON for SQLite
    subjects TEXT[],
    
    -- Descriptions
    abstract TEXT,
    
    -- Chamber info
    from_organization VARCHAR(255),
    chamber VARCHAR(20),               -- 'upper', 'lower'
    
    -- Status tracking
    latest_action_date DATE,
    latest_action_description TEXT,
    
    -- Full text content
    full_text TEXT,                    -- Extracted bill text
    full_text_url VARCHAR(500),        -- URL to official text
    full_text_format VARCHAR(50),      -- 'pdf', 'html', etc.
    full_text_hash VARCHAR(64),        -- SHA256 hash for deduplication
    
    -- OpenStates URL
    openstates_url VARCHAR(500),
    
    -- Timestamps
    first_action_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    text_extracted_at TIMESTAMP,
    
    UNIQUE(jurisdiction_id, session_identifier, identifier)
);

-- Bill Versions (different versions of the bill text)
CREATE TABLE IF NOT EXISTS bill_versions (
    id SERIAL PRIMARY KEY,
    bill_id VARCHAR(255) REFERENCES bills(id) ON DELETE CASCADE,
    note VARCHAR(500),                 -- e.g., 'Introduced', 'Engrossed', 'Enrolled'
    date DATE,
    
    -- Multiple formats may exist for same version
    url VARCHAR(1000),
    media_type VARCHAR(100),           -- 'application/pdf', 'text/html'
    
    -- Extracted text for this version
    full_text TEXT,
    full_text_hash VARCHAR(64),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bill_id, note, media_type)
);

-- Bill Sponsorships
CREATE TABLE IF NOT EXISTS bill_sponsorships (
    id SERIAL PRIMARY KEY,
    bill_id VARCHAR(255) REFERENCES bills(id) ON DELETE CASCADE,
    person_id VARCHAR(255) REFERENCES people(id),
    name VARCHAR(255) NOT NULL,        -- Raw name as provided
    entity_type VARCHAR(50),           -- 'person', 'organization'
    is_primary BOOLEAN DEFAULT FALSE,
    classification VARCHAR(100),       -- 'sponsor', 'cosponsor'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bill_id, person_id, classification)
);

-- Bill Actions (history of actions taken)
CREATE TABLE IF NOT EXISTS bill_actions (
    id SERIAL PRIMARY KEY,
    bill_id VARCHAR(255) REFERENCES bills(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    classification TEXT[],             -- e.g., ['introduction', 'reading-1']
    organization_name VARCHAR(255),
    chamber VARCHAR(20),
    order_index INTEGER,               -- To maintain order
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bill Votes
CREATE TABLE IF NOT EXISTS bill_votes (
    id VARCHAR(255) PRIMARY KEY,       -- OCD vote ID
    bill_id VARCHAR(255) REFERENCES bills(id) ON DELETE CASCADE,
    motion_text TEXT,
    motion_classification TEXT[],
    start_date DATE,
    result VARCHAR(20),                -- 'pass', 'fail'
    
    -- Vote counts
    yes_count INTEGER,
    no_count INTEGER,
    other_count INTEGER,
    absent_count INTEGER,
    
    chamber VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual Vote Records
CREATE TABLE IF NOT EXISTS vote_records (
    id SERIAL PRIMARY KEY,
    vote_id VARCHAR(255) REFERENCES bill_votes(id) ON DELETE CASCADE,
    person_id VARCHAR(255) REFERENCES people(id),
    voter_name VARCHAR(255),
    option VARCHAR(20) NOT NULL,       -- 'yes', 'no', 'abstain', 'absent', 'other'
    note TEXT,
    UNIQUE(vote_id, person_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bills_jurisdiction ON bills(jurisdiction_id);
CREATE INDEX IF NOT EXISTS idx_bills_session ON bills(session_identifier);
CREATE INDEX IF NOT EXISTS idx_bills_latest_action ON bills(latest_action_date DESC);
CREATE INDEX IF NOT EXISTS idx_bills_identifier ON bills(identifier);
CREATE INDEX IF NOT EXISTS idx_bill_actions_bill ON bill_actions(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_actions_date ON bill_actions(date DESC);
CREATE INDEX IF NOT EXISTS idx_sponsorships_bill ON bill_sponsorships(bill_id);
CREATE INDEX IF NOT EXISTS idx_sponsorships_person ON bill_sponsorships(person_id);

-- Full-text search index (PostgreSQL)
-- CREATE INDEX IF NOT EXISTS idx_bills_fulltext ON bills USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(full_text, '')));

-- For SQLite, you'd create an FTS5 virtual table instead:
-- CREATE VIRTUAL TABLE IF NOT EXISTS bills_fts USING fts5(
--     id, title, abstract, full_text,
--     content='bills',
--     content_rowid='rowid'
-- );
