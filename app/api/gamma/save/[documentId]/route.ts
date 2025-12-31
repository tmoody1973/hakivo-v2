import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

/**
 * Helper to fetch generation status with retry for exports
 *
 * IMPORTANT: Gamma export URLs can take 30-120 seconds to become available
 * even after generation status shows "completed". This is a known Gamma API behavior.
 * See: https://community.gamma.app/x/api/nvt6keghs18u/is-it-possible-to-download-the-pptx-file-through-t
 */
async function fetchWithRetry(
  generationId: string,
  apiKey: string,
  maxRetries: number = 20,
  initialDelayMs: number = 3000
): Promise<{ status: string; exports?: { pdf?: string; pptx?: string }; url?: string; [key: string]: unknown }> {
  let delayMs = initialDelayMs;
  const maxDelayMs = 10000; // Cap at 10 seconds between retries
  const backoffMultiplier = 1.2;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      method: 'GET',
      headers: { 'X-API-KEY': apiKey },
    });

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const result = await response.json();
    const elapsedTime = attempt * initialDelayMs; // Approximate
    console.log(`[API] Attempt ${attempt + 1}/${maxRetries} (~${Math.round(elapsedTime/1000)}s): status=${result.status}, exports=${JSON.stringify(result.exports)}, url=${result.url}`);

    // Log full response on first attempt for debugging
    if (attempt === 0) {
      console.log('[API] Full Gamma response:', JSON.stringify(result));
    }

    // If we have exports, return immediately
    if (result.exports && (result.exports.pdf || result.exports.pptx)) {
      console.log(`[API] Exports found after ${attempt + 1} attempts`);
      return result;
    }

    // If status is completed but no exports, keep polling (exports lag behind status)
    // If status is still processing, also keep polling
    if ((result.status === 'completed' || result.status === 'processing') && attempt < maxRetries - 1) {
      console.log(`[API] Status: ${result.status}, no exports yet. Waiting ${delayMs}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      // Exponential backoff with cap
      delayMs = Math.min(Math.round(delayMs * backoffMultiplier), maxDelayMs);
    } else if (result.status === 'failed') {
      console.error('[API] Generation failed:', result.error || 'Unknown error');
      return result;
    } else {
      // Unknown status or max retries reached
      return result;
    }
  }

  console.warn(`[API] Max retries (${maxRetries}) exceeded without finding exports`);
  throw new Error('Export URLs not available after extended polling. Try again later or open in Gamma.');
}

/**
 * POST /api/gamma/save/[documentId]
 * Get export URLs directly from Gamma API with retry logic
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gammaApiKey = process.env.GAMMA_API_KEY;
    if (!gammaApiKey) {
      console.error('[API] GAMMA_API_KEY not configured');
      return NextResponse.json({ error: 'Gamma API not configured' }, { status: 500 });
    }

    const { documentId } = await params;
    const body = await request.json();
    const requestedFormats = body.exportFormats || ['pdf'];

    console.log(`[API] Getting exports for generation: ${documentId}, formats: ${requestedFormats.join(', ')}`);

    // Fetch with retry logic for exports (up to ~2 minutes with exponential backoff)
    const result = await fetchWithRetry(documentId, gammaApiKey, 20, 3000);

    if (result.status !== 'completed') {
      return NextResponse.json({
        success: true,
        documentId,
        exports: {},
        status: result.status,
        message: 'Generation not yet completed',
      });
    }

    // Return export URLs directly from Gamma
    const exports: { pdf?: string; pptx?: string } = {};
    const missingFormats: string[] = [];

    for (const format of requestedFormats) {
      const exportUrl = result.exports?.[format as keyof typeof result.exports];
      if (exportUrl) {
        exports[format as 'pdf' | 'pptx'] = exportUrl as string;
      } else {
        missingFormats.push(format);
      }
    }

    console.log('[API] Final exports:', JSON.stringify(exports));

    return NextResponse.json({
      success: true,
      documentId,
      exports,
      gammaUrl: result.url,
      ...(missingFormats.length > 0 && {
        message: `Export format(s) not available: ${missingFormats.join(', ')}. This can happen if the generation didn't include exportAs parameter, or if it's a webpage format which doesn't support PDF export.`,
        missingFormats,
        hint: 'You can open the document in Gamma to export manually.',
      }),
    });
  } catch (error) {
    console.error('[API] Gamma save error:', error);
    return NextResponse.json(
      { error: 'Failed to get exports', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
