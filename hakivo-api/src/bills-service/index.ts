import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import { z } from 'zod';
import { buildBillFilterQuery, getInterestNames } from '../config/user-interests';
import { aggregateByIndustry, type IndustryContribution } from '../fec-client/industry-classifier';

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
  billId: z.string(), // bill_id is TEXT (e.g., "119-hr-1234")
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

const StateBillsSchema = z.object({
  state: z.string().length(2).toUpperCase(),
  subject: z.string().optional(),
  query: z.string().optional(),
  chamber: z.enum(['upper', 'lower']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sort: z.enum(['latest_action_date', 'identifier']).default('latest_action_date'),
  order: z.enum(['asc', 'desc']).default('desc')
});

// State code to full name mapping
const STATE_CODE_TO_NAME: Record<string, string> = {
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
  DC: 'District of Columbia', PR: 'Puerto Rico', VI: 'Virgin Islands', GU: 'Guam',
  AS: 'American Samoa', MP: 'Northern Mariana Islands'
};

/**
 * Convert state input to full name for database query
 * Handles both abbreviations (WI) and full names (Wisconsin)
 */
function normalizeStateName(state: string): string {
  const upper = state.toUpperCase();
  // Check if it's a state code
  if (STATE_CODE_TO_NAME[upper]) {
    return STATE_CODE_TO_NAME[upper];
  }
  // Otherwise assume it's already a full name
  return state;
}

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());

// Custom CORS middleware - handles OPTIONS at the earliest possible point
app.use('*', async (c, next) => {
  const allowedOrigins = [
    'https://hakivo-v2.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];

  const origin = c.req.header('Origin') || '';
  const isAllowed = allowedOrigins.includes(origin) || origin.startsWith('https://hakivo-v2');

  // Set CORS headers on EVERY response
  if (isAllowed) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
  } else {
    c.header('Access-Control-Allow-Origin', '*');
  }

  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  c.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  c.header('Access-Control-Max-Age', '600');

  // Handle preflight immediately - return 204 before any other processing
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: c.res.headers
    });
  }

  await next();
});

/**
 * Verify JWT token from auth header
 */
async function verifyAuth(authHeader: string | undefined, jwtSecret: string): Promise<{ userId: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  // Use jose to verify token
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
  return c.json({ status: 'ok', service: 'bills-service', timestamp: new Date().toISOString() });
});

/**
 * POST /bills/semantic-search
 * Semantic search for bills using SmartBucket vector search
 *
 * Body: {
 *   query: string,           // Natural language query (e.g., "healthcare reform bills")
 *   limit: number,           // Max results (default: 10, max: 50)
 *   congress: number         // Optional: filter by congress (e.g., 119)
 * }
 */
