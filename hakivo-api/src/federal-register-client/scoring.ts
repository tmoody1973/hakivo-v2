/**
 * Federal Register Document Relevance Scoring
 *
 * Scores documents based on:
 * 1. Keyword matches to user's policy interests
 * 2. Agency follows
 * 3. Document significance and type
 * 4. Comment opportunity urgency
 */

import type { FederalRegisterDocument } from './index';

/**
 * User profile for relevance scoring
 */
export interface UserRelevanceProfile {
  /** User's policy interests (e.g., ['climate', 'healthcare', 'economy']) */
  policyInterests: string[];
  /** Agency IDs the user follows */
  followedAgencyIds: number[];
  /** Agency slugs the user follows (for matching) */
  followedAgencySlugs: string[];
  /** Optional: user's state for geographic relevance */
  state?: string;
}

/**
 * Scoring result with breakdown
 */
export interface RelevanceScore {
  /** Total relevance score (0-100) */
  total: number;
  /** Keyword match score contribution */
  keywordScore: number;
  /** Agency match score contribution */
  agencyScore: number;
  /** Document type/significance score contribution */
  typeScore: number;
  /** Urgency score (comment deadlines, etc.) */
  urgencyScore: number;
  /** Matched keywords */
  matchedKeywords: string[];
  /** Matched agencies */
  matchedAgencies: string[];
  /** Brief explanation of why document is relevant */
  reason: string;
}

/**
 * Scoring weights (configurable)
 */
export interface ScoringWeights {
  keyword: number;
  agency: number;
  type: number;
  urgency: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  keyword: 0.40,  // 40% - keyword/topic relevance
  agency: 0.30,   // 30% - agency follows
  type: 0.15,     // 15% - document type/significance
  urgency: 0.15   // 15% - urgency (comment deadlines)
};

/**
 * Policy interest keyword mappings
 * Maps broad interests to specific search terms
 */
