#!/usr/bin/env ts-node
/**
 * Send all articles from insert-news.sql to production database
 * Reads SQL INSERT statements and sends as JSON to admin API
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz19.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const BATCH_SIZE = 50; // Send 50 articles at a time

interface Article {
  id: string;
  interest: string;
  title: string;
  url: string;
  author: string | null;
  summary: string;
  text: string;
  image_url: string | null;
  published_date: string;
  fetched_at: number;
  score: number;
  source_domain: string;
}

// Parse SQL INSERT statement to extract article data
function parseInsertStatement(sql: string): Article | null {
  const match = sql.match(/VALUES \((.*)\);/s);
  if (!match || !match[1]) return null;

  const values = match[1];

  // Split by comma but respect quoted strings
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  let escapeNext = false;

  for (let i = 0; i < values.length; i++) {
    const char = values[i];

    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      current += char;
      continue;
    }

    if (char === "'") {
      inQuote = !inQuote;
      current += char;
      continue;
    }

    if (char === ',' && !inQuote) {
      parts.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }
  if (current.trim()) {
    parts.push(current.trim());
  }

  if (parts.length !== 12) {
    console.warn(`Expected 12 parts, got ${parts.length}`);
    return null;
  }

  const unquote = (str: string | undefined): string | null => {
    if (!str || str === 'NULL') return null;
    if (str.startsWith("'") && str.endsWith("'")) {
      return str.slice(1, -1).replace(/''/g, "'");
    }
    return str;
  };

  return {
    id: unquote(parts[0]) || crypto.randomUUID(),
    interest: unquote(parts[1]) || 'Unknown',
    title: unquote(parts[2]) || 'Untitled',
    url: unquote(parts[3]) || '',
    author: unquote(parts[4]),
    summary: unquote(parts[5]) || '',
    text: unquote(parts[6]) || '',
    image_url: unquote(parts[7]),
    published_date: unquote(parts[8]) || new Date().toISOString(),
    fetched_at: parseInt(parts[9] || '0'),
    score: parseFloat(parts[10] || '0'),
    source_domain: unquote(parts[11]) || ''
  };
}

async function sendBatch(articles: Article[]): Promise<{ inserted: number; skipped: number; errors?: string[] }> {
  const response = await fetch(`${API_URL}/admin/insert-articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ articles })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const result = await response.json() as { inserted: number; skipped: number; errors?: string[] };
  return result;
}

async function main() {
  console.log('📤 Sending articles to production database...\n');

  // Read SQL file
  const sqlPath = path.join(__dirname, '../insert-news.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  // Extract INSERT statements
  const insertStatements = sqlContent.match(/INSERT INTO news_articles[\s\S]*?\);/g) || [];
  console.log(`Found ${insertStatements.length} INSERT statements\n`);

  // Parse articles
  const articles: Article[] = [];
  for (const stmt of insertStatements) {
    const article = parseInsertStatement(stmt);
    if (article) {
      articles.push(article);
    }
  }

  console.log(`Parsed ${articles.length} articles\n`);

  // Send in batches
  let totalInserted = 0;
  let totalSkipped = 0;
  const allErrors: string[] = [];

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(articles.length / BATCH_SIZE);

    console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} articles)...`);

    try {
      const result = await sendBatch(batch);
      totalInserted += result.inserted;
      totalSkipped += result.skipped;

      if (result.errors && result.errors.length > 0) {
        allErrors.push(...result.errors);
      }

      console.log(`   ✅ Inserted: ${result.inserted}, Skipped: ${result.skipped}`);
    } catch (error) {
      console.error(`   ❌ Batch failed:`, error);
      allErrors.push(`Batch ${batchNum}: ${error}`);
    }

    // Small delay between batches
    if (i + BATCH_SIZE < articles.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total articles: ${articles.length}`);
  console.log(`   Inserted: ${totalInserted}`);
  console.log(`   Skipped: ${totalSkipped}`);

  if (allErrors.length > 0) {
    console.log(`\n❌ Errors (${allErrors.length}):`);
    allErrors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
    if (allErrors.length > 10) {
      console.log(`   ... and ${allErrors.length - 10} more`);
    }
  }

  console.log(`\n✨ Done!`);
}

main().catch(console.error);
