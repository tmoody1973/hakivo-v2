import { NextRequest, NextResponse } from 'next/server';

// Dashboard service URL (contains the brief generation endpoint)
const DASHBOARD_API_URL = process.env.DASHBOARD_API_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyz19.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * POST /api/briefs/generate
 * Trigger on-demand brief generation if user doesn't have today's brief
 */
export async function POST(request: NextRequest) {
  try {
    // Get authorization header
    const authorization = request.headers.get('authorization');

    if (!authorization) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[API /briefs/generate] Triggering brief generation...');

    const response = await fetch(`${DASHBOARD_API_URL}/briefs/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
      },
    });

    console.log('[API /briefs/generate] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('[API /briefs/generate] Error response:', error);
      return NextResponse.json(
        { error: error || 'Failed to trigger brief generation' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /briefs/generate] Caught error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