export const POLICY_KEYWORD_MAPPINGS: Record<string, string[]> = {
  // Environment & Energy
  'climate': ['climate', 'climate change', 'greenhouse', 'emissions', 'carbon', 'global warming', 'clean air', 'environmental protection'],
  'environment': ['environmental', 'pollution', 'clean water', 'conservation', 'endangered species', 'wildlife', 'ecosystem'],
  'energy': ['energy', 'renewable', 'solar', 'wind', 'oil', 'gas', 'nuclear', 'electricity', 'grid', 'power plant'],
  'clean energy': ['renewable energy', 'solar power', 'wind power', 'electric vehicles', 'ev', 'clean energy', 'green energy'],

  // Healthcare
  'healthcare': ['health', 'healthcare', 'medicare', 'medicaid', 'hospital', 'medical', 'pharmaceutical', 'drug', 'patient'],
  'public health': ['public health', 'pandemic', 'disease', 'vaccination', 'cdc', 'health emergency', 'epidemic'],
  'mental health': ['mental health', 'behavioral health', 'substance abuse', 'opioid', 'addiction', 'therapy'],

  // Economy & Finance
  'economy': ['economic', 'economy', 'inflation', 'recession', 'gdp', 'fiscal', 'monetary policy', 'federal reserve'],
  'trade': ['trade', 'tariff', 'import', 'export', 'commerce', 'international trade', 'trade agreement'],
  'banking': ['banking', 'bank', 'financial institution', 'credit', 'loan', 'mortgage', 'fdic', 'sec'],
  'taxes': ['tax', 'taxation', 'irs', 'income tax', 'corporate tax', 'tax credit', 'tax deduction'],
  'small business': ['small business', 'sba', 'entrepreneur', 'startup', 'business loan'],

  // Immigration
  'immigration': ['immigration', 'immigrant', 'visa', 'citizenship', 'naturalization', 'asylum', 'refugee', 'border', 'daca', 'uscis'],

  // Education
  'education': ['education', 'school', 'college', 'university', 'student', 'teacher', 'curriculum', 'title ix'],
  'higher education': ['higher education', 'college', 'university', 'student loan', 'pell grant', 'financial aid', 'accreditation'],

  // Technology
  'technology': ['technology', 'tech', 'digital', 'internet', 'broadband', 'telecommunications'],
  'artificial intelligence': ['artificial intelligence', 'ai', 'machine learning', 'algorithm', 'automation', 'robotics'],
  'cybersecurity': ['cybersecurity', 'cyber', 'data breach', 'hacking', 'data security', 'privacy'],
  'privacy': ['privacy', 'data protection', 'personal information', 'gdpr', 'ccpa', 'data collection'],

  // Defense & Security
  'defense': ['defense', 'military', 'armed forces', 'army', 'navy', 'air force', 'marine', 'pentagon', 'dod'],
  'national security': ['national security', 'homeland security', 'terrorism', 'counterterrorism', 'intelligence'],
  'veterans': ['veteran', 'va', 'veterans affairs', 'military service', 'gi bill'],

  // Housing & Urban
  'housing': ['housing', 'rent', 'rental', 'mortgage', 'affordable housing', 'hud', 'homelessness', 'eviction'],
  'infrastructure': ['infrastructure', 'transportation', 'highway', 'bridge', 'road', 'transit', 'rail', 'airport'],

  // Labor & Employment
  'labor': ['labor', 'worker', 'employment', 'wage', 'minimum wage', 'workplace', 'osha', 'union', 'collective bargaining'],
  'workplace safety': ['workplace safety', 'osha', 'occupational safety', 'worker protection', 'hazardous'],

  // Agriculture & Food
  'agriculture': ['agriculture', 'farm', 'farmer', 'usda', 'crop', 'livestock', 'agricultural'],
  'food safety': ['food safety', 'fda', 'food', 'nutrition', 'dietary', 'food labeling'],

  // Civil Rights & Justice
  'civil rights': ['civil rights', 'discrimination', 'equality', 'voting rights', 'civil liberties', 'hate crime'],
  'criminal justice': ['criminal justice', 'prison', 'incarceration', 'sentencing', 'policing', 'law enforcement'],
  'voting': ['voting', 'election', 'ballot', 'voter', 'campaign finance', 'electoral'],

  // Social Programs
  'social security': ['social security', 'ssa', 'retirement', 'disability', 'ssi'],
  'welfare': ['welfare', 'snap', 'food stamps', 'tanf', 'poverty', 'assistance program']
};

/**
 * Document type scores (relative importance)
 */
const DOCUMENT_TYPE_SCORES: Record<string, number> = {
  'RULE': 80,      // Final rules - high impact
  'PRORULE': 70,   // Proposed rules - high engagement opportunity
  'PRESDOCU': 90,  // Presidential documents - very significant
  'NOTICE': 40     // Notices - lower impact
};

/**
 * Score a single document against user's relevance profile
 */
