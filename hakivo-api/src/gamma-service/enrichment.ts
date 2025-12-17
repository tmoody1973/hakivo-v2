/**
 * Content Enrichment Service for Gamma Document Generation
 *
 * Enhances artifact content with additional context from various data sources
 * before generating professional documents via Gamma.
 *
 * Data Sources:
 * - CONGRESSIONAL_DB (SmartSQL): Bill details, sponsors, cosponsors
 * - APP_DB (SqlDatabase): Member voting records, user data
 * - PERPLEXITY_CLIENT: Recent news and context
 * - LEGISLATION_SEARCH (SmartBucket): Semantically related bills
 * - FEC_CLIENT: Campaign finance data
 */

import { SqlDatabase, SmartSql, SmartBucket, ServiceStub } from '@liquidmetal-ai/raindrop-framework';

// Import service types
import type PerplexityClient from '../perplexity-client';
import type FecClient from '../fec-client';
import type { CampaignFinanceSummary } from '../fec-client';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Options for content enrichment
 * Each option can be enabled/disabled independently
 */
export interface EnrichmentOptions {
  /** Include full bill details (text, sponsors, cosponsors) from CONGRESSIONAL_DB */
  includeBillDetails?: boolean;

  /** Include member voting patterns from APP_DB */
  includeVotingRecords?: boolean;

  /** Include recent news context from PERPLEXITY_CLIENT */
  includeNewsContext?: boolean;

  /** Include semantically related bills from LEGISLATION_SEARCH SmartBucket */
  includeRelatedBills?: boolean;

  /** Include campaign finance data from FEC_CLIENT */
  includeCampaignFinance?: boolean;

  /** Include district-specific analysis and impact */
  includeDistrictImpact?: boolean;

  /** Maximum number of related bills to include (default: 5) */
  relatedBillsLimit?: number;

  /** FEC election cycle for campaign finance (default: current cycle) */
  fecCycle?: number;
}

/**
 * Artifact content that can be enriched
 */
export interface ArtifactContent {
  /** Unique artifact identifier */
  id?: string;

  /** Artifact title */
  title: string;

  /** Main content/body of the artifact */
  content: string;

  /** Type of subject: 'bill', 'member', 'policy', 'general' */
  subjectType?: 'bill' | 'member' | 'policy' | 'general';

  /** Subject identifier (bill ID like 'hr-119-1234' or bioguide_id like 'P000197') */
  subjectId?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Bill details from the database
 */
export interface BillDetails {
  id: string;
  congress: number;
  billType: string;
  billNumber: number;
  title: string;
  summary?: string;
  introducedDate?: string;
  latestActionDate?: string;
  latestActionText?: string;
  policyArea?: string;
  status?: string;
  originChamber?: string;
  sponsor?: {
    bioguideId: string;
    firstName: string;
    lastName: string;
    party: string;
    state: string;
  };
  cosponsors?: Array<{
    bioguideId: string;
    firstName: string;
    lastName: string;
    party: string;
    state: string;
    dateJoined?: string;
  }>;
  committees?: string[];
  billText?: string;
}

/**
 * Member voting record
 */
export interface VotingRecord {
  bioguideId: string;
  memberName: string;
  party: string;
  recentVotes: Array<{
    billId: string;
    billTitle: string;
    vote: 'Yea' | 'Nay' | 'Present' | 'Not Voting';
    date: string;
  }>;
  votingStats?: {
    totalVotes: number;
    yeaPercent: number;
    nayPercent: number;
    partyLoyaltyPercent?: number;
  };
}

/**
 * News context from Perplexity
 */
export interface NewsContext {
  summary: string;
  keyPoints: string[];
  sources: Array<{ title: string; url: string }>;
  analysis?: string;
}

/**
 * Related bill from semantic search
 */
export interface RelatedBill {
  id: string;
  title: string;
  congress: number;
  billType: string;
  billNumber: number;
  relevanceScore: number;
  sponsor?: string;
  status?: string;
}

/**
 * District impact analysis
 */
export interface DistrictImpact {
  state: string;
  district?: string;
  population?: number;
  impactSummary: string;
  keyStatistics?: Array<{ label: string; value: string }>;
  relevantLocalNews?: string[];
}

/**
 * Fully enriched content ready for Gamma generation
 */
export interface EnrichedContent {
  /** Original artifact content */
  original: ArtifactContent;

