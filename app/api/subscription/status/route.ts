import { NextRequest, NextResponse } from 'next/server';

const SUBSCRIPTION_API_URL = process.env.NEXT_PUBLIC_SUBSCRIPTION_API_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzs.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

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
 * GET /api/subscription/status
 * Proxy to Raindrop subscription-api to get user's subscription status and usage
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request.headers.get("authorization"));
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
