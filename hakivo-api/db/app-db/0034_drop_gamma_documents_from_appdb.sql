-- Migration: Remove gamma_documents from app-db
-- gamma_documents has been moved to separate gamma-db to avoid migration cache issues
-- This cleans up the duplicate table from app-db

DROP TABLE IF EXISTS gamma_documents;
