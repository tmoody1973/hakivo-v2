#!/usr/bin/env tsx

/**
 * Run Podcast Tables Migration
 * Creates historic_laws, podcast_episodes, and podcast_plays tables
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

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
  console.log('🎙️ Running podcast tables migration\n');

  const statements = [
    {
      name: 'historic_laws table',
      sql: `CREATE TABLE IF NOT EXISTS historic_laws (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        year INTEGER NOT NULL,
        public_law TEXT,
        president_signed TEXT,
        category TEXT,
        description TEXT,
        key_provisions TEXT,
        historical_impact TEXT,
        episode_generated INTEGER DEFAULT 0,
        episode_id TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )`
    },
    {
      name: 'podcast_episodes table',
      sql: `CREATE TABLE IF NOT EXISTS podcast_episodes (
        id TEXT PRIMARY KEY,
        law_id INTEGER NOT NULL,
        episode_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        headline TEXT NOT NULL,
        description TEXT,
        script TEXT,
        audio_url TEXT,
        audio_duration INTEGER,
        thumbnail_url TEXT,
        character_count INTEGER,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        created_at INTEGER NOT NULL,
        published_at INTEGER,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (law_id) REFERENCES historic_laws(id)
      )`
    },
    {
      name: 'podcast_plays table',
      sql: `CREATE TABLE IF NOT EXISTS podcast_plays (
        id TEXT PRIMARY KEY,
        episode_id TEXT NOT NULL,
        user_id TEXT,
        played_at INTEGER NOT NULL,
        duration_listened INTEGER,
        completed INTEGER DEFAULT 0,
        FOREIGN KEY (episode_id) REFERENCES podcast_episodes(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )`
    },
    // Indexes for historic_laws
    { name: 'historic_laws year index', sql: `CREATE INDEX IF NOT EXISTS idx_historic_laws_year ON historic_laws(year)` },
    { name: 'historic_laws episode_generated index', sql: `CREATE INDEX IF NOT EXISTS idx_historic_laws_episode_generated ON historic_laws(episode_generated)` },
    { name: 'historic_laws category index', sql: `CREATE INDEX IF NOT EXISTS idx_historic_laws_category ON historic_laws(category)` },
    // Indexes for podcast_episodes
    { name: 'podcast_episodes status index', sql: `CREATE INDEX IF NOT EXISTS idx_podcast_episodes_status ON podcast_episodes(status)` },
    { name: 'podcast_episodes number index', sql: `CREATE INDEX IF NOT EXISTS idx_podcast_episodes_number ON podcast_episodes(episode_number)` },
    { name: 'podcast_episodes law index', sql: `CREATE INDEX IF NOT EXISTS idx_podcast_episodes_law ON podcast_episodes(law_id)` },
    { name: 'podcast_episodes published index', sql: `CREATE INDEX IF NOT EXISTS idx_podcast_episodes_published ON podcast_episodes(published_at)` },
    // Indexes for podcast_plays
    { name: 'podcast_plays episode index', sql: `CREATE INDEX IF NOT EXISTS idx_podcast_plays_episode ON podcast_plays(episode_id)` },
    { name: 'podcast_plays user index', sql: `CREATE INDEX IF NOT EXISTS idx_podcast_plays_user ON podcast_plays(user_id)` },
    { name: 'podcast_plays date index', sql: `CREATE INDEX IF NOT EXISTS idx_podcast_plays_date ON podcast_plays(played_at)` },
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

  const tables = ['historic_laws', 'podcast_episodes', 'podcast_plays'];
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
