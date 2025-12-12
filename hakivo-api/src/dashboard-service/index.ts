import { Service, ExecutionContext } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import { z } from 'zod';
import policyInterestMapping from '../../docs/architecture/policy_interest_mapping.json';

// State abbreviation to full name mapping
const STATE_ABBREVIATIONS: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia', AS: 'American Samoa', GU: 'Guam', MP: 'Northern Mariana Islands',
  PR: 'Puerto Rico', VI: 'Virgin Islands'
};

// Validation schemas
const DateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());

// CORS middleware
app.use('*', cors());

/**
 * Verify JWT token from auth header
 */
async function verifyAuth(authHeader: string | undefined, jwtSecret: string): Promise<{ userId: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[verifyAuth] Invalid auth header format');
    return null;
  }

  const token = authHeader.substring(7);

  try {
    if (!jwtSecret) {
      console.error('[verifyAuth] JWT_SECRET not configured');
      throw new Error('JWT_SECRET not configured');
    }

    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);

    if (typeof payload.userId !== 'string') {
      console.log('[verifyAuth] No userId in token payload');
      return null;
    }

    console.log('[verifyAuth] Token verified successfully for userId:', payload.userId);
    return { userId: payload.userId };
  } catch (error) {
    console.error('[verifyAuth] Token verification failed:', error);
    return null;
  }
}

/**
 * Require authentication middleware
 */
async function requireAuth(c: any): Promise<{ userId: string } | Response> {
  const authHeader = c.req.header('Authorization');
  const jwtSecret = c.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error('[requireAuth] JWT_SECRET not available in environment');
    return c.json({ error: 'Server configuration error' }, 500);
  }

  const auth = await verifyAuth(authHeader, jwtSecret);

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

/**
 * GET /dashboard/news
 * Get personalized news articles from shared pool filtered by user's policy interests (requires auth)
 * Accepts token from query parameter or Authorization header to avoid CORS preflight
 */
