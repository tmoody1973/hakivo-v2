import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

/**
 * POST /api/gamma/save/[documentId]
 * Get export URLs directly from Gamma API
 * (documentId is actually the generationId when calling Gamma directly)
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

    // Get generation status from Gamma API
    const response = await fetch(`${GAMMA_API_BASE}/generations/${documentId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': gammaApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Gamma status error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to get generation status', details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('[API] Gamma generation status:', result.status);
    console.log('[API] Gamma exports:', JSON.stringify(result.exports));

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
      if (result.exports?.[format]) {
        exports[format as 'pdf' | 'pptx'] = result.exports[format];
      } else {
        missingFormats.push(format);
      }
    }

    console.log('[API] Returning exports:', JSON.stringify(exports));

    return NextResponse.json({
      success: true,
      documentId,
      exports,
      gammaUrl: result.url,
      ...(missingFormats.length > 0 && {
        message: `Export format(s) not available: ${missingFormats.join(', ')}. The document may need to be regenerated with export support.`,
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
