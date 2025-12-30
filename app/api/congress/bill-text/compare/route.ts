import { NextRequest, NextResponse } from 'next/server';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const BASE_URL = 'https://api.congress.gov/v3';

// Version names for display
const VERSION_NAMES: Record<string, string> = {
  'ih': 'Introduced in House',
  'is': 'Introduced in Senate',
  'rh': 'Reported in House',
  'rs': 'Reported in Senate',
  'eh': 'Engrossed in House',
  'es': 'Engrossed in Senate',
  'enr': 'Enrolled Bill',
  'pl': 'Public Law'
};

interface CompareRequest {
  congress: number;
  type: string;
  number: number;
  version1: string;
  version2: string;
}

interface DiffChunk {
  type: 'equal' | 'insert' | 'delete';
  text: string;
}

interface CompareResponse {
  diff: DiffChunk[];
  summary: {
    added: number;
    removed: number;
    unchanged: number;
  };
  aiAnalysis: string | null;
  versions: {
    version1: { code: string; name: string };
    version2: { code: string; name: string };
  };
  bill: {
    congress: number;
    type: string;
    number: number;
  };
}

/**
 * POST /api/congress/bill-text/compare
 *
 * Body:
 * - congress: Congress number
 * - type: Bill type (e.g., "hr", "s")
 * - number: Bill number
 * - version1: First version code (older)
 * - version2: Second version code (newer)
 *
 * Returns diff chunks and AI analysis of changes
 */
export async function POST(request: NextRequest) {
  try {
    const body: CompareRequest = await request.json();
    const { congress, type, number, version1, version2 } = body;

    // Validate required params
    if (!congress || !type || !number || !version1 || !version2) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Fetch both text versions in parallel
    const [text1, text2] = await Promise.all([
      fetchBillText(congress, type, number, version1),
      fetchBillText(congress, type, number, version2)
    ]);

    if (!text1 || !text2) {
      return NextResponse.json(
        { error: 'Failed to fetch one or both text versions' },
        { status: 404 }
      );
    }

    // Compute diff using simple line-based diff algorithm
    const diff = computeDiff(text1, text2);

    // Calculate summary statistics
    const summary = {
      added: diff.filter(d => d.type === 'insert').reduce((sum, d) => sum + d.text.length, 0),
      removed: diff.filter(d => d.type === 'delete').reduce((sum, d) => sum + d.text.length, 0),
      unchanged: diff.filter(d => d.type === 'equal').reduce((sum, d) => sum + d.text.length, 0)
    };

    // Generate AI analysis of the changes
    let aiAnalysis: string | null = null;
    if (ANTHROPIC_API_KEY) {
      aiAnalysis = await generateAIAnalysis(
        diff,
        version1,
        version2,
        type,
        number,
        congress
      );
    }

    const response: CompareResponse = {
      diff,
      summary,
      aiAnalysis,
      versions: {
        version1: {
          code: version1,
          name: VERSION_NAMES[version1] || version1
        },
        version2: {
          code: version2,
          name: VERSION_NAMES[version2] || version2
        }
      },
      bill: { congress, type: type.toLowerCase(), number }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[bill-text/compare] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compare bill text versions',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch bill text for a specific version directly from Congress.gov
 */
async function fetchBillText(
  congress: number,
  type: string,
  number: number,
  version: string
): Promise<string | null> {
  try {
    if (!CONGRESS_API_KEY) {
      console.error('[bill-text/compare] CONGRESS_API_KEY not configured');
      return null;
    }

    // First get the text versions to find the URL for this version
    const versionsUrl = `${BASE_URL}/bill/${congress}/${type.toLowerCase()}/${number}/text?format=json&api_key=${CONGRESS_API_KEY}`;
    const versionsResponse = await fetch(versionsUrl, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 }
    });

    if (!versionsResponse.ok) {
      console.error(`Failed to fetch versions: ${versionsResponse.status}`);
      return null;
    }

    const versionsData = await versionsResponse.json();
    const textVersions = versionsData.textVersions || [];

    // Find the requested version
    const targetVersion = textVersions.find((v: { type?: string; formats?: Array<{ url?: string }> }) => {
      if (v.formats && v.formats.length > 0) {
        const url = v.formats[0].url || '';

        // Handle Public Law URLs: PLAW-119publ21.htm -> pl
        if (version.toLowerCase() === 'pl' && url.includes('/plaws/')) {
          return true;
        }

        // Match BILLS pattern: BILLS-{congress}{type}{number}{version}.ext
        // e.g., BILLS-119hr1enr.htm -> version = enr
        const match = url.match(/BILLS-\d+[a-z]+\d+([a-z]+)\./i);
        if (match && match[1].toLowerCase() === version.toLowerCase()) {
          return true;
        }
      }
      return false;
    });

    if (!targetVersion) {
      console.error(`Version ${version} not found`);
      return null;
    }

    // Find the best format (prefer .htm)
    const formats = targetVersion.formats || [];
    const preferredFormat = formats.find((f: { url?: string; type?: string }) =>
      f.url?.includes('.htm') || f.type?.toLowerCase() === 'formatted text'
    ) || formats[0];

    if (!preferredFormat?.url) {
      console.error(`No text format available for ${version}`);
      return null;
    }

    // Fetch the actual text
    const textUrl = preferredFormat.url.includes('api_key')
      ? preferredFormat.url
      : `${preferredFormat.url}?api_key=${CONGRESS_API_KEY}`;

    const textResponse = await fetch(textUrl, {
      headers: { 'Accept': 'text/html, text/plain' },
      next: { revalidate: 86400 }
    });

    if (!textResponse.ok) {
      console.error(`Failed to fetch text content: ${textResponse.status}`);
      return null;
    }

    let text = await textResponse.text();

    // Strip HTML if needed
    if (preferredFormat.url.includes('.htm') || text.includes('<html')) {
      text = stripHtmlToText(text);
    }

    return text;

  } catch (error) {
    console.error(`Error fetching ${version} version:`, error);
    return null;
  }
}

/**
 * Strip HTML tags and extract text content
 */
function stripHtmlToText(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&mdash;/g, '—');
  text = text.replace(/&ndash;/g, '–');
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  return text.trim();
}

