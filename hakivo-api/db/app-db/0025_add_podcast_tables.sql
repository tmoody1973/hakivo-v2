-- 100 Laws That Shaped America Podcast tables
-- SQLite compatible schema

-- Historic laws from 1900-2000 (source data for podcast episodes)
CREATE TABLE IF NOT EXISTS historic_laws (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    public_law TEXT,
    president_signed TEXT,
    category TEXT,
    description TEXT,
    key_provisions TEXT, -- JSON array stored as text
    historical_impact TEXT,
    episode_generated INTEGER DEFAULT 0, -- SQLite boolean: 0=false, 1=true
    episode_id TEXT, -- FK to podcast_episodes when generated
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_historic_laws_year ON historic_laws(year);
CREATE INDEX IF NOT EXISTS idx_historic_laws_episode_generated ON historic_laws(episode_generated);
CREATE INDEX IF NOT EXISTS idx_historic_laws_category ON historic_laws(category);

-- Podcast episodes (generated content)
CREATE TABLE IF NOT EXISTS podcast_episodes (
    id TEXT PRIMARY KEY,
    law_id INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    title TEXT NOT NULL, -- Law name as title
    headline TEXT NOT NULL, -- Engaging episode headline (AI-generated)
    description TEXT, -- Written summary/show notes
    script TEXT, -- Full dialogue script for TTS
    audio_url TEXT,
    audio_duration INTEGER, -- Duration in seconds
    thumbnail_url TEXT, -- AI-generated episode thumbnail
    character_count INTEGER,
    status TEXT DEFAULT 'pending', -- 'pending', 'generating', 'script_ready', 'completed', 'failed'
    error_message TEXT, -- Error details if failed
    created_at INTEGER NOT NULL,
    published_at INTEGER,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (law_id) REFERENCES historic_laws(id)
);

CREATE INDEX IF NOT EXISTS idx_podcast_episodes_status ON podcast_episodes(status);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_number ON podcast_episodes(episode_number);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_law ON podcast_episodes(law_id);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_published ON podcast_episodes(published_at);

-- Podcast plays tracking (for analytics)
CREATE TABLE IF NOT EXISTS podcast_plays (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    user_id TEXT, -- NULL for anonymous plays
    played_at INTEGER NOT NULL,
    duration_listened INTEGER, -- seconds listened
    completed INTEGER DEFAULT 0, -- 1 if listened to >90%
    FOREIGN KEY (episode_id) REFERENCES podcast_episodes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_podcast_plays_episode ON podcast_plays(episode_id);
CREATE INDEX IF NOT EXISTS idx_podcast_plays_user ON podcast_plays(user_id);
CREATE INDEX IF NOT EXISTS idx_podcast_plays_date ON podcast_plays(played_at);