export function scoreDocument(
  doc: FederalRegisterDocument,
  profile: UserRelevanceProfile,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): RelevanceScore {
  const matchedKeywords: string[] = [];
  const matchedAgencies: string[] = [];
  const reasons: string[] = [];

  // 1. Keyword Score (0-100)
  let keywordScore = 0;
  const searchableText = [
    doc.title,
    doc.abstract || '',
    doc.action || '',
    ...(doc.topics || []),
    ...(doc.agency_names || [])
  ].join(' ').toLowerCase();

  for (const interest of profile.policyInterests) {
    const keywords = POLICY_KEYWORD_MAPPINGS[interest.toLowerCase()] || [interest.toLowerCase()];

    for (const keyword of keywords) {
      if (searchableText.includes(keyword.toLowerCase())) {
        keywordScore += 20; // Each match adds 20 points
        if (!matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
      }
    }
  }
  keywordScore = Math.min(100, keywordScore); // Cap at 100

  if (matchedKeywords.length > 0) {
    reasons.push(`Matches interests: ${matchedKeywords.slice(0, 3).join(', ')}`);
  }

  // 2. Agency Score (0-100)
  let agencyScore = 0;
  for (const agency of doc.agencies || []) {
    if (profile.followedAgencyIds.includes(agency.id)) {
      agencyScore = 100;
      matchedAgencies.push(agency.name);
      break;
    }
    if (profile.followedAgencySlugs.includes(agency.slug)) {
      agencyScore = 100;
      matchedAgencies.push(agency.name);
      break;
    }
  }

  // Partial match on parent agencies
  if (agencyScore === 0) {
    for (const agency of doc.agencies || []) {
      if (agency.parent_id && profile.followedAgencyIds.includes(agency.parent_id)) {
        agencyScore = 50; // Partial score for child agency
        matchedAgencies.push(`${agency.name} (related)`);
        break;
      }
    }
  }

  if (matchedAgencies.length > 0) {
    reasons.push(`From followed agency: ${matchedAgencies[0]}`);
  }

  // 3. Type Score (0-100)
  const typeScore = DOCUMENT_TYPE_SCORES[doc.type] || 30;

  // Bonus for significant regulatory actions
  let significanceBonus = 0;
  if (doc.significant) {
    significanceBonus = 20;
    reasons.push('Significant regulatory action');
  }

  // 4. Urgency Score (0-100)
  let urgencyScore = 0;

  // Comment period urgency
  if (doc.comments_close_on) {
    const closeDate = new Date(doc.comments_close_on);
    const now = new Date();
    const daysUntilClose = Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilClose > 0 && daysUntilClose <= 7) {
      urgencyScore = 100; // Closing within a week
      reasons.push(`Comment period closes in ${daysUntilClose} days`);
    } else if (daysUntilClose > 7 && daysUntilClose <= 30) {
      urgencyScore = 60;
      reasons.push(`Comment period closes in ${daysUntilClose} days`);
    } else if (daysUntilClose > 30) {
      urgencyScore = 30;
    }
  }

  // Recent publication bonus
  if (doc.publication_date) {
    const pubDate = new Date(doc.publication_date);
    const now = new Date();
    const daysSincePublication = Math.ceil((now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSincePublication <= 1) {
      urgencyScore = Math.max(urgencyScore, 80);
      if (!reasons.some(r => r.includes('Comment period'))) {
        reasons.push('Published today');
      }
    } else if (daysSincePublication <= 7) {
      urgencyScore = Math.max(urgencyScore, 50);
    }
  }

  // Calculate weighted total
  const weightedKeyword = keywordScore * weights.keyword;
  const weightedAgency = agencyScore * weights.agency;
  const weightedType = (typeScore + significanceBonus) * weights.type;
  const weightedUrgency = urgencyScore * weights.urgency;

  const total = Math.min(100, Math.round(
    weightedKeyword + weightedAgency + weightedType + weightedUrgency
  ));

  // Generate reason string
  const reason = reasons.length > 0
    ? reasons.join('; ')
    : 'General interest based on document type';

  return {
    total,
    keywordScore: Math.round(keywordScore),
    agencyScore: Math.round(agencyScore),
    typeScore: Math.round(typeScore + significanceBonus),
    urgencyScore: Math.round(urgencyScore),
    matchedKeywords,
    matchedAgencies,
    reason
  };
}

/**
 * Score and rank multiple documents
 */
export function scoreAndRankDocuments(
  docs: FederalRegisterDocument[],
  profile: UserRelevanceProfile,
  options: {
    weights?: ScoringWeights;
    minScore?: number;
    limit?: number;
  } = {}
): Array<{ document: FederalRegisterDocument; score: RelevanceScore }> {
  const weights = options.weights || DEFAULT_WEIGHTS;
  const minScore = options.minScore ?? 0;
  const limit = options.limit;

  // Score all documents
  const scored = docs.map(doc => ({
    document: doc,
    score: scoreDocument(doc, profile, weights)
  }));

  // Filter by minimum score
  const filtered = scored.filter(item => item.score.total >= minScore);

  // Sort by total score (descending)
  filtered.sort((a, b) => b.score.total - a.score.total);

  // Apply limit if specified
  if (limit && limit > 0) {
    return filtered.slice(0, limit);
  }

  return filtered;
}

/**
 * Get top keywords from a set of documents
 * Useful for suggesting interests to users
 */
export function extractTopKeywords(
  docs: FederalRegisterDocument[],
  limit: number = 10
): Array<{ keyword: string; count: number }> {
  const keywordCounts: Record<string, number> = {};

  for (const doc of docs) {
    const text = [
      doc.title,
      doc.abstract || '',
      ...(doc.topics || [])
    ].join(' ').toLowerCase();

    // Check all known policy keywords
    for (const [interest, keywords] of Object.entries(POLICY_KEYWORD_MAPPINGS)) {
      for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
          keywordCounts[interest] = (keywordCounts[interest] || 0) + 1;
          break; // Only count each interest once per document
        }
      }
    }
  }

  // Sort by count
  const sorted = Object.entries(keywordCounts)
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count);

  return sorted.slice(0, limit);
}

