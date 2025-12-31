import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

/**
 * POST /api/gamma/save/[documentId]
 * Get export URLs directly from Gamma API
 *
 * IMPORTANT: This route returns quickly to avoid timeout.
 * It makes a single check to Gamma API. If exports aren't ready yet,
 * it returns a message telling the user to try again in a minute.
 *
 * Gamma exports can take 30-120 seconds to become available after generation completes.
 * See: https://community.gamma.app/x/api/nvt6keghs18u/is-it-possible-to-download-the-pptx-file-through-t
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

    const { documentId: generationId } = await params;
    const body = await request.json();
    const requestedFormats = body.exportFormats || ['pdf'];

    console.log(`[API] Getting exports for generation: ${generationId}, formats: ${requestedFormats.join(', ')}`);

    // Make a single quick check to Gamma API
    const response = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': gammaApiKey,
        'Accept': 'application/json',
      },
    });

    // Check content type before parsing
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] Gamma API error ${response.status}:`, errorText.substring(0, 200));
      return NextResponse.json(
        {
          error: 'Gamma API error',
          details: `${response.status} - ${response.statusText}`,
          hint: 'The generation ID may be invalid or the document may have been deleted.'
        },
        { status: response.status === 404 ? 404 : 500 }
      );
    }

    // Handle HTML responses (error pages)
    if (!contentType.includes('application/json')) {
      const responseText = await response.text();
      console.error(`[API] Gamma returned non-JSON (${contentType}):`, responseText.substring(0, 200));
      return NextResponse.json(
        {
          error: 'Invalid response from Gamma',
          details: 'Gamma returned an HTML error page instead of JSON.',
          hint: 'The generation ID may be invalid.'
        },
        { status: 500 }
      );
    }

    const result = await response.json();
    console.log(`[API] Gamma response: status=${result.status}, exports=${JSON.stringify(result.exports)}, url=${result.url}`);

    // If generation is still in progress
    if (result.status !== 'completed') {
      return NextResponse.json({
        success: false,
        generationId,
        exports: {},
        status: result.status,
        message: 'Document is still being generated. Please wait a moment and try again.',
        retryAfter: 10, // seconds
      });
    }

    // If generation failed
    if (result.status === 'failed') {
      return NextResponse.json({
        success: false,
        generationId,
        exports: {},
        status: 'failed',
        error: result.error || 'Generation failed',
      });
    }

    // Check if exports are available
    const exports: { pdf?: string; pptx?: string } = {};
    const missingFormats: string[] = [];
    let hasAnyExport = false;

    for (const format of requestedFormats) {
      const exportUrl = result.exports?.[format as keyof typeof result.exports];
      if (exportUrl) {
        exports[format as 'pdf' | 'pptx'] = exportUrl as string;
        hasAnyExport = true;
      } else {
        missingFormats.push(format);
      }
    }

    // If we have exports, return them
    if (hasAnyExport) {
      console.log('[API] Exports available:', JSON.stringify(exports));
      return NextResponse.json({
        success: true,
        generationId,
        exports,
        gammaUrl: result.url,
        ...(missingFormats.length > 0 && {
          partialMessage: `Some formats not available: ${missingFormats.join(', ')}`,
        }),
      });
    }

    // No exports yet - this is normal, they take 30-120 seconds after generation
    console.log('[API] No exports available yet, document URL:', result.url);
    return NextResponse.json({
      success: false,
      generationId,
      exports: {},
      status: 'exports_pending',
      gammaUrl: result.url,
      message: 'Exports are still being prepared by Gamma. This usually takes 1-2 minutes after document creation.',
      hint: 'Please try again in a minute, or open the document in Gamma to download manually.',
      retryAfter: 30, // seconds
    });

  } catch (error) {
    console.error('[API] Gamma save error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get exports',
        details: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Please try again in a moment or open in Gamma to download manually.'
      },
      { status: 500 }
    );
  }
}
