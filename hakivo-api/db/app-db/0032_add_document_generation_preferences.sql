-- Add document generation preferences to user_preferences table
-- These settings control default options when generating professional documents via Gamma

-- Default document format (presentation, document, webpage)
ALTER TABLE user_preferences ADD COLUMN doc_default_format TEXT DEFAULT 'presentation';

-- Default template preset (lesson_guide, advocacy_deck, policy_brief, citizen_explainer, news_summary, executive_summary, research_report, social_share)
ALTER TABLE user_preferences ADD COLUMN doc_default_template TEXT DEFAULT 'policy_brief';

-- Default audience description
ALTER TABLE user_preferences ADD COLUMN doc_default_audience TEXT DEFAULT 'General audience';

-- Default tone (professional, educational, persuasive, journalistic, etc.)
ALTER TABLE user_preferences ADD COLUMN doc_default_tone TEXT DEFAULT 'Professional and informative';

-- Auto-export to PDF when document is generated
ALTER TABLE user_preferences ADD COLUMN doc_auto_export_pdf INTEGER DEFAULT 0;

-- Auto-enrich content with bill details, news, etc.
ALTER TABLE user_preferences ADD COLUMN doc_auto_enrich INTEGER DEFAULT 1;

-- Preferred text amount (brief, medium, detailed, extensive)
ALTER TABLE user_preferences ADD COLUMN doc_text_amount TEXT DEFAULT 'medium';

-- Preferred image source (stock, ai, none)
ALTER TABLE user_preferences ADD COLUMN doc_image_source TEXT DEFAULT 'stock';
