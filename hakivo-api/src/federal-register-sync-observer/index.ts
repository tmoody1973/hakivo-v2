import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import {
  scoreDocument,
  getSuggestedAgencies,
  type UserRelevanceProfile,
  type RelevanceScore
} from '../federal-register-client/scoring';
import type { FederalRegisterDocument } from '../federal-register-client';

/**
 * Federal Register Sync Observer
 *
 * Processes messages from the federal-register-queue to synchronize Federal Register data.
 * Fetches documents, stores in database, and triggers notifications for matched users.
 *
 * Runs daily at 6 AM ET via the federal-register-sync-scheduler task.
 */
export default class extends Each<FederalRegisterSyncMessage, Env> {
  async process(message: Message<FederalRegisterSyncMessage>): Promise<void> {
    console.log('📜 Federal Register Sync Observer: Processing sync message');
    console.log(`   Type: ${message.body.type}`);
    console.log(`   Document types: ${message.body.documentTypes?.join(', ') || 'all'}`);

    const { type, documentTypes, daysBack, agencySlug } = message.body;
    const db = this.env.APP_DB;
    const federalRegisterClient = this.env.FEDERAL_REGISTER_CLIENT;

    const syncId = crypto.randomUUID();
    const startedAt = Date.now();
    let documentsStored = 0;
    let notificationsCreated = 0;

    try {
      // Log sync start
      await db
        .prepare(`
          INSERT INTO federal_sync_log (id, sync_type, status, started_at)
          VALUES (?, ?, 'running', ?)
        `)
        .bind(syncId, type, startedAt)
        .run();

      // Determine which document types to sync
      const typesToSync = documentTypes || ['RULE', 'PRORULE', 'NOTICE', 'PRESDOCU'];

      for (const docType of typesToSync) {
        console.log(`\n📄 Syncing ${docType} documents...`);

        const result = await this.syncDocumentType(docType, daysBack || 1, agencySlug);
        documentsStored += result.stored;
        notificationsCreated += result.notifications;
      }

      // Sync comment opportunities separately
      console.log('\n💬 Syncing open comment opportunities...');
      const commentResult = await this.syncCommentOpportunities();

      // Update sync log with success
      await db
        .prepare(`
          UPDATE federal_sync_log
          SET status = 'completed',
              documents_fetched = ?,
              documents_stored = ?,
              notifications_created = ?,
              completed_at = ?
          WHERE id = ?
        `)
        .bind(
          documentsStored + commentResult.updated,
          documentsStored,
          notificationsCreated,
          Date.now(),
          syncId
        )
        .run();

      console.log(`\n✅ Federal Register sync complete`);
      console.log(`   Documents stored: ${documentsStored}`);
      console.log(`   Notifications created: ${notificationsCreated}`);
      console.log(`   Comment opportunities updated: ${commentResult.updated}`);

    } catch (error) {
      console.error('❌ Federal Register sync failed:', error);

      // Update sync log with error
      await db
        .prepare(`
          UPDATE federal_sync_log
          SET status = 'failed',
              error_message = ?,
              completed_at = ?
          WHERE id = ?
        `)
        .bind(
          error instanceof Error ? error.message : 'Unknown error',
          Date.now(),
          syncId
        )
        .run();

      throw error;
    }
  }

