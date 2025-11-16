-- Congress.gov API Database Schema
-- PostgreSQL/MySQL compatible SQL schema

-- Core Tables

CREATE TABLE congresses (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    start_year INTEGER NOT NULL,
    end_year INTEGER NOT NULL
);

CREATE TABLE members (
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
    current_member BOOLEAN DEFAULT FALSE
);

CREATE TABLE bills (
    id SERIAL PRIMARY KEY,
    congress_id INTEGER NOT NULL REFERENCES congresses(id),
    bill_type TEXT NOT NULL,
    bill_number INTEGER NOT NULL,
    title TEXT,
    origin_chamber TEXT,
    introduced_date DATE,
    latest_action_date DATE,
    latest_action_text TEXT,
    sponsor_bioguide_id TEXT REFERENCES members(bioguide_id),
    text TEXT,
    update_date TIMESTAMP,
    UNIQUE(congress_id, bill_type, bill_number)
);

CREATE TABLE amendments (
    id SERIAL PRIMARY KEY,
    congress_id INTEGER NOT NULL REFERENCES congresses(id),
    amendment_type TEXT NOT NULL,
    amendment_number INTEGER NOT NULL,
    bill_id INTEGER REFERENCES bills(id),
    sponsor_bioguide_id TEXT REFERENCES members(bioguide_id),
    purpose TEXT,
    description TEXT,
    latest_action_date DATE,
    latest_action_text TEXT,
    update_date TIMESTAMP,
    UNIQUE(congress_id, amendment_type, amendment_number)
);

-- Committee Tables

CREATE TABLE committees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    chamber TEXT,
    committee_code TEXT,
    url TEXT
);

CREATE TABLE committee_meetings (
    id SERIAL PRIMARY KEY,
    committee_id TEXT REFERENCES committees(id),
    congress_id INTEGER REFERENCES congresses(id),
    meeting_date DATE,
    meeting_time TIME,
    location TEXT,
    title TEXT
);

CREATE TABLE committee_reports (
    id SERIAL PRIMARY KEY,
    congress_id INTEGER REFERENCES congresses(id),
    report_type TEXT,
    report_number INTEGER,
    title TEXT,
    committee_id TEXT REFERENCES committees(id),
    update_date TIMESTAMP,
    UNIQUE(congress_id, report_type, report_number)
);

CREATE TABLE committee_prints (
    id SERIAL PRIMARY KEY,
    congress_id INTEGER REFERENCES congresses(id),
    chamber TEXT,
    print_number INTEGER,
    title TEXT,
    committee_id TEXT REFERENCES committees(id),
    update_date TIMESTAMP
);

-- Voting and Actions Tables

CREATE TABLE actions (
    id SERIAL PRIMARY KEY,
    bill_id INTEGER REFERENCES bills(id),
    amendment_id INTEGER REFERENCES amendments(id),
    action_date DATE NOT NULL,
    action_text TEXT NOT NULL,
    action_time TIME,
    CHECK ((bill_id IS NOT NULL AND amendment_id IS NULL) OR (bill_id IS NULL AND amendment_id IS NOT NULL))
);

CREATE TABLE votes (
    id SERIAL PRIMARY KEY,
    congress_id INTEGER NOT NULL REFERENCES congresses(id),
    session INTEGER NOT NULL,
    vote_number INTEGER NOT NULL,
    bill_id INTEGER REFERENCES bills(id),
    vote_date DATE,
    vote_question TEXT,
    vote_result TEXT,
    UNIQUE(congress_id, session, vote_number)
);

CREATE TABLE vote_members (
    vote_id INTEGER NOT NULL REFERENCES votes(id),
    member_bioguide_id TEXT NOT NULL REFERENCES members(bioguide_id),
    vote_cast TEXT NOT NULL,
    PRIMARY KEY (vote_id, member_bioguide_id)
);

-- Other Legislative Tables

