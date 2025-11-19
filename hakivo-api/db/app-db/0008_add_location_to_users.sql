-- Add location data columns to users table
-- These fields are populated during onboarding for quick access

ALTER TABLE users ADD COLUMN zip_code TEXT;
ALTER TABLE users ADD COLUMN city TEXT;
ALTER TABLE users ADD COLUMN congressional_district TEXT;
