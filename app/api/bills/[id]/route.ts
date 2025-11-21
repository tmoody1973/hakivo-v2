import { NextRequest, NextResponse } from 'next/server';

const DASHBOARD_API_URL = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || 'http://localhost:3001';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: billId } = await params;

    console.log('[API /bills/:id] Fetching bill:', billId);

    // Get authorization header from the request
    const authorization = request.headers.get('authorization');
    console.log('[API /bills/:id] Authorization header:', authorization ? 'present' : 'missing');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authorization) {
      headers['Authorization'] = authorization;
    }

    const url = `${DASHBOARD_API_URL}/bills/${billId}`;
    console.log('[API /bills/:id] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    console.log('[API /bills/:id] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();

      // 401 during initial load is expected (auth not ready yet)
      if (response.status === 401) {
        console.log('[API /bills/:id] Auth not ready, returning 401');
      } else {
        console.error('[API /bills/:id] Error response:', error);
      }

      return NextResponse.json(
        { error: error || 'Failed to fetch bill' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[API /bills/:id] Success - returning bill data');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /bills/:id] Caught error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
