/**
 * Netlify Background Function for Gamma Enrichment Processing
 *
 * Polls database for gamma_documents with status='enrichment_pending'
 * and processes them through enrichment and Gamma API generation.
 *
 * Background functions get 15-minute timeout (vs 10s for regular functions).
 * This function polls the database instead of using POST body since
 * background functions have a known issue where POST bodies are empty.
 *
 * Processing flow:
 * 1. Find documents with status='enrichment_pending'
 * 2. Update status to 'enriching'
 * 3. Call Raindrop gamma-service for enrichment
 * 4. Update status to 'generating' and call Gamma API
 * 5. Update status to 'completed' with URL and exports
 */
import type { Context } from "@netlify/functions";

// Raindrop service URLs (hakivo-prod @01kc6cdq deployment)
// Admin-dashboard service for database queries (uses /api/database/query)
const DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyzp.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

// Gamma service for enrichment and generation
const GAMMA_SERVICE_URL = process.env.NEXT_PUBLIC_GAMMA_SERVICE_URL ||
  'https://svc-01kcp5rv55e6psxh5ht7byqrgd.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

interface GammaDocument {
  id: string;
  user_id: string;
  status: string;
  request_payload: string;
  gamma_generation_id: string | null;
}

interface EnrichmentRequest {
  artifact: {
    id?: string;
    title: string;
    content: string;
    subjectType?: string;
    subjectId?: string;
  };
  enrichmentOptions?: {
    includeBillDetails?: boolean;
    includeVotingRecords?: boolean;
    includeNewsContext?: boolean;
    includeRelatedBills?: boolean;
    includeCampaignFinance?: boolean;
  };
  gammaOptions?: {
    textMode?: string;
    format?: string;
    template?: string;
    themeId?: string;
    numCards?: number;
    textOptions?: {
      amount?: string;
      tone?: string;
      audience?: string;
      language?: string;
    };
    imageOptions?: {
      source?: string;
      style?: string;
    };
    exportAs?: string;
  };
  title?: string;
  skipEnrichment?: boolean;
  jwtToken?: string; // Stored JWT for auth
}

interface GammaGenerateResult {
  success: boolean;
  documentId?: string;
  generationId?: string;
  status?: string;
  url?: string;
  thumbnailUrl?: string;
  cardCount?: number;
  exports?: { pdf?: string; pptx?: string };
  error?: string;
  details?: string;  // Added: contains full Gamma API response for debugging
  enrichment?: {
    sourcesUsed: string[];
    errors?: Array<{ source: string; error: string }>;
  };
}

/**
 * Query GAMMA_DB for gamma documents ready for enrichment processing
 * Note: Uses /api/gamma-database/query which queries GAMMA_DB (separate from APP_DB)
 */
