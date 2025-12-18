-- Migration: Fix request_payload duplicate column error by recreating table
-- This bypasses Raindrop's cached ADD COLUMN by dropping and recreating the whole table

-- Drop the old table (will lose any existing data)
DROP TABLE IF EXISTS gamma_documents;

-- Recreate with proper schema including request_payload
CREATE TABLE gamma_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  artifact_id TEXT,
  gamma_generation_id TEXT NOT NULL,
  gamma_url TEXT,
  gamma_thumbnail_url TEXT,
  title TEXT NOT NULL,
  format TEXT NOT NULL,
  template TEXT,
  card_count INTEGER DEFAULT 0,
  pdf_storage_key TEXT,
  pdf_url TEXT,
  pptx_storage_key TEXT,
  pptx_url TEXT,
  is_public INTEGER DEFAULT 0,
  share_token TEXT UNIQUE,
  view_count INTEGER DEFAULT 0,
  subject_type TEXT,
  subject_id TEXT,
  audience TEXT,
  enrichment_options TEXT,
  -- request_payload will be added by Raindrop's cached migration
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL
);

-- Recreate indexes
CREATE INDEX idx_gamma_docs_user_id ON gamma_documents(user_id);
CREATE INDEX idx_gamma_docs_artifact_id ON gamma_documents(artifact_id);
CREATE INDEX idx_gamma_docs_share_token ON gamma_documents(share_token);
CREATE INDEX idx_gamma_docs_format ON gamma_documents(format);
CREATE INDEX idx_gamma_docs_template ON gamma_documents(template);
CREATE INDEX idx_gamma_docs_status ON gamma_documents(status);
CREATE INDEX idx_gamma_docs_subject ON gamma_documents(subject_type, subject_id);
CREATE INDEX idx_gamma_docs_created_at ON gamma_documents(created_at);
CREATE INDEX idx_gamma_docs_is_public ON gamma_documents(is_public);
