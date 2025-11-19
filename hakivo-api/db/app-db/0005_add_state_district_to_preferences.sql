-- Add state and district columns to user_preferences table
-- These fields store the user's Congressional district information from Geocodio

-- Add state column (2-letter state code like "CA", "NY")
ALTER TABLE user_preferences ADD COLUMN state TEXT;

-- Add district column (district number like 12, 5)
ALTER TABLE user_preferences ADD COLUMN district INTEGER;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_preferences_state ON user_preferences(state);
CREATE INDEX IF NOT EXISTS idx_user_preferences_district ON user_preferences(state, district);
