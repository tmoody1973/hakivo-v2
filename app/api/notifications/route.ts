import { NextRequest, NextResponse } from 'next/server';
import { extractUserIdFromAuth } from '@/lib/security/arcjet';

// Notifications service URL
const NOTIFICATIONS_API_URL = process.env.NEXT_PUBLIC_NOTIFICATIONS_API_URL ||
  'https://svc-01kdx37eqyyqj5gjxkxhjynwsf.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * GET /api/notifications
 * List user's notifications (proxies to notifications-service)
 */
export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    const userId = extractUserIdFromAuth(authorization);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '20';
    const offset = searchParams.get('offset') || '0';
    const category = searchParams.get('category');
    const unread = searchParams.get('unread');

    // Build URL with query params
    let url = `${NOTIFICATIONS_API_URL}/notifications?limit=${limit}&offset=${offset}`;
    if (category) url += `&category=${category}`;
    if (unread) url += `&unread=${unread}`;

    console.log('[API /notifications] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization!,
      },
    });

    console.log('[API /notifications] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('[API /notifications] Error response:', error);
      return NextResponse.json(
        { error: error || 'Failed to fetch notifications' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /notifications] Caught error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * Mark all notifications as read (proxies to notifications-service)
 */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    const userId = extractUserIdFromAuth(authorization);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${NOTIFICATIONS_API_URL}/notifications/read-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization!,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to mark notifications as read' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /notifications] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
