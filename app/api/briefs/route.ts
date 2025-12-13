import { NextRequest, NextResponse } from 'next/server';
import {
  authenticatedDataProtection,
  handleArcjetDecision,
  extractUserIdFromAuth,
} from '@/lib/security/arcjet';

// Briefs service URL
// Uses NEXT_PUBLIC_BRIEFS_API_URL from .env.local
const BRIEFS_API_URL = process.env.NEXT_PUBLIC_BRIEFS_API_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzj.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * GET /api/briefs
 * List user's briefs (proxies to briefs-service)
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

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '20';
    const offset = searchParams.get('offset') || '0';
    const status = searchParams.get('status');

    // Get authorization header
    const authorization = request.headers.get('authorization')!

    // Build URL with query params
    let url = `${BRIEFS_API_URL}/briefs?limit=${limit}&offset=${offset}`;
    if (status) {
      url += `&status=${status}`;
    }

    console.log('[API /briefs] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
      },
    });

    console.log('[API /briefs] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('[API /briefs] Error response:', error);
      return NextResponse.json(
        { error: error || 'Failed to fetch briefs' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /briefs] Caught error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
