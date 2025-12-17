import { NextRequest, NextResponse } from 'next/server';

const GAMMA_SERVICE_URL = process.env.NEXT_PUBLIC_GAMMA_SERVICE_URL ||
  'https://svc-01kcp5rv55e6psxh5ht7byqrgd.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * POST /api/gamma/generate-enriched
 * Proxy to Raindrop gamma-service to generate a Gamma document with enrichment
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${GAMMA_SERVICE_URL}/api/gamma/generate-enriched`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(body),
    });

    // Check content type to avoid parsing HTML as JSON
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[API] Gamma service returned non-JSON:', text.substring(0, 200));
      return NextResponse.json(
        { error: 'Gamma service unavailable', details: `Service returned ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Gamma generate-enriched proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to generate enriched document' },
      { status: 500 }
    );
  }
}