  /**
   * Sync documents of a specific type from Federal Register
   */
  private async syncDocumentType(
    docType: string,
    daysBack: number,
    agencySlug?: string
  ): Promise<{ stored: number; notifications: number }> {
    const db = this.env.APP_DB;
    const federalRegisterClient = this.env.FEDERAL_REGISTER_CLIENT;

    let stored = 0;
    let notifications = 0;

    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Fetch documents from Federal Register API
      const response = await federalRegisterClient.searchDocuments({
        type: [docType],
        publication_date_gte: startDateStr,
        publication_date_lte: endDateStr,
        agencies: agencySlug ? [agencySlug] : undefined,
        per_page: 100
      });

      console.log(`   Found ${response.count} ${docType} documents`);

      for (const doc of response.results) {
        try {
          // Generate UUID for document
          const docId = crypto.randomUUID();

          // Check if document already exists
          const existing = await db
            .prepare(`SELECT id FROM federal_documents WHERE document_number = ?`)
            .bind(doc.document_number)
            .first();

          if (existing) {
            console.log(`   ⏭️  Skipping existing: ${doc.document_number}`);
            continue;
          }

          // Insert document
          await db
            .prepare(`
              INSERT INTO federal_documents (
                id, document_number, type, subtype, title, abstract, action, dates,
                effective_on, publication_date, agencies, agency_names, topics,
                significant, cfr_references, docket_ids, html_url, pdf_url,
                full_text_xml_url, raw_text_url, page_length, comments_close_on,
                comment_url, start_page, end_page, synced_at, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              docId,
              doc.document_number,
              doc.type,
              doc.subtype || null,
              doc.title,
              doc.abstract || null,
              doc.action || null,
              doc.dates || null,
              doc.effective_on || null,
              doc.publication_date,
              JSON.stringify(doc.agencies || []),
              // Extract agency names from agencies array if agency_names is null
              JSON.stringify(doc.agency_names || (doc.agencies?.map((a: any) => a.name) || [])),
              JSON.stringify(doc.topics || []),
              doc.significant ? 1 : 0,
              JSON.stringify(doc.cfr_references || []),
              JSON.stringify(doc.docket_ids || []),
              doc.html_url,
              doc.pdf_url || null,
              doc.full_text_xml_url || null,
              doc.raw_text_url || null,
              doc.page_length || 0,
              doc.comments_close_on || null,
              doc.comment_url || null,
              doc.start_page || null,
              doc.end_page || null,
              Date.now(),
              Date.now(),
              Date.now()
            )
            .run();

          stored++;

          // Embed document for semantic search
          try {
            await this.env.FEDERAL_REGISTER_EMBEDDER.embedDocument(doc);
            console.log(`   🔍 Embedded for search: ${doc.document_number}`);
          } catch (embedError) {
            console.warn(`   ⚠️  Embedding failed for ${doc.document_number}:`, embedError);
          }

          // If this is a presidential document with EO number, also store in executive_orders
          if (doc.type === 'PRESDOCU' && doc.executive_order_number) {
            await this.storeExecutiveOrder(docId, doc);
          }

          // If document is open for comment, create/update comment opportunity
          if (doc.comments_close_on && doc.comment_url) {
            await this.createCommentOpportunity(docId, doc);
          }

          // Create notifications for interested users
          const notificationCount = await this.createUserNotifications(docId, doc);
          notifications += notificationCount;

          console.log(`   ✓ Stored: ${doc.document_number} - ${doc.title.substring(0, 50)}...`);

        } catch (docError) {
          console.error(`   ✗ Failed to store ${doc.document_number}:`, docError);
        }
      }

    } catch (error) {
      console.error(`   ✗ Failed to fetch ${docType} documents:`, error);
    }

    return { stored, notifications };
  }

  /**
   * Store executive order details
   */
  private async storeExecutiveOrder(documentId: string, doc: any): Promise<void> {
    const db = this.env.APP_DB;

    try {
      const eoId = crypto.randomUUID();

      await db
        .prepare(`
          INSERT INTO executive_orders (
            id, document_id, executive_order_number, president_name,
            president_identifier, signing_date, title, abstract,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          eoId,
          documentId,
          doc.executive_order_number,
          doc.president?.name || 'Unknown',
          doc.president?.identifier || 'unknown',
          doc.signing_date || null,
          doc.title,
          doc.abstract || null,
          Date.now(),
          Date.now()
        )
        .run();

      console.log(`   📜 Stored Executive Order: ${doc.executive_order_number}`);

    } catch (error) {
      console.warn(`   ⚠️  Failed to store EO ${doc.executive_order_number}:`, error);
    }
  }

  /**
   * Create or update comment opportunity
   */
  private async createCommentOpportunity(documentId: string, doc: any): Promise<void> {
    const db = this.env.APP_DB;

    try {
      const opportunityId = crypto.randomUUID();
      const closesOn = new Date(doc.comments_close_on);
      const today = new Date();
      const daysRemaining = Math.ceil((closesOn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      await db
        .prepare(`
          INSERT INTO comment_opportunities (
            id, document_id, document_number, title, agency, comment_url,
            opens_on, closes_on, days_remaining, status, synced_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            days_remaining = excluded.days_remaining,
            status = CASE WHEN excluded.days_remaining <= 0 THEN 'closed' ELSE 'open' END,
            synced_at = excluded.synced_at
        `)
        .bind(
          opportunityId,
          documentId,
          doc.document_number,
          doc.title,
          doc.agency_names?.[0] || 'Unknown Agency',
          doc.comment_url,
          doc.publication_date,
          doc.comments_close_on,
          daysRemaining,
          daysRemaining > 0 ? 'open' : 'closed',
          Date.now(),
          Date.now()
        )
        .run();

      console.log(`   💬 Comment opportunity: ${daysRemaining} days remaining`);

    } catch (error) {
      console.warn(`   ⚠️  Failed to create comment opportunity:`, error);
    }
  }

  /**
   * Create notifications for users interested in this document
   * Uses relevance scoring algorithm to determine notification priority
   */
  private async createUserNotifications(documentId: string, doc: any): Promise<number> {
    const db = this.env.APP_DB;
    let count = 0;

    // Minimum relevance score to trigger notification (0-100)
    const MIN_RELEVANCE_SCORE = 25;

    try {
      // Convert doc to FederalRegisterDocument for scoring
      // Extract agency names from agencies array if agency_names is null
      const agencyNames = doc.agency_names || (doc.agencies?.map((a: any) => a.name) || []);
      const federalDoc: FederalRegisterDocument = {
        document_number: doc.document_number,
        type: doc.type,
        subtype: doc.subtype,
        title: doc.title,
        abstract: doc.abstract,
        action: doc.action,
        publication_date: doc.publication_date,
        agencies: doc.agencies || [],
        agency_names: agencyNames,
        topics: doc.topics || [],
        significant: doc.significant,
        comments_close_on: doc.comments_close_on,
        comment_url: doc.comment_url,
        html_url: doc.html_url,
        pdf_url: doc.pdf_url,
        json_url: doc.json_url || '',
        page_length: doc.page_length || 0
      };

      // Get all users with their preferences
      const usersWithPrefs = await db
        .prepare(`
          SELECT
            u.id as user_id,
            up.policy_interests,
            GROUP_CONCAT(uaf.agency_id) as followed_agency_ids
          FROM users u
          LEFT JOIN user_preferences up ON up.user_id = u.id
          LEFT JOIN user_agency_follows uaf ON uaf.user_id = u.id AND uaf.notifications_enabled = 1
          GROUP BY u.id
        `)
        .all();

      for (const row of (usersWithPrefs.results || [])) {
        const userId = (row as any).user_id;
        const rawInterests = (row as any).policy_interests;
        const rawAgencyIds = (row as any).followed_agency_ids;

        // Parse user interests
        let policyInterests: string[] = [];
        try {
          if (rawInterests) {
            policyInterests = typeof rawInterests === 'string'
              ? JSON.parse(rawInterests)
              : rawInterests;
          }
        } catch {
          policyInterests = [];
        }

        // Parse followed agency IDs
        const followedAgencyIds: number[] = rawAgencyIds
          ? String(rawAgencyIds).split(',').map((id: string) => parseInt(id, 10)).filter((id: number) => !isNaN(id))
          : [];

        // Get agency slugs from followed agencies
        const followedAgencySlugs = getSuggestedAgencies(policyInterests);

        // Build user relevance profile
        const profile: UserRelevanceProfile = {
          policyInterests,
          followedAgencyIds,
          followedAgencySlugs
        };

        // Score the document for this user
        const score = scoreDocument(federalDoc, profile);

        // Determine notification type based on score breakdown
        let notificationType = 'interest_match';
        if (score.agencyScore === 100) {
          notificationType = 'agency_update';
        } else if (doc.significant && score.total >= 20) {
          notificationType = 'significant_action';
        } else if (score.urgencyScore >= 80 && doc.comments_close_on) {
          notificationType = 'comment_deadline';
        }

        // Only notify if score meets threshold
        if (score.total >= MIN_RELEVANCE_SCORE) {
          await this.createNotificationWithScore(
            userId,
            documentId,
            doc,
            notificationType,
            score
          );
          count++;
          console.log(`   📬 Notification for user ${userId.substring(0, 8)}... (score: ${score.total})`);
        }
      }

      // Always notify for highly significant documents (to all users who haven't been notified)
      if (doc.significant && doc.type === 'PRESDOCU') {
        const notifiedUsers = new Set<string>();

        // Get already notified users
        const alreadyNotified = await db
          .prepare(`
            SELECT DISTINCT user_id FROM federal_notifications
            WHERE document_id = ?
          `)
          .bind(documentId)
          .all();

        for (const row of (alreadyNotified.results || [])) {
          notifiedUsers.add((row as any).user_id);
        }

        // Notify remaining users for major presidential documents
        const remainingUsers = await db
          .prepare(`
            SELECT id FROM users
            WHERE id NOT IN (
              SELECT DISTINCT user_id FROM federal_notifications
              WHERE document_id = ?
            )
            LIMIT 50
          `)
          .bind(documentId)
          .all();

        for (const row of (remainingUsers.results || [])) {
          const userId = (row as any).id;
          if (!notifiedUsers.has(userId)) {
            await this.createNotification(userId, documentId, doc, 'significant_action');
            count++;
          }
        }
      }

    } catch (error) {
      console.warn(`   ⚠️  Failed to create user notifications:`, error);
    }

    return count;
  }

  /**
   * Create a notification with relevance score metadata
   */
  private async createNotificationWithScore(
    userId: string,
    documentId: string,
    doc: any,
    notificationType: string,
    score: RelevanceScore
  ): Promise<void> {
    const db = this.env.APP_DB;

    try {
      const notificationId = crypto.randomUUID();
      const docTypeLabels: Record<string, string> = {
        'RULE': 'Final Rule',
        'PRORULE': 'Proposed Rule',
        'NOTICE': 'Notice',
        'PRESDOCU': 'Presidential Document'
      };

      const typeLabel = docTypeLabels[doc.type] || doc.type;
      const title = `New ${typeLabel}: ${doc.agency_names?.[0] || 'Federal Agency'}`;
      const message = doc.title.length > 150
        ? doc.title.substring(0, 147) + '...'
        : doc.title;

      // Determine priority based on score
      let priority = 'normal';
      if (score.total >= 80 || doc.significant) {
        priority = 'high';
      } else if (score.total < 40) {
        priority = 'low';
      }

      // Check for duplicate notification
      const existing = await db
        .prepare(`
          SELECT id FROM federal_notifications
          WHERE user_id = ? AND document_id = ? AND notification_type = ?
        `)
        .bind(userId, documentId, notificationType)
        .first();

      if (existing) return;

      await db
        .prepare(`
          INSERT INTO federal_notifications (
            id, user_id, notification_type, document_id, title, message,
            priority, federal_data, action_url, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          notificationId,
          userId,
          notificationType,
          documentId,
          title,
          message,
          priority,
          JSON.stringify({
            document_number: doc.document_number,
            type: doc.type,
            agencies: doc.agency_names,
            relevance_score: score.total,
            relevance_breakdown: {
              keyword: score.keywordScore,
              agency: score.agencyScore,
              type: score.typeScore,
              urgency: score.urgencyScore
            },
            matched_keywords: score.matchedKeywords,
            matched_agencies: score.matchedAgencies,
            reason: score.reason
          }),
          doc.html_url,
          Date.now()
        )
        .run();

    } catch (error) {
      // Suppress duplicate key errors
      if (!(error instanceof Error && error.message.includes('UNIQUE'))) {
        console.warn(`   ⚠️  Failed to create scored notification for user ${userId}`);
      }
    }
  }

  /**
   * Create a notification for a specific user
   */
  private async createNotification(
    userId: string,
    documentId: string,
    doc: any,
    notificationType: string
  ): Promise<void> {
    const db = this.env.APP_DB;

    try {
      const notificationId = crypto.randomUUID();
      const docTypeLabels: Record<string, string> = {
        'RULE': 'Final Rule',
        'PRORULE': 'Proposed Rule',
        'NOTICE': 'Notice',
        'PRESDOCU': 'Presidential Document'
      };

      const typeLabel = docTypeLabels[doc.type] || doc.type;
      const title = `New ${typeLabel}: ${doc.agency_names?.[0] || 'Federal Agency'}`;
      const message = doc.title.length > 150
        ? doc.title.substring(0, 147) + '...'
        : doc.title;

      // Check for duplicate notification
      const existing = await db
        .prepare(`
          SELECT id FROM federal_notifications
          WHERE user_id = ? AND document_id = ? AND notification_type = ?
        `)
        .bind(userId, documentId, notificationType)
        .first();

      if (existing) return;

      await db
        .prepare(`
          INSERT INTO federal_notifications (
            id, user_id, notification_type, document_id, title, message,
            priority, federal_data, action_url, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          notificationId,
          userId,
          notificationType,
          documentId,
          title,
          message,
          doc.significant ? 'high' : 'normal',
          JSON.stringify({
            document_number: doc.document_number,
            type: doc.type,
            agencies: doc.agency_names
          }),
          doc.html_url,
          Date.now()
        )
        .run();

    } catch (error) {
      // Suppress duplicate key errors
      if (!(error instanceof Error && error.message.includes('UNIQUE'))) {
        console.warn(`   ⚠️  Failed to create notification for user ${userId}`);
      }
    }
  }

  /**
   * Sync open comment opportunities and update days remaining
   */
  private async syncCommentOpportunities(): Promise<{ updated: number }> {
    const db = this.env.APP_DB;
    const federalRegisterClient = this.env.FEDERAL_REGISTER_CLIENT;
    let updated = 0;

    try {
      // Fetch documents currently open for comment
      const response = await federalRegisterClient.getOpenForComment({
        closingWithinDays: 90,
        limit: 100
      });

      console.log(`   Found ${response.count} open comment opportunities`);

      for (const doc of response.results) {
        try {
          const closesOn = new Date(doc.comments_close_on!);
          const today = new Date();
          const daysRemaining = Math.ceil((closesOn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          await db
            .prepare(`
              UPDATE comment_opportunities
              SET days_remaining = ?,
                  status = CASE WHEN ? <= 0 THEN 'closed' ELSE 'open' END,
                  synced_at = ?
              WHERE document_number = ?
            `)
            .bind(daysRemaining, daysRemaining, Date.now(), doc.document_number)
            .run();

          updated++;

        } catch (error) {
          console.warn(`   ⚠️  Failed to update opportunity ${doc.document_number}`);
        }
      }

      // Close expired opportunities
      await db
        .prepare(`
          UPDATE comment_opportunities
          SET status = 'closed'
          WHERE closes_on < date('now') AND status = 'open'
        `)
        .run();

    } catch (error) {
      console.error('   ✗ Failed to sync comment opportunities:', error);
    }

    return { updated };
  }
}

/**
 * Sync message structure for federal-register-queue
 */
export interface FederalRegisterSyncMessage {
  type: 'daily_sync' | 'manual_sync' | 'initial_sync';
  timestamp: string;
  documentTypes?: ('RULE' | 'PRORULE' | 'NOTICE' | 'PRESDOCU')[];
  daysBack?: number;
  agencySlug?: string;
}

// Export Body as alias for Raindrop framework
export type Body = FederalRegisterSyncMessage;
