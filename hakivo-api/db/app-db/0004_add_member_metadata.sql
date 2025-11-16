-- Migration: Add member metadata fields
-- Date: 2025-01-16
-- Description: Adds biographical and social media fields to members table
-- Note: D1 doesn't support ALTER TABLE ADD COLUMN, so we recreate the table

-- Create new members table with all fields
CREATE TABLE members_new (
    bioguide_id TEXT PRIMARY KEY,
    first_name TEXT,
    middle_name TEXT,
    last_name TEXT,
    party TEXT,
    state TEXT,
    district INTEGER,
    url TEXT,
    birth_year INTEGER,
    death_year INTEGER,
    current_member INTEGER,
    image_url TEXT,
    office_address TEXT,
    phone_number TEXT,

    -- New biographical fields
    official_full_name TEXT,
    gender TEXT,
    birth_date TEXT,
    birth_place TEXT,
    nickname TEXT,
    suffix TEXT,

    -- New ID fields for cross-referencing
    thomas_id TEXT,
    lis_id TEXT,
    govtrack_id TEXT,
    opensecrets_id TEXT,
    votesmart_id TEXT,
    fec_ids TEXT,
    cspan_id TEXT,
    wikipedia_id TEXT,
    house_history_id TEXT,
    ballotpedia_id TEXT,
    maplight_id TEXT,
    icpsr_id TEXT,
    wikidata_id TEXT,
    google_entity_id TEXT,

    -- New social media fields
    twitter_handle TEXT,
    facebook_url TEXT,
    youtube_url TEXT,
    instagram_handle TEXT,
    website_url TEXT,
    contact_form_url TEXT,
    rss_url TEXT,

    -- New term info
    current_term_start TEXT,
    current_term_end TEXT,
    current_term_type TEXT,
    current_term_state TEXT,
    current_term_district INTEGER,
    current_term_class INTEGER,
    current_term_state_rank TEXT
);

-- Copy existing data from old table
INSERT INTO members_new (
    bioguide_id, first_name, middle_name, last_name, party, state, district,
    url, birth_year, death_year, current_member, image_url, office_address, phone_number
)
SELECT
    bioguide_id, first_name, middle_name, last_name, party, state, district,
    url, birth_year, death_year, current_member, image_url, office_address, phone_number
FROM members;

-- Drop old table
DROP TABLE members;

-- Rename new table to members
ALTER TABLE members_new RENAME TO members;
