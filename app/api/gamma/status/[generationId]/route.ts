import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

const GAMMA_SERVICE_URL = process.env.NEXT_PUBLIC_GAMMA_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://svc-01kcp5rv55e6psxh5ht7byqrgd.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * GET /api/gamma/status/[generationId]
 * Poll Gamma API for generation status AND update database via Raindrop
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

    // 1. Poll Gamma API for current status
    const gammaResponse = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': gammaApiKey,
      },
    });

    const responseText = await gammaResponse.text();

    if (!gammaResponse.ok) {
      console.error('[API] Gamma status error:', gammaResponse.status, responseText);
      return NextResponse.json(
        { error: 'Gamma API error', details: responseText },
        { status: gammaResponse.status }
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

    console.log('[API] Gamma status response:', JSON.stringify(result, null, 2));

    // 2. If completed, update database via Raindrop with the gamma_url
    if (result.status === 'completed' && (result.gammaUrl || result.url)) {
      try {
        console.log('[API] Generation completed, updating database via Raindrop');

        // Call Raindrop's update endpoint to save gamma_url to database
        await fetch(`${GAMMA_SERVICE_URL}/api/gamma/update-generation`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            generationId: generationId,
            status: 'completed',
            gammaUrl: result.gammaUrl || result.url,
            thumbnailUrl: result.thumbnailUrl,
            cardCount: result.cardCount,
            title: result.title,
            exports: result.exports,
          }),
        });

        console.log('[API] Database updated with gamma_url');
      } catch (updateError) {
        // Log but don't fail - status response is more important
        console.error('[API] Failed to update database:', updateError);
      }
    }

    // Gamma API returns 'gammaUrl' not 'url' per their docs
    return NextResponse.json({
      success: true,
      generationId: result.id || result.generationId || generationId,
      status: result.status,
      url: result.gammaUrl || result.url,
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
