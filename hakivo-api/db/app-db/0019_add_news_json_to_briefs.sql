-- Migration: Add news_json column to briefs table
-- Purpose: Store news articles that were used in generating the brief

ALTER TABLE briefs ADD COLUMN news_json TEXT;