app.get('/dashboard/news', async (c) => {
  try {
    console.log('[/dashboard/news] Request received');

    // Check for token in query parameter first (to avoid CORS preflight)
    const tokenParam = c.req.query('token');
    let auth;

    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[/dashboard/news] JWT_SECRET not available in environment');
      return c.json({ error: 'Server configuration error' }, 500);
    }

    if (tokenParam) {
      console.log('[/dashboard/news] Using token from query parameter');
      auth = await verifyAuth(`Bearer ${tokenParam}`, jwtSecret);
      if (!auth) {
        console.log('[/dashboard/news] Token verification failed');
        return c.json({ error: 'Unauthorized' }, 401);
      }
    } else {
      console.log('[/dashboard/news] Using token from Authorization header');
      auth = await requireAuth(c);
      if (auth instanceof Response) return auth;
    }

    const db = c.env.APP_DB;
    const limit = Number(c.req.query('limit')) || 20;

    // Get user's policy interests from user_preferences
    const userPrefs = await db
      .prepare('SELECT policy_interests FROM user_preferences WHERE user_id = ?')
      .bind(auth.userId)
      .first();

    if (!userPrefs?.policy_interests) {
      return c.json({
        success: true,
        articles: [],
        message: 'No policy interests set. Please update your preferences.'
      });
    }

    // Parse policy interests (stored as JSON string)
    const policyInterests = JSON.parse(userPrefs.policy_interests as string) as string[];

    if (policyInterests.length === 0) {
      return c.json({
        success: true,
        articles: [],
        message: 'No policy interests selected'
      });
    }

    // Build WHERE clause for interests filter
    const placeholders = policyInterests.map(() => '?').join(',');

    // Query news articles filtered by user interests with smart rotation
    // Prioritize unseen articles, then show older viewed articles
    const articles = await db
      .prepare(`
        SELECT
          n.id, n.interest, n.title, n.url, n.author, n.summary,
          n.image_url, n.published_date, n.fetched_at, n.score, n.source_domain,
          v.viewed_at
        FROM news_articles n
        LEFT JOIN user_article_views v ON n.id = v.article_id AND v.user_id = ?
        WHERE n.interest IN (${placeholders})
        ORDER BY
          CASE WHEN v.viewed_at IS NULL THEN 0 ELSE 1 END,  -- Unseen first
          n.published_date DESC,                             -- Then by recency
          n.score DESC                                       -- Then by quality
        LIMIT ?
      `)
      .bind(auth.userId, ...policyInterests, limit)
      .all();

    const formattedArticles = articles.results?.map((article: any) => ({
      id: article.id,
      interest: article.interest,
      title: article.title,
      url: article.url,
      author: article.author,
      summary: article.summary, // Use Exa's summary directly - fast and accurate
      imageUrl: article.image_url,
      publishedDate: article.published_date,
      fetchedAt: article.fetched_at,
      score: article.score,
      sourceDomain: article.source_domain
    })) || [];

    // Mark articles as viewed (async, don't wait for completion)
    if (formattedArticles.length > 0) {
      const viewedAt = Date.now();
      const viewRecords = formattedArticles.map(article => ({
        user_id: auth.userId,
        article_id: article.id,
        viewed_at: viewedAt
      }));

      // Batch insert view records (fire and forget)
      Promise.all(
        viewRecords.map(record =>
          db.prepare(
            'INSERT OR IGNORE INTO user_article_views (user_id, article_id, viewed_at) VALUES (?, ?, ?)'
          ).bind(record.user_id, record.article_id, record.viewed_at).run()
        )
      ).catch(error => {
        console.warn('Failed to track article views:', error);
      });
    }

    return c.json({
      success: true,
      articles: formattedArticles,
      count: formattedArticles.length,
      interests: policyInterests
    });
  } catch (error) {
    console.error('Get news error:', error);
    return c.json({
      error: 'Failed to get news articles',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /dashboard/news/bookmark
 * Save an article to user's bookmarks (requires auth)
 */
app.post('/dashboard/news/bookmark', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const body = await c.req.json();
    const { articleUrl, title, summary, imageUrl, interest } = body;

    if (!articleUrl || !title || !interest) {
      return c.json({
        error: 'Missing required fields: articleUrl, title, interest'
      }, 400);
    }

    const db = c.env.APP_DB;

    // Insert bookmark (ignore if duplicate)
    await db
      .prepare(`
        INSERT OR IGNORE INTO user_bookmarks (
          id, user_id, article_url, title, summary, image_url, interest, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        crypto.randomUUID(),
        auth.userId,
        articleUrl,
        title,
        summary || null,
        imageUrl || null,
        interest,
        Date.now()
      )
      .run();

    console.log(`✓ Bookmark saved for user ${auth.userId}: ${title}`);

    return c.json({
      success: true,
      message: 'Article bookmarked successfully'
    });
  } catch (error) {
    console.error('Bookmark article error:', error);
    return c.json({
      error: 'Failed to bookmark article',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * DELETE /dashboard/news/bookmark/:id
 * Remove a bookmark (requires auth)
 */
app.delete('/dashboard/news/bookmark/:id', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const bookmarkId = c.req.param('id');
    const db = c.env.APP_DB;

    // Delete bookmark (only if owned by user)
    await db
      .prepare('DELETE FROM user_bookmarks WHERE id = ? AND user_id = ?')
      .bind(bookmarkId, auth.userId)
      .run();

    console.log(`✓ Bookmark removed for user ${auth.userId}: ${bookmarkId}`);

    return c.json({
      success: true,
      message: 'Bookmark removed successfully'
    });
  } catch (error) {
    console.error('Remove bookmark error:', error);
    return c.json({
      error: 'Failed to remove bookmark',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /dashboard/news/bookmarks
 * Get user's saved bookmarks (requires auth)
 */
app.get('/dashboard/news/bookmarks', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const limit = Number(c.req.query('limit')) || 50;

    const bookmarks = await db
      .prepare(`
        SELECT
          id, article_url, title, summary, image_url, interest, created_at
        FROM user_bookmarks
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .bind(auth.userId, limit)
      .all();

    const formattedBookmarks = bookmarks.results?.map((bookmark: any) => ({
      id: bookmark.id,
      articleUrl: bookmark.article_url,
      title: bookmark.title,
      summary: bookmark.summary,
      imageUrl: bookmark.image_url,
      interest: bookmark.interest,
      createdAt: bookmark.created_at
    })) || [];

    return c.json({
      success: true,
      bookmarks: formattedBookmarks,
      count: formattedBookmarks.length
    });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    return c.json({
      error: 'Failed to get bookmarks',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /dashboard/tracked
 * Get all tracked items (federal bills, state bills, bookmarked articles) for the authenticated user
 * Unified endpoint for dashboard "Tracked Items" widget and settings page
 * Accepts token from query parameter to avoid CORS preflight
 */
app.get('/dashboard/tracked', async (c) => {
  try {
    console.log('[/dashboard/tracked] Request received');

    // Check for token in query parameter first (to avoid CORS preflight)
    const tokenParam = c.req.query('token');
    let auth;

    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[/dashboard/tracked] JWT_SECRET not available in environment');
      return c.json({ error: 'Server configuration error' }, 500);
    }

    if (tokenParam) {
      console.log('[/dashboard/tracked] Using token from query parameter');
      auth = await verifyAuth(`Bearer ${tokenParam}`, jwtSecret);
      if (!auth) {
        console.log('[/dashboard/tracked] Token verification failed');
        return c.json({ error: 'Unauthorized' }, 401);
      }
    } else {
      console.log('[/dashboard/tracked] Using token from Authorization header');
      auth = await requireAuth(c);
      if (auth instanceof Response) return auth;
    }

    const db = c.env.APP_DB;

    // Get federal tracked bills with bill details
    const federalBills = await db
      .prepare(`
        SELECT
          t.id as tracking_id, t.bill_id, t.tracked_at, t.notifications_enabled,
          b.congress, b.bill_type, b.bill_number, b.title, b.policy_area,
          b.latest_action_date, b.latest_action_text,
          m.first_name as sponsor_first_name, m.last_name as sponsor_last_name,
          m.party as sponsor_party, m.state as sponsor_state
        FROM bill_tracking t
        INNER JOIN bills b ON t.bill_id = b.id
        LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
        WHERE t.user_id = ?
        ORDER BY t.tracked_at DESC
      `)
      .bind(auth.userId)
      .all();

    // Get state tracked bills with bill details
    const stateBills = await db
      .prepare(`
        SELECT
          t.id as tracking_id, t.bill_id, t.state, t.identifier, t.tracked_at, t.notifications_enabled,
          sb.title, sb.session_identifier, sb.subjects, sb.chamber,
          sb.latest_action_date, sb.latest_action_description
        FROM state_bill_tracking t
        LEFT JOIN state_bills sb ON t.bill_id = sb.id
        WHERE t.user_id = ?
        ORDER BY t.tracked_at DESC
      `)
      .bind(auth.userId)
      .all();

    // Get bookmarked articles
    const bookmarks = await db
      .prepare(`
        SELECT
          id, article_url, title, summary, image_url, interest, created_at
        FROM user_bookmarks
        WHERE user_id = ?
        ORDER BY created_at DESC
      `)
      .bind(auth.userId)
      .all();

    // Format federal bills
    const formattedFederalBills = (federalBills.results || []).map((bill: any) => ({
      type: 'federal_bill' as const,
      trackingId: bill.tracking_id,
      billId: bill.bill_id,
      trackedAt: bill.tracked_at,
      notificationsEnabled: bill.notifications_enabled === 1,
      congress: bill.congress,
      billType: bill.bill_type,
      billNumber: bill.bill_number,
      title: bill.title,
      policyArea: bill.policy_area,
      latestActionDate: bill.latest_action_date,
      latestActionText: bill.latest_action_text,
      sponsor: bill.sponsor_first_name && bill.sponsor_last_name ? {
        firstName: bill.sponsor_first_name,
        lastName: bill.sponsor_last_name,
        party: bill.sponsor_party,
        state: bill.sponsor_state
      } : null
    }));

    // Format state bills
    const formattedStateBills = (stateBills.results || []).map((bill: any) => {
      let subjects: string[] = [];
      try {
        if (bill.subjects) {
          subjects = typeof bill.subjects === 'string' ? JSON.parse(bill.subjects) : bill.subjects;
        }
      } catch { /* ignore */ }

      return {
        type: 'state_bill' as const,
        trackingId: bill.tracking_id,
        billId: bill.bill_id,
        state: bill.state,
        stateName: STATE_ABBREVIATIONS[bill.state] || bill.state,
        identifier: bill.identifier,
        trackedAt: bill.tracked_at,
        notificationsEnabled: bill.notifications_enabled === 1,
        title: bill.title,
        session: bill.session_identifier,
        subjects,
        chamber: bill.chamber,
        latestActionDate: bill.latest_action_date,
        latestActionDescription: bill.latest_action_description
      };
    });

    // Format bookmarks
    const formattedBookmarks = (bookmarks.results || []).map((bookmark: any) => ({
      type: 'article' as const,
      bookmarkId: bookmark.id,
      articleUrl: bookmark.article_url,
      title: bookmark.title,
      summary: bookmark.summary,
      imageUrl: bookmark.image_url,
      interest: bookmark.interest,
      savedAt: bookmark.created_at
    }));

    console.log(`[/dashboard/tracked] Found ${formattedFederalBills.length} federal bills, ${formattedStateBills.length} state bills, ${formattedBookmarks.length} bookmarks`);

    return c.json({
      success: true,
      tracked: {
        federalBills: formattedFederalBills,
        stateBills: formattedStateBills,
        bookmarkedArticles: formattedBookmarks
      },
      counts: {
        federalBills: formattedFederalBills.length,
        stateBills: formattedStateBills.length,
        bookmarkedArticles: formattedBookmarks.length,
        total: formattedFederalBills.length + formattedStateBills.length + formattedBookmarks.length
      }
    });
  } catch (error) {
    console.error('Get tracked items error:', error);
    return c.json({
      error: 'Failed to get tracked items',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /dashboard/representatives
 * Get user's congressional representatives based on their state and district (requires auth)
 * Accepts token from query parameter to avoid CORS preflight
 */
app.get('/dashboard/representatives', async (c) => {
  try {
    // Get token from query parameter to avoid CORS preflight
    const tokenFromQuery = c.req.query('token');
    const authHeader = c.req.header('Authorization');
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const token = tokenFromQuery || tokenFromHeader;

    if (!token) {
      return c.json({ error: 'Unauthorized - no token provided' }, 401);
    }

    // Verify token
    console.log('[Representatives] Starting token verification');
    console.log('[Representatives] Token (first 50 chars):', token?.substring(0, 50));

    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[Representatives] JWT_SECRET not configured');
      return c.json({ error: 'JWT_SECRET not configured' }, 500);
    }

    console.log('[Representatives] JWT_SECRET exists:', !!jwtSecret);
    console.log('[Representatives] JWT_SECRET length:', jwtSecret.length);

    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(jwtSecret);
    let userId: string;

    console.log('[Representatives] About to verify JWT...');

    try {
      const { payload } = await jwtVerify(token, secret);
      console.log('[Representatives] JWT verified successfully');
      console.log('[Representatives] Payload:', payload);

      if (typeof payload.userId !== 'string') {
        console.error('[Representatives] Invalid payload - userId not a string:', payload);
        return c.json({ error: 'Unauthorized - invalid token' }, 401);
      }
      userId = payload.userId;
      console.log('[Representatives] Token is valid, userId:', userId);
    } catch (error) {
      console.error('[Representatives] Token verification error:', error);
      console.error('[Representatives] Error name:', error instanceof Error ? error.name : 'unknown');
      console.error('[Representatives] Error message:', error instanceof Error ? error.message : 'unknown');
      return c.json({
        error: 'Unauthorized - token verification failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 401);
    }

    const db = c.env.APP_DB;

    // Get user's state, district, and zipcode from user_preferences
    const userPrefs = await db
      .prepare('SELECT state, district, zipcode FROM user_preferences WHERE user_id = ?')
      .bind(userId)
      .first();

    if (!userPrefs?.state) {
      return c.json({
        success: false,
        error: 'User location not set. Please complete onboarding.'
      }, 400);
    }

    const state = userPrefs.state as string;
    const district = userPrefs.district as number | null;

    // Convert state abbreviation to full name for database query
    // Note: Database has inconsistent state values (some "VA", some "Virginia")
    // So we need to query for BOTH the abbreviation and full name
    const stateFullName = STATE_ABBREVIATIONS[state] || state;
    const stateAbbrev = state; // Keep the original abbreviation
    console.log(`[Representatives] State values: abbrev=${stateAbbrev}, full=${stateFullName}`);

    // Get senators (2 per state) - check both state formats
    const senators = await db
      .prepare(`
        SELECT
          bioguide_id,
          first_name,
          middle_name,
          last_name,
          party,
          state,
          image_url,
          office_address,
          phone_number,
          url
        FROM members
        WHERE (state = ? OR state = ?) AND district IS NULL AND current_member = 1
        ORDER BY last_name
        LIMIT 2
      `)
      .bind(stateFullName, stateAbbrev)
      .all();

    // Get representative (1 per district) - check both state formats
    let representative = null;
    if (district !== null && district !== undefined) {
      const rep = await db
        .prepare(`
          SELECT
            bioguide_id,
            first_name,
            middle_name,
            last_name,
            party,
            state,
            district,
            image_url,
            office_address,
            phone_number,
            url
          FROM members
          WHERE (state = ? OR state = ?) AND district = ? AND current_member = 1
          LIMIT 1
        `)
        .bind(stateFullName, stateAbbrev, district)
        .first();

      representative = rep;
    }

    const federalRepresentatives = [
      ...(senators.results || []),
      ...(representative ? [representative] : [])
    ].map((member: any) => ({
      bioguideId: member.bioguide_id,
      firstName: member.first_name,
      middleName: member.middle_name,
      lastName: member.last_name,
      fullName: `${member.first_name}${member.middle_name ? ' ' + member.middle_name : ''} ${member.last_name}`,
      party: member.party,
      state: member.state,
      district: member.district,
      role: member.district !== null && member.district !== undefined ? 'U.S. Representative' : 'U.S. Senator',
      imageUrl: member.image_url,
      officeAddress: member.office_address,
      phoneNumber: member.phone_number,
      url: member.url,
      initials: `${member.first_name?.charAt(0) || ''}${member.last_name?.charAt(0) || ''}`
    }));

    // Get user's state legislators using Geocodio's state legislative district lookup
    // This is more efficient than OpenStates geo API - we get districts from Geocodio and query local DB
    let stateLegislators: { results: any[] } = { results: [] };
    const zipcode = userPrefs.zipcode as string | null;

    if (zipcode) {
      try {
        console.log(`[Representatives] Looking up state legislative districts for zipcode: ${zipcode}`);
        const geocodio = c.env.GEOCODIO_CLIENT;
        const geoResult = await geocodio.lookupDistrict(zipcode);

        console.log(`[Representatives] Geocodio result:`, {
          state: geoResult.state,
          stateLegislativeHouse: geoResult.stateLegislativeHouse,
          stateLegislativeSenate: geoResult.stateLegislativeSenate
        });

        const legislators: any[] = [];

        // Query state senator by district if we have the senate district
        if (geoResult.stateLegislativeSenate) {
          const stateSenator = await db
            .prepare(`
              SELECT
                id, name, party, state, current_role_title, current_role_district,
                current_role_chamber, image_url, email
              FROM state_legislators
              WHERE state = ? AND current_role_chamber = 'upper' AND current_role_district = ?
              LIMIT 1
            `)
            .bind(stateAbbrev, geoResult.stateLegislativeSenate)
            .first();

          if (stateSenator) {
            legislators.push(stateSenator);
            console.log(`[Representatives] Found state senator: ${stateSenator.name} (District ${geoResult.stateLegislativeSenate})`);
          } else {
            console.log(`[Representatives] No state senator found for ${stateAbbrev} district ${geoResult.stateLegislativeSenate}`);
          }
        }

        // Query state representative by district if we have the house district
        if (geoResult.stateLegislativeHouse) {
          const stateRep = await db
            .prepare(`
              SELECT
                id, name, party, state, current_role_title, current_role_district,
                current_role_chamber, image_url, email
              FROM state_legislators
              WHERE state = ? AND current_role_chamber = 'lower' AND current_role_district = ?
              LIMIT 1
            `)
            .bind(stateAbbrev, geoResult.stateLegislativeHouse)
            .first();

          if (stateRep) {
            legislators.push(stateRep);
            console.log(`[Representatives] Found state rep: ${stateRep.name} (District ${geoResult.stateLegislativeHouse})`);
          } else {
            console.log(`[Representatives] No state rep found for ${stateAbbrev} district ${geoResult.stateLegislativeHouse}`);
          }
        }

        if (legislators.length > 0) {
          stateLegislators = { results: legislators };
          console.log(`[Representatives] Found ${legislators.length} state legislators via district lookup`);
        }
      } catch (geoError) {
        console.warn(`[Representatives] Geocodio lookup failed:`, geoError);
      }
    }

    // Fallback: If district lookup failed or found no results, get sample legislators for the state
    if (stateLegislators.results.length === 0) {
      console.log(`[Representatives] Using fallback state-based query for ${stateAbbrev}`);
      const stateSenator = await db
        .prepare(`
          SELECT
            id, name, party, state, current_role_title, current_role_district,
            current_role_chamber, image_url, email
          FROM state_legislators
          WHERE state = ? AND current_role_chamber = 'upper'
          ORDER BY name
          LIMIT 1
        `)
        .bind(stateAbbrev)
        .first();

      const stateRep = await db
        .prepare(`
          SELECT
            id, name, party, state, current_role_title, current_role_district,
            current_role_chamber, image_url, email
          FROM state_legislators
          WHERE state = ? AND current_role_chamber = 'lower'
          ORDER BY name
          LIMIT 1
        `)
        .bind(stateAbbrev)
        .first();

      stateLegislators = {
        results: [stateSenator, stateRep].filter(Boolean)
      };
    }

    const formattedStateLegislators = (stateLegislators.results || []).map((legislator: any) => {
      // Parse name into first and last
      const nameParts = legislator.name?.split(' ') || ['', ''];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        id: legislator.id,
        name: legislator.name,
        firstName,
        lastName,
        fullName: legislator.name,
        party: legislator.party,
        state: legislator.state,
        district: legislator.current_role_district,
        role: legislator.current_role_title || (legislator.current_role_chamber === 'upper' ? 'State Senator' : 'State Representative'),
        chamber: legislator.current_role_chamber,
        imageUrl: legislator.image_url,
        email: legislator.email,
        initials: `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`
      };
    });

    return c.json({
      success: true,
      representatives: federalRepresentatives,
      stateLegislators: formattedStateLegislators,
      userLocation: {
        state,
        district
      }
    });
  } catch (error) {
    console.error('Representatives error:', error);
    return c.json({
      error: 'Failed to get representatives',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /admin/clear-news
 * Clear all news articles from database
 * (Temporary endpoint for testing)
 */
app.post('/admin/clear-news', async (c) => {
  console.log('🗑️  Clearing news articles...');

  try {
    const db = c.env.APP_DB;
    const result = await db.prepare('DELETE FROM news_articles').run();

    console.log(`✅ Cleared ${result.meta.changes} articles`);

    return c.json({
      success: true,
      message: 'News articles cleared',
      deletedCount: result.meta.changes
    });
  } catch (error) {
    console.error('Clear news error:', error);
    return c.json({
      error: 'Failed to clear news articles',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /admin/sync-news
 * Manual trigger to sync news articles from Exa.ai
 * (Temporary endpoint for immediate database population)
 */
app.post('/admin/sync-news', async (c) => {
  console.log('📰 Manual News Sync: Starting...');
  const startTime = Date.now();

  try {
    const db = c.env.APP_DB;
    const exaClient = c.env.EXA_CLIENT;

    let totalArticles = 0;
    let successfulSyncs = 0;
    const errors: Array<{ interest: string; error: string }> = [];

    // Define date range (last 14 days for fresh news)
    const endDate = new Date();
    const startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    console.log(`📅 Fetching news from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Iterate through all 12 policy interests
    for (const mapping of policyInterestMapping) {
      const { interest, keywords } = mapping;

      console.log(`🔍 Syncing: ${interest}`);
      console.log(`   Keywords: ${keywords.slice(0, 3).join(', ')}...`);

      try {
        // Call Exa.ai search with keywords from mapping
        const results = await exaClient.searchNews(
          keywords,
          startDate,
          endDate,
          20 // Fetch 20 articles per interest
        );

        console.log(`   Found ${results.length} articles`);

        // Store each article in news_articles table
        for (const article of results) {
          try {
            // Extract domain from URL
            const url = new URL(article.url);
            const sourceDomain = url.hostname.replace('www.', '');

            // Insert article (ignore if duplicate URL - relies on unique constraint)
            await db
              .prepare(`
                INSERT OR IGNORE INTO news_articles (
                  id, interest, title, url, author, summary, text,
                  image_url, published_date, fetched_at, score, source_domain
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `)
              .bind(
                crypto.randomUUID(),
                interest,
                article.title,
                article.url,
                article.author,
                article.summary,
                article.text,
                article.imageUrl,
                article.publishedDate,
                Date.now(),
                article.score,
                sourceDomain
              )
              .run();

            totalArticles++;
          } catch (error) {
            console.warn(`   ⚠️ Failed to store article: ${article.title}`, error);
          }
        }

        successfulSyncs++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`   ❌ Failed to sync ${interest}:`, errorMsg);
        errors.push({ interest, error: errorMsg });
      }
    }

    const duration = Date.now() - startTime;

    console.log('✅ Manual news sync completed');
    console.log(`   Total articles stored: ${totalArticles}`);
    console.log(`   Successful syncs: ${successfulSyncs}/${policyInterestMapping.length}`);
    console.log(`   Failed syncs: ${errors.length}`);
    console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);

    return c.json({
      success: true,
      message: 'News sync completed',
      stats: {
        totalArticles,
        successfulSyncs,
        totalInterests: policyInterestMapping.length,
        failedSyncs: errors.length,
        duration: `${(duration / 1000).toFixed(2)}s`,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error('❌ Manual news sync failed:', error);
    return c.json({
      error: 'News sync failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /admin/clear-news
 * Clear all news articles from database
 * (Admin endpoint for testing)
 */
app.post('/admin/clear-news', async (c) => {
  console.log('🗑️  Clearing news articles...');

  try {
    const db = c.env.APP_DB;

    const result = await db
      .prepare('DELETE FROM news_articles')
      .run();

    console.log(`✅ Cleared ${result.meta.changes} articles`);

    return c.json({
      success: true,
      message: 'News articles cleared',
      deletedCount: result.meta.changes
    });

  } catch (error) {
    console.error('❌ Failed to clear news articles:', error);
    return c.json({
      error: 'Clear failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /admin/news-stats
 * Get article counts per interest
 * (Admin endpoint for debugging)
 */
app.get('/admin/news-stats', async (c) => {
  try {
    const db = c.env.APP_DB;

    const result = await db
      .prepare(`
        SELECT
          interest,
          COUNT(*) as article_count,
          MIN(published_date) as oldest_article,
          MAX(published_date) as newest_article
        FROM news_articles
        GROUP BY interest
        ORDER BY article_count DESC
      `)
      .all();

    const totalResult = await db
      .prepare('SELECT COUNT(*) as total FROM news_articles')
      .first();

    return c.json({
      success: true,
      totalArticles: totalResult?.total || 0,
      byInterest: result.results
    });

  } catch (error) {
    console.error('❌ Failed to get news stats:', error);
    return c.json({
      error: 'Stats failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /admin/clear-news-by-interest
 * Clear news articles for a specific interest
 * (Admin endpoint for refreshing specific interests)
 */
app.post('/admin/clear-news-by-interest', async (c) => {
  try {
    const { interest } = await c.req.json();

    if (!interest) {
      return c.json({ error: 'Interest parameter required' }, 400);
    }

    console.log(`🗑️  Clearing news articles for interest: ${interest}`);

    const db = c.env.APP_DB;
    const result = await db
      .prepare('DELETE FROM news_articles WHERE interest = ?')
      .bind(interest)
      .run();

    console.log(`✅ Cleared ${result.meta.changes} articles for ${interest}`);

    return c.json({
      success: true,
      message: `News articles cleared for ${interest}`,
      deletedCount: result.meta.changes
    });

  } catch (error) {
    console.error('❌ Failed to clear news by interest:', error);
    return c.json({
      error: 'Clear failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /latest-actions?limit=20
 * Get latest bill actions from Congress.gov
 * Returns recent legislative activity, updated twice daily
 * Includes inDatabase flag to indicate if bill can be viewed with full details
 */
app.get('/latest-actions', async (c) => {
  console.log('📋 Fetching latest bill actions...');

  try {
    const db = c.env.APP_DB;

    // Get limit from query params (default: 20)
    const limit = parseInt(c.req.query('limit') || '20', 10);

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return c.json({
        error: 'Invalid limit parameter',
        message: 'Limit must be between 1 and 100'
      }, 400);
    }

    // Query latest actions with join to check if bill exists in bills table
    const actions = await db
      .prepare(`
        SELECT
          la.id, la.bill_congress, la.bill_type, la.bill_number, la.bill_title,
          la.action_date, la.action_text, la.latest_action_status, la.chamber,
          la.source_url, la.fetched_at,
          CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END as in_database,
          b.id as db_bill_id
        FROM latest_bill_actions la
        LEFT JOIN bills b ON
          b.congress = la.bill_congress AND
          b.bill_type = la.bill_type AND
          b.bill_number = la.bill_number
        ORDER BY la.action_date DESC, la.fetched_at DESC
        LIMIT ?
      `)
      .bind(limit)
      .all();

    if (!actions.results || actions.results.length === 0) {
      console.log('⚠️  No bill actions found in database');
      return c.json({
        actions: [],
        message: 'No actions available yet. Background sync will populate data at 6 AM and 6 PM.'
      });
    }

    console.log(`✅ Found ${actions.results.length} bill actions`);

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

    // Format the actions for frontend consumption
    const formattedActions = actions.results.map((action: any) => {
      // Always construct proper Congress.gov website URL (not API URL)
      const urlBillType = billTypeUrlMap[action.bill_type.toLowerCase()] || action.bill_type.toLowerCase();
      const congressGovUrl = `https://www.congress.gov/bill/${action.bill_congress}th-congress/${urlBillType}/${action.bill_number}`;

      return {
        id: action.id,
        bill: {
          congress: action.bill_congress,
          type: action.bill_type,
          number: action.bill_number,
          title: action.bill_title,
          url: congressGovUrl, // Use constructed URL, not source_url from DB
          // Include database info so frontend knows it can link to detail page
          inDatabase: action.in_database === 1,
          dbBillId: action.db_bill_id || null
        },
        action: {
          date: action.action_date,
          text: action.action_text,
          status: action.latest_action_status
        },
        chamber: action.chamber,
        fetchedAt: action.fetched_at
      };
    });

    return c.json({
      actions: formattedActions,
      count: formattedActions.length,
      lastUpdated: formattedActions[0]?.fetchedAt || null
    });

  } catch (error) {
    console.error('❌ Failed to fetch latest actions:', error);
    return c.json({
      error: 'Failed to fetch latest actions',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /dashboard/bills
 * Get personalized bills based on user's policy interests (requires auth)
 */
app.get('/dashboard/bills', async (c) => {
  try {
    console.log('[/dashboard/bills] Request received');

    // Check for token in query parameter first (to avoid CORS preflight)
    const tokenParam = c.req.query('token');
    let auth;

    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[/dashboard/bills] JWT_SECRET not available in environment');
      return c.json({ error: 'Server configuration error' }, 500);
    }

    if (tokenParam) {
      console.log('[/dashboard/bills] Using token from query parameter');
      auth = await verifyAuth(`Bearer ${tokenParam}`, jwtSecret);
      if (!auth) {
        console.log('[/dashboard/bills] Token verification failed');
        return c.json({ error: 'Unauthorized' }, 401);
      }
    } else {
      console.log('[/dashboard/bills] Using token from Authorization header');
      auth = await requireAuth(c);
      if (auth instanceof Response) return auth;
    }

    const db = c.env.APP_DB;
    const limit = Number(c.req.query('limit')) || 20;

    // Get user's policy interests from user_preferences
    const userPrefs = await db
      .prepare('SELECT policy_interests FROM user_preferences WHERE user_id = ?')
      .bind(auth.userId)
      .first();

    if (!userPrefs?.policy_interests) {
      return c.json({
        success: true,
        bills: [],
        message: 'No policy interests set. Please update your preferences.'
      });
    }

    // Parse policy interests (stored as JSON string)
    const userInterests = JSON.parse(userPrefs.policy_interests as string) as string[];

    if (userInterests.length === 0) {
      return c.json({
        success: true,
        bills: [],
        message: 'No policy interests selected'
      });
    }

    // Map user interests to actual Congress.gov policy_area values
    const policyAreas: string[] = [];
    for (const interest of userInterests) {
      const mapping = policyInterestMapping.find(m => m.interest === interest);
      if (mapping) {
        policyAreas.push(...mapping.policy_areas);
      }
    }

    if (policyAreas.length === 0) {
      console.warn('[/dashboard/bills] No policy areas mapped for user interests:', userInterests);
      return c.json({
        success: true,
        bills: [],
        message: 'No matching policy areas found'
      });
    }

    console.log(`[/dashboard/bills] User interests: ${userInterests.join(', ')}`);
    console.log(`[/dashboard/bills] Mapped to ${policyAreas.length} policy areas: ${policyAreas.join(', ')}`);

    // Build WHERE clause for policy areas filter
    const placeholders = policyAreas.map(() => '?').join(',');

    // Query bills filtered by user interests, excluding already-seen bills
    // JOIN with bill_enrichment to include AI-generated summaries
    const bills = await db
      .prepare(`
        SELECT
          b.id, b.congress, b.bill_type, b.bill_number, b.title,
          b.policy_area, b.introduced_date, b.latest_action_date,
          b.latest_action_text, b.origin_chamber, b.update_date,
          m.first_name as sponsor_first_name, m.last_name as sponsor_last_name,
          m.party as sponsor_party, m.state as sponsor_state,
          be.plain_language_summary, be.key_points, be.reading_time_minutes,
          be.impact_level, be.bipartisan_score, be.current_stage,
          be.progress_percentage, be.tags, be.enriched_at, be.model_used
        FROM bills b
        LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
        LEFT JOIN bill_enrichment be ON b.id = be.bill_id
        LEFT JOIN user_bill_views ubv
          ON b.id = ubv.bill_id AND ubv.user_id = ?
        WHERE b.policy_area IN (${placeholders})
          AND ubv.bill_id IS NULL  -- Exclude bills user has already seen
        ORDER BY b.latest_action_date DESC, b.update_date DESC
        LIMIT ?
      `)
      .bind(auth.userId, ...policyAreas, limit)
      .all();

    const formattedBills = bills.results?.map((bill: any) => ({
      id: bill.id,
      congress: bill.congress,
      billType: bill.bill_type,
      billNumber: bill.bill_number,
      title: bill.title,
      policyArea: bill.policy_area,
      introducedDate: bill.introduced_date,
      latestActionDate: bill.latest_action_date,
      latestActionText: bill.latest_action_text,
      originChamber: bill.origin_chamber,
      updateDate: bill.update_date,
      sponsor: bill.sponsor_first_name && bill.sponsor_last_name ? {
        firstName: bill.sponsor_first_name,
        lastName: bill.sponsor_last_name,
        party: bill.sponsor_party,
        state: bill.sponsor_state
      } : null,
      // AI enrichment data (null if not yet enriched)
      enrichment: bill.plain_language_summary ? {
        plainLanguageSummary: bill.plain_language_summary,
        keyPoints: bill.key_points ? JSON.parse(bill.key_points as string) : [],
        readingTimeMinutes: bill.reading_time_minutes,
        impactLevel: bill.impact_level,
        bipartisanScore: bill.bipartisan_score,
        currentStage: bill.current_stage,
        progressPercentage: bill.progress_percentage,
        tags: bill.tags ? JSON.parse(bill.tags as string) : [],
        enrichedAt: bill.enriched_at,
        modelUsed: bill.model_used
      } : null
    })) || [];

    // Send unenriched bills to enrichment queue (fire and forget)
    const unenrichedBills = formattedBills.filter(b => !b.enrichment);
    if (unenrichedBills.length > 0) {
      const enrichmentQueue = c.env.ENRICHMENT_QUEUE;
      Promise.all(
        unenrichedBills.map(bill =>
          enrichmentQueue.send({
            type: 'enrich_bill',
            bill_id: bill.id,
            timestamp: new Date().toISOString()
          })
        )
      ).catch((error: any) => {
        console.warn('Failed to queue bill enrichment:', error);
      });
      console.log(`📤 Queued ${unenrichedBills.length} bills for enrichment`);
    }

    // Mark bills as viewed (async, don't wait for completion)
    if (formattedBills.length > 0) {
      const viewedAt = Date.now();
      const viewRecords = formattedBills.map(bill => ({
        user_id: auth.userId,
        bill_id: bill.id,
        viewed_at: viewedAt
      }));

      // Batch insert view records (fire and forget)
      Promise.all(
        viewRecords.map(record =>
          db.prepare(
            'INSERT OR IGNORE INTO user_bill_views (user_id, bill_id, viewed_at) VALUES (?, ?, ?)'
          ).bind(record.user_id, record.bill_id, record.viewed_at).run()
        )
      ).catch(error => {
        console.warn('Failed to track bill views:', error);
      });
    }

    return c.json({
      success: true,
      bills: formattedBills,
      count: formattedBills.length,
      interests: userInterests
    });
  } catch (error) {
    console.error('Get bills error:', error);
    return c.json({
      error: 'Failed to get bills',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /dashboard/bills/bookmark
 * Save a bill to user's bookmarks (requires auth)
 */
app.post('/dashboard/bills/bookmark', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const body = await c.req.json();
    const { billId, title, policyArea, latestActionText, latestActionDate } = body;

    if (!billId || !title || !policyArea) {
      return c.json({
        error: 'Missing required fields: billId, title, policyArea'
      }, 400);
    }

    const db = c.env.APP_DB;

    // Generate unique ID for bookmark
    const bookmarkId = `${auth.userId}-${billId}`;

    // Insert bookmark (ignore if duplicate)
    await db
      .prepare(`
        INSERT OR IGNORE INTO user_bill_bookmarks (
          id, user_id, bill_id, title, policy_area,
          latest_action_text, latest_action_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        bookmarkId,
        auth.userId,
        billId,
        title,
        policyArea,
        latestActionText || null,
        latestActionDate || null,
        Date.now()
      )
      .run();

    return c.json({
      success: true,
      message: 'Bill bookmarked successfully',
      bookmarkId
    });
  } catch (error) {
    console.error('Bookmark bill error:', error);
    return c.json({
      error: 'Failed to bookmark bill',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /dashboard/bills/bookmarks
 * Get user's bookmarked bills (requires auth)
 */
app.get('/dashboard/bills/bookmarks', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;

    const bookmarks = await db
      .prepare(`
        SELECT
          ubb.id, ubb.bill_id, ubb.title, ubb.policy_area,
          ubb.latest_action_text, ubb.latest_action_date, ubb.created_at,
          b.congress, b.bill_type, b.bill_number, b.origin_chamber
        FROM user_bill_bookmarks ubb
        LEFT JOIN bills b ON ubb.bill_id = b.id
        WHERE ubb.user_id = ?
        ORDER BY ubb.created_at DESC
      `)
      .bind(auth.userId)
      .all();

    const formattedBookmarks = bookmarks.results?.map((bookmark: any) => ({
      id: bookmark.id,
      billId: bookmark.bill_id,
      title: bookmark.title,
      policyArea: bookmark.policy_area,
      latestActionText: bookmark.latest_action_text,
      latestActionDate: bookmark.latest_action_date,
      createdAt: bookmark.created_at,
      congress: bookmark.congress,
      billType: bookmark.bill_type,
      billNumber: bookmark.bill_number,
      originChamber: bookmark.origin_chamber
    })) || [];

    return c.json({
      success: true,
      bookmarks: formattedBookmarks,
      count: formattedBookmarks.length
    });
  } catch (error) {
    console.error('Get bill bookmarks error:', error);
    return c.json({
      error: 'Failed to get bookmarks',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /bills/:id
 * Get detailed bill information with AI analysis (requires auth optional for basic info)
 */
app.get('/bills/:id', async (c) => {
  try {
    // Require authentication
    const auth = await requireAuth(c);
    if (auth instanceof Response) {
      return auth;
    }

    const billId = c.req.param('id');
    const db = c.env.APP_DB;

    console.log(`[/bills/${billId}] Fetching bill details for user ${auth.userId}`);

    // Get complete bill information with enrichment and deep analysis
    const bill = await db
      .prepare(`
        SELECT
          b.id, b.congress, b.bill_type, b.bill_number, b.title,
          b.policy_area, b.introduced_date, b.latest_action_date,
          b.latest_action_text, b.origin_chamber, b.update_date,
          b.sponsor_bioguide_id,
          m.first_name as sponsor_first_name, m.last_name as sponsor_last_name,
          m.party as sponsor_party, m.state as sponsor_state,
          be.plain_language_summary, be.key_points, be.reading_time_minutes,
          be.impact_level, be.bipartisan_score, be.current_stage,
          be.progress_percentage, be.tags as enrichment_tags, be.enriched_at, be.model_used,
          be.status as enrichment_status, be.started_at as enrichment_started, be.completed_at as enrichment_completed,
          ba.executive_summary, ba.status_quo_vs_change, ba.section_breakdown,
          ba.mechanism_of_action, ba.agency_powers, ba.fiscal_impact,
          ba.stakeholder_impact, ba.unintended_consequences, ba.arguments_for,
          ba.arguments_against, ba.implementation_challenges, ba.passage_likelihood,
          ba.passage_reasoning, ba.recent_developments, ba.state_impacts,
          ba.thinking_summary, ba.analyzed_at, ba.model_used as analysis_model_used,
          ba.status as analysis_status, ba.started_at as analysis_started, ba.completed_at as analysis_completed
        FROM bills b
        LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
        LEFT JOIN bill_enrichment be ON b.id = be.bill_id
        LEFT JOIN bill_analysis ba ON b.id = ba.bill_id
        WHERE b.id = ?
        LIMIT 1
      `)
      .bind(billId)
      .first();

    if (!bill) {
      return c.json({
        error: 'Bill not found',
        message: `No bill found with ID: ${billId}`
      }, 404);
    }

    const response = {
      success: true,
      bill: {
        id: bill.id,
        congress: bill.congress,
        billType: bill.bill_type,
        billNumber: bill.bill_number,
        title: bill.title,
        policyArea: bill.policy_area,
        introducedDate: bill.introduced_date,
        latestActionDate: bill.latest_action_date,
        latestActionText: bill.latest_action_text,
        originChamber: bill.origin_chamber,
        updateDate: bill.update_date,
        sponsor: bill.sponsor_first_name && bill.sponsor_last_name ? {
          bioguideId: bill.sponsor_bioguide_id,
          firstName: bill.sponsor_first_name,
          lastName: bill.sponsor_last_name,
          fullName: `${bill.sponsor_first_name} ${bill.sponsor_last_name}`,
          party: bill.sponsor_party,
          state: bill.sponsor_state
        } : null,
        // Basic enrichment (for bill cards)
        enrichment: bill.plain_language_summary ? {
          plainLanguageSummary: bill.plain_language_summary,
          keyPoints: bill.key_points ? JSON.parse(bill.key_points as string) : [],
          readingTimeMinutes: bill.reading_time_minutes,
          impactLevel: bill.impact_level,
          bipartisanScore: bill.bipartisan_score,
          currentStage: bill.current_stage,
          progressPercentage: bill.progress_percentage,
          tags: bill.enrichment_tags ? JSON.parse(bill.enrichment_tags as string) : [],
          enrichedAt: bill.enriched_at,
          modelUsed: bill.model_used,
          status: bill.enrichment_status || 'pending',
          startedAt: bill.enrichment_started,
          completedAt: bill.enrichment_completed
        } : bill.enrichment_status ? {
          // Return status even if enrichment not complete yet
          status: bill.enrichment_status,
          startedAt: bill.enrichment_started,
          completedAt: bill.enrichment_completed
        } : null,
        // Deep forensic analysis
        analysis: bill.executive_summary ? {
          executiveSummary: bill.executive_summary,
          statusQuoVsChange: bill.status_quo_vs_change,
          sectionBreakdown: bill.section_breakdown ? JSON.parse(bill.section_breakdown as string) : [],
          mechanismOfAction: bill.mechanism_of_action,
          agencyPowers: bill.agency_powers ? JSON.parse(bill.agency_powers as string) : [],
          fiscalImpact: bill.fiscal_impact ? JSON.parse(bill.fiscal_impact as string) : null,
          stakeholderImpact: bill.stakeholder_impact ? JSON.parse(bill.stakeholder_impact as string) : null,
          unintendedConsequences: bill.unintended_consequences ? JSON.parse(bill.unintended_consequences as string) : [],
          argumentsFor: bill.arguments_for ? JSON.parse(bill.arguments_for as string) : [],
          argumentsAgainst: bill.arguments_against ? JSON.parse(bill.arguments_against as string) : [],
          implementationChallenges: bill.implementation_challenges ? JSON.parse(bill.implementation_challenges as string) : [],
          passageLikelihood: bill.passage_likelihood,
          passageReasoning: bill.passage_reasoning,
          recentDevelopments: bill.recent_developments ? JSON.parse(bill.recent_developments as string) : [],
          stateImpacts: bill.state_impacts ? JSON.parse(bill.state_impacts as string) : null,
          thinkingSummary: bill.thinking_summary,
          analyzedAt: bill.analyzed_at,
          modelUsed: bill.analysis_model_used,
          status: bill.analysis_status || 'pending',
          startedAt: bill.analysis_started,
          completedAt: bill.analysis_completed
        } : bill.analysis_status ? {
          // Return status even if analysis not complete yet
          status: bill.analysis_status,
          startedAt: bill.analysis_started,
          completedAt: bill.analysis_completed
        } : null
      }
    };

    // Queue enrichment if basic summary not available
    if (!bill.plain_language_summary) {
      const enrichmentQueue = c.env.ENRICHMENT_QUEUE;
      enrichmentQueue.send({
        type: 'enrich_bill',
        bill_id: billId,
        timestamp: new Date().toISOString()
      }).catch((error: any) => {
        console.warn('Failed to queue bill enrichment:', error);
      });
      console.log(`📤 Queued bill ${billId} for enrichment`);
    }

    // Queue deep analysis if not available
    if (!bill.executive_summary) {
      const enrichmentQueue = c.env.ENRICHMENT_QUEUE;
      enrichmentQueue.send({
        type: 'deep_analysis_bill',
        bill_id: billId,
        timestamp: new Date().toISOString()
      }).catch((error: any) => {
        console.warn('Failed to queue bill deep analysis:', error);
      });
      console.log(`📤 Queued bill ${billId} for deep analysis`);
    }

    return c.json(response);
  } catch (error) {
    console.error('Get bill detail error:', error);
    return c.json({
      error: 'Failed to get bill details',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Admin endpoint to manually trigger news sync
 * POST /admin/trigger-news-sync
 */
app.post('/admin/trigger-news-sync', async (c) => {
  try {
    const auth = await verifyAuth(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log('🔧 [ADMIN] Manually triggering news sync...');

    // Import and instantiate the news-sync-scheduler
    const NewsSyncScheduler = (await import('../news-sync-scheduler/index.js')).default;

    // Create mock execution context
    const mockCtx = {
      waitUntil: (_promise: Promise<any>) => {},
      passThroughOnException: () => {}
    } as ExecutionContext;

    const scheduler = new NewsSyncScheduler(mockCtx, c.env as any);

    // Create a proper Event object
    const mockEvent = {
      type: 'scheduled' as const,
      scheduledTime: Date.now(),
      cron: 'manual-trigger'
    };

    // Manually call the scheduler's handle method
    await scheduler.handle(mockEvent);

    return c.json({
      success: true,
      message: 'News sync triggered successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin trigger news sync error:', error);
    return c.json({
      error: 'Failed to trigger news sync',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Admin endpoint to insert articles directly
app.post('/admin/insert-articles', async (c) => {
  try {
    // TEMPORARY: No auth for initial deployment
    // const auth = await verifyAuth(c.req.header('Authorization'), c.env.JWT_SECRET);
    // if (!auth) {
    //   return c.json({ error: 'Unauthorized' }, 401);
    // }

    console.log('🔧 [ADMIN] Inserting articles directly...');

    const body = await c.req.json();
    const articles = body.articles;

    if (!Array.isArray(articles)) {
      return c.json({ error: 'Articles must be an array' }, 400);
    }

    const db = c.env.APP_DB;
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const article of articles) {
      try {
        await db
          .prepare(`
            INSERT INTO news_articles (
              id, interest, title, url, author, summary, text,
              image_url, published_date, fetched_at, score, source_domain
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            article.id,
            article.interest,
            article.title,
            article.url,
            article.author,
            article.summary,
            article.text,
            article.image_url,
            article.published_date,
            article.fetched_at,
            article.score,
            article.source_domain
          )
          .run();
        inserted++;
        console.log(`✅ Inserted: ${article.title}`);
      } catch (error: any) {
        if (error.message?.includes('UNIQUE constraint')) {
          skipped++;
          console.log(`⏭️  Skipped (duplicate): ${article.title}`);
        } else {
          errors.push(`${article.title}: ${error.message}`);
          console.error(`❌ Failed: ${article.title}`, error);
        }
      }
    }

    return c.json({
      success: true,
      inserted,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      total: articles.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin insert articles error:', error);
    return c.json({
      error: 'Failed to insert articles',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Admin endpoint to clean up articles with bad dates (Dec 31 placeholder, old articles)
app.post('/admin/cleanup-bad-dates', async (c) => {
  try {
    console.log('🧹 [ADMIN] Cleaning up articles with bad dates...');

    const db = c.env.APP_DB;
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Delete articles with Dec 31 dates (placeholder)
    const dec31Result = await db
      .prepare(`
        DELETE FROM news_articles
        WHERE published_date LIKE '%-12-31%'
      `)
      .run();

    const dec31Deleted = dec31Result.meta?.changes || 0;
    console.log(`   Deleted ${dec31Deleted} articles with Dec 31 dates`);

    // Delete articles with Jan 1 dates (placeholder)
    const jan1Result = await db
      .prepare(`
        DELETE FROM news_articles
        WHERE published_date LIKE '%-01-01%'
      `)
      .run();

    const jan1Deleted = jan1Result.meta?.changes || 0;
    console.log(`   Deleted ${jan1Deleted} articles with Jan 1 dates`);

    // Also clear the user views for these articles so they don't appear in rotation
    await db
      .prepare('DELETE FROM user_article_views WHERE article_id NOT IN (SELECT id FROM news_articles)')
      .run();

    return c.json({
      success: true,
      deleted: {
        dec31: dec31Deleted,
        jan1: jan1Deleted,
        total: dec31Deleted + jan1Deleted
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin cleanup bad dates error:', error);
    return c.json({
      error: 'Failed to cleanup bad dates',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Admin endpoint to clean up landing pages from database
app.post('/admin/cleanup-landing-pages', async (c) => {
  try {
    // TEMPORARY: No auth for initial deployment
    // const auth = await verifyAuth(c.req.header('Authorization'), c.env.JWT_SECRET);
    // if (!auth) {
    //   return c.json({ error: 'Unauthorized' }, 401);
    // }

    console.log('🧹 [ADMIN] Cleaning up landing pages from database...');

    const db = c.env.APP_DB;

    // Generic landing page titles
    const genericTitles = [
      '%business news%',
      '%world news%',
      '%politics news%',
      '%breaking news%',
      '%latest news%',
      '%top stories%',
      '%home%',
      '%homepage%',
      '%news home%',
      '%business | %',
      '%politics | %',
      '%economy | %',
      '%| economy, tech, ai%',
      // News roundup/digest titles
      '%morning news brief%',
      '%evening news brief%',
      '%news brief%',
      '%daily briefing%',
      '%morning edition%',
      '%evening edition%',
      '%news roundup%',
      '%weekly roundup%',
      '%daily digest%',
      '%news digest%',
    ];

    // Summary patterns that indicate section pages
    const sectionSummaryPatterns = [
      '%page provides the latest%',
      '%section covers a variety%',
      '%provides updates on various%',
      '%covers topics including%',
      '%includes coverage of%',
      '%page features%',
      '%section includes%',
    ];

    let totalDeleted = 0;

    // Delete by title patterns
    for (const pattern of genericTitles) {
      const result = await db
        .prepare('DELETE FROM news_articles WHERE LOWER(title) LIKE ?')
        .bind(pattern)
        .run();

      const deleted = result.meta?.changes || 0;
      if (deleted > 0) {
        console.log(`   Deleted ${deleted} articles matching title pattern: ${pattern}`);
        totalDeleted += deleted;
      }
    }

    // Delete by summary patterns
    for (const pattern of sectionSummaryPatterns) {
      const result = await db
        .prepare('DELETE FROM news_articles WHERE LOWER(summary) LIKE ?')
        .bind(pattern)
        .run();

      const deleted = result.meta?.changes || 0;
      if (deleted > 0) {
        console.log(`   Deleted ${deleted} articles matching summary pattern: ${pattern}`);
        totalDeleted += deleted;
      }
    }

    // Delete by URL patterns (ending in /business, /news, etc.)
    const urlPatterns = [
      '%/business',
      '%/business/',
      '%/politics',
      '%/politics/',
      '%/news',
      '%/news/',
      '%/world',
      '%/world/',
      '%/economy',
      '%/economy/',
      '%/latest',
      '%/latest/',
      '%/home',
      '%/home/',
    ];

    for (const pattern of urlPatterns) {
      const result = await db
        .prepare('DELETE FROM news_articles WHERE LOWER(url) LIKE ?')
        .bind(pattern)
        .run();

      const deleted = result.meta?.changes || 0;
      if (deleted > 0) {
        console.log(`   Deleted ${deleted} articles matching URL pattern: ${pattern}`);
        totalDeleted += deleted;
      }
    }

    return c.json({
      success: true,
      deleted: totalDeleted,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin cleanup landing pages error:', error);
    return c.json({
      error: 'Failed to cleanup landing pages',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /admin/trigger-state-sync
 * Manually trigger state legislation and legislator sync
 * (Admin endpoint for populating state data)
 */
app.post('/admin/trigger-state-sync', async (c) => {
  try {
    console.log('🔧 [ADMIN] Manually triggering state sync...');

    const db = c.env.APP_DB;
    const openStatesClient = c.env.OPENSTATES_CLIENT;

    // Get unique states from users with state preferences
    const statesResult = await db
      .prepare(`
        SELECT DISTINCT state
        FROM user_preferences
        WHERE state IS NOT NULL AND state != ''
        LIMIT 10
      `)
      .all();

    const states = statesResult.results as { state: string }[];

    if (states.length === 0) {
      return c.json({
        success: false,
        message: 'No user states found'
      });
    }

    console.log(`📍 Found ${states.length} unique states to sync: ${states.map(s => s.state).join(', ')}`);

    let totalLegislatorsSynced = 0;
    const errors: string[] = [];

    // Sync legislators for each state
    for (const { state } of states) {
      try {
        console.log(`🔄 Syncing legislators for ${state}...`);

        const legislators = await openStatesClient.getLegislatorsByState(state);

        if (!legislators || legislators.length === 0) {
          console.log(`⚠️ No legislators found for ${state}`);
          continue;
        }

        console.log(`📋 Found ${legislators.length} legislators for ${state}`);

        for (const legislator of legislators) {
          try {
            await db
              .prepare(`
                INSERT INTO state_legislators (
                  id, name, party, state, current_role_title, current_role_district,
                  current_role_chamber, jurisdiction_id, image_url, email, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  party = excluded.party,
                  current_role_title = excluded.current_role_title,
                  current_role_district = excluded.current_role_district,
                  current_role_chamber = excluded.current_role_chamber,
                  image_url = excluded.image_url,
                  email = excluded.email,
                  updated_at = excluded.updated_at
              `)
              .bind(
                legislator.id,
                legislator.name,
                legislator.party,
                legislator.state,
                legislator.currentRoleTitle,
                legislator.currentRoleDistrict,
                legislator.currentRoleChamber,
                legislator.jurisdictionId,
                legislator.imageUrl,
                legislator.email,
                Date.now(),
                Date.now()
              )
              .run();

            totalLegislatorsSynced++;
          } catch (legError) {
            errors.push(`Legislator ${legislator.name}: ${legError}`);
          }
        }

        console.log(`✅ Synced ${legislators.length} legislators for ${state}`);

        // Brief pause between states
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (stateError) {
        errors.push(`State ${state}: ${stateError}`);
      }
    }

    return c.json({
      success: true,
      stats: {
        statesSynced: states.length,
        legislatorsSynced: totalLegislatorsSynced,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Admin trigger state sync error:', error);
    return c.json({
      error: 'Failed to trigger state sync',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /trivia
 * Get congressional/legislative trivia fact
 * Used to entertain users while briefs are generating
 */
app.get('/trivia', async (c) => {
  try {
    console.log('[/trivia] Generating congressional trivia...');

    const cerebrasClient = c.env.CEREBRAS_CLIENT;
    const result = await cerebrasClient.generateTrivia();

    console.log(`[/trivia] Generated trivia: ${result.fact.slice(0, 50)}...`);

    return c.json({
      success: true,
      fact: result.fact,
      category: result.category
    });
  } catch (error) {
    console.error('Trivia generation error:', error);

    // Return a fallback trivia fact
    const fallbackFacts = [
      { fact: 'Did you know? The Capitol Building has 540 rooms and approximately 850 doorways!', category: 'Capitol Building' },
      { fact: 'Did you know? Congress has passed over 20,000 laws since the first Congress in 1789!', category: 'Legislative Records' },
      { fact: 'Did you know? The longest filibuster in Senate history lasted 24 hours and 18 minutes, by Strom Thurmond in 1957!', category: 'Senate History' },
      { fact: 'Did you know? The House of Representatives has had 11,000 members throughout history!', category: 'House of Representatives' },
      { fact: 'Did you know? The Constitution was signed by only 39 of the 55 delegates to the Constitutional Convention!', category: 'Constitutional History' }
    ];

    const fallback = fallbackFacts[Math.floor(Math.random() * fallbackFacts.length)];

    return c.json({
      success: true,
      fact: fallback!.fact,
      category: fallback!.category,
      fallback: true
    });
  }
});

/**
 * GET /dashboard/state-bills
 * Get personalized state bills based on user's state from preferences (requires auth)
 * Accepts token from query parameter to avoid CORS preflight
 */
app.get('/dashboard/state-bills', async (c) => {
  try {
    console.log('[/dashboard/state-bills] Request received');

    // Check for token in query parameter first (to avoid CORS preflight)
    const tokenParam = c.req.query('token');
    let auth;

    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[/dashboard/state-bills] JWT_SECRET not available in environment');
      return c.json({ error: 'Server configuration error' }, 500);
    }

    if (tokenParam) {
      console.log('[/dashboard/state-bills] Using token from query parameter');
      auth = await verifyAuth(`Bearer ${tokenParam}`, jwtSecret);
      if (!auth) {
        console.log('[/dashboard/state-bills] Token verification failed');
        return c.json({ error: 'Unauthorized' }, 401);
      }
    } else {
      console.log('[/dashboard/state-bills] Using token from Authorization header');
      auth = await requireAuth(c);
      if (auth instanceof Response) return auth;
    }

    const db = c.env.APP_DB;
    const limit = Number(c.req.query('limit')) || 20;

    // Get user's state from user_preferences
    const userPrefs = await db
      .prepare('SELECT state FROM user_preferences WHERE user_id = ?')
      .bind(auth.userId)
      .first();

    if (!userPrefs?.state) {
      return c.json({
        success: true,
        bills: [],
        message: 'No state set in preferences. Please update your location settings.'
      });
    }

    const userState = userPrefs.state as string;
    console.log(`[/dashboard/state-bills] User ${auth.userId} state: ${userState}`);

    // Query state bills for user's state
    const bills = await db
      .prepare(`
        SELECT
          id, state, session_identifier, identifier, title,
          subjects, chamber, latest_action_date, latest_action_description
        FROM state_bills
        WHERE state = ?
        ORDER BY latest_action_date DESC NULLS LAST
        LIMIT ?
      `)
      .bind(userState, limit)
      .all();

    const formattedBills = (bills.results || []).map((bill: any) => {
      // Parse subjects safely
      let subjects: string[] = [];
      try {
        if (bill.subjects) {
          subjects = typeof bill.subjects === 'string' ? JSON.parse(bill.subjects) : bill.subjects;
        }
      } catch { /* ignore */ }

      // Build OpenStates URL
      const stateCode = bill.state?.toLowerCase();
      const session = bill.session_identifier;
      const identifierClean = bill.identifier?.replace(/\s+/g, '');
      const openstatesUrl = stateCode && session && identifierClean
        ? `https://openstates.org/${stateCode}/bills/${session}/${identifierClean}/`
        : null;

      return {
        id: bill.id,
        state: bill.state,
        stateName: STATE_ABBREVIATIONS[bill.state] || bill.state,
        session: bill.session_identifier,
        identifier: bill.identifier,
        title: bill.title,
        subjects,
        chamber: bill.chamber,
        latestAction: {
          date: bill.latest_action_date,
          description: bill.latest_action_description
        },
        // URL-safe ID for detail page links
        detailId: encodeURIComponent(bill.id),
        openstatesUrl
      };
    });

    return c.json({
      success: true,
      state: userState,
      stateName: STATE_ABBREVIATIONS[userState] || userState,
      bills: formattedBills,
      count: formattedBills.length
    });
  } catch (error) {
    console.error('Get state bills error:', error);
    return c.json({
      error: 'Failed to get state bills',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /briefs/generate
 * Trigger on-demand brief generation if user doesn't have today's brief
 * Returns the brief status (generating, ready, etc.)
 */
app.post('/briefs/generate', async (c) => {
  try {
    // Require authentication
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;

    // Check if user already has today's brief
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const existingBrief = await db
      .prepare(`
        SELECT id, status, audio_url, created_at
        FROM briefs
        WHERE user_id = ? AND type = 'daily' AND created_at >= ?
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .bind(auth.userId, todayTimestamp)
      .first();

    if (existingBrief) {
      // If the existing brief failed, delete it and allow regeneration
      if (existingBrief.status === 'failed') {
        console.log(`[/briefs/generate] User ${auth.userId} has a failed brief for today: ${existingBrief.id} - deleting to allow regeneration`);
        await db
          .prepare('DELETE FROM briefs WHERE id = ?')
          .bind(existingBrief.id)
          .run();
        // Continue to create a new brief below
      } else {
        console.log(`[/briefs/generate] User ${auth.userId} already has today's brief: ${existingBrief.id} (status: ${existingBrief.status})`);

        return c.json({
          success: true,
          status: existingBrief.status,
          briefId: existingBrief.id,
          audioUrl: existingBrief.audio_url,
          message: 'Brief already exists for today'
        });
      }
    }

    // Generate new brief ID
    const briefId = crypto.randomUUID();
    const now = Date.now();
    const briefEndDate = new Date();
    const briefStartDate = new Date(briefEndDate);
    briefStartDate.setDate(briefStartDate.getDate() - 1);

    console.log(`[/briefs/generate] Creating new brief ${briefId} for user ${auth.userId}`);

    // Create brief record in pending state with placeholder title and dates
    await db
      .prepare(`
        INSERT INTO briefs (id, user_id, type, status, title, start_date, end_date, created_at, updated_at)
        VALUES (?, ?, 'daily', 'pending', ?, ?, ?, ?, ?)
      `)
      .bind(briefId, auth.userId, 'Generating Your Brief...', briefStartDate.toISOString(), briefEndDate.toISOString(), now, now)
      .run();

    // Queue brief generation - use the same format as briefs-service

    const briefQueue = c.env.BRIEF_QUEUE;
    await briefQueue.send({
      briefId,
      userId: auth.userId,
      type: 'daily',
      startDate: briefStartDate.toISOString(),
      endDate: briefEndDate.toISOString(),
      requestedAt: now
    });

    console.log(`[/briefs/generate] Queued brief generation for ${briefId}`);

    return c.json({
      success: true,
      status: 'generating',
      briefId,
      message: 'Brief generation started'
    });
  } catch (error) {
    console.error('Brief generation trigger error:', error);
    return c.json({
      error: 'Failed to trigger brief generation',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /briefs/status/:id
 * Check the status of a brief being generated
 */
app.get('/briefs/status/:id', async (c) => {
  try {
    // Check for token in query parameter first (to avoid CORS preflight)
    const tokenParam = c.req.query('token');
    let auth;

    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) {
      return c.json({ error: 'Server configuration error' }, 500);
    }

    if (tokenParam) {
      auth = await verifyAuth(`Bearer ${tokenParam}`, jwtSecret);
      if (!auth) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
    } else {
      auth = await requireAuth(c);
      if (auth instanceof Response) return auth;
    }

    const briefId = c.req.param('id');
    const db = c.env.APP_DB;

    const brief = await db
      .prepare(`
        SELECT id, status, title, audio_url, audio_duration, featured_image, created_at
        FROM briefs
        WHERE id = ? AND user_id = ?
        LIMIT 1
      `)
      .bind(briefId, auth.userId)
      .first();

    if (!brief) {
      return c.json({ error: 'Brief not found' }, 404);
    }

    return c.json({
      success: true,
      brief: {
        id: brief.id,
        status: brief.status,
        title: brief.title,
        audioUrl: brief.audio_url,
        audioDuration: brief.audio_duration,
        featuredImage: brief.featured_image,
        createdAt: brief.created_at
      }
    });
  } catch (error) {
    console.error('Brief status check error:', error);
    return c.json({
      error: 'Failed to check brief status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
