import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * Bill Indexing Observer
 *
 * Processes batches of bills from bill-indexing-queue and uploads them to SmartBucket.
 * Handles 20 bills per invocation to stay well under the 1,000 subrequest limit.
 *
 * Uploads to LEGISLATION_SEARCH SmartBucket for semantic search + RAG capabilities.
 * The SmartBucket automatically indexes content for search(), chunkSearch(), and documentChat().
 *
 * Each batch message contains:
 * - congress: Congress number
 * - offset: Starting position for this batch
 * - limit: Number of bills to process (typically 20)
 */
export default class BillIndexingObserver extends Each<IndexingBatchMessage, Env> {
  private readonly BILLS_PER_BATCH = 20;

  async process(message: Message<IndexingBatchMessage>): Promise<void> {
    console.log('📚 Bill Indexing Observer: Processing batch');
    console.log(`   Congress: ${message.body.congress}`);
    console.log(`   Offset: ${message.body.offset}`);
    console.log(`   Limit: ${message.body.limit}`);

    const { congress, offset, limit } = message.body;
    const db = this.env.APP_DB;
    // Use SmartBucket for semantic search and RAG capabilities
    const legislationSearch = this.env.LEGISLATION_SEARCH;

    const stats = {
      indexed: 0,
      skipped: 0,
      errors: 0,
      errorBills: [] as Array<{ id: string; error: string }>
    };

    try {
      // Fetch batch of bills from database
      const batchResult = await db
        .prepare('SELECT * FROM bills WHERE congress = ? ORDER BY bill_type, bill_number LIMIT ? OFFSET ?')
        .bind(congress, limit, offset)
        .all<{
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
        }>();

      const bills = batchResult.results;

      console.log(`   Fetched ${bills.length} bills to process`);

      for (const bill of bills) {
        try {
          // Skip bills without text
          if (!bill.text || bill.text.trim().length === 0) {
            stats.skipped++;
            console.log(`   ⚠️  Skipped ${bill.id}: Missing text field`);
            continue;
          }

          // Upload to SmartBucket for semantic search indexing
          const key = this.getBillKey(bill);
          const metadata = this.getCustomMetadata(bill);

          // Create searchable document with title + text for better semantic matching
          const searchableContent = `${bill.title || ''}\n\n${bill.text}`;

          await legislationSearch.put(key, searchableContent, {
            httpMetadata: {
              contentType: 'text/plain',
              contentLanguage: 'en',
              cacheControl: 'public, max-age=86400'
            },
            customMetadata: metadata
          });

          stats.indexed++;

        } catch (error) {
          stats.errors++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          stats.errorBills.push({ id: bill.id, error: errorMsg });
          console.error(`   ❌ Failed to index ${bill.id}: ${errorMsg}`);

          // Continue with next bill - don't fail entire batch
        }
      }

      console.log(`   ✅ Batch complete: ${stats.indexed} indexed, ${stats.skipped} skipped, ${stats.errors} errors`);

      // Update indexing progress in database
      await this.updateProgress(congress, offset + stats.indexed);

    } catch (error) {
      console.error('❌ Batch processing failed:', error);
      throw error;
    }
  }

  /**
   * Format bill key for SmartBucket storage
   */
  private getBillKey(bill: { congress: number; bill_type: string; bill_number: number }): string {
    return `bills/${bill.congress}/${bill.bill_type}-${bill.bill_number}.txt`;
  }

  /**
   * Prepare custom metadata for SmartBucket
   */
  private getCustomMetadata(bill: {
    id: string;
    congress: number;
    bill_type: string;
    bill_number: number;
    title: string | null;
    sponsor_bioguide_id: string | null;
    introduced_date: string | null;
    latest_action_date: string | null;
    origin_chamber: string | null;
    update_date: string | null;
  }): Record<string, string> {
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
   * Update indexing progress in database
   */
  private async updateProgress(congress: number, processedCount: number): Promise<void> {
    const db = this.env.APP_DB;

    try {
      await db
        .prepare(`
          INSERT OR REPLACE INTO indexing_progress (
            congress, processed_bills, updated_at
          ) VALUES (?, ?, ?)
        `)
        .bind(congress, processedCount, Date.now())
        .run();
    } catch (error) {
      // Table might not exist yet - log but don't fail
      console.warn('⚠️  Could not update indexing progress (table may not exist):', error);
    }
  }
}

/**
 * Message structure for bill-indexing-queue
 */
export interface IndexingBatchMessage {
  type: 'index_batch';
  congress: number;
  offset: number;
  limit: number;
  timestamp: string;
}

// Export Body as alias for Raindrop framework
export type Body = IndexingBatchMessage;
