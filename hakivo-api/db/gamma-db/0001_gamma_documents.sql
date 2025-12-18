-- Migration: Gamma documents table for professional document generation
-- Separate database to avoid migration cache issues with app-db
-- user_id references users in app-db (validated at application level)

CREATE TABLE IF NOT EXISTS gamma_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,           -- References users.id in app-db (validated at app level)
  artifact_id TEXT,                -- References artifacts.id in app-db (optional)

  -- Gamma-specific fields
  gamma_generation_id TEXT NOT NULL,
  gamma_url TEXT,                  -- View URL from Gamma
  gamma_thumbnail_url TEXT,

  -- Document metadata
  title TEXT NOT NULL,
  format TEXT NOT NULL,            -- presentation, document, webpage, social
  template TEXT,                   -- lesson_guide, policy_brief, advocacy_deck, etc.
  card_count INTEGER DEFAULT 0,

  -- Export files stored in Vultr
  pdf_storage_key TEXT,
  pdf_url TEXT,
  pptx_storage_key TEXT,
  pptx_url TEXT,

  -- Sharing
  is_public INTEGER DEFAULT 0,
  share_token TEXT UNIQUE,
  view_count INTEGER DEFAULT 0,

  -- Context metadata
  subject_type TEXT,               -- bill, member, policy, issue
  subject_id TEXT,                 -- bill number, bioguide_id, etc.
  audience TEXT,                   -- Target audience description

  -- Enrichment options used
  enrichment_options TEXT,         -- JSON of options used during generation

  -- Request payload for background processing
  request_payload TEXT,

  -- Generation status
  status TEXT DEFAULT 'pending',   -- pending, enrichment_pending, processing, completed, failed
  error_message TEXT,

  -- Timestamps (Unix epoch)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_gamma_docs_user_id ON gamma_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_gamma_docs_artifact_id ON gamma_documents(artifact_id);
CREATE INDEX IF NOT EXISTS idx_gamma_docs_share_token ON gamma_documents(share_token);
CREATE INDEX IF NOT EXISTS idx_gamma_docs_format ON gamma_documents(format);
CREATE INDEX IF NOT EXISTS idx_gamma_docs_template ON gamma_documents(template);
CREATE INDEX IF NOT EXISTS idx_gamma_docs_status ON gamma_documents(status);
CREATE INDEX IF NOT EXISTS idx_gamma_docs_subject ON gamma_documents(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_gamma_docs_created_at ON gamma_documents(created_at);
CREATE INDEX IF NOT EXISTS idx_gamma_docs_is_public ON gamma_documents(is_public);