app.post('/bills/semantic-search', async (c) => {
  try {
    const body = await c.req.json();
    const { query, limit = 10, congress } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return c.json({ error: 'Query is required' }, 400);
    }

    const searchLimit = Math.min(limit, 50);
    const db = c.env.APP_DB;

    // SmartBucket search temporarily disabled - using regular Bucket
    // TODO: Re-enable when SmartBucket index creation is fixed
    // For now, fall back to SQL LIKE search
    const sqlQuery = `
      SELECT DISTINCT b.id, b.congress, b.bill_type, b.bill_number, b.title,
             b.short_title, b.status, b.introduced_date, b.sponsor_bioguide_id
      FROM bills b
      WHERE b.title LIKE ? OR b.short_title LIKE ?
      LIMIT ?
    `;
    const searchPattern = `%${query}%`;
    const fallbackResults = await db.prepare(sqlQuery).bind(searchPattern, searchPattern, searchLimit).all();

    return c.json({
      success: true,
      query,
      bills: fallbackResults.results || [],
      count: fallbackResults.results?.length || 0,
      note: 'Using fallback text search - semantic search temporarily disabled'
    });

  } catch (error) {
    console.error('Semantic search error:', error);
    return c.json({
      error: 'Semantic search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /bills/smart-query
 * Natural language to SQL query using SmartSQL AI translation
 *
 * Body: {
 *   query: string,           // Natural language query (e.g., "show me healthcare bills from 2024")
 *   format: 'json' | 'csv'   // Response format (default: 'json')
 * }
 *
 * Architecture: SmartSQL handles AI translation, app-db stores the actual data.
 * 1. SmartSQL translates natural language to SQL using schema metadata
 * 2. The generated SQL is executed against app-db where bills data lives
 */
app.post('/bills/smart-query', async (c) => {
  try {
    const body = await c.req.json();
    const { query, format = 'json' } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return c.json({ error: 'Query is required' }, 400);
    }

    const smartSql = c.env.CONGRESSIONAL_DB;
    const appDb = c.env.APP_DB;

    // Ensure SmartSQL knows about our schema using 'replace' mode
    // This fully overrides any pre-existing metadata
    // NOTE: Schema matches actual deployed database (congress not congress_id)
    await smartSql.updateMetadata([
      {
        tableName: 'bills',
        columns: [
          { columnName: 'id', dataType: 'TEXT', isPrimaryKey: true, nullable: false, sampleData: 'hr-119-1234' },
          { columnName: 'congress', dataType: 'INTEGER', sampleData: '119', nullable: false, isPrimaryKey: false },
          { columnName: 'bill_type', dataType: 'TEXT', sampleData: 'hr', nullable: false, isPrimaryKey: false },
          { columnName: 'bill_number', dataType: 'INTEGER', sampleData: '1234', nullable: false, isPrimaryKey: false },
          { columnName: 'title', dataType: 'TEXT', sampleData: 'To provide healthcare coverage', nullable: true, isPrimaryKey: false },
          { columnName: 'origin_chamber', dataType: 'TEXT', sampleData: 'House', nullable: true, isPrimaryKey: false },
          { columnName: 'introduced_date', dataType: 'TEXT', sampleData: '2025-01-15', nullable: true, isPrimaryKey: false },
          { columnName: 'latest_action_date', dataType: 'TEXT', sampleData: '2025-02-01', nullable: true, isPrimaryKey: false },
          { columnName: 'latest_action_text', dataType: 'TEXT', sampleData: 'Referred to committee', nullable: true, isPrimaryKey: false },
          { columnName: 'sponsor_bioguide_id', dataType: 'TEXT', sampleData: 'P000197', nullable: true, isPrimaryKey: false },
          { columnName: 'policy_area', dataType: 'TEXT', sampleData: 'Health', nullable: true, isPrimaryKey: false },
        ]
      },
      {
        tableName: 'members',
        columns: [
          { columnName: 'bioguide_id', dataType: 'TEXT', isPrimaryKey: true, nullable: false },
          { columnName: 'first_name', dataType: 'TEXT', sampleData: 'Nancy', nullable: true, isPrimaryKey: false },
          { columnName: 'last_name', dataType: 'TEXT', sampleData: 'Pelosi', nullable: true, isPrimaryKey: false },
          { columnName: 'party', dataType: 'TEXT', sampleData: 'Democrat', nullable: true, isPrimaryKey: false },
          { columnName: 'state', dataType: 'TEXT', sampleData: 'CA', nullable: true, isPrimaryKey: false },
          { columnName: 'district', dataType: 'INTEGER', sampleData: '11', nullable: true, isPrimaryKey: false },
          { columnName: 'current_member', dataType: 'INTEGER', sampleData: '1', nullable: true, isPrimaryKey: false },
        ]
      }
    ], 'replace');

    // Use SmartSQL to translate natural language to SQL
    const translationResult = await smartSql.executeQuery({
      textQuery: query,
      format: 'json'
    });

    let generatedSql = translationResult.queryExecuted;
    const aiReasoning = translationResult.aiReasoning;

    if (!generatedSql) {
      return c.json({
        success: false,
        error: 'Failed to translate query to SQL',
        query,
        aiReasoning
      }, 400);
    }

    // Post-process SQL to fix any column name mismatches
    // SmartSQL AI may still use outdated column names from cached model
    generatedSql = generatedSql
      .replace(/\bcongress_id\b/gi, 'congress')
      .replace(/\bbill_id\b/gi, 'id');

    // Execute the corrected SQL against app-db where actual data lives
    const dbResult = await appDb.prepare(generatedSql).all();

    return c.json({
      success: true,
      query,
      queryExecuted: generatedSql,
      aiReasoning,
      results: dbResult.results || [],
      count: dbResult.results?.length || 0,
      message: `Found ${dbResult.results?.length || 0} results`
    });

  } catch (error) {
    console.error('SmartSQL query error:', error);
    return c.json({
      error: 'SmartSQL query failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /bills/:id
 * Get bill by database ID (simpler endpoint than congress/type/number)
 */
app.get('/bills/:id', async (c, next) => {
  const billId = c.req.param('id');

  // Skip reserved paths that should be handled by later routes
  const reservedPaths = ['search', 'interests', 'tracked', 'by-interests', 'semantic-search', 'smart-query'];
  if (reservedPaths.includes(billId.toLowerCase())) {
    return next();
  }

  try {
    const db = c.env.APP_DB;

    // Get bill with sponsor details
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
        WHERE b.id = ?
      `)
      .bind(billId)
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

    // Get enrichment data
    const enrichment = await db
      .prepare(`
        SELECT
          plain_language_summary,
          reading_time_minutes,
          key_points,
          impact_level,
          bipartisan_score,
          current_stage,
          progress_percentage,
          tags,
          enriched_at,
          model_used,
          status
        FROM bill_enrichment
        WHERE bill_id = ?
      `)
      .bind(bill.id)
      .first();

    // Format response
    const response: any = {
      id: bill.id,
      congress: bill.congress,
      type: bill.bill_type,
      number: bill.bill_number,
      title: bill.title,
      policyArea: bill.policy_area,
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
      text: bill.text,
      updateDate: bill.update_date
    };

    // Add enrichment data if available
    if (enrichment) {
      response.enrichment = {
        plainLanguageSummary: enrichment.plain_language_summary,
        readingTimeMinutes: enrichment.reading_time_minutes,
        keyPoints: enrichment.key_points ? JSON.parse(enrichment.key_points as string) : null,
        impactLevel: enrichment.impact_level,
        bipartisanScore: enrichment.bipartisan_score,
        currentStage: enrichment.current_stage,
        progressPercentage: enrichment.progress_percentage,
        tags: enrichment.tags ? JSON.parse(enrichment.tags as string) : null,
        enrichedAt: enrichment.enriched_at,
        modelUsed: enrichment.model_used,
        status: enrichment.status
      };
    }

    return c.json({
      success: true,
      bill: response
    });
  } catch (error) {
    console.error('Get bill by ID error:', error);
    return c.json({
      error: 'Failed to get bill',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
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
 * Get bill details - auto-fetches from Congress.gov if not in database
 */
app.get('/bills/:congress/:type/:number', async (c) => {
  try {
    const db = c.env.APP_DB;
    const congressApiClient = c.env.CONGRESS_API_CLIENT;

    const congress = parseInt(c.req.param('congress'));
    const billType = c.req.param('type').toLowerCase();
    const billNumber = parseInt(c.req.param('number'));
    const autoFetch = c.req.query('autoFetch') !== 'false'; // Default to true

    // Get bill with sponsor details (including new metadata)
    let bill = await db
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

    // If bill not found and autoFetch is enabled, try to fetch from Congress.gov
    if (!bill && autoFetch) {
      console.log(`📥 Bill ${billType}${billNumber} (Congress ${congress}) not in DB, fetching from Congress.gov...`);

      try {
        // Fetch bill details from Congress.gov API
        const apiResponse = await congressApiClient.getBillDetails(congress, billType, billNumber);

        if (apiResponse && apiResponse.bill) {
          const apiBill = apiResponse.bill;

          // Generate bill ID (lowercase for consistency)
          const billId = `${congress}-${billType.toLowerCase()}-${billNumber}`;

          // Extract sponsor info if available
          const sponsorBioguideId = apiBill.sponsors?.[0]?.bioguideId || null;

          // Also fetch bill text (in parallel would be nice but keep it simple)
          console.log(`📄 Fetching bill text for ${billId}...`);
          let billText: string | null = null;
          try {
            billText = await congressApiClient.getBillText(congress, billType, billNumber);
            if (billText) {
              console.log(`✅ Retrieved bill text (${billText.length} chars)`);
            } else {
              console.log(`⚠️ No text available for ${billId}`);
            }
          } catch (textError) {
            console.error(`⚠️ Failed to fetch bill text:`, textError);
          }

          // Insert bill into database (now includes text column)
          await db
            .prepare(`
              INSERT OR REPLACE INTO bills (
                id, congress, bill_type, bill_number, title, origin_chamber,
                introduced_date, latest_action_date, latest_action_text,
                sponsor_bioguide_id, policy_area, update_date, text
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              billId,
              congress,
              billType,
              billNumber,
              apiBill.title || 'Untitled',
              apiBill.originChamber || null,
              apiBill.introducedDate || null,
              apiBill.latestAction?.actionDate || null,
              apiBill.latestAction?.text || null,
              sponsorBioguideId,
              apiBill.policyArea?.name || null,
              apiBill.updateDate || new Date().toISOString().split('T')[0],
              billText
            )
            .run();

          console.log(`✅ Stored bill ${billId} from Congress.gov${billText ? ' (with text)' : ' (no text)'}`);

          // Fetch the newly inserted bill with sponsor details
          bill = await db
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
              WHERE b.id = ?
            `)
            .bind(billId)
            .first();
        }
      } catch (apiError) {
        console.error(`❌ Failed to fetch bill from Congress.gov:`, apiError);
        // Continue - will return 404 below
      }
    }

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

    // Get enrichment data (quick Cerebras summary)
    const enrichment = await db
      .prepare(`
        SELECT
          plain_language_summary,
          reading_time_minutes,
          key_points,
          impact_level,
          bipartisan_score,
          current_stage,
          progress_percentage,
          tags,
          enriched_at,
          model_used,
          status
        FROM bill_enrichment
        WHERE bill_id = ?
      `)
      .bind(bill.id)
      .first();

    // Get deep analysis data (detailed Gemini 3 Pro analysis)
    const analysis = await db
      .prepare(`
        SELECT
          executive_summary,
          status_quo_vs_change,
          section_breakdown,
          mechanism_of_action,
          agency_powers,
          fiscal_impact,
          stakeholder_impact,
          unintended_consequences,
          arguments_for,
          arguments_against,
          implementation_challenges,
          passage_likelihood,
          passage_reasoning,
          recent_developments,
          state_impacts,
          thinking_summary,
          analyzed_at,
          model_used,
          status
        FROM bill_analysis
        WHERE bill_id = ?
      `)
      .bind(bill.id)
      .first();

    // TODO: Get actions, subjects, committees when tables are created
    // For now, return empty arrays
    const actions = { results: [] };
    const subjects = { results: [] };
    const committees = { results: [] };

    // Format response
    const response: any = {
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

    // Add enrichment data if available (quick summary for feed)
    if (enrichment) {
      response.enrichment = {
        plainLanguageSummary: enrichment.plain_language_summary,
        readingTimeMinutes: enrichment.reading_time_minutes,
        keyPoints: enrichment.key_points ? JSON.parse(enrichment.key_points as string) : null,
        impactLevel: enrichment.impact_level,
        bipartisanScore: enrichment.bipartisan_score,
        currentStage: enrichment.current_stage,
        progressPercentage: enrichment.progress_percentage,
        tags: enrichment.tags ? JSON.parse(enrichment.tags as string) : null,
        enrichedAt: enrichment.enriched_at,
        modelUsed: enrichment.model_used,
        status: enrichment.status
      };
    }

    // Add deep analysis if available (detailed Gemini 3 Pro analysis)
    if (analysis) {
      response.analysis = {
        executiveSummary: analysis.executive_summary,
        statusQuoVsChange: analysis.status_quo_vs_change,
        sectionBreakdown: analysis.section_breakdown ? JSON.parse(analysis.section_breakdown as string) : null,
        mechanismOfAction: analysis.mechanism_of_action,
        agencyPowers: analysis.agency_powers ? JSON.parse(analysis.agency_powers as string) : null,
        fiscalImpact: analysis.fiscal_impact ? JSON.parse(analysis.fiscal_impact as string) : null,
        stakeholderImpact: analysis.stakeholder_impact ? JSON.parse(analysis.stakeholder_impact as string) : null,
        unintendedConsequences: analysis.unintended_consequences ? JSON.parse(analysis.unintended_consequences as string) : null,
        argumentsFor: analysis.arguments_for ? JSON.parse(analysis.arguments_for as string) : null,
        argumentsAgainst: analysis.arguments_against ? JSON.parse(analysis.arguments_against as string) : null,
        implementationChallenges: analysis.implementation_challenges ? JSON.parse(analysis.implementation_challenges as string) : null,
        passageLikelihood: analysis.passage_likelihood,
        passageReasoning: analysis.passage_reasoning,
        recentDevelopments: analysis.recent_developments ? JSON.parse(analysis.recent_developments as string) : null,
        stateImpacts: analysis.state_impacts ? JSON.parse(analysis.state_impacts as string) : null,
        thinkingSummary: analysis.thinking_summary,
        analyzedAt: analysis.analyzed_at,
        modelUsed: analysis.model_used,
        status: analysis.status
      };
    }

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
 * POST /bills/:congress/:type/:number/analyze
 * Generate deep AI analysis for a bill (button-triggered)
 * Returns existing analysis if available, otherwise queues analysis job
 */
app.post('/bills/:congress/:type/:number/analyze', async (c) => {
  try {
    const db = c.env.APP_DB;
    const queue = c.env.ENRICHMENT_QUEUE;
    const congressApiClient = c.env.CONGRESS_API_CLIENT;

    const congress = parseInt(c.req.param('congress'));
    const billType = c.req.param('type').toLowerCase(); // Normalize to lowercase
    const billNumber = parseInt(c.req.param('number'));

    // Construct bill_id (lowercase for consistency)
    const billId = `${congress}-${billType}-${billNumber}`;

    // Check if bill exists
    const bill = await db
      .prepare('SELECT id, title, text FROM bills WHERE congress = ? AND bill_type = ? AND bill_number = ?')
      .bind(congress, billType, billNumber)
      .first();

    if (!bill) {
      return c.json({ error: 'Bill not found' }, 404);
    }

    // Check if analysis already exists
    const existingAnalysis = await db
      .prepare('SELECT status, analyzed_at, executive_summary FROM bill_analysis WHERE bill_id = ?')
      .bind(billId)
      .first();

    // If analysis is complete, return it
    if (existingAnalysis && existingAnalysis.status === 'complete') {
      return c.json({
        success: true,
        status: 'complete',
        message: 'Analysis already exists',
        analyzedAt: existingAnalysis.analyzed_at
      });
    }

    // If analysis is in progress, return status
    if (existingAnalysis && existingAnalysis.status === 'processing') {
      return c.json({
        success: true,
        status: 'processing',
        message: 'Analysis is currently being generated'
      });
    }

    // Check if bill has text to analyze
    let billText = bill.text as string | null | undefined;

    // If no text, try to fetch it from Congress.gov
    if (!billText || billText.length < 100) {
      console.log(`📄 Bill ${billId} missing text, fetching from Congress.gov...`);
      try {
        // Congress.gov API requires lowercase bill type
        billText = await congressApiClient.getBillText(congress, billType.toLowerCase(), billNumber);

        if (billText && billText.length >= 100) {
          // Store the text for future use
          await db
            .prepare('UPDATE bills SET text = ? WHERE id = ?')
            .bind(billText, bill.id)
            .run();
          console.log(`✅ Fetched and stored bill text (${billText.length} chars)`);
        }
      } catch (textError) {
        console.error(`❌ Failed to fetch bill text:`, textError);
      }
    }

    // Check again after attempting to fetch
    if (!billText || billText.length < 100) {
      return c.json({
        error: 'Bill text not available for analysis',
        message: 'Cannot analyze bill without full text. The bill text may not yet be published on Congress.gov.'
      }, 400);
    }

    // Create or update analysis record with 'pending' status
    const now = Date.now();
    await db
      .prepare(`
        INSERT INTO bill_analysis (bill_id, executive_summary, analyzed_at, status, started_at)
        VALUES (?, '', ?, 'pending', ?)
        ON CONFLICT(bill_id) DO UPDATE SET
          status = 'pending',
          started_at = excluded.started_at
      `)
      .bind(billId, now, now)
      .run();

    // Queue analysis job for enrichment-observer to process
    await queue.send({
      type: 'deep_analysis_bill',
      bill_id: billId,
      timestamp: new Date().toISOString()
    });

    console.log(`✓ Queued deep analysis for bill ${billId}`);

    return c.json({
      success: true,
      status: 'queued',
      message: 'Analysis job queued successfully. Check back in 30-60 seconds.',
      billId: billId
    });
  } catch (error) {
    console.error('Analyze bill error:', error);
    return c.json({
      error: 'Failed to queue analysis',
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

    const { billId, congress, billType, billNumber } = validation.data;

    // Check if already tracking
    const existing = await db
      .prepare('SELECT id FROM bill_tracking WHERE user_id = ? AND bill_id = ?')
      .bind(auth.userId, billId)
      .first();

    if (existing) {
      return c.json({ error: 'Bill already tracked' }, 409);
    }

    // Add to tracked bills
    const id = crypto.randomUUID();
    await db
      .prepare(`
        INSERT INTO bill_tracking (
          id, user_id, bill_id, bill_congress, bill_type, bill_number,
          tracked_at, notifications_enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(id, auth.userId, billId, congress, billType, billNumber, Date.now(), 1)
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
      .prepare('SELECT user_id FROM bill_tracking WHERE id = ?')
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
      .prepare('DELETE FROM bill_tracking WHERE id = ?')
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
          t.tracked_at,
          t.notifications_enabled,
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
        FROM bill_tracking t
        INNER JOIN bills b ON t.bill_id = b.id
        LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
        WHERE t.user_id = ?
        ORDER BY t.tracked_at DESC
      `)
      .bind(auth.userId)
      .all();

    const trackedBills = result.results?.map((row: any) => ({
      trackingId: row.tracking_id,
      billId: row.bill_id,
      trackedAt: row.tracked_at,
      notificationsEnabled: row.notifications_enabled === 1,
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
 * PUT /bills/track/:trackingId/notifications
 * Toggle notifications for a tracked bill (requires auth)
 */
app.put('/bills/track/:trackingId/notifications', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const trackingId = c.req.param('trackingId');
    const body = await c.req.json();
    const enabled = body.enabled === true ? 1 : 0;

    // Verify ownership
    const tracked = await db
      .prepare('SELECT user_id FROM bill_tracking WHERE id = ?')
      .bind(trackingId)
      .first();

    if (!tracked) {
      return c.json({ error: 'Tracked bill not found' }, 404);
    }

    if (tracked.user_id !== auth.userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Update notifications setting
    await db
      .prepare('UPDATE bill_tracking SET notifications_enabled = ? WHERE id = ?')
      .bind(enabled, trackingId)
      .run();

    return c.json({
      success: true,
      notificationsEnabled: enabled === 1
    });
  } catch (error) {
    console.error('Toggle notifications error:', error);
    return c.json({
      error: 'Failed to toggle notifications',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /bills/:id/tracking-status
 * Check if a bill is tracked by the authenticated user
 */
app.get('/bills/:id/tracking-status', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const billId = c.req.param('id');

    const tracked = await db
      .prepare('SELECT id, notifications_enabled FROM bill_tracking WHERE user_id = ? AND bill_id = ?')
      .bind(auth.userId, billId)
      .first();

    return c.json({
      success: true,
      isTracked: !!tracked,
      trackingId: tracked?.id || null,
      notificationsEnabled: tracked ? tracked.notifications_enabled === 1 : false
    });
  } catch (error) {
    console.error('Check tracking status error:', error);
    return c.json({
      error: 'Failed to check tracking status',
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
      // Database has inconsistent state data - some records use codes (WI), others use full names (Wisconsin)
      // Search for both the original input and the normalized full name
      const stateInput = params.state.toUpperCase();
      const stateName = normalizeStateName(params.state);

      if (stateInput !== stateName.toUpperCase()) {
        // Input was a state code, search for both code and full name
        conditions.push('(state = ? OR state = ?)');
        bindings.push(stateInput, stateName);
      } else {
        // Input was likely already a full name
        conditions.push('state = ?');
        bindings.push(stateName);
      }
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

/**
 * STATE BILLS ENDPOINTS
 */

/**
 * GET /state-bills
 * Get state legislature bills filtered by state and optional criteria
 *
 * Query params:
 *   state: string (required) - 2-letter state code (e.g., "WI", "CA")
 *   subject: string (optional) - Filter by subject/policy area
 *   query: string (optional) - Search in title
 *   chamber: 'upper' | 'lower' (optional) - Filter by legislative chamber
 *   limit: number (optional, default: 20, max: 100)
 *   offset: number (optional, default: 0)
 *   sort: 'latest_action_date' | 'identifier' (optional, default: 'latest_action_date')
 *   order: 'asc' | 'desc' (optional, default: 'desc')
 */
app.get('/state-bills', async (c) => {
  try {
    const db = c.env.APP_DB;

    // Parse query parameters
    const rawParams = {
      state: c.req.query('state')?.toUpperCase(),
      subject: c.req.query('subject'),
      query: c.req.query('query'),
      chamber: c.req.query('chamber') as 'upper' | 'lower' | undefined,
      limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20,
      offset: c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0,
      sort: c.req.query('sort') || 'latest_action_date',
      order: c.req.query('order') || 'desc'
    };

    // Validate parameters
    const validation = StateBillsSchema.safeParse(rawParams);
    if (!validation.success) {
      return c.json({ error: 'Invalid parameters', details: validation.error.errors }, 400);
    }

    const { state, subject, query, chamber, limit, offset, sort, order } = validation.data;

    console.log(`[StateBills] Fetching bills for state: ${state}, limit: ${limit}, offset: ${offset}`);

    // Build WHERE clause
    const conditions: string[] = ['state = ?'];
    const bindings: any[] = [state];

    if (subject) {
      // Search in subjects array (stored as JSON)
      conditions.push(`subjects LIKE ?`);
      bindings.push(`%${subject}%`);
    }

    if (query) {
      conditions.push(`(title LIKE ? OR identifier LIKE ?)`);
      bindings.push(`%${query}%`, `%${query}%`);
    }

    if (chamber) {
      conditions.push(`chamber = ?`);
      bindings.push(chamber);
    }

    const whereClause = conditions.join(' AND ');

    // Determine sort column
    const sortColumn = sort === 'identifier' ? 'identifier' : 'latest_action_date';

    // Get bills with available columns (simplified schema from state-sync-scheduler)
    const billsQuery = `
      SELECT
        sb.id,
        sb.state,
        sb.session_identifier,
        sb.identifier,
        sb.title,
        sb.subjects,
        sb.chamber,
        sb.latest_action_date,
        sb.latest_action_description
      FROM state_bills sb
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${order.toUpperCase()} NULLS LAST
      LIMIT ? OFFSET ?
    `;

    const billsResult = await db
      .prepare(billsQuery)
      .bind(...bindings, limit, offset)
      .all();

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM state_bills sb
      WHERE ${whereClause}
    `;

    const countResult = await db
      .prepare(countQuery)
      .bind(...bindings)
      .first() as any;

    const total = countResult?.total || 0;

    console.log(`[StateBills] Found ${total} total, returning ${billsResult.results?.length || 0} results`);

    // Format response
    const bills = (billsResult.results || []).map((bill: any) => {
      // Parse JSON arrays safely
      let subjects: string[] = [];

      try {
        if (bill.subjects) {
          subjects = typeof bill.subjects === 'string' ? JSON.parse(bill.subjects) : bill.subjects;
        }
      } catch { /* ignore parse errors */ }

      // Build OpenStates URL for external linking
      const stateCode = bill.state?.toLowerCase();
      const session = bill.session_identifier;
      const identifierClean = bill.identifier?.replace(/\s+/g, '');
      const openstatesUrl = stateCode && session && identifierClean
        ? `https://openstates.org/${stateCode}/bills/${session}/${identifierClean}/`
        : null;

      return {
        id: bill.id,
        state: bill.state,
        session: bill.session_identifier,
        identifier: bill.identifier,
        title: bill.title,
        subjects,
        chamber: bill.chamber,
        latestAction: {
          date: bill.latest_action_date,
          description: bill.latest_action_description
        },
        // URL-safe ID for detail page links (encode the OCD ID)
        detailId: encodeURIComponent(bill.id),
        openstatesUrl
      };
    });

    return c.json({
      success: true,
      state,
      bills,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error: any) {
    console.error('[StateBills] Failed to get state bills:', error);
    return c.json({
      error: 'Failed to get state bills',
      message: error.message
    }, 500);
  }
});

/**
 * GET /state-bills/:id
 * Get a specific state bill by its OCD ID
 * Auto-fetches detailed info from OpenStates API if not cached
 */
app.get('/state-bills/:id', async (c) => {
  try {
    const db = c.env.APP_DB;
    const openstatesClient = c.env.OPENSTATES_CLIENT;
    const billId = c.req.param('id');

    // URL decode the bill ID (OCD IDs contain special chars)
    const decodedId = decodeURIComponent(billId);

    console.log(`[StateBills] Fetching bill: ${decodedId}`);

    // Get bill from database
    const bill = await db
      .prepare(`
        SELECT *
        FROM state_bills
        WHERE id = ?
      `)
      .bind(decodedId)
      .first() as any;

    if (!bill) {
      return c.json({ error: 'State bill not found' }, 404);
    }

    // Parse JSON arrays safely
    let subjects: string[] = [];
    let classification: string[] = [];

    try {
      if (bill.subjects) {
        subjects = typeof bill.subjects === 'string' ? JSON.parse(bill.subjects) : bill.subjects;
      }
    } catch { /* ignore */ }

    try {
      if (bill.classification) {
        classification = typeof bill.classification === 'string' ? JSON.parse(bill.classification) : bill.classification;
      }
    } catch { /* ignore */ }

    // Fetch additional details from OpenStates API on-demand
    let sponsors: Array<{ name: string; classification: string }> = [];
    let textVersions: Array<{ url: string; date: string | null; note: string | null; mediaType: string | null }> = [];
    let abstract: string | null = bill.abstract;

    try {
      console.log(`[StateBills] Fetching details from OpenStates API for: ${decodedId}`);
      const details = await openstatesClient.getBillDetails(decodedId);

      if (details) {
        sponsors = details.sponsors || [];
        textVersions = details.textVersions || [];
        abstract = details.abstract || abstract;

        // Generate OpenStates URL from bill ID
        // Format: https://openstates.org/{state}/bills/{session}/{identifier}
        // Extract state from bill ID: ocd-bill/{uuid} doesn't have state, get from DB
      }
    } catch (apiError) {
      console.warn(`[StateBills] Could not fetch OpenStates details: ${apiError}`);
      // Continue with database data only
    }

    // Build OpenStates URL
    const state = bill.state?.toLowerCase();
    const session = bill.session_identifier;
    const identifier = bill.identifier?.replace(/\s+/g, '');
    const openstatesUrl = state && session && identifier
      ? `https://openstates.org/${state}/bills/${session}/${identifier}/`
      : bill.openstates_url;

    return c.json({
      success: true,
      bill: {
        id: bill.id,
        state: bill.state,
        session: bill.session_identifier,
        identifier: bill.identifier,
        title: bill.title,
        subjects,
        classification,
        abstract,
        chamber: bill.chamber,
        latestAction: {
          date: bill.latest_action_date,
          description: bill.latest_action_description
        },
        firstActionDate: bill.first_action_date,
        openstatesUrl,
        sponsors,
        textVersions,
        createdAt: bill.created_at,
        updatedAt: bill.updated_at
      }
    });

  } catch (error: any) {
    console.error('[StateBills] Failed to get state bill:', error);
    return c.json({
      error: 'Failed to get state bill',
      message: error.message
    }, 500);
  }
});

/**
 * POST /state-bills/:id/analyze
 * Generate deep AI analysis for a state bill (button-triggered)
 * Returns existing analysis if available, otherwise queues analysis job
 */
app.post('/state-bills/:id/analyze', async (c) => {
  try {
    const db = c.env.APP_DB;
    const queue = c.env.ENRICHMENT_QUEUE;
    const openstatesClient = c.env.OPENSTATES_CLIENT;

    const billId = decodeURIComponent(c.req.param('id'));

    console.log(`[StateBillAnalyze] Analyzing: ${billId}`);

    // Check if bill exists
    const bill = await db
      .prepare('SELECT id, identifier, title, full_text, full_text_url, full_text_format, abstract FROM state_bills WHERE id = ?')
      .bind(billId)
      .first() as any;

    if (!bill) {
      return c.json({ error: 'State bill not found' }, 404);
    }

    // Check if analysis already exists
    const existingAnalysis = await db
      .prepare('SELECT status, analyzed_at, executive_summary FROM state_bill_analysis WHERE bill_id = ?')
      .bind(billId)
      .first() as any;

    // If analysis is complete, return it
    if (existingAnalysis && existingAnalysis.status === 'complete') {
      return c.json({
        success: true,
        status: 'complete',
        message: 'Analysis already exists',
        analyzedAt: existingAnalysis.analyzed_at
      });
    }

    // If analysis is in progress, return status
    if (existingAnalysis && existingAnalysis.status === 'processing') {
      return c.json({
        success: true,
        status: 'processing',
        message: 'Analysis is currently being generated'
      });
    }

    // Check if bill has text to analyze
    let billText = bill.full_text as string | null;
    let pdfUrl = bill.full_text_url as string | null;
    let pdfFormat = bill.full_text_format as string | null;

    // If no text, try to fetch it from OpenStates
    if (!billText || billText.length < 100) {
      console.log(`[StateBillAnalyze] Bill ${billId} missing text, fetching from OpenStates...`);
      try {
        const details = await openstatesClient.getBillDetails(billId);

        if (details.textVersions && details.textVersions.length > 0) {
          // Prefer HTML over PDF
          const htmlVersion = details.textVersions.find((v: any) =>
            v.mediaType?.includes('html') ||
            v.mediaType?.includes('text') ||
            v.url?.includes('.html') ||
            v.url?.includes('.htm')
          );

          const textVersion = htmlVersion || details.textVersions.find((v: any) =>
            !v.mediaType?.includes('pdf')
          );

          if (textVersion && !textVersion.mediaType?.includes('pdf')) {
            billText = await openstatesClient.getBillText(textVersion.url);

            if (billText && billText.length >= 100) {
              // Store the text for future use
              await db
                .prepare('UPDATE state_bills SET full_text = ?, text_extracted_at = ?, updated_at = ? WHERE id = ?')
                .bind(billText, Date.now(), Date.now(), billId)
                .run();
              console.log(`[StateBillAnalyze] Fetched and stored bill text (${billText.length} chars)`);
            }
          }

          // If no HTML text found, check for PDF version and store URL for analysis
          if ((!billText || billText.length < 100) && !pdfUrl) {
            const pdfVersion = details.textVersions.find((v: any) =>
              v.mediaType?.includes('pdf') || v.url?.includes('.pdf')
            );

            if (pdfVersion && pdfVersion.url) {
              pdfUrl = pdfVersion.url;
              pdfFormat = pdfVersion.mediaType || 'application/pdf';

              // Store the PDF URL for future use
              await db
                .prepare('UPDATE state_bills SET full_text_url = ?, full_text_format = ?, updated_at = ? WHERE id = ?')
                .bind(pdfUrl, pdfFormat, Date.now(), billId)
                .run();
              console.log(`[StateBillAnalyze] Stored PDF URL for bill: ${pdfUrl}`);
            }
          }
        }
      } catch (textError) {
        console.error(`[StateBillAnalyze] Failed to fetch bill text:`, textError);
      }
    }

    // For state bills, we can analyze even with just abstract + title (AI can fetch PDF)
    // Include full_text_url for PDF if available
    const hasPdfUrl = pdfUrl && pdfFormat?.includes('pdf');
    const hasContent = (billText && billText.length >= 100) || bill.abstract || hasPdfUrl;

    if (!hasContent) {
      return c.json({
        error: 'Bill content not available for analysis',
        message: 'Cannot analyze bill without text, abstract, or accessible text version.'
      }, 400);
    }

    // Create or update analysis record with 'pending' status
    const now = Date.now();
    await db
      .prepare(`
        INSERT INTO state_bill_analysis (bill_id, status, started_at, analyzed_at, executive_summary)
        VALUES (?, 'pending', ?, ?, 'Analysis in progress...')
        ON CONFLICT(bill_id) DO UPDATE SET
          status = 'pending',
          started_at = excluded.started_at
      `)
      .bind(billId, now, now)
      .run();

    // Queue analysis job for enrichment-observer to process
    await queue.send({
      type: 'deep_analysis_state_bill',
      bill_id: billId,
      timestamp: new Date().toISOString()
    });

    console.log(`[StateBillAnalyze] Queued deep analysis for state bill ${billId}`);

    return c.json({
      success: true,
      status: 'queued',
      message: 'Analysis job queued successfully. Check back in 30-60 seconds.',
      billId: billId
    });
  } catch (error: any) {
    console.error('[StateBillAnalyze] Error:', error);
    return c.json({
      error: 'Failed to queue analysis',
      message: error.message
    }, 500);
  }
});

/**
 * GET /state-bills/:id/analysis
 * Get the analysis for a specific state bill
 */
app.get('/state-bills/:id/analysis', async (c) => {
  try {
    const db = c.env.APP_DB;
    const billId = decodeURIComponent(c.req.param('id'));

    const analysis = await db
      .prepare(`
        SELECT
          bill_id,
          executive_summary,
          status_quo_vs_change,
          section_breakdown,
          mechanism_of_action,
          agency_powers,
          fiscal_impact,
          stakeholder_impact,
          unintended_consequences,
          arguments_for,
          arguments_against,
          implementation_challenges,
          passage_likelihood,
          passage_reasoning,
          recent_developments,
          state_impacts,
          status,
          analyzed_at,
          started_at,
          completed_at,
          model_used
        FROM state_bill_analysis
        WHERE bill_id = ?
      `)
      .bind(billId)
      .first() as any;

    if (!analysis) {
      return c.json({
        success: false,
        error: 'No analysis found for this bill'
      }, 404);
    }

    // Parse JSON fields
    const parseJson = (field: string | null) => {
      if (!field) return null;
      try {
        return JSON.parse(field);
      } catch {
        return field;
      }
    };

    return c.json({
      success: true,
      analysis: {
        billId: analysis.bill_id,
        status: analysis.status,
        executiveSummary: analysis.executive_summary,
        statusQuoVsChange: analysis.status_quo_vs_change,
        sectionBreakdown: parseJson(analysis.section_breakdown),
        mechanismOfAction: analysis.mechanism_of_action,
        agencyPowers: parseJson(analysis.agency_powers),
        fiscalImpact: parseJson(analysis.fiscal_impact),
        stakeholderImpact: parseJson(analysis.stakeholder_impact),
        unintendedConsequences: parseJson(analysis.unintended_consequences),
        argumentsFor: parseJson(analysis.arguments_for),
        argumentsAgainst: parseJson(analysis.arguments_against),
        implementationChallenges: parseJson(analysis.implementation_challenges),
        passageLikelihood: analysis.passage_likelihood,
        passageReasoning: analysis.passage_reasoning,
        recentDevelopments: parseJson(analysis.recent_developments),
        stateImpacts: parseJson(analysis.state_impacts),
        analyzedAt: analysis.analyzed_at,
        startedAt: analysis.started_at,
        completedAt: analysis.completed_at,
        modelUsed: analysis.model_used
      }
    });
  } catch (error: any) {
    console.error('[StateBillAnalysis] Error:', error);
    return c.json({
      error: 'Failed to get analysis',
      message: error.message
    }, 500);
  }
});

/**
 * STATE BILL TRACKING ENDPOINTS
 */

// Schema for tracking state bills
const TrackStateBillSchema = z.object({
  billId: z.string(), // OCD ID (e.g., "ocd-bill/...")
  state: z.string().length(2), // 2-letter state code
  identifier: z.string() // Bill identifier (e.g., "SB 123")
});

/**
 * POST /state-bills/track
 * Track a state bill (requires auth)
 */
app.post('/state-bills/track', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;

    // Validate input
    const body = await c.req.json();
    const validation = TrackStateBillSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: 'Invalid input', details: validation.error.errors }, 400);
    }

    const { billId, state, identifier } = validation.data;

    // Check if already tracking
    const existing = await db
      .prepare('SELECT id FROM state_bill_tracking WHERE user_id = ? AND bill_id = ?')
      .bind(auth.userId, billId)
      .first();

    if (existing) {
      return c.json({ error: 'State bill already tracked' }, 409);
    }

    // Add to tracked state bills
    const id = crypto.randomUUID();
    await db
      .prepare(`
        INSERT INTO state_bill_tracking (
          id, user_id, bill_id, state, identifier, tracked_at, notifications_enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(id, auth.userId, billId, state.toUpperCase(), identifier, Date.now(), 1)
      .run();

    console.log(`✓ State bill tracked: ${identifier} (${state}) by user ${auth.userId}`);

    return c.json({
      success: true,
      message: 'State bill tracked successfully',
      trackingId: id
    }, 201);
  } catch (error) {
    console.error('Track state bill error:', error);
    return c.json({
      error: 'Failed to track state bill',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * DELETE /state-bills/track/:trackingId
 * Untrack a state bill (requires auth)
 */
app.delete('/state-bills/track/:trackingId', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const trackingId = c.req.param('trackingId');

    // Verify ownership
    const tracked = await db
      .prepare('SELECT user_id FROM state_bill_tracking WHERE id = ?')
      .bind(trackingId)
      .first();

    if (!tracked) {
      return c.json({ error: 'Tracked state bill not found' }, 404);
    }

    if (tracked.user_id !== auth.userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Delete
    await db
      .prepare('DELETE FROM state_bill_tracking WHERE id = ?')
      .bind(trackingId)
      .run();

    console.log(`✓ State bill untracked: ${trackingId} by user ${auth.userId}`);

    return c.json({
      success: true,
      message: 'State bill untracked successfully'
    });
  } catch (error) {
    console.error('Untrack state bill error:', error);
    return c.json({
      error: 'Failed to untrack state bill',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /state-bills/tracked
 * Get user's tracked state bills (requires auth)
 */
app.get('/state-bills/tracked', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;

    // Get tracked state bills with latest bill data
    const result = await db
      .prepare(`
        SELECT
          t.id as tracking_id,
          t.bill_id,
          t.state,
          t.identifier,
          t.tracked_at,
          t.notifications_enabled,
          sb.title,
          sb.latest_action_date,
          sb.latest_action_description,
          sb.session_identifier
        FROM state_bill_tracking t
        LEFT JOIN state_bills sb ON t.bill_id = sb.id
        WHERE t.user_id = ?
        ORDER BY t.tracked_at DESC
      `)
      .bind(auth.userId)
      .all();

    const trackedBills = result.results?.map((row: any) => ({
      trackingId: row.tracking_id,
      billId: row.bill_id,
      state: row.state,
      identifier: row.identifier,
      trackedAt: row.tracked_at,
      notificationsEnabled: row.notifications_enabled === 1,
      bill: {
        title: row.title,
        session: row.session_identifier,
        latestAction: {
          date: row.latest_action_date,
          description: row.latest_action_description
        }
      }
    })) || [];

    return c.json({
      success: true,
      trackedBills,
      count: trackedBills.length
    });
  } catch (error) {
    console.error('Get tracked state bills error:', error);
    return c.json({
      error: 'Failed to get tracked state bills',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /state-bills/:id/tracking-status
 * Check if a state bill is tracked by the authenticated user
 */
app.get('/state-bills/:id/tracking-status', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const billId = decodeURIComponent(c.req.param('id'));

    const tracked = await db
      .prepare('SELECT id, notifications_enabled FROM state_bill_tracking WHERE user_id = ? AND bill_id = ?')
      .bind(auth.userId, billId)
      .first();

    return c.json({
      success: true,
      isTracked: !!tracked,
      trackingId: tracked?.id || null,
      notificationsEnabled: tracked ? tracked.notifications_enabled === 1 : false
    });
  } catch (error) {
    console.error('Check state bill tracking status error:', error);
    return c.json({
      error: 'Failed to check tracking status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /state-bills/track/:trackingId/notifications
 * Toggle notifications for a tracked state bill (requires auth)
 */
app.put('/state-bills/track/:trackingId/notifications', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const trackingId = c.req.param('trackingId');
    const body = await c.req.json();
    const enabled = body.enabled === true ? 1 : 0;

    // Verify ownership
    const tracked = await db
      .prepare('SELECT user_id FROM state_bill_tracking WHERE id = ?')
      .bind(trackingId)
      .first();

    if (!tracked) {
      return c.json({ error: 'Tracked state bill not found' }, 404);
    }

    if (tracked.user_id !== auth.userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Update notifications setting
    await db
      .prepare('UPDATE state_bill_tracking SET notifications_enabled = ? WHERE id = ?')
      .bind(enabled, trackingId)
      .run();

    return c.json({
      success: true,
      notificationsEnabled: enabled === 1
    });
  } catch (error) {
    console.error('Toggle state bill notifications error:', error);
    return c.json({
      error: 'Failed to toggle notifications',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * STATE LEGISLATORS ENDPOINTS
 */

/**
 * GET /state-legislators
 * Get state legislators by geographic coordinates
 * Used during onboarding to find user's state senate and house representatives
 *
 * Query params:
 *   lat: number (required) - Latitude
 *   lng: number (required) - Longitude
 */
app.get('/state-legislators', async (c) => {
  try {
    // Parse query parameters
    const lat = parseFloat(c.req.query('lat') || '');
    const lng = parseFloat(c.req.query('lng') || '');

    if (isNaN(lat) || isNaN(lng)) {
      return c.json({
        error: 'Invalid parameters',
        message: 'lat and lng are required and must be valid numbers'
      }, 400);
    }

    // Validate latitude and longitude ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return c.json({
        error: 'Invalid coordinates',
        message: 'lat must be between -90 and 90, lng must be between -180 and 180'
      }, 400);
    }

    console.log(`[StateLegislators] Looking up legislators at lat=${lat}, lng=${lng}`);

    // Get OpenStates client
    const openstatesClient = c.env.OPENSTATES_CLIENT;
    const legislators = await openstatesClient.getLegislatorsByLocation(lat, lng);

    console.log(`[StateLegislators] Found ${legislators.length} state legislators`);

    return c.json({
      success: true,
      legislators,
      count: legislators.length
    });

  } catch (error: any) {
    console.error('[StateLegislators] Failed to get state legislators:', error);
    return c.json({
      error: 'Failed to get state legislators',
      message: error.message
    }, 500);
  }
});

/**
 * GET /state-legislators/:id
 * Get details for a single state legislator by ID
 * First checks local database, then falls back to OpenStates API
 *
 * @param id - OpenStates person ID (ocd-person/uuid format, URL-encoded)
 */
app.get('/state-legislators/:id', async (c) => {
  try {
    const legislatorId = decodeURIComponent(c.req.param('id'));

    // Skip if this is a voting-record request (handled by next route)
    if (legislatorId === 'voting-record') {
      return c.json({ error: 'Invalid legislator ID' }, 400);
    }

    console.log(`[StateLegislator] Fetching details for ${legislatorId}`);

    const db = c.env.APP_DB;

    // First check our local database
    const dbLegislator = await db
      .prepare(`
        SELECT id, name, party, state, current_role_title, current_role_district,
               current_role_chamber, image_url, email
        FROM state_legislators
        WHERE id = ?
      `)
      .bind(legislatorId)
      .first() as any;

    if (dbLegislator) {
      console.log(`[StateLegislator] Found in database: ${dbLegislator.name}`);
      const nameParts = dbLegislator.name.split(' ');
      return c.json({
        success: true,
        member: {
          id: dbLegislator.id,
          fullName: dbLegislator.name,
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' '),
          party: dbLegislator.party,
          state: dbLegislator.state,
          chamber: dbLegislator.current_role_chamber,
          district: dbLegislator.current_role_district,
          imageUrl: dbLegislator.image_url,
          email: dbLegislator.email,
          role: dbLegislator.current_role_title,
          currentMember: true
        }
      });
    }

    // Fall back to OpenStates API if not in database
    console.log(`[StateLegislator] Not in database, checking OpenStates API`);
    const openstatesClient = c.env.OPENSTATES_CLIENT;
    const legislator = await openstatesClient.getLegislatorById(legislatorId);

    if (!legislator) {
      return c.json({
        error: 'Legislator not found',
        message: `No legislator found with ID: ${legislatorId}`
      }, 404);
    }

    console.log(`[StateLegislator] Found from OpenStates: ${legislator.name}`);

    return c.json({
      success: true,
      member: {
        id: legislator.id,
        fullName: legislator.name,
        firstName: legislator.name.split(' ')[0],
        lastName: legislator.name.split(' ').slice(1).join(' '),
        party: legislator.party,
        state: legislator.state,
        chamber: legislator.chamber,
        district: legislator.district,
        imageUrl: legislator.imageUrl,
        currentMember: true
      }
    });

  } catch (error: any) {
    console.error('[StateLegislator] Failed to get legislator:', error);
    return c.json({
      error: 'Failed to get legislator',
      message: error.message
    }, 500);
  }
});

/**
 * GET /state-legislators/:id/voting-record
 * Get voting record for a state legislator from OpenStates API
 *
 * @param id - OpenStates person ID (ocd-person/uuid format, URL-encoded)
 * @query limit - Number of votes to return (default: 50)
 */
app.get('/state-legislators/:id/voting-record', async (c) => {
  try {
    const legislatorId = decodeURIComponent(c.req.param('id'));
    const limit = parseInt(c.req.query('limit') || '50', 10);

    console.log(`[StateLegislatorVotes] Fetching votes for ${legislatorId}, limit ${limit}`);

    // Get OpenStates client
    const openstatesClient = c.env.OPENSTATES_CLIENT;

    // Get legislator info first
    const legislator = await openstatesClient.getLegislatorById(legislatorId);

    if (!legislator) {
      return c.json({
        error: 'Legislator not found',
        message: `No legislator found with ID: ${legislatorId}`
      }, 404);
    }

    // Get voting record
    const votingData = await openstatesClient.getLegislatorVotes(legislatorId, limit);

    console.log(`[StateLegislatorVotes] Found ${votingData.votes.length} votes for ${legislator.name}`);

    return c.json({
      success: true,
      member: {
        id: legislator.id,
        fullName: legislator.name,
        party: legislator.party,
        state: legislator.state,
        chamber: legislator.chamber,
        district: legislator.district
      },
      stats: votingData.stats,
      votes: votingData.votes.map((vote: any) => ({
        voteId: vote.voteId,
        voteDate: vote.voteDate,
        voteQuestion: vote.motion || 'Vote',
        voteResult: vote.result === 'pass' ? 'Passed' : 'Failed',
        memberVote: vote.memberVote,
        bill: vote.billId ? {
          id: vote.billId,
          identifier: vote.billIdentifier,
          title: vote.billTitle
        } : undefined,
        yesCount: vote.yesCount,
        noCount: vote.noCount,
        absentCount: vote.absentCount
      })),
      pagination: {
        total: votingData.votes.length,
        limit,
        hasMore: votingData.votes.length >= limit
      },
      dataAvailability: {
        hasData: votingData.votes.length > 0,
        reason: votingData.votes.length === 0 ? 'no_votes_found' : undefined,
        message: votingData.votes.length === 0 ? 'No voting records found for this legislator' : undefined
      }
    });

  } catch (error: any) {
    console.error('[StateLegislatorVotes] Failed to get voting record:', error);
    return c.json({
      error: 'Failed to get voting record',
      message: error.message
    }, 500);
  }
});

/**
 * GET /members/:bioguide_id/voting-record
 * Get federal member voting record from Congress.gov API
 */
app.get('/members/:bioguide_id/voting-record', async (c) => {
  try {
    const bioguideId = c.req.param('bioguide_id');
    const db = c.env.APP_DB;
    const congressApiClient = c.env.CONGRESS_API_CLIENT;

    // Query params
    const congress = parseInt(c.req.query('congress') || '119', 10);
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);

    // Get member to check chamber
    const member = await db
      .prepare('SELECT bioguide_id, first_name, last_name, party, state, district FROM members WHERE bioguide_id = ?')
      .bind(bioguideId)
      .first() as any;

    if (!member) {
      return c.json({
        error: 'Member not found',
        message: `No member found with bioguide_id: ${bioguideId}`
      }, 404);
    }

    // Determine chamber (district = null means Senate)
    const chamber = member.district !== null ? 'House' : 'Senate';

    // Senate votes are not available via Congress.gov API
    if (chamber === 'Senate') {
      return c.json({
        success: true,
        member: {
          bioguideId: member.bioguide_id,
          fullName: `${member.first_name} ${member.last_name}`,
          party: member.party,
          state: member.state,
          chamber: 'Senate'
        },
        stats: null,
        votes: [],
        pagination: {
          total: 0,
          limit,
          hasMore: false
        },
        dataAvailability: {
          hasData: false,
          reason: 'senate_not_available',
          message: 'Senate voting records are not yet available through the Congress.gov API'
        }
      });
    }

    // Fetch House votes for this member
    console.log(`Fetching voting record for ${bioguideId} (${congress}th Congress)`);

    const votingData = await congressApiClient.getMemberHouseVotes(bioguideId, congress, limit);

    // Enrich votes with bill titles from our database
    const billsToLookup = votingData.votes
      .filter((v: any) => v.bill && (!v.bill.title || v.bill.title === `${v.bill.type} ${v.bill.number}`))
      .map((v: any) => ({ type: v.bill.type.toLowerCase(), number: v.bill.number }));

    const titleMap = new Map<string, string>();
    if (billsToLookup.length > 0) {
      for (const bill of billsToLookup) {
        try {
          const billRecord = await db
            .prepare(`
              SELECT title FROM bills
              WHERE congress = ? AND bill_type = ? AND bill_number = ?
              LIMIT 1
            `)
            .bind(congress, bill.type, parseInt(bill.number, 10))
            .first() as any;

          if (billRecord?.title) {
            titleMap.set(`${bill.type}-${bill.number}`, billRecord.title);
          }
        } catch (e) {
          // Continue if lookup fails
        }
      }
    }

    // Calculate additional stats
    const totalVotesCast = votingData.stats.totalVotes;
    const missedVotes = votingData.stats.notVotingCount;
    const missedPercentage = totalVotesCast > 0
      ? Math.round((missedVotes / (totalVotesCast + missedVotes)) * 100 * 10) / 10
      : 0;

    // Format response with enriched titles
    return c.json({
      success: true,
      member: {
        bioguideId: member.bioguide_id,
        fullName: `${member.first_name} ${member.last_name}`,
        party: member.party,
        state: member.state,
        chamber: 'House'
      },
      stats: {
        totalVotesCast: totalVotesCast,
        totalMissed: missedVotes,
        missedPercentage,
        partyAlignment: null,
        yeaVotes: votingData.stats.yeaVotes,
        nayVotes: votingData.stats.nayVotes,
        presentVotes: votingData.stats.presentVotes
      },
      votes: votingData.votes.map((vote: any) => {
        const billKey = vote.bill ? `${vote.bill.type.toLowerCase()}-${vote.bill.number}` : null;
        const enrichedTitle = billKey ? titleMap.get(billKey) : null;
        return {
          id: `${congress}-${vote.rollCallNumber}`,
          voteDate: vote.voteDate,
          voteQuestion: vote.voteQuestion,
          voteResult: vote.voteResult,
          memberVote: vote.memberVote,
          bill: vote.bill ? {
            id: `${congress}-${vote.bill.type.toLowerCase()}-${vote.bill.number}`,
            title: enrichedTitle || vote.bill.title || `${vote.bill.type} ${vote.bill.number}`,
            type: vote.bill.type,
            number: vote.bill.number
          } : null,
          votedWithParty: null
        };
      }),
      pagination: {
        total: votingData.votes.length,
        limit,
        hasMore: votingData.votes.length >= limit
      },
      dataAvailability: {
        hasData: votingData.votes.length > 0,
        reason: votingData.votes.length === 0 ? 'no_votes_found' : undefined
      }
    });

  } catch (error: any) {
    console.error('Failed to get voting record:', error);
    return c.json({
      error: 'Failed to get voting record',
      message: error.message
    }, 500);
  }
});

/**
 * ADMIN ENDPOINTS
 */

/**
 * POST /admin/sync-state-bills
 * Manually trigger sync for state bills from OpenStates
 * This is an admin endpoint for when bills need to be synced immediately
 *
 * Body: { state: string } - 2-letter state code (e.g., 'TX', 'CA')
 */
app.post('/admin/sync-state-bills', async (c) => {
  try {
    const body = await c.req.json();
    const state = body.state?.toUpperCase();

    if (!state || state.length !== 2) {
      return c.json({
        error: 'Invalid state',
        message: 'state must be a 2-letter state code (e.g., TX, CA)'
      }, 400);
    }

    console.log(`[AdminSync] Starting manual sync for state: ${state}`);

    const db = c.env.APP_DB;
    const apiKey = c.env.OPENSTATES_API_KEY;

    if (!apiKey) {
      return c.json({
        error: 'Configuration error',
        message: 'OpenStates API key not configured'
      }, 500);
    }

    let totalSynced = 0;
    let totalLegislators = 0;

    // Sync legislators for the state using CSV bulk data
    try {
      console.log(`[AdminSync] Fetching legislators for ${state}...`);
      const csvUrl = `https://data.openstates.org/people/current/${state.toLowerCase()}.csv`;
      const csvResponse = await fetch(csvUrl);

      if (csvResponse.ok) {
        const csvText = await csvResponse.text();
        const lines = csvText.split('\n');
        const headerLine = lines[0];
        if (headerLine) {
        const headers = headerLine.split(',');

        // Find column indices
        const idIdx = headers.indexOf('id');
        const nameIdx = headers.indexOf('name');
        const partyIdx = headers.indexOf('current_party');
        const roleIdx = headers.indexOf('current_role');
        const districtIdx = headers.indexOf('current_district');
        const chamberIdx = headers.indexOf('current_chamber');
        const imageIdx = headers.indexOf('image');
        const emailIdx = headers.indexOf('email');

        for (let i = 1; i < lines.length; i++) {
          const rawLine = lines[i];
          if (!rawLine) continue;
          const line = rawLine.trim();
          if (!line) continue;

          // Simple CSV parsing (handles basic cases)
          const values = line.split(',');
          if (values.length < headers.length) continue;

          const legislator = {
            id: values[idIdx] || '',
            name: values[nameIdx] || '',
            party: values[partyIdx] || '',
            currentRoleTitle: values[roleIdx] || '',
            currentRoleDistrict: values[districtIdx] || '',
            currentRoleChamber: values[chamberIdx] || '',
            imageUrl: values[imageIdx] || '',
            email: values[emailIdx] || ''
          };

          if (!legislator.id || !legislator.name) continue;

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
                state,
                legislator.currentRoleTitle,
                legislator.currentRoleDistrict,
                legislator.currentRoleChamber,
                null,
                legislator.imageUrl || null,
                legislator.email || null,
                Date.now(),
                Date.now()
              )
              .run();
            totalLegislators++;
          } catch (legError) {
            console.error(`[AdminSync] Failed to insert legislator:`, legError);
          }
        }
        console.log(`[AdminSync] Synced ${totalLegislators} legislators for ${state}`);
        } // end if (headerLine)
      }
    } catch (legError) {
      console.error(`[AdminSync] Failed to sync legislators for ${state}:`, legError);
    }

    // Sync bills for the state using direct API call
    console.log(`[AdminSync] Fetching bills for ${state}...`);
    const billsUrl = `https://v3.openstates.org/bills?apikey=${apiKey}&jurisdiction=${state.toLowerCase()}&per_page=20&sort=updated_desc&include=actions`;
    const billsResponse = await fetch(billsUrl);

    if (!billsResponse.ok) {
      const errorText = await billsResponse.text();
      console.error(`[AdminSync] OpenStates API error: ${billsResponse.status} - ${errorText}`);
      return c.json({
        success: false,
        error: 'OpenStates API error',
        message: `${billsResponse.status}: ${errorText}`,
        legislators: totalLegislators
      }, 500);
    }

    const billsData = await billsResponse.json() as { results: any[] };
    const bills = billsData.results || [];

    if (bills.length === 0) {
      return c.json({
        success: true,
        message: `No bills found for ${state}`,
        synced: 0,
        legislators: totalLegislators
      });
    }

    console.log(`[AdminSync] Found ${bills.length} bills for ${state}`);

    for (const bill of bills) {
      try {
        // Get the latest action from the actions array
        const actions = bill.actions || [];
        const latestAction = actions.length > 0 ? actions[actions.length - 1] : null;

        await db
          .prepare(`
            INSERT INTO state_bills (
              id, state, session_identifier, identifier, title,
              subjects, chamber, latest_action_date, latest_action_description,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              subjects = excluded.subjects,
              latest_action_date = excluded.latest_action_date,
              latest_action_description = excluded.latest_action_description,
              updated_at = excluded.updated_at
          `)
          .bind(
            bill.id,
            state,
            bill.session || '',
            bill.identifier,
            bill.title,
            JSON.stringify(bill.subject || []),
            bill.from_organization?.classification || '',
            latestAction?.date || null,
            latestAction?.description || null,
            Date.now(),
            Date.now()
          )
          .run();
        totalSynced++;
      } catch (insertError) {
        console.error(`[AdminSync] Failed to insert bill ${bill.id}:`, insertError);
      }
    }

    console.log(`[AdminSync] Completed: synced ${totalSynced} bills and ${totalLegislators} legislators for ${state}`);

    return c.json({
      success: true,
      message: `Synced ${totalSynced} bills and ${totalLegislators} legislators for ${state}`,
      synced: totalSynced,
      legislators: totalLegislators
    });

  } catch (error: any) {
    console.error('[AdminSync] Manual sync failed:', error);
    return c.json({
      error: 'Sync failed',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// Campaign Finance Endpoints
// ============================================================================

/**
 * Helper function to get size bucket label
 */
function getSizeLabel(size: number): string {
  switch (size) {
    case 0: return 'Under $200';
    case 200: return '$200-$499';
    case 500: return '$500-$999';
    case 1000: return '$1,000-$1,999';
    case 2000: return '$2,000+';
    default: return `$${size}+`;
  }
}

/**
 * Simple string hash function for creating IDs
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Background function to cache campaign finance data
 */
async function cacheCampaignFinanceInBackground(
  db: any,
  bioguideId: string,
  cycle: number,
  data: any,
  opensecretsId?: string
) {
  try {
    const summaryId = `${bioguideId}-${cycle}`;

    // Insert summary
    await db
      .prepare(`
        INSERT OR REPLACE INTO campaign_finance_summary (
          id, bioguide_id, fec_candidate_id, fec_committee_id, opensecrets_id, cycle,
          total_raised, total_spent, cash_on_hand, debts,
          individual_contributions, individual_itemized, individual_unitemized,
          pac_contributions, party_contributions, self_financed,
          coverage_start, coverage_end, last_synced_at, sync_status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'completed', datetime('now'))
      `)
      .bind(
        summaryId,
        bioguideId,
        data.candidateId,
        data.committeeId,
        opensecretsId || null,
        cycle,
        data.totalRaised,
        data.totalSpent,
        data.cashOnHand,
        data.debts,
        data.individualContributions,
        0, // itemized - not tracked separately
        0, // unitemized - not tracked separately
        data.pacContributions,
        data.partyContributions,
        data.selfFinanced,
        data.coverageStart,
        data.coverageEnd
      )
      .run();

    // Insert employer contributions
    for (let i = 0; i < data.topContributorsByEmployer.length; i++) {
      const contrib = data.topContributorsByEmployer[i];
      const contribId = `${bioguideId}-${cycle}-${hashString(contrib.employer)}`;
      await db
        .prepare(`
          INSERT OR REPLACE INTO campaign_contributors_employer (
            id, bioguide_id, cycle, employer, total_amount, contribution_count, rank, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `)
        .bind(contribId, bioguideId, cycle, contrib.employer, contrib.total, contrib.count, i + 1)
        .run();
    }

    // Insert occupation contributions
    for (let i = 0; i < data.topContributorsByOccupation.length; i++) {
      const contrib = data.topContributorsByOccupation[i];
      const contribId = `${bioguideId}-${cycle}-${hashString(contrib.occupation)}`;
      await db
        .prepare(`
          INSERT OR REPLACE INTO campaign_contributors_occupation (
            id, bioguide_id, cycle, occupation, total_amount, contribution_count, rank, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `)
        .bind(contribId, bioguideId, cycle, contrib.occupation, contrib.total, contrib.count, i + 1)
        .run();
    }

    // Insert state contributions
    for (const contrib of data.contributionsByState) {
      const contribId = `${bioguideId}-${cycle}-${contrib.state}`;
      await db
        .prepare(`
          INSERT OR REPLACE INTO campaign_contributions_state (
            id, bioguide_id, cycle, state, state_name, total_amount, contribution_count, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `)
        .bind(contribId, bioguideId, cycle, contrib.state, contrib.state_full, contrib.total, contrib.count)
        .run();
    }

    // Insert size contributions
    for (const contrib of data.contributionsBySize) {
      const contribId = `${bioguideId}-${cycle}-${contrib.size}`;
      await db
        .prepare(`
          INSERT OR REPLACE INTO campaign_contributions_size (
            id, bioguide_id, cycle, size_bucket, size_label, total_amount, contribution_count, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `)
        .bind(contribId, bioguideId, cycle, contrib.size, getSizeLabel(contrib.size), contrib.total, contrib.count)
        .run();
    }

    console.log(`Cached campaign finance for ${bioguideId} (${cycle})`);
  } catch (error) {
    console.error('Error caching campaign finance:', error);
    throw error;
  }
}

/**
 * GET /members/:bioguide_id/campaign-finance
 * Get campaign finance data for a member from FEC
 * Checks cache first, fetches from FEC API if stale/missing
 */
app.get('/members/:bioguide_id/campaign-finance', async (c) => {
  try {
    const bioguideId = c.req.param('bioguide_id');
    const db = c.env.APP_DB;
    const fecClient = c.env.FEC_CLIENT;

    // Query params
    const cycle = parseInt(c.req.query('cycle') || '2024', 10);
    const forceRefresh = c.req.query('refresh') === 'true';

    // Check if member exists
    const member = await db
      .prepare('SELECT bioguide_id, first_name, last_name, party, state, district, opensecrets_id FROM members WHERE bioguide_id = ?')
      .bind(bioguideId)
      .first() as any;

    if (!member) {
      return c.json({
        error: 'Member not found',
        message: `No member found with bioguide_id: ${bioguideId}`
      }, 404);
    }

    const chamber = member.district !== null ? 'House' : 'Senate';

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      try {
        const cached = await db
          .prepare(`
            SELECT * FROM campaign_finance_summary
            WHERE bioguide_id = ? AND cycle = ?
            AND datetime(last_synced_at) > datetime('now', '-24 hours')
          `)
          .bind(bioguideId, cycle)
          .first() as any;

        if (cached) {
          console.log(`Using cached campaign finance for ${bioguideId} (${cycle})`);

          // Get cached contributors
          const [employerContribs, occupationContribs, stateContribs, sizeContribs] = await Promise.all([
            db.prepare(`
              SELECT employer, total_amount, contribution_count, rank
              FROM campaign_contributors_employer
              WHERE bioguide_id = ? AND cycle = ?
              ORDER BY rank ASC
              LIMIT 25
            `).bind(bioguideId, cycle).all(),
            db.prepare(`
              SELECT occupation, total_amount, contribution_count, rank
              FROM campaign_contributors_occupation
              WHERE bioguide_id = ? AND cycle = ?
              ORDER BY rank ASC
              LIMIT 25
            `).bind(bioguideId, cycle).all(),
            db.prepare(`
              SELECT state, state_name, total_amount, contribution_count
              FROM campaign_contributions_state
              WHERE bioguide_id = ? AND cycle = ?
              ORDER BY total_amount DESC
            `).bind(bioguideId, cycle).all(),
            db.prepare(`
              SELECT size_bucket, size_label, total_amount, contribution_count
              FROM campaign_contributions_size
              WHERE bioguide_id = ? AND cycle = ?
              ORDER BY size_bucket ASC
            `).bind(bioguideId, cycle).all()
          ]);

          // Map employer data and aggregate by industry
          const employerData = (employerContribs.results || []).map((r: any) => ({
            employer: r.employer,
            total: r.total_amount,
            count: r.contribution_count
          }));

          // If cache has summary but no contributor data, bypass cache and fetch fresh from FEC
          const hasContributorData = employerData.length > 0 || (occupationContribs.results || []).length > 0;
          if (!hasContributorData && cached.total_raised > 0) {
            console.log(`Cache has summary but no contributor data for ${bioguideId} (${cycle}), fetching fresh from FEC`);
            // Fall through to FEC API fetch below
          } else {
            const industryContributions = aggregateByIndustry(employerData);

            return c.json({
            success: true,
            member: {
              bioguideId: member.bioguide_id,
              fullName: `${member.first_name} ${member.last_name}`,
              party: member.party,
              state: member.state,
              chamber
            },
            cycle,
            candidateId: cached.fec_candidate_id,
            opensecretsId: cached.opensecrets_id,
            totalRaised: cached.total_raised,
            totalSpent: cached.total_spent,
            cashOnHand: cached.cash_on_hand,
            debts: cached.debts,
            individualContributions: cached.individual_contributions,
            pacContributions: cached.pac_contributions,
            partyContributions: cached.party_contributions,
            selfFinanced: cached.self_financed,
            coverageStart: cached.coverage_start,
            coverageEnd: cached.coverage_end,
            topContributorsByEmployer: employerData,
            topContributorsByIndustry: industryContributions.map((ic: IndustryContribution) => ({
              industry: ic.industry,
              total: ic.total,
              count: ic.count,
              topEmployers: ic.employers.slice(0, 5)
            })),
            topContributorsByOccupation: (occupationContribs.results || []).map((r: any) => ({
              occupation: r.occupation,
              total: r.total_amount,
              count: r.contribution_count
            })),
            contributionsByState: (stateContribs.results || []).map((r: any) => ({
              state: r.state,
              stateName: r.state_name,
              total: r.total_amount,
              count: r.contribution_count
            })),
            contributionsBySize: (sizeContribs.results || []).map((r: any) => ({
              size: r.size_bucket,
              sizeLabel: r.size_label,
              total: r.total_amount,
              count: r.contribution_count
            })),
            availableCycles: [2024, 2022, 2020, 2018],
            source: 'cache',
            lastUpdated: cached.last_synced_at
          });
          }
        }
      } catch (e) {
        console.log('Cache lookup failed, fetching from FEC:', e);
      }
    }

    // Fetch from FEC API
    console.log(`Fetching campaign finance for ${bioguideId} (${cycle}) from FEC API`);

    const financeData = await fecClient.getMemberCampaignFinance(bioguideId, cycle);

    if (!financeData) {
      // Try to get OpenSecrets URL even if FEC data not available
      const openSecretsUrl = await fecClient.getOpenSecretsUrl(bioguideId);

      return c.json({
        success: true,
        member: {
          bioguideId: member.bioguide_id,
          fullName: `${member.first_name} ${member.last_name}`,
          party: member.party,
          state: member.state,
          chamber
        },
        cycle,
        candidateId: null,
        opensecretsId: openSecretsUrl ? openSecretsUrl.split('cid=')[1] : null,
        totalRaised: 0,
        totalSpent: 0,
        cashOnHand: 0,
        debts: 0,
        individualContributions: 0,
        pacContributions: 0,
        partyContributions: 0,
        selfFinanced: 0,
        coverageStart: null,
        coverageEnd: null,
        topContributorsByEmployer: [],
        topContributorsByIndustry: [],
        topContributorsByOccupation: [],
        contributionsByState: [],
        contributionsBySize: [],
        availableCycles: [2024, 2022, 2020, 2018],
        source: 'none',
        error: {
          message: 'No FEC campaign finance data available for this member and cycle'
        }
      });
    }

    // Cache the data in background
    cacheCampaignFinanceInBackground(db, bioguideId, cycle, financeData, member.opensecrets_id).catch(e => {
      console.error('Failed to cache campaign finance:', e);
    });

    // Get OpenSecrets URL
    const openSecretsUrl = await fecClient.getOpenSecretsUrl(bioguideId);

    // Map employer data and aggregate by industry
    const employerData = financeData.topContributorsByEmployer.map((c: any) => ({
      employer: c.employer,
      total: c.total,
      count: c.count
    }));
    const industryContributions = aggregateByIndustry(employerData);

    return c.json({
      success: true,
      member: {
        bioguideId: member.bioguide_id,
        fullName: `${member.first_name} ${member.last_name}`,
        party: member.party,
        state: member.state,
        chamber
      },
      cycle,
      candidateId: financeData.candidateId,
      opensecretsId: openSecretsUrl ? openSecretsUrl.split('cid=')[1] : null,
      totalRaised: financeData.totalRaised,
      totalSpent: financeData.totalSpent,
      cashOnHand: financeData.cashOnHand,
      debts: financeData.debts,
      individualContributions: financeData.individualContributions,
      pacContributions: financeData.pacContributions,
      partyContributions: financeData.partyContributions,
      selfFinanced: financeData.selfFinanced,
      coverageStart: financeData.coverageStart,
      coverageEnd: financeData.coverageEnd,
      topContributorsByEmployer: employerData,
      topContributorsByIndustry: industryContributions.map((ic: IndustryContribution) => ({
        industry: ic.industry,
        total: ic.total,
        count: ic.count,
        topEmployers: ic.employers.slice(0, 5)
      })),
      topContributorsByOccupation: financeData.topContributorsByOccupation.map((c: any) => ({
        occupation: c.occupation,
        total: c.total,
        count: c.count
      })),
      contributionsByState: financeData.contributionsByState.map((c: any) => ({
        state: c.state,
        stateName: c.state_full,
        total: c.total,
        count: c.count
      })),
      contributionsBySize: financeData.contributionsBySize.map((c: any) => ({
        size: c.size,
        sizeLabel: getSizeLabel(c.size),
        total: c.total,
        count: c.count
      })),
      availableCycles: [2024, 2022, 2020, 2018],
      source: 'fec_api',
      lastUpdated: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Failed to get campaign finance:', error);
    return c.json({
      error: 'Failed to get campaign finance data',
      message: error.message
    }, 500);
  }
});

/**
 * GET /members/:bioguide_id/campaign-finance/cycles
 * Get available election cycles for a member
 */
app.get('/members/:bioguide_id/campaign-finance/cycles', async (c) => {
  try {
    const bioguideId = c.req.param('bioguide_id');
    const fecClient = c.env.FEC_CLIENT;

    const cycles = await fecClient.getMemberElectionCycles(bioguideId);

    return c.json({
      success: true,
      bioguideId,
      cycles: cycles.sort((a: number, b: number) => b - a) // Sort descending (newest first)
    });

  } catch (error: any) {
    console.error('Failed to get election cycles:', error);
    return c.json({
      error: 'Failed to get election cycles',
      message: error.message
    }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
