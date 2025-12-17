import { NextRequest, NextResponse } from 'next/server';

const GAMMA_SERVICE_URL = process.env.NEXT_PUBLIC_GAMMA_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://svc-01kcp5rv55e6psxh5ht7byqrgd.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * GET /api/gamma/themes
 * Proxy to Raindrop gamma-service to list available Gamma themes
 */
export async function GET() {
  try {
    const response = await fetch(`${GAMMA_SERVICE_URL}/api/gamma/themes`, {
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
    console.error('[API] Gamma themes proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to load themes' },
      { status: 500 }
    );
  }
}
