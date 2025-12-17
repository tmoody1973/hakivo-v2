import { NextRequest, NextResponse } from 'next/server';

const GAMMA_SERVICE_URL = process.env.NEXT_PUBLIC_GAMMA_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://svc-gamma-service.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * GET /api/gamma/share/[token]
 * Proxy to Raindrop gamma-service to get a public shared document
 * No authentication required - public access
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const response = await fetch(`${GAMMA_SERVICE_URL}/api/gamma/share/${token}`, {
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
    console.error('[API] Gamma share get proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to get shared document' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gamma/share/[token]
 * Proxy to Raindrop gamma-service to increment view count
 * No authentication required - tracks anonymous views
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const response = await fetch(`${GAMMA_SERVICE_URL}/api/gamma/share/${token}/view`, {
      method: 'POST',
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
    console.error('[API] Gamma share view proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to track view' },
      { status: 500 }
    );
  }
}
