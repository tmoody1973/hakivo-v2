import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/download
 * Proxy endpoint to download files from external URLs (avoids CORS issues)
 *
 * Query params:
 * - url: The URL to fetch
 * - filename: The filename for the download
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const filename = searchParams.get('filename') || 'download';

    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    // Validate URL is from allowed domains
    const allowedDomains = [
      'ewr1.vultrobjects.com',  // Vultr Object Storage
      'sgp1.vultrobjects.com',
      'public-api.gamma.app',
      'gamma.app',
    ];

    const parsedUrl = new URL(url);
    const isAllowed = allowedDomains.some(domain =>
      parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
      console.error('[Download Proxy] Blocked domain:', parsedUrl.hostname);
      return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
    }

    console.log('[Download Proxy] Fetching:', url);

    // Fetch the file
    const response = await fetch(url);

    if (!response.ok) {
      console.error('[Download Proxy] Fetch failed:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Failed to fetch file: ${response.status}` },
        { status: response.status }
      );
    }

    // Get the content type
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Stream the response back to the client
    const blob = await response.blob();

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': blob.size.toString(),
      },
    });
  } catch (error) {
    console.error('[Download Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Download failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
