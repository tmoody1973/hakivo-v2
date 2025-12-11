import { NextRequest, NextResponse } from 'next/server';

// Server-side API route needs actual bills-service URL, not the frontend proxy path
const BILLS_API_URL = (process.env.NEXT_PUBLIC_BILLS_API_URL && process.env.NEXT_PUBLIC_BILLS_API_URL.startsWith('http'))
  ? process.env.NEXT_PUBLIC_BILLS_API_URL
  : 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz16.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: billId } = await params;

    console.log('[API /bills/:id] Fetching bill:', billId);

    // Parse bill ID (format: "119-s-2767" -> congress/type/number)
    const parts = billId.split('-');
    if (parts.length !== 3) {
      return NextResponse.json(
        { error: 'Invalid bill ID format. Expected format: congress-type-number (e.g., 119-s-2767)' },
        { status: 400 }
      );
    }

    const [congress, billType, billNumber] = parts;

    // Get authorization header from the request
    const authorization = request.headers.get('authorization');
    console.log('[API /bills/:id] Authorization header:', authorization ? 'present' : 'missing');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authorization) {
      headers['Authorization'] = authorization;
    }

    // Call backend with correct format: /bills/:congress/:type/:number
    const url = `${BILLS_API_URL}/bills/${congress}/${billType}/${billNumber}`;
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

    // Backend returns { success: true, bill: {...} }, frontend expects the full response
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /bills/:id] Caught error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
