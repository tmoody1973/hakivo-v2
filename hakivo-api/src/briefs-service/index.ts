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
          id, user_id, type, title, date, status,
          listened, progress, completed, plays,
          article_read, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        briefId,
        auth.userId,
        type,
        title,
        now,
        'pending',
        0, // listened
        0, // progress
        0, // completed
        0, // plays
        0, // article_read
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

    // Format response
    const response = {
      id: brief.id,
      type: brief.type,
      title: brief.title,
      date: brief.date,
      status: brief.status,
      script: brief.script,
      audioUrl: brief.audio_url,
      duration: brief.duration,
      fileSize: brief.file_size,
      article: brief.article,
      articleWordCount: brief.article_word_count,
      listened: Boolean(brief.listened),
      progress: brief.progress,
      completed: Boolean(brief.completed),
      plays: brief.plays,
      articleRead: Boolean(brief.article_read),
      articleReadTime: brief.article_read_time,
      createdAt: brief.created_at,
      completedAt: brief.completed_at
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

    // Format results
    const briefs = result.results?.map((row: any) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      date: row.date,
      status: row.status,
      audioUrl: row.audio_url,
      duration: row.duration,
      listened: Boolean(row.listened),
      progress: row.progress,
      completed: Boolean(row.completed),
      plays: row.plays,
      articleRead: Boolean(row.article_read),
      createdAt: row.created_at,
      completedAt: row.completed_at
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
 */
app.post('/briefs/:briefId/progress', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const briefId = c.req.param('briefId');

    // Validate input
    const body = await c.req.json();
    const validation = UpdateProgressSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: 'Invalid input', details: validation.error.errors }, 400);
    }

    const { progress, completed } = validation.data;

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

    // Update progress
    const updateFields: string[] = ['progress = ?'];
    const updateBindings: any[] = [progress];

    if (completed !== undefined) {
      updateFields.push('completed = ?');
      updateBindings.push(completed ? 1 : 0);

      if (completed) {
        updateFields.push('completed_at = ?');
        updateBindings.push(Date.now());
      }
    }

    // Mark as listened if progress > 0
    if (progress > 0) {
      updateFields.push('listened = ?');
      updateBindings.push(1);
    }

    updateBindings.push(briefId);

    await db
      .prepare(`UPDATE briefs SET ${updateFields.join(', ')} WHERE id = ?`)
      .bind(...updateBindings)
      .run();

    return c.json({
      success: true,
      message: 'Progress updated',
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
 */
app.post('/briefs/:briefId/play', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const briefId = c.req.param('briefId');

    // Verify ownership
    const brief = await db
      .prepare('SELECT user_id, plays FROM briefs WHERE id = ?')
      .bind(briefId)
      .first();

    if (!brief) {
      return c.json({ error: 'Brief not found' }, 404);
    }

    if (brief.user_id !== auth.userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Increment plays
    const newPlays = (brief.plays as number) + 1;
    await db
      .prepare('UPDATE briefs SET plays = ? WHERE id = ?')
      .bind(newPlays, briefId)
      .run();

    return c.json({
      success: true,
      plays: newPlays
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
 */
app.post('/briefs/:briefId/article-read', async (c) => {
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

    // Mark as read
    const readTime = Date.now();
    await db
      .prepare('UPDATE briefs SET article_read = ?, article_read_time = ? WHERE id = ?')
      .bind(1, readTime, briefId)
      .run();

    return c.json({
      success: true,
      message: 'Article marked as read',
      readTime
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
          SUM(CASE WHEN status = 'generating' THEN 1 ELSE 0 END) as generating_briefs,
          SUM(CASE WHEN listened = 1 THEN 1 ELSE 0 END) as listened_count,
          SUM(plays) as total_plays,
          SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_plays,
          SUM(CASE WHEN article_read = 1 THEN 1 ELSE 0 END) as articles_read,
          AVG(CASE WHEN duration IS NOT NULL THEN duration ELSE NULL END) as avg_duration
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
        generatingBriefs: stats?.generating_briefs || 0,
        listenedCount: stats?.listened_count || 0,
        totalPlays: stats?.total_plays || 0,
        completedPlays: stats?.completed_plays || 0,
        articlesRead: stats?.articles_read || 0,
        avgDuration: stats?.avg_duration || 0
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

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
