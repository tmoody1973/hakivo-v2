-- Migration: Add artifacts table for Congressional Artifacts feature
-- Migrated from sql/migrations/001_add_artifacts_table.sql

-- Create artifacts table
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  template TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  subject_type TEXT,
  subject_id TEXT,
  subject_context TEXT,
  audience TEXT DEFAULT 'general',
  vultr_key TEXT,
  vultr_pdf_key TEXT,
  vultr_pptx_key TEXT,
  is_public INTEGER DEFAULT 0,
  share_token TEXT UNIQUE,
  view_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_artifacts_user_id ON artifacts(user_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(type);
CREATE INDEX IF NOT EXISTS idx_artifacts_subject ON artifacts(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_share_token ON artifacts(share_token);
CREATE INDEX IF NOT EXISTS idx_artifacts_created_at ON artifacts(created_at);
CREATE INDEX IF NOT EXISTS idx_artifacts_is_public ON artifacts(is_public);
