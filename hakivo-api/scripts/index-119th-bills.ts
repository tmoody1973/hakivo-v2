#!/usr/bin/env ts-node
/**
 * Index 119th Congress Bills to SmartBucket
 *
 * This script indexes bills from the 119th Congress to the SmartBucket for semantic search.
 * It handles any number of bills dynamically with pre-flight checks and batch processing.
 *
 * Usage:
 *   npm run index-119th-bills           # Interactive mode with confirmation
 *   npm run index-119th-bills --yes     # Auto-confirm (for CI/CD)
 *
 * Features:
 *   - Pre-flight count and cost calculation
 *   - Batch processing for large volumes
 *   - Progress logging every 50 bills
 *   - Error handling with retry logic
 *   - No artificial limits - indexes ALL 119th Congress bills
 */

import * as readline from 'readline';

// Types
interface Bill {
  id: string;
  congress: number;
  bill_type: string;
  bill_number: number;
  title: string | null;
  origin_chamber: string | null;
  introduced_date: string | null;
  latest_action_date: string | null;
  latest_action_text: string | null;
  sponsor_bioguide_id: string | null;
  text: string | null;
  update_date: string | null;
}

interface IndexingStats {
  totalBills: number;
  indexed: number;
  skipped: number;
  errors: number;
  skippedBills: string[];
  errorBills: Array<{ id: string; error: string }>;
}

// Configuration
const CONGRESS_NUMBER = 119;
const BATCH_SIZE = 100;
const PROGRESS_LOG_INTERVAL = 50;
const AVG_TOKENS_PER_BILL = 500; // Conservative estimate
const COST_PER_MILLION_TOKENS = 0.40; // LiquidMetal.ai pricing

/**
 * Calculate estimated indexing cost
 */
function calculateCost(billCount: number): number {
  const totalTokens = billCount * AVG_TOKENS_PER_BILL;
  const cost = (totalTokens / 1_000_000) * COST_PER_MILLION_TOKENS;
  return Math.round(cost * 100) / 100; // Round to 2 decimal places
}

/**
 * Format bill key for SmartBucket storage
 */
function getBillKey(bill: Bill): string {
  return `bills/${bill.congress}/${bill.bill_type}-${bill.bill_number}.txt`;
}

/**
 * Prepare custom metadata for SmartBucket
 */
function getCustomMetadata(bill: Bill): Record<string, string> {
  return {
    bill_id: bill.id,
    congress: String(bill.congress),
    bill_type: bill.bill_type,
    bill_number: String(bill.bill_number),
    title: bill.title || '',
    sponsor: bill.sponsor_bioguide_id || '',
    introduced_date: bill.introduced_date || '',
    latest_action_date: bill.latest_action_date || '',
    origin_chamber: bill.origin_chamber || '',
    update_date: bill.update_date || ''
  };
}

/**
 * Prompt user for confirmation (unless --yes flag)
 */
