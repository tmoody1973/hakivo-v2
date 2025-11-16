import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { Env } from './raindrop.gen';
import { readFileSync } from 'fs';
import { join } from 'path';

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
 * WARNING: This will create all tables and indexes
 */
app.post('/db-admin/initialize', async (c) => {
  try {
    const db = c.env.APP_DB;

    console.log('📦 Starting database initialization...');

    // Read the SQL schema file
    const schemaPath = join(process.cwd(), 'sql/init-schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Split into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

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

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
