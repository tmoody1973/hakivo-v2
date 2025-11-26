-- Migration: Add indexing_progress table
-- Tracks progress of bill indexing to SmartBucket

CREATE TABLE IF NOT EXISTS indexing_progress (
  congress INTEGER PRIMARY KEY,
  processed_bills INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  started_at INTEGER DEFAULT (unixepoch() * 1000),
  completed_at INTEGER
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_indexing_progress_updated
  ON indexing_progress(updated_at DESC);
