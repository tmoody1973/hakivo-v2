import { NextRequest, NextResponse } from 'next/server';

const BILLS_API_URL = (process.env.NEXT_PUBLIC_BILLS_API_URL && process.env.NEXT_PUBLIC_BILLS_API_URL.startsWith('http'))
  ? process.env.NEXT_PUBLIC_BILLS_API_URL
  : 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q16.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * GET /api/state-bills/[id]/track
 * Check if a state bill is tracked by the current user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: billId } = await params;
    const authorization = request.headers.get('authorization');

    if (!authorization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // URL encode the bill ID since OCD IDs contain special characters
    const encodedBillId = encodeURIComponent(billId);

    const response = await fetch(`${BILLS_API_URL}/state-bills/${encodedBillId}/tracking-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to check tracking status' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /state-bills/:id/track GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/state-bills/[id]/track
 * Track a state bill
 * Body: { state: string (2-letter code), identifier: string (e.g., "SB 123") }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: billId } = await params;
    const authorization = request.headers.get('authorization');
    const body = await request.json();

    if (!authorization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${BILLS_API_URL}/state-bills/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
      },
      body: JSON.stringify({
        billId, // OCD ID
        state: body.state,
        identifier: body.identifier,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to track state bill' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /state-bills/:id/track POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/state-bills/[id]/track
 * Untrack a state bill
 * Query param: trackingId - the tracking record ID to delete
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // Consume params even if not used
    const authorization = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const trackingId = searchParams.get('trackingId');

    if (!authorization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!trackingId) {
      return NextResponse.json({ error: 'trackingId is required' }, { status: 400 });
    }

    const response = await fetch(`${BILLS_API_URL}/state-bills/track/${trackingId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to untrack state bill' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /state-bills/:id/track DELETE] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
