import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { QueueSendOptions } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { z } from 'zod';

// Validation schemas
const RequestBriefSchema = z.object({
  type: z.enum(['daily', 'weekly', 'custom']),
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional()
});

const UpdateProgressSchema = z.object({
  progress: z.number().int().min(0).max(100),
  completed: z.boolean().optional()
});

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors());

/**
 * Verify JWT token from auth header
 */
async function verifyAuth(authHeader: string | undefined, jwtSecret: string): Promise<{ userId: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
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
  const auth = await verifyAuth(authHeader, c.env.JWT_SECRET);

  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return auth;
}

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'briefs-service', timestamp: new Date().toISOString() });
});

/**
 * POST /briefs/test-generate
 * Test endpoint to trigger brief generation without auth (for development only)
 */
app.post('/briefs/test-generate', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, type = 'daily' } = body;

    if (!userId) {
      return c.json({ error: 'userId is required' }, 400);
    }

    const db = c.env.APP_DB;

    // Calculate date range
    const briefEndDate = new Date();
    const briefStartDate = new Date();
    if (type === 'daily') {
      briefStartDate.setDate(briefStartDate.getDate() - 1);
    } else {
      briefStartDate.setDate(briefStartDate.getDate() - 7);
    }

    // Create brief record
    const briefId = crypto.randomUUID();
    const now = Date.now();
    const title = `Test Brief - ${briefEndDate.toLocaleDateString()}`;

    await db
      .prepare(`
        INSERT INTO briefs (
          id, user_id, type, title, start_date, end_date, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        briefId, userId, type, title,
        briefStartDate.toISOString().split('T')[0],
        briefEndDate.toISOString().split('T')[0],
        'pending', now, now
      )
      .run();

    // Enqueue brief generation
    await c.env.BRIEF_QUEUE.send({
      briefId,
      userId,
      type,
      startDate: briefStartDate.toISOString(),
      endDate: briefEndDate.toISOString(),
      requestedAt: now
    });

    console.log(`✓ Test brief requested: ${briefId} for user ${userId}`);

    return c.json({
      success: true,
      message: 'Test brief generation requested',
      briefId,
      dateRange: {
        start: briefStartDate.toISOString(),
        end: briefEndDate.toISOString()
      }
    }, 201);
  } catch (error) {
    console.error('Test generate error:', error);
    return c.json({
      error: 'Failed to generate test brief',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /briefs/generate-daily
 * Generate today's daily brief on-demand (requires auth)
 * - Checks if user already has a daily brief for today
 * - If exists, returns existing brief (no duplicate generation)
 * - If not, creates and queues new brief
 */
app.post('/briefs/generate-daily', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check if user already has a daily brief for today
    const existingBrief = await db
      .prepare(`
        SELECT id, status, audio_url, title, created_at
        FROM briefs
        WHERE user_id = ? AND type = 'daily' AND end_date = ?
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .bind(auth.userId, today)
      .first();

    if (existingBrief) {
      // If the existing brief failed, allow regeneration by deleting it first
      if (existingBrief.status === 'failed') {
        console.log(`⚠️ User ${auth.userId} has a failed brief for ${today}: ${existingBrief.id} - deleting to allow regeneration`);
        await db
          .prepare('DELETE FROM briefs WHERE id = ?')
          .bind(existingBrief.id)
          .run();
        // Continue to create a new brief below
      } else {
        console.log(`ℹ️ User ${auth.userId} already has daily brief for ${today}: ${existingBrief.id} (status: ${existingBrief.status})`);
        return c.json({
          success: true,
          message: 'Daily brief already exists for today',
          briefId: existingBrief.id,
          status: existingBrief.status,
          audioUrl: existingBrief.audio_url,
          isExisting: true
        });
      }
    }

    // Create new daily brief
    const briefId = crypto.randomUUID();
    const now = Date.now();
    const briefEndDate = new Date();
    const briefStartDate = new Date();
    briefStartDate.setDate(briefStartDate.getDate() - 1); // Yesterday

    const title = `Daily Brief - ${briefEndDate.toLocaleDateString()}`;

    await db
      .prepare(`
        INSERT INTO briefs (
          id, user_id, type, title, start_date, end_date, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        briefId,
        auth.userId,
        'daily',
        title,
        briefStartDate.toISOString().split('T')[0],
        today,
        'pending',
        now,
        now
      )
      .run();

    // Enqueue brief generation
    await c.env.BRIEF_QUEUE.send({
      briefId,
      userId: auth.userId,
      type: 'daily',
      startDate: briefStartDate.toISOString(),
      endDate: briefEndDate.toISOString(),
      requestedAt: now
    });

    console.log(`✓ On-demand daily brief requested: ${briefId} for user ${auth.userId}`);

    return c.json({
      success: true,
      message: 'Daily brief generation started',
      briefId,
      status: 'pending',
      isExisting: false,
      estimatedTime: '2-5 minutes'
    }, 201);
  } catch (error) {
    console.error('Generate daily brief error:', error);
    return c.json({
      error: 'Failed to generate daily brief',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /briefs/request
 * Request a new brief generation (requires auth)
 */
app.post('/briefs/request', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;

    // Validate input
    const body = await c.req.json();
    const validation = RequestBriefSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: 'Invalid input', details: validation.error.errors }, 400);
    }

    const { type, startDate, endDate } = validation.data;

    // Calculate date range based on type
    let briefStartDate: Date;
    let briefEndDate: Date = new Date();

    if (type === 'daily') {
      briefStartDate = new Date();
      briefStartDate.setDate(briefStartDate.getDate() - 1); // Yesterday
    } else if (type === 'weekly') {
      briefStartDate = new Date();
      briefStartDate.setDate(briefStartDate.getDate() - 7); // Last 7 days
    } else {
      // Custom date range
      if (!startDate || !endDate) {
        return c.json({ error: 'startDate and endDate required for custom type' }, 400);
      }
      briefStartDate = new Date(startDate);
      briefEndDate = new Date(endDate);
    }

    // Create brief record with pending status
    const briefId = crypto.randomUUID();
    const now = Date.now();

    const title = type === 'daily'
      ? `Daily Brief - ${briefEndDate.toLocaleDateString()}`
      : type === 'weekly'
      ? `Weekly Brief - ${briefStartDate.toLocaleDateString()} to ${briefEndDate.toLocaleDateString()}`
      : `Custom Brief - ${briefStartDate.toLocaleDateString()} to ${briefEndDate.toLocaleDateString()}`;

    await db
      .prepare(`
        INSERT INTO briefs (
          id, user_id, type, title, start_date, end_date, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        briefId,
        auth.userId,
        type,
        title,
        briefStartDate.toISOString().split('T')[0],
        briefEndDate.toISOString().split('T')[0],
        'pending',
        now,
        now
      )
      .run();

    // Enqueue brief generation job
    const queueMessage = {
      briefId,
      userId: auth.userId,
      type,
      startDate: briefStartDate.toISOString(),
      endDate: briefEndDate.toISOString(),
      requestedAt: now
    };

    await c.env.BRIEF_QUEUE.send(queueMessage);

    console.log(`✓ Brief requested: ${briefId} (${type}) for user ${auth.userId}`);

    return c.json({
      success: true,
      message: 'Brief generation requested',
      briefId,
      status: 'pending',
      estimatedCompletionTime: '2-5 minutes'
    }, 201);
  } catch (error) {
    console.error('Request brief error:', error);
    return c.json({
      error: 'Failed to request brief',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /briefs/:briefId
 * Get brief details and status (requires auth)
 */
app.get('/briefs/:briefId', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const briefId = c.req.param('briefId');

    // Get brief
    const brief = await db
      .prepare('SELECT * FROM briefs WHERE id = ? AND user_id = ?')
      .bind(briefId, auth.userId)
      .first();

    if (!brief) {
      return c.json({ error: 'Brief not found' }, 404);
    }

    // Get featured bills for this brief
    const billsResult = await db
      .prepare(`
        SELECT
          b.id, b.congress, b.bill_type, b.bill_number, b.title,
          b.policy_area, b.latest_action_date, b.latest_action_text,
          b.sponsor_bioguide_id,
          m.first_name, m.last_name, m.party, m.state
        FROM brief_bills bb
        JOIN bills b ON bb.bill_id = b.id
        LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
        WHERE bb.brief_id = ?
      `)
      .bind(briefId)
      .all();

    const featuredBills = (billsResult.results || []).map((bill: any) => ({
      // Construct proper bill ID in format congress-type-number for frontend routing
      id: `${bill.congress}-${bill.bill_type?.toLowerCase()}-${bill.bill_number}`,
      congress: bill.congress,
      billType: bill.bill_type,
      billNumber: bill.bill_number,
      title: bill.title,
      policyArea: bill.policy_area,
      latestActionDate: bill.latest_action_date,
      latestActionText: bill.latest_action_text,
      sponsor: {
        name: `${bill.first_name || ''} ${bill.last_name || ''}`.trim() || 'Unknown',
        party: bill.party || '?',
        state: bill.state || '?'
      },
      congressUrl: `https://www.congress.gov/bill/${bill.congress}th-congress/${bill.bill_type?.toLowerCase()}/${bill.bill_number}`
    }));

    // Parse news from JSON if stored in content metadata
    let newsArticles: any[] = [];
    try {
      // Check if there's news JSON stored
      if (brief.news_json) {
        newsArticles = JSON.parse(brief.news_json as string);
      }
    } catch (e) {
      // Ignore parse errors
    }

    // Format response (mapped to actual database schema)
    const response = {
      id: brief.id,
      type: brief.type,
      title: brief.title,
      headline: brief.title,
      startDate: brief.start_date,
      endDate: brief.end_date,
      status: brief.status,
      script: brief.script,
      content: brief.content,
      audioUrl: brief.audio_url,
      audioDuration: brief.audio_duration,
      characterCount: brief.character_count,
      featuredImage: brief.featured_image,
      createdAt: brief.created_at,
      updatedAt: brief.updated_at,
      // Include structured data
      featuredBills,
      newsArticles
    };

    return c.json({
      success: true,
      brief: response
    });
  } catch (error) {
    console.error('Get brief error:', error);
    return c.json({
      error: 'Failed to get brief',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /briefs
 * List user's briefs (requires auth)
 */
app.get('/briefs', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;

    // Parse query parameters
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20;
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0;
    const status = c.req.query('status'); // Filter by status

    // Build query
    let sql = 'SELECT * FROM briefs WHERE user_id = ?';
    const bindings: any[] = [auth.userId];

    if (status) {
      sql += ' AND status = ?';
      bindings.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const result = await db.prepare(sql).bind(...bindings).all();

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM briefs WHERE user_id = ?';
    const countBindings: any[] = [auth.userId];

    if (status) {
      countSql += ' AND status = ?';
      countBindings.push(status);
    }

    const countResult = await db.prepare(countSql).bind(...countBindings).first();
    const total = countResult?.total as number || 0;

    // Format results (mapped to actual database schema)
    const briefs = result.results?.map((row: any) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      headline: row.title,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      audioUrl: row.audio_url,
      audioDuration: row.audio_duration,
      characterCount: row.character_count,
      featuredImage: row.featured_image,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) || [];

    return c.json({
      success: true,
      briefs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error('List briefs error:', error);
    return c.json({
      error: 'Failed to list briefs',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /briefs/:briefId/progress
 * Update playback progress (requires auth)
 * Note: Simplified - database doesn't support progress tracking columns yet
 */
app.post('/briefs/:briefId/progress', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const body = await c.req.json();
    const validation = UpdateProgressSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: 'Invalid input', details: validation.error.errors }, 400);
    }

    const { progress, completed } = validation.data;

    // Progress tracking not yet implemented in database schema
    // Just return success for frontend compatibility
    return c.json({
      success: true,
      message: 'Progress acknowledged',
      progress,
      completed: completed ?? false
    });
  } catch (error) {
    console.error('Update progress error:', error);
    return c.json({
      error: 'Failed to update progress',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /briefs/:briefId/play
 * Increment play count (requires auth)
 * Note: Simplified - database doesn't support play count yet
 */
app.post('/briefs/:briefId/play', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    // Play tracking not yet implemented in database schema
    return c.json({
      success: true,
      plays: 1
    });
  } catch (error) {
    console.error('Increment play error:', error);
    return c.json({
      error: 'Failed to increment play count',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /briefs/:briefId/article-read
 * Mark article as read (requires auth)
 * Note: Simplified - database doesn't support read tracking yet
 */
app.post('/briefs/:briefId/article-read', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    // Article read tracking not yet implemented in database schema
    return c.json({
      success: true,
      message: 'Article read acknowledged',
      readTime: Date.now()
    });
  } catch (error) {
    console.error('Mark article read error:', error);
    return c.json({
      error: 'Failed to mark article as read',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * DELETE /briefs/:briefId
 * Delete a brief (requires auth)
 */
app.delete('/briefs/:briefId', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const briefId = c.req.param('briefId');

    // Verify ownership
    const brief = await db
      .prepare('SELECT user_id FROM briefs WHERE id = ?')
      .bind(briefId)
      .first();

    if (!brief) {
      return c.json({ error: 'Brief not found' }, 404);
    }

    if (brief.user_id !== auth.userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Delete brief
    await db
      .prepare('DELETE FROM briefs WHERE id = ?')
      .bind(briefId)
      .run();

    console.log(`✓ Brief deleted: ${briefId} by user ${auth.userId}`);

    return c.json({
      success: true,
      message: 'Brief deleted successfully'
    });
  } catch (error) {
    console.error('Delete brief error:', error);
    return c.json({
      error: 'Failed to delete brief',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /briefs/stats
 * Get user's brief statistics (requires auth)
 */
app.get('/briefs/stats', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;

    // Get various stats
    const stats = await db
      .prepare(`
        SELECT
          COUNT(*) as total_briefs,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_briefs,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_briefs,
          SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_briefs,
          AVG(CASE WHEN audio_duration IS NOT NULL THEN audio_duration ELSE NULL END) as avg_duration,
          SUM(character_count) as total_characters
        FROM briefs
        WHERE user_id = ?
      `)
      .bind(auth.userId)
      .first();

    return c.json({
      success: true,
      stats: {
        totalBriefs: stats?.total_briefs || 0,
        completedBriefs: stats?.completed_briefs || 0,
        pendingBriefs: stats?.pending_briefs || 0,
        processingBriefs: stats?.processing_briefs || 0,
        avgDuration: stats?.avg_duration || 0,
        totalCharacters: stats?.total_characters || 0
      }
    });
  } catch (error) {
    console.error('Get brief stats error:', error);
    return c.json({
      error: 'Failed to get brief stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// ============================================
// PODCAST ENDPOINTS - 100 Laws That Shaped America
// ============================================

/**
 * GET /podcast
 * List podcast episodes (public - no auth required)
 */
app.get('/podcast', async (c) => {
  try {
    const db = c.env.APP_DB;

    // Parse query parameters
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 50;
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0;
    const status = c.req.query('status'); // Filter by status (e.g., 'completed')

    // Build query - join with historic_laws for law data
    let sql = `
      SELECT
        pe.*,
        hl.name as law_name,
        hl.year as law_year,
        hl.public_law as law_public_law,
        hl.president_signed as law_president_signed,
        hl.category as law_category,
        hl.description as law_description,
        hl.key_provisions as law_key_provisions,
        hl.historical_impact as law_historical_impact
      FROM podcast_episodes pe
      JOIN historic_laws hl ON pe.law_id = hl.id
      WHERE 1=1
    `;
    const bindings: any[] = [];

    if (status) {
      sql += ' AND pe.status = ?';
      bindings.push(status);
    }

    sql += ' ORDER BY pe.episode_number ASC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const result = await db.prepare(sql).bind(...bindings).all();

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM podcast_episodes WHERE 1=1';
    const countBindings: any[] = [];

    if (status) {
      countSql += ' AND status = ?';
      countBindings.push(status);
    }

    const countResult = await db.prepare(countSql).bind(...countBindings).first();
    const total = countResult?.total as number || 0;

    // Format results
    const episodes = result.results?.map((row: any) => ({
      id: row.id,
      lawId: row.law_id,
      episodeNumber: row.episode_number,
      title: row.title,
      headline: row.headline,
      description: row.description,
      audioUrl: row.audio_url,
      audioDuration: row.audio_duration,
      thumbnailUrl: row.thumbnail_url,
      characterCount: row.character_count,
      status: row.status,
      createdAt: row.created_at,
      publishedAt: row.published_at,
      law: {
        year: row.law_year,
        category: row.law_category,
        publicLaw: row.law_public_law
      }
    })) || [];

    return c.json({
      success: true,
      episodes,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error('List podcast episodes error:', error);
    return c.json({
      error: 'Failed to list podcast episodes',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /podcast/:episodeId
 * Get single podcast episode with full details (public - no auth required)
 */
app.get('/podcast/:episodeId', async (c) => {
  try {
    const db = c.env.APP_DB;
    const episodeId = c.req.param('episodeId');

    // Get episode with law data
    const episode = await db
      .prepare(`
        SELECT
          pe.*,
          hl.id as law_id,
          hl.name as law_name,
          hl.year as law_year,
          hl.public_law as law_public_law,
          hl.president_signed as law_president_signed,
          hl.category as law_category,
          hl.description as law_description,
          hl.key_provisions as law_key_provisions,
          hl.historical_impact as law_historical_impact
        FROM podcast_episodes pe
        JOIN historic_laws hl ON pe.law_id = hl.id
        WHERE pe.id = ?
      `)
      .bind(episodeId)
      .first();

    if (!episode) {
      return c.json({ error: 'Episode not found' }, 404);
    }

    // Parse key provisions from JSON
    let keyProvisions: string[] = [];
    try {
      if (episode.law_key_provisions) {
        keyProvisions = JSON.parse(episode.law_key_provisions as string);
      }
    } catch {
      keyProvisions = [episode.law_key_provisions as string];
    }

    // Format response
    const response = {
      id: episode.id,
      lawId: episode.law_id,
      episodeNumber: episode.episode_number,
      title: episode.title,
      headline: episode.headline,
      description: episode.description,
      script: episode.script,
      audioUrl: episode.audio_url,
      audioDuration: episode.audio_duration,
      thumbnailUrl: episode.thumbnail_url,
      characterCount: episode.character_count,
      status: episode.status,
      createdAt: episode.created_at,
      publishedAt: episode.published_at,
      law: {
        id: episode.law_id,
        name: episode.law_name,
        year: episode.law_year,
        publicLaw: episode.law_public_law,
        presidentSigned: episode.law_president_signed,
        category: episode.law_category,
        description: episode.law_description,
        keyProvisions,
        historicalImpact: episode.law_historical_impact
      }
    };

    return c.json({
      success: true,
      episode: response
    });
  } catch (error) {
    console.error('Get podcast episode error:', error);
    return c.json({
      error: 'Failed to get podcast episode',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /podcast/stats
 * Get podcast series statistics (public)
 */
app.get('/podcast/stats', async (c) => {
  try {
    const db = c.env.APP_DB;

    const stats = await db
      .prepare(`
        SELECT
          (SELECT COUNT(*) FROM historic_laws) as total_laws,
          (SELECT COUNT(*) FROM podcast_episodes) as total_episodes,
          (SELECT COUNT(*) FROM podcast_episodes WHERE status = 'completed') as completed_episodes,
          (SELECT SUM(audio_duration) FROM podcast_episodes WHERE status = 'completed') as total_duration
      `)
      .first();

    return c.json({
      success: true,
      stats: {
        totalLaws: stats?.total_laws || 0,
        totalEpisodes: stats?.total_episodes || 0,
        completedEpisodes: stats?.completed_episodes || 0,
        remainingEpisodes: (stats?.total_laws as number || 0) - (stats?.completed_episodes as number || 0),
        totalDurationSeconds: stats?.total_duration || 0,
        percentComplete: Math.round(((stats?.completed_episodes as number || 0) / (stats?.total_laws as number || 1)) * 100)
      }
    });
  } catch (error) {
    console.error('Get podcast stats error:', error);
    return c.json({
      error: 'Failed to get podcast stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /podcast/:episodeId/play
 * Record a play (public - for analytics)
 */
app.post('/podcast/:episodeId/play', async (c) => {
  try {
    const db = c.env.APP_DB;
    const episodeId = c.req.param('episodeId');

    // Record play in podcast_plays table
    const playId = crypto.randomUUID();
    const now = Date.now();

    // Get user ID from auth if available (optional)
    let userId: string | null = null;
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      const auth = await verifyAuth(authHeader, c.env.JWT_SECRET);
      if (auth) {
        userId = auth.userId;
      }
    }

    await db
      .prepare(`
        INSERT INTO podcast_plays (id, episode_id, user_id, played_at)
        VALUES (?, ?, ?, ?)
      `)
      .bind(playId, episodeId, userId, now)
      .run();

    return c.json({
      success: true,
      message: 'Play recorded'
    });
  } catch (error) {
    console.error('Record podcast play error:', error);
    return c.json({
      error: 'Failed to record play',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /podcast/latest
 * Get the most recent completed episode (public)
 */
app.get('/podcast/latest', async (c) => {
  try {
    const db = c.env.APP_DB;

    const episode = await db
      .prepare(`
        SELECT
          pe.*,
          hl.year as law_year,
          hl.category as law_category,
          hl.public_law as law_public_law
        FROM podcast_episodes pe
        JOIN historic_laws hl ON pe.law_id = hl.id
        WHERE pe.status = 'completed'
        ORDER BY pe.published_at DESC, pe.created_at DESC
        LIMIT 1
      `)
      .first();

    if (!episode) {
      return c.json({
        success: true,
        episode: null,
        message: 'No episodes available yet'
      });
    }

    return c.json({
      success: true,
      episode: {
        id: episode.id,
        lawId: episode.law_id,
        episodeNumber: episode.episode_number,
        title: episode.title,
        headline: episode.headline,
        description: episode.description,
        audioUrl: episode.audio_url,
        audioDuration: episode.audio_duration,
        thumbnailUrl: episode.thumbnail_url,
        status: episode.status,
        createdAt: episode.created_at,
        publishedAt: episode.published_at,
        law: {
          year: episode.law_year,
          category: episode.law_category,
          publicLaw: episode.law_public_law
        }
      }
    });
  } catch (error) {
    console.error('Get latest podcast episode error:', error);
    return c.json({
      error: 'Failed to get latest episode',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
