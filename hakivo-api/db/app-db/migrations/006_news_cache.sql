-- News cache for deduplication
-- Tracks which news URLs have been included in recent briefs to avoid repetition

CREATE TABLE IF NOT EXISTS news_cache (
  user_id TEXT NOT NULL,
  news_url TEXT NOT NULL,
  headline TEXT,
  category TEXT, -- 'federal_legislation', 'state_legislation', 'policy_healthcare', etc.
  included_at INTEGER NOT NULL, -- Unix timestamp in milliseconds
  brief_id TEXT,
  PRIMARY KEY (user_id, news_url)
);

-- Index for efficient lookups by user and date
CREATE INDEX IF NOT EXISTS idx_news_cache_user_date
  ON news_cache(user_id, included_at);

-- Index for cleanup operations (removing old entries)
CREATE INDEX IF NOT EXISTS idx_news_cache_cleanup
  ON news_cache(included_at);
