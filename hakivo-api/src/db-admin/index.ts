import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { Env } from './raindrop.gen';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const app = new Hono<{ Bindings: Env }>();

// Spreaker API endpoints
const SPREAKER_AUTH_URL = 'https://www.spreaker.com/oauth2/authorize';
const SPREAKER_TOKEN_URL = 'https://api.spreaker.com/oauth2/token';
const SPREAKER_API_URL = 'https://api.spreaker.com/v2';

// Gemini Image Generation endpoint
const GEMINI_IMAGE_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-image:generateContent';

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

/**
 * POST /db-admin/sync-state-bills
 * Manually sync state bills from OpenStates API
 * Body: { state: "AL" } or { states: ["AL", "WI"] }
 */
app.post('/db-admin/sync-state-bills', async (c) => {
  try {
    const db = c.env.APP_DB;
    const openStatesClient = c.env.OPENSTATES_CLIENT;

    const body = await c.req.json().catch(() => ({}));
    let states: string[] = [];

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

    console.log(`🏛️  Manual State Sync: Syncing ${states.length} states: ${states.join(', ')}`);

    let totalSynced = 0;
    let totalErrors = 0;
    const results: Array<{ state: string; synced: number; error?: string }> = [];

    for (const state of states) {
      try {
        console.log(`\n🔄 Syncing state: ${state}`);

        // Call OpenStates client to search bills by state
        const bills = await openStatesClient.searchBillsByState(state, undefined, 20);

        if (!bills || bills.length === 0) {
          console.log(`  ⚠️  No bills found for ${state}`);
          results.push({ state, synced: 0 });
          continue;
        }

        console.log(`  📋 Retrieved ${bills.length} bills for ${state}`);
        let stateSynced = 0;

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
          } catch (insertError) {
            console.error(`  ❌ Failed to insert bill ${bill.id}:`, insertError);
            totalErrors++;
          }
        }

        console.log(`  ✅ Synced ${stateSynced} bills for ${state}`);
        results.push({ state, synced: stateSynced });

        // Brief pause between states
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (stateError) {
        const errorMessage = stateError instanceof Error ? stateError.message : 'Unknown error';
        console.error(`❌ Failed to sync state ${state}:`, stateError);
        results.push({ state, synced: 0, error: errorMessage });
        totalErrors++;
      }
    }

    console.log(`\n✅ State sync complete: ${totalSynced} bills synced, ${totalErrors} errors`);

    return c.json({
      success: true,
      message: `Synced ${totalSynced} state bills`,
      totalSynced,
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

// ============================================================================
// SPREAKER INTEGRATION ENDPOINTS
// ============================================================================

/**
 * GET /spreaker/auth
 * Initiate Spreaker OAuth flow - redirects to Spreaker login
 */
app.get('/spreaker/auth', async (c) => {
  const clientId = c.env.SPREAKER_CLIENT_ID;
  const redirectUri = c.env.SPREAKER_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return c.json({ error: 'Spreaker OAuth not configured' }, 500);
  }

  // Generate random state for CSRF protection
  const state = crypto.randomUUID();

  // Store state in KV with 10 minute TTL
  const tokenCache = c.env.SPREAKER_TOKENS;
  await tokenCache.put(`oauth_state_${state}`, 'pending', { expirationTtl: 600 });

  // Build authorization URL
  const authUrl = new URL(SPREAKER_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'basic');
  authUrl.searchParams.set('state', state);

  console.log('[Spreaker] Initiating OAuth flow, redirecting to:', authUrl.toString());

  return c.redirect(authUrl.toString());
});

/**
 * POST /spreaker/exchange-token
 * Exchange authorization code for access tokens
 * Called by the Next.js callback route
 */
app.post('/spreaker/exchange-token', async (c) => {
  try {
    const { code, state } = await c.req.json();

    if (!code) {
      return c.json({ success: false, error: 'Missing authorization code' }, 400);
    }

    const clientId = c.env.SPREAKER_CLIENT_ID;
    const clientSecret = c.env.SPREAKER_CLIENT_SECRET;
    const redirectUri = c.env.SPREAKER_REDIRECT_URI;
    const tokenCache = c.env.SPREAKER_TOKENS;

    // Verify state if provided
    if (state) {
      const storedState = await tokenCache.get(`oauth_state_${state}`);
      if (!storedState) {
        console.warn('[Spreaker] Invalid or expired OAuth state');
        // Continue anyway - state verification is optional
      } else {
        await tokenCache.delete(`oauth_state_${state}`);
      }
    }

    // Exchange code for tokens
    console.log('[Spreaker] Exchanging code for tokens...');

    const tokenResponse = await fetch(SPREAKER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Spreaker] Token exchange failed:', tokenResponse.status, errorText);
      return c.json({ success: false, error: `Token exchange failed: ${errorText}` }, 400);
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };

    // Store tokens in KV cache
    const expiresAt = Date.now() + (tokens.expires_in * 1000);

    await tokenCache.put('access_token', tokens.access_token);
    await tokenCache.put('refresh_token', tokens.refresh_token);
    await tokenCache.put('expires_at', expiresAt.toString());

    console.log('[Spreaker] Tokens stored successfully, expires at:', new Date(expiresAt).toISOString());

    return c.json({
      success: true,
      message: 'Successfully authenticated with Spreaker',
      expiresAt: new Date(expiresAt).toISOString(),
    });

  } catch (error) {
    console.error('[Spreaker] Token exchange error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /spreaker/refresh-token
 * Refresh the Spreaker access token
 */
app.post('/spreaker/refresh-token', async (c) => {
  try {
    const tokenCache = c.env.SPREAKER_TOKENS;
    const refreshToken = await tokenCache.get('refresh_token');

    if (!refreshToken) {
      return c.json({ success: false, error: 'No refresh token stored. Please re-authenticate.' }, 401);
    }

    const clientId = c.env.SPREAKER_CLIENT_ID;
    const clientSecret = c.env.SPREAKER_CLIENT_SECRET;

    console.log('[Spreaker] Refreshing access token...');

    const tokenResponse = await fetch(SPREAKER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Spreaker] Token refresh failed:', tokenResponse.status, errorText);
      return c.json({ success: false, error: `Token refresh failed: ${errorText}` }, 400);
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Store new tokens
    const expiresAt = Date.now() + (tokens.expires_in * 1000);

    await tokenCache.put('access_token', tokens.access_token);
    await tokenCache.put('refresh_token', tokens.refresh_token);
    await tokenCache.put('expires_at', expiresAt.toString());

    console.log('[Spreaker] Token refreshed successfully');

    return c.json({
      success: true,
      message: 'Token refreshed successfully',
      expiresAt: new Date(expiresAt).toISOString(),
    });

  } catch (error) {
    console.error('[Spreaker] Token refresh error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /spreaker/status
 * Check Spreaker authentication status
 */
app.get('/spreaker/status', async (c) => {
  try {
    const tokenCache = c.env.SPREAKER_TOKENS;
    const accessToken = await tokenCache.get('access_token');
    const expiresAtStr = await tokenCache.get('expires_at');
    const refreshToken = await tokenCache.get('refresh_token');

    if (!accessToken) {
      return c.json({
        authenticated: false,
        message: 'No access token stored. Please authenticate.',
      });
    }

    const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;
    const isExpired = Date.now() >= expiresAt;
    const expiresIn = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));

    return c.json({
      authenticated: true,
      isExpired,
      expiresAt: new Date(expiresAt).toISOString(),
      expiresInSeconds: expiresIn,
      hasRefreshToken: !!refreshToken,
      message: isExpired ? 'Token expired, will refresh on next request' : 'Token valid',
    });

  } catch (error) {
    return c.json({
      authenticated: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Helper: Get valid Spreaker access token, refreshing if needed
 */
async function getValidSpreakerToken(env: Env): Promise<string> {
  const tokenCache = env.SPREAKER_TOKENS;
  const accessToken = await tokenCache.get('access_token');
  const expiresAtStr = await tokenCache.get('expires_at');
  const refreshToken = await tokenCache.get('refresh_token');

  if (!accessToken || !refreshToken) {
    throw new Error('Spreaker not authenticated. Please complete OAuth flow first.');
  }

  const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;

  // Refresh if token expires within 5 minutes
  if (Date.now() >= expiresAt - 300000) {
    console.log('[Spreaker] Token expiring soon, refreshing...');

    const tokenResponse = await fetch(SPREAKER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: env.SPREAKER_CLIENT_ID,
        client_secret: env.SPREAKER_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to refresh Spreaker token');
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const newExpiresAt = Date.now() + (tokens.expires_in * 1000);

    await tokenCache.put('access_token', tokens.access_token);
    await tokenCache.put('refresh_token', tokens.refresh_token);
    await tokenCache.put('expires_at', newExpiresAt.toString());

    return tokens.access_token;
  }

  return accessToken;
}

/**
 * Helper: Generate episode artwork using Gemini 2.5 Flash Image
 */
async function generateEpisodeArtwork(
  env: Env,
  episode: { headline: string; law: { name: string; year: number; category: string } }
): Promise<{ imageBuffer: Buffer; mimeType: string } | null> {
  try {
    const geminiApiKey = env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      console.log('[Spreaker] No Gemini API key, skipping artwork generation');
      return null;
    }

    // Create prompt for podcast thumbnail
    const prompt = `Podcast thumbnail design for a civic education podcast episode about "${episode.headline}".
The episode covers the ${episode.law.name} (${episode.law.year}), categorized as ${episode.law.category}.
Style: Modern, professional, editorial design with bold typography. Include subtle American civic imagery like the Capitol dome, scales of justice, or document silhouettes.
Use a color palette of deep blue, gold, and white. High quality, clean composition, no text overlays needed.`;

    console.log('[Spreaker] Generating artwork with Gemini 2.5 Flash Image...');

    const response = await fetch(`${GEMINI_IMAGE_ENDPOINT}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ['IMAGE'],
        },
        // Request square aspect ratio for podcast artwork
        imageConfig: {
          aspectRatio: '1:1',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Spreaker] Gemini image generation failed:', response.status, errorText);
      return null;
    }

    const result = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: {
              mimeType: string;
              data: string;
            }
          }>
        }
      }>
    };

    // Extract image data
    const imageData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!imageData) {
      console.error('[Spreaker] No image data in Gemini response');
      return null;
    }

    console.log('[Spreaker] Artwork generated successfully');

    return {
      imageBuffer: Buffer.from(imageData.data, 'base64'),
      mimeType: imageData.mimeType || 'image/png',
    };

  } catch (error) {
    console.error('[Spreaker] Artwork generation error:', error);
    return null;
  }
}

/**
 * Helper: Generate Spreaker-optimized metadata using Claude
 */
async function generateSpreakerMetadata(
  env: Env,
  episode: {
    episodeNumber: number;
    headline: string;
    description: string | null;
    law: { name: string; year: number; category: string; description: string };
  }
): Promise<{ title: string; description: string; tags: string }> {
  try {
    const systemPrompt = `You are a podcast metadata specialist. Generate optimized metadata for Spreaker podcast distribution.`;

    const userPrompt = `Generate Spreaker podcast metadata for this episode:

Episode Number: ${episode.episodeNumber}
Headline: ${episode.headline}
Law: ${episode.law.name} (${episode.law.year})
Category: ${episode.law.category}
Law Description: ${episode.law.description}

Generate:
1. title (max 140 chars, engaging, include "Ep. ${episode.episodeNumber}:" prefix)
2. description (2-3 paragraphs for podcast platforms, mention it's part of "Signed Into Law" series, include call to subscribe)
3. tags (12-15 comma-separated keywords for discoverability - include: law name, year, category, "US history", "legislation", "civic education", "podcast")

Return ONLY valid JSON with this exact format:
{"title": "...", "description": "...", "tags": "..."}`;

    const result = await env.CLAUDE_CLIENT.generateCompletion(systemPrompt, userPrompt, 1024, 0.5) as { content: string };

    // Parse JSON from response
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    return JSON.parse(jsonMatch[0]);

  } catch (error) {
    console.error('[Spreaker] Metadata generation error:', error);

    // Fallback metadata
    return {
      title: `Ep. ${episode.episodeNumber}: ${episode.headline}`.substring(0, 140),
      description: `${episode.description || episode.headline}\n\nThis episode is part of "Signed Into Law," a daily podcast exploring the 100 most consequential US laws from 1900-2000. Subscribe for your daily civic education journey.`,
      tags: `${episode.law.name}, ${episode.law.year}, ${episode.law.category}, US history, legislation, civic education, podcast, American law, government, policy`.substring(0, 200),
    };
  }
}

/**
 * POST /spreaker/upload/:episodeId
 * Upload a single podcast episode to Spreaker
 */
app.post('/spreaker/upload/:episodeId', async (c) => {
  try {
    const episodeId = c.req.param('episodeId');
    const db = c.env.APP_DB;
    const showId = c.env.SPREAKER_SHOW_ID;

    if (!showId) {
      return c.json({ success: false, error: 'SPREAKER_SHOW_ID not configured' }, 500);
    }

    // Get episode from database
    const episode = await db
      .prepare(`
        SELECT
          pe.*,
          hl.name as law_name,
          hl.year as law_year,
          hl.category as law_category,
          hl.description as law_description
        FROM podcast_episodes pe
        JOIN historic_laws hl ON pe.law_id = hl.id
        WHERE pe.id = ?
      `)
      .bind(episodeId)
      .first() as {
        id: string;
        episode_number: number;
        headline: string;
        description: string | null;
        audio_url: string | null;
        thumbnail_url: string | null;
        status: string;
        spreaker_episode_id: string | null;
        law_name: string;
        law_year: number;
        law_category: string;
        law_description: string;
      } | null;

    if (!episode) {
      return c.json({ success: false, error: 'Episode not found' }, 404);
    }

    if (episode.spreaker_episode_id) {
      return c.json({
        success: false,
        error: 'Episode already uploaded to Spreaker',
        spreakerId: episode.spreaker_episode_id,
      }, 400);
    }

    if (!episode.audio_url) {
      return c.json({ success: false, error: 'Episode has no audio URL' }, 400);
    }

    console.log(`[Spreaker] Uploading episode ${episode.episode_number}: ${episode.headline}`);

    // Get valid Spreaker token
    const accessToken = await getValidSpreakerToken(c.env);

    // Generate optimized metadata
    const metadata = await generateSpreakerMetadata(c.env, {
      episodeNumber: episode.episode_number,
      headline: episode.headline,
      description: episode.description,
      law: {
        name: episode.law_name,
        year: episode.law_year,
        category: episode.law_category,
        description: episode.law_description,
      },
    });

    console.log('[Spreaker] Generated metadata:', metadata.title);

    // Fetch audio file from Vultr
    console.log('[Spreaker] Fetching audio from:', episode.audio_url);
    const audioResponse = await fetch(episode.audio_url);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
    }
    const audioBuffer = await audioResponse.arrayBuffer();
    console.log(`[Spreaker] Audio fetched: ${audioBuffer.byteLength} bytes`);

    // Generate artwork with Gemini
    const artwork = await generateEpisodeArtwork(c.env, {
      headline: episode.headline,
      law: {
        name: episode.law_name,
        year: episode.law_year,
        category: episode.law_category,
      },
    });

    // Build multipart form data
    const formData = new FormData();
    formData.append('title', metadata.title);
    formData.append('description', metadata.description);
    formData.append('tags', metadata.tags);
    formData.append('episode_number', episode.episode_number.toString());
    formData.append('download_enabled', 'true');
    formData.append('visibility', 'PUBLIC');

    // Add audio file
    formData.append('media_file', new Blob([audioBuffer], { type: 'audio/mpeg' }), `episode-${episode.episode_number}.mp3`);

    // Add artwork if generated
    if (artwork) {
      formData.append('image_file', new Blob([new Uint8Array(artwork.imageBuffer)], { type: artwork.mimeType }), 'artwork.png');
      console.log('[Spreaker] Including AI-generated artwork');
    }

    // Upload to Spreaker
    console.log('[Spreaker] Uploading to Spreaker...');
    const uploadResponse = await fetch(`${SPREAKER_API_URL}/shows/${showId}/episodes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[Spreaker] Upload failed:', uploadResponse.status, errorText);
      return c.json({ success: false, error: `Upload failed: ${errorText}` }, 500);
    }

    const uploadResult = await uploadResponse.json() as {
      response: {
        episode: {
          episode_id: number;
          site_url: string;
          title: string;
        }
      }
    };

    const spreakerEpisodeId = uploadResult.response.episode.episode_id.toString();
    const spreakerUrl = uploadResult.response.episode.site_url;

    console.log(`[Spreaker] Upload successful! Episode ID: ${spreakerEpisodeId}`);

    // Update database with Spreaker info
    await db
      .prepare(`
        UPDATE podcast_episodes
        SET spreaker_episode_id = ?, spreaker_url = ?, spreaker_uploaded_at = ?
        WHERE id = ?
      `)
      .bind(spreakerEpisodeId, spreakerUrl, Date.now(), episodeId)
      .run();

    return c.json({
      success: true,
      message: 'Episode uploaded to Spreaker',
      episodeId,
      spreakerEpisodeId,
      spreakerUrl,
      title: metadata.title,
    });

  } catch (error) {
    console.error('[Spreaker] Upload error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /spreaker/backfill
 * Upload all completed episodes that haven't been uploaded to Spreaker
 */
app.post('/spreaker/backfill', async (c) => {
  try {
    const db = c.env.APP_DB;
    const showId = c.env.SPREAKER_SHOW_ID;

    if (!showId) {
      return c.json({ success: false, error: 'SPREAKER_SHOW_ID not configured' }, 500);
    }

    // Check authentication first
    const accessToken = await getValidSpreakerToken(c.env);
    console.log('[Spreaker] Auth verified, starting backfill...');

    // Get all completed episodes not yet uploaded
    const result = await db
      .prepare(`
        SELECT id, episode_number, headline
        FROM podcast_episodes
        WHERE status = 'completed'
          AND audio_url IS NOT NULL
          AND spreaker_episode_id IS NULL
        ORDER BY episode_number ASC
      `)
      .all();

    const episodes = result.results as Array<{ id: string; episode_number: number; headline: string }> || [];

    if (episodes.length === 0) {
      return c.json({
        success: true,
        message: 'No episodes to upload',
        uploaded: 0,
      });
    }

    console.log(`[Spreaker] Found ${episodes.length} episodes to backfill`);

    const results: Array<{ episodeId: string; episodeNumber: number; success: boolean; spreakerUrl?: string; error?: string }> = [];

    for (const episode of episodes) {
      try {
        console.log(`[Spreaker] Processing episode ${episode.episode_number}...`);

        // Make internal request to upload endpoint
        const uploadUrl = new URL(`/spreaker/upload/${episode.id}`, c.req.url);
        const uploadResponse = await app.fetch(
          new Request(uploadUrl, { method: 'POST' }),
          c.env
        );

        const uploadResult = await uploadResponse.json() as { success: boolean; spreakerUrl?: string; error?: string };

        results.push({
          episodeId: episode.id,
          episodeNumber: episode.episode_number,
          success: uploadResult.success,
          spreakerUrl: uploadResult.spreakerUrl,
          error: uploadResult.error,
        });

        if (uploadResult.success) {
          console.log(`[Spreaker] ✓ Episode ${episode.episode_number} uploaded`);
        } else {
          console.error(`[Spreaker] ✗ Episode ${episode.episode_number} failed:`, uploadResult.error);
        }

        // Delay between uploads to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 5000));

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Spreaker] Episode ${episode.episode_number} error:`, errorMessage);
        results.push({
          episodeId: episode.id,
          episodeNumber: episode.episode_number,
          success: false,
          error: errorMessage,
        });
      }
    }

    const uploaded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`[Spreaker] Backfill complete: ${uploaded} uploaded, ${failed} failed`);

    return c.json({
      success: true,
      message: `Backfill complete: ${uploaded} uploaded, ${failed} failed`,
      total: episodes.length,
      uploaded,
      failed,
      results,
    });

  } catch (error) {
    console.error('[Spreaker] Backfill error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /spreaker/episodes
 * List all episodes with their Spreaker upload status
 */
app.get('/spreaker/episodes', async (c) => {
  try {
    const db = c.env.APP_DB;

    const result = await db
      .prepare(`
        SELECT
          id,
          episode_number,
          headline,
          status,
          audio_url,
          spreaker_episode_id,
          spreaker_url,
          spreaker_uploaded_at
        FROM podcast_episodes
        WHERE status = 'completed'
        ORDER BY episode_number ASC
      `)
      .all();

    const episodes = result.results || [];

    const uploaded = episodes.filter((e: any) => e.spreaker_episode_id).length;
    const pending = episodes.filter((e: any) => !e.spreaker_episode_id && e.audio_url).length;

    return c.json({
      success: true,
      total: episodes.length,
      uploaded,
      pending,
      episodes,
    });

  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// ============================================================================
// ARTIFACT CRUD ENDPOINTS
// ============================================================================

/**
 * POST /artifacts
 * Create a new artifact
 */
app.post('/artifacts', async (c) => {
  try {
    const db = c.env.APP_DB;
    const body = await c.req.json();

    const {
      id,
      user_id,
      type,
      template,
      title,
      content,
      subject_type,
      subject_id,
      subject_context,
      audience = 'general',
    } = body;

    if (!id || !user_id || !type || !template || !title) {
      return c.json({
        success: false,
        error: 'Missing required fields: id, user_id, type, template, title',
      }, 400);
    }

    const now = Date.now();

    await db
      .prepare(`
        INSERT INTO artifacts (
          id, user_id, type, template, title, content,
          subject_type, subject_id, subject_context, audience,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id, user_id, type, template, title, content || null,
        subject_type || null, subject_id || null, subject_context || null, audience,
        now, now
      )
      .run();

    return c.json({
      success: true,
      artifact: {
        id,
        user_id,
        type,
        template,
        title,
        content,
        subject_type,
        subject_id,
        subject_context,
        audience,
        created_at: now,
        updated_at: now,
      },
    });

  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /artifacts/:id
 * Get a single artifact by ID
 */
app.get('/artifacts/:id', async (c) => {
  try {
    const db = c.env.APP_DB;
    const { id } = c.req.param();

    const result = await db
      .prepare('SELECT * FROM artifacts WHERE id = ?')
      .bind(id)
      .first();

    if (!result) {
      return c.json({
        success: false,
        error: 'Artifact not found',
      }, 404);
    }

    return c.json({
      success: true,
      artifact: result,
    });

  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /artifacts/user/:userId
 * Get all artifacts for a user
 */
app.get('/artifacts/user/:userId', async (c) => {
  try {
    const db = c.env.APP_DB;
    const { userId } = c.req.param();
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const type = c.req.query('type');

    let query = `
      SELECT * FROM artifacts
      WHERE user_id = ?
    `;
    const params: any[] = [userId];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await db.prepare(query).bind(...params).all();

    return c.json({
      success: true,
      artifacts: result.results || [],
      count: (result.results || []).length,
    });

  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /artifacts/share/:token
 * Get a publicly shared artifact
 */
app.get('/artifacts/share/:token', async (c) => {
  try {
    const db = c.env.APP_DB;
    const { token } = c.req.param();

    const result = await db
      .prepare('SELECT * FROM artifacts WHERE share_token = ? AND is_public = 1')
      .bind(token)
      .first();

    if (!result) {
      return c.json({
        success: false,
        error: 'Artifact not found or not public',
      }, 404);
    }

    // Increment view count
    await db
      .prepare('UPDATE artifacts SET view_count = view_count + 1 WHERE id = ?')
      .bind((result as any).id)
      .run();

    return c.json({
      success: true,
      artifact: result,
    });

  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * PUT /artifacts/:id
 * Update an artifact
 */
app.put('/artifacts/:id', async (c) => {
  try {
    const db = c.env.APP_DB;
    const { id } = c.req.param();
    const body = await c.req.json();

    // Check artifact exists
    const existing = await db
      .prepare('SELECT id FROM artifacts WHERE id = ?')
      .bind(id)
      .first();

    if (!existing) {
      return c.json({
        success: false,
        error: 'Artifact not found',
      }, 404);
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];

    const allowedFields = [
      'title', 'content', 'audience',
      'vultr_key', 'vultr_pdf_key', 'vultr_pptx_key',
      'is_public', 'share_token'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return c.json({
        success: false,
        error: 'No valid fields to update',
      }, 400);
    }

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    await db
      .prepare(`UPDATE artifacts SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    // Return updated artifact
    const updated = await db
      .prepare('SELECT * FROM artifacts WHERE id = ?')
      .bind(id)
      .first();

    return c.json({
      success: true,
      artifact: updated,
    });

  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * DELETE /artifacts/:id
 * Delete an artifact
 */
app.delete('/artifacts/:id', async (c) => {
  try {
    const db = c.env.APP_DB;
    const { id } = c.req.param();

    // Check artifact exists
    const existing = await db
      .prepare('SELECT id, vultr_key, vultr_pdf_key, vultr_pptx_key FROM artifacts WHERE id = ?')
      .bind(id)
      .first();

    if (!existing) {
      return c.json({
        success: false,
        error: 'Artifact not found',
      }, 404);
    }

    await db
      .prepare('DELETE FROM artifacts WHERE id = ?')
      .bind(id)
      .run();

    return c.json({
      success: true,
      message: 'Artifact deleted',
      // Return storage keys so caller can clean up Vultr storage if needed
      vultr_keys: {
        vultr_key: (existing as any).vultr_key,
        vultr_pdf_key: (existing as any).vultr_pdf_key,
        vultr_pptx_key: (existing as any).vultr_pptx_key,
      },
    });

  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
