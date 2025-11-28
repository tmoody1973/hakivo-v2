import { NextRequest, NextResponse } from 'next/server';

// Briefs service URL
const BRIEFS_API_URL = process.env.BRIEFS_API_URL ||
  'https://svc-01ka8k5e6tr0kgy0jkzj9m4q17.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * GET /api/briefs/:id
 * Get brief details (proxies to briefs-service)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: briefId } = await params;

    // Get authorization header
    const authorization = request.headers.get('authorization');

    if (!authorization) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = `${BRIEFS_API_URL}/briefs/${briefId}`;
    console.log('[API /briefs/:id] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
      },
    });

    console.log('[API /briefs/:id] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('[API /briefs/:id] Error response:', error);
      return NextResponse.json(
        { error: error || 'Failed to fetch brief' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /briefs/:id] Caught error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
