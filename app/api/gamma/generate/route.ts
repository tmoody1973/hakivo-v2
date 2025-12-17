import { NextRequest, NextResponse } from 'next/server';

const GAMMA_SERVICE_URL = process.env.NEXT_PUBLIC_GAMMA_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://svc-gamma-service.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * POST /api/gamma/generate
 * Proxy to Raindrop gamma-service to start a Gamma document generation
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${GAMMA_SERVICE_URL}/api/gamma/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Gamma generate proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to start generation' },
      { status: 500 }
    );
  }
}
