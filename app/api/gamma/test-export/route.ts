import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

/**
 * GET /api/gamma/test-export
 * Test endpoint to verify Gamma export functionality
 */
export async function GET(request: NextRequest) {
  const gammaApiKey = process.env.GAMMA_API_KEY;
  if (!gammaApiKey) {
    return NextResponse.json({ error: 'GAMMA_API_KEY not configured' }, { status: 500 });
  }

  // Step 1: Create a minimal test generation with exportAs: pdf
  const testRequest = {
    inputText: '# Test Export\n\nThis is a test document to verify PDF export functionality.',
    textMode: 'preserve',
    cardSplit: 'auto',
    format: 'document',
    exportAs: 'pdf',
    numCards: 1,
    sharingOptions: {
      workspaceAccess: 'fullAccess',
      externalAccess: 'view',
    },
  };

  console.log('[TEST] Creating test generation with:', JSON.stringify(testRequest));

  const createResponse = await fetch(`${GAMMA_API_BASE}/generations`, {
    method: 'POST',
    headers: {
      'X-API-KEY': gammaApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(testRequest),
  });

  const createText = await createResponse.text();
  console.log('[TEST] Create response:', createText);

  if (!createResponse.ok) {
    return NextResponse.json({
      step: 'create',
      error: createText,
      status: createResponse.status,
    });
  }

  const createResult = JSON.parse(createText);
  const generationId = createResult.generationId || createResult.id;

  console.log('[TEST] Generation ID:', generationId);

  // Step 2: Poll for completion (up to 60 seconds)
  const maxAttempts = 12;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));

    const statusResponse = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      method: 'GET',
      headers: { 'X-API-KEY': gammaApiKey },
    });

    const statusText = await statusResponse.text();
    console.log(`[TEST] Status attempt ${i + 1}:`, statusText);

    if (!statusResponse.ok) {
      return NextResponse.json({
        step: 'status',
        attempt: i + 1,
        error: statusText,
      });
    }

    const statusResult = JSON.parse(statusText);

    if (statusResult.status === 'completed') {
      return NextResponse.json({
        success: true,
        generationId,
        status: statusResult.status,
        url: statusResult.url,
        exports: statusResult.exports,
        hasExports: !!(statusResult.exports?.pdf || statusResult.exports?.pptx),
        fullResponse: statusResult,
      });
    }

    if (statusResult.status === 'failed') {
      return NextResponse.json({
        success: false,
        generationId,
        status: 'failed',
        error: statusResult.error,
      });
    }
  }

  return NextResponse.json({
    success: false,
    generationId,
    error: 'Timeout waiting for generation',
  });
}
