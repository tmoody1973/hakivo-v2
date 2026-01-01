import { NextRequest, NextResponse } from 'next/server';
import { extractUserIdFromAuth } from '@/lib/security/arcjet';

// Notifications service URL
const NOTIFICATIONS_API_URL = process.env.NEXT_PUBLIC_NOTIFICATIONS_API_URL ||
  'https://svc-01kdx37eqyyqj5gjxkxhjynwsf.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * GET /api/notifications/count
 * Get unread notification count (proxies to notifications-service)
 */
export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    const userId = extractUserIdFromAuth(authorization);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[API /notifications/count] Fetching for user:', userId);

    const response = await fetch(`${NOTIFICATIONS_API_URL}/notifications/count`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization!,
      },
    });

    console.log('[API /notifications/count] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('[API /notifications/count] Error:', error);
      return NextResponse.json(
        { error: error || 'Failed to get notification count' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[API /notifications/count] Data:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /notifications/count] Caught error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
