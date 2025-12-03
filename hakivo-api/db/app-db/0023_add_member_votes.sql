-- Migration: Add member votes caching
-- Purpose: Cache voting records from Congress.gov API for faster page loads and richer analytics

-- Table for caching individual votes
CREATE TABLE IF NOT EXISTS member_votes (
  id TEXT PRIMARY KEY,  -- Format: {congress}-{rollCallNumber}
  bioguide_id TEXT NOT NULL,
  congress INTEGER NOT NULL,
  roll_call_number INTEGER NOT NULL,
  session_number INTEGER,
  vote_date TEXT NOT NULL,
  vote_question TEXT,
  vote_type TEXT,
  vote_result TEXT,
  member_vote TEXT NOT NULL,  -- Yea, Nay, Present, Not Voting

  -- Bill information (enriched from our bills table)
  bill_id TEXT,  -- Foreign key to bills table
  bill_type TEXT,
  bill_number INTEGER,
  bill_title TEXT,  -- Enriched title from bills table

  -- Chamber information
  chamber TEXT DEFAULT 'House',

  -- Vote totals (for context)
  total_yea INTEGER,
  total_nay INTEGER,
  total_present INTEGER,
  total_not_voting INTEGER,

  -- Party vote breakdown (for party alignment calculation)
  republican_yea INTEGER,
  republican_nay INTEGER,
  democrat_yea INTEGER,
  democrat_nay INTEGER,

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  UNIQUE(bioguide_id, congress, roll_call_number)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_member_votes_bioguide ON member_votes(bioguide_id);
CREATE INDEX IF NOT EXISTS idx_member_votes_congress ON member_votes(congress);
CREATE INDEX IF NOT EXISTS idx_member_votes_date ON member_votes(vote_date);
CREATE INDEX IF NOT EXISTS idx_member_votes_bill ON member_votes(bill_id);
CREATE INDEX IF NOT EXISTS idx_member_votes_member_vote ON member_votes(member_vote);
CREATE INDEX IF NOT EXISTS idx_member_votes_composite ON member_votes(bioguide_id, congress, vote_date);

-- Table for aggregate voting statistics per member
CREATE TABLE IF NOT EXISTS member_voting_stats (
  id TEXT PRIMARY KEY,  -- Format: {bioguide_id}-{congress}
  bioguide_id TEXT NOT NULL,
  congress INTEGER NOT NULL,

  -- Vote counts
  total_votes INTEGER DEFAULT 0,
  yea_votes INTEGER DEFAULT 0,
  nay_votes INTEGER DEFAULT 0,
  present_votes INTEGER DEFAULT 0,
  not_voting_count INTEGER DEFAULT 0,

  -- Percentages
  participation_rate REAL,  -- (total_votes - not_voting) / total_votes
  decisiveness_rate REAL,   -- (yea + nay) / (total - not_voting)

  -- Party alignment (calculated based on party majority votes)
  party_alignment_rate REAL,
  votes_with_party INTEGER DEFAULT 0,
  votes_against_party INTEGER DEFAULT 0,

  -- Date range of data
  first_vote_date TEXT,
  last_vote_date TEXT,

  -- Sync status
  last_synced_at TEXT,
  votes_synced INTEGER DEFAULT 0,

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  UNIQUE(bioguide_id, congress)
);

-- Index for voting stats lookups
CREATE INDEX IF NOT EXISTS idx_member_voting_stats_bioguide ON member_voting_stats(bioguide_id);
CREATE INDEX IF NOT EXISTS idx_member_voting_stats_congress ON member_voting_stats(congress);

-- Table to track sync status for each member
CREATE TABLE IF NOT EXISTS member_votes_sync (
  bioguide_id TEXT PRIMARY KEY,
  last_sync_at TEXT,
  last_sync_congress INTEGER,
  votes_count INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'pending',  -- pending, syncing, completed, failed
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for finding members that need sync
CREATE INDEX IF NOT EXISTS idx_member_votes_sync_status ON member_votes_sync(sync_status);
