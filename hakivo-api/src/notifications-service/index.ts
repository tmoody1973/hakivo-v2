/**
 * Notifications Service
 *
 * API endpoints for managing user notifications including Federal Register alerts.
 * Integrates with the bell icon in the dashboard header.
 */

import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';

const app = new Hono<{ Bindings: Env }>();

// Middleware - use Hono's built-in CORS
app.use('*', cors());
app.use('*', logger());

// Helper to decode URL-safe base64 (used by JWTs)
function decodeBase64Url(str: string): string {
  // Convert URL-safe base64 to standard base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }
  return atob(base64);
}

// Helper to extract user ID from auth header
function getUserIdFromAuth(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('[getUserIdFromAuth] No Bearer token found');
    return null;
  }
  try {
    const token = authHeader.substring(7);
    const parts = token.split('.');
    if (parts.length < 2 || !parts[1]) {
      console.log('[getUserIdFromAuth] Invalid token structure, parts:', parts.length);
      return null;
    }
    // Use URL-safe base64 decoding for JWT payload
    const decoded = decodeBase64Url(parts[1]);
    console.log('[getUserIdFromAuth] Decoded payload:', decoded.substring(0, 200));
    const payload = JSON.parse(decoded);
    console.log('[getUserIdFromAuth] Parsed payload keys:', Object.keys(payload));
    const userId = payload.sub || payload.userId || null;
    console.log('[getUserIdFromAuth] Extracted userId:', userId);
    return userId;
  } catch (e) {
    console.error('[getUserIdFromAuth] Error decoding token:', e);
    return null;
  }
}

/**
 * GET /notifications
 * Fetch user's notifications with pagination and filters
 */
