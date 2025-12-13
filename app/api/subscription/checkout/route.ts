import { NextRequest, NextResponse } from 'next/server';
import { checkoutProtection, handleArcjetDecision } from '@/lib/security/arcjet';

const SUBSCRIPTION_API_URL = process.env.NEXT_PUBLIC_SUBSCRIPTION_API_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzs.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * POST /api/subscription/checkout
 * Proxy to Raindrop subscription-api to create Stripe checkout session
 * Server-side proxy avoids CORS issues
 *
 * Protected by Arcjet:
 * - Bot detection (blocks all automated clients)
 * - Rate limiting (5 per 10 minutes per IP)
 * - Shield WAF (attack protection)
 */
export async function POST(request: NextRequest) {
  try {
    // Arcjet fraud protection - strict bot detection and rate limiting
    const decision = await checkoutProtection.protect(request);
    const arcjetResult = handleArcjetDecision(decision);
    if (arcjetResult.blocked) {
      console.warn('[API] Checkout blocked by Arcjet:', arcjetResult.message);
      return NextResponse.json(
        { error: arcjetResult.message },
        { status: arcjetResult.status }
      );
    }

    const body = await request.json();
    const { userId, successUrl, cancelUrl } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const response = await fetch(`${SUBSCRIPTION_API_URL}/api/subscription/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, successUrl, cancelUrl }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Checkout proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
