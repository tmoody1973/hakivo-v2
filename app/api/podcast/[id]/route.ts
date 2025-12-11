import { NextRequest, NextResponse } from 'next/server';

// Briefs service URL (handles both briefs and podcast endpoints)
const BRIEFS_API_URL = process.env.BRIEFS_API_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyz17.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * GET /api/podcast/:id
 * Get podcast episode details (proxies to briefs-service)
 * Public endpoint - no auth required
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: episodeId } = await params;

    const url = `${BRIEFS_API_URL}/podcast/${episodeId}`;
    console.log('[API /podcast/:id] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('[API /podcast/:id] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('[API /podcast/:id] Error response:', error);
      return NextResponse.json(
        { error: error || 'Failed to fetch podcast episode' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /podcast/:id] Caught error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/podcast/:id (for play tracking)
 * Record a podcast play (proxies to briefs-service)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: episodeId } = await params;

    const url = `${BRIEFS_API_URL}/podcast/${episodeId}/play`;
    console.log('[API /podcast/:id/play] Posting to:', url);

    // Forward authorization header if present
    const authorization = request.headers.get('authorization');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (authorization) {
      headers['Authorization'] = authorization;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[API /podcast/:id/play] Error response:', error);
      return NextResponse.json(
        { error: error || 'Failed to record play' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /podcast/:id/play] Caught error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