  /** Bill details if available */
  billDetails?: BillDetails;

  /** Voting records if available */
  votingRecords?: VotingRecord[];

  /** News context if available */
  newsContext?: NewsContext;

  /** Related bills if available */
  relatedBills?: RelatedBill[];

  /** Campaign finance data if available */
  campaignFinance?: CampaignFinanceSummary;

  /** District impact if available */
  districtImpact?: DistrictImpact;

  /** Formatted text ready for Gamma input */
  enrichedText: string;

  /** Enrichment metadata */
  enrichmentMeta: {
    timestamp: string;
    optionsUsed: EnrichmentOptions;
    sourcesUsed: string[];
    errors?: Array<{ source: string; error: string }>;
  };
}

// =============================================================================
// Environment Type
// =============================================================================

export interface EnrichmentEnv {
  APP_DB: SqlDatabase;
  CONGRESSIONAL_DB: SmartSql;
  LEGISLATION_SEARCH: SmartBucket;
  PERPLEXITY_CLIENT: ServiceStub<PerplexityClient>;
  FEC_CLIENT: ServiceStub<FecClient>;
}

// =============================================================================
// Enrichment Functions
// =============================================================================

/**
 * Fetch bill details from the database
 */
async function fetchBillDetails(
  billId: string,
  db: SqlDatabase
): Promise<BillDetails | null> {
  console.log(`[Enrichment] Fetching bill details for: ${billId}`);

  try {
    // Parse bill ID (format: type-congress-number, e.g., 'hr-119-1234')
    const parts = billId.split('-');
    if (parts.length !== 3) {
      console.warn(`[Enrichment] Invalid bill ID format: ${billId}`);
      return null;
    }

    const billType = parts[0]!;
    const congressStr = parts[1]!;
    const numberStr = parts[2]!;
    const congress = parseInt(congressStr, 10);
    const billNumber = parseInt(numberStr, 10);

    // Fetch bill with sponsor info
    const billResult = await db.prepare(`
      SELECT b.*,
             m.first_name as sponsor_first_name,
             m.last_name as sponsor_last_name,
             m.party as sponsor_party,
             m.state as sponsor_state
      FROM bills b
      LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
      WHERE b.id = ?
    `).bind(billId).first();

    if (!billResult) {
      console.log(`[Enrichment] Bill not found: ${billId}`);
      return null;
    }

    const bill = billResult as Record<string, unknown>;

    // Fetch cosponsors
    const cosponsorsResult = await db.prepare(`
      SELECT bc.bioguide_id, bc.date_joined,
             m.first_name, m.last_name, m.party, m.state
      FROM bill_cosponsors bc
      LEFT JOIN members m ON bc.bioguide_id = m.bioguide_id
      WHERE bc.bill_id = ?
      ORDER BY bc.date_joined DESC
      LIMIT 50
    `).bind(billId).all();

    const cosponsors = (cosponsorsResult.results || []).map((c: Record<string, unknown>) => ({
      bioguideId: c.bioguide_id as string,
      firstName: c.first_name as string,
      lastName: c.last_name as string,
      party: c.party as string,
      state: c.state as string,
      dateJoined: c.date_joined as string,
    }));

    return {
      id: bill.id as string,
      congress,
      billType,
      billNumber,
      title: bill.title as string,
      summary: bill.summary as string | undefined,
      introducedDate: bill.introduced_date as string | undefined,
      latestActionDate: bill.latest_action_date as string | undefined,
      latestActionText: bill.latest_action_text as string | undefined,
      policyArea: bill.policy_area as string | undefined,
      status: bill.status as string | undefined,
      originChamber: bill.origin_chamber as string | undefined,
      sponsor: bill.sponsor_bioguide_id ? {
        bioguideId: bill.sponsor_bioguide_id as string,
        firstName: bill.sponsor_first_name as string,
        lastName: bill.sponsor_last_name as string,
        party: bill.sponsor_party as string,
        state: bill.sponsor_state as string,
      } : undefined,
      cosponsors: cosponsors.length > 0 ? cosponsors : undefined,
      billText: bill.full_text as string | undefined,
    };
  } catch (error) {
    console.error('[Enrichment] Error fetching bill details:', error);
    return null;
  }
}

/**
 * Fetch voting records for a member
 */
async function fetchVotingRecords(
  bioguideId: string,
  db: SqlDatabase,
  limit: number = 20
): Promise<VotingRecord | null> {
  console.log(`[Enrichment] Fetching voting records for: ${bioguideId}`);

  try {
    // Get member info
    const memberResult = await db.prepare(`
      SELECT bioguide_id, first_name, last_name, party
      FROM members
      WHERE bioguide_id = ?
    `).bind(bioguideId).first();

    if (!memberResult) {
      console.log(`[Enrichment] Member not found: ${bioguideId}`);
      return null;
    }

    const member = memberResult as Record<string, unknown>;

    // Get recent votes (if vote tracking exists in the database)
    // This depends on the schema - adjust as needed
    const votesResult = await db.prepare(`
      SELECT v.bill_id, v.vote, v.vote_date, b.title as bill_title
      FROM member_votes v
      LEFT JOIN bills b ON v.bill_id = b.id
      WHERE v.bioguide_id = ?
      ORDER BY v.vote_date DESC
      LIMIT ?
    `).bind(bioguideId, limit).all();

    const recentVotes = (votesResult.results || []).map((v: Record<string, unknown>) => ({
      billId: v.bill_id as string,
      billTitle: v.bill_title as string || 'Unknown Bill',
      vote: v.vote as 'Yea' | 'Nay' | 'Present' | 'Not Voting',
      date: v.vote_date as string,
    }));

    // Calculate voting stats
    const totalVotes = recentVotes.length;
    const yeaVotes = recentVotes.filter(v => v.vote === 'Yea').length;
    const nayVotes = recentVotes.filter(v => v.vote === 'Nay').length;

    return {
      bioguideId,
      memberName: `${member.first_name} ${member.last_name}`,
      party: member.party as string,
      recentVotes,
      votingStats: totalVotes > 0 ? {
        totalVotes,
        yeaPercent: Math.round((yeaVotes / totalVotes) * 100),
        nayPercent: Math.round((nayVotes / totalVotes) * 100),
      } : undefined,
    };
  } catch (error) {
    console.error('[Enrichment] Error fetching voting records:', error);
    return null;
  }
}

/**
 * Fetch news context from Perplexity
 */
async function fetchNewsContext(
  topic: string,
  perplexityClient: ServiceStub<PerplexityClient>
): Promise<NewsContext | null> {
  console.log(`[Enrichment] Fetching news context for: ${topic}`);

  try {
    const result = await perplexityClient.researchTopic(topic, true);

    return {
      summary: result.summary,
      keyPoints: result.keyPoints,
      sources: result.sources,
      analysis: result.analysis,
    };
  } catch (error) {
    console.error('[Enrichment] Error fetching news context:', error);
    return null;
  }
}

/**
 * Fetch related bills using semantic search
 */
async function fetchRelatedBills(
  query: string,
  legislationSearch: SmartBucket,
  db: SqlDatabase,
  limit: number = 5
): Promise<RelatedBill[]> {
  console.log(`[Enrichment] Searching for related bills: ${query.substring(0, 50)}...`);

  try {
    // Perform semantic search with SmartBucket
    const searchResults = await legislationSearch.search({
      input: query,
      requestId: `enrichment-related-${Date.now()}`
    });

    if (!searchResults.results || searchResults.results.length === 0) {
      console.log('[Enrichment] No related bills found');
      return [];
    }

    // Extract bill IDs from search results
    const billIds: string[] = [];
    const scoreMap = new Map<string, number>();

    for (const result of searchResults.results.slice(0, limit * 2)) {
      const source = result.source as string;
      if (source) {
        // Extract bill ID from source key (format varies, try common patterns)
        const match = source.match(/(hr|s|hjres|sjres|hconres|sconres|hres|sres)-\d+-\d+/i);
        if (match) {
          const billId = match[0].toLowerCase();
          if (!billIds.includes(billId)) {
            billIds.push(billId);
            scoreMap.set(billId, result.score as number || 0);
          }
        }
      }
    }

    if (billIds.length === 0) {
      return [];
    }

    // Fetch bill metadata from database
    const placeholders = billIds.map(() => '?').join(',');
    const billsResult = await db.prepare(`
      SELECT b.id, b.congress, b.bill_type, b.bill_number, b.title, b.status,
             m.first_name || ' ' || m.last_name as sponsor_name
      FROM bills b
      LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
      WHERE b.id IN (${placeholders})
    `).bind(...billIds).all();

    const relatedBills: RelatedBill[] = (billsResult.results || []).map((bill: Record<string, unknown>) => ({
      id: bill.id as string,
      title: bill.title as string,
      congress: bill.congress as number,
      billType: bill.bill_type as string,
      billNumber: bill.bill_number as number,
      relevanceScore: scoreMap.get(bill.id as string) || 0,
      sponsor: bill.sponsor_name as string | undefined,
      status: bill.status as string | undefined,
    }));

    // Sort by relevance and limit
    return relatedBills
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  } catch (error) {
    console.error('[Enrichment] Error fetching related bills:', error);
    return [];
  }
}

/**
 * Fetch campaign finance data
 */
async function fetchCampaignFinance(
  bioguideId: string,
  fecClient: ServiceStub<FecClient>,
  cycle?: number
): Promise<CampaignFinanceSummary | null> {
  console.log(`[Enrichment] Fetching campaign finance for: ${bioguideId}`);

  try {
    const currentYear = new Date().getFullYear();
    const electionCycle = cycle || (currentYear % 2 === 0 ? currentYear : currentYear + 1);

    const result = await fecClient.getMemberCampaignFinance(bioguideId, electionCycle);
    return result;
  } catch (error) {
    console.error('[Enrichment] Error fetching campaign finance:', error);
    return null;
  }
}

/**
 * Format enriched content as text for Gamma input
 */
function formatEnrichedText(
  original: ArtifactContent,
  billDetails?: BillDetails,
  votingRecords?: VotingRecord[],
  newsContext?: NewsContext,
  relatedBills?: RelatedBill[],
  campaignFinance?: CampaignFinanceSummary,
  districtImpact?: DistrictImpact
): string {
  const sections: string[] = [];

  // Original content
  sections.push(`# ${original.title}\n\n${original.content}`);

  // Bill details section
  if (billDetails) {
    let billSection = `\n\n## Bill Details\n`;
    billSection += `**${billDetails.billType.toUpperCase()} ${billDetails.billNumber}** - ${billDetails.congress}th Congress\n\n`;

    if (billDetails.summary) {
      billSection += `### Summary\n${billDetails.summary}\n\n`;
    }

    if (billDetails.sponsor) {
      billSection += `### Sponsor\n`;
      billSection += `${billDetails.sponsor.firstName} ${billDetails.sponsor.lastName} (${billDetails.sponsor.party}-${billDetails.sponsor.state})\n\n`;
    }

    if (billDetails.cosponsors && billDetails.cosponsors.length > 0) {
      billSection += `### Cosponsors (${billDetails.cosponsors.length})\n`;
      const topCosponsors = billDetails.cosponsors.slice(0, 10);
      billSection += topCosponsors.map(c =>
        `- ${c.firstName} ${c.lastName} (${c.party}-${c.state})`
      ).join('\n');
      if (billDetails.cosponsors.length > 10) {
        billSection += `\n- ... and ${billDetails.cosponsors.length - 10} more`;
      }
      billSection += '\n\n';
    }

    if (billDetails.latestActionText) {
      billSection += `### Latest Action\n${billDetails.latestActionText}`;
      if (billDetails.latestActionDate) {
        billSection += ` (${billDetails.latestActionDate})`;
      }
      billSection += '\n';
    }

    sections.push(billSection);
  }

  // News context section
  if (newsContext) {
    let newsSection = `\n\n## Recent News & Context\n\n`;
    newsSection += `${newsContext.summary}\n\n`;

    if (newsContext.keyPoints.length > 0) {
      newsSection += `### Key Points\n`;
      newsSection += newsContext.keyPoints.map(p => `- ${p}`).join('\n');
      newsSection += '\n\n';
    }

    if (newsContext.analysis) {
      newsSection += `### Analysis\n${newsContext.analysis}\n`;
    }

    sections.push(newsSection);
  }

  // Related bills section
  if (relatedBills && relatedBills.length > 0) {
    let relatedSection = `\n\n## Related Legislation\n\n`;
    relatedSection += relatedBills.map(bill =>
      `- **${bill.billType.toUpperCase()} ${bill.billNumber}**: ${bill.title}${bill.sponsor ? ` (Sponsor: ${bill.sponsor})` : ''}`
    ).join('\n');
    sections.push(relatedSection);
  }

  // Campaign finance section
  if (campaignFinance) {
    let financeSection = `\n\n## Campaign Finance (${campaignFinance.cycle} Cycle)\n\n`;
    financeSection += `- **Total Raised**: $${formatMoney(campaignFinance.totalRaised)}\n`;
    financeSection += `- **Total Spent**: $${formatMoney(campaignFinance.totalSpent)}\n`;
    financeSection += `- **Cash on Hand**: $${formatMoney(campaignFinance.cashOnHand)}\n`;
    financeSection += `- **Individual Contributions**: $${formatMoney(campaignFinance.individualContributions)}\n`;
    financeSection += `- **PAC Contributions**: $${formatMoney(campaignFinance.pacContributions)}\n`;

    if (campaignFinance.topContributorsByEmployer && campaignFinance.topContributorsByEmployer.length > 0) {
      financeSection += `\n### Top Contributing Organizations\n`;
      financeSection += campaignFinance.topContributorsByEmployer.slice(0, 5).map(c =>
        `- ${c.employer}: $${formatMoney(c.total)}`
      ).join('\n');
    }

    sections.push(financeSection);
  }

  // Voting records section
  if (votingRecords && votingRecords.length > 0) {
    let votingSection = `\n\n## Voting Records\n\n`;
    for (const record of votingRecords) {
      votingSection += `### ${record.memberName} (${record.party})\n`;
      if (record.votingStats) {
        votingSection += `Voting Pattern: ${record.votingStats.yeaPercent}% Yea, ${record.votingStats.nayPercent}% Nay (${record.votingStats.totalVotes} votes)\n`;
      }
      if (record.recentVotes.length > 0) {
        votingSection += `\nRecent Votes:\n`;
        votingSection += record.recentVotes.slice(0, 5).map(v =>
          `- ${v.vote} on ${v.billTitle} (${v.date})`
        ).join('\n');
      }
      votingSection += '\n';
    }
    sections.push(votingSection);
  }

  // District impact section
  if (districtImpact) {
    let impactSection = `\n\n## District Impact: ${districtImpact.state}`;
    if (districtImpact.district) {
      impactSection += ` District ${districtImpact.district}`;
    }
    impactSection += `\n\n${districtImpact.impactSummary}\n`;

    if (districtImpact.keyStatistics && districtImpact.keyStatistics.length > 0) {
      impactSection += `\n### Key Statistics\n`;
      impactSection += districtImpact.keyStatistics.map(s =>
        `- ${s.label}: ${s.value}`
      ).join('\n');
    }

    sections.push(impactSection);
  }

  return sections.join('\n');
}

/**
 * Format money amount with commas
 */
function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// =============================================================================
// Main Enrichment Function
// =============================================================================

/**
 * Enrich artifact content with additional context from multiple data sources
 *
 * Fetches data in parallel for performance, gracefully handles errors
 * for individual sources without failing the entire enrichment.
 *
 * @param artifact - The artifact content to enrich
 * @param options - Enrichment options specifying which data to include
 * @param env - Environment bindings with service clients
 * @returns Enriched content ready for Gamma generation
 *
 * @example
 * ```typescript
 * const enriched = await enrichContent(
 *   { title: 'H.R. 1234 Analysis', content: '...', subjectType: 'bill', subjectId: 'hr-119-1234' },
 *   { includeBillDetails: true, includeNewsContext: true, includeRelatedBills: true },
 *   env
 * );
 * ```
 */
export async function enrichContent(
  artifact: ArtifactContent,
  options: EnrichmentOptions,
  env: EnrichmentEnv
): Promise<EnrichedContent> {
  console.log(`[Enrichment] Starting enrichment for: ${artifact.title}`);
  console.log(`[Enrichment] Options:`, JSON.stringify(options));

  const startTime = Date.now();
  const sourcesUsed: string[] = [];
  const errors: Array<{ source: string; error: string }> = [];

  // Initialize result containers
  let billDetails: BillDetails | undefined;
  let votingRecords: VotingRecord[] = [];
  let newsContext: NewsContext | undefined;
  let relatedBills: RelatedBill[] = [];
  let campaignFinance: CampaignFinanceSummary | undefined;
  let districtImpact: DistrictImpact | undefined;

  // Build parallel fetch promises based on options
  const promises: Promise<void>[] = [];

  // Bill details
  if (options.includeBillDetails && artifact.subjectType === 'bill' && artifact.subjectId) {
    promises.push(
      fetchBillDetails(artifact.subjectId, env.APP_DB)
        .then(result => {
          if (result) {
            billDetails = result;
            sourcesUsed.push('CONGRESSIONAL_DB');
          }
        })
        .catch(err => {
          errors.push({ source: 'billDetails', error: err.message });
        })
    );
  }

  // Voting records for member subjects
  if (options.includeVotingRecords && artifact.subjectType === 'member' && artifact.subjectId) {
    promises.push(
      fetchVotingRecords(artifact.subjectId, env.APP_DB)
        .then(result => {
          if (result) {
            votingRecords = [result];
            sourcesUsed.push('APP_DB_VOTES');
          }
        })
        .catch(err => {
          errors.push({ source: 'votingRecords', error: err.message });
        })
    );
  }

  // News context
  if (options.includeNewsContext) {
    const newsQuery = artifact.subjectType === 'bill'
      ? `${artifact.title} legislation policy impact`
      : artifact.title;

    promises.push(
      fetchNewsContext(newsQuery, env.PERPLEXITY_CLIENT)
        .then(result => {
          if (result) {
            newsContext = result;
            sourcesUsed.push('PERPLEXITY_CLIENT');
          }
        })
        .catch(err => {
          errors.push({ source: 'newsContext', error: err.message });
        })
    );
  }

  // Related bills
  if (options.includeRelatedBills) {
    const searchQuery = artifact.content.substring(0, 500); // Use first 500 chars as search query
    const limit = options.relatedBillsLimit || 5;

    promises.push(
      fetchRelatedBills(searchQuery, env.LEGISLATION_SEARCH, env.APP_DB, limit)
        .then(result => {
          if (result.length > 0) {
            relatedBills = result;
            sourcesUsed.push('LEGISLATION_SEARCH');
          }
        })
        .catch(err => {
          errors.push({ source: 'relatedBills', error: err.message });
        })
    );
  }

  // Campaign finance for member subjects
  if (options.includeCampaignFinance && artifact.subjectType === 'member' && artifact.subjectId) {
    promises.push(
      fetchCampaignFinance(artifact.subjectId, env.FEC_CLIENT, options.fecCycle)
        .then(result => {
          if (result) {
            campaignFinance = result;
            sourcesUsed.push('FEC_CLIENT');
          }
        })
        .catch(err => {
          errors.push({ source: 'campaignFinance', error: err.message });
        })
    );
  }

  // Campaign finance for bill sponsor
  if (options.includeCampaignFinance && artifact.subjectType === 'bill' && billDetails?.sponsor?.bioguideId) {
    // Note: This runs after billDetails is fetched, so we need sequential execution
    // For now, we'll skip this and let users explicitly request member enrichment
  }

  // Wait for all parallel fetches to complete
  await Promise.all(promises);

  // Format the enriched text
  const enrichedText = formatEnrichedText(
    artifact,
    billDetails,
    votingRecords,
    newsContext,
    relatedBills,
    campaignFinance,
    districtImpact
  );

  const duration = Date.now() - startTime;
  console.log(`[Enrichment] Completed in ${duration}ms. Sources: ${sourcesUsed.join(', ')}`);

  if (errors.length > 0) {
    console.warn(`[Enrichment] Errors during enrichment:`, errors);
  }

  return {
    original: artifact,
    billDetails,
    votingRecords: votingRecords.length > 0 ? votingRecords : undefined,
    newsContext,
    relatedBills: relatedBills.length > 0 ? relatedBills : undefined,
    campaignFinance,
    districtImpact,
    enrichedText,
    enrichmentMeta: {
      timestamp: new Date().toISOString(),
      optionsUsed: options,
      sourcesUsed,
      errors: errors.length > 0 ? errors : undefined,
    },
  };
}

/**
 * Quick enrichment with default options for common use cases
 */
export async function quickEnrich(
  artifact: ArtifactContent,
  env: EnrichmentEnv
): Promise<EnrichedContent> {
  // Determine default options based on subject type
  const defaultOptions: EnrichmentOptions = {
    includeBillDetails: artifact.subjectType === 'bill',
    includeVotingRecords: artifact.subjectType === 'member',
    includeNewsContext: true, // Always include news for context
    includeRelatedBills: artifact.subjectType === 'bill' || artifact.subjectType === 'policy',
    includeCampaignFinance: artifact.subjectType === 'member',
    relatedBillsLimit: 5,
  };

  return enrichContent(artifact, defaultOptions, env);
}
