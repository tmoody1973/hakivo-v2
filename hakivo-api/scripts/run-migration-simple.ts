#!/usr/bin/env tsx

/**
 * Run Database Migration (Simple - executes CREATE TABLE statements individually)
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

async function executeSQL(query: string): Promise<any> {
  const response = await fetch(`${ADMIN_DASHBOARD_URL}/api/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Database query failed: ${error}`);
  }

  return response.json();
}

async function runMigration() {
  console.log('🔄 Running enrichment tables migration\n');

  const statements = [
    {
      name: 'news_enrichment table',
      sql: `CREATE TABLE IF NOT EXISTS news_enrichment (
        article_id TEXT PRIMARY KEY,
        plain_language_summary TEXT NOT NULL,
        key_points TEXT,
        reading_time_minutes INTEGER DEFAULT 2,
        impact_level TEXT CHECK(impact_level IN ('high', 'medium', 'low')),
        related_bill_ids TEXT,
        tags TEXT,
        enriched_at INTEGER NOT NULL,
        model_used TEXT DEFAULT 'cerebras-gpt-oss-120b',
        FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE
      )`
    },
    {
      name: 'bill_enrichment table',
      sql: `CREATE TABLE IF NOT EXISTS bill_enrichment (
        bill_id TEXT PRIMARY KEY,
        plain_language_summary TEXT NOT NULL,
        reading_time_minutes INTEGER DEFAULT 3,
        key_points TEXT,
        impact_level TEXT CHECK(impact_level IN ('high', 'medium', 'low')),
        bipartisan_score INTEGER DEFAULT 0,
        current_stage TEXT,
        progress_percentage INTEGER DEFAULT 0,
        tags TEXT,
        enriched_at INTEGER NOT NULL,
        model_used TEXT DEFAULT 'cerebras-gpt-oss-120b',
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
      )`
    },
    {
      name: 'bill_analysis table',
      sql: `CREATE TABLE IF NOT EXISTS bill_analysis (
        bill_id TEXT PRIMARY KEY,
        executive_summary TEXT NOT NULL,
        status_quo_vs_change TEXT,
        section_breakdown TEXT,
        mechanism_of_action TEXT,
        agency_powers TEXT,
        fiscal_impact TEXT,
        stakeholder_impact TEXT,
        unintended_consequences TEXT,
        arguments_for TEXT,
        arguments_against TEXT,
        implementation_challenges TEXT,
        passage_likelihood INTEGER,
        passage_reasoning TEXT,
        recent_developments TEXT,
        state_impacts TEXT,
        thinking_summary TEXT,
        analyzed_at INTEGER NOT NULL,
        model_used TEXT DEFAULT 'gemini-3-pro-preview',
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
      )`
    },
    {
      name: 'bill_news_links table',
      sql: `CREATE TABLE IF NOT EXISTS bill_news_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id TEXT NOT NULL,
        article_id TEXT NOT NULL,
        relevance_score REAL DEFAULT 0.0,
        link_type TEXT CHECK(link_type IN ('direct_mention', 'policy_area', 'sponsor', 'semantic')),
        created_at INTEGER NOT NULL,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
        FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE,
        UNIQUE(bill_id, article_id)
      )`
    },
    // Indexes
    { name: 'news_enrichment impact index', sql: `CREATE INDEX IF NOT EXISTS idx_news_enrichment_impact ON news_enrichment(impact_level)` },
    { name: 'news_enrichment enriched_at index', sql: `CREATE INDEX IF NOT EXISTS idx_news_enrichment_enriched_at ON news_enrichment(enriched_at)` },
    { name: 'bill_enrichment impact index', sql: `CREATE INDEX IF NOT EXISTS idx_bill_enrichment_impact ON bill_enrichment(impact_level)` },
    { name: 'bill_enrichment bipartisan index', sql: `CREATE INDEX IF NOT EXISTS idx_bill_enrichment_bipartisan ON bill_enrichment(bipartisan_score)` },
    { name: 'bill_enrichment enriched_at index', sql: `CREATE INDEX IF NOT EXISTS idx_bill_enrichment_enriched_at ON bill_enrichment(enriched_at)` },
    { name: 'bill_analysis likelihood index', sql: `CREATE INDEX IF NOT EXISTS idx_bill_analysis_likelihood ON bill_analysis(passage_likelihood)` },
    { name: 'bill_analysis analyzed_at index', sql: `CREATE INDEX IF NOT EXISTS idx_bill_analysis_analyzed_at ON bill_analysis(analyzed_at)` },
    { name: 'bill_news_links bill index', sql: `CREATE INDEX IF NOT EXISTS idx_bill_news_bill ON bill_news_links(bill_id)` },
    { name: 'bill_news_links article index', sql: `CREATE INDEX IF NOT EXISTS idx_bill_news_article ON bill_news_links(article_id)` },
    { name: 'bill_news_links relevance index', sql: `CREATE INDEX IF NOT EXISTS idx_bill_news_relevance ON bill_news_links(relevance_score)` }
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const statement of statements) {
    try {
      console.log(`  ⏳ Creating: ${statement.name}...`);
      await executeSQL(statement.sql);
      console.log(`  ✅ Success: ${statement.name}`);
      successCount++;
    } catch (error: any) {
      console.error(`  ❌ Error with ${statement.name}:`, error.message);
      errorCount++;
    }
  }

  // Print summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  MIGRATION COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n✅ Successful: ${successCount}`);
  if (errorCount > 0) {
    console.log(`⚠️  Errors: ${errorCount}`);
  }

  // Verify tables were created
  console.log('\n🔍 Verifying migration...\n');

  const tables = ['news_enrichment', 'bill_enrichment', 'bill_analysis', 'bill_news_links'];
  for (const table of tables) {
    try {
      const result = await executeSQL(`SELECT COUNT(*) as count FROM ${table}`);
      const count = result.results?.[0]?.count || 0;
      console.log(`  ✅ ${table}: ${count} rows`);
    } catch (error: any) {
      console.log(`  ❌ ${table}: Not found`);
    }
  }

  console.log('\n✅ Migration complete!\n');
}

runMigration().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
