import { NextRequest, NextResponse } from 'next/server';

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const BASE_URL = 'https://api.congress.gov/v3';

// Text version codes and their display names
const VERSION_NAMES: Record<string, string> = {
  'ih': 'Introduced in House',
  'is': 'Introduced in Senate',
  'rh': 'Reported in House',
  'rs': 'Reported in Senate',
  'rch': 'Reference Change House',
  'rcs': 'Reference Change Senate',
  'eh': 'Engrossed in House',
  'es': 'Engrossed in Senate',
  'eah': 'Engrossed Amendment House',
  'eas': 'Engrossed Amendment Senate',
  'enr': 'Enrolled Bill',
  'pl': 'Public Law',
  'cdh': 'Committee Discharged House',
  'cds': 'Committee Discharged Senate',
  'cph': 'Considered and Passed House',
  'cps': 'Considered and Passed Senate',
  'pcs': 'Placed on Calendar Senate',
  'pch': 'Placed on Calendar House',
  'ath': 'Agreed to House',
  'ats': 'Agreed to Senate',
  'rfh': 'Referred in House',
  'rfs': 'Referred in Senate',
  'fah': 'Failed Amendment House',
  'lth': 'Laid on Table House',
  'lts': 'Laid on Table Senate',
  'pap': 'Printed as Passed',
  'pp': 'Public Print',
  'sc': 'Sponsor Change'
};

interface TextVersion {
  type: string;
  date: string | null;
  formats: Array<{
    type: string;
    url: string;
  }>;
}

interface TextVersionsResponse {
  versions: Array<{
    code: string;
    name: string;
    date: string | null;
    formats: Array<{
      type: string;
      url: string;
    }>;
  }>;
  count: number;
  bill: {
    congress: number;
    type: string;
    number: number;
  };
}

interface TextContentResponse {
  content: string;
  version: {
    code: string;
    name: string;
    date: string | null;
  };
  bill: {
    congress: number;
    type: string;
    number: number;
  };
}

/**
 * Extract version code from URL or type field
 */
function extractVersionCode(version: TextVersion): string {
  // Congress.gov uses codes like "Introduced in House" as type
  // We need to find the short code from the URL or map from the name

  // First try to extract from URL if available
  if (version.formats && version.formats.length > 0) {
    const url = version.formats[0].url;
    // URL format: .../BILLS-119hr1ih.htm or similar
    const match = url.match(/BILLS-\d+\w+\d+(\w+)\./i);
    if (match) {
      return match[1].toLowerCase();
    }
  }

  // Fall back to type field (which is actually the descriptive name)
  const typeLower = version.type?.toLowerCase() || '';

  // Map common names back to codes
  for (const [code, name] of Object.entries(VERSION_NAMES)) {
    if (typeLower === name.toLowerCase()) {
      return code;
    }
  }

  // If we can't map it, return the type as-is
  return version.type || 'unknown';
}

/**
 * GET /api/congress/bill-text
 *
 * Query params:
 * - congress: Congress number (required)
 * - type: Bill type (required, e.g., "hr", "s")
 * - number: Bill number (required)
 * - version: Specific version code to fetch text for (optional)
 *
 * If version is not provided, returns list of available versions.
 * If version is provided, returns the text content for that version.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const congress = searchParams.get('congress');
    const type = searchParams.get('type');
    const number = searchParams.get('number');
    const version = searchParams.get('version');

    // Validate required params
    if (!congress || !type || !number) {
      return NextResponse.json(
        { error: 'Missing required parameters: congress, type, number' },
        { status: 400 }
      );
    }

    // Validate API key
    if (!CONGRESS_API_KEY) {
      console.error('[bill-text] CONGRESS_API_KEY not configured');
      return NextResponse.json(
        { error: 'Congress API key not configured' },
        { status: 500 }
      );
    }

    // Fetch text versions from Congress.gov
    const versionsUrl = `${BASE_URL}/bill/${congress}/${type.toLowerCase()}/${number}/text?format=json&api_key=${CONGRESS_API_KEY}`;

    const versionsResponse = await fetch(versionsUrl, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!versionsResponse.ok) {
      throw new Error(`Congress.gov API error: ${versionsResponse.status}`);
    }

    const versionsData = await versionsResponse.json();
    const textVersions: TextVersion[] = versionsData.textVersions || [];

    // If no version specified, return list of available versions
    if (!version) {
      const versions = textVersions.map((v) => {
        const code = extractVersionCode(v);
        return {
          code,
          name: VERSION_NAMES[code] || v.type || code,
          date: v.date || null,
          formats: v.formats || []
        };
      });

      const response: TextVersionsResponse = {
        versions,
        count: versions.length,
        bill: {
          congress: parseInt(congress),
          type: type.toLowerCase(),
          number: parseInt(number)
        }
      };

      return NextResponse.json(response);
    }

    // Version specified - fetch the text content
    const targetVersion = textVersions.find((v) => {
      const code = extractVersionCode(v);
      return code.toLowerCase() === version.toLowerCase();
    });

    if (!targetVersion) {
      return NextResponse.json(
        {
          error: `Version "${version}" not found`,
          availableVersions: textVersions.map(v => extractVersionCode(v))
        },
        { status: 404 }
      );
    }

    // Find the best format to fetch (prefer .htm or formatted text)
    const formats = targetVersion.formats || [];
    const preferredFormat = formats.find(f =>
      f.url?.includes('.htm') ||
      f.type?.toLowerCase() === 'formatted text'
    ) || formats.find(f =>
      f.url?.includes('.txt') ||
      f.type?.toLowerCase() === 'text'
    ) || formats[0];

    if (!preferredFormat?.url) {
      return NextResponse.json(
        { error: 'No text format available for this version' },
        { status: 404 }
      );
    }

    // Fetch the actual text content
    const textUrl = preferredFormat.url.includes('api_key')
      ? preferredFormat.url
      : `${preferredFormat.url}?api_key=${CONGRESS_API_KEY}`;

    const textResponse = await fetch(textUrl, {
      headers: { 'Accept': 'text/html, text/plain' },
      next: { revalidate: 86400 } // Cache text for 24 hours
    });

    if (!textResponse.ok) {
      throw new Error(`Failed to fetch text content: ${textResponse.status}`);
    }

    let textContent = await textResponse.text();

    // If HTML, extract just the text content
    if (preferredFormat.url.includes('.htm') || textContent.includes('<html')) {
      textContent = stripHtmlToText(textContent);
    }

    const versionCode = extractVersionCode(targetVersion);
    const response: TextContentResponse = {
      content: textContent,
      version: {
        code: versionCode,
        name: VERSION_NAMES[versionCode] || targetVersion.type || versionCode,
        date: targetVersion.date || null
      },
      bill: {
        congress: parseInt(congress),
        type: type.toLowerCase(),
        number: parseInt(number)
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[bill-text] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch bill text',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Strip HTML tags and extract text content
 */
function stripHtmlToText(html: string): string {
  // Remove script and style elements
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Replace common block elements with newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&mdash;/g, '—');
  text = text.replace(/&ndash;/g, '–');

  // Clean up whitespace
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  text = text.trim();

  return text;
}
