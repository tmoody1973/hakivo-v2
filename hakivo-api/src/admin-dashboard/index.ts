import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { Env } from './raindrop.gen';

const app = new Hono<{ Bindings: Env }>();

/**
 * Admin Dashboard Service
 * Provides web UI and API endpoints for monitoring and managing Hakivo API
 */

// Serve the admin dashboard UI
app.get('/', (c) => {
  return c.html(getAdminDashboardHTML());
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'admin-dashboard', timestamp: new Date().toISOString() });
});

/**
 * GET /api/overview
 * Get overall system statistics
 */
app.get('/api/overview', async (c) => {
  try {
    const db = c.env.APP_DB;

    // Get table counts
    const tables = [
      'users', 'briefs', 'chat_sessions', 'bill_tracking',
      'bills', 'members', 'committees', 'votes'
    ];

    const counts: Record<string, number> = {};

    for (const table of tables) {
      try {
        const result = await db.prepare(`SELECT COUNT(*) as count FROM ${table}`).first() as { count: number } | null;
        counts[table] = result?.count || 0;
      } catch (error) {
        counts[table] = 0;
      }
    }

    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      database: counts,
      services: {
        total: 11,
        public: 5,
        private: 6
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/services/health
 * Check health of all services
 */
app.get('/api/services/health', async (c) => {
  const services = [
    'AUTH_SERVICE',
    'BILLS_SERVICE',
    'BRIEFS_SERVICE',
    'CHAT_SERVICE',
    'DASHBOARD_SERVICE',
    'USER_SERVICE'
  ];

  const health: Record<string, any> = {};

  for (const service of services) {
    try {
      // Check if service is available in env
      const serviceExists = !!(c.env as any)[service];
      health[service] = {
        available: serviceExists,
        status: serviceExists ? 'ok' : 'unavailable'
      };
    } catch (error) {
      health[service] = {
        available: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown'
      };
    }
  }

  return c.json({
    success: true,
    services: health,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/database/tables
 * List all database tables with row counts
 */
app.get('/api/database/tables', async (c) => {
  try {
    const db = c.env.APP_DB;

    // Get all tables
    const tablesResult = await db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table'
      ORDER BY name
    `).all();

    const tables = tablesResult.results || [];
    const tableStats = [];

    // Get row count for each table
    for (const table of tables) {
      const tableName = (table as any).name;
      try {
        const countResult = await db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).first();
        tableStats.push({
          name: tableName,
          rows: countResult?.count || 0
        });
      } catch (error) {
        tableStats.push({
          name: tableName,
          rows: 0,
          error: 'Count failed'
        });
      }
    }

    return c.json({
      success: true,
      tables: tableStats,
      total: tableStats.length
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/database/query
 * Execute a custom SQL query
 */
app.post('/api/database/query', async (c) => {
  try {
    const db = c.env.APP_DB;
    const { query, limit = 100 } = await c.req.json();

    if (!query) {
      return c.json({ success: false, error: 'Query is required' }, 400);
    }

    // Add LIMIT if it's a SELECT query without one
    let finalQuery = query.trim();
    if (/^SELECT/i.test(finalQuery) && !/LIMIT/i.test(finalQuery)) {
      finalQuery += ` LIMIT ${limit}`;
    }

    const result = await db.prepare(finalQuery).all();

    return c.json({
      success: true,
      results: result.results || [],
      count: result.results?.length || 0,
      query: finalQuery
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/database/initialize
 * Initialize database schema
 */
app.post('/api/database/initialize', async (c) => {
  try {
    // Call the db-admin service
    const result = await c.env.DB_ADMIN.fetch(new Request('http://internal/db-admin/initialize', {
      method: 'POST'
    }));

    const data = await result.json();
    return c.json(data);
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize database'
    }, 500);
  }
});

/**
 * POST /api/database/backfill-sponsors
 * Backfill missing sponsor data for bills
 */
app.post('/api/database/backfill-sponsors', async (c) => {
  try {
    const db = c.env.APP_DB;
    const congressApi = c.env.CONGRESS_API_CLIENT;

    // Find bills with missing sponsor data
    const missingSponsors = await db
      .prepare(`
        SELECT id, congress, bill_type, bill_number, title
        FROM bills
        WHERE sponsor_bioguide_id IS NULL OR sponsor_bioguide_id = ''
        LIMIT 50
      `)
      .all();

    const bills = missingSponsors.results || [];
    console.log(`📋 Found ${bills.length} bills with missing sponsor data`);

    if (bills.length === 0) {
      return c.json({
        success: true,
        message: 'No bills with missing sponsor data found',
        updated: 0
      });
    }

    let updated = 0;
    let errors = 0;
    const results: Array<{ billId: string; status: string; sponsor?: string }> = [];

    for (const bill of bills) {
      try {
        const billType = String(bill.bill_type).toLowerCase();
        const billNumber = Number(bill.bill_number);
        const congress = Number(bill.congress);

        // Fetch bill details from Congress.gov
        const detailsResponse = await congressApi.getBillDetails(congress, billType, billNumber);
        const billDetails = detailsResponse.bill;

        if (billDetails?.sponsors && billDetails.sponsors.length > 0) {
          const sponsor = billDetails.sponsors[0];
          const sponsorBioguideId = sponsor.bioguideId;

          // Update the bill with sponsor info
          await db
            .prepare(`UPDATE bills SET sponsor_bioguide_id = ?, policy_area = ? WHERE id = ?`)
            .bind(
              sponsorBioguideId,
              billDetails.policyArea?.name || null,
              bill.id
            )
            .run();

          // Upsert member if needed
          if (sponsorBioguideId) {
            await db
              .prepare(`
                INSERT INTO members (bioguide_id, first_name, last_name, party, state, district)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(bioguide_id) DO UPDATE SET
                  first_name = COALESCE(excluded.first_name, members.first_name),
                  last_name = COALESCE(excluded.last_name, members.last_name),
                  party = COALESCE(excluded.party, members.party),
                  state = COALESCE(excluded.state, members.state)
              `)
              .bind(
                sponsorBioguideId,
                sponsor.firstName || null,
                sponsor.lastName || null,
                sponsor.party || null,
                sponsor.state || null,
                sponsor.district || null
              )
              .run();
          }

          results.push({
            billId: bill.id as string,
            status: 'updated',
            sponsor: `${sponsor.firstName} ${sponsor.lastName} (${sponsor.party}-${sponsor.state})`
          });
          updated++;
        } else {
          results.push({ billId: bill.id as string, status: 'no_sponsor_found' });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ billId: bill.id as string, status: `error: ${errorMessage}` });
        errors++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Sponsor backfill complete: ${updated} updated, ${errors} errors`);

    return c.json({
      success: true,
      message: `Backfill complete`,
      updated,
      errors,
      remaining: bills.length - updated - errors,
      results
    });
  } catch (error) {
    console.error('Sponsor backfill failed:', error);
    return c.json({
      success: false,
      error: 'Sponsor backfill failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/database/cleanup-malformed-bills
 * Remove bills with malformed IDs
 */
app.post('/api/database/cleanup-malformed-bills', async (c) => {
  try {
    const db = c.env.APP_DB;

    // Find malformed bills (IDs that don't match congress-type-number pattern)
    const malformedResult = await db
      .prepare(`
        SELECT id, congress, bill_type, bill_number, title
        FROM bills
        WHERE id NOT LIKE '%-%-%'
        LIMIT 100
      `)
      .all();

    const malformedBills = malformedResult.results || [];
    console.log(`📋 Found ${malformedBills.length} malformed bills to clean up`);

    if (malformedBills.length === 0) {
      return c.json({
        success: true,
        message: 'No malformed bills found',
        deleted: 0
      });
    }

    // Delete malformed bills
    const ids = malformedBills.map((b: any) => b.id);
    let deleted = 0;

    for (const id of ids) {
      try {
        await db.prepare('DELETE FROM bills WHERE id = ?').bind(id).run();
        deleted++;
      } catch (error) {
        console.warn(`Could not delete bill ${id}: ${error}`);
      }
    }

    console.log(`✅ Cleaned up ${deleted} malformed bills`);

    return c.json({
      success: true,
      message: `Cleaned up ${deleted} malformed bills`,
      deleted,
      sample: malformedBills.slice(0, 5).map((b: any) => ({ id: b.id, title: b.title?.substring(0, 50) }))
    });
  } catch (error) {
    console.error('Cleanup failed:', error);
    return c.json({
      success: false,
      error: 'Cleanup failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/cache/stats
 * Get statistics for all KV caches
 */
app.get('/api/cache/stats', async (c) => {
  const caches = [
    'NEWS_CACHE',
    'DASHBOARD_CACHE',
    'DISTRICT_CACHE',
    'SESSION_CACHE',
    'IMAGE_CACHE',
    'ACTIONS_CACHE'
  ];

  const stats: Record<string, any> = {};

  for (const cacheName of caches) {
    try {
      const cache = (c.env as any)[cacheName];
      if (cache) {
        stats[cacheName] = {
          available: true,
          // Note: KV doesn't provide size stats, this is just availability
          status: 'ok'
        };
      } else {
        stats[cacheName] = { available: false };
      }
    } catch (error) {
      stats[cacheName] = {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown'
      };
    }
  }

  return c.json({
    success: true,
    caches: stats,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/smartbuckets/info
 * Get information about SmartBuckets
 */
app.get('/api/smartbuckets/info', async (c) => {
  const buckets = ['BILL_TEXTS', 'AUDIO_BRIEFS'];

  const info: Record<string, any> = {};

  for (const bucketName of buckets) {
    try {
      const bucket = (c.env as any)[bucketName];
      if (bucket) {
        info[bucketName] = {
          available: true,
          status: 'ok'
        };
      } else {
        info[bucketName] = { available: false };
      }
    } catch (error) {
      info[bucketName] = {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown'
      };
    }
  }

  return c.json({
    success: true,
    buckets: info,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/smartbucket/store
 * Store content in a SmartBucket
 */
app.post('/api/smartbucket/store', async (c) => {
  try {
    const { bucket, key, content, contentType = 'text/plain' } = await c.req.json();

    if (!bucket || !key || !content) {
      return c.json({
        success: false,
        error: 'Missing required fields: bucket, key, content'
      }, 400);
    }

    // Get the SmartBucket instance
    const smartBucket = (c.env as any)[bucket];
    if (!smartBucket) {
      return c.json({
        success: false,
        error: `SmartBucket '${bucket}' not found`
      }, 404);
    }

    // Store the content
    await smartBucket.put(key, content, {
      httpMetadata: {
        contentType: contentType
      }
    });

    return c.json({
      success: true,
      bucket,
      key,
      url: `smartbucket://${bucket}/${key}`,
      size: content.length
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/smartbucket/get/:bucket/:key
 * Retrieve content from a SmartBucket
 */
app.get('/api/smartbucket/get/:bucket/*', async (c) => {
  try {
    const bucketName = c.req.param('bucket');

    // Extract the key from the full path
    const fullPath = c.req.path;
    const prefix = `/api/smartbucket/get/${bucketName}/`;
    const key = fullPath.startsWith(prefix) ? fullPath.slice(prefix.length) : '';

    if (!key) {
      return c.json({
        success: false,
        error: 'No key provided'
      }, 400);
    }

    // Get the SmartBucket instance
    const smartBucket = (c.env as any)[bucketName];
    if (!smartBucket) {
      return c.json({
        success: false,
        error: `SmartBucket '${bucketName}' not found`
      }, 404);
    }

    // Retrieve the content
    const object = await smartBucket.get(key);
    if (!object) {
      return c.json({
        success: false,
        error: `Object '${key}' not found in bucket '${bucketName}'`
      }, 404);
    }

    const content = await object.text();

    return c.json({
      success: true,
      bucket: bucketName,
      key,
      content,
      size: content.length
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/smartbucket/list/:bucket
 * List objects in a SmartBucket
 */
app.get('/api/smartbucket/list/:bucket', async (c) => {
  try {
    const bucketName = c.req.param('bucket');
    const prefix = c.req.query('prefix') || '';
    const limit = parseInt(c.req.query('limit') || '100');

    // Get the SmartBucket instance
    const smartBucket = (c.env as any)[bucketName];
    if (!smartBucket) {
      return c.json({
        success: false,
        error: `SmartBucket '${bucketName}' not found`
      }, 404);
    }

    // List objects
    const options: any = { limit };
    if (prefix) {
      options.prefix = prefix;
    }

    const listed = await smartBucket.list(options);

    return c.json({
      success: true,
      bucket: bucketName,
      objects: listed.objects.map((obj: any) => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded
      })),
      truncated: listed.truncated,
      count: listed.objects.length
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/indexing/status
 * Check bill indexing progress and SmartBucket status
 */
app.get('/api/indexing/status', async (c) => {
  try {
    const db = c.env.APP_DB;
    const billTextsBucket = c.env.BILL_TEXTS;

    // Get indexing progress from database
    const progressResult = await db
      .prepare('SELECT * FROM indexing_progress WHERE congress = ?')
      .bind(119)
      .first<{
        congress: number;
        processed_bills: number;
        updated_at: number;
        started_at: number;
        completed_at: number | null;
      }>();

    // Get total bills count
    const totalBillsResult = await db
      .prepare('SELECT COUNT(*) as total FROM bills WHERE congress = ?')
      .bind(119)
      .first<{ total: number }>();

    const totalBills = totalBillsResult?.total || 0;

    // List SmartBucket objects
    const bucketObjects = await billTextsBucket.list({ prefix: 'bills/119/', limit: 1000 });

    // Sample a few bills to verify content
    const sampleBills: any[] = [];
    const sampleKeys = bucketObjects.objects.slice(0, 3);

    for (const obj of sampleKeys) {
      const billObj = await billTextsBucket.get(obj.key);
      if (billObj) {
        const text = await billObj.text();
        sampleBills.push({
          key: obj.key,
          size: obj.size,
          textLength: text.length,
          preview: text.substring(0, 200) + '...',
          hasCustomMetadata: !!billObj.customMetadata
        });
      }
    }

    return c.json({
      success: true,
      progress: progressResult ? {
        processed: progressResult.processed_bills,
        total: totalBills,
        percentage: Math.round((progressResult.processed_bills / totalBills) * 100),
        startedAt: new Date(progressResult.started_at).toISOString(),
        updatedAt: new Date(progressResult.updated_at).toISOString(),
        completedAt: progressResult.completed_at ? new Date(progressResult.completed_at).toISOString() : null
      } : null,
      smartbucket: {
        totalObjects: bucketObjects.objects.length,
        truncated: bucketObjects.truncated,
        sampleBills
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/smartbucket/search
 * Test semantic search on SmartBucket
 */
app.post('/api/smartbucket/search', async (c) => {
  try {
    const { query, limit = 5 } = await c.req.json();

    if (!query) {
      return c.json({ success: false, error: 'Query is required' }, 400);
    }

    const billTextsBucket = c.env.BILL_TEXTS;

    // Perform semantic search
    const searchResults = await billTextsBucket.search({ input: query });

    return c.json({
      success: true,
      query,
      results: searchResults
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/sync-all-legislators
 * Bulk load legislators for ALL 50 states + DC
 * Uses D1 batch operations for efficiency
 * Body: { startFrom?: "GA" } to resume from a specific state
 */
app.post('/api/sync-all-legislators', async (c) => {
  try {
    const db = c.env.APP_DB;
    const openStatesClient = c.env.OPENSTATES_CLIENT;

    const body = await c.req.json().catch(() => ({}));
    const startFrom = body.startFrom?.toUpperCase();

    // All 50 states + DC
    let allStates = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
      'DC'
    ];

    // Allow resuming from a specific state
    if (startFrom) {
      const idx = allStates.indexOf(startFrom);
      if (idx >= 0) {
        allStates = allStates.slice(idx);
        console.log(`🏛️  Resuming from ${startFrom}, ${allStates.length} states remaining...`);
      }
    } else {
      console.log(`🏛️  Bulk loading legislators for all ${allStates.length} states...`);
    }

    let totalSynced = 0;
    let totalErrors = 0;
    const results: Array<{ state: string; synced: number; error?: string }> = [];

    for (const state of allStates) {
      try {
        console.log(`  🔄 Syncing legislators for ${state}...`);

        const legislators = await openStatesClient.getLegislatorsByState(state);

        if (!legislators || legislators.length === 0) {
          console.log(`    ⚠️  No legislators found for ${state}`);
          results.push({ state, synced: 0, error: 'No legislators found' });
          continue;
        }

        console.log(`    📋 Found ${legislators.length} legislators for ${state}`);

        // Use D1 batch operations - batch in groups of 50
        const batchSize = 50;
        let stateSynced = 0;

        for (let i = 0; i < legislators.length; i += batchSize) {
          const batch = legislators.slice(i, i + batchSize);
          const statements = batch.map(legislator =>
            db.prepare(`
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
            `).bind(
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
          );

          try {
            await db.batch(statements);
            stateSynced += batch.length;
            totalSynced += batch.length;
          } catch (batchError) {
            console.error(`    ❌ Batch insert failed for ${state}:`, batchError);
            totalErrors += batch.length;
          }
        }

        console.log(`    ✅ Synced ${stateSynced} legislators for ${state}`);
        results.push({ state, synced: stateSynced });

        // Brief pause between states
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (stateError) {
        const errorMessage = stateError instanceof Error ? stateError.message : 'Unknown error';
        console.error(`  ❌ Failed to sync legislators for ${state}:`, stateError);
        results.push({ state, synced: 0, error: errorMessage });
        totalErrors++;
      }
    }

    console.log(`\n✅ Bulk legislator sync complete!`);
    console.log(`   Total legislators synced: ${totalSynced}`);
    console.log(`   Total errors: ${totalErrors}`);

    return c.json({
      success: true,
      message: `Synced ${totalSynced} legislators across ${allStates.length} states`,
      stats: {
        statesSynced: allStates.length,
        legislatorsSynced: totalSynced,
        errors: totalErrors
      },
      results
    });

  } catch (error) {
    console.error('Bulk legislator sync failed:', error);
    return c.json({
      success: false,
      error: 'Bulk legislator sync failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/sync-state-bills
 * Manually sync state bills from OpenStates API
 * Body: { state: "AL" } or { states: ["AL", "WI"] } or { fetchText: true }
 */
app.post('/api/sync-state-bills', async (c) => {
  try {
    const db = c.env.APP_DB;
    const openStatesClient = c.env.OPENSTATES_CLIENT;

    const body = await c.req.json().catch(() => ({}));
    let states: string[] = [];
    const fetchText = body.fetchText !== false; // Default to true

    if (body.state) {
      states = [body.state.toUpperCase()];
    } else if (body.states && Array.isArray(body.states)) {
      states = body.states.map((s: string) => s.toUpperCase());
    } else {
      // Default: sync for all users with state preferences
      const statesResult = await db
        .prepare(`
          SELECT DISTINCT state
          FROM user_preferences
          WHERE state IS NOT NULL AND state != ''
          LIMIT 10
        `)
        .all();
      states = (statesResult.results as { state: string }[]).map(s => s.state);
    }

    if (states.length === 0) {
      return c.json({
        success: false,
        error: 'No states to sync. Provide state or states in request body.'
      }, 400);
    }

    console.log(`🏛️  Manual State Sync: Syncing ${states.length} states: ${states.join(', ')} (fetchText: ${fetchText})`);

    let totalSynced = 0;
    let totalTextFetched = 0;
    let totalErrors = 0;
    const results: Array<{ state: string; synced: number; textFetched: number; error?: string }> = [];

    for (const state of states) {
      try {
        console.log(`\n🔄 Syncing state: ${state}`);

        // Call OpenStates client to search bills by state
        const bills = await openStatesClient.searchBillsByState(state, undefined, 20);

        if (!bills || bills.length === 0) {
          console.log(`  ⚠️  No bills found for ${state}`);
          results.push({ state, synced: 0, textFetched: 0 });
          continue;
        }

        console.log(`  📋 Retrieved ${bills.length} bills for ${state}`);
        let stateSynced = 0;
        let stateTextFetched = 0;

        // Insert or update bills in database
        for (const bill of bills) {
          try {
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
                state.toUpperCase(),
                bill.session,
                bill.identifier,
                bill.title,
                JSON.stringify(bill.subjects || []),
                bill.chamber || '',
                bill.latestActionDate,
                bill.latestActionDescription,
                Date.now(),
                Date.now()
              )
              .run();

            stateSynced++;
            totalSynced++;

            // Fetch full text if enabled
            if (fetchText) {
              // Check if we already have full text for this bill
              const existingText = await db
                .prepare('SELECT full_text FROM state_bills WHERE id = ?')
                .bind(bill.id)
                .first();

              if (existingText?.full_text) {
                console.log(`  📄 Bill ${bill.identifier} already has text, skipping`);
                continue;
              }

              // Fetch bill details to get text version URLs
              try {
                const details = await openStatesClient.getBillDetails(bill.id);

                if (details.textVersions && details.textVersions.length > 0) {
                  // Prefer HTML/text versions over PDFs
                  const htmlVersion = details.textVersions.find((v: any) =>
                    v.mediaType?.includes('html') ||
                    v.mediaType?.includes('text') ||
                    v.url?.includes('.html') ||
                    v.url?.includes('.htm')
                  );

                  const textVersion = htmlVersion || details.textVersions[0];

                  if (textVersion) {
                    // Store the text URL
                    await db
                      .prepare(`
                        UPDATE state_bills
                        SET full_text_url = ?, full_text_format = ?, abstract = ?, updated_at = ?
                        WHERE id = ?
                      `)
                      .bind(
                        textVersion.url,
                        textVersion.mediaType || 'unknown',
                        details.abstract,
                        Date.now(),
                        bill.id
                      )
                      .run();

                    // Try to fetch the actual text (only for HTML/text, not PDFs)
                    if (htmlVersion || !textVersion.mediaType?.includes('pdf')) {
                      const fullText = await openStatesClient.getBillText(textVersion.url);

                      if (fullText && fullText.length > 100) {
                        // Store the full text
                        await db
                          .prepare(`
                            UPDATE state_bills
                            SET full_text = ?, text_extracted_at = ?, updated_at = ?
                            WHERE id = ?
                          `)
                          .bind(
                            fullText,
                            Date.now(),
                            Date.now(),
                            bill.id
                          )
                          .run();

                        console.log(`  📄 Fetched text for ${bill.identifier} (${fullText.length} chars)`);
                        stateTextFetched++;
                        totalTextFetched++;
                      }
                    } else {
                      console.log(`  📄 ${bill.identifier}: PDF only, skipping text extraction`);
                    }
                  }
                }

                // Also store sponsors if available
                if (details.sponsors && details.sponsors.length > 0) {
                  for (const sponsor of details.sponsors) {
                    try {
                      await db
                        .prepare(`
                          INSERT INTO state_bill_sponsorships (bill_id, name, classification, created_at)
                          VALUES (?, ?, ?, ?)
                          ON CONFLICT(bill_id, person_id, classification) DO NOTHING
                        `)
                        .bind(
                          bill.id,
                          sponsor.name,
                          sponsor.classification,
                          Date.now()
                        )
                        .run();
                    } catch (sponsorError) {
                      // Ignore duplicate sponsor errors
                    }
                  }
                }

              } catch (detailsError) {
                console.log(`  ⚠️  Could not fetch details for ${bill.identifier}:`, detailsError);
              }
            }

          } catch (insertError) {
            console.error(`  ❌ Failed to insert bill ${bill.id}:`, insertError);
            totalErrors++;
          }
        }

        console.log(`  ✅ Synced ${stateSynced} bills, ${stateTextFetched} texts for ${state}`);
        results.push({ state, synced: stateSynced, textFetched: stateTextFetched });

        // Brief pause between states
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (stateError) {
        const errorMessage = stateError instanceof Error ? stateError.message : 'Unknown error';
        console.error(`❌ Failed to sync state ${state}:`, stateError);
        results.push({ state, synced: 0, textFetched: 0, error: errorMessage });
        totalErrors++;
      }
    }

    console.log(`\n✅ State sync complete: ${totalSynced} bills, ${totalTextFetched} texts, ${totalErrors} errors`);

    return c.json({
      success: true,
      message: `Synced ${totalSynced} state bills, fetched ${totalTextFetched} texts`,
      totalSynced,
      totalTextFetched,
      totalErrors,
      results
    });

  } catch (error) {
    console.error('State sync failed:', error);
    return c.json({
      success: false,
      error: 'State sync failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}

/**
 * Generate the admin dashboard HTML
 */
function getAdminDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hakivo API - Admin Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      line-height: 1.6;
    }

    .header {
      background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%);
      padding: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    }

    .header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .header p {
      opacity: 0.9;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .card {
      background: #1e293b;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
      border: 1px solid #334155;
    }

    .card h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      color: #60a5fa;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .stat {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid #334155;
    }

    .stat:last-child {
      border-bottom: none;
    }

    .stat-label {
      color: #94a3b8;
    }

    .stat-value {
      font-weight: 600;
      color: #e2e8f0;
    }

    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .badge-success {
      background: #10b981;
      color: white;
    }

    .badge-error {
      background: #ef4444;
      color: white;
    }

    .badge-warning {
      background: #f59e0b;
      color: white;
    }

    .btn {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn:hover {
      background: #2563eb;
    }

    .btn:disabled {
      background: #475569;
      cursor: not-allowed;
    }

    .btn-danger {
      background: #ef4444;
    }

    .btn-danger:hover {
      background: #dc2626;
    }

    .section {
      margin-bottom: 2rem;
    }

    .table-container {
      overflow-x: auto;
      margin-top: 1rem;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      text-align: left;
      padding: 0.75rem;
      border-bottom: 1px solid #334155;
    }

    th {
      background: #0f172a;
      font-weight: 600;
      color: #60a5fa;
    }

    .query-section {
      background: #1e293b;
      border-radius: 12px;
      padding: 1.5rem;
      margin-top: 2rem;
    }

    textarea {
      width: 100%;
      min-height: 120px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 1rem;
      color: #e2e8f0;
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
      resize: vertical;
    }

    .results {
      margin-top: 1rem;
      max-height: 400px;
      overflow: auto;
      background: #0f172a;
      border-radius: 8px;
      padding: 1rem;
    }

    .loading {
      text-align: center;
      padding: 2rem;
      color: #94a3b8;
    }

    .error {
      background: #7f1d1d;
      border: 1px solid #991b1b;
      border-radius: 8px;
      padding: 1rem;
      margin-top: 1rem;
      color: #fecaca;
    }

    .success {
      background: #064e3b;
      border: 1px solid #065f46;
      border-radius: 8px;
      padding: 1rem;
      margin-top: 1rem;
      color: #a7f3d0;
    }

    .refresh-btn {
      float: right;
      font-size: 0.875rem;
      padding: 0.5rem 1rem;
    }

    pre {
      background: #0f172a;
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎙️ Hakivo API - Admin Dashboard</h1>
    <p>Monitor and manage your legislative briefing platform</p>
  </div>

  <div class="container">
    <!-- Overview Stats -->
    <div class="section">
      <h2 style="margin-bottom: 1rem;">📊 System Overview</h2>
      <button class="btn refresh-btn" onclick="loadOverview()">Refresh</button>
      <div class="grid" id="overview-grid">
        <div class="loading">Loading system overview...</div>
      </div>
    </div>

    <!-- Services Health -->
    <div class="section">
      <h2 style="margin-bottom: 1rem;">🔧 Services Health</h2>
      <button class="btn refresh-btn" onclick="loadServicesHealth()">Refresh</button>
      <div class="card" id="services-health">
        <div class="loading">Loading services health...</div>
      </div>
    </div>

    <!-- Database Tables -->
    <div class="section">
      <h2 style="margin-bottom: 1rem;">🗄️ Database Tables</h2>
      <button class="btn refresh-btn" onclick="loadTables()">Refresh</button>
      <button class="btn btn-danger" onclick="initializeDatabase()" style="margin-left: 0.5rem;">Initialize Database</button>
      <div class="card">
        <div class="table-container" id="tables-container">
          <div class="loading">Loading database tables...</div>
        </div>
      </div>
    </div>

    <!-- Resources -->
    <div class="grid">
      <div class="card">
        <h2>💾 KV Caches</h2>
        <div id="cache-stats">
          <div class="loading">Loading cache stats...</div>
        </div>
      </div>

      <div class="card">
        <h2>🗂️ SmartBuckets</h2>
        <div id="smartbucket-info">
          <div class="loading">Loading SmartBucket info...</div>
        </div>
      </div>
    </div>

    <!-- SQL Query Tool -->
    <div class="query-section">
      <h2 style="margin-bottom: 1rem;">🔍 SQL Query Tool</h2>
      <textarea id="sql-query" placeholder="SELECT * FROM users LIMIT 10"></textarea>
      <button class="btn" onclick="executeQuery()" style="margin-top: 1rem;">Execute Query</button>
      <div id="query-results"></div>
    </div>
  </div>

  <script>
    // Load overview stats
    async function loadOverview() {
      const grid = document.getElementById('overview-grid');
      grid.innerHTML = '<div class="loading">Loading...</div>';

      try {
        const response = await fetch('/api/overview');
        const data = await response.json();

        if (data.success) {
          grid.innerHTML = \`
            <div class="card">
              <h2>👥 Users</h2>
              <div class="stat">
                <span class="stat-label">Total Users</span>
                <span class="stat-value">\${data.database.users || 0}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Briefs Generated</span>
                <span class="stat-value">\${data.database.briefs || 0}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Chat Sessions</span>
                <span class="stat-value">\${data.database.chat_sessions || 0}</span>
              </div>
            </div>

            <div class="card">
              <h2>📜 Legislative Data</h2>
              <div class="stat">
                <span class="stat-label">Bills</span>
                <span class="stat-value">\${data.database.bills || 0}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Members</span>
                <span class="stat-value">\${data.database.members || 0}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Committees</span>
                <span class="stat-value">\${data.database.committees || 0}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Votes</span>
                <span class="stat-value">\${data.database.votes || 0}</span>
              </div>
            </div>

            <div class="card">
              <h2>⚙️ Services</h2>
              <div class="stat">
                <span class="stat-label">Total Services</span>
                <span class="stat-value">\${data.services.total}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Public</span>
                <span class="stat-value">\${data.services.public}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Private</span>
                <span class="stat-value">\${data.services.private}</span>
              </div>
            </div>
          \`;
        } else {
          grid.innerHTML = '<div class="error">Failed to load overview</div>';
        }
      } catch (error) {
        grid.innerHTML = '<div class="error">Error: ' + error.message + '</div>';
      }
    }

    // Load services health
    async function loadServicesHealth() {
      const container = document.getElementById('services-health');
      container.innerHTML = '<div class="loading">Loading...</div>';

      try {
        const response = await fetch('/api/services/health');
        const data = await response.json();

        if (data.success) {
          let html = '';
          for (const [name, info] of Object.entries(data.services)) {
            const badge = info.available
              ? '<span class="badge badge-success">OK</span>'
              : '<span class="badge badge-error">Unavailable</span>';

            html += \`
              <div class="stat">
                <span class="stat-label">\${name}</span>
                <span class="stat-value">\${badge}</span>
              </div>
            \`;
          }
          container.innerHTML = html;
        } else {
          container.innerHTML = '<div class="error">Failed to load services</div>';
        }
      } catch (error) {
        container.innerHTML = '<div class="error">Error: ' + error.message + '</div>';
      }
    }

    // Load database tables
    async function loadTables() {
      const container = document.getElementById('tables-container');
      container.innerHTML = '<div class="loading">Loading...</div>';

      try {
        const response = await fetch('/api/database/tables');
        const data = await response.json();

        if (data.success) {
          let html = '<table><thead><tr><th>Table Name</th><th>Rows</th><th>Actions</th></tr></thead><tbody>';

          data.tables.forEach(table => {
            const viewBtn = table.rows > 0
              ? \`<button class="btn" style="padding: 0.25rem 0.75rem; font-size: 0.75rem;" onclick="viewTableData('\${table.name}')">View Data</button>\`
              : '<span style="color: #94a3b8;">No data</span>';

            html += \`
              <tr>
                <td>\${table.name}</td>
                <td>\${table.rows.toLocaleString()}</td>
                <td>\${viewBtn}</td>
              </tr>
            \`;
          });

          html += '</tbody></table>';
          container.innerHTML = html;
        } else {
          container.innerHTML = '<div class="error">Failed to load tables</div>';
        }
      } catch (error) {
        container.innerHTML = '<div class="error">Error: ' + error.message + '</div>';
      }
    }

    // View table data
    async function viewTableData(tableName) {
      const resultsDiv = document.getElementById('query-results');
      resultsDiv.innerHTML = '<div class="loading">Loading table data...</div>';

      // Scroll to results
      resultsDiv.scrollIntoView({ behavior: 'smooth' });

      try {
        const response = await fetch('/api/database/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: \`SELECT * FROM \${tableName} LIMIT 100\` })
        });

        const data = await response.json();

        if (data.success && data.results.length > 0) {
          // Build HTML table
          const columns = Object.keys(data.results[0]);
          let html = \`
            <div class="success">
              <strong>\${tableName}</strong> - Showing \${data.count} of \${data.count} rows
              <button class="btn" style="float: right; padding: 0.25rem 0.75rem; font-size: 0.75rem; margin-left: 0.5rem;" onclick="loadTables()">Back to Tables</button>
            </div>
            <div class="results">
              <div style="overflow-x: auto;">
                <table style="width: 100%; font-size: 0.75rem;">
                  <thead>
                    <tr>
          \`;

          columns.forEach(col => {
            html += \`<th style="white-space: nowrap; padding: 0.5rem;">\${col}</th>\`;
          });

          html += '</tr></thead><tbody>';

          data.results.forEach(row => {
            html += '<tr>';
            columns.forEach(col => {
              let value = row[col];

              // Truncate long text
              if (typeof value === 'string' && value.length > 100) {
                value = value.substring(0, 100) + '...';
              }

              // Handle null
              if (value === null) {
                value = '<span style="color: #94a3b8; font-style: italic;">null</span>';
              }

              html += \`<td style="padding: 0.5rem; border-bottom: 1px solid #334155;">\${value}</td>\`;
            });
            html += '</tr>';
          });

          html += '</tbody></table></div></div>';
          resultsDiv.innerHTML = html;
        } else if (data.success && data.results.length === 0) {
          resultsDiv.innerHTML = '<div class="success">Table is empty (0 rows)</div>';
        } else {
          resultsDiv.innerHTML = \`<div class="error">\${data.error}</div>\`;
        }
      } catch (error) {
        resultsDiv.innerHTML = \`<div class="error">Error: \${error.message}</div>\`;
      }
    }

    // Load cache stats
    async function loadCacheStats() {
      const container = document.getElementById('cache-stats');

      try {
        const response = await fetch('/api/cache/stats');
        const data = await response.json();

        if (data.success) {
          let html = '';
          for (const [name, info] of Object.entries(data.caches)) {
            const badge = info.available
              ? '<span class="badge badge-success">OK</span>'
              : '<span class="badge badge-error">N/A</span>';

            html += \`
              <div class="stat">
                <span class="stat-label">\${name}</span>
                <span class="stat-value">\${badge}</span>
              </div>
            \`;
          }
          container.innerHTML = html;
        }
      } catch (error) {
        container.innerHTML = '<div class="error">Error loading caches</div>';
      }
    }

    // Load SmartBucket info
    async function loadSmartBucketInfo() {
      const container = document.getElementById('smartbucket-info');

      try {
        const response = await fetch('/api/smartbuckets/info');
        const data = await response.json();

        if (data.success) {
          let html = '';
          for (const [name, info] of Object.entries(data.buckets)) {
            const badge = info.available
              ? '<span class="badge badge-success">OK</span>'
              : '<span class="badge badge-error">N/A</span>';

            html += \`
              <div class="stat">
                <span class="stat-label">\${name}</span>
                <span class="stat-value">\${badge}</span>
              </div>
            \`;
          }
          container.innerHTML = html;
        }
      } catch (error) {
        container.innerHTML = '<div class="error">Error loading SmartBuckets</div>';
      }
    }

    // Execute SQL query
    async function executeQuery() {
      const query = document.getElementById('sql-query').value;
      const resultsDiv = document.getElementById('query-results');

      if (!query.trim()) {
        resultsDiv.innerHTML = '<div class="error">Please enter a query</div>';
        return;
      }

      resultsDiv.innerHTML = '<div class="loading">Executing query...</div>';

      try {
        const response = await fetch('/api/database/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });

        const data = await response.json();

        if (data.success) {
          resultsDiv.innerHTML = \`
            <div class="success">Query executed successfully (\${data.count} rows)</div>
            <div class="results">
              <pre>\${JSON.stringify(data.results, null, 2)}</pre>
            </div>
          \`;
        } else {
          resultsDiv.innerHTML = \`<div class="error">\${data.error}</div>\`;
        }
      } catch (error) {
        resultsDiv.innerHTML = \`<div class="error">Error: \${error.message}</div>\`;
      }
    }

    // Initialize database
    async function initializeDatabase() {
      if (!confirm('This will initialize the database schema. Continue?')) {
        return;
      }

      const btn = event.target;
      btn.disabled = true;
      btn.textContent = 'Initializing...';

      try {
        const response = await fetch('/api/database/initialize', {
          method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
          alert('Database initialized successfully!');
          loadTables();
          loadOverview();
        } else {
          alert('Initialization failed: ' + data.error);
        }
      } catch (error) {
        alert('Error: ' + error.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Initialize Database';
      }
    }

    // Load all data on page load
    window.addEventListener('DOMContentLoaded', () => {
      loadOverview();
      loadServicesHealth();
      loadTables();
      loadCacheStats();
      loadSmartBucketInfo();

      // Auto-refresh every 30 seconds
      setInterval(() => {
        loadOverview();
        loadServicesHealth();
      }, 30000);
    });
  </script>
</body>
</html>`;
}
