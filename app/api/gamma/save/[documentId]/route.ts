import { NextRequest, NextResponse } from 'next/server';

const GAMMA_SERVICE_URL = process.env.NEXT_PUBLIC_GAMMA_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://svc-01kcp5rv55e6psxh5ht7byqrgd.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * POST /api/gamma/save/[documentId]
 * Proxy to Raindrop gamma-service to save exports to Vultr storage
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documentId } = await params;
    const body = await request.json();

    console.log(`[API] Gamma save proxy: calling ${GAMMA_SERVICE_URL}/api/gamma/save/${documentId}`);

    const response = await fetch(`${GAMMA_SERVICE_URL}/api/gamma/save/${documentId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('[API] Gamma save proxy: non-JSON response:', text.substring(0, 500));
      return NextResponse.json(
        { error: 'Invalid response from gamma service', details: text.substring(0, 200) },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.error('[API] Gamma save proxy error response:', response.status, data);
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Gamma save proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to save exports', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
