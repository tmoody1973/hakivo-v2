import { NextRequest, NextResponse } from 'next/server';
import {
  authenticatedDataProtection,
  handleArcjetDecision,
  extractUserIdFromAuth,
} from '@/lib/security/arcjet';

// Uses NEXT_PUBLIC_DASHBOARD_API_URL from .env.local
const DASHBOARD_API_URL = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || 'https://svc-01kc6rbecv0s5k4yk6ksdaqyzm.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * GET /api/tracked
 * Get all tracked items (federal bills, state bills, bookmarked articles)
 * for the authenticated user
 *
 * Protected by Arcjet: 30 req/min per user
 */
export async function GET(request: NextRequest) {
  try {
    const userId = extractUserIdFromAuth(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Arcjet rate limiting - 30 req/min per user
    const decision = await authenticatedDataProtection.protect(request, { userId });
    const arcjetResult = handleArcjetDecision(decision);
    if (arcjetResult.blocked) {
      return NextResponse.json(
        { error: arcjetResult.message },
        { status: arcjetResult.status }
      );
    }

    const authorization = request.headers.get('authorization')!

    const response = await fetch(`${DASHBOARD_API_URL}/dashboard/tracked`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to get tracked items' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /tracked GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
