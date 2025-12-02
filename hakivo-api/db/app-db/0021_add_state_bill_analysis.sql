-- State Bill Analysis table (mirrors bill_analysis but for state bills)
-- Used for deep AI analysis of state legislation

CREATE TABLE IF NOT EXISTS state_bill_analysis (
    bill_id TEXT PRIMARY KEY,  -- OpenStates OCD bill ID

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
    recent_developments TEXT,  -- JSON from web search: recent news, expert opinions

    -- State-Specific Impacts
    state_impacts TEXT,  -- JSON by state: {state_code: {impact_summary, affected_industries}}

    -- Metadata
    thinking_summary TEXT,  -- AI reasoning process
    analyzed_at INTEGER NOT NULL,
    model_used TEXT DEFAULT 'cerebras-gpt-oss-120b',

    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'complete', 'failed')),
    started_at INTEGER,
    completed_at INTEGER,

    FOREIGN KEY (bill_id) REFERENCES state_bills(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_state_bill_analysis_likelihood ON state_bill_analysis(passage_likelihood);
CREATE INDEX IF NOT EXISTS idx_state_bill_analysis_analyzed_at ON state_bill_analysis(analyzed_at);
CREATE INDEX IF NOT EXISTS idx_state_bill_analysis_status ON state_bill_analysis(status);
