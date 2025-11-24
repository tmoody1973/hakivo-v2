import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import { z } from 'zod';
import { buildBillFilterQuery, getInterestNames } from '../config/user-interests';

// Validation schemas
const SearchBillsSchema = z.object({
  query: z.string().optional(),
  congress: z.number().int().min(1).optional(),
  billType: z.string().optional(),
  sponsor: z.string().optional(),
  subject: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sort: z.enum(['latest_action_date', 'introduced_date', 'title']).default('latest_action_date'),
  order: z.enum(['asc', 'desc']).default('desc')
});

const TrackBillSchema = z.object({
  billId: z.number().int(),
  title: z.string(),
  congress: z.number().int(),
  billType: z.string(),
  billNumber: z.number().int()
});

const InterestBillsSchema = z.object({
  interests: z.array(z.string()).min(1),
  useKeywords: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sort: z.enum(['latest_action_date', 'introduced_date', 'title']).default('latest_action_date'),
  order: z.enum(['asc', 'desc']).default('desc')
});

const SearchMembersSchema = z.object({
  query: z.string().optional(),
  party: z.string().optional(),
  state: z.string().optional(),
  chamber: z.enum(['house', 'senate']).optional(),
  currentOnly: z.boolean().default(true),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sort: z.enum(['last_name', 'state', 'party']).default('last_name'),
  order: z.enum(['asc', 'desc']).default('asc')
});

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors());

/**
 * Verify JWT token from auth header
 */
async function verifyAuth(authHeader: string | undefined, jwtSecret: string | undefined): Promise<{ userId: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  if (!jwtSecret) {
    console.error('JWT_SECRET not configured');
    return null;
  }

  const token = authHeader.substring(7);

  // Use jose to verify token
  try {
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
  return c.json({ status: 'ok', service: 'bills-service', timestamp: new Date().toISOString() });
});

/**
 * GET /bills/search
 * Search bills with filters
 */
