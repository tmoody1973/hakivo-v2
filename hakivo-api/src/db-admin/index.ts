import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { Env } from './raindrop.gen';

const app = new Hono<{ Bindings: Env }>();

/**
 * Admin service for database operations
 * This should be protected and only accessible to administrators
 */

app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'db-admin', timestamp: new Date().toISOString() });
});

/**
 * POST /db-admin/initialize
 * Initialize the database schema
 *
 * NOTE: For edge runtime compatibility, schema SQL should be passed in the request body
 * or fetched from a static URL. File system access is not available in edge runtime.
 */
app.post('/db-admin/initialize', async (c) => {
  try {
    const db = c.env.APP_DB;
    const body = await c.req.json();
    const { schema } = body;

    if (!schema) {
      return c.json({
        success: false,
        error: 'Schema SQL is required in request body'
      }, 400);
    }

    console.log('📦 Starting database initialization...');

    // Split into individual statements
    const statements = schema
      .split(';')
      .map((stmt: string) => stmt.trim())
      .filter((stmt: string) => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute`);

    const results: Array<{ statement: string; success: boolean; error?: string }> = [];

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      try {
        await db.exec(statement);

        // Extract table/index name for logging
        const match = statement.match(/CREATE\s+(TABLE|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
        const objectType = match?.[1] || 'STATEMENT';
        const objectName = match?.[2] || `statement_${i + 1}`;

        console.log(`✓ Created ${objectType}: ${objectName}`);

        results.push({
          statement: `${objectType}: ${objectName}`,
          success: true
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`✗ Error executing statement ${i + 1}:`, errorMessage);

        results.push({
          statement: statement.substring(0, 100) + '...',
          success: false,
          error: errorMessage
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    console.log(`✅ Database initialization complete: ${successCount} success, ${errorCount} errors`);

    return c.json({
      success: errorCount === 0,
      message: `Database initialization complete`,
      stats: {
        total: statements.length,
        success: successCount,
        errors: errorCount
      },
      results: results.filter(r => !r.success) // Only return errors
    });
  } catch (error) {
    console.error('Database initialization failed:', error);
    return c.json({
      success: false,
      error: 'Database initialization failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /db-admin/tables
 * List all tables in the database
 */
app.get('/db-admin/tables', async (c) => {
  try {
    const db = c.env.APP_DB;

    const result = await db
      .prepare(`
        SELECT name, type
        FROM sqlite_master
        WHERE type IN ('table', 'index')
        ORDER BY type, name
      `)
      .all();

    const tables = result.results?.filter((r: any) => r.type === 'table') || [];
    const indexes = result.results?.filter((r: any) => r.type === 'index') || [];

    return c.json({
      success: true,
      tables: tables.map((t: any) => t.name),
      indexes: indexes.map((i: any) => i.name),
      counts: {
        tables: tables.length,
        indexes: indexes.length
      }
    });
  } catch (error) {
    console.error('Failed to list tables:', error);
    return c.json({
      success: false,
      error: 'Failed to list tables',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /db-admin/schema/:table
 * Get schema information for a specific table
 */
app.get('/db-admin/schema/:table', async (c) => {
  try {
    const db = c.env.APP_DB;
    const tableName = c.req.param('table');

    const result = await db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all();

    if (!result.results || result.results.length === 0) {
      return c.json({
        success: false,
        error: 'Table not found'
      }, 404);
    }

    return c.json({
      success: true,
      table: tableName,
      columns: result.results
    });
  } catch (error) {
    console.error('Failed to get table schema:', error);
    return c.json({
      success: false,
      error: 'Failed to get table schema',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /db-admin/query
 * Execute a custom SQL query (read-only recommended)
 */
app.post('/db-admin/query', async (c) => {
  try {
    const db = c.env.APP_DB;
    const { query } = await c.req.json();

    if (!query) {
      return c.json({ error: 'Query is required' }, 400);
    }

    // Warn if query is a write operation
    const isWrite = /^(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)/i.test(query.trim());
    if (isWrite) {
      console.warn('⚠️  Executing write operation via query endpoint');
    }

    const result = await db.prepare(query).all();

    return c.json({
      success: true,
      results: result.results || [],
      count: result.results?.length || 0,
      isWrite
    });
  } catch (error) {
    console.error('Query execution failed:', error);
    return c.json({
      success: false,
      error: 'Query execution failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /db-admin/backfill-sponsors
 * Backfill sponsor data for bills with missing sponsor_bioguide_id
 * This fetches bill details from Congress.gov API for each bill missing sponsor data
 */
app.post('/db-admin/backfill-sponsors', async (c) => {
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
 * POST /db-admin/cleanup-malformed-bills
 * Remove bills with malformed IDs (not in congress-type-number format)
 * These will be re-synced with proper format on next sync
 */
app.post('/db-admin/cleanup-malformed-bills', async (c) => {
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

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