/**
 * Simple line-based diff algorithm
 * For production, consider using diff-match-patch library
 */
function computeDiff(text1: string, text2: string): DiffChunk[] {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');

  const diff: DiffChunk[] = [];

  // Simple LCS-based diff
  const lcs = longestCommonSubsequence(lines1, lines2);

  let i = 0, j = 0, k = 0;

  while (i < lines1.length || j < lines2.length) {
    if (k < lcs.length && i < lines1.length && lines1[i] === lcs[k] &&
        j < lines2.length && lines2[j] === lcs[k]) {
      // Common line
      diff.push({ type: 'equal', text: lines1[i] + '\n' });
      i++; j++; k++;
    } else if (k < lcs.length && i < lines1.length && lines1[i] !== lcs[k]) {
      // Deleted line
      diff.push({ type: 'delete', text: lines1[i] + '\n' });
      i++;
    } else if (k < lcs.length && j < lines2.length && lines2[j] !== lcs[k]) {
      // Inserted line
      diff.push({ type: 'insert', text: lines2[j] + '\n' });
      j++;
    } else if (i < lines1.length) {
      // Remaining deleted lines
      diff.push({ type: 'delete', text: lines1[i] + '\n' });
      i++;
    } else if (j < lines2.length) {
      // Remaining inserted lines
      diff.push({ type: 'insert', text: lines2[j] + '\n' });
      j++;
    }
  }

  // Merge consecutive chunks of the same type
  return mergeDiffChunks(diff);
}

/**
 * Compute longest common subsequence of two arrays
 */
function longestCommonSubsequence(arr1: string[], arr2: string[]): string[] {
  const m = arr1.length;
  const n = arr2.length;

  // Create DP table
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m, j = n;

  while (i > 0 && j > 0) {
    if (arr1[i - 1] === arr2[j - 1]) {
      lcs.unshift(arr1[i - 1]);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

/**
 * Merge consecutive diff chunks of the same type
 */
function mergeDiffChunks(diff: DiffChunk[]): DiffChunk[] {
  if (diff.length === 0) return diff;

  const merged: DiffChunk[] = [];
  let current = { ...diff[0] };

  for (let i = 1; i < diff.length; i++) {
    if (diff[i].type === current.type) {
      current.text += diff[i].text;
    } else {
      merged.push(current);
      current = { ...diff[i] };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Generate AI analysis of the legislative changes
 */
async function generateAIAnalysis(
  diff: DiffChunk[],
  version1: string,
  version2: string,
  billType: string,
  billNumber: number,
  congress: number
): Promise<string | null> {
  try {
    if (!ANTHROPIC_API_KEY) {
      console.warn('[bill-text/compare] ANTHROPIC_API_KEY not configured');
      return null;
    }

    // Extract significant changes (skip minor formatting)
    const additions = diff
      .filter(d => d.type === 'insert' && d.text.trim().length > 20)
      .map(d => d.text.trim())
      .slice(0, 10);

    const deletions = diff
      .filter(d => d.type === 'delete' && d.text.trim().length > 20)
      .map(d => d.text.trim())
      .slice(0, 10);

    if (additions.length === 0 && deletions.length === 0) {
      return 'No significant textual changes detected between these versions. Differences may be limited to formatting or minor technical corrections.';
    }

    const prompt = `You are a legislative analyst explaining changes between two versions of a bill to citizens.

Bill: ${billType.toUpperCase()} ${billNumber} (${congress}th Congress)
Comparing: ${VERSION_NAMES[version1] || version1} → ${VERSION_NAMES[version2] || version2}

KEY ADDITIONS (new text in later version):
${additions.length > 0 ? additions.map(a => `• ${a.substring(0, 500)}`).join('\n') : 'None'}

KEY DELETIONS (removed from earlier version):
${deletions.length > 0 ? deletions.map(d => `• ${d.substring(0, 500)}`).join('\n') : 'None'}

Provide a concise analysis (3-5 bullet points) explaining:
1. What substantive policy changes were made
2. Why these changes might matter to citizens
3. Any notable additions or removals of provisions

Focus on legislative significance, not formatting changes. Be factual and non-partisan.`;

    // Call Anthropic API directly via fetch
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const textBlock = data.content?.find((block: { type: string; text?: string }) => block.type === 'text');
    return textBlock?.text || null;

  } catch (error) {
    console.error('[bill-text/compare] AI analysis error:', error);
    return null;
  }
}
