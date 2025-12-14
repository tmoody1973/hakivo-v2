-- Migration: Add shared_threads table for C1 conversation sharing
-- This table stores publicly shareable links for C1 chat conversations

CREATE TABLE IF NOT EXISTS shared_threads (
  token TEXT PRIMARY KEY,
  thread_id TEXT,
  user_id TEXT,
  title TEXT NOT NULL,
  messages TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Index for efficient expiration cleanup
CREATE INDEX IF NOT EXISTS idx_shared_threads_expires_at ON shared_threads(expires_at);
