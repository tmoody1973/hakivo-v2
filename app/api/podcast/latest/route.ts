import { NextResponse } from 'next/server';

// Briefs service URL (handles both briefs and podcast endpoints)
const BRIEFS_API_URL = process.env.NEXT_PUBLIC_BRIEFS_API_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzj.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * GET /api/podcast/latest
 * Get the latest completed podcast episode (proxies to briefs-service)
 * Public endpoint - no auth required
 */
export async function GET() {
  try {
    const url = `${BRIEFS_API_URL}/podcast/latest`;

    console.log('[API /podcast/latest] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('[API /podcast/latest] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('[API /podcast/latest] Error response:', error);
      return NextResponse.json(
        { error: error || 'Failed to fetch latest podcast episode' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /podcast/latest] Caught error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
