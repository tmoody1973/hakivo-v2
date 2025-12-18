import { NextRequest, NextResponse } from 'next/server';

const GAMMA_SERVICE_URL = process.env.NEXT_PUBLIC_GAMMA_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://svc-01kcp5rv55e6psxh5ht7byqrgd.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * POST /api/gamma/share/[token]/export
 * Fetch and return export URLs for a public shared document
 * No authentication required - validates via share token
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const formats = body.formats || ['pdf'];

    // Call gamma-service public export endpoint
    const response = await fetch(`${GAMMA_SERVICE_URL}/api/gamma/share/${token}/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ formats }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Gamma share export proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to get export', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
