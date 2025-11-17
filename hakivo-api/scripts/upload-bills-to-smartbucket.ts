#!/usr/bin/env tsx

/**
 * Upload Bills to SmartBucket
 *
 * Populates the BILL_TEXTS SmartBucket with bill full texts from the database.
 * This is a one-time backfill since the daily sync scheduler hasn't run yet.
 *
 * Usage: npx tsx scripts/upload-bills-to-smartbucket.ts
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01ka747hjpq5r2qk4ct00r3yyd.01k66gey30f48fys2tv4e412yt.lmapp.run';

interface Stats {
  total: number;
  uploaded: number;
  skipped: number;
  errors: number;
}

const stats: Stats = {
  total: 0,
  uploaded: 0,
  skipped: 0,
  errors: 0
};

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

async function uploadToSmartBucket(congress: number, type: string, number: number, text: string, title: string): Promise<void> {
  // Use the admin dashboard's SmartBucket store endpoint
  const documentKey = `congress-${congress}/${type}${number}.txt`;

  const response = await fetch(`${ADMIN_DASHBOARD_URL}/api/smartbucket/store`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucket: 'BILL_TEXTS',
      key: documentKey,
      content: text,
      contentType: 'text/plain'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SmartBucket upload failed: ${error}`);
  }
}

async function main() {
  console.log('📤 Upload Bills to SmartBucket');
  console.log('===============================\n');

  // Get all bills with full text from database
  console.log('📊 Fetching bills with full text from database...');
  const result: any = await executeSQL(`
    SELECT congress, bill_type, bill_number, title, text, LENGTH(text) as text_length
    FROM bills
    WHERE text IS NOT NULL
    ORDER BY congress DESC, bill_type, bill_number
  `);

  const bills = result.results || [];
  console.log(`   Found ${bills.length} bills with full text\n`);

  if (bills.length === 0) {
    console.log('⚠️  No bills with full text found. Nothing to upload.');
    return;
  }

  console.log('📤 Uploading to BILL_TEXTS SmartBucket...\n');

  for (const bill of bills) {
    try {
      stats.total++;
      const { congress, bill_type, bill_number, title, text, text_length } = bill;

      if (!text || text.trim().length === 0) {
        stats.skipped++;
        continue;
      }

      // Upload to SmartBucket
      await uploadToSmartBucket(congress, bill_type, bill_number, text, title);
      stats.uploaded++;

      console.log(`  ✅ ${congress}-${bill_type}-${bill_number}: ${text_length} chars`);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

      // Progress update every 10 bills
      if (stats.uploaded % 10 === 0) {
        console.log(`\n📊 Progress: ${stats.uploaded}/${bills.length} bills uploaded\n`);
      }

    } catch (error: any) {
      console.error(`  ✗ Error uploading ${bill.congress}-${bill.bill_type}-${bill.bill_number}:`, error.message);
      stats.errors++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ SMARTBUCKET UPLOAD COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📊 Final Statistics:`);
  console.log(`   Total processed: ${stats.total}`);
  console.log(`   Successfully uploaded: ${stats.uploaded}`);
  console.log(`   Skipped (empty text): ${stats.skipped}`);
  console.log(`   Errors: ${stats.errors}`);

  console.log(`\n💡 Bill texts are now stored in SmartBucket with keys:`);
  console.log(`   Format: congress-{congress}/{type}{number}.txt`);
  console.log(`   Example: congress-118/s5319.txt`);
  console.log(`\n🔍 SmartBucket is accessed via environment bindings:`);
  console.log(`   await this.env.BILL_TEXTS.get('congress-118/s5319.txt')`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
