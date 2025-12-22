import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

/**
 * Helper to fetch generation status with retry for exports
 */
async function fetchWithRetry(
  generationId: string,
  apiKey: string,
  maxRetries: number = 3,
  delayMs: number = 2000
): Promise<{ status: string; exports?: { pdf?: string; pptx?: string }; url?: string; [key: string]: unknown }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      method: 'GET',
      headers: { 'X-API-KEY': apiKey },
    });

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const result = await response.json();
    console.log(`[API] Attempt ${attempt + 1}: status=${result.status}, exports=${JSON.stringify(result.exports)}, url=${result.url}`);

    // Log full response on first attempt for debugging
    if (attempt === 0) {
      console.log('[API] Full Gamma response:', JSON.stringify(result));
    }

    // If we have exports, return immediately
    if (result.exports && (result.exports.pdf || result.exports.pptx)) {
      return result;
    }

    // If status is completed but no exports, wait and retry
    if (result.status === 'completed' && attempt < maxRetries - 1) {
      console.log(`[API] No exports yet, waiting ${delayMs}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } else {
      return result;
    }
  }

  throw new Error('Max retries exceeded');
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

    // Fetch with retry logic for exports
    const result = await fetchWithRetry(documentId, gammaApiKey, 3, 3000);

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
        message: `Export format(s) not available: ${missingFormats.join(', ')}. The generation may not have included exportAs parameter.`,
        missingFormats,
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
