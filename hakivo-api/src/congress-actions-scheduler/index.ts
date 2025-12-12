import { Task, Event } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

interface CongressBillAction {
  actionDate: string;
  actionCode?: string;
  text: string;
  type?: string;
}

interface CongressBill {
  congress: number;
  type: string;
  number: number;
  title: string;
  latestAction: {
    actionDate: string;
    text: string;
  };
  actions?: {
    actions: CongressBillAction[];
  };
  url?: string;
}

interface CongressBillsResponse {
  bills: CongressBill[];
}

/**
 * Congress Actions Scheduler
 *
 * Runs twice daily (6 AM and 6 PM) to fetch latest bill actions from Congress.gov API
 * Stores results in shared latest_bill_actions table for all users.
 *
 * Schedule: 0 6,18 * * * (6 AM and 6 PM every day)
 */
export default class extends Task<Env> {
  /**
   * Fetch latest bill actions from Congress.gov API
   * Stores in latest_bill_actions table (shared across all users)
   */
  async handle(_event: Event): Promise<void> {
    console.log('🏛️ Starting Congress.gov latest actions sync...');

    try {
      const apiKey = this.env.CONGRESS_API_KEY;
      if (!apiKey) {
        throw new Error('CONGRESS_API_KEY environment variable is not set');
      }

      const db = this.env.APP_DB;
      const now = Date.now();

      // Fetch recent bills with latest actions (last 7 days)
      const bills = await this.fetchRecentBills(apiKey);
      console.log(`✓ Fetched ${bills.length} recent bills from Congress.gov`);

      // Process each bill and extract latest action
      let insertedCount = 0;
      let skippedCount = 0;

      for (const bill of bills) {
        try {
          const action = bill.latestAction;
          if (!action) continue;

          // Determine chamber from bill type
          const chamber = this.getChamber(bill.type);

          // Determine status from action text
          const status = this.extractStatus(action.text);

          // Generate unique ID
          const actionId = `${bill.congress}-${bill.type}-${bill.number}-${action.actionDate}`;

          // Construct proper Congress.gov website URL (not API URL)
          const congressGovUrl = this.getCongressGovUrl(bill.congress, bill.type, bill.number);

          // Insert or update action
          const result = await db
            .prepare(`
              INSERT INTO latest_bill_actions (
                id, bill_congress, bill_type, bill_number, bill_title,
                action_date, action_code, action_text, action_type,
                latest_action_status, chamber, fetched_at, source_url
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(bill_congress, bill_type, bill_number, action_date) DO UPDATE SET
                action_text = excluded.action_text,
                latest_action_status = excluded.latest_action_status,
                fetched_at = excluded.fetched_at
            `)
            .bind(
              actionId,
              bill.congress,
              bill.type,
              bill.number,
              bill.title || 'Untitled',
              action.actionDate,
              null, // action_code (not available in summary API)
              action.text,
              null, // action_type (not available in summary API)
              status,
              chamber,
              now,
              congressGovUrl
            )
            .run();

          if (result.meta.changes > 0) {
            insertedCount++;
          } else {
            skippedCount++;
          }
        } catch (error) {
          console.warn(`Failed to process bill ${bill.type}${bill.number}:`, error);
        }
      }

      console.log(`✅ Congress actions sync complete: ${insertedCount} inserted, ${skippedCount} skipped`);

      // Clean up old actions (keep last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

      await db
        .prepare('DELETE FROM latest_bill_actions WHERE action_date < ?')
        .bind(cutoffDate)
        .run();

      console.log(`🧹 Cleaned up actions older than ${cutoffDate}`);
    } catch (error) {
      console.error('❌ Congress actions sync failed:', error);
      throw error;
    }
  }

  /**
   * Fetch recent bills from Congress.gov API
   */
  private async fetchRecentBills(apiKey: string): Promise<CongressBill[]> {
    const currentCongress = 119; // 119th Congress (2025-2026)

    // Fetch bills from last 7 days with latest actions
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7);
    const fromDateStr = fromDate.toISOString().split('T')[0];

    const url = `https://api.congress.gov/v3/bill/${currentCongress}?fromDateTime=${fromDateStr}T00:00:00Z&sort=updateDate+desc&limit=100&api_key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Congress.gov API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as CongressBillsResponse;
    return data.bills || [];
  }

  /**
   * Determine chamber from bill type
   */
  private getChamber(billType: string): string {
    const type = billType.toLowerCase();
    if (type.startsWith('h')) return 'House';
    if (type.startsWith('s')) return 'Senate';
    return 'Both';
  }

  /**
   * Extract status from action text
   */
  private extractStatus(actionText: string): string {
    const text = actionText.toLowerCase();

    // Passed statuses
    if (text.includes('passed house')) return 'Passed House';
    if (text.includes('passed senate')) return 'Passed Senate';
    if (text.includes('became law') || text.includes('signed by president')) return 'Became Law';

    // Committee statuses
    if (text.includes('referred to') || text.includes('committee')) return 'In Committee';

    // Floor action
    if (text.includes('floor') || text.includes('consideration')) return 'Floor Action';

    // Voting
    if (text.includes('vote') || text.includes('roll call')) return 'Vote Scheduled';

    // Default to introduced if no other status
    if (text.includes('introduced')) return 'Introduced';

    return 'Active';
  }

  /**
   * Construct proper Congress.gov website URL (not API URL)
   */
  private getCongressGovUrl(congress: number, billType: string, billNumber: number): string {
    // Map bill type to Congress.gov URL format
    const billTypeUrlMap: Record<string, string> = {
      'hr': 'house-bill',
      's': 'senate-bill',
      'hjres': 'house-joint-resolution',
      'sjres': 'senate-joint-resolution',
      'hconres': 'house-concurrent-resolution',
      'sconres': 'senate-concurrent-resolution',
      'hres': 'house-resolution',
      'sres': 'senate-resolution',
    };
    const urlBillType = billTypeUrlMap[billType.toLowerCase()] || billType.toLowerCase();
    return `https://www.congress.gov/bill/${congress}th-congress/${urlBillType}/${billNumber}`;
  }
}
