import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import { z } from 'zod';

// Validation schemas
const SearchMembersSchema = z.object({
  query: z.string().optional(),
  party: z.string().optional(),
  state: z.string().optional(),
  chamber: z.enum(['house', 'senate']).optional(),
  currentOnly: z.boolean().default(true),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sort: z.enum(['last_name', 'state', 'party']).default('last_name'),
  order: z.enum(['asc', 'desc']).default('asc')
});

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

/**
 * Verify JWT token from auth header
 */
async function verifyAuth(authHeader: string | undefined): Promise<{ userId: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  // Use jose to verify token
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);

    if (typeof payload.userId !== 'string') {
      return null;
    }

    return { userId: payload.userId };
  } catch (error) {
    return null;
  }
}

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'members-service', timestamp: new Date().toISOString() });
});

/**
 * GET /members/search
 * Search for members with filters
 */
app.get('/members/search', async (c) => {
  try {
    const rawParams = {
      query: c.req.query('query'),
      party: c.req.query('party'),
      state: c.req.query('state'),
      chamber: c.req.query('chamber') as 'house' | 'senate' | undefined,
      currentOnly: c.req.query('currentOnly') === 'false' ? false : true,
      limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20,
      offset: c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0,
      sort: (c.req.query('sort') as 'last_name' | 'state' | 'party' | undefined) || 'last_name',
      order: (c.req.query('order') as 'asc' | 'desc' | undefined) || 'asc'
    };

    const params = SearchMembersSchema.parse(rawParams);
    const db = c.env.APP_DB;

    // Build WHERE clause
    const conditions: string[] = [];
    const bindings: any[] = [];

    if (params.currentOnly) {
      conditions.push('current_member = 1');
    }

    if (params.query) {
      conditions.push(`(
        first_name LIKE ? OR
        last_name LIKE ? OR
        state LIKE ? OR
        party LIKE ?
      )`);
      const searchTerm = `%${params.query}%`;
      bindings.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (params.party) {
      conditions.push('party = ?');
      bindings.push(params.party);
    }

    if (params.state) {
      conditions.push('state = ?');
      bindings.push(params.state.toUpperCase());
    }

    if (params.chamber) {
      if (params.chamber === 'house') {
        conditions.push('district IS NOT NULL');
      } else {
        conditions.push('district IS NULL');
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM members ${whereClause}`;
    const countResult = await db.prepare(countQuery).bind(...bindings).first() as any;
    const total = countResult?.total || 0;

    // Get members
    const membersQuery = `
      SELECT
        bioguide_id,
        first_name,
        middle_name,
        last_name,
        party,
        state,
        district,
        image_url,
        current_member,
        current_term_type,
        current_term_start,
        current_term_end
      FROM members
      ${whereClause}
      ORDER BY ${params.sort} ${params.order}
      LIMIT ? OFFSET ?
    `;

    const membersResult = await db
      .prepare(membersQuery)
      .bind(...bindings, params.limit, params.offset)
      .all();

    const members = (membersResult.results || []).map((m: any) => ({
      bioguideId: m.bioguide_id,
      firstName: m.first_name,
      middleName: m.middle_name,
      lastName: m.last_name,
      fullName: [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' '),
      party: m.party,
      state: m.state,
      district: m.district,
      chamber: m.district !== null ? 'House' : 'Senate',
      imageUrl: m.image_url,
      currentMember: m.current_member === 1,
      currentTerm: m.current_term_type ? {
        type: m.current_term_type,
        start: m.current_term_start,
        end: m.current_term_end
      } : null
    }));

    return c.json({
      success: true,
      members,
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset,
        hasMore: params.offset + params.limit < total
      }
    });

  } catch (error: any) {
    console.error('Member search failed:', error);
    return c.json({
      error: 'Member search failed',
      message: error.message
    }, 500);
  }
});

/**
 * GET /members/:bioguide_id
 * Get full member profile with all details
 */
app.get('/members/:bioguide_id', async (c) => {
  try {
    const bioguideId = c.req.param('bioguide_id');
    const db = c.env.APP_DB;

    // Get member with all fields
    const member = await db
      .prepare(`
        SELECT * FROM members WHERE bioguide_id = ?
      `)
      .bind(bioguideId)
      .first() as any;

    if (!member) {
      return c.json({
        error: 'Member not found',
        message: `No member found with bioguide_id: ${bioguideId}`
      }, 404);
    }

    // Get sponsored bills
    const sponsoredBills = await db
      .prepare(`
        SELECT
          id,
          congress,
          bill_type,
          bill_number,
          title,
          introduced_date,
          latest_action_date,
          latest_action_text
        FROM bills
        WHERE sponsor_bioguide_id = ?
        ORDER BY introduced_date DESC
        LIMIT 10
      `)
      .bind(bioguideId)
      .all();

    // TODO: Get cosponsored bills when we add cosponsors tracking
    // TODO: Get committee assignments when committees table is created

    // Parse FEC IDs if present
    let fecIds: string[] = [];
    if (member.fec_ids) {
      try {
        fecIds = JSON.parse(member.fec_ids);
      } catch {
        fecIds = [member.fec_ids];
      }
    }

    // Build response
    const response = {
      success: true,
      member: {
        // Basic Info
        bioguideId: member.bioguide_id,
        firstName: member.first_name,
        middleName: member.middle_name,
        lastName: member.last_name,
        fullName: [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(' '),
        officialFullName: member.official_full_name,
        nickname: member.nickname,
        suffix: member.suffix,

        // Political Info
        party: member.party,
        state: member.state,
        district: member.district,
        chamber: member.district !== null ? 'House' : 'Senate',
        currentMember: member.current_member === 1,

        // Biographical Info
        gender: member.gender,
        birthDate: member.birth_date,
        birthYear: member.birth_year,
        birthPlace: member.birth_place,
        deathYear: member.death_year,

        // Contact Info
        url: member.url,
        officeAddress: member.office_address,
        phoneNumber: member.phone_number,
        imageUrl: member.image_url,

        // Current Term
        currentTerm: member.current_term_type ? {
          type: member.current_term_type,
          start: member.current_term_start,
          end: member.current_term_end,
          state: member.current_term_state,
          district: member.current_term_district,
          class: member.current_term_class,
          stateRank: member.current_term_state_rank
        } : null,

        // External IDs
        ids: {
          thomas: member.thomas_id,
          lis: member.lis_id,
          govtrack: member.govtrack_id,
          opensecrets: member.opensecrets_id,
          votesmart: member.votesmart_id,
          fec: fecIds,
          cspan: member.cspan_id,
          wikipedia: member.wikipedia_id,
          houseHistory: member.house_history_id,
          ballotpedia: member.ballotpedia_id,
          maplight: member.maplight_id,
          icpsr: member.icpsr_id,
          wikidata: member.wikidata_id,
          googleEntity: member.google_entity_id
        },

        // Social Media
        socialMedia: {
          twitter: member.twitter_handle,
          facebook: member.facebook_url,
          youtube: member.youtube_url,
          instagram: member.instagram_handle,
          website: member.website_url,
          contactForm: member.contact_form_url,
          rss: member.rss_url
        },

        // Legislative Activity
        sponsoredBills: (sponsoredBills.results || []).map((bill: any) => ({
          id: bill.id,
          congress: bill.congress,
          billType: bill.bill_type,
          billNumber: bill.bill_number,
          title: bill.title,
          introducedDate: bill.introduced_date,
          latestActionDate: bill.latest_action_date,
          latestActionText: bill.latest_action_text
        })),
        sponsoredBillsCount: sponsoredBills.results?.length || 0,

        // TODO: Add when data available
        cosponsoredBills: [],
        committees: []
      }
    };

    return c.json(response);

  } catch (error: any) {
    console.error('Failed to get member:', error);
    return c.json({
      error: 'Failed to get member',
      message: error.message
    }, 500);
  }
});

/**
 * GET /members/states
 * Get list of states with member counts
 */
app.get('/members/states', async (c) => {
  try {
    const db = c.env.APP_DB;
    const currentOnly = c.req.query('currentOnly') !== 'false';

    const whereClause = currentOnly ? 'WHERE current_member = 1' : '';

    const result = await db
      .prepare(`
        SELECT
          state,
          COUNT(*) as count,
          SUM(CASE WHEN district IS NULL THEN 1 ELSE 0 END) as senators,
          SUM(CASE WHEN district IS NOT NULL THEN 1 ELSE 0 END) as representatives
        FROM members
        ${whereClause}
        GROUP BY state
        ORDER BY state
      `)
      .all();

    return c.json({
      success: true,
      states: result.results || []
    });

  } catch (error: any) {
    console.error('Failed to get states:', error);
    return c.json({
      error: 'Failed to get states',
      message: error.message
    }, 500);
  }
});

/**
 * GET /members/parties
 * Get list of parties with member counts
 */
app.get('/members/parties', async (c) => {
  try {
    const db = c.env.APP_DB;
    const currentOnly = c.req.query('currentOnly') !== 'false';

    const whereClause = currentOnly ? 'WHERE current_member = 1' : '';

    const result = await db
      .prepare(`
        SELECT
          party,
          COUNT(*) as count
        FROM members
        ${whereClause}
        GROUP BY party
        ORDER BY count DESC
      `)
      .all();

    return c.json({
      success: true,
      parties: result.results || []
    });

  } catch (error: any) {
    console.error('Failed to get parties:', error);
    return c.json({
      error: 'Failed to get parties',
      message: error.message
    }, 500);
  }
});

/**
 * Helper function to enrich votes with bill titles from our database
 */
async function enrichVotesWithBillTitles(
  db: any,
  votes: Array<{
    rollCallNumber: number;
    voteDate: string;
    voteQuestion: string;
    voteResult: string;
    memberVote: string;
    bill?: { type: string; number: string; title?: string };
  }>,
  congress: number
): Promise<Array<{
  rollCallNumber: number;
  voteDate: string;
  voteQuestion: string;
  voteResult: string;
  memberVote: string;
  bill?: { type: string; number: string; title?: string };
}>> {
  // Collect all bill types/numbers that need enrichment
  const billsToEnrich = votes
    .filter(v => v.bill && (!v.bill.title || v.bill.title === `${v.bill.type} ${v.bill.number}`))
    .map(v => ({ type: v.bill!.type.toLowerCase(), number: v.bill!.number }));

  if (billsToEnrich.length === 0) return votes;

  // Build a map of enriched titles
  const titleMap = new Map<string, string>();

  // Query our bills table for titles (batch lookup)
  for (const bill of billsToEnrich) {
    try {
      const billRecord = await db
        .prepare(`
          SELECT title FROM bills
          WHERE congress = ? AND bill_type = ? AND bill_number = ?
          LIMIT 1
        `)
        .bind(congress, bill.type, parseInt(bill.number, 10))
        .first() as any;

      if (billRecord?.title) {
        titleMap.set(`${bill.type}-${bill.number}`, billRecord.title);
      }
    } catch (e) {
      // Continue if lookup fails
    }
  }

  // Enrich votes with titles
  return votes.map(vote => {
    if (vote.bill) {
      const key = `${vote.bill.type.toLowerCase()}-${vote.bill.number}`;
      const enrichedTitle = titleMap.get(key);
      if (enrichedTitle) {
        return {
          ...vote,
          bill: {
            ...vote.bill,
            title: enrichedTitle
          }
        };
      }
    }
    return vote;
  });
}

/**
 * GET /members/:bioguide_id/voting-record
 * Get voting record for a House member
 * First checks cache, then falls back to Congress.gov API
 * Note: Senate voting records are NOT available via Congress.gov API
 */
app.get('/members/:bioguide_id/voting-record', async (c) => {
  try {
    const bioguideId = c.req.param('bioguide_id');
    const db = c.env.APP_DB;
    const congressApiClient = c.env.CONGRESS_API_CLIENT;

    // Query params
    const congress = parseInt(c.req.query('congress') || '119', 10);
    const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 250); // Increased default for better analytics
    const forceRefresh = c.req.query('refresh') === 'true';

    // Get member to check chamber
    const member = await db
      .prepare('SELECT bioguide_id, first_name, last_name, party, state, district FROM members WHERE bioguide_id = ?')
      .bind(bioguideId)
      .first() as any;

    if (!member) {
      return c.json({
        error: 'Member not found',
        message: `No member found with bioguide_id: ${bioguideId}`
      }, 404);
    }

    // Determine chamber (district = null means Senate)
    const chamber = member.district !== null ? 'House' : 'Senate';

    // Senate votes are not available via Congress.gov API
    if (chamber === 'Senate') {
      return c.json({
        success: true,
        member: {
          bioguideId: member.bioguide_id,
          fullName: `${member.first_name} ${member.last_name}`,
          party: member.party,
          state: member.state,
          chamber: 'Senate'
        },
        stats: {
          totalVotes: 0,
          yeaVotes: 0,
          nayVotes: 0,
          presentVotes: 0,
          notVotingCount: 0,
          partyAlignmentPercentage: null
        },
        votes: [],
        pagination: {
          total: 0,
          limit,
          hasMore: false
        },
        dataAvailability: {
          hasData: false,
          reason: 'senate_not_available',
          message: 'Senate voting records are not yet available through the Congress.gov API'
        }
      });
    }

    // Try to get cached votes first (unless force refresh)
    let cachedVotes: any[] = [];
    let cachedStats: any = null;
    let useCache = false;

    if (!forceRefresh) {
      try {
        // Check for cached stats
        cachedStats = await db
          .prepare(`
            SELECT * FROM member_voting_stats
            WHERE bioguide_id = ? AND congress = ?
          `)
          .bind(bioguideId, congress)
          .first() as any;

        // Get cached votes
        const cachedResult = await db
          .prepare(`
            SELECT * FROM member_votes
            WHERE bioguide_id = ? AND congress = ?
            ORDER BY vote_date DESC
            LIMIT ?
          `)
          .bind(bioguideId, congress, limit)
          .all();

        cachedVotes = cachedResult.results || [];

        // Use cache if we have reasonable data (at least 10 votes or stats exist)
        if (cachedVotes.length >= 10 || cachedStats) {
          useCache = true;
          console.log(`Using cached voting data for ${bioguideId}: ${cachedVotes.length} votes`);
        }
      } catch (e) {
        // Cache tables might not exist yet, continue to API
        console.log('Cache lookup failed, falling back to API:', e);
      }
    }

    // If we have good cached data, return it
    if (useCache && cachedVotes.length > 0) {
      const votes = cachedVotes.map((v: any) => ({
        id: v.id,
        rollCallNumber: v.roll_call_number,
        voteDate: v.vote_date,
        voteQuestion: v.vote_question,
        voteResult: v.vote_result,
        memberVote: v.member_vote,
        bill: v.bill_type ? {
          id: v.bill_id,
          type: v.bill_type,
          number: v.bill_number,
          title: v.bill_title || `${v.bill_type.toUpperCase()} ${v.bill_number}`
        } : null
      }));

      // Calculate stats from cached data if no cached stats
      let stats = cachedStats ? {
        totalVotes: cachedStats.total_votes,
        yeaVotes: cachedStats.yea_votes,
        nayVotes: cachedStats.nay_votes,
        presentVotes: cachedStats.present_votes,
        notVotingCount: cachedStats.not_voting_count,
        partyAlignmentPercentage: cachedStats.party_alignment_rate,
        participationRate: cachedStats.participation_rate,
        firstVoteDate: cachedStats.first_vote_date,
        lastVoteDate: cachedStats.last_vote_date
      } : null;

      if (!stats) {
        // Calculate from votes
        const yeaVotes = votes.filter((v: any) => ['yea', 'aye', 'yes'].includes(v.memberVote?.toLowerCase())).length;
        const nayVotes = votes.filter((v: any) => ['nay', 'no'].includes(v.memberVote?.toLowerCase())).length;
        const presentVotes = votes.filter((v: any) => v.memberVote?.toLowerCase() === 'present').length;
        const notVoting = votes.filter((v: any) => !['yea', 'aye', 'yes', 'nay', 'no', 'present'].includes(v.memberVote?.toLowerCase())).length;

        // Calculate date range from votes
        const voteDates = votes.map((v: any) => v.voteDate).filter(Boolean).sort();
        const firstVoteDate = voteDates.length > 0 ? voteDates[0] : null;
        const lastVoteDate = voteDates.length > 0 ? voteDates[voteDates.length - 1] : null;

        stats = {
          totalVotes: votes.length,
          yeaVotes,
          nayVotes,
          presentVotes,
          notVotingCount: notVoting,
          partyAlignmentPercentage: null,
          participationRate: votes.length > 0 ? Math.round(((votes.length - notVoting) / votes.length) * 100) : 0,
          firstVoteDate,
          lastVoteDate
        };
      }

      return c.json({
        success: true,
        member: {
          bioguideId: member.bioguide_id,
          fullName: `${member.first_name} ${member.last_name}`,
          party: member.party,
          state: member.state,
          chamber: 'House'
        },
        stats,
        votes,
        pagination: {
          total: cachedVotes.length,
          limit,
          hasMore: cachedVotes.length >= limit
        },
        dataAvailability: {
          hasData: true,
          cached: true,
          lastSynced: cachedStats?.last_synced_at
        }
      });
    }

    // Fetch from Congress.gov API
    console.log(`Fetching voting record for ${bioguideId} (${congress}th Congress) from API`);

    const votingData = await congressApiClient.getMemberHouseVotes(bioguideId, congress, limit);

    // Enrich votes with bill titles from our database
    const enrichedVotes = await enrichVotesWithBillTitles(db, votingData.votes, congress);

    // Calculate stats
    const totalVotesCast = votingData.stats.totalVotes;
    const missedVotes = votingData.stats.notVotingCount;
    const participationRate = totalVotesCast > 0
      ? Math.round(((totalVotesCast - missedVotes) / totalVotesCast) * 100)
      : 0;

    // Cache the votes asynchronously (don't wait for it)
    cacheVotesInBackground(db, bioguideId, congress, enrichedVotes, votingData.stats).catch(e => {
      console.error('Failed to cache votes:', e);
    });

    // Format response
    return c.json({
      success: true,
      member: {
        bioguideId: member.bioguide_id,
        fullName: `${member.first_name} ${member.last_name}`,
        party: member.party,
        state: member.state,
        chamber: 'House'
      },
      stats: {
        totalVotes: totalVotesCast,
        notVotingCount: missedVotes,
        participationRate,
        partyAlignmentPercentage: null,
        yeaVotes: votingData.stats.yeaVotes,
        nayVotes: votingData.stats.nayVotes,
        presentVotes: votingData.stats.presentVotes
      },
      votes: enrichedVotes.map(vote => ({
        id: `${congress}-${vote.rollCallNumber}`,
        rollCallNumber: vote.rollCallNumber,
        voteDate: vote.voteDate,
        voteQuestion: vote.voteQuestion,
        voteResult: vote.voteResult,
        memberVote: vote.memberVote,
        bill: vote.bill ? {
          id: `${congress}-${vote.bill.type.toLowerCase()}-${vote.bill.number}`,
          type: vote.bill.type,
          number: parseInt(vote.bill.number, 10) || 0,
          title: vote.bill.title || `${vote.bill.type.toUpperCase()} ${vote.bill.number}`
        } : null
      })),
      pagination: {
        total: enrichedVotes.length,
        limit,
        hasMore: enrichedVotes.length >= limit
      },
      dataAvailability: {
        hasData: enrichedVotes.length > 0,
        cached: false,
        reason: enrichedVotes.length === 0 ? 'no_votes_found' : undefined
      }
    });

  } catch (error: any) {
    console.error('Failed to get voting record:', error);
    return c.json({
      error: 'Failed to get voting record',
      message: error.message
    }, 500);
  }
});

/**
 * Background function to cache votes in the database
 */
async function cacheVotesInBackground(
  db: any,
  bioguideId: string,
  congress: number,
  votes: Array<any>,
  stats: { totalVotes: number; yeaVotes: number; nayVotes: number; presentVotes: number; notVotingCount: number }
) {
  try {
    // Insert votes
    for (const vote of votes) {
      const voteId = `${congress}-${vote.rollCallNumber}`;
      await db
        .prepare(`
          INSERT OR REPLACE INTO member_votes (
            id, bioguide_id, congress, roll_call_number, vote_date,
            vote_question, vote_result, member_vote,
            bill_type, bill_number, bill_title, chamber, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'House', datetime('now'))
        `)
        .bind(
          voteId,
          bioguideId,
          congress,
          vote.rollCallNumber,
          vote.voteDate,
          vote.voteQuestion,
          vote.voteResult,
          vote.memberVote,
          vote.bill?.type || null,
          vote.bill?.number ? parseInt(vote.bill.number, 10) : null,
          vote.bill?.title || null
        )
        .run();
    }

    // Calculate date range
    const dates = votes
      .map(v => v.voteDate)
      .filter(Boolean)
      .sort();
    const firstVoteDate = dates[0] || null;
    const lastVoteDate = dates[dates.length - 1] || null;

    // Calculate participation rate
    const participationRate = stats.totalVotes > 0
      ? ((stats.totalVotes - stats.notVotingCount) / stats.totalVotes) * 100
      : 0;

    // Insert/update stats
    const statsId = `${bioguideId}-${congress}`;
    await db
      .prepare(`
        INSERT OR REPLACE INTO member_voting_stats (
          id, bioguide_id, congress,
          total_votes, yea_votes, nay_votes, present_votes, not_voting_count,
          participation_rate, first_vote_date, last_vote_date,
          last_synced_at, votes_synced, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))
      `)
      .bind(
        statsId,
        bioguideId,
        congress,
        stats.totalVotes,
        stats.yeaVotes,
        stats.nayVotes,
        stats.presentVotes,
        stats.notVotingCount,
        participationRate,
        firstVoteDate,
        lastVoteDate,
        votes.length
      )
      .run();

    console.log(`Cached ${votes.length} votes for ${bioguideId} (Congress ${congress})`);
  } catch (error) {
    console.error('Error caching votes:', error);
    throw error;
  }
}

/**
 * POST /members/:bioguide_id/sync-votes
 * Manually trigger a vote sync for a specific member
 */
app.post('/members/:bioguide_id/sync-votes', async (c) => {
  try {
    const bioguideId = c.req.param('bioguide_id');
    const db = c.env.APP_DB;
    const congressApiClient = c.env.CONGRESS_API_CLIENT;

    const congress = parseInt(c.req.query('congress') || '119', 10);
    const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 250);

    // Get member to check chamber
    const member = await db
      .prepare('SELECT bioguide_id, first_name, last_name, party, district FROM members WHERE bioguide_id = ?')
      .bind(bioguideId)
      .first() as any;

    if (!member) {
      return c.json({ error: 'Member not found' }, 404);
    }

    if (member.district === null) {
      return c.json({ error: 'Senate votes not available' }, 400);
    }

    // Fetch and cache votes
    console.log(`Syncing votes for ${bioguideId} (${congress}th Congress)`);
    const votingData = await congressApiClient.getMemberHouseVotes(bioguideId, congress, limit);

    // Enrich with bill titles
    const enrichedVotes = await enrichVotesWithBillTitles(db, votingData.votes, congress);

    // Cache votes
    await cacheVotesInBackground(db, bioguideId, congress, enrichedVotes, votingData.stats);

    return c.json({
      success: true,
      message: `Synced ${enrichedVotes.length} votes for ${member.first_name} ${member.last_name}`,
      stats: votingData.stats
    });

  } catch (error: any) {
    console.error('Vote sync failed:', error);
    return c.json({ error: 'Vote sync failed', message: error.message }, 500);
  }
});

/**
 * GET /members/my-representatives
 * Get the current user's representatives (2 senators + 1 house rep)
 * Requires authentication
 */
app.get('/members/my-representatives', async (c) => {
  try {
    // Verify authentication
    const authHeader = c.req.header('Authorization');
    const user = await verifyAuth(authHeader);

    if (!user) {
      return c.json({
        error: 'Unauthorized',
        message: 'Valid authentication required'
      }, 401);
    }

    const db = c.env.APP_DB;

    // Get user's congressional district from users table
    const userRecord = await db
      .prepare('SELECT congressional_district, zip_code FROM users WHERE id = ?')
      .bind(user.userId)
      .first() as any;

    if (!userRecord || !userRecord.congressional_district) {
      return c.json({
        error: 'Location not set',
        message: 'Please update your ZIP code in settings to see your representatives'
      }, 400);
    }

    // Parse congressional_district (format: "WI-4" or "WI-04")
    const [state, districtStr] = userRecord.congressional_district.split('-');
    const district = districtStr; // Keep as string (can be "4" or "04")

    // Get senators (no district, from this state)
    const senatorsResult = await db
      .prepare(`
        SELECT
          bioguide_id,
          first_name,
          middle_name,
          last_name,
          party,
          state,
          district,
          image_url,
          current_member,
          current_term_type,
          current_term_start,
          current_term_end,
          phone_number,
          url,
          office_address
        FROM members
        WHERE state = ?
          AND district IS NULL
          AND current_member = 1
        ORDER BY last_name
      `)
      .bind(state)
      .all();

    // Get house representative (from this state + district)
    const houseResult = await db
      .prepare(`
        SELECT
          bioguide_id,
          first_name,
          middle_name,
          last_name,
          party,
          state,
          district,
          image_url,
          current_member,
          current_term_type,
          current_term_start,
          current_term_end,
          phone_number,
          url,
          office_address
        FROM members
        WHERE state = ?
          AND (district = ? OR district = ?)
          AND current_member = 1
        LIMIT 1
      `)
      .bind(state, district, district.padStart(2, '0')) // Try both "4" and "04"
      .first() as any;

    // Format members
    const formatMember = (m: any) => ({
      bioguideId: m.bioguide_id,
      firstName: m.first_name,
      middleName: m.middle_name,
      lastName: m.last_name,
      fullName: [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' '),
      party: m.party,
      state: m.state,
      district: m.district,
      chamber: m.district !== null ? 'House' : 'Senate',
      role: m.district !== null ? 'U.S. Representative' : 'U.S. Senator',
      imageUrl: m.image_url,
      currentMember: m.current_member === 1,
      phoneNumber: m.phone_number,
      url: m.url,
      officeAddress: m.office_address,
      currentTerm: m.current_term_type ? {
        type: m.current_term_type,
        start: m.current_term_start,
        end: m.current_term_end
      } : null
    });

    const senators = (senatorsResult.results || []).map(formatMember);
    const representative = houseResult ? formatMember(houseResult) : null;

    // Combine all representatives
    const allRepresentatives = [...senators];
    if (representative) {
      allRepresentatives.push(representative);
    }

    return c.json({
      success: true,
      location: {
        state,
        district,
        congressionalDistrict: userRecord.congressional_district,
        zipCode: userRecord.zip_code
      },
      representatives: allRepresentatives,
      count: {
        senators: senators.length,
        houseRep: representative ? 1 : 0,
        total: allRepresentatives.length
      }
    });

  } catch (error: any) {
    console.error('Failed to get my representatives:', error);
    return c.json({
      error: 'Failed to get representatives',
      message: error.message
    }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
