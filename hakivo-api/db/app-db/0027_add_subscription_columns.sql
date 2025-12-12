-- Add missing subscription columns to users table
-- Migration: 0027_add_subscription_columns.sql
-- Required by subscription-api/index.ts

-- Add Stripe subscription ID column
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;

-- Add subscription timing columns
ALTER TABLE users ADD COLUMN subscription_started_at INTEGER;
ALTER TABLE users ADD COLUMN subscription_ends_at INTEGER;

-- Add brief usage tracking columns
ALTER TABLE users ADD COLUMN briefs_used_this_month INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN briefs_reset_at INTEGER;

-- Create index on subscription ID for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription ON users(stripe_subscription_id);
