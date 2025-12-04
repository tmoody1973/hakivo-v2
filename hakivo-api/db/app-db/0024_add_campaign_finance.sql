-- Migration: Add campaign finance data caching
-- Purpose: Cache FEC campaign finance data for member detail pages

-- Table for campaign finance summary per member/cycle
CREATE TABLE IF NOT EXISTS campaign_finance_summary (
  id TEXT PRIMARY KEY,  -- Format: {bioguide_id}-{cycle}
  bioguide_id TEXT NOT NULL,
  fec_candidate_id TEXT,
  fec_committee_id TEXT,
  opensecrets_id TEXT,
  cycle INTEGER NOT NULL,  -- Election cycle (2024, 2022, etc.)

  -- Financial totals
  total_raised REAL DEFAULT 0,
  total_spent REAL DEFAULT 0,
  cash_on_hand REAL DEFAULT 0,
  debts REAL DEFAULT 0,

  -- Contribution breakdown
  individual_contributions REAL DEFAULT 0,
  individual_itemized REAL DEFAULT 0,
  individual_unitemized REAL DEFAULT 0,
  pac_contributions REAL DEFAULT 0,
  party_contributions REAL DEFAULT 0,
  self_financed REAL DEFAULT 0,
  transfers REAL DEFAULT 0,

  -- Coverage dates
  coverage_start TEXT,
  coverage_end TEXT,

  -- Sync metadata
  last_synced_at TEXT DEFAULT (datetime('now')),
  sync_status TEXT DEFAULT 'completed',  -- pending, syncing, completed, failed
  error_message TEXT,

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  UNIQUE(bioguide_id, cycle)
);

-- Indexes for campaign finance summary
CREATE INDEX IF NOT EXISTS idx_campaign_finance_bioguide ON campaign_finance_summary(bioguide_id);
CREATE INDEX IF NOT EXISTS idx_campaign_finance_cycle ON campaign_finance_summary(cycle);
CREATE INDEX IF NOT EXISTS idx_campaign_finance_fec_id ON campaign_finance_summary(fec_candidate_id);
CREATE INDEX IF NOT EXISTS idx_campaign_finance_synced ON campaign_finance_summary(last_synced_at);

-- Table for top contributors by employer/organization
CREATE TABLE IF NOT EXISTS campaign_contributors_employer (
  id TEXT PRIMARY KEY,  -- Format: {bioguide_id}-{cycle}-{employer_hash}
  bioguide_id TEXT NOT NULL,
  cycle INTEGER NOT NULL,
  employer TEXT NOT NULL,
  total_amount REAL DEFAULT 0,
  contribution_count INTEGER DEFAULT 0,
  rank INTEGER,  -- Rank by total amount for this member/cycle

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  UNIQUE(bioguide_id, cycle, employer)
);

-- Indexes for employer contributions
CREATE INDEX IF NOT EXISTS idx_contrib_employer_bioguide ON campaign_contributors_employer(bioguide_id);
CREATE INDEX IF NOT EXISTS idx_contrib_employer_cycle ON campaign_contributors_employer(cycle);
CREATE INDEX IF NOT EXISTS idx_contrib_employer_amount ON campaign_contributors_employer(total_amount DESC);
CREATE INDEX IF NOT EXISTS idx_contrib_employer_rank ON campaign_contributors_employer(bioguide_id, cycle, rank);

-- Table for contributions by occupation (industry proxy)
CREATE TABLE IF NOT EXISTS campaign_contributors_occupation (
  id TEXT PRIMARY KEY,  -- Format: {bioguide_id}-{cycle}-{occupation_hash}
  bioguide_id TEXT NOT NULL,
  cycle INTEGER NOT NULL,
  occupation TEXT NOT NULL,
  total_amount REAL DEFAULT 0,
  contribution_count INTEGER DEFAULT 0,
  rank INTEGER,  -- Rank by total amount for this member/cycle

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  UNIQUE(bioguide_id, cycle, occupation)
);

-- Indexes for occupation contributions
CREATE INDEX IF NOT EXISTS idx_contrib_occupation_bioguide ON campaign_contributors_occupation(bioguide_id);
CREATE INDEX IF NOT EXISTS idx_contrib_occupation_cycle ON campaign_contributors_occupation(cycle);
CREATE INDEX IF NOT EXISTS idx_contrib_occupation_amount ON campaign_contributors_occupation(total_amount DESC);
CREATE INDEX IF NOT EXISTS idx_contrib_occupation_rank ON campaign_contributors_occupation(bioguide_id, cycle, rank);

-- Table for contributions by state (geographic breakdown)
CREATE TABLE IF NOT EXISTS campaign_contributions_state (
  id TEXT PRIMARY KEY,  -- Format: {bioguide_id}-{cycle}-{state}
  bioguide_id TEXT NOT NULL,
  cycle INTEGER NOT NULL,
  state TEXT NOT NULL,
  state_name TEXT,
  total_amount REAL DEFAULT 0,
  contribution_count INTEGER DEFAULT 0,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  UNIQUE(bioguide_id, cycle, state)
);

-- Indexes for state contributions
CREATE INDEX IF NOT EXISTS idx_contrib_state_bioguide ON campaign_contributions_state(bioguide_id);
CREATE INDEX IF NOT EXISTS idx_contrib_state_cycle ON campaign_contributions_state(cycle);
CREATE INDEX IF NOT EXISTS idx_contrib_state_amount ON campaign_contributions_state(total_amount DESC);

-- Table for contributions by size (small vs large donors)
CREATE TABLE IF NOT EXISTS campaign_contributions_size (
  id TEXT PRIMARY KEY,  -- Format: {bioguide_id}-{cycle}-{size}
  bioguide_id TEXT NOT NULL,
  cycle INTEGER NOT NULL,
  size_bucket INTEGER NOT NULL,  -- 0, 200, 500, 1000, 2000 (FEC size buckets)
  size_label TEXT,  -- "Under $200", "$200-$499", "$500-$999", "$1000-$1999", "$2000+"
  total_amount REAL DEFAULT 0,
  contribution_count INTEGER,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  UNIQUE(bioguide_id, cycle, size_bucket)
);

-- Indexes for size contributions
CREATE INDEX IF NOT EXISTS idx_contrib_size_bioguide ON campaign_contributions_size(bioguide_id);
CREATE INDEX IF NOT EXISTS idx_contrib_size_cycle ON campaign_contributions_size(cycle);

-- Table to track sync status for campaign finance data
CREATE TABLE IF NOT EXISTS campaign_finance_sync (
  bioguide_id TEXT PRIMARY KEY,
  fec_candidate_id TEXT,
  fec_committee_id TEXT,
  opensecrets_id TEXT,
  last_sync_at TEXT,
  last_sync_cycle INTEGER,
  sync_status TEXT DEFAULT 'pending',  -- pending, syncing, completed, failed
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for finding members that need sync
CREATE INDEX IF NOT EXISTS idx_campaign_finance_sync_status ON campaign_finance_sync(sync_status);
CREATE INDEX IF NOT EXISTS idx_campaign_finance_sync_date ON campaign_finance_sync(last_sync_at);
