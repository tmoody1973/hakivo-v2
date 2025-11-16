import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import { z } from 'zod';

// Validation schemas
const DateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

/**
 * Verify JWT token from auth header
 */
async function verifyAuth(authHeader: string | undefined): Promise<{ userId: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);

    if (typeof payload.userId !== 'string') {
      return null;
    }

    return { userId: payload.userId };
  } catch (error) {
    return null;
  }
}

/**
 * Require authentication middleware
 */
async function requireAuth(c: any): Promise<{ userId: string } | Response> {
  const authHeader = c.req.header('Authorization');
  const auth = await verifyAuth(authHeader);

  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return auth;
}

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'dashboard-service', timestamp: new Date().toISOString() });
});

/**
 * GET /dashboard/overview
 * Get dashboard overview with aggregated statistics (requires auth)
 */
app.get('/dashboard/overview', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const cacheKey = `dashboard:overview:${auth.userId}`;

    // Check cache first (5 minute TTL)
    const cached = await c.env.DASHBOARD_CACHE.get(cacheKey, { type: 'json' });
    if (cached) {
      return c.json({
        success: true,
        cached: true,
        ...cached
      });
    }

    // Get tracked bills count
    const trackedBills = await db
      .prepare('SELECT COUNT(*) as count FROM bill_tracking WHERE user_id = ?')
      .bind(auth.userId)
      .first();

    // Get brief statistics
    const briefStats = await db
      .prepare(`
        SELECT
          COUNT(*) as total_briefs,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_briefs,
          SUM(CASE WHEN listened = 1 THEN 1 ELSE 0 END) as listened_briefs,
          SUM(plays) as total_plays
        FROM briefs
        WHERE user_id = ?
      `)
      .bind(auth.userId)
      .first();

    // Get chat sessions count
    const chatSessions = await db
      .prepare('SELECT COUNT(*) as count FROM chat_sessions WHERE user_id = ?')
      .bind(auth.userId)
      .first();

    // Get recent activity (last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const recentTracking = await db
      .prepare(`
        SELECT COUNT(*) as count
        FROM bill_tracking
        WHERE user_id = ? AND created_at >= ?
      `)
      .bind(auth.userId, sevenDaysAgo)
      .first();

    const recentBriefs = await db
      .prepare(`
        SELECT COUNT(*) as count
        FROM briefs
        WHERE user_id = ? AND created_at >= ?
      `)
      .bind(auth.userId, sevenDaysAgo)
      .first();

    const overview = {
      tracking: {
        totalBills: trackedBills?.count || 0,
        recentlyAdded: recentTracking?.count || 0
      },
      briefs: {
        total: briefStats?.total_briefs || 0,
        completed: briefStats?.completed_briefs || 0,
        listened: briefStats?.listened_briefs || 0,
        totalPlays: briefStats?.total_plays || 0,
        recentlyCreated: recentBriefs?.count || 0
      },
      chat: {
        totalSessions: chatSessions?.count || 0
      }
    };

    // Cache for 5 minutes
    await c.env.DASHBOARD_CACHE.put(cacheKey, JSON.stringify(overview), { expirationTtl: 300 });

    return c.json({
      success: true,
      cached: false,
      ...overview
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    return c.json({
      error: 'Failed to get dashboard overview',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /dashboard/recent-activity
 * Get recent user activity across all features (requires auth)
 */
app.get('/dashboard/recent-activity', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const limit = Number(c.req.query('limit')) || 10;

    // Get recent activities from different sources
    const activities: Array<{
      type: string;
      timestamp: number;
      data: any;
    }> = [];

    // Recent bill tracking
    const recentTracking = await db
      .prepare(`
        SELECT
          bt.created_at,
          b.congress_id,
          b.bill_type,
          b.bill_number,
          b.title
        FROM bill_tracking bt
        INNER JOIN bills b ON bt.bill_id = b.id
        WHERE bt.user_id = ?
        ORDER BY bt.created_at DESC
        LIMIT ?
      `)
      .bind(auth.userId, limit)
      .all();

    recentTracking.results?.forEach((row: any) => {
      activities.push({
        type: 'bill_tracked',
        timestamp: row.created_at,
        data: {
          congress: row.congress_id,
          billType: row.bill_type,
          billNumber: row.bill_number,
          title: row.title
        }
      });
    });

    // Recent briefs
    const recentBriefs = await db
      .prepare(`
        SELECT id, type, title, status, created_at
        FROM briefs
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .bind(auth.userId, limit)
      .all();

    recentBriefs.results?.forEach((row: any) => {
      activities.push({
        type: 'brief_created',
        timestamp: row.created_at,
        data: {
          briefId: row.id,
          briefType: row.type,
          title: row.title,
          status: row.status
        }
      });
    });

    // Recent chat sessions
    const recentChats = await db
      .prepare(`
        SELECT
          s.id,
          s.created_at,
          b.congress_id,
          b.bill_type,
          b.bill_number,
          b.title
        FROM chat_sessions s
        INNER JOIN bills b ON s.bill_id = b.id
        WHERE s.user_id = ?
        ORDER BY s.created_at DESC
        LIMIT ?
      `)
      .bind(auth.userId, limit)
      .all();

    recentChats.results?.forEach((row: any) => {
      activities.push({
        type: 'chat_started',
        timestamp: row.created_at,
        data: {
          sessionId: row.id,
          congress: row.congress_id,
          billType: row.bill_type,
          billNumber: row.bill_number,
          title: row.title
        }
      });
    });

    // Sort all activities by timestamp
    activities.sort((a, b) => b.timestamp - a.timestamp);

    return c.json({
      success: true,
      activities: activities.slice(0, limit),
      count: activities.length
    });
  } catch (error) {
    console.error('Recent activity error:', error);
    return c.json({
      error: 'Failed to get recent activity',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /dashboard/trending-bills
 * Get trending bills based on tracking and chat activity (requires auth optional)
 */
app.get('/dashboard/trending-bills', async (c) => {
  try {
    const db = c.env.APP_DB;
    const limit = Number(c.req.query('limit')) || 10;
    const cacheKey = 'dashboard:trending-bills';

    // Check cache (15 minute TTL)
    const cached = await c.env.DASHBOARD_CACHE.get(cacheKey, { type: 'json' });
    if (cached) {
      return c.json({
        success: true,
        cached: true,
        bills: cached
      });
    }

    // Calculate trending score based on recent activity (last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const trending = await db
      .prepare(`
        SELECT
          b.id,
          b.congress_id,
          b.bill_type,
          b.bill_number,
          b.title,
          b.latest_action_date,
          b.latest_action_text,
          COUNT(DISTINCT bt.user_id) as tracking_count,
          COUNT(DISTINCT cs.id) as chat_count
        FROM bills b
        LEFT JOIN bill_tracking bt ON b.id = bt.bill_id AND bt.created_at >= ?
        LEFT JOIN chat_sessions cs ON b.id = cs.bill_id AND cs.created_at >= ?
        WHERE (bt.id IS NOT NULL OR cs.id IS NOT NULL)
        GROUP BY b.id
        ORDER BY (COUNT(DISTINCT bt.user_id) * 2 + COUNT(DISTINCT cs.id)) DESC
        LIMIT ?
      `)
      .bind(sevenDaysAgo, sevenDaysAgo, limit)
      .all();

    const bills = trending.results?.map((row: any) => ({
      id: row.id,
      congress: row.congress_id,
      billType: row.bill_type,
      billNumber: row.bill_number,
      title: row.title,
      latestActionDate: row.latest_action_date,
      latestActionText: row.latest_action_text,
      trendingScore: {
        trackingCount: row.tracking_count,
        chatCount: row.chat_count
      }
    })) || [];

    // Cache for 15 minutes
    await c.env.DASHBOARD_CACHE.put(cacheKey, JSON.stringify(bills), { expirationTtl: 900 });

    return c.json({
      success: true,
      cached: false,
      bills,
      count: bills.length
    });
  } catch (error) {
    console.error('Trending bills error:', error);
    return c.json({
      error: 'Failed to get trending bills',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /dashboard/latest-actions
 * Get latest congressional actions across tracked bills (requires auth)
 */
app.get('/dashboard/latest-actions', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const limit = Number(c.req.query('limit')) || 20;

    // Get latest actions for tracked bills
    const latestActions = await db
      .prepare(`
        SELECT
          b.congress_id,
          b.bill_type,
          b.bill_number,
          b.title,
          b.latest_action_date,
          b.latest_action_text,
          ba.action_date,
          ba.action_text,
          ba.action_type
        FROM bill_tracking bt
        INNER JOIN bills b ON bt.bill_id = b.id
        LEFT JOIN bill_actions ba ON b.id = ba.bill_id
        WHERE bt.user_id = ?
        ORDER BY ba.action_date DESC
        LIMIT ?
      `)
      .bind(auth.userId, limit)
      .all();

    const actions = latestActions.results?.map((row: any) => ({
      congress: row.congress_id,
      billType: row.bill_type,
      billNumber: row.bill_number,
      title: row.title,
      actionDate: row.action_date,
      actionText: row.action_text,
      actionType: row.action_type
    })) || [];

    return c.json({
      success: true,
      actions,
      count: actions.length
    });
  } catch (error) {
    console.error('Latest actions error:', error);
    return c.json({
      error: 'Failed to get latest actions',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /dashboard/refresh-cache
 * Force refresh dashboard caches (requires auth)
 */
app.post('/dashboard/refresh-cache', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const overviewKey = `dashboard:overview:${auth.userId}`;

    // Delete cached data
    await c.env.DASHBOARD_CACHE.delete(overviewKey);
    await c.env.DASHBOARD_CACHE.delete('dashboard:trending-bills');

    console.log(`✓ Dashboard cache refreshed for user ${auth.userId}`);

    return c.json({
      success: true,
      message: 'Dashboard cache refreshed successfully'
    });
  } catch (error) {
    console.error('Cache refresh error:', error);
    return c.json({
      error: 'Failed to refresh cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
