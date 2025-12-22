import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

/**
 * POST /api/gamma/generate-enriched
 * Call Gamma API directly (bypassing Raindrop for faster iteration)
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { artifact, gammaOptions, title } = body;

    // Log incoming request from frontend
    console.log('[API] Incoming gammaOptions from frontend:', JSON.stringify(gammaOptions));

    if (!artifact?.content) {
      return NextResponse.json({ error: 'artifact.content is required' }, { status: 400 });
    }

    const gammaApiKey = process.env.GAMMA_API_KEY;
    if (!gammaApiKey) {
      console.error('[API] GAMMA_API_KEY not configured');
      return NextResponse.json({ error: 'Gamma API not configured' }, { status: 500 });
    }

    // Build enriched text (simple version - no external enrichment for now)
    const enrichedText = `# ${title || artifact.title}\n\n${artifact.content}`;

    // Build Gamma API request - matching the exact structure from Gamma docs
    const gammaRequest: Record<string, unknown> = {
      inputText: enrichedText,
      textMode: gammaOptions?.textMode || 'generate',
      cardSplit: 'auto',
      format: gammaOptions?.format || 'document', // Default to document (supports PDF)
      exportAs: gammaOptions?.exportAs || 'pdf', // Default to PDF export
    };

    // Add optional fields
    if (gammaOptions?.themeId) gammaRequest.themeId = gammaOptions.themeId;
    if (gammaOptions?.numCards) gammaRequest.numCards = gammaOptions.numCards;
    if (gammaOptions?.textOptions) gammaRequest.textOptions = gammaOptions.textOptions;
    if (gammaOptions?.imageOptions) gammaRequest.imageOptions = gammaOptions.imageOptions;

    // Build sharingOptions nested object (per Gamma API spec)
    const sharingOptions: Record<string, unknown> = {
      workspaceAccess: 'fullAccess',
      externalAccess: 'view',
    };
    gammaRequest.sharingOptions = sharingOptions;

    // Log the FULL request for debugging (mask long text)
    const debugRequest = {
      ...gammaRequest,
      inputText: `[${enrichedText.length} chars]`,
    };
    console.log('[API] FULL Gamma API request:', JSON.stringify(debugRequest));
    console.log('[API] exportAs value:', gammaRequest.exportAs);
    console.log('[API] format value:', gammaRequest.format);

    // Call Gamma API directly
    const response = await fetch(`${GAMMA_API_BASE}/generations`, {
      method: 'POST',
      headers: {
        'X-API-KEY': gammaApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gammaRequest),
    });

    const responseText = await response.text();
    console.log('[API] Gamma API response status:', response.status);
    console.log('[API] Gamma API FULL response:', responseText);

    if (!response.ok) {
      console.error('[API] Gamma API error:', responseText);
      return NextResponse.json(
        { error: 'Gamma API error', details: responseText },
        { status: response.status }
      );
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      console.error('[API] Failed to parse Gamma response:', responseText);
      return NextResponse.json(
        { error: 'Invalid Gamma API response', details: responseText },
        { status: 502 }
      );
    }

    // Gamma API returns 'generationId', normalize to 'id'
    const generationId = result.generationId || result.id;

    if (!generationId) {
      console.error('[API] No generation ID in Gamma response:', result);
      return NextResponse.json(
        { error: 'No generation ID returned', details: JSON.stringify(result) },
        { status: 502 }
      );
    }

    console.log('[API] Gamma generation started:', generationId);

    // Return the generation ID for polling
    // Note: We're not saving to database since we're bypassing Raindrop
    // The frontend will poll /api/gamma/status/:generationId directly
    return NextResponse.json({
      success: true,
      documentId: generationId, // Use generation ID as document ID for now
      generationId: generationId,
      status: result.status || 'pending',
    });
  } catch (error) {
    console.error('[API] Gamma generate-enriched error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to generate document', details: errorMessage },
      { status: 500 }
    );
  }
}
