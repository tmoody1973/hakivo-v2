import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

/**
 * GET /api/gamma/status/[generationId]
 * Call Gamma API directly to poll generation status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
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

    const { generationId } = await params;

    console.log('[API] Checking Gamma status for:', generationId);

    const response = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': gammaApiKey,
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('[API] Gamma status error:', response.status, responseText);
      return NextResponse.json(
        { error: 'Gamma API error', details: responseText },
        { status: response.status }
      );
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      console.error('[API] Failed to parse Gamma status response:', responseText);
      return NextResponse.json(
        { error: 'Invalid Gamma API response' },
        { status: 502 }
      );
    }

    console.log('[API] Gamma status:', result.status, 'exports:', JSON.stringify(result.exports));

    return NextResponse.json({
      success: true,
      generationId: result.id || generationId,
      status: result.status,
      url: result.url,
      thumbnailUrl: result.thumbnailUrl,
      title: result.title,
      cardCount: result.cardCount,
      exports: result.exports,
      error: result.error,
    });
  } catch (error) {
    console.error('[API] Gamma status error:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}
