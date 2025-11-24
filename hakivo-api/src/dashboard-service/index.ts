import { Service } from '@liquidmetal-ai/raindrop-framework';
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

    // Query news articles filtered by user interests
    // Fast and simple - just use Exa's summary and image directly (no AI enrichment needed)
    const articles = await db
      .prepare(`
        SELECT
          id, interest, title, url, author, summary,
          image_url, published_date, fetched_at, score, source_domain
        FROM news_articles
        WHERE interest IN (${placeholders})
        ORDER BY published_date DESC, score DESC
        LIMIT ?
      `)
      .bind(...policyInterests, limit)
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

    // Get user's state and district from user_preferences
    const userPrefs = await db
      .prepare('SELECT state, district FROM user_preferences WHERE user_id = ?')
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
    const stateFullName = STATE_ABBREVIATIONS[state] || state;
    console.log(`[Representatives] Converting state: ${state} → ${stateFullName}`);

    // Get senators (2 per state)
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
        WHERE state = ? AND district IS NULL AND current_member = 1
        ORDER BY last_name
        LIMIT 2
      `)
      .bind(stateFullName)
      .all();

    // Get representative (1 per district)
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
          WHERE state = ? AND district = ? AND current_member = 1
          LIMIT 1
        `)
        .bind(stateFullName, district)
        .first();

      representative = rep;
    }

    const representatives = [
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

    return c.json({
      success: true,
      representatives,
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

    // Define date range (last 7 days for fresh news)
    const endDate = new Date();
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

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
          15 // Fetch 15 articles per interest
        );

        console.log(`   Found ${results.length} articles`);

        // Store each article in news_articles table
        for (const article of results) {
          try {
            // Extract domain from URL
            const url = new URL(article.url);
            const sourceDomain = url.hostname.replace('www.', '');

            // Insert article (ignore if duplicate URL for this interest)
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
 * GET /latest-actions?limit=20
 * Get latest bill actions from Congress.gov
 * Returns recent legislative activity, updated twice daily
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

    // Query latest actions, ordered by action date (most recent first)
    const actions = await db
      .prepare(`
        SELECT
          id, bill_congress, bill_type, bill_number, bill_title,
          action_date, action_text, latest_action_status, chamber,
          source_url, fetched_at
        FROM latest_bill_actions
        ORDER BY action_date DESC, fetched_at DESC
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

    // Format the actions for frontend consumption
    const formattedActions = actions.results.map((action: any) => ({
      id: action.id,
      bill: {
        congress: action.bill_congress,
        type: action.bill_type,
        number: action.bill_number,
        title: action.bill_title,
        url: action.source_url
      },
      action: {
        date: action.action_date,
        text: action.action_text,
        status: action.latest_action_status
      },
      chamber: action.chamber,
      fetchedAt: action.fetched_at
    }));

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

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
