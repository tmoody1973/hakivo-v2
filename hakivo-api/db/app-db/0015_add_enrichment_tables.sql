-- Migration: Add AI Enrichment Tables
-- Purpose: Support Cerebras feed summaries and Gemini 3 Pro deep bill analysis
-- Created: 2025-11-21

-- ============================================================================
-- NEWS ENRICHMENT (Cerebras summaries for feed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS news_enrichment (
    article_id TEXT PRIMARY KEY,
    plain_language_summary TEXT NOT NULL,
    key_points TEXT,  -- JSON array of bullet points
    reading_time_minutes INTEGER DEFAULT 2,
    impact_level TEXT CHECK(impact_level IN ('high', 'medium', 'low')),
    related_bill_ids TEXT,  -- JSON array of bill IDs
    tags TEXT,  -- JSON: ["breaking", "local", "trending", "bipartisan"]
    enriched_at INTEGER NOT NULL,
    model_used TEXT DEFAULT 'cerebras-gpt-oss-120b',
    FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_news_enrichment_impact ON news_enrichment(impact_level);
CREATE INDEX IF NOT EXISTS idx_news_enrichment_enriched_at ON news_enrichment(enriched_at);

-- ============================================================================
-- BILL ENRICHMENT (Cerebras summaries for feed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bill_enrichment (
    bill_id TEXT PRIMARY KEY,
    plain_language_summary TEXT NOT NULL,
    reading_time_minutes INTEGER DEFAULT 3,
    key_points TEXT,  -- JSON array of bullet points
    impact_level TEXT CHECK(impact_level IN ('high', 'medium', 'low')),
    bipartisan_score INTEGER DEFAULT 0,  -- 0-100 based on cosponsor party distribution
    current_stage TEXT,  -- "Introduced", "Committee Review", "Floor Vote", etc.
    progress_percentage INTEGER DEFAULT 0,  -- 0-100 based on legislative journey
    tags TEXT,  -- JSON: ["urgent", "local-impact", "bipartisan", "trending"]
    enriched_at INTEGER NOT NULL,
    model_used TEXT DEFAULT 'cerebras-gpt-oss-120b',
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bill_enrichment_impact ON bill_enrichment(impact_level);
CREATE INDEX IF NOT EXISTS idx_bill_enrichment_bipartisan ON bill_enrichment(bipartisan_score);
CREATE INDEX IF NOT EXISTS idx_bill_enrichment_enriched_at ON bill_enrichment(enriched_at);

-- ============================================================================
-- BILL ANALYSIS (Gemini 3 Pro deep analysis for detail pages)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bill_analysis (
    bill_id TEXT PRIMARY KEY,

    -- Executive Summary
    executive_summary TEXT NOT NULL,  -- Bottom Line Up Front (2-3 sentences)
    status_quo_vs_change TEXT,  -- What changes if this passes

    -- Section-by-Section Breakdown
    section_breakdown TEXT,  -- JSON array of {section, plain_english, context}

    -- Mechanism & Regulatory Authority
    mechanism_of_action TEXT,  -- How the bill works (tax, mandate, grant, etc.)
    agency_powers TEXT,  -- JSON array of {agency, new_powers, discretion_level}

    -- Impact Analysis
    fiscal_impact TEXT,  -- JSON: {cost_estimate, revenue_changes, funding_mandates}
    stakeholder_impact TEXT,  -- JSON: {winners: [], losers: [], affected_groups: []}
    unintended_consequences TEXT,  -- JSON array of potential second-order effects

    -- Steelmanned Arguments
    arguments_for TEXT,  -- JSON array with citations from web search
    arguments_against TEXT,  -- JSON array with citations from web search

    -- Implementation
    implementation_challenges TEXT,  -- JSON array of logistical hurdles, ambiguities

    -- Predictions & Recent Developments
    passage_likelihood INTEGER,  -- 0-100 probability score
    passage_reasoning TEXT,  -- Explanation of likelihood assessment
    recent_developments TEXT,  -- JSON from Google Search: recent news, expert opinions

    -- State-Specific Impacts
    state_impacts TEXT,  -- JSON by state: {state_code: {impact_summary, affected_industries}}

    -- Metadata
    thinking_summary TEXT,  -- Gemini's reasoning process (thinking mode output)
    analyzed_at INTEGER NOT NULL,
    model_used TEXT DEFAULT 'gemini-3-pro-preview',

    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bill_analysis_likelihood ON bill_analysis(passage_likelihood);
CREATE INDEX IF NOT EXISTS idx_bill_analysis_analyzed_at ON bill_analysis(analyzed_at);

-- ============================================================================
-- BILL-NEWS LINKS (Connect related content)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bill_news_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id TEXT NOT NULL,
    article_id TEXT NOT NULL,
    relevance_score REAL DEFAULT 0.0,  -- 0.0-1.0 semantic similarity
    link_type TEXT CHECK(link_type IN ('direct_mention', 'policy_area', 'sponsor', 'semantic')),
    created_at INTEGER NOT NULL,

    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
    FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE,
    UNIQUE(bill_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_bill_news_bill ON bill_news_links(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_news_article ON bill_news_links(article_id);
CREATE INDEX IF NOT EXISTS idx_bill_news_relevance ON bill_news_links(relevance_score);
