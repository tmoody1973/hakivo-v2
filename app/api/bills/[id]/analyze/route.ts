import { NextRequest, NextResponse } from "next/server";

// Server-side API route needs actual bills-service URL
const BILLS_API_URL = process.env.NEXT_PUBLIC_BILLS_API_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzh.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: billId } = await params;

    console.log('[API /bills/:id/analyze] Analyzing federal bill:', billId);

    // Parse bill ID format: "119-s-3173" => congress=119, type=s, number=3173
    const parts = billId.split('-');
    if (parts.length !== 3) {
      return NextResponse.json(
        { error: 'Invalid bill ID format. Expected format: {congress}-{type}-{number}' },
        { status: 400 }
      );
    }
    const [congress, billType, billNumber] = parts;

    // Get authorization header from the request
    const authorization = request.headers.get('authorization');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authorization) {
      headers['Authorization'] = authorization;
    }

    // Call backend analyze endpoint: POST /bills/:congress/:type/:number/analyze
    const url = `${BILLS_API_URL}/bills/${congress}/${billType}/${billNumber}/analyze`;
    console.log('[API /bills/:id/analyze] Calling backend:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers,
    });

    console.log('[API /bills/:id/analyze] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('[API /bills/:id/analyze] Error response:', error);

      return NextResponse.json(
        { error: error || 'Failed to trigger bill analysis' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[API /bills/:id/analyze] Success - analysis triggered');

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /bills/:id/analyze] Caught error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // TODO: Implement bill analysis GET endpoint if needed
  return NextResponse.json(
    { error: "Use POST to trigger bill analysis", billId: id },
    { status: 405 }
  );
}
