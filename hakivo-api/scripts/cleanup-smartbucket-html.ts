#!/usr/bin/env tsx

/**
 * SmartBucket HTML Cleanup Script
 *
 * Converts existing bills in BILL_TEXTS SmartBucket from HTML to plain text.
 * This improves:
 * - Token efficiency for LLM processing
 * - TTS quality (no HTML artifacts)
 * - Storage efficiency (smaller size)
 *
 * Usage: npx tsx scripts/cleanup-smartbucket-html.ts
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01ka747hjpq5r2qk4ct00r3yyd.01k66gey30f48fys2tv4e412yt.lmapp.run';

interface Stats {
  total: number;
  processed: number;
  alreadyPlainText: number;
  errors: number;
  bytesReduced: number;
}

const stats: Stats = {
  total: 0,
  processed: 0,
  alreadyPlainText: 0,
  errors: 0,
  bytesReduced: 0
};

/**
 * Strip HTML tags and extract plain text
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

/**
 * Check if content is HTML
 */
function isHTML(content: string): boolean {
  return /<html|<body|<pre/i.test(content);
}

/**
 * List all bills in SmartBucket
 */
async function listBills(): Promise<Array<{ key: string; size: number }>> {
  const response = await fetch(`${ADMIN_DASHBOARD_URL}/api/smartbucket/list/BILL_TEXTS?limit=1000`);
  if (!response.ok) {
    throw new Error(`Failed to list bills: ${response.statusText}`);
  }

  const data: any = await response.json();
  return data.objects || [];
}

/**
 * Get bill content from SmartBucket
 */
async function getBill(key: string): Promise<string> {
  const response = await fetch(`${ADMIN_DASHBOARD_URL}/api/smartbucket/get/BILL_TEXTS/${key}`);
  if (!response.ok) {
    throw new Error(`Failed to get bill: ${response.statusText}`);
  }

  const data: any = await response.json();
  return data.content;
}

/**
 * Update bill in SmartBucket
 */
async function updateBill(key: string, content: string): Promise<void> {
  const response = await fetch(`${ADMIN_DASHBOARD_URL}/api/smartbucket/store`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucket: 'BILL_TEXTS',
      key: key,
      content: content,
      contentType: 'text/plain'
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to update bill: ${response.statusText}`);
  }
}

async function main() {
  console.log('🧹 SmartBucket HTML Cleanup');
  console.log('===========================\n');

  // List all bills
  console.log('📊 Fetching bill list from BILL_TEXTS SmartBucket...');
  const bills = await listBills();
  stats.total = bills.length;
  console.log(`   Found ${stats.total} bills\n`);

  if (bills.length === 0) {
    console.log('⚠️  No bills found in SmartBucket');
    return;
  }

  console.log('🔄 Processing bills...\n');

  for (const bill of bills) {
    try {
      const { key, size: originalSize } = bill;

      // Get bill content
      const content = await getBill(key);

      // Check if it's HTML
      if (!isHTML(content)) {
        stats.alreadyPlainText++;
        continue;
      }

      // Strip HTML
      const plainText = stripHTML(content);

      // Update SmartBucket
      await updateBill(key, plainText);

      const newSize = plainText.length;
      const reduction = originalSize - newSize;
      stats.bytesReduced += reduction;
      stats.processed++;

      console.log(`  ✅ ${key}`);
      console.log(`     ${originalSize.toLocaleString()} → ${newSize.toLocaleString()} bytes (${reduction > 0 ? '-' : '+'}${Math.abs(reduction).toLocaleString()})`);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

      // Progress update every 10 bills
      if (stats.processed % 10 === 0) {
        console.log(`\n📊 Progress: ${stats.processed}/${bills.length} bills cleaned\n`);
      }

    } catch (error: any) {
      console.error(`  ✗ Error processing ${bill.key}:`, error.message);
      stats.errors++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ SMARTBUCKET CLEANUP COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📊 Final Statistics:`);
  console.log(`   Total bills: ${stats.total}`);
  console.log(`   Processed (HTML → plain text): ${stats.processed}`);
  console.log(`   Already plain text: ${stats.alreadyPlainText}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log(`   Bytes saved: ${stats.bytesReduced.toLocaleString()}`);

  const avgReduction = stats.processed > 0 ? (stats.bytesReduced / stats.processed).toFixed(0) : 0;
  console.log(`   Average reduction: ${avgReduction} bytes/bill`);

  console.log(`\n💡 Benefits:`);
  console.log(`   ✓ Improved LLM token efficiency`);
  console.log(`   ✓ Cleaner TTS audio generation`);
  console.log(`   ✓ Reduced storage costs`);
  console.log(`   ✓ Faster content retrieval`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
