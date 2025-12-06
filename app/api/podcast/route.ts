import { NextRequest, NextResponse } from 'next/server';

// Briefs service URL (handles both briefs and podcast endpoints)
const BRIEFS_API_URL = process.env.BRIEFS_API_URL ||
  'https://svc-01ka8k5e6tr0kgy0jkzj9m4q17.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * GET /api/podcast
 * List podcast episodes (proxies to briefs-service)
 * Public endpoint - no auth required
 */
export async function GET(request: NextRequest) {
  try {
    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const status = searchParams.get('status');

    // Build URL with query params
    let url = `${BRIEFS_API_URL}/podcast?limit=${limit}&offset=${offset}`;
    if (status) {
      url += `&status=${status}`;
    }

    console.log('[API /podcast] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('[API /podcast] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('[API /podcast] Error response:', error);
      return NextResponse.json(
        { error: error || 'Failed to fetch podcast episodes' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /podcast] Caught error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
