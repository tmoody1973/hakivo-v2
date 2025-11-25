#!/usr/bin/env ts-node
/**
 * Insert news articles directly into local Raindrop D1 database
 */
import Database from 'better-sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Articles to insert
const articles = [
  {
    id: '79c4eccd-1914-4f74-b1f1-d62eed8e3a17',
    interest: 'Government & Politics',
    title: 'Crypto has some regulatory asks for Trump',
    url: 'https://punchbowl.news/article/vault/crypto-letter-trump/',
    author: null,
    summary: 'A coalition of crypto companies is urging President Trump to take immediate regulatory actions to support the industry, focusing on issues like tax and regulatory clarity. They believe that these steps can provide quick benefits alongside ongoing legislative efforts.',
    text: '[Skip to content](https://punchbowl.news/punchbowl.news#start-of-content)\n\nPremium\n\nNovember 20, 2025\n\n# Crypto has some regulatory asks for Trump\n\n**First****in The Vault:**A large coalition of crypto companies and trade associations is urging President **Donald Trump** to take "immediate" regulatory steps to support the industry...',
    image_url: 'https://punchbowl.news/wp-content/uploads/DonaldTrump_01232025-2-1.jpg',
    published_date: '2025-11-20T19:10:50.840Z',
    fetched_at: 1764097864325,
    score: 0,
    source_domain: 'punchbowl.news'
  },
  {
    id: '99f6df45-1342-4595-990b-26ea7588b389',
    interest: 'Government & Politics',
    title: 'Crypto has some regulatory asks for Trump',
    url: 'https://punchbowl.news/article/vault/crypto-letter-trump/',
    author: null,
    summary: 'A coalition of crypto companies is urging President Trump to take immediate regulatory actions to support the industry, focusing on issues like tax and regulatory clarity. They believe that quick administrative steps can complement ongoing legislative efforts to enhance the crypto landscape.',
    text: '[Skip to content](https://punchbowl.news/punchbowl.news#start-of-content)\n\nPremium\n\nNovember 20, 2025\n\n# Crypto has some regulatory asks for Trump\n\n**First****in The Vault:**A large coalition of crypto companies and trade associations is urging President **Donald Trump** to take "immediate" regulatory steps to support the industry...',
    image_url: 'https://punchbowl.news/wp-content/uploads/DonaldTrump_01232025-2-1.jpg',
    published_date: '2025-11-20T19:10:56.660Z',
    fetched_at: 1764097864325,
    score: 0,
    source_domain: 'punchbowl.news'
  }
];

async function insertArticles() {
  console.log('📝 Inserting articles into local Raindrop D1 database...\n');

  // Connect to local D1 database
  const dbPath = path.join(__dirname, '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/ca61b5f23ba90a4ae7e19c93c8de5a21.sqlite');

  try {
    const db = new Database(dbPath);

    const stmt = db.prepare(`
      INSERT INTO news_articles (
        id, interest, title, url, author, summary, text,
        image_url, published_date, fetched_at, score, source_domain
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    let skipped = 0;

    for (const article of articles) {
      try {
        stmt.run(
          article.id,
          article.interest,
          article.title,
          article.url,
          article.author,
          article.summary,
          article.text,
          article.image_url,
          article.published_date,
          article.fetched_at,
          article.score,
          article.source_domain
        );
        console.log(`✅ Inserted: ${article.title}`);
        inserted++;
      } catch (error: any) {
        if (error.message.includes('UNIQUE constraint')) {
          console.log(`⏭️  Skipped (duplicate): ${article.title}`);
          skipped++;
        } else {
          console.error(`❌ Failed to insert: ${article.title}`, error.message);
        }
      }
    }

    db.close();

    console.log(`\n📊 Summary:`);
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${articles.length}`);

  } catch (error) {
    console.error('❌ Database connection error:', error);
    console.error('\nMake sure the local Raindrop server is running:');
    console.error('  cd hakivo-api && npm run start');
    process.exit(1);
  }
}

insertArticles().catch(console.error);
