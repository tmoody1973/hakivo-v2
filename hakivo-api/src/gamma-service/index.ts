import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import { GammaGenerateRequest, GammaFormat, GammaTextMode, GammaTextAmount, GammaImageSource } from '../gamma-client';
import { enrichContent, quickEnrich, EnrichmentOptions, ArtifactContent, EnrichedContent } from './enrichment';

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());

// Manual CORS middleware
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin') || '';
  const allowedOrigins = ['http://localhost:3000', 'https://hakivo-v2.netlify.app'];

  if (allowedOrigins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
  } else {
    c.header('Access-Control-Allow-Origin', '*');
  }
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Max-Age', '600');

  if (c.req.method === 'OPTIONS') {
    return c.text('', 200);
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
    console.error('[Gamma Service] JWT verification failed:', error);
    return null;
  }
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a share token
 */
function generateShareToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'gamma-service',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/gamma/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'gamma-service',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/gamma/generate
 * Start a new Gamma document generation
 *
 * Body:
 * - inputText: string (required) - Content to generate from
 * - textMode: 'generate' | 'condense' | 'preserve' (default: 'generate')
 * - format: 'presentation' | 'document' | 'webpage' | 'social' (default: 'presentation')
 * - template: string - Template preset name
 * - themeId: string - Gamma theme ID
 * - numCards: number - Number of cards (1-60)
 * - textOptions: { amount, tone, audience, language }
 * - imageOptions: { source, style }
 * - exportAs: 'pdf' | 'pptx'
 * - artifactId: string - Source artifact ID (optional)
 * - subjectType: string - bill, member, policy
 * - subjectId: string - bill number, bioguide_id
 */
