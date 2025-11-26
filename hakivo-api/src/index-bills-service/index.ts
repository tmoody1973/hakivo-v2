import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * Index Bills Coordinator Service
 *
 * This service coordinates bill indexing by splitting work into queue batches.
 * It does NOT process bills directly - instead it enqueues batch jobs to avoid Worker subrequest limits.
 *
 * Trigger via HTTP POST:
 *   POST https://<your-app-url>/index-bills-service
 *   Body: { "congress": 119 }  (optional, defaults to 119)
 *
 * Architecture:
 *   - This service: Counts bills, creates batch messages, enqueues to bill-indexing-queue
 *   - bill-indexing-observer: Processes each batch (20 bills), uploads to SmartBucket
 *
 * Features:
 *   - Pre-flight count and cost calculation
 *   - Queue-based processing to avoid 1,000 subrequest limit per Worker invocation
 *   - Progress tracking in database
 *   - No artificial limits - indexes ALL bills from specified congress
 */
export default class extends Service<Env> {
  // Configuration
  private readonly DEFAULT_CONGRESS = 119;
  private readonly BATCH_SIZE = 20; // Reduced from 100 to stay well under subrequest limit
  private readonly AVG_TOKENS_PER_BILL = 500; // Conservative estimate
  private readonly COST_PER_MILLION_TOKENS = 0.40; // LiquidMetal.ai pricing

  async fetch(request: Request): Promise<Response> {
    // Parse request body for congress number (optional)
    let congressNumber = this.DEFAULT_CONGRESS;

    try {
      if (request.method === 'POST') {
        const body = await request.json() as { congress?: number };
        if (body.congress) {
          congressNumber = body.congress;
        }
      }
    } catch {
      // Use default congress number if body parsing fails
    }

    try {
      const result = await this.coordinateIndexing(congressNumber);
      return new Response(
        JSON.stringify({
          success: true,
          message: result.message,
          totalBills: result.totalBills,
          batchesQueued: result.batchesQueued,
          estimatedCost: result.estimatedCost
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Service error: ${errorMsg}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }

  /**
   * Coordinate indexing by enqueueing batch jobs
   */
  private async coordinateIndexing(congressNumber: number): Promise<{
    message: string;
    totalBills: number;
    batchesQueued: number;
    estimatedCost: number;
  }> {
    console.log(`📚 ${congressNumber}th Congress Bill Indexing Coordinator\n`);
    console.log('━'.repeat(60));

    try {
      const db = this.env.APP_DB;
      const indexingQueue = this.env.BILL_INDEXING_QUEUE;

      // =================================================================
      // PHASE 1: PRE-FLIGHT CHECKS
      // =================================================================
      console.log('\n🔍 PHASE 1: Pre-Flight Checks\n');
      console.log(`📊 Counting ${congressNumber}th Congress bills in database...`);

      const countResult = await db
        .prepare('SELECT COUNT(*) as total FROM bills WHERE congress = ?')
        .bind(congressNumber)
        .first<{ total: number }>();

      const totalBills = countResult?.total || 0;

      if (totalBills === 0) {
        console.error(`\n❌ ERROR: No bills found for congress ${congressNumber}`);
        console.error('   Database may not be populated yet.');
        console.error('   Please run congress sync first.\n');
        throw new Error(`No bills found for congress ${congressNumber}`);
      }

      const estimatedCost = this.calculateCost(totalBills);

      console.log(`\n📈 Found ${totalBills} bills from ${congressNumber}th Congress`);

      // Display warning if count is unexpected
      if (totalBills > 2000) {
        console.log(`⚠️  Higher than estimated 1,500 bills - will index all ${totalBills}`);
      } else if (totalBills < 1000) {
        console.log(`ℹ️  Lower than estimated 1,500 bills - proceeding with ${totalBills}`);
      }

      console.log(`\n💰 Estimated Cost Breakdown:`);
      console.log(`   Bills to index: ${totalBills}`);
      console.log(`   Avg tokens/bill: ~${this.AVG_TOKENS_PER_BILL}`);
      console.log(`   Total tokens: ~${(totalBills * this.AVG_TOKENS_PER_BILL).toLocaleString()}`);
      console.log(`   Processing cost: $${estimatedCost}`);
      console.log(`   Vector storage: Included\n`);

      // Sample a few bills to check data quality
      console.log('🔍 Sampling bills to verify data quality...\n');

      const sampleBills = await db
        .prepare('SELECT id, title, LENGTH(text) as text_length FROM bills WHERE congress = ? LIMIT 10')
        .bind(congressNumber)
        .all<{ id: string; title: string; text_length: number }>();

      const missingTextCount = sampleBills.results.filter((b: { text_length: number | null }) => !b.text_length || b.text_length === 0).length;
      if (missingTextCount > 5) {
        console.warn(`⚠️  Warning: ${missingTextCount}/10 sampled bills missing text field`);
        console.warn('   These bills will be skipped during indexing\n');
      }

      // =================================================================
      // PHASE 2: ENQUEUE BATCH JOBS
      // =================================================================
      console.log('━'.repeat(60));
      console.log('📦 PHASE 2: Enqueueing Batch Jobs\n');

      const batchCount = Math.ceil(totalBills / this.BATCH_SIZE);
      console.log(`Creating ${batchCount} batches of ${this.BATCH_SIZE} bills each...\n`);

      // Enqueue batch jobs
      for (let offset = 0; offset < totalBills; offset += this.BATCH_SIZE) {
        const batchMessage = {
          type: 'index_batch' as const,
          congress: congressNumber,
          offset,
          limit: this.BATCH_SIZE,
          timestamp: new Date().toISOString()
        };

        await indexingQueue.send(batchMessage);
      }

      console.log(`✅ Queued ${batchCount} batches for processing`);
      console.log(`   Each batch: ${this.BATCH_SIZE} bills`);
      console.log(`   Total bills: ${totalBills}`);
      console.log(`   Estimated cost: $${estimatedCost}\n`);

      console.log('📋 Next Steps:');
      console.log('   1. Monitor queue processing via Raindrop logs');
      console.log('   2. Check indexing_progress table for status');
      console.log('   3. Verify bills in SmartBucket after completion\n');

      return {
        message: `Indexing started for Congress ${congressNumber}`,
        totalBills,
        batchesQueued: batchCount,
        estimatedCost
      };

    } catch (error) {
      console.error('\n❌ FATAL ERROR during coordination:');
      console.error(error);
      throw error;
    }
  }

  /**
   * Calculate estimated indexing cost
   */
  private calculateCost(billCount: number): number {
    const totalTokens = billCount * this.AVG_TOKENS_PER_BILL;
    const cost = (totalTokens / 1_000_000) * this.COST_PER_MILLION_TOKENS;
    return Math.round(cost * 100) / 100; // Round to 2 decimal places
  }
}
