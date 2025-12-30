import { NextRequest, NextResponse } from 'next/server';
import policyInterestMapping from '@/hakivo-api/docs/architecture/policy_interest_mapping.json';

const DB_ADMIN_URL = process.env.DB_ADMIN_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzq.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

interface PublicLaw {
  id: string;
  congress: number;
  billType: string;
  billNumber: number;
  title: string;
  policyArea: string | null;
  lawNumber: string | null;
  latestActionDate: string | null;
  originChamber: string | null;
}

interface PublicLawsResponse {
  laws: PublicLaw[];
  count: number;
  lastUpdated: number;
  error?: string;
  message?: string;
}

/**
 * Extract public law number from latest_action_text
 * e.g., "Became Public Law No: 119-47." -> "119-47"
 */
function extractLawNumber(actionText: string | null): string | null {
  if (!actionText) return null;
  const match = actionText.match(/Public Law No:\s*(\d+-\d+)/i);
  return match ? match[1] : null;
}

/**
 * GET /api/congress/public-laws
 *
 * Query params:
 * - interests: comma-separated list of user interests (e.g., "Healthcare,Education")
 * - all: if "true", return all public laws regardless of interests
 * - limit: max number of results (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const interestsParam = searchParams.get('interests');
    const showAll = searchParams.get('all') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 250);

    // Build the SQL query
    let query = `
      SELECT
        id, congress, bill_type, bill_number, title,
        policy_area, latest_action_text, latest_action_date, origin_chamber
      FROM bills
      WHERE congress = 119
        AND latest_action_text LIKE '%Became Public Law%'
    `;

    // Filter by policy areas if interests provided and not showing all
    if (!showAll && interestsParam) {
      const interests = interestsParam.split(',').map(i => i.trim());

      // Map user interests to Congress.gov policy_area values
      const policyAreas: string[] = [];
      for (const interest of interests) {
        const mapping = policyInterestMapping.find(m => m.interest === interest);
        if (mapping) {
          policyAreas.push(...mapping.policy_areas);
        }
      }

      if (policyAreas.length > 0) {
        // Escape single quotes and build IN clause
        const escapedAreas = policyAreas.map(a => `'${a.replace(/'/g, "''")}'`).join(',');
        query += ` AND policy_area IN (${escapedAreas})`;
      }
    }

    // Order by law number (most recent first)
    query += ` ORDER BY latest_action_date DESC LIMIT ${limit}`;

    // Execute query
    const response = await fetch(`${DB_ADMIN_URL}/db-admin/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Database query failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Database query failed');
    }

    // Transform results
    const laws: PublicLaw[] = (data.results || []).map((row: {
      id: string;
      congress: number;
      bill_type: string;
      bill_number: number;
      title: string;
      policy_area: string | null;
      latest_action_text: string | null;
      latest_action_date: string | null;
      origin_chamber: string | null;
    }) => ({
      id: row.id,
      congress: row.congress,
      billType: row.bill_type,
      billNumber: row.bill_number,
      title: row.title,
      policyArea: row.policy_area,
      lawNumber: extractLawNumber(row.latest_action_text),
      latestActionDate: row.latest_action_date,
      originChamber: row.origin_chamber,
    }));

    const responseData: PublicLawsResponse = {
      laws,
      count: laws.length,
      lastUpdated: Date.now(),
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('[public-laws] Error:', error);
    return NextResponse.json(
      {
        laws: [],
        count: 0,
        lastUpdated: Date.now(),
        error: 'Failed to fetch public laws',
        message: error instanceof Error ? error.message : 'Unknown error',
      } as PublicLawsResponse,
      { status: 500 }
    );
  }
}