/**
 * Calculate relevance between user's existing interests and a new document
 * Returns a simple 0-1 relevance score
 */
export function calculateQuickRelevance(
  doc: FederalRegisterDocument,
  policyInterests: string[]
): number {
  if (policyInterests.length === 0) return 0;

  const searchableText = [
    doc.title,
    doc.abstract || '',
    ...(doc.topics || []),
    ...(doc.agency_names || [])
  ].join(' ').toLowerCase();

  let matches = 0;

  for (const interest of policyInterests) {
    const keywords = POLICY_KEYWORD_MAPPINGS[interest.toLowerCase()] || [interest.toLowerCase()];

    for (const keyword of keywords) {
      if (searchableText.includes(keyword.toLowerCase())) {
        matches++;
        break; // Only count one match per interest
      }
    }
  }

  return Math.min(1, matches / Math.min(3, policyInterests.length));
}

/**
 * Get suggested agencies based on user's policy interests
 */
export const INTEREST_TO_AGENCY_MAPPINGS: Record<string, string[]> = {
  'climate': ['environmental-protection-agency', 'energy-department', 'interior-department'],
  'environment': ['environmental-protection-agency', 'interior-department', 'agriculture-department'],
  'energy': ['energy-department', 'federal-energy-regulatory-commission', 'nuclear-regulatory-commission'],
  'healthcare': ['health-and-human-services-department', 'food-and-drug-administration', 'centers-for-medicare-medicaid-services'],
  'economy': ['treasury-department', 'federal-reserve-system', 'commerce-department'],
  'trade': ['commerce-department', 'international-trade-commission', 'trade-representative-office-of-united-states'],
  'banking': ['federal-reserve-system', 'fdic', 'consumer-financial-protection-bureau', 'securities-and-exchange-commission'],
  'immigration': ['homeland-security-department', 'citizenship-and-immigration-services', 'customs-and-border-protection'],
  'education': ['education-department'],
  'technology': ['commerce-department', 'federal-communications-commission', 'federal-trade-commission'],
  'defense': ['defense-department', 'army-department', 'navy-department', 'air-force-department'],
  'national security': ['homeland-security-department', 'defense-department', 'national-security-agency'],
  'housing': ['housing-and-urban-development-department'],
  'labor': ['labor-department', 'occupational-safety-and-health-administration', 'national-labor-relations-board'],
  'agriculture': ['agriculture-department'],
  'food safety': ['food-and-drug-administration', 'agriculture-department'],
  'civil rights': ['justice-department', 'equal-employment-opportunity-commission'],
  'veterans': ['veterans-affairs-department']
};

/**
 * Get suggested agency slugs based on policy interests
 */
export function getSuggestedAgencies(policyInterests: string[]): string[] {
  const agencies = new Set<string>();

  for (const interest of policyInterests) {
    const mappedAgencies = INTEREST_TO_AGENCY_MAPPINGS[interest.toLowerCase()] || [];
    for (const agency of mappedAgencies) {
      agencies.add(agency);
    }
  }

  return Array.from(agencies);
}
