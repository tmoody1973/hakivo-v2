import { NextRequest, NextResponse } from 'next/server';

const SUBSCRIPTION_API_URL = process.env.NEXT_PUBLIC_SUBSCRIPTION_API_URL ||
  'https://svc-01kbx70mmpbcrf475s1hdsb2pn.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * POST /api/subscription/portal
 * Proxy to Raindrop subscription-api to create Stripe billing portal session
 * Server-side proxy avoids CORS issues
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, returnUrl } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const response = await fetch(`${SUBSCRIPTION_API_URL}/api/subscription/create-portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, returnUrl }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Portal proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
