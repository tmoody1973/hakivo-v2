/**
 * Backfill script to strip HTML from all bills in the database
 * Converts raw HTML bill text to plain text for AI analysis
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * Strip HTML tags and extract plain text from bill content
 */
function stripHTML(html: string): string {
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Remove excessive whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');

  return text.trim();
}

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

async function updateProgress(status: string, processed: number, total: number) {
  try {
    await executeSQL(`
      INSERT OR REPLACE INTO backfill_progress (id, status, processed, total, updated_at)
      VALUES ('html-strip', '${status}', ${processed}, ${total}, ${Date.now()})
    `);
  } catch (error) {
    // Table might not exist, create it
    try {
      await executeSQL(`
        CREATE TABLE IF NOT EXISTS backfill_progress (
          id TEXT PRIMARY KEY,
          status TEXT,
          processed INTEGER,
          total INTEGER,
          updated_at INTEGER
        )
      `);
      await executeSQL(`
        INSERT OR REPLACE INTO backfill_progress (id, status, processed, total, updated_at)
        VALUES ('html-strip', '${status}', ${processed}, ${total}, ${Date.now()})
      `);
    } catch (e) {
      console.error('Could not update progress:', e);
    }
  }
}

async function backfillStripHTML() {
  console.log('🔄 Starting HTML stripping backfill...\n');

  try {
    // Get count of bills that need stripping
    const countResult = await executeSQL(`
      SELECT COUNT(*) as count
      FROM bills
      WHERE text IS NOT NULL
        AND text != ''
        AND text LIKE '<html>%'
    `);

    const totalToProcess = countResult.results[0].count;
    console.log(`📊 Found ${totalToProcess} bills with HTML text\n`);

    await updateProgress('running', 0, totalToProcess);

    if (totalToProcess === 0) {
      console.log('✅ No bills need processing!');
      return;
    }

    // Process in batches
    const batchSize = 100;
    let processed = 0;
    let offset = 0;

    while (processed < totalToProcess) {
      console.log(`\n📦 Processing batch ${Math.floor(offset / batchSize) + 1} (${processed}/${totalToProcess} bills)...`);

      // Get batch of bills
      const batch = await executeSQL(`
        SELECT id, text, LENGTH(text) as html_length
        FROM bills
        WHERE text IS NOT NULL
          AND text != ''
          AND text LIKE '<html>%'
        LIMIT ${batchSize}
        OFFSET ${offset}
      `);

      if (!batch.results || batch.results.length === 0) {
        break;
      }

      // Process each bill in the batch
      for (const bill of batch.results) {
        try {
          // Strip HTML
          const plainText = stripHTML(bill.text);

          // Update database
          await executeSQL(`
            UPDATE bills
            SET text = '${plainText.replace(/'/g, "''")}'
            WHERE id = '${bill.id}'
          `);

          processed++;

          if (processed % 10 === 0) {
            console.log(`  ✓ Processed ${processed}/${totalToProcess} (${((processed / totalToProcess) * 100).toFixed(1)}%)`);
          }
        } catch (error) {
          console.error(`  ✗ Failed to process ${bill.id}:`, error instanceof Error ? error.message : error);
        }
      }

      offset += batchSize;
    }

    console.log(`\n✅ Backfill complete!`);
    console.log(`   Total processed: ${processed}/${totalToProcess} bills`);

    // Verify results
    console.log('\n🔍 Verifying results...');
    const verification = await executeSQL(`
      SELECT
        COUNT(*) as total_bills,
        COUNT(CASE WHEN text LIKE '<html>%' THEN 1 END) as html_bills,
        COUNT(CASE WHEN text IS NOT NULL AND text != '' AND text NOT LIKE '<html>%' THEN 1 END) as plain_text_bills
      FROM bills
    `);

    const stats = verification.results[0];
    console.log(`   Total bills: ${stats.total_bills}`);
    console.log(`   Still HTML: ${stats.html_bills}`);
    console.log(`   Plain text: ${stats.plain_text_bills}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

backfillStripHTML().then(() => {
  console.log('\n✅ Script complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
