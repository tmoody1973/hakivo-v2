import { NextRequest, NextResponse } from 'next/server';

const GAMMA_SERVICE_URL = process.env.NEXT_PUBLIC_GAMMA_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://svc-01kcp5rv55e6psxh5ht7byqrgd.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * POST /api/gamma/generate-enriched
 * Proxy to Raindrop gamma-service to generate enriched documents
 * This ensures documents are saved to the database
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    console.log('[API] Proxying generate-enriched to Raindrop gamma-service');

    // Proxy to Raindrop gamma-service which handles:
    // 1. Calling Gamma API
    // 2. Saving to gamma_documents database
    // 3. Returning the document/generation IDs
    const response = await fetch(`${GAMMA_SERVICE_URL}/api/gamma/generate-enriched`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[API] Gamma service error:', data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log('[API] Gamma generation started:', data.generationId);

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Gamma generate-enriched proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to generate document', details: errorMessage },
      { status: 500 }
    );
  }
}