app.get('/notifications', async (c) => {
  const authHeader = c.req.header('Authorization');
  const userId = getUserIdFromAuth(authHeader);

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = c.env.APP_DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = parseInt(c.req.query('offset') || '0');
  const category = c.req.query('category'); // 'federal', 'bill', 'brief', 'all'
  const unreadOnly = c.req.query('unread') === 'true';

  try {
    // Build query based on category filter
    let whereClause = 'WHERE user_id = ?';
    const params: (string | number)[] = [userId];

    if (category === 'federal') {
      whereClause += ` AND notification_type IN ('agency_update', 'significant_action', 'comment_deadline', 'interest_match', 'executive_order', 'federal_rule')`;
    }

    if (unreadOnly) {
      whereClause += ' AND read = 0';
    }

    // Fetch federal notifications
    const federalNotifications = await db
      .prepare(`
        SELECT
          id,
          notification_type as type,
          title,
          message,
          priority,
          federal_data as federalData,
          action_url as actionUrl,
          read,
          auto_dismiss_at as autoDismissAt,
          created_at as createdAt,
          'federal' as source
        FROM federal_notifications
        ${whereClause}
        ORDER BY
          CASE priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
          END,
          created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...params, limit, offset)
      .all();

    // Also fetch from general notifications table if it exists
    let generalNotifications: { results: unknown[] } = { results: [] };
    try {
      generalNotifications = await db
        .prepare(`
          SELECT
            id,
            type,
            title,
            message,
            'normal' as priority,
            metadata as federalData,
            link as actionUrl,
            read,
            NULL as autoDismissAt,
            created_at as createdAt,
            'general' as source
          FROM notifications
          WHERE user_id = ?
          ${unreadOnly ? 'AND read = 0' : ''}
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `)
        .bind(userId, limit, offset)
        .all();
    } catch {
      // General notifications table may not exist in all environments
    }

    // Combine and sort by creation date
    const allNotifications = [
      ...(federalNotifications.results || []),
      ...(generalNotifications.results || [])
    ].sort((a: unknown, b: unknown) => {
      const aObj = a as { priority?: string; createdAt?: number };
      const bObj = b as { priority?: string; createdAt?: number };
      // Urgent first, then by date
      if (aObj.priority === 'urgent' && bObj.priority !== 'urgent') return -1;
      if (bObj.priority === 'urgent' && aObj.priority !== 'urgent') return 1;
      return (bObj.createdAt || 0) - (aObj.createdAt || 0);
    }).slice(0, limit);

    // Parse federal_data JSON for each notification
    const notifications = allNotifications.map((n: unknown) => {
      const notif = n as {
        federalData?: string | object;
        read?: number;
        createdAt?: number;
        [key: string]: unknown;
      };
      let federalData = null;
      if (notif.federalData) {
        try {
          federalData = typeof notif.federalData === 'string'
            ? JSON.parse(notif.federalData)
            : notif.federalData;
        } catch {
          federalData = null;
        }
      }
      return {
        ...notif,
        federalData,
        read: Boolean(notif.read),
        createdAt: notif.createdAt ? new Date(notif.createdAt).toISOString() : null
      };
    });

    return c.json({
      notifications,
      pagination: {
        limit,
        offset,
        hasMore: notifications.length === limit
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return c.json({ error: 'Failed to fetch notifications' }, 500);
  }
});

/**
 * GET /notifications/count
 * Get unread notification count for bell badge
 */
app.get('/notifications/count', async (c) => {
  const authHeader = c.req.header('Authorization');
  const userId = getUserIdFromAuth(authHeader);

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = c.env.APP_DB;

  try {
    // Count federal notifications
    const federalCount = await db
      .prepare(`
        SELECT COUNT(*) as count
        FROM federal_notifications
        WHERE user_id = ? AND read = 0
      `)
      .bind(userId)
      .first() as { count: number } | null;

    // Count general notifications
    let generalCount: { count: number } | null = { count: 0 };
    try {
      generalCount = await db
        .prepare(`
          SELECT COUNT(*) as count
          FROM notifications
          WHERE user_id = ? AND read = 0
        `)
        .bind(userId)
        .first() as { count: number } | null;
    } catch {
      // Table may not exist
    }

    const total = (federalCount?.count || 0) + (generalCount?.count || 0);

    // Also get counts by priority for badge styling
    const urgentCount = await db
      .prepare(`
        SELECT COUNT(*) as count
        FROM federal_notifications
        WHERE user_id = ? AND read = 0 AND priority = 'urgent'
      `)
      .bind(userId)
      .first() as { count: number } | null;

    return c.json({
      unread: total,
      urgent: urgentCount?.count || 0,
      federal: federalCount?.count || 0,
      general: generalCount?.count || 0
    });
  } catch (error) {
    console.error('Error counting notifications:', error);
    return c.json({ error: 'Failed to count notifications' }, 500);
  }
});

/**
 * POST /notifications/:id/read
 * Mark a single notification as read
 */
app.post('/notifications/:id/read', async (c) => {
  const authHeader = c.req.header('Authorization');
  const userId = getUserIdFromAuth(authHeader);

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const notificationId = c.req.param('id');
  const db = c.env.APP_DB;

  try {
    // Try federal notifications first
    const federalResult = await db
      .prepare(`
        UPDATE federal_notifications
        SET read = 1
        WHERE id = ? AND user_id = ?
      `)
      .bind(notificationId, userId)
      .run();

    if (federalResult.meta?.changes === 0) {
      // Try general notifications
      try {
        await db
          .prepare(`
            UPDATE notifications
            SET read = 1
            WHERE id = ? AND user_id = ?
          `)
          .bind(notificationId, userId)
          .run();
      } catch {
        // Table may not exist
      }
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return c.json({ error: 'Failed to mark notification as read' }, 500);
  }
});

/**
 * POST /notifications/read-all
 * Mark all notifications as read
 */
app.post('/notifications/read-all', async (c) => {
  const authHeader = c.req.header('Authorization');
  const userId = getUserIdFromAuth(authHeader);

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = c.env.APP_DB;
  const category = c.req.query('category'); // Optional: only mark certain category

  try {
    // Mark federal notifications as read
    if (!category || category === 'federal' || category === 'all') {
      await db
        .prepare(`
          UPDATE federal_notifications
          SET read = 1
          WHERE user_id = ? AND read = 0
        `)
        .bind(userId)
        .run();
    }

    // Mark general notifications as read
    if (!category || category === 'general' || category === 'all') {
      try {
        await db
          .prepare(`
            UPDATE notifications
            SET read = 1
            WHERE user_id = ? AND read = 0
          `)
          .bind(userId)
          .run();
      } catch {
        // Table may not exist
      }
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return c.json({ error: 'Failed to mark notifications as read' }, 500);
  }
});

/**
 * DELETE /notifications/:id
 * Delete a notification
 */
app.delete('/notifications/:id', async (c) => {
  const authHeader = c.req.header('Authorization');
  const userId = getUserIdFromAuth(authHeader);

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const notificationId = c.req.param('id');
  const db = c.env.APP_DB;

  try {
    // Try federal notifications first
    const federalResult = await db
      .prepare(`
        DELETE FROM federal_notifications
        WHERE id = ? AND user_id = ?
      `)
      .bind(notificationId, userId)
      .run();

    if (federalResult.meta?.changes === 0) {
      // Try general notifications
      try {
        await db
          .prepare(`
            DELETE FROM notifications
            WHERE id = ? AND user_id = ?
          `)
          .bind(notificationId, userId)
          .run();
      } catch {
        // Table may not exist
      }
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return c.json({ error: 'Failed to delete notification' }, 500);
  }
});

/**
 * GET /notifications/preferences
 * Get user's notification preferences
 */
app.get('/notifications/preferences', async (c) => {
  const authHeader = c.req.header('Authorization');
  const userId = getUserIdFromAuth(authHeader);

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = c.env.APP_DB;

  try {
    // Get user preferences
    const prefs = await db
      .prepare(`
        SELECT
          email_notifications,
          notification_email,
          notification_sms
        FROM users
        WHERE id = ?
      `)
      .bind(userId)
      .first() as { email_notifications?: number; notification_email?: number; notification_sms?: number } | null;

    // Get federal-specific preferences from user_preferences if available
    let federalPrefs = null;
    try {
      const result = await db
        .prepare(`
          SELECT federal_notification_settings
          FROM user_preferences
          WHERE user_id = ?
        `)
        .bind(userId)
        .first() as { federal_notification_settings?: string } | null;

      if (result?.federal_notification_settings) {
        federalPrefs = JSON.parse(result.federal_notification_settings);
      }
    } catch {
      // Column may not exist
    }

    return c.json({
      email: Boolean(prefs?.email_notifications ?? prefs?.notification_email ?? true),
      sms: Boolean(prefs?.notification_sms ?? false),
      federal: federalPrefs || {
        executiveOrders: true,
        finalRules: true,
        proposedRules: true,
        notices: false,
        commentDeadlines: true,
        agencyUpdates: true
      }
    });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return c.json({ error: 'Failed to fetch preferences' }, 500);
  }
});

/**
 * PUT /notifications/preferences
 * Update user's notification preferences
 */
app.put('/notifications/preferences', async (c) => {
  const authHeader = c.req.header('Authorization');
  const userId = getUserIdFromAuth(authHeader);

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = c.env.APP_DB;
  const body = await c.req.json() as {
    email?: boolean;
    sms?: boolean;
    federal?: object;
  };

  try {
    // Update email/sms preferences
    if (body.email !== undefined || body.sms !== undefined) {
      await db
        .prepare(`
          UPDATE users
          SET
            email_notifications = COALESCE(?, email_notifications),
            notification_sms = COALESCE(?, notification_sms)
          WHERE id = ?
        `)
        .bind(
          body.email !== undefined ? (body.email ? 1 : 0) : null,
          body.sms !== undefined ? (body.sms ? 1 : 0) : null,
          userId
        )
        .run();
    }

    // Update federal preferences
    if (body.federal) {
      // Check if user_preferences row exists
      const existing = await db
        .prepare('SELECT user_id FROM user_preferences WHERE user_id = ?')
        .bind(userId)
        .first();

      if (existing) {
        await db
          .prepare(`
            UPDATE user_preferences
            SET federal_notification_settings = ?
            WHERE user_id = ?
          `)
          .bind(JSON.stringify(body.federal), userId)
          .run();
      } else {
        await db
          .prepare(`
            INSERT INTO user_preferences (user_id, federal_notification_settings)
            VALUES (?, ?)
          `)
          .bind(userId, JSON.stringify(body.federal))
          .run();
      }
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return c.json({ error: 'Failed to update preferences' }, 500);
  }
});

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'notifications-service' }));

// Export handler
export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
