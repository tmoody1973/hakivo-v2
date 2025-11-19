-- Track which articles users have seen to prevent showing duplicates
CREATE TABLE IF NOT EXISTS user_article_views (
    user_id TEXT NOT NULL,
    article_id TEXT NOT NULL,
    viewed_at INTEGER NOT NULL, -- Timestamp when article was viewed
    PRIMARY KEY (user_id, article_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_article_views_user ON user_article_views(user_id);
CREATE INDEX IF NOT EXISTS idx_article_views_viewed ON user_article_views(viewed_at DESC);
