import { NextRequest, NextResponse } from 'next/server';

const GAMMA_SERVICE_URL = process.env.NEXT_PUBLIC_GAMMA_SERVICE_URL ||
  'https://svc-01kcp5rv55e6psxh5ht7byqrgd.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * GET /api/gamma/document-status/:documentId
 * Get the status of a document by its internal ID
 *
 * This is used for polling when using the async enqueue-enriched flow.
 * Returns extended status information including enrichment progress.
 *
 * Status values:
 * - enrichment_pending: Document queued, waiting for background function
 * - enriching: Background function is processing enrichment
 * - generating: Enrichment done, calling Gamma API
 * - pending: Gamma API called, waiting for Gamma to complete
 * - completed: All done
 * - failed: Error occurred
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documentId } = await params;

    const response = await fetch(`${GAMMA_SERVICE_URL}/api/gamma/document-status/${documentId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
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
    console.error('[API] Gamma document-status error:', error);
    return NextResponse.json(
      { error: 'Failed to get document status' },
      { status: 500 }
    );
  }
}
