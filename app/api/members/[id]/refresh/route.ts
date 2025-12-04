/**
 * Member Refresh API Route
 *
 * Fetches fresh member data from Congress.gov API to check for updates.
 * This helps keep member information current, especially for newly elected
 * representatives like Jarvis Johnson (TX-18) who replaced previous members.
 *
 * GET /api/members/:bioguideId/refresh
 */

import { NextRequest, NextResponse } from 'next/server';

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const CONGRESS_API_BASE = 'https://api.congress.gov/v3';

export interface CongressGovMember {
  bioguideId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  fullName?: string;
  birthYear?: string;
  partyName?: string;
  state?: string;
  district?: number;
  depiction?: {
    imageUrl?: string;
    attribution?: string;
  };
  officialWebsiteUrl?: string;
  addressInformation?: {
    officeAddress?: string;
    city?: string;
    phoneNumber?: string;
  };
  directOrderName?: string;
  honorificName?: string;
  invertedOrderName?: string;
  currentMember?: boolean;
  terms?: Array<{
    chamber?: string;
    startYear?: number;
    endYear?: number;
    memberType?: string;
    stateCode?: string;
    stateName?: string;
    congress?: number;
    district?: number;
  }>;
  updateDate?: string;
}

export interface RefreshResponse {
  success: boolean;
  source: 'congress_gov';
  member: {
    bioguideId: string;
    firstName: string;
    lastName: string;
    fullName: string;
    party: string;
    state: string;
    district?: number;
    chamber: 'House' | 'Senate';
    imageUrl?: string;
    officialWebsiteUrl?: string;
    phoneNumber?: string;
    officeAddress?: string;
    currentMember: boolean;
    updateDate?: string;
  } | null;
  isStale: boolean;
  staleReason?: string;
  error?: string;
}

/**
 * Fetch member data directly from Congress.gov API
 */
async function fetchFromCongressGov(bioguideId: string): Promise<CongressGovMember | null> {
  if (!CONGRESS_API_KEY) {
    console.error('[MemberRefresh] CONGRESS_API_KEY not configured');
    return null;
  }

  try {
    const url = `${CONGRESS_API_BASE}/member/${bioguideId}?format=json&api_key=${CONGRESS_API_KEY}`;
    console.log('[MemberRefresh] Fetching from Congress.gov:', bioguideId);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Cache for 1 hour to avoid hammering the API
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('[MemberRefresh] Member not found in Congress.gov:', bioguideId);
        return null;
      }
      console.error('[MemberRefresh] Congress.gov API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    console.log('[MemberRefresh] Got Congress.gov data for:', bioguideId);

    return data.member || null;
  } catch (error) {
    console.error('[MemberRefresh] Error fetching from Congress.gov:', error);
    return null;
  }
}

/**
 * Determine chamber from member data
 */
function determineChamber(member: CongressGovMember): 'House' | 'Senate' {
  // Check latest term for chamber info
  if (member.terms && member.terms.length > 0) {
    const latestTerm = member.terms[member.terms.length - 1];
    if (latestTerm.chamber) {
      return latestTerm.chamber.toLowerCase().includes('senate') ? 'Senate' : 'House';
    }
    if (latestTerm.memberType) {
      return latestTerm.memberType.toLowerCase().includes('senator') ? 'Senate' : 'House';
    }
  }

  // Fallback: if they have a district, they're House
  if (member.district !== undefined && member.district !== null) {
    return 'House';
  }

  // Default to House
  return 'House';
}

/**
 * GET /api/members/:bioguideId/refresh
 *
 * Returns fresh member data from Congress.gov, or indicates if the member
 * may be outdated (e.g., replaced by a new representative).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bioguideId } = await params;

    if (!bioguideId) {
      return NextResponse.json(
        { success: false, error: 'Missing bioguide ID' },
        { status: 400 }
      );
    }

    console.log('[MemberRefresh] Checking for updates:', bioguideId);

    // Fetch fresh data from Congress.gov
    const congressMember = await fetchFromCongressGov(bioguideId);

    if (!congressMember) {
      // Member not found - could be an invalid ID or API issue
      const response: RefreshResponse = {
        success: false,
        source: 'congress_gov',
        member: null,
        isStale: true,
        staleReason: 'Member not found in Congress.gov - may have left office or ID is invalid',
        error: 'Member not found',
      };

      return NextResponse.json(response, { status: 404 });
    }

    // Check if member is currently serving
    const isCurrentMember = congressMember.currentMember === true;

    // Build normalized member object
    const member = {
      bioguideId: congressMember.bioguideId,
      firstName: congressMember.firstName || '',
      lastName: congressMember.lastName || '',
      fullName: congressMember.directOrderName ||
                congressMember.fullName ||
                `${congressMember.firstName || ''} ${congressMember.lastName || ''}`.trim(),
      party: congressMember.partyName || 'Unknown',
      state: congressMember.state || '',
      district: congressMember.district,
      chamber: determineChamber(congressMember),
      imageUrl: congressMember.depiction?.imageUrl,
      officialWebsiteUrl: congressMember.officialWebsiteUrl,
      phoneNumber: congressMember.addressInformation?.phoneNumber,
      officeAddress: congressMember.addressInformation?.officeAddress,
      currentMember: isCurrentMember,
      updateDate: congressMember.updateDate,
    };

    // Determine if data might be stale
    let isStale = false;
    let staleReason: string | undefined;

    if (!isCurrentMember) {
      isStale = true;
      staleReason = 'This member is no longer serving in Congress. They may have been succeeded by another representative.';
    }

    const response: RefreshResponse = {
      success: true,
      source: 'congress_gov',
      member,
      isStale,
      staleReason,
    };

    console.log('[MemberRefresh] Returning fresh data for:', bioguideId, '- Current:', isCurrentMember);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[MemberRefresh] Error:', error);

    return NextResponse.json(
      {
        success: false,
        source: 'congress_gov',
        member: null,
        isStale: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as RefreshResponse,
      { status: 500 }
    );
  }
}
