import { NextRequest, NextResponse } from 'next/server';

// Server-side API route needs actual bills-service URL
const BILLS_API_URL = (process.env.NEXT_PUBLIC_BILLS_API_URL && process.env.NEXT_PUBLIC_BILLS_API_URL.startsWith('http'))
  ? process.env.NEXT_PUBLIC_BILLS_API_URL
  : 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz16.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: billId } = await params;

    console.log('[API /state-bills/:id/analysis] Getting analysis for:', billId);

    // Get authorization header from the request
    const authorization = request.headers.get('authorization');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authorization) {
      headers['Authorization'] = authorization;
    }

    // Call backend analysis endpoint: GET /state-bills/:id/analysis
    const encodedId = encodeURIComponent(billId);
    const url = `${BILLS_API_URL}/state-bills/${encodedId}/analysis`;
    console.log('[API /state-bills/:id/analysis] Calling backend:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    console.log('[API /state-bills/:id/analysis] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('[API /state-bills/:id/analysis] Error response:', error);

      return NextResponse.json(
        { error: error || 'Failed to get state bill analysis' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /state-bills/:id/analysis] Caught error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
