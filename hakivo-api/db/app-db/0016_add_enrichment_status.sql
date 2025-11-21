-- Migration: Add enrichment status tracking
-- Purpose: Track enrichment progress for real-time UI updates
-- Created: 2025-11-21

-- Add status field to bill_enrichment
ALTER TABLE bill_enrichment ADD COLUMN status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'complete', 'failed'));
ALTER TABLE bill_enrichment ADD COLUMN started_at INTEGER;
ALTER TABLE bill_enrichment ADD COLUMN completed_at INTEGER;

-- Add status field to news_enrichment
ALTER TABLE news_enrichment ADD COLUMN status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'complete', 'failed'));
ALTER TABLE news_enrichment ADD COLUMN started_at INTEGER;
ALTER TABLE news_enrichment ADD COLUMN completed_at INTEGER;

-- Add status field to bill_analysis (deep analysis)
ALTER TABLE bill_analysis ADD COLUMN status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'complete', 'failed'));
ALTER TABLE bill_analysis ADD COLUMN started_at INTEGER;
ALTER TABLE bill_analysis ADD COLUMN completed_at INTEGER;

-- Create indexes for status queries
CREATE INDEX IF NOT EXISTS idx_bill_enrichment_status ON bill_enrichment(status);
CREATE INDEX IF NOT EXISTS idx_news_enrichment_status ON news_enrichment(status);
CREATE INDEX IF NOT EXISTS idx_bill_analysis_status ON bill_analysis(status);