app.get('/bills/search', async (c) => {
  try {
    const db = c.env.APP_DB;

    // Parse query parameters
    const params = {
      query: c.req.query('query'),
      congress: c.req.query('congress') ? parseInt(c.req.query('congress')!) : undefined,
      billType: c.req.query('billType'),
      sponsor: c.req.query('sponsor'),
      subject: c.req.query('subject'),
      limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20,
      offset: c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0,
      sort: c.req.query('sort') || 'latest_action_date',
      order: c.req.query('order') || 'desc'
    };

    // Validate
    const validation = SearchBillsSchema.safeParse(params);
    if (!validation.success) {
      return c.json({ error: 'Invalid parameters', details: validation.error.errors }, 400);
    }

    const { query, congress, billType, sponsor, subject, limit, offset, sort, order } = validation.data;

    // Build SQL query
    let sql = `
      SELECT
        b.id,
        b.congress,
        b.bill_type,
        b.bill_number,
        b.title,
        b.origin_chamber,
        b.introduced_date,
        b.latest_action_date,
        b.latest_action_text,
        b.sponsor_bioguide_id,
        m.first_name,
        m.last_name,
        m.party,
        m.state
      FROM bills b
      LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
      WHERE 1=1
    `;

    const bindings: any[] = [];

    // Add filters
    if (query) {
      sql += ` AND (b.title LIKE ? OR b.latest_action_text LIKE ?)`;
      bindings.push(`%${query}%`, `%${query}%`);
    }

    if (congress) {
      sql += ` AND b.congress = ?`;
      bindings.push(congress);
    }

    if (billType) {
      sql += ` AND b.bill_type = ?`;
      bindings.push(billType);
    }

    if (sponsor) {
      sql += ` AND b.sponsor_bioguide_id = ?`;
      bindings.push(sponsor);
    }

    if (subject) {
      // Join with subjects
      sql = sql.replace('WHERE 1=1', `
        INNER JOIN bill_subjects bs ON b.id = bs.bill_id
        INNER JOIN subjects s ON bs.subject_id = s.id
        WHERE s.name LIKE ?
      `);
      bindings.push(`%${subject}%`);
    }

    // Add sorting
    const sortColumn = sort === 'latest_action_date' ? 'b.latest_action_date'
      : sort === 'introduced_date' ? 'b.introduced_date'
      : 'b.title';

    sql += ` ORDER BY ${sortColumn} ${order.toUpperCase()}`;

    // Add pagination
    sql += ` LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    // Execute query
    const result = await db.prepare(sql).bind(...bindings).all();

    // Get total count for pagination
    let countSql = `
      SELECT COUNT(*) as total
      FROM bills b
      LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
      WHERE 1=1
    `;

    const countBindings: any[] = [];

    if (query) {
      countSql += ` AND (b.title LIKE ? OR b.latest_action_text LIKE ?)`;
      countBindings.push(`%${query}%`, `%${query}%`);
    }

    if (congress) {
      countSql += ` AND b.congress = ?`;
      countBindings.push(congress);
    }

    if (billType) {
      countSql += ` AND b.bill_type = ?`;
      countBindings.push(billType);
    }

    if (sponsor) {
      countSql += ` AND b.sponsor_bioguide_id = ?`;
      countBindings.push(sponsor);
    }

    if (subject) {
      countSql = countSql.replace('WHERE 1=1', `
        INNER JOIN bill_subjects bs ON b.id = bs.bill_id
        INNER JOIN subjects s ON bs.subject_id = s.id
        WHERE s.name LIKE ?
      `);
      countBindings.push(`%${subject}%`);
    }

    const countResult = await db.prepare(countSql).bind(...countBindings).first();
    const total = countResult?.total as number || 0;

    // Format results
    const bills = result.results?.map((row: any) => ({
      id: row.id,
      congress: row.congress,
      type: row.bill_type,
      number: row.bill_number,
      title: row.title,
      originChamber: row.origin_chamber,
      introducedDate: row.introduced_date,
      latestAction: {
        date: row.latest_action_date,
        text: row.latest_action_text
      },
      sponsor: row.sponsor_bioguide_id ? {
        bioguideId: row.sponsor_bioguide_id,
        firstName: row.first_name,
        lastName: row.last_name,
        party: row.party,
        state: row.state
      } : null
    })) || [];

    return c.json({
      success: true,
      bills,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error('Bill search error:', error);
    return c.json({
      error: 'Bill search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /bills/by-interests
 * Get bills filtered by user interests (Environment, Health, Economy, etc.)
 *
 * Body: {
 *   interests: string[],     // Array of interest names (e.g., ["Environment & Energy", "Health & Social Welfare"])
 *   useKeywords: boolean,    // Include keyword matching in addition to policy areas (default: false)
 *   limit: number,
 *   offset: number,
 *   sort: 'latest_action_date' | 'introduced_date' | 'title',
 *   order: 'asc' | 'desc'
 * }
 */
app.post('/bills/by-interests', async (c) => {
  try {
    const db = c.env.APP_DB;

    // Parse and validate body
    const body = await c.req.json();
    const validation = InterestBillsSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: 'Invalid parameters', details: validation.error.errors }, 400);
    }

    const { interests, useKeywords, limit, offset, sort, order } = validation.data;

    // Validate interest names
    const validInterests = getInterestNames();
    const invalidInterests = interests.filter(i => !validInterests.includes(i));
    if (invalidInterests.length > 0) {
      return c.json({
        error: 'Invalid interest names',
        invalidInterests,
        validInterests
      }, 400);
    }

    // Build WHERE clause from interests
    const interestFilter = buildBillFilterQuery(interests, useKeywords);

    // Build SQL query
    let sql = `
      SELECT
        b.id,
        b.congress,
        b.bill_type,
        b.bill_number,
        b.title,
        b.policy_area,
        b.origin_chamber,
        b.introduced_date,
        b.latest_action_date,
        b.latest_action_text,
        b.sponsor_bioguide_id,
        m.first_name,
        m.last_name,
        m.party,
        m.state
      FROM bills b
      LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
      WHERE ${interestFilter}
    `;

    // Add sorting
    const sortColumn = sort === 'latest_action_date' ? 'b.latest_action_date'
      : sort === 'introduced_date' ? 'b.introduced_date'
      : 'b.title';

    sql += ` ORDER BY ${sortColumn} ${order.toUpperCase()}`;

    // Add pagination
    sql += ` LIMIT ? OFFSET ?`;

    // Execute query
    const result = await db.prepare(sql).bind(limit, offset).all();

    // Get total count for pagination
    let countSql = `
      SELECT COUNT(*) as total
      FROM bills b
      WHERE ${interestFilter}
    `;

    const countResult = await db.prepare(countSql).first();
    const total = countResult?.total as number || 0;

    // Format results
    const bills = result.results?.map((row: any) => ({
      id: row.id,
      congress: row.congress,
      type: row.bill_type,
      number: row.bill_number,
      title: row.title,
      policyArea: row.policy_area,
      originChamber: row.origin_chamber,
      introducedDate: row.introduced_date,
      latestAction: {
        date: row.latest_action_date,
        text: row.latest_action_text
      },
      sponsor: row.sponsor_bioguide_id ? {
        bioguideId: row.sponsor_bioguide_id,
        firstName: row.first_name,
        lastName: row.last_name,
        party: row.party,
        state: row.state
      } : null
    })) || [];

    return c.json({
      success: true,
      bills,
      interests,
      matchMethod: useKeywords ? 'policy_areas_and_keywords' : 'policy_areas_only',
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error('Interest-based bill search error:', error);
    return c.json({
      error: 'Interest-based bill search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /bills/interests
 * Get list of available interest categories
 */
app.get('/bills/interests', (c) => {
  const interests = getInterestNames();
  return c.json({
    success: true,
    interests,
    count: interests.length
  });
});

/**
 * GET /bills/:congress/:type/:number
 * Get bill details
 */
app.get('/bills/:congress/:type/:number', async (c) => {
  try {
    const db = c.env.APP_DB;

    const congress = parseInt(c.req.param('congress'));
    const billType = c.req.param('type');
    const billNumber = parseInt(c.req.param('number'));

    // Get bill with sponsor details (including new metadata)
    const bill = await db
      .prepare(`
        SELECT
          b.*,
          m.first_name,
          m.middle_name,
          m.last_name,
          m.party,
          m.state,
          m.district,
          m.image_url
        FROM bills b
        LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
        WHERE b.congress = ? AND b.bill_type = ? AND b.bill_number = ?
      `)
      .bind(congress, billType, billNumber)
      .first();

    if (!bill) {
      return c.json({ error: 'Bill not found' }, 404);
    }

    // Get cosponsors
    const cosponsors = await db
      .prepare(`
        SELECT
          m.bioguide_id,
          m.first_name,
          m.last_name,
          m.party,
          m.state,
          m.district,
          bc.cosponsor_date
        FROM bill_cosponsors bc
        INNER JOIN members m ON bc.member_bioguide_id = m.bioguide_id
        WHERE bc.bill_id = ?
        ORDER BY bc.cosponsor_date ASC
      `)
      .bind(bill.id)
      .all();

    // TODO: Get actions, subjects, committees when tables are created
    // For now, return empty arrays
    const actions = { results: [] };
    const subjects = { results: [] };
    const committees = { results: [] };

    // Format response
    const response = {
      id: bill.id,
      congress: bill.congress,
      type: bill.bill_type,
      number: bill.bill_number,
      title: bill.title,
      originChamber: bill.origin_chamber,
      introducedDate: bill.introduced_date,
      latestAction: {
        date: bill.latest_action_date,
        text: bill.latest_action_text
      },
      sponsor: bill.sponsor_bioguide_id ? {
        bioguideId: bill.sponsor_bioguide_id,
        firstName: bill.first_name,
        middleName: bill.middle_name,
        lastName: bill.last_name,
        fullName: [bill.first_name, bill.middle_name, bill.last_name].filter(Boolean).join(' '),
        party: bill.party,
        state: bill.state,
        district: bill.district,
        imageUrl: bill.image_url
      } : null,
      cosponsors: cosponsors.results?.map((row: any) => ({
        bioguideId: row.bioguide_id,
        firstName: row.first_name,
        lastName: row.last_name,
        party: row.party,
        state: row.state,
        district: row.district,
        cosponsorDate: row.cosponsor_date
      })) || [],
      actions: actions.results?.map((row: any) => ({
        date: row.action_date,
        text: row.action_text,
        time: row.action_time
      })) || [],
      subjects: subjects.results?.map((row: any) => row.name) || [],
      committees: committees.results?.map((row: any) => ({
        id: row.id,
        name: row.name,
        chamber: row.chamber
      })) || [],
      text: bill.text,
      updateDate: bill.update_date
    };

    return c.json({
      success: true,
      bill: response
    });
  } catch (error) {
    console.error('Get bill error:', error);
    return c.json({
      error: 'Failed to get bill',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /bills/track
 * Track a bill (requires auth)
 */
app.post('/bills/track', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;

    // Validate input
    const body = await c.req.json();
    const validation = TrackBillSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: 'Invalid input', details: validation.error.errors }, 400);
    }

    const { billId, title, congress, billType, billNumber } = validation.data;

    // Check if already tracking
    const existing = await db
      .prepare('SELECT id FROM tracked_bills WHERE user_id = ? AND bill_id = ?')
      .bind(auth.userId, billId)
      .first();

    if (existing) {
      return c.json({ error: 'Bill already tracked' }, 409);
    }

    // Add to tracked bills
    const id = crypto.randomUUID();
    await db
      .prepare(`
        INSERT INTO tracked_bills (
          id, user_id, bill_id, title, congress, bill_type, bill_number,
          added_at, views, shares, bookmarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(id, auth.userId, billId, title, congress, billType, billNumber, Date.now(), 0, 0, 0)
      .run();

    console.log(`✓ Bill tracked: ${billType}${billNumber} by user ${auth.userId}`);

    return c.json({
      success: true,
      message: 'Bill tracked successfully',
      trackingId: id
    }, 201);
  } catch (error) {
    console.error('Track bill error:', error);
    return c.json({
      error: 'Failed to track bill',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * DELETE /bills/track/:trackingId
 * Untrack a bill (requires auth)
 */
app.delete('/bills/track/:trackingId', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const trackingId = c.req.param('trackingId');

    // Verify ownership
    const tracked = await db
      .prepare('SELECT user_id FROM tracked_bills WHERE id = ?')
      .bind(trackingId)
      .first();

    if (!tracked) {
      return c.json({ error: 'Tracked bill not found' }, 404);
    }

    if (tracked.user_id !== auth.userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Delete
    await db
      .prepare('DELETE FROM tracked_bills WHERE id = ?')
      .bind(trackingId)
      .run();

    console.log(`✓ Bill untracked: ${trackingId} by user ${auth.userId}`);

    return c.json({
      success: true,
      message: 'Bill untracked successfully'
    });
  } catch (error) {
    console.error('Untrack bill error:', error);
    return c.json({
      error: 'Failed to untrack bill',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /bills/tracked
 * Get user's tracked bills (requires auth)
 */
app.get('/bills/tracked', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;

    // Get tracked bills with latest bill data
    const result = await db
      .prepare(`
        SELECT
          t.id as tracking_id,
          t.bill_id,
          t.added_at,
          t.views,
          t.shares,
          t.bookmarks,
          b.congress,
          b.bill_type,
          b.bill_number,
          b.title,
          b.latest_action_date,
          b.latest_action_text,
          b.sponsor_bioguide_id,
          m.first_name,
          m.last_name,
          m.party,
          m.state
        FROM tracked_bills t
        INNER JOIN bills b ON t.bill_id = b.id
        LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
        WHERE t.user_id = ?
        ORDER BY t.added_at DESC
      `)
      .bind(auth.userId)
      .all();

    const trackedBills = result.results?.map((row: any) => ({
      trackingId: row.tracking_id,
      billId: row.bill_id,
      addedAt: row.added_at,
      views: row.views,
      shares: row.shares,
      bookmarks: row.bookmarks,
      bill: {
        congress: row.congress,
        type: row.bill_type,
        number: row.bill_number,
        title: row.title,
        latestAction: {
          date: row.latest_action_date,
          text: row.latest_action_text
        },
        sponsor: row.sponsor_bioguide_id ? {
          bioguideId: row.sponsor_bioguide_id,
          firstName: row.first_name,
          lastName: row.last_name,
          party: row.party,
          state: row.state
        } : null
      }
    })) || [];

    return c.json({
      success: true,
      trackedBills,
      count: trackedBills.length
    });
  } catch (error) {
    console.error('Get tracked bills error:', error);
    return c.json({
      error: 'Failed to get tracked bills',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /bills/track/:trackingId/view
 * Increment view count (requires auth)
 */
app.post('/bills/track/:trackingId/view', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const trackingId = c.req.param('trackingId');

    // Verify ownership
    const tracked = await db
      .prepare('SELECT user_id, views FROM tracked_bills WHERE id = ?')
      .bind(trackingId)
      .first();

    if (!tracked) {
      return c.json({ error: 'Tracked bill not found' }, 404);
    }

    if (tracked.user_id !== auth.userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Increment views
    const newViews = (tracked.views as number) + 1;
    await db
      .prepare('UPDATE tracked_bills SET views = ? WHERE id = ?')
      .bind(newViews, trackingId)
      .run();

    return c.json({
      success: true,
      views: newViews
    });
  } catch (error) {
    console.error('Increment view error:', error);
    return c.json({
      error: 'Failed to increment view',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * MEMBER ENDPOINTS
 */

/**
 * GET /members/search
 * Search for members with filters
 */
app.get('/members/search', async (c) => {
  try {
    const rawParams = {
      query: c.req.query('query'),
      party: c.req.query('party'),
      state: c.req.query('state'),
      chamber: c.req.query('chamber') as 'house' | 'senate' | undefined,
      currentOnly: c.req.query('currentOnly') === 'false' ? false : true,
      limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20,
      offset: c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0,
      sort: (c.req.query('sort') as 'last_name' | 'state' | 'party' | undefined) || 'last_name',
      order: (c.req.query('order') as 'asc' | 'desc' | undefined) || 'asc'
    };

    const params = SearchMembersSchema.parse(rawParams);
    const db = c.env.APP_DB;

    // Build WHERE clause
    const conditions: string[] = [];
    const bindings: any[] = [];

    if (params.currentOnly) {
      conditions.push('current_member = 1');
    }

    if (params.query) {
      conditions.push(`(
        first_name LIKE ? OR
        last_name LIKE ? OR
        state LIKE ? OR
        party LIKE ?
      )`);
      const searchTerm = `%${params.query}%`;
      bindings.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (params.party) {
      conditions.push('party = ?');
      bindings.push(params.party);
    }

    if (params.state) {
      conditions.push('state = ?');
      bindings.push(params.state);
    }

    if (params.chamber) {
      if (params.chamber === 'house') {
        conditions.push('district IS NOT NULL');
      } else {
        conditions.push('district IS NULL');
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM members ${whereClause}`;
    const countResult = await db.prepare(countQuery).bind(...bindings).first() as any;
    const total = countResult?.total || 0;

    // Get members
    const membersQuery = `
      SELECT
        bioguide_id,
        first_name,
        middle_name,
        last_name,
        party,
        state,
        district,
        image_url,
        current_member,
        current_term_type,
        current_term_start,
        current_term_end
      FROM members
      ${whereClause}
      ORDER BY ${params.sort} ${params.order}
      LIMIT ? OFFSET ?
    `;

    const membersResult = await db
      .prepare(membersQuery)
      .bind(...bindings, params.limit, params.offset)
      .all();

    const members = (membersResult.results || []).map((m: any) => ({
      bioguideId: m.bioguide_id,
      firstName: m.first_name,
      middleName: m.middle_name,
      lastName: m.last_name,
      fullName: [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' '),
      party: m.party,
      state: m.state,
      district: m.district,
      chamber: m.district !== null ? 'House' : 'Senate',
      imageUrl: m.image_url,
      currentMember: m.current_member === 1,
      currentTerm: m.current_term_type ? {
        type: m.current_term_type,
        start: m.current_term_start,
        end: m.current_term_end
      } : null
    }));

    return c.json({
      success: true,
      members,
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset,
        hasMore: params.offset + params.limit < total
      }
    });

  } catch (error: any) {
    console.error('Member search failed:', error);
    return c.json({
      error: 'Member search failed',
      message: error.message
    }, 500);
  }
});

/**
 * GET /members/states
 * Get list of states with member counts
 */
app.get('/members/states', async (c) => {
  try {
    const db = c.env.APP_DB;
    const currentOnly = c.req.query('currentOnly') !== 'false';

    const whereClause = currentOnly ? 'WHERE current_member = 1' : '';

    const result = await db
      .prepare(`
        SELECT
          state,
          COUNT(*) as count,
          SUM(CASE WHEN district IS NULL THEN 1 ELSE 0 END) as senators,
          SUM(CASE WHEN district IS NOT NULL THEN 1 ELSE 0 END) as representatives
        FROM members
        ${whereClause}
        GROUP BY state
        ORDER BY state
      `)
      .all();

    return c.json({
      success: true,
      states: result.results || []
    });

  } catch (error: any) {
    console.error('Failed to get states:', error);
    return c.json({
      error: 'Failed to get states',
      message: error.message
    }, 500);
  }
});

/**
 * GET /members/parties
 * Get list of parties with member counts
 */
app.get('/members/parties', async (c) => {
  try {
    const db = c.env.APP_DB;
    const currentOnly = c.req.query('currentOnly') !== 'false';

    const whereClause = currentOnly ? 'WHERE current_member = 1' : '';

    const result = await db
      .prepare(`
        SELECT
          party,
          COUNT(*) as count
        FROM members
        ${whereClause}
        GROUP BY party
        ORDER BY count DESC
      `)
      .all();

    return c.json({
      success: true,
      parties: result.results || []
    });

  } catch (error: any) {
    console.error('Failed to get parties:', error);
    return c.json({
      error: 'Failed to get parties',
      message: error.message
    }, 500);
  }
});

/**
 * GET /members/:bioguide_id
 * Get full member profile with all details
 */
app.get('/members/:bioguide_id', async (c) => {
  try {
    const bioguideId = c.req.param('bioguide_id');
    const db = c.env.APP_DB;

    // Get member with all fields
    const member = await db
      .prepare(`
        SELECT * FROM members WHERE bioguide_id = ?
      `)
      .bind(bioguideId)
      .first() as any;

    if (!member) {
      return c.json({
        error: 'Member not found',
        message: `No member found with bioguide_id: ${bioguideId}`
      }, 404);
    }

    // Get sponsored bills
    const sponsoredBills = await db
      .prepare(`
        SELECT
          id,
          congress,
          bill_type,
          bill_number,
          title,
          introduced_date,
          latest_action_date,
          latest_action_text
        FROM bills
        WHERE sponsor_bioguide_id = ?
        ORDER BY introduced_date DESC
        LIMIT 10
      `)
      .bind(bioguideId)
      .all();

    // TODO: Get cosponsored bills when we add cosponsors tracking
    // TODO: Get committee assignments when committees table is created

    // Parse FEC IDs if present
    let fecIds: string[] = [];
    if (member.fec_ids) {
      try {
        fecIds = JSON.parse(member.fec_ids);
      } catch {
        fecIds = [member.fec_ids];
      }
    }

    // Build response
    const response = {
      success: true,
      member: {
        // Basic Info
        bioguideId: member.bioguide_id,
        firstName: member.first_name,
        middleName: member.middle_name,
        lastName: member.last_name,
        fullName: [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(' '),
        officialFullName: member.official_full_name,
        nickname: member.nickname,
        suffix: member.suffix,

        // Political Info
        party: member.party,
        state: member.state,
        district: member.district,
        chamber: member.district !== null ? 'House' : 'Senate',
        currentMember: member.current_member === 1,

        // Biographical Info
        gender: member.gender,
        birthDate: member.birth_date,
        birthYear: member.birth_year,
        birthPlace: member.birth_place,
        deathYear: member.death_year,

        // Contact Info
        url: member.url,
        officeAddress: member.office_address,
        phoneNumber: member.phone_number,
        imageUrl: member.image_url,

        // Current Term
        currentTerm: member.current_term_type ? {
          type: member.current_term_type,
          start: member.current_term_start,
          end: member.current_term_end,
          state: member.current_term_state,
          district: member.current_term_district,
          class: member.current_term_class,
          stateRank: member.current_term_state_rank
        } : null,

        // External IDs
        ids: {
          thomas: member.thomas_id,
          lis: member.lis_id,
          govtrack: member.govtrack_id,
          opensecrets: member.opensecrets_id,
          votesmart: member.votesmart_id,
          fec: fecIds,
          cspan: member.cspan_id,
          wikipedia: member.wikipedia_id,
          houseHistory: member.house_history_id,
          ballotpedia: member.ballotpedia_id,
          maplight: member.maplight_id,
          icpsr: member.icpsr_id,
          wikidata: member.wikidata_id,
          googleEntity: member.google_entity_id
        },

        // Social Media
        socialMedia: {
          twitter: member.twitter_handle,
          facebook: member.facebook_url,
          youtube: member.youtube_url,
          instagram: member.instagram_handle,
          website: member.website_url,
          contactForm: member.contact_form_url,
          rss: member.rss_url
        },

        // Legislative Activity
        sponsoredBills: (sponsoredBills.results || []).map((bill: any) => ({
          id: bill.id,
          congress: bill.congress,
          billType: bill.bill_type,
          billNumber: bill.bill_number,
          title: bill.title,
          introducedDate: bill.introduced_date,
          latestActionDate: bill.latest_action_date,
          latestActionText: bill.latest_action_text
        })),
        sponsoredBillsCount: sponsoredBills.results?.length || 0,

        // TODO: Add when data available
        cosponsoredBills: [],
        committees: []
      }
    };

    return c.json(response);

  } catch (error: any) {
    console.error('Failed to get member:', error);
    return c.json({
      error: 'Failed to get member',
      message: error.message
    }, 500);
  }
});

/**
 * GET /members/:bioguide_id/cosponsored-legislation
 * Get all bills co-sponsored by a specific member
 */
app.get('/members/:bioguide_id/cosponsored-legislation', async (c) => {
  try {
    const bioguideId = c.req.param('bioguide_id');
    const db = c.env.APP_DB;
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    console.log(`[CosponsoredBills] Fetching for bioguide_id: ${bioguideId}, limit: ${limit}, offset: ${offset}`);

    // Get co-sponsored bills with bill details
    const cosponsoredBills = await db
      .prepare(`
        SELECT
          b.id,
          b.congress,
          b.bill_type,
          b.bill_number,
          b.title,
          b.introduced_date,
          b.latest_action_date,
          b.latest_action_text,
          b.sponsor_bioguide_id,
          bc.cosponsor_date,
          m.first_name as sponsor_first_name,
          m.last_name as sponsor_last_name,
          m.party as sponsor_party,
          m.state as sponsor_state
        FROM bill_cosponsors bc
        JOIN bills b ON bc.bill_id = b.id
        LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
        WHERE bc.member_bioguide_id = ?
        ORDER BY bc.cosponsor_date DESC
        LIMIT ? OFFSET ?
      `)
      .bind(bioguideId, limit, offset)
      .all();

    // Get total count
    const countResult = await db
      .prepare(`
        SELECT COUNT(*) as total
        FROM bill_cosponsors
        WHERE member_bioguide_id = ?
      `)
      .bind(bioguideId)
      .first() as any;

    const total = countResult?.total || 0;

    console.log(`[CosponsoredBills] Found ${total} total, returning ${cosponsoredBills.results?.length || 0} results`);

    return c.json({
      success: true,
      cosponsoredBills: (cosponsoredBills.results || []).map((bill: any) => ({
        id: bill.id,
        congress: bill.congress,
        billType: bill.bill_type,
        billNumber: bill.bill_number,
        title: bill.title,
        introducedDate: bill.introduced_date,
        latestActionDate: bill.latest_action_date,
        latestActionText: bill.latest_action_text,
        cosponsorDate: bill.cosponsor_date,
        sponsor: {
          bioguideId: bill.sponsor_bioguide_id,
          firstName: bill.sponsor_first_name,
          lastName: bill.sponsor_last_name,
          fullName: [bill.sponsor_first_name, bill.sponsor_last_name].filter(Boolean).join(' '),
          party: bill.sponsor_party,
          state: bill.sponsor_state
        }
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error: any) {
    console.error('[CosponsoredBills] Failed to get cosponsored bills:', error);
    return c.json({
      error: 'Failed to get cosponsored bills',
      message: error.message
    }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