app.post('/api/gamma/generate', async (c) => {
  const auth = await verifyAuth(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json() as {
    inputText: string;
    textMode?: GammaTextMode;
    format?: GammaFormat;
    template?: string;
    themeId?: string;
    numCards?: number;
    textOptions?: {
      amount?: GammaTextAmount;
      tone?: string;
      audience?: string;
      language?: string;
    };
    imageOptions?: {
      source?: GammaImageSource;
      style?: string;
    };
    exportAs?: 'pdf' | 'pptx';
    artifactId?: string;
    subjectType?: string;
    subjectId?: string;
    title?: string;
  };

  if (!body.inputText || body.inputText.trim().length === 0) {
    return c.json({ error: 'inputText is required' }, 400);
  }

  try {
    const gammaClient = c.env.GAMMA_CLIENT;
    const gammaDb = c.env.GAMMA_DB;  // Use separate gamma database

    // Build Gamma request
    const gammaRequest: GammaGenerateRequest = {
      inputText: body.inputText,
      textMode: body.textMode || 'generate',
      format: body.format || 'presentation',
    };

    if (body.themeId) gammaRequest.themeId = body.themeId;
    if (body.numCards) gammaRequest.numCards = body.numCards;
    if (body.textOptions) gammaRequest.textOptions = body.textOptions;
    if (body.imageOptions) gammaRequest.imageOptions = body.imageOptions;
    if (body.exportAs) gammaRequest.exportAs = body.exportAs;

    // Start Gamma generation
    const generation = await gammaClient.generate(gammaRequest);

    // Validate that we got a generation ID back from Gamma API
    if (!generation.id) {
      console.error('[Gamma Service] Gamma API returned no generation ID:', generation);
      return c.json({
        error: 'Gamma API returned invalid response',
        details: generation.error || 'No generation ID returned',
      }, 502);
    }

    // Create record in gamma database
    const docId = generateId();
    const now = Date.now();

    // Use nullish coalescing (??) to properly convert undefined to null for D1
    await gammaDb
      .prepare(`
        INSERT INTO gamma_documents (
          id, user_id, artifact_id, gamma_generation_id, title, format, template,
          subject_type, subject_id, audience, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        docId,
        auth.userId,
        body.artifactId ?? null,
        generation.id,
        body.title ?? 'Untitled Document',
        body.format ?? 'presentation',
        body.template ?? null,
        body.subjectType ?? null,
        body.subjectId ?? null,
        body.textOptions?.audience ?? null,
        'pending',
        now,
        now
      )
      .run();

    console.log(`[Gamma Service] Started generation ${generation.id} for user ${auth.userId}`);

    return c.json({
      success: true,
      documentId: docId,
      generationId: generation.id,
      status: generation.status,
    });
  } catch (error) {
    console.error('[Gamma Service] Generation error:', error);
    return c.json({
      error: 'Failed to start generation',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/gamma/generate-enriched
 * Generate a Gamma document with content enrichment from multiple data sources
 *
 * This endpoint enriches the input content with:
 * - Bill details (sponsors, cosponsors, status) from CONGRESSIONAL_DB
 * - Recent news context from PERPLEXITY_CLIENT
 * - Related bills from LEGISLATION_SEARCH (semantic search)
 * - Campaign finance data from FEC_CLIENT (for member subjects)
 * - Voting records from APP_DB (for member subjects)
 *
 * Body:
 * - artifact: { title, content, subjectType?, subjectId? }
 * - enrichmentOptions: { includeBillDetails?, includeNewsContext?, includeRelatedBills?, ... }
 * - gammaOptions: { format, textMode, template, themeId, ... }
 */
app.post('/api/gamma/generate-enriched', async (c) => {
  const auth = await verifyAuth(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json() as {
    artifact: ArtifactContent;
    enrichmentOptions?: EnrichmentOptions;
    gammaOptions?: {
      textMode?: GammaTextMode;
      format?: GammaFormat;
      template?: string;
      themeId?: string;
      numCards?: number;
      textOptions?: {
        amount?: GammaTextAmount;
        tone?: string;
        audience?: string;
        language?: string;
      };
      imageOptions?: {
        source?: GammaImageSource;
        style?: string;
      };
      exportAs?: 'pdf' | 'pptx';
    };
    title?: string;
    /** Skip enrichment to avoid timeout - just use raw artifact content */
    skipEnrichment?: boolean;
  };

  if (!body.artifact || !body.artifact.content) {
    return c.json({ error: 'artifact.content is required' }, 400);
  }

  try {
    console.log(`[Gamma Service] Starting enriched generation for: ${body.artifact.title}`);

    // Step 1: Enrich the content (or skip if skipEnrichment is true)
    let enrichedContent: EnrichedContent;

    if (body.skipEnrichment) {
      // Skip enrichment - just use raw artifact content
      console.log('[Gamma Service] Skipping enrichment (skipEnrichment=true)');
      enrichedContent = {
        original: body.artifact,
        enrichedText: `# ${body.artifact.title}\n\n${body.artifact.content}`,
        enrichmentMeta: {
          timestamp: new Date().toISOString(),
          optionsUsed: {},
          sourcesUsed: [],
        },
      };
    } else if (body.enrichmentOptions && Object.keys(body.enrichmentOptions).length > 0) {
      // Use explicit enrichment options
      enrichedContent = await enrichContent(
        body.artifact,
        body.enrichmentOptions,
        {
          APP_DB: c.env.APP_DB,
          CONGRESSIONAL_DB: c.env.CONGRESSIONAL_DB,
          LEGISLATION_SEARCH: c.env.LEGISLATION_SEARCH,
          PERPLEXITY_CLIENT: c.env.PERPLEXITY_CLIENT,
          FEC_CLIENT: c.env.FEC_CLIENT,
        }
      );
    } else {
      // Use quick enrichment with smart defaults based on subject type
      enrichedContent = await quickEnrich(
        body.artifact,
        {
          APP_DB: c.env.APP_DB,
          CONGRESSIONAL_DB: c.env.CONGRESSIONAL_DB,
          LEGISLATION_SEARCH: c.env.LEGISLATION_SEARCH,
          PERPLEXITY_CLIENT: c.env.PERPLEXITY_CLIENT,
          FEC_CLIENT: c.env.FEC_CLIENT,
        }
      );
    }

    console.log(`[Gamma Service] Enrichment complete. Sources used: ${enrichedContent.enrichmentMeta.sourcesUsed.join(', ')}`);

    // Step 2: Generate Gamma document with enriched content
    const gammaClient = c.env.GAMMA_CLIENT;
    const gammaDb = c.env.GAMMA_DB;  // Use separate gamma database

    const gammaOptions = body.gammaOptions || {};
    const gammaRequest: GammaGenerateRequest = {
      inputText: enrichedContent.enrichedText,
      textMode: gammaOptions.textMode || 'generate',
      format: gammaOptions.format || 'presentation',
    };

    if (gammaOptions.themeId) gammaRequest.themeId = gammaOptions.themeId;
    if (gammaOptions.numCards) gammaRequest.numCards = gammaOptions.numCards;
    if (gammaOptions.textOptions) gammaRequest.textOptions = gammaOptions.textOptions;
    if (gammaOptions.imageOptions) gammaRequest.imageOptions = gammaOptions.imageOptions;
    if (gammaOptions.exportAs) gammaRequest.exportAs = gammaOptions.exportAs;

    // Start Gamma generation
    const generation = await gammaClient.generate(gammaRequest);

    // Validate that we got a generation ID back from Gamma API
    if (!generation.id) {
      console.error('[Gamma Service] Gamma API returned no generation ID:', generation);
      return c.json({
        error: 'Gamma API returned invalid response',
        details: generation.error || 'No generation ID returned',
      }, 502);
    }

    // Create record in gamma database
    const docId = generateId();
    const now = Date.now();

    // Use nullish coalescing (??) to properly convert undefined to null for D1
    await gammaDb
      .prepare(`
        INSERT INTO gamma_documents (
          id, user_id, artifact_id, gamma_generation_id, title, format, template,
          subject_type, subject_id, audience, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        docId,
        auth.userId,
        body.artifact?.id ?? null,
        generation.id,
        body.title ?? body.artifact?.title ?? 'Untitled Document',
        gammaOptions?.format ?? 'presentation',
        gammaOptions?.template ?? null,
        body.artifact?.subjectType ?? null,
        body.artifact?.subjectId ?? null,
        gammaOptions?.textOptions?.audience ?? null,
        'pending',
        now,
        now
      )
      .run();

    console.log(`[Gamma Service] Started enriched generation ${generation.id} for user ${auth.userId}`);

    return c.json({
      success: true,
      documentId: docId,
      generationId: generation.id,
      status: generation.status,
      enrichment: {
        sourcesUsed: enrichedContent.enrichmentMeta.sourcesUsed,
        errors: enrichedContent.enrichmentMeta.errors,
        billDetails: enrichedContent.billDetails ? {
          id: enrichedContent.billDetails.id,
          title: enrichedContent.billDetails.title,
          sponsor: enrichedContent.billDetails.sponsor,
          cosponsorsCount: enrichedContent.billDetails.cosponsors?.length || 0,
        } : null,
        relatedBillsCount: enrichedContent.relatedBills?.length || 0,
        hasNewsContext: !!enrichedContent.newsContext,
        hasCampaignFinance: !!enrichedContent.campaignFinance,
      },
    });
  } catch (error) {
    console.error('[Gamma Service] Enriched generation error:', error);
    return c.json({
      error: 'Failed to generate enriched document',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/gamma/enqueue-enriched
 * Enqueue a document for background enrichment processing
 *
 * This endpoint creates a pending record and returns immediately.
 * The actual enrichment and Gamma generation happens in a Netlify background function.
 *
 * This avoids timeout issues with the synchronous generate-enriched endpoint.
 *
 * Body: Same as generate-enriched
 * - artifact: { title, content, subjectType?, subjectId? }
 * - enrichmentOptions: { includeBillDetails?, includeNewsContext?, ... }
 * - gammaOptions: { format, textMode, template, themeId, ... }
 *
 * Returns:
 * - documentId: string - ID to poll for status
 * - status: 'enrichment_pending' - Initial status
 */
app.post('/api/gamma/enqueue-enriched', async (c) => {
  const authHeader = c.req.header('Authorization');
  const auth = await verifyAuth(authHeader, c.env.JWT_SECRET);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json() as {
    artifact: ArtifactContent;
    enrichmentOptions?: EnrichmentOptions;
    gammaOptions?: {
      textMode?: GammaTextMode;
      format?: GammaFormat;
      template?: string;
      themeId?: string;
      numCards?: number;
      textOptions?: {
        amount?: GammaTextAmount;
        tone?: string;
        audience?: string;
        language?: string;
      };
      imageOptions?: {
        source?: GammaImageSource;
        style?: string;
      };
      exportAs?: 'pdf' | 'pptx';
    };
    title?: string;
    skipEnrichment?: boolean;
  };

  if (!body.artifact || !body.artifact.content) {
    return c.json({ error: 'artifact.content is required' }, 400);
  }

  try {
    const gammaDb = c.env.GAMMA_DB;  // Use separate gamma database
    const docId = generateId();
    const now = Date.now();
    const gammaOptions = body.gammaOptions || {};

    // Store the request payload including the JWT token for background processing
    const requestPayload = JSON.stringify({
      artifact: body.artifact,
      enrichmentOptions: body.enrichmentOptions,
      gammaOptions: body.gammaOptions,
      title: body.title,
      skipEnrichment: body.skipEnrichment,
      // Store the JWT token so background function can make authenticated calls
      jwtToken: authHeader?.replace('Bearer ', ''),
    });

    // Create pending record - use empty string for gamma_generation_id since it's NOT NULL
    // The background function will update this once Gamma API is called
    // Use nullish coalescing (??) to properly convert undefined to null for D1
    await gammaDb
      .prepare(`
        INSERT INTO gamma_documents (
          id, user_id, artifact_id, gamma_generation_id, title, format, template,
          subject_type, subject_id, audience, status, request_payload,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        docId,
        auth.userId,
        body.artifact?.id ?? null,
        '', // Empty string placeholder - will be updated when Gamma API is called
        body.title ?? body.artifact?.title ?? 'Untitled Document',
        gammaOptions?.format ?? 'presentation',
        gammaOptions?.template ?? null,
        body.artifact?.subjectType ?? null,
        body.artifact?.subjectId ?? null,
        gammaOptions?.textOptions?.audience ?? null,
        'enrichment_pending', // New status for background processing
        requestPayload,
        now,
        now
      )
      .run();

    console.log(`[Gamma Service] Enqueued document ${docId} for background enrichment`);

    return c.json({
      success: true,
      documentId: docId,
      status: 'enrichment_pending',
      message: 'Document queued for background processing',
    });
  } catch (error) {
    console.error('[Gamma Service] Enqueue error:', error);
    return c.json({
      error: 'Failed to enqueue document',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/gamma/document-status/:documentId
 * Get the status of a document by its internal ID (not Gamma generation ID)
 * This is useful for polling before Gamma generation starts
 */
app.get('/api/gamma/document-status/:documentId', async (c) => {
  const auth = await verifyAuth(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const documentId = c.req.param('documentId');
  if (!documentId) {
    return c.json({ error: 'documentId is required' }, 400);
  }

  try {
    const gammaDb = c.env.GAMMA_DB;  // Use separate gamma database

    const doc = await gammaDb
      .prepare(`
        SELECT id, status, gamma_generation_id, gamma_url, gamma_thumbnail_url,
               card_count, error_message, title, format, template,
               created_at, updated_at, completed_at
        FROM gamma_documents
        WHERE id = ? AND user_id = ?
      `)
      .bind(documentId, auth.userId)
      .first();

    if (!doc) {
      return c.json({ error: 'Document not found' }, 404);
    }

    return c.json({
      success: true,
      documentId: doc.id,
      status: doc.status,
      generationId: doc.gamma_generation_id || null,
      url: doc.gamma_url || null,
      thumbnailUrl: doc.gamma_thumbnail_url || null,
      cardCount: doc.card_count || 0,
      title: doc.title,
      format: doc.format,
      template: doc.template,
      error: doc.error_message || null,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
      completedAt: doc.completed_at,
    });
  } catch (error) {
    console.error('[Gamma Service] Document status error:', error);
    return c.json({
      error: 'Failed to get document status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/gamma/enrich
 * Enrich content without generating a Gamma document
 * Useful for previewing enriched content before generation
 */
app.post('/api/gamma/enrich', async (c) => {
  const auth = await verifyAuth(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json() as {
    artifact: ArtifactContent;
    options?: EnrichmentOptions;
  };

  if (!body.artifact || !body.artifact.content) {
    return c.json({ error: 'artifact.content is required' }, 400);
  }

  try {
    console.log(`[Gamma Service] Enriching content: ${body.artifact.title}`);

    let enrichedContent: EnrichedContent;

    if (body.options && Object.keys(body.options).length > 0) {
      enrichedContent = await enrichContent(
        body.artifact,
        body.options,
        {
          APP_DB: c.env.APP_DB,
          CONGRESSIONAL_DB: c.env.CONGRESSIONAL_DB,
          LEGISLATION_SEARCH: c.env.LEGISLATION_SEARCH,
          PERPLEXITY_CLIENT: c.env.PERPLEXITY_CLIENT,
          FEC_CLIENT: c.env.FEC_CLIENT,
        }
      );
    } else {
      enrichedContent = await quickEnrich(
        body.artifact,
        {
          APP_DB: c.env.APP_DB,
          CONGRESSIONAL_DB: c.env.CONGRESSIONAL_DB,
          LEGISLATION_SEARCH: c.env.LEGISLATION_SEARCH,
          PERPLEXITY_CLIENT: c.env.PERPLEXITY_CLIENT,
          FEC_CLIENT: c.env.FEC_CLIENT,
        }
      );
    }

    return c.json({
      success: true,
      enrichedContent: {
        enrichedText: enrichedContent.enrichedText,
        billDetails: enrichedContent.billDetails,
        newsContext: enrichedContent.newsContext,
        relatedBills: enrichedContent.relatedBills,
        campaignFinance: enrichedContent.campaignFinance,
        votingRecords: enrichedContent.votingRecords,
      },
      meta: enrichedContent.enrichmentMeta,
    });
  } catch (error) {
    console.error('[Gamma Service] Enrichment error:', error);
    return c.json({
      error: 'Failed to enrich content',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/gamma/status/:generationId
 * Poll for generation status
 */
app.get('/api/gamma/status/:generationId', async (c) => {
  const auth = await verifyAuth(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const generationId = c.req.param('generationId');
  if (!generationId) {
    return c.json({ error: 'generationId is required' }, 400);
  }

  try {
    const gammaClient = c.env.GAMMA_CLIENT;
    const gammaDb = c.env.GAMMA_DB;  // Use separate gamma database

    // Get status from Gamma
    const status = await gammaClient.getStatus(generationId);

    // Update database if status changed
    if (status.status === 'completed' || status.status === 'failed') {
      const now = Date.now();

      await gammaDb
        .prepare(`
          UPDATE gamma_documents SET
            status = ?,
            gamma_url = ?,
            gamma_thumbnail_url = ?,
            card_count = ?,
            error_message = ?,
            completed_at = ?,
            updated_at = ?
          WHERE gamma_generation_id = ? AND user_id = ?
        `)
        .bind(
          status.status,
          status.url || null,
          status.thumbnailUrl || null,
          status.cardCount || 0,
          status.error || null,
          status.status === 'completed' ? now : null,
          now,
          generationId,
          auth.userId
        )
        .run();
    }

    return c.json({
      success: true,
      generationId: status.id,
      status: status.status,
      url: status.url,
      thumbnailUrl: status.thumbnailUrl,
      title: status.title,
      cardCount: status.cardCount,
      exports: status.exports,
      error: status.error,
    });
  } catch (error) {
    console.error('[Gamma Service] Status check error:', error);
    return c.json({
      error: 'Failed to check status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/gamma/save/:documentId
 * Save export files (PDF/PPTX) to Vultr storage
 */
app.post('/api/gamma/save/:documentId', async (c) => {
  const auth = await verifyAuth(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const documentId = c.req.param('documentId');
  if (!documentId) {
    return c.json({ error: 'documentId is required' }, 400);
  }

  const body = await c.req.json() as {
    exportFormats?: ('pdf' | 'pptx')[];
  };

  try {
    const gammaDb = c.env.GAMMA_DB;  // Use separate gamma database
    const gammaClient = c.env.GAMMA_CLIENT;
    const vultrClient = c.env.VULTR_STORAGE_CLIENT;

    // Get document
    const doc = await gammaDb
      .prepare(`
        SELECT * FROM gamma_documents
        WHERE id = ? AND user_id = ?
      `)
      .bind(documentId, auth.userId)
      .first();

    if (!doc) {
      return c.json({ error: 'Document not found' }, 404);
    }

    if (doc.status !== 'completed') {
      return c.json({ error: 'Document generation not completed' }, 400);
    }

    const exports: { pdf?: string; pptx?: string } = {};
    const storageKeys: { pdf?: string; pptx?: string } = {};
    const formats = body.exportFormats || ['pdf'];

    for (const format of formats) {
      try {
        // Get export URL from Gamma
        const exportUrl = await gammaClient.getExportUrl(doc.gamma_generation_id as string, format);

        if (exportUrl) {
          // Download the file
          const response = await fetch(exportUrl);
          if (!response.ok) {
            console.error(`[Gamma Service] Failed to download ${format}: ${response.status}`);
            continue;
          }

          const fileBuffer = await response.arrayBuffer();
          const fileName = `gamma/${auth.userId}/${documentId}.${format}`;

          // Upload to Vultr
          const uploadResult = await vultrClient.uploadFile(
            fileName,
            new Uint8Array(fileBuffer),
            format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          );

          // Get the CDN URL from upload result
          const cdnUrl = uploadResult.url;

          if (format === 'pdf') {
            exports.pdf = cdnUrl;
            storageKeys.pdf = fileName;
          } else {
            exports.pptx = cdnUrl;
            storageKeys.pptx = fileName;
          }
        }
      } catch (exportError) {
        console.error(`[Gamma Service] Export ${format} error:`, exportError);
      }
    }

    // Update database with storage info
    const now = Date.now();
    await gammaDb
      .prepare(`
        UPDATE gamma_documents SET
          pdf_storage_key = COALESCE(?, pdf_storage_key),
          pdf_url = COALESCE(?, pdf_url),
          pptx_storage_key = COALESCE(?, pptx_storage_key),
          pptx_url = COALESCE(?, pptx_url),
          updated_at = ?
        WHERE id = ?
      `)
      .bind(
        storageKeys.pdf || null,
        exports.pdf || null,
        storageKeys.pptx || null,
        exports.pptx || null,
        now,
        documentId
      )
      .run();

    console.log(`[Gamma Service] Saved exports for document ${documentId}`);

    return c.json({
      success: true,
      documentId,
      exports,
    });
  } catch (error) {
    console.error('[Gamma Service] Save error:', error);
    return c.json({
      error: 'Failed to save exports',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/gamma/documents
 * List user's Gamma documents
 */
app.get('/api/gamma/documents', async (c) => {
  const auth = await verifyAuth(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');
  const format = c.req.query('format');
  const template = c.req.query('template');

  try {
    const gammaDb = c.env.GAMMA_DB;  // Use separate gamma database

    let query = `
      SELECT
        id, title, format, template, status,
        gamma_url, gamma_thumbnail_url, card_count,
        pdf_url, pptx_url,
        subject_type, subject_id, audience,
        is_public, share_token, view_count,
        created_at, updated_at, completed_at
      FROM gamma_documents
      WHERE user_id = ?
    `;

    const params: (string | number)[] = [auth.userId];

    if (format) {
      query += ' AND format = ?';
      params.push(format);
    }

    if (template) {
      query += ' AND template = ?';
      params.push(template);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const results = await gammaDb.prepare(query).bind(...params).all();

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM gamma_documents WHERE user_id = ?';
    const countParams: (string | number)[] = [auth.userId];

    if (format) {
      countQuery += ' AND format = ?';
      countParams.push(format);
    }

    if (template) {
      countQuery += ' AND template = ?';
      countParams.push(template);
    }

    const countResult = await gammaDb.prepare(countQuery).bind(...countParams).first();

    return c.json({
      success: true,
      documents: results.results || [],
      total: (countResult as { count: number })?.count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Gamma Service] List error:', error);
    return c.json({
      error: 'Failed to list documents',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/gamma/documents/:id
 * Get a specific Gamma document
 */
app.get('/api/gamma/documents/:id', async (c) => {
  const documentId = c.req.param('id');
  if (!documentId) {
    return c.json({ error: 'Document ID is required' }, 400);
  }

  try {
    const gammaDb = c.env.GAMMA_DB;  // Use separate gamma database

    // First try to get by share token (public access)
    let doc = await gammaDb
      .prepare(`
        SELECT * FROM gamma_documents
        WHERE share_token = ? AND is_public = 1
      `)
      .bind(documentId)
      .first();

    if (doc) {
      // Increment view count for public access
      await gammaDb
        .prepare('UPDATE gamma_documents SET view_count = view_count + 1 WHERE id = ?')
        .bind(doc.id)
        .run();

      return c.json({
        success: true,
        document: doc,
        isPublic: true,
      });
    }

    // Otherwise require auth
    const auth = await verifyAuth(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    doc = await gammaDb
      .prepare('SELECT * FROM gamma_documents WHERE id = ? AND user_id = ?')
      .bind(documentId, auth.userId)
      .first();

    if (!doc) {
      return c.json({ error: 'Document not found' }, 404);
    }

    return c.json({
      success: true,
      document: doc,
      isPublic: false,
    });
  } catch (error) {
    console.error('[Gamma Service] Get document error:', error);
    return c.json({
      error: 'Failed to get document',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * DELETE /api/gamma/documents/:id
 * Delete a Gamma document
 */
app.delete('/api/gamma/documents/:id', async (c) => {
  const auth = await verifyAuth(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const documentId = c.req.param('id');
  if (!documentId) {
    return c.json({ error: 'Document ID is required' }, 400);
  }

  try {
    const gammaDb = c.env.GAMMA_DB;  // Use separate gamma database
    const vultrClient = c.env.VULTR_STORAGE_CLIENT;

    // Get document to delete storage files
    const doc = await gammaDb
      .prepare('SELECT * FROM gamma_documents WHERE id = ? AND user_id = ?')
      .bind(documentId, auth.userId)
      .first();

    if (!doc) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // Delete storage files
    if (doc.pdf_storage_key) {
      try {
        await vultrClient.deleteFile(doc.pdf_storage_key as string);
      } catch (e) {
        console.error('[Gamma Service] Failed to delete PDF file:', e);
      }
    }

    if (doc.pptx_storage_key) {
      try {
        await vultrClient.deleteFile(doc.pptx_storage_key as string);
      } catch (e) {
        console.error('[Gamma Service] Failed to delete PPTX file:', e);
      }
    }

    // Delete database record
    await gammaDb
      .prepare('DELETE FROM gamma_documents WHERE id = ?')
      .bind(documentId)
      .run();

    console.log(`[Gamma Service] Deleted document ${documentId}`);

    return c.json({
      success: true,
      message: 'Document deleted',
    });
  } catch (error) {
    console.error('[Gamma Service] Delete error:', error);
    return c.json({
      error: 'Failed to delete document',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * PATCH /api/gamma/documents/:id/share
 * Toggle public sharing for a document
 */
app.patch('/api/gamma/documents/:id/share', async (c) => {
  const auth = await verifyAuth(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const documentId = c.req.param('id');
  const body = await c.req.json() as { isPublic: boolean };

  try {
    const gammaDb = c.env.GAMMA_DB;  // Use separate gamma database

    // Verify ownership
    const doc = await gammaDb
      .prepare('SELECT * FROM gamma_documents WHERE id = ? AND user_id = ?')
      .bind(documentId, auth.userId)
      .first();

    if (!doc) {
      return c.json({ error: 'Document not found' }, 404);
    }

    const now = Date.now();
    let shareToken = doc.share_token as string | null;

    // Generate share token if making public and none exists
    if (body.isPublic && !shareToken) {
      shareToken = generateShareToken();
    }

    await gammaDb
      .prepare(`
        UPDATE gamma_documents SET
          is_public = ?,
          share_token = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .bind(body.isPublic ? 1 : 0, shareToken, now, documentId)
      .run();

    return c.json({
      success: true,
      isPublic: body.isPublic,
      shareToken: body.isPublic ? shareToken : null,
      shareUrl: body.isPublic ? `https://hakivo-v2.netlify.app/gamma/${shareToken}` : null,
    });
  } catch (error) {
    console.error('[Gamma Service] Share toggle error:', error);
    return c.json({
      error: 'Failed to update sharing',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/gamma/documents/:id/email
 * Send document via email
 */
app.post('/api/gamma/documents/:id/email', async (c) => {
  const auth = await verifyAuth(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const documentId = c.req.param('id');
  const body = await c.req.json() as {
    recipientEmail: string;
    recipientName?: string;
    subject?: string;
    message?: string;
  };

  if (!body.recipientEmail) {
    return c.json({ error: 'recipientEmail is required' }, 400);
  }

  try {
    const gammaDb = c.env.GAMMA_DB;  // Use separate gamma database

    // Verify ownership and get document
    const doc = await gammaDb
      .prepare('SELECT * FROM gamma_documents WHERE id = ? AND user_id = ?')
      .bind(documentId, auth.userId)
      .first();

    if (!doc) {
      return c.json({ error: 'Document not found' }, 404);
    }

    if (doc.status !== 'completed') {
      return c.json({ error: 'Document is not ready for sharing' }, 400);
    }

    // Make sure document is public for sharing
    let shareToken = doc.share_token as string | null;
    if (!shareToken) {
      shareToken = generateShareToken();
      const now = Date.now();
      await gammaDb
        .prepare(`
          UPDATE gamma_documents SET
            is_public = 1,
            share_token = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .bind(shareToken, now, documentId)
        .run();
    }

    const shareUrl = `https://hakivo.com/gamma/${shareToken}`;
    const gammaUrl = doc.gamma_url as string || shareUrl;
    const pdfUrl = doc.pdf_url as string | null;

    // Build email content
    const senderName = 'A Hakivo user';
    const docTitle = doc.title as string;
    const docFormat = doc.format as string;

    const emailSubject = body.subject || `${senderName} shared a ${docFormat} with you: ${docTitle}`;
    const emailBody = `
${body.recipientName ? `Hi ${body.recipientName},` : 'Hello,'}

${body.message || `${senderName} has shared a professional ${docFormat} with you via Hakivo.`}

**${docTitle}**

View online: ${gammaUrl}
${pdfUrl ? `Download PDF: ${pdfUrl}` : ''}

---
Shared via Hakivo - Your Congressional Intelligence Platform
https://hakivo.com
    `.trim();

    // In production, this would send via an email service (SendGrid, Resend, etc.)
    // For now, we'll log it and return success
    console.log(`[Gamma Service] Email share requested:
      To: ${body.recipientEmail}
      Subject: ${emailSubject}
      Document: ${docTitle} (${documentId})
    `);

    // TODO: Integrate with email service
    // await c.env.EMAIL_SERVICE.send({
    //   to: body.recipientEmail,
    //   subject: emailSubject,
    //   text: emailBody,
    // });

    return c.json({
      success: true,
      message: 'Email share initiated',
      shareUrl,
      recipient: body.recipientEmail,
    });
  } catch (error) {
    console.error('[Gamma Service] Email share error:', error);
    return c.json({
      error: 'Failed to send email',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/gamma/share/:token/view
 * Increment view count for a shared document
 */
app.post('/api/gamma/share/:token/view', async (c) => {
  const shareToken = c.req.param('token');

  try {
    const gammaDb = c.env.GAMMA_DB;  // Use separate gamma database

    // Find document by share token
    const doc = await gammaDb
      .prepare('SELECT id, view_count FROM gamma_documents WHERE share_token = ? AND is_public = 1')
      .bind(shareToken)
      .first();

    if (!doc) {
      return c.json({ error: 'Document not found or not public' }, 404);
    }

    // Increment view count
    const newViewCount = ((doc.view_count as number) || 0) + 1;
    await gammaDb
      .prepare('UPDATE gamma_documents SET view_count = ? WHERE id = ?')
      .bind(newViewCount, doc.id)
      .run();

    return c.json({
      success: true,
      viewCount: newViewCount,
    });
  } catch (error) {
    console.error('[Gamma Service] View count error:', error);
    return c.json({
      error: 'Failed to update view count',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/gamma/share/:token
 * Get public document by share token (no auth required)
 */
app.get('/api/gamma/share/:token', async (c) => {
  const shareToken = c.req.param('token');

  try {
    const gammaDb = c.env.GAMMA_DB;  // Use separate gamma database
    const appDb = c.env.APP_DB;      // For user lookup

    // Find document by share token (from gamma-db)
    const doc = await gammaDb
      .prepare(`
        SELECT
          id, user_id, title, format, template, card_count,
          gamma_url, gamma_thumbnail_url, pdf_url, pptx_url,
          subject_type, subject_id, audience,
          view_count, created_at
        FROM gamma_documents
        WHERE share_token = ? AND is_public = 1 AND status = 'completed'
      `)
      .bind(shareToken)
      .first();

    if (!doc) {
      return c.json({ error: 'Document not found or not public' }, 404);
    }

    // Get author info from app-db (separate query since it's a different database)
    let authorName: string | null = null;
    if (doc.user_id) {
      const user = await appDb
        .prepare('SELECT first_name, last_name FROM users WHERE id = ?')
        .bind(doc.user_id)
        .first();
      if (user && user.first_name) {
        authorName = `${user.first_name} ${user.last_name || ''}`.trim();
      }
    }

    return c.json({
      success: true,
      document: {
        id: doc.id,
        title: doc.title,
        format: doc.format,
        template: doc.template,
        cardCount: doc.card_count,
        gammaUrl: doc.gamma_url,
        thumbnailUrl: doc.gamma_thumbnail_url,
        pdfUrl: doc.pdf_url,
        pptxUrl: doc.pptx_url,
        subjectType: doc.subject_type,
        subjectId: doc.subject_id,
        audience: doc.audience,
        viewCount: doc.view_count,
        createdAt: doc.created_at,
        author: authorName,
      },
    });
  } catch (error) {
    console.error('[Gamma Service] Get shared document error:', error);
    return c.json({
      error: 'Failed to get document',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/gamma/themes
 * List available Gamma themes
 */
app.get('/api/gamma/themes', async (c) => {
  try {
    const gammaClient = c.env.GAMMA_CLIENT;
    const themes = await gammaClient.listThemes();

    return c.json({
      success: true,
      themes,
    });
  } catch (error) {
    console.error('[Gamma Service] List themes error:', error);
    return c.json({
      error: 'Failed to list themes',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Raindrop Service implementation
 */
export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
