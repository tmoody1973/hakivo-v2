import { NextRequest, NextResponse } from 'next/server';

// Server-side API route needs actual bills-service URL
const BILLS_API_URL = (process.env.NEXT_PUBLIC_BILLS_API_URL && process.env.NEXT_PUBLIC_BILLS_API_URL.startsWith('http'))
  ? process.env.NEXT_PUBLIC_BILLS_API_URL
  : 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q16.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: billId } = await params;

    console.log('[API /state-bills/:id/analyze] Analyzing state bill:', billId);

    // Get authorization header from the request
    const authorization = request.headers.get('authorization');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authorization) {
      headers['Authorization'] = authorization;
    }

    // Call backend analyze endpoint: POST /state-bills/:id/analyze
    // URL encode the bill ID since OCD IDs contain special characters
    const encodedId = encodeURIComponent(billId);
    const url = `${BILLS_API_URL}/state-bills/${encodedId}/analyze`;
    console.log('[API /state-bills/:id/analyze] Calling backend:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers,
    });

    console.log('[API /state-bills/:id/analyze] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('[API /state-bills/:id/analyze] Error response:', error);

      return NextResponse.json(
        { error: error || 'Failed to trigger state bill analysis' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[API /state-bills/:id/analyze] Success - analysis triggered');

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /state-bills/:id/analyze] Caught error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