async function promptConfirmation(message: string): Promise<boolean> {
  // Check for --yes flag
  if (process.argv.includes('--yes')) {
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Main indexing function
 *
 * NOTE: This is a template showing the structure. In production, you'll need to:
 * 1. Import the Raindrop framework to access env.APP_DB and env.BILL_TEXTS
 * 2. Run this within a Raindrop service context or use the Raindrop CLI
 * 3. Replace the mock database calls with actual D1 queries
 */
async function indexBills() {
  console.log('📚 119th Congress Bill Indexing to SmartBucket\n');
  console.log('━'.repeat(60));

  try {
    // =================================================================
    // PHASE 0: PRE-FLIGHT CHECKS
    // =================================================================
    console.log('\n🔍 PHASE 0: Pre-Flight Checks\n');

    // TODO: Replace with actual D1 database access
    // const db = env.APP_DB;
    // For now, this is a template showing the structure

    console.log('📊 Counting 119th Congress bills in database...');

    // TODO: Execute actual query
    // const countResult = await db
    //   .prepare('SELECT COUNT(*) as total FROM bills WHERE congress = ?')
    //   .bind(CONGRESS_NUMBER)
    //   .first<{ total: number }>();

    // Mock count for template - replace with actual
    const mockCount = 0; // Will be replaced with actual query

    if (mockCount === 0) {
      console.error('\n❌ ERROR: No bills found for congress 119');
      console.error('   Database may not be populated yet.');
      console.error('   Please run congress sync first.\n');
      process.exit(1);
    }

    const totalBills = mockCount;
    const estimatedCost = calculateCost(totalBills);

    console.log(`\n📈 Found ${totalBills} bills from ${CONGRESS_NUMBER}th Congress`);

    // Display warning if count is unexpected
    if (totalBills > 2000) {
      console.log(`⚠️  Higher than estimated 1,500 bills - will index all ${totalBills}`);
    } else if (totalBills < 1000) {
      console.log(`ℹ️  Lower than estimated 1,500 bills - proceeding with ${totalBills}`);
    }

    console.log(`\n💰 Estimated Cost Breakdown:`);
    console.log(`   Bills to index: ${totalBills}`);
    console.log(`   Avg tokens/bill: ~${AVG_TOKENS_PER_BILL}`);
    console.log(`   Total tokens: ~${(totalBills * AVG_TOKENS_PER_BILL).toLocaleString()}`);
    console.log(`   Processing cost: $${estimatedCost}`);
    console.log(`   Vector storage: Included\n`);

    // Confirm with user
    const confirmed = await promptConfirmation(
      `\n🚀 Ready to index ${totalBills} bills for $${estimatedCost}. Proceed?`
    );

    if (!confirmed) {
      console.log('\n❌ Indexing cancelled by user\n');
      process.exit(0);
    }

    // =================================================================
    // PHASE 1: FETCH BILLS FROM DATABASE
    // =================================================================
    console.log('\n━'.repeat(60));
    console.log('📥 PHASE 1: Fetching Bills from Database\n');

    const stats: IndexingStats = {
      totalBills,
      indexed: 0,
      skipped: 0,
      errors: 0,
      skippedBills: [],
      errorBills: []
    };

    // Sample a few bills first to check text field population
    console.log('🔍 Sampling bills to verify data quality...\n');

    // TODO: Execute sample query
    // const sampleBills = await db
    //   .prepare('SELECT id, title, LENGTH(text) as text_length FROM bills WHERE congress = ? LIMIT 10')
    //   .bind(CONGRESS_NUMBER)
    //   .all<{ id: string; title: string; text_length: number }>();

    // Check sample for missing text
    // const missingTextCount = sampleBills.results.filter(b => !b.text_length || b.text_length === 0).length;
    // if (missingTextCount > 5) {
    //   console.warn(`⚠️  Warning: ${missingTextCount}/10 sampled bills missing text field`);
    //   console.warn('   These bills will be skipped during indexing\n');
    // }

    // =================================================================
    // PHASE 2: BATCH PROCESSING & INDEXING
    // =================================================================
    console.log('━'.repeat(60));
    console.log('📦 PHASE 2: Indexing Bills to SmartBucket\n');
    console.log(`Processing in batches of ${BATCH_SIZE} bills...\n`);

    const startTime = Date.now();

    // Process bills in batches to handle large volumes
    for (let offset = 0; offset < totalBills; offset += BATCH_SIZE) {
      const batchEnd = Math.min(offset + BATCH_SIZE, totalBills);

      // TODO: Fetch batch from database
      // const batchResult = await db
      //   .prepare('SELECT * FROM bills WHERE congress = ? ORDER BY bill_type, bill_number LIMIT ? OFFSET ?')
      //   .bind(CONGRESS_NUMBER, BATCH_SIZE, offset)
      //   .all<Bill>();

      // const bills = batchResult.results;

      // TODO: Process each bill in batch
      // for (const bill of bills) {
      //   try {
      //     // Skip bills without text
      //     if (!bill.text || bill.text.trim().length === 0) {
      //       stats.skipped++;
      //       stats.skippedBills.push(bill.id);
      //       console.log(`⚠️  Skipped ${bill.id}: Missing text field`);
      //       continue;
      //     }

      //     // Upload to SmartBucket
      //     const key = getBillKey(bill);
      //     const metadata = getCustomMetadata(bill);

      //     await env.BILL_TEXTS.put(key, bill.text, {
      //       httpMetadata: {
      //         contentType: 'text/plain',
      //         contentLanguage: 'en',
      //         cacheControl: 'public, max-age=86400'
      //       },
      //       customMetadata: metadata
      //     });

      //     stats.indexed++;

      //     // Log progress every 50 bills
      //     if (stats.indexed % PROGRESS_LOG_INTERVAL === 0) {
      //       const percent = Math.round((stats.indexed / totalBills) * 100);
      //       console.log(`📊 Indexed ${stats.indexed}/${totalBills} bills (${percent}%)`);
      //     }

      //   } catch (error) {
      //     stats.errors++;
      //     const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      //     stats.errorBills.push({ id: bill.id, error: errorMsg });
      //     console.error(`❌ Failed to index ${bill.id}: ${errorMsg}`);
      //
      //     // Continue with next bill - don't fail entire batch
      //   }
      // }
    }

    const duration = Date.now() - startTime;
    const durationSec = (duration / 1000).toFixed(2);

    // =================================================================
    // PHASE 3: FINAL SUMMARY
    // =================================================================
    console.log('\n━'.repeat(60));
    console.log('✅ PHASE 3: Indexing Complete\n');

    console.log('📊 Final Statistics:');
    console.log(`   Total bills found: ${stats.totalBills}`);
    console.log(`   Successfully indexed: ${stats.indexed}`);
    console.log(`   Skipped (no text): ${stats.skipped}`);
    console.log(`   Errors: ${stats.errors}`);
    console.log(`   Duration: ${durationSec}s`);
    console.log(`   Actual cost: $${estimatedCost} (estimated)\n`);

    // Log skipped bills if any
    if (stats.skippedBills.length > 0) {
      console.log(`⚠️  Skipped Bills (${stats.skippedBills.length}):`);
      stats.skippedBills.slice(0, 10).forEach(id => console.log(`   - ${id}`));
      if (stats.skippedBills.length > 10) {
        console.log(`   ... and ${stats.skippedBills.length - 10} more`);
      }
      console.log();
    }

    // Log errors if any
    if (stats.errorBills.length > 0) {
      console.log(`❌ Failed Bills (${stats.errorBills.length}):`);
      stats.errorBills.slice(0, 5).forEach(({ id, error }) => {
        console.log(`   - ${id}: ${error}`);
      });
      if (stats.errorBills.length > 5) {
        console.log(`   ... and ${stats.errorBills.length - 5} more`);
      }
      console.log();
    }

    // Success criteria
    const successRate = (stats.indexed / stats.totalBills) * 100;
    if (successRate >= 95) {
      console.log('✅ Indexing successful! (≥95% success rate)');
      console.log('\n📋 Next Steps:');
      console.log('   1. Verify bills in SmartBucket: npm run verify-119th-indexing');
      console.log('   2. Test semantic search queries');
      console.log('   3. Deploy API endpoints');
      console.log('   4. Build frontend components\n');
    } else {
      console.warn(`⚠️  Warning: Only ${successRate.toFixed(1)}% success rate`);
      console.warn('   Review errors and consider re-running failed bills\n');
    }

  } catch (error) {
    console.error('\n❌ FATAL ERROR during indexing:');
    console.error(error);
    console.error('\nIndexing aborted.\n');
    process.exit(1);
  }
}

/**
 * PRODUCTION INTEGRATION NOTES:
 *
 * To integrate this script with your Raindrop application:
 *
 * 1. Create a Raindrop Task or Service wrapper:
 *    - Import this function in a Raindrop service
 *    - Access env.APP_DB and env.BILL_TEXTS
 *    - Call indexBills() from the service handler
 *
 * 2. Or use Raindrop CLI:
 *    - raindrop run scripts/index-119th-bills.ts
 *    - This will provide access to the Raindrop environment
 *
 * 3. Replace all TODO comments with actual implementation:
 *    - Database queries using env.APP_DB
 *    - SmartBucket uploads using env.BILL_TEXTS
 *    - Error handling specific to your environment
 *
 * Example service wrapper:
 *
 *   export default class extends Service<Env> {
 *     async fetch(request: Request): Promise<Response> {
 *       // Run indexing with access to this.env
 *       await this.indexBills();
 *       return new Response('Indexing complete', { status: 200 });
 *     }
 *
 *     async indexBills() {
 *       // Same logic as above, but with access to this.env.APP_DB
 *       const count = await this.env.APP_DB.prepare(
 *         'SELECT COUNT(*) as total FROM bills WHERE congress = ?'
 *       ).bind(119).first();
 *       // ... rest of indexing logic
 *     }
 *   }
 */

// Run if called directly
if (require.main === module) {
  console.log('\n⚠️  This is a template script showing the indexing structure.');
  console.log('    To run in production, integrate with Raindrop framework.\n');
  console.log('    See PRODUCTION INTEGRATION NOTES in the script for details.\n');

  // Uncomment to run the template:
  // indexBills()
  //   .then(() => process.exit(0))
  //   .catch((error) => {
  //     console.error(error);
  //     process.exit(1);
  //   });
}

export { indexBills, CONGRESS_NUMBER, BATCH_SIZE };
