import { NextRequest, NextResponse } from 'next/server';

const SUBSCRIPTION_API_URL = process.env.NEXT_PUBLIC_SUBSCRIPTION_API_URL ||
  'https://svc-01kbx70mmpbcrf475s1hdsb2pn.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * Extract user ID from JWT token
 */
function getUserIdFromToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    return payload.sub || payload.userId || null;
  } catch {
    return null;
  }
}

/**
 * POST /api/subscription/check-limit
 * Check if user can perform action based on subscription limits
 * Body: { action: 'track_bill' | 'follow_member' | 'generate_brief' | 'generate_artifact' }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request.headers.get("authorization"));
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
