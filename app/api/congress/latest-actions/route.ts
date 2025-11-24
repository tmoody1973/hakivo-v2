import { NextResponse } from 'next/server';

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const BASE_URL = 'https://api.congress.gov/v3';

interface CongressBill {
  number: number;
  title: string;
  type: string;
  congress: number;
  updateDate: string;
  latestAction: {
    actionDate: string;
    text: string;
  };
  url: string;
}

interface CongressApiResponse {
  bills: CongressBill[];
  pagination: {
    count: number;
    next?: string;
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedLimit = parseInt(searchParams.get('limit') || '10');
  const offset = searchParams.get('offset') || '0';

  try {
    // Get the current congress number (119th Congress for 2025-2026)
    const congress = 119;

    // Fetch more bills than requested to ensure we get the most recent actions
    // We'll sort by action date and return only the requested number
    const fetchLimit = Math.max(requestedLimit * 5, 50);

    // Fetch bills sorted by update date (most recent first)
    const response = await fetch(
      `${BASE_URL}/bill/${congress}?format=json&limit=${fetchLimit}&offset=${offset}&sort=updateDate+desc&api_key=${CONGRESS_API_KEY}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 14400 } // Cache for 4 hours
      }
    );

    if (!response.ok) {
      throw new Error(`Congress API error: ${response.status}`);
    }

    const data: CongressApiResponse = await response.json();

    // Transform the data to match the widget's expected format
    const actions = data.bills?.map((bill) => {
      // Determine chamber from bill type
      const chamber = bill.type.toLowerCase().startsWith('h') ? 'House' :
                      bill.type.toLowerCase().startsWith('s') ? 'Senate' : 'Both';

      // Extract status from action text
      const actionText = bill.latestAction?.text || 'No action recorded';
      const status = extractStatus(actionText);

      return {
        id: `${bill.congress}-${bill.type}-${bill.number}`,
        bill: {
          congress: bill.congress,
          type: bill.type,
          number: bill.number,
          title: bill.title,
          url: bill.url || `https://www.congress.gov/bill/${bill.congress}th-congress/${bill.type.toLowerCase()}-bill/${bill.number}`
        },
        action: {
          date: bill.latestAction?.actionDate || bill.updateDate,
          text: actionText,
          status: status
        },
        chamber: chamber,
        fetchedAt: Date.now()
      };
    }) || [];

    // Sort by action date (most recent first)
    const sortedActions = actions.sort((a, b) => {
      const dateA = new Date(a.action.date).getTime();
      const dateB = new Date(b.action.date).getTime();
      return dateB - dateA; // Descending order (newest first)
    });

    // Return only the requested number of actions
    const limitedActions = sortedActions.slice(0, requestedLimit);

    return NextResponse.json({
      actions: limitedActions,
      count: limitedActions.length,
      lastUpdated: Date.now()
    });

  } catch (error) {
    console.error('Error fetching Congress data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch congressional data',
        message: error instanceof Error ? error.message : 'Unknown error',
        actions: [],
        count: 0,
        lastUpdated: null
      },
      { status: 500 }
    );
  }
}

/**
 * Extract status from action text
 */
function extractStatus(actionText: string): string {
  const text = actionText.toLowerCase();

  // Passed statuses
  if (text.includes('passed house')) return 'Passed House';
  if (text.includes('passed senate')) return 'Passed Senate';
  if (text.includes('became law') || text.includes('signed by president')) return 'Became Law';

  // Committee statuses
  if (text.includes('referred to') || text.includes('committee')) return 'In Committee';

  // Floor action
  if (text.includes('floor') || text.includes('consideration')) return 'Floor Action';

  // Voting
  if (text.includes('vote') || text.includes('roll call')) return 'Vote Scheduled';

  // Default to introduced if no other status
  if (text.includes('introduced')) return 'Introduced';

  return 'Active';
}