async function getDocumentsReadyForEnrichment(): Promise<GammaDocument[]> {
  const query = `SELECT id, user_id, status, request_payload, gamma_generation_id FROM gamma_documents WHERE status = 'enrichment_pending' ORDER BY created_at ASC LIMIT 1`;

  try {
    // Use gamma-database endpoint which queries GAMMA_DB (not APP_DB)
    const response = await fetch(`${DASHBOARD_URL}/api/gamma-database/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.error(`[GAMMA-BG] Failed to query documents: ${response.status}`);
      return [];
    }

    const result = await response.json() as { results?: GammaDocument[] };
    return result.results || [];
  } catch (error) {
    console.error('[GAMMA-BG] Error querying documents:', error);
    return [];
  }
}

/**
 * Update gamma document status in GAMMA_DB
 * Note: Uses /api/gamma-database/query which queries GAMMA_DB (separate from APP_DB)
 */
async function updateDocumentStatus(
  docId: string,
  status: string,
  updates: {
    gamma_generation_id?: string;
    gamma_url?: string;
    gamma_thumbnail_url?: string;
    card_count?: number;
    error_message?: string;
    completed_at?: number;
    pdf_url?: string;
    pptx_url?: string;
  } = {}
): Promise<void> {
  const timestamp = Date.now();

  // Build SET clause dynamically
  const setClauses = [`status = '${status}'`, `updated_at = ${timestamp}`];

  if (updates.gamma_generation_id) {
    setClauses.push(`gamma_generation_id = '${updates.gamma_generation_id}'`);
  }
  if (updates.gamma_url) {
    setClauses.push(`gamma_url = '${updates.gamma_url}'`);
  }
  if (updates.gamma_thumbnail_url) {
    setClauses.push(`gamma_thumbnail_url = '${updates.gamma_thumbnail_url}'`);
  }
  if (updates.card_count !== undefined) {
    setClauses.push(`card_count = ${updates.card_count}`);
  }
  if (updates.error_message) {
    // Escape single quotes in error message
    const escapedError = updates.error_message.replace(/'/g, "''");
    setClauses.push(`error_message = '${escapedError}'`);
  }
  if (updates.completed_at) {
    setClauses.push(`completed_at = ${updates.completed_at}`);
  }
  if (updates.pdf_url) {
    setClauses.push(`pdf_url = '${updates.pdf_url}'`);
  }
  if (updates.pptx_url) {
    setClauses.push(`pptx_url = '${updates.pptx_url}'`);
  }

  const query = `UPDATE gamma_documents SET ${setClauses.join(', ')} WHERE id = '${docId}'`;

  try {
    // Use gamma-database endpoint which queries GAMMA_DB (not APP_DB)
    const response = await fetch(`${DASHBOARD_URL}/api/gamma-database/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.error(`[GAMMA-BG] Failed to update document status: ${response.status}`);
    }
  } catch (error) {
    console.error('[GAMMA-BG] Error updating document status:', error);
  }
}

/**
 * Call the Gamma service to do enrichment and generation
 * We use the existing /api/gamma/generate-enriched endpoint on the Raindrop service
 * but bypass the normal route to call directly with the stored payload
 */
