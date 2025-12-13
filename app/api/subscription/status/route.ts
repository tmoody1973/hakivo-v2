import { NextRequest, NextResponse } from 'next/server';
import {
  subscriptionProtection,
  handleArcjetDecision,
  extractUserIdFromAuth,
} from '@/lib/security/arcjet';

const SUBSCRIPTION_API_URL = process.env.NEXT_PUBLIC_SUBSCRIPTION_API_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzs.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * GET /api/subscription/status
 * Proxy to Raindrop subscription-api to get user's subscription status and usage
 *
 * Protected by Arcjet: 30 req/min per user (anti-probing)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = extractUserIdFromAuth(request.headers.get("authorization"));
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Arcjet rate limiting - prevent subscription probing
    const decision = await subscriptionProtection.protect(request, { userId });
    const arcjetResult = handleArcjetDecision(decision);
    if (arcjetResult.blocked) {
      return NextResponse.json(
        { error: arcjetResult.message },
        { status: arcjetResult.status }
      );
    }

    const response = await fetch(`${SUBSCRIPTION_API_URL}/api/subscription/status/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Subscription status proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription status' },
      { status: 500 }
    );
  }
}
