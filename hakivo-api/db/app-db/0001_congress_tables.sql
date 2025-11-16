-- Congressional data tables
-- SQLite compatible schema

-- Congress information
CREATE TABLE IF NOT EXISTS congresses (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    start_year INTEGER NOT NULL,
    end_year INTEGER NOT NULL
);

-- Members of Congress
CREATE TABLE IF NOT EXISTS members (
    bioguide_id TEXT PRIMARY KEY,
    first_name TEXT,
    middle_name TEXT,
    last_name TEXT,
    party TEXT,
    state TEXT,
    district INTEGER,
    url TEXT,
    birth_year INTEGER,
    death_year INTEGER,
    current_member INTEGER DEFAULT 0,
    image_url TEXT,
    office_address TEXT,
    phone_number TEXT
);

CREATE INDEX IF NOT EXISTS idx_members_state ON members(state);
CREATE INDEX IF NOT EXISTS idx_members_party ON members(party);
CREATE INDEX IF NOT EXISTS idx_members_current ON members(current_member);

-- Bills
CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    congress INTEGER NOT NULL,
    bill_type TEXT NOT NULL,
    bill_number INTEGER NOT NULL,
    title TEXT,
    origin_chamber TEXT,
    introduced_date TEXT,
    latest_action_date TEXT,
    latest_action_text TEXT,
    sponsor_bioguide_id TEXT,
    text TEXT,
    update_date TEXT,
    FOREIGN KEY (sponsor_bioguide_id) REFERENCES members(bioguide_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_unique ON bills(congress, bill_type, bill_number);
CREATE INDEX IF NOT EXISTS idx_bills_congress ON bills(congress);
CREATE INDEX IF NOT EXISTS idx_bills_sponsor ON bills(sponsor_bioguide_id);
CREATE INDEX IF NOT EXISTS idx_bills_type ON bills(bill_type);
CREATE INDEX IF NOT EXISTS idx_bills_update ON bills(update_date);

-- Committees
CREATE TABLE IF NOT EXISTS committees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    chamber TEXT,
    committee_code TEXT,
    url TEXT,
    parent_committee_id TEXT,
    FOREIGN KEY (parent_committee_id) REFERENCES committees(id)
);

CREATE INDEX IF NOT EXISTS idx_committees_chamber ON committees(chamber);

-- Votes
CREATE TABLE IF NOT EXISTS votes (
    id TEXT PRIMARY KEY,
    congress INTEGER NOT NULL,
    session INTEGER NOT NULL,
    vote_number INTEGER NOT NULL,
    bill_id TEXT,
    vote_date TEXT,
    vote_question TEXT,
    vote_result TEXT,
    vote_type TEXT,
    chamber TEXT,
    FOREIGN KEY (bill_id) REFERENCES bills(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_unique ON votes(congress, session, vote_number);
CREATE INDEX IF NOT EXISTS idx_votes_congress ON votes(congress);
CREATE INDEX IF NOT EXISTS idx_votes_bill ON votes(bill_id);

-- Vote members (how each member voted)
CREATE TABLE IF NOT EXISTS vote_members (
    vote_id TEXT NOT NULL,
    member_bioguide_id TEXT NOT NULL,
    vote_cast TEXT NOT NULL,
    PRIMARY KEY (vote_id, member_bioguide_id),
    FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE,
    FOREIGN KEY (member_bioguide_id) REFERENCES members(bioguide_id)
);

CREATE INDEX IF NOT EXISTS idx_vote_members_member ON vote_members(member_bioguide_id);

-- Bill cosponsors
CREATE TABLE IF NOT EXISTS bill_cosponsors (
    bill_id TEXT NOT NULL,
    member_bioguide_id TEXT NOT NULL,
    cosponsor_date TEXT,
    PRIMARY KEY (bill_id, member_bioguide_id),
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
    FOREIGN KEY (member_bioguide_id) REFERENCES members(bioguide_id)
);

CREATE INDEX IF NOT EXISTS idx_bill_cosponsors_member ON bill_cosponsors(member_bioguide_id);

-- Bill committees
CREATE TABLE IF NOT EXISTS bill_committees (
    bill_id TEXT NOT NULL,
    committee_id TEXT NOT NULL,
    PRIMARY KEY (bill_id, committee_id),
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
    FOREIGN KEY (committee_id) REFERENCES committees(id)
);