CREATE TABLE nominations (
    id SERIAL PRIMARY KEY,
    congress_id INTEGER REFERENCES congresses(id),
    nomination_number INTEGER,
    nominee_name TEXT,
    position TEXT,
    received_date DATE,
    latest_action_date DATE,
    latest_action_text TEXT,
    UNIQUE(congress_id, nomination_number)
);

CREATE TABLE treaties (
    id SERIAL PRIMARY KEY,
    congress_id INTEGER REFERENCES congresses(id),
    treaty_number INTEGER,
    title TEXT,
    received_date DATE,
    latest_action_date DATE,
    latest_action_text TEXT,
    UNIQUE(congress_id, treaty_number)
);

CREATE TABLE communications (
    id SERIAL PRIMARY KEY,
    congress_id INTEGER REFERENCES congresses(id),
    chamber TEXT NOT NULL,
    communication_type TEXT,
    communication_number INTEGER,
    title TEXT,
    received_date DATE,
    UNIQUE(congress_id, chamber, communication_number)
);

-- Bill Relationship Tables

CREATE TABLE bill_committees (
    bill_id INTEGER NOT NULL REFERENCES bills(id),
    committee_id TEXT NOT NULL REFERENCES committees(id),
    PRIMARY KEY (bill_id, committee_id)
);

CREATE TABLE bill_cosponsors (
    bill_id INTEGER NOT NULL REFERENCES bills(id),
    member_bioguide_id TEXT NOT NULL REFERENCES members(bioguide_id),
    cosponsor_date DATE,
    PRIMARY KEY (bill_id, member_bioguide_id)
);

CREATE TABLE related_bills (
    bill_id INTEGER NOT NULL REFERENCES bills(id),
    related_bill_id INTEGER NOT NULL REFERENCES bills(id),
    relationship_type TEXT,
    PRIMARY KEY (bill_id, related_bill_id),
    CHECK (bill_id != related_bill_id)
);

CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE bill_subjects (
    bill_id INTEGER NOT NULL REFERENCES bills(id),
    subject_id INTEGER NOT NULL REFERENCES subjects(id),
    PRIMARY KEY (bill_id, subject_id)
);

CREATE TABLE laws (
    id SERIAL PRIMARY KEY,
    bill_id INTEGER REFERENCES bills(id),
    congress_id INTEGER NOT NULL REFERENCES congresses(id),
    law_type TEXT NOT NULL,
    law_number INTEGER NOT NULL,
    UNIQUE(congress_id, law_type, law_number)
);

-- Congressional Record Tables

CREATE TABLE congressional_record_issues (
    id SERIAL PRIMARY KEY,
    volume_number INTEGER NOT NULL,
    issue_number INTEGER NOT NULL,
    issue_date DATE,
    congress_id INTEGER REFERENCES congresses(id),
    session_number INTEGER,
    UNIQUE(volume_number, issue_number)
);

CREATE TABLE congressional_record_articles (
    id SERIAL PRIMARY KEY,
    record_issue_id INTEGER NOT NULL REFERENCES congressional_record_issues(id),
    title TEXT,
    article_type TEXT,
    start_page TEXT,
    end_page TEXT,
    content TEXT
);

-- Indexes for performance

CREATE INDEX idx_bills_congress ON bills(congress_id);
CREATE INDEX idx_bills_sponsor ON bills(sponsor_bioguide_id);
CREATE INDEX idx_bills_type ON bills(bill_type);
CREATE INDEX idx_amendments_congress ON amendments(congress_id);
CREATE INDEX idx_amendments_bill ON amendments(bill_id);
CREATE INDEX idx_actions_bill ON actions(bill_id);
CREATE INDEX idx_actions_amendment ON actions(amendment_id);
CREATE INDEX idx_votes_congress ON votes(congress_id);
CREATE INDEX idx_vote_members_member ON vote_members(member_bioguide_id);
CREATE INDEX idx_bill_cosponsors_member ON bill_cosponsors(member_bioguide_id);
CREATE INDEX idx_congressional_record_volume ON congressional_record_issues(volume_number);
CREATE INDEX idx_congressional_record_articles_issue ON congressional_record_articles(record_issue_id);
