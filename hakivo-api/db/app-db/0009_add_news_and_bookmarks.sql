-- News articles pool and user bookmarks tables
-- Supports twice-daily Exa.ai news sync and user article bookmarking

-- News articles pool (shared across all users, populated by news-sync-scheduler)
CREATE TABLE IF NOT EXISTS news_articles (
    id TEXT PRIMARY KEY,
    interest TEXT NOT NULL, -- Policy interest category (e.g., 'Environment & Energy')
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE, -- Article URL (unique to prevent duplicates)
    author TEXT,
    summary TEXT,
    image_url TEXT,
    published_date TEXT, -- ISO 8601 date string
    fetched_at INTEGER NOT NULL, -- Timestamp when article was fetched
    score REAL, -- Exa.ai relevance score
    source_domain TEXT, -- Extracted from URL (e.g., 'nytimes.com')
    UNIQUE(url, interest) -- Allow same article in multiple interests
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_news_interest ON news_articles(interest);
CREATE INDEX IF NOT EXISTS idx_news_fetched ON news_articles(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_news_score ON news_articles(score DESC);

-- User bookmarks (allows users to save articles to their profile)
CREATE TABLE IF NOT EXISTS user_bookmarks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    article_url TEXT NOT NULL, -- URL of bookmarked article
    title TEXT NOT NULL,
    summary TEXT,
    image_url TEXT,
    interest TEXT NOT NULL, -- Policy interest category
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, article_url) -- Prevent duplicate bookmarks
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON user_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON user_bookmarks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_interest ON user_bookmarks(interest);