async function processEnrichmentAndGeneration(
  doc: GammaDocument,
  request: EnrichmentRequest
): Promise<GammaGenerateResult> {
  console.log(`[GAMMA-BG] Processing enrichment for document: ${doc.id}`);

  if (!request.jwtToken) {
    return { success: false, error: 'No JWT token in request payload' };
  }

  try {
    // Call the Raindrop gamma-service directly
    const response = await fetch(`${GAMMA_SERVICE_URL}/api/gamma/generate-enriched`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${request.jwtToken}`,
      },
      body: JSON.stringify({
        artifact: request.artifact,
        enrichmentOptions: request.enrichmentOptions,
        gammaOptions: request.gammaOptions,
        title: request.title,
        skipEnrichment: request.skipEnrichment,
      }),
    });

    // Check content type to avoid parsing HTML as JSON
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[GAMMA-BG] Service returned non-JSON:', text.substring(0, 200));
      return { success: false, error: `Service returned ${response.status}` };
    }

    const data = await response.json() as GammaGenerateResult;

    if (!response.ok || !data.success) {
      const errorMsg = data.details || data.error || 'Generation failed';
      console.error(`[GAMMA-BG] Gamma service error: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    return data;
  } catch (error) {
    console.error('[GAMMA-BG] Error calling gamma service:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Poll for Gamma generation completion
 */
async function pollGammaCompletion(
  generationId: string,
  jwtToken: string,
  maxWaitMs: number = 180000, // 3 minutes
  pollIntervalMs: number = 5000 // 5 seconds
): Promise<{
  status: string;
  url?: string;
  thumbnailUrl?: string;
  cardCount?: number;
  exports?: { pdf?: string; pptx?: string };
  error?: string;
}> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await fetch(`${GAMMA_SERVICE_URL}/api/gamma/status/${generationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
        },
      });

      if (!response.ok) {
        console.error(`[GAMMA-BG] Status check failed: ${response.status}`);
        await new Promise(r => setTimeout(r, pollIntervalMs));
        continue;
      }

      const data = await response.json() as {
        success: boolean;
        status: string;
        url?: string;
        thumbnailUrl?: string;
        cardCount?: number;
        exports?: { pdf?: string; pptx?: string };
        error?: string;
      };

      console.log(`[GAMMA-BG] Generation ${generationId} status: ${data.status}`);

      if (data.status === 'completed') {
        return {
          status: 'completed',
          url: data.url,
          thumbnailUrl: data.thumbnailUrl,
          cardCount: data.cardCount,
          exports: data.exports,
        };
      }

      if (data.status === 'failed') {
        return {
          status: 'failed',
          error: data.error || 'Generation failed',
        };
      }

      // Still processing, wait and try again
      await new Promise(r => setTimeout(r, pollIntervalMs));
    } catch (error) {
      console.error('[GAMMA-BG] Poll error:', error);
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }
  }

  return { status: 'timeout', error: `Generation timed out after ${maxWaitMs}ms` };
}

/**
 * Process a single gamma document through enrichment and generation
 */
async function processDocument(doc: GammaDocument): Promise<void> {
  console.log(`[GAMMA-BG] Processing document: ${doc.id}`);

  // Parse the stored request payload
  let request: EnrichmentRequest;
  try {
    request = JSON.parse(doc.request_payload);
  } catch (error) {
    console.error(`[GAMMA-BG] Failed to parse request payload for ${doc.id}`);
    await updateDocumentStatus(doc.id, 'failed', {
      error_message: 'Invalid request payload',
    });
    return;
  }

  // Update status to enriching
  await updateDocumentStatus(doc.id, 'enriching');

  try {
    // Call the gamma service for enrichment + generation
    console.log(`[GAMMA-BG] Starting enrichment for: ${request.artifact?.title || 'Untitled'}`);
    const generateResult = await processEnrichmentAndGeneration(doc, request);

    if (!generateResult.success) {
      console.error(`[GAMMA-BG] Generation failed for ${doc.id}: ${generateResult.error}`);
      await updateDocumentStatus(doc.id, 'failed', {
        error_message: generateResult.error || 'Generation failed',
      });
      return;
    }

    // Update with generation ID and status
    console.log(`[GAMMA-BG] Generation started: ${generateResult.generationId}`);
    await updateDocumentStatus(doc.id, 'generating', {
      gamma_generation_id: generateResult.generationId,
    });

    // Poll for completion
    if (generateResult.generationId && request.jwtToken) {
      console.log(`[GAMMA-BG] Polling for completion...`);
      const completionResult = await pollGammaCompletion(
        generateResult.generationId,
        request.jwtToken
      );

      if (completionResult.status === 'completed') {
        console.log(`[GAMMA-BG] Document ${doc.id} completed successfully`);
        // Save export URLs if available from Gamma
        const exports = completionResult.exports;
        await updateDocumentStatus(doc.id, 'completed', {
          gamma_url: completionResult.url,
          gamma_thumbnail_url: completionResult.thumbnailUrl,
          card_count: completionResult.cardCount,
          completed_at: Date.now(),
          pdf_url: exports?.pdf,
          pptx_url: exports?.pptx,
        });
        if (exports?.pdf || exports?.pptx) {
          console.log(`[GAMMA-BG] Export URLs saved: pdf=${!!exports.pdf}, pptx=${!!exports.pptx}`);
        }
      } else {
        console.error(`[GAMMA-BG] Document ${doc.id} failed: ${completionResult.error}`);
        await updateDocumentStatus(doc.id, 'failed', {
          error_message: completionResult.error || 'Generation failed',
        });
      }
    }

    console.log(`[GAMMA-BG] Successfully processed document ${doc.id}`);
  } catch (error) {
    console.error('[GAMMA-BG] Document processing error:', error);
    await updateDocumentStatus(doc.id, 'failed', {
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Background function handler - polls database for pending gamma documents
 *
 * This is a BACKGROUND FUNCTION (15 min timeout) that polls for content.
 * It must be triggered via HTTP call, but ignores the request body
 * (since background functions have empty POST bodies).
 */
export default async (_req: Request, _context: Context) => {
  console.log('[GAMMA-BG] Background function triggered');

  // Query for documents ready for enrichment
  const documents = await getDocumentsReadyForEnrichment();

  if (documents.length > 0) {
    console.log(`[GAMMA-BG] Found ${documents.length} document(s) ready for enrichment`);

    // Process one document at a time to avoid overwhelming services
    for (const doc of documents) {
      await processDocument(doc);
    }
  } else {
    console.log('[GAMMA-BG] No documents ready for enrichment processing');
  }

  console.log('[GAMMA-BG] Background function complete');
};

// No config needed - background functions use the -background filename suffix
