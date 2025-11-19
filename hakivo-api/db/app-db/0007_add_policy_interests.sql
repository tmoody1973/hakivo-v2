-- Add policy_interests column to user_preferences table
-- This stores the user's selected policy interest categories as JSON

ALTER TABLE user_preferences ADD COLUMN policy_interests TEXT;
