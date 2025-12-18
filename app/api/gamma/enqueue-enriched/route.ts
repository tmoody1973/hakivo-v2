import { NextRequest, NextResponse } from 'next/server';

const GAMMA_SERVICE_URL = process.env.NEXT_PUBLIC_GAMMA_SERVICE_URL ||
  'https://svc-01kcp5rv55e6psxh5ht7byqrgd.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

// Background function URL for triggering after enqueue
const BACKGROUND_FUNCTION_URL = process.env.NETLIFY_URL
  ? `${process.env.NETLIFY_URL}/.netlify/functions/gamma-processor-background`
  : 'https://hakivo-v2.netlify.app/.netlify/functions/gamma-processor-background';

/**
 * POST /api/gamma/enqueue-enriched
 * Enqueue a document for background enrichment processing
 *
 * This endpoint:
 * 1. Calls the Raindrop gamma-service to create a pending record
 * 2. Triggers the Netlify background function to process it
 * 3. Returns the documentId immediately for polling
 *
 * The background function handles enrichment (Perplexity, FEC, etc.) and
 * Gamma API generation, which can take several minutes.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Step 1: Call the Raindrop service to create a pending record
    const enqueueResponse = await fetch(`${GAMMA_SERVICE_URL}/api/gamma/enqueue-enriched`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(body),
    });

    // Check content type to avoid parsing HTML as JSON
    const contentType = enqueueResponse.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await enqueueResponse.text();
      console.error('[API] Gamma service returned non-JSON:', text.substring(0, 200));
      return NextResponse.json(
        { error: 'Gamma service unavailable', details: `Service returned ${enqueueResponse.status}` },
        { status: 502 }
      );
    }

    const enqueueData = await enqueueResponse.json();

    if (!enqueueResponse.ok || !enqueueData.success) {
      return NextResponse.json(enqueueData, { status: enqueueResponse.status });
    }

    // Step 2: Trigger the background function (fire-and-forget)
    // Background functions return 202 immediately and process asynchronously
    try {
      console.log(`[API] Triggering background function for document: ${enqueueData.documentId}`);

      // Fire-and-forget - don't await the response
      fetch(BACKGROUND_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Background functions ignore the body, but we can include it for logging
        body: JSON.stringify({ documentId: enqueueData.documentId }),
      }).catch(err => {
        // Log but don't fail - the background function can also be triggered by a scheduler
        console.error('[API] Background function trigger error (non-fatal):', err);
      });
    } catch (triggerError) {
      // Non-fatal - background function can also be triggered by scheduler
      console.error('[API] Background function trigger failed (non-fatal):', triggerError);
    }

    // Step 3: Return the documentId for polling
    return NextResponse.json({
      success: true,
      documentId: enqueueData.documentId,
      status: enqueueData.status,
      message: 'Document queued for background processing. Poll /api/gamma/document-status/{documentId} for updates.',
    });
  } catch (error) {
    console.error('[API] Gamma enqueue-enriched error:', error);
    return NextResponse.json(
      { error: 'Failed to enqueue document for enrichment' },
      { status: 500 }
    );
  }
}
