import { NextRequest, NextResponse } from 'next/server';
import {
  subscriptionProtection,
  handleArcjetDecision,
  extractUserIdFromAuth,
} from '@/lib/security/arcjet';

const SUBSCRIPTION_API_URL = process.env.NEXT_PUBLIC_SUBSCRIPTION_API_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzs.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * POST /api/subscription/check-limit
 * Check if user can perform action based on subscription limits
 * Body: { action: 'track_bill' | 'follow_member' | 'generate_brief' | 'generate_artifact' }
 *
 * Protected by Arcjet: 30 req/min per user (anti-probing)
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    const response = await fetch(`${SUBSCRIPTION_API_URL}/api/subscription/check-limit/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Check limit proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to check limit' },
      { status: 500 }
    );
  }
}
