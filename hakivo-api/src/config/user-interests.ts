/**
 * User Interest Mapping Configuration
 *
 * Maps user-friendly interest categories to Congressional policy areas and keywords
 * for personalized bill filtering and content recommendations.
 */

export interface InterestMapping {
  interest: string;
  policy_areas: string[];
  keywords: string[];
}

export const USER_INTERESTS: InterestMapping[] = [
  {
    interest: "Environment & Energy",
    policy_areas: [
      "Environmental Protection",
      "Energy",
      "Water Resources Development",
      "Public Lands and Natural Resources"
    ],
    keywords: [
      "climate",
      "pollution",
      "renewables",
      "conservation",
      "clean water",
      "natural resources",
      "sustainability",
      "energy policy",
      "greenhouse gases"
    ]
  },
  {
    interest: "Health & Social Welfare",
    policy_areas: ["Health", "Social Welfare", "Families"],
    keywords: [
      "healthcare",
      "insurance",
      "public health",
      "welfare",
      "Medicaid",
      "mental health",
      "family services"
    ]
  },
  {
    interest: "Economy & Finance",
    policy_areas: [
      "Economics and Public Finance",
      "Finance and Financial Sector",
      "Taxation"
    ],
    keywords: [
      "budget",
      "inflation",
      "taxes",
      "financial institutions",
      "economic development",
      "public spending"
    ]
  },
  {
    interest: "Education & Science",
    policy_areas: ["Education", "Science, Technology, Communications"],
    keywords: [
      "schools",
      "universities",
      "academic",
      "research",
      "STEM",
      "innovation",
      "communications",
      "technology"
    ]
  },
  {
    interest: "Civil Rights & Law",
    policy_areas: [
      "Civil Rights and Liberties, Minority Issues",
      "Law",
      "Crime and Law Enforcement"
    ],
    keywords: [
      "equality",
      "justice",
      "discrimination",
      "legal rights",
      "law enforcement",
      "civil liberties",
      "minority rights"
    ]
  },
  {
    interest: "Commerce & Labor",
    policy_areas: ["Commerce", "Labor and Employment"],
    keywords: [
      "business",
      "jobs",
      "workforce",
      "employment",
      "workplace rights",
      "trade"
    ]
  },
  {
    interest: "Government & Politics",
    policy_areas: ["Government Operations and Politics", "Congress"],
    keywords: [
      "elections",
      "governance",
      "legislation",
      "public administration",
      "civic",
      "representatives"
    ]
  },
  {
    interest: "Foreign Policy & Defense",
    policy_areas: [
      "International Affairs",
      "Armed Forces and National Security",
      "Foreign Trade and International Finance"
    ],
    keywords: [
      "military",
      "defense",
      "trade agreements",
      "foreign aid",
      "diplomacy",
      "national security"
    ]
  },
  {
    interest: "Housing & Urban Development",
    policy_areas: [
      "Housing and Community Development",
      "Transportation and Public Works"
    ],
    keywords: [
      "housing",
      "affordable housing",
      "rent",
      "mortgage",
      "homelessness",
      "housing crisis",
      "HUD",
      "eviction",
      "urban planning",
      "infrastructure",
      "transportation",
      "public transit",
      "community development"
    ]
  },
  {
    interest: "Agriculture & Food",
    policy_areas: ["Agriculture and Food", "Animals"],
    keywords: [
      "farming",
      "food security",
      "rural",
      "livestock",
      "animal welfare",
      "agricultural policy"
    ]
  },
  {
    interest: "Sports, Arts & Culture",
    policy_areas: ["Sports and Recreation", "Arts, Culture, Religion"],
    keywords: [
      "sports",
      "arts",
      "culture",
      "recreation",
      "heritage",
      "religion",
      "community events"
    ]
  },
  {
    interest: "Immigration & Indigenous Issues",
    policy_areas: ["Immigration", "Native Americans"],
    keywords: [
      "immigration",
      "border",
      "citizenship",
      "indigenous",
      "tribal affairs",
      "native rights"
    ]
  }
];

/**
 * Get all interest category names
 */
export function getInterestNames(): string[] {
  return USER_INTERESTS.map((i) => i.interest);
}

/**
 * Get policy areas for a given interest
 */
export function getPolicyAreasForInterest(interest: string): string[] {
  const mapping = USER_INTERESTS.find((i) => i.interest === interest);
  return mapping?.policy_areas || [];
}

/**
 * Get keywords for a given interest
 */
export function getKeywordsForInterest(interest: string): string[] {
  const mapping = USER_INTERESTS.find((i) => i.interest === interest);
  return mapping?.keywords || [];
}

/**
 * Get combined policy areas for multiple interests
 */
export function getPolicyAreasForInterests(interests: string[]): string[] {
  const areas = new Set<string>();
  for (const interest of interests) {
    const policyAreas = getPolicyAreasForInterest(interest);
    policyAreas.forEach((area) => areas.add(area));
  }
  return Array.from(areas);
}

/**
 * Get combined keywords for multiple interests
 */
export function getKeywordsForInterests(interests: string[]): string[] {
  const keywords = new Set<string>();
  for (const interest of interests) {
    const interestKeywords = getKeywordsForInterest(interest);
    interestKeywords.forEach((kw) => keywords.add(kw));
  }
  return Array.from(keywords);
}

/**
 * Build SQL WHERE clause for filtering bills by interests
 *
 * @param interests Array of user interest names
 * @param useKeywords Whether to include keyword matching (default: false)
 * @returns SQL WHERE clause fragment
 */
export function buildBillFilterQuery(
  interests: string[],
  useKeywords: boolean = false
): string {
  if (interests.length === 0) {
    return "";
  }

  const policyAreas = getPolicyAreasForInterests(interests);

  // Build policy area filter
  const policyAreaConditions = policyAreas
    .map((area) => `policy_area = '${area.replace(/'/g, "''")}'`)
    .join(" OR ");

  if (!useKeywords) {
    return `(${policyAreaConditions})`;
  }

  // Build keyword filter
  const keywords = getKeywordsForInterests(interests);
  const keywordConditions = keywords
    .map(
      (kw) =>
        `(title LIKE '%${kw.replace(/'/g, "''")}%' OR latest_action_text LIKE '%${kw.replace(/'/g, "''")}%')`
    )
    .join(" OR ");

  return `((${policyAreaConditions}) OR (${keywordConditions}))`;
}
