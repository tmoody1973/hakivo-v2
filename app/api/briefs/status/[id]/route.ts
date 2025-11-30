import { NextRequest, NextResponse } from 'next/server';

// Dashboard service URL (contains the brief status endpoint)
const DASHBOARD_API_URL = process.env.DASHBOARD_API_URL ||
  'https://svc-01ka8k5e6tr0kgy0jkzj9m4q19.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * GET /api/briefs/status/[id]
 * Check the status of a brief being generated
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: briefId } = await params;

    // Get authorization from query param or header
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const authorization = request.headers.get('authorization');

    if (!authorization && !token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Build URL with token if provided via query param
    let url = `${DASHBOARD_API_URL}/briefs/status/${briefId}`;
    if (token) {
      url += `?token=${token}`;
    }

    console.log('[API /briefs/status] Checking status for:', briefId);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authorization) {
      headers['Authorization'] = authorization;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    console.log('[API /briefs/status] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('[API /briefs/status] Error response:', error);
      return NextResponse.json(
        { error: error || 'Failed to check brief status' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /briefs/status] Caught error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
