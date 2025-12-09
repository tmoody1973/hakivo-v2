/**
 * C1 Templates for Hakivo Tool Results
 *
 * These templates generate C1 DSL JSON that can be rendered directly
 * by the C1Component on the frontend. Each template corresponds to
 * a tool result type.
 *
 * C1 Components used:
 * - List: Container for multiple items
 * - MiniCard: Compact card with title, subtitle, tags
 * - MiniCardBlock: Collection of related mini cards
 * - DataTile: Key-value stat display
 * - StatBlock: Group of related statistics
 * - Hero: Large header with title and subtitle
 * - Tag: Status indicators and labels
 * - Icon: Visual indicators
 * - TextContent: Rich text content
 * - Timeline: Chronological events
 * - Progress: Progress indicators
 */

// Types for bill search results
interface BillSearchResult {
  id?: number;
  bill_id?: string;
  congress: number;
  bill_type: string;
  bill_number: number;
  title: string;
  short_title?: string;
  sponsor_name?: string;
  sponsor_party?: string;
  sponsor_state?: string;
  policy_area?: string;
  latest_action_text?: string;
  latest_action_date?: string;
  similarity_score?: number;
  matched_content?: string;
  status?: string;
  cosponsors_count?: number;
}

// Types for member results
interface MemberResult {
  bioguide_id: string;
  name: string;
  party: string;
  state: string;
  district?: number;
  chamber: string;
  title?: string;
  office?: string;
  phone?: string;
  website?: string;
  twitter?: string;
  photo_url?: string;
  next_election?: string;
  leadership_role?: string;
  committees?: Array<{ name: string; rank?: string }>;
  sponsored_bills_count?: number;
  cosponsored_bills_count?: number;
  votes_with_party_pct?: number;
}

// Types for news results
interface NewsResult {
  title: string;
  url: string;
  source: string;
  published_date?: string;
  snippet?: string;
  image_url?: string;
  image?: string; // Image from Perplexity or LinkPreview
  author?: string;
}

// Types for state bill results
interface StateBillResult {
  bill_id: string;
  state: string;
  session: string;
  identifier: string;
  title: string;
  classification?: string[];
  subject?: string[];
  latest_action?: string;
  latest_action_date?: string;
  sponsors?: Array<{ name: string; party?: string }>;
  status?: string;
}

/**
 * Get party color for styling
 */
function getPartyColor(party?: string): string {
  switch (party?.toUpperCase()) {
    case "D":
    case "DEMOCRAT":
    case "DEMOCRATIC":
      return "#2563eb"; // Blue
    case "R":
    case "REPUBLICAN":
      return "#dc2626"; // Red
    case "I":
    case "INDEPENDENT":
      return "#7c3aed"; // Purple
    default:
      return "#6b7280"; // Gray
  }
}

/**
 * Get status color for bill status
 */
function getStatusColor(status?: string): string {
  if (!status) return "#6b7280";
  const lowerStatus = status.toLowerCase();
  if (lowerStatus.includes("passed") || lowerStatus.includes("enacted") || lowerStatus.includes("law")) {
    return "#16a34a"; // Green
  }
  if (lowerStatus.includes("introduced") || lowerStatus.includes("referred")) {
    return "#2563eb"; // Blue
  }
  if (lowerStatus.includes("failed") || lowerStatus.includes("vetoed")) {
    return "#dc2626"; // Red
  }
  return "#f59e0b"; // Amber for in progress
}

/**
 * Format bill ID for display
 */
function formatBillId(congress: number, billType: string, billNumber: number): string {
  // Handle undefined/null values gracefully
  if (!billType || !billNumber || !congress) {
    return `Bill ${billNumber || "?"} (${congress || "?"}th Congress)`;
  }

  const typeMap: Record<string, string> = {
    hr: "H.R.",
    s: "S.",
    hjres: "H.J.Res.",
    sjres: "S.J.Res.",
    hconres: "H.Con.Res.",
    sconres: "S.Con.Res.",
    hres: "H.Res.",
    sres: "S.Res.",
  };
  const formattedType = typeMap[billType.toLowerCase()] || billType.toUpperCase();
  return `${formattedType} ${billNumber} (${congress}th Congress)`;
}

/**
 * Generate follow-up suggestions based on context
 */
function generateFollowupSuggestions(
  context: "bill_search" | "bill_detail" | "member" | "news" | "state_bill" | "web_search",
  data: { query?: string; policyArea?: string; sponsorName?: string; state?: string }
): unknown[] {
  const suggestions: unknown[] = [];

  switch (context) {
    case "bill_search":
      suggestions.push(
        {
          component: "FollowupItem",
          props: {
            label: "View latest congressional actions",
            query: "What are the latest actions on these bills?",
          },
        },
        {
          component: "FollowupItem",
          props: {
            label: data.policyArea ? `More ${data.policyArea} bills` : "Related legislation",
            query: data.policyArea
              ? `Find more bills about ${data.policyArea}`
              : `Find related bills to ${data.query || "this topic"}`,
          },
        },
        {
          component: "FollowupItem",
          props: {
            label: "News coverage",
            query: data.query
              ? `What's the latest news about ${data.query}?`
              : "What's the latest congressional news?",
          },
        }
      );
      break;

    case "bill_detail":
      suggestions.push(
        {
          component: "FollowupItem",
          props: {
            label: "View sponsor profile",
            query: data.sponsorName
              ? `Tell me about ${data.sponsorName}`
              : "Show me the sponsor's profile",
          },
        },
        {
          component: "FollowupItem",
          props: {
            label: "Cosponsors list",
            query: "Who are the cosponsors of this bill?",
          },
        },
        {
          component: "FollowupItem",
          props: {
            label: "Similar legislation",
            query: data.policyArea
              ? `Find similar ${data.policyArea} bills`
              : "Find similar bills",
          },
        },
        {
          component: "FollowupItem",
          props: {
            label: "Track this bill",
            action: "track_bill",
          },
        }
      );
      break;

    case "member":
      suggestions.push(
        {
          component: "FollowupItem",
          props: {
            label: "Bills sponsored",
            query: data.sponsorName
              ? `What bills has ${data.sponsorName} sponsored?`
              : "What bills has this representative sponsored?",
          },
        },
        {
          component: "FollowupItem",
          props: {
            label: "Voting record",
            query: data.sponsorName
              ? `Show ${data.sponsorName}'s voting record`
              : "Show voting record",
          },
        },
        {
          component: "FollowupItem",
          props: {
            label: "Committee assignments",
            query: data.sponsorName
              ? `What committees is ${data.sponsorName} on?`
              : "What committees are they on?",
          },
        }
      );
      break;

    case "news":
      suggestions.push(
        {
          component: "FollowupItem",
          props: {
            label: "Find related bills",
            query: data.query
              ? `Find bills related to ${data.query}`
              : "Find related legislation",
          },
        },
        {
          component: "FollowupItem",
          props: {
            label: "More recent news",
            query: data.query
              ? `Show me more recent news about ${data.query}`
              : "Show me more congressional news",
          },
        }
      );
      break;

    case "state_bill":
      suggestions.push(
        {
          component: "FollowupItem",
          props: {
            label: data.state ? `More ${data.state} bills` : "More state legislation",
            query: data.state
              ? `Find more bills in ${data.state}`
              : "Find more state legislation",
          },
        },
        {
          component: "FollowupItem",
          props: {
            label: "Federal equivalent",
            query: data.query
              ? `Are there federal bills about ${data.query}?`
              : "Find similar federal legislation",
          },
        },
        {
          component: "FollowupItem",
          props: {
            label: "Compare states",
            query: data.query
              ? `How do other states handle ${data.query}?`
              : "Compare legislation across states",
          },
        }
      );
      break;
    case "web_search":
      suggestions.push(
        {
          component: "FollowupItem",
          props: {
            label: "Related legislation",
            query: data.query
              ? `Find bills related to ${data.query}`
              : "Search for related legislation",
          },
        },
        {
          component: "FollowupItem",
          props: {
            label: "Latest news",
            query: data.query
              ? `Latest news about ${data.query}`
              : "What's happening in Congress?",
          },
        },
        {
          component: "FollowupItem",
          props: {
            label: "Key members",
            query: data.query
              ? `Which legislators are involved with ${data.query}?`
              : "Who are the key legislators?",
          },
        }
      );
      break;
  }

  return suggestions;
}

/**
 * Generate C1 template for bill search results
 *
 * Renders bills as a list of MiniCards with title, sponsor, and status tags
 */
export function billSearchResultsTemplate(
  bills: BillSearchResult[],
  options: { query?: string; count?: number; source?: string } = {}
): string {
  const { query, count, source = "database" } = options;

  if (bills.length === 0) {
    return JSON.stringify([
      {
        op: "append",
        component: "TextContent",
        props: {
          content: `No bills found${query ? ` for "${query}"` : ""}`,
        },
      },
    ]);
  }

  // Get primary policy area from results for contextual follow-ups
  const primaryPolicyArea = bills[0]?.policy_area;

  const components: unknown[] = [
    // Header with search info
    {
      op: "append",
      component: "InlineHeader",
      props: {
        title: query ? `Bills matching "${query}"` : "Bill Search Results",
        subtitle: `Found ${count || bills.length} bill${(count || bills.length) !== 1 ? "s" : ""}`,
      },
    },
    // List of bills as MiniCards
    {
      op: "append",
      component: "List",
      props: {
        variant: "grid",
        gap: "md",
      },
      children: bills.map((bill) => ({
        component: "MiniCard",
        props: {
          title: bill.short_title || bill.title,
          subtitle: formatBillId(bill.congress, bill.bill_type, bill.bill_number),
          description: bill.sponsor_name
            ? `Sponsored by ${bill.sponsor_name} (${bill.sponsor_party || "?"}-${bill.sponsor_state || "?"})`
            : undefined,
          onClick: {
            action: "navigate",
            payload: {
              billId: `${bill.congress}-${bill.bill_type}-${bill.bill_number}`,
            },
          },
        },
        children: [
          // Tags row
          {
            component: "List",
            props: {
              variant: "inline",
              gap: "sm",
            },
            children: [
              // Policy area tag
              bill.policy_area && {
                component: "Tag",
                props: {
                  label: bill.policy_area,
                  variant: "outline",
                },
              },
              // Party tag for sponsor
              bill.sponsor_party && {
                component: "Tag",
                props: {
                  label: bill.sponsor_party,
                  color: getPartyColor(bill.sponsor_party),
                  variant: "solid",
                },
              },
              // Similarity score if available
              bill.similarity_score && {
                component: "Tag",
                props: {
                  label: `${Math.round(bill.similarity_score * 100)}% match`,
                  variant: "outline",
                  color: "#10b981",
                },
              },
            ].filter(Boolean),
          },
          // Latest action if available
          bill.latest_action_text && {
            component: "TextContent",
            props: {
              content: bill.latest_action_text,
              variant: "caption",
              color: "#6b7280",
            },
          },
        ].filter(Boolean),
      })),
    },
    // Follow-up suggestions for exploration
    {
      op: "append",
      component: "FollowupBlock",
      props: {
        title: "Explore further",
      },
      children: generateFollowupSuggestions("bill_search", {
        query,
        policyArea: primaryPolicyArea,
      }),
    },
  ];

  return JSON.stringify(components);
}

/**
 * Generate C1 template for a single bill detail view
 *
 * Renders detailed bill information with Hero, StatBlock, and Timeline
 */
export function billDetailTemplate(bill: BillSearchResult & {
  summary?: string;
  cosponsors?: Array<{ name: string; party: string; state: string }>;
  actions?: Array<{ date: string; text: string; chamber?: string }>;
  committees?: Array<{ name: string; chamber: string }>;
}): string {
  const components: unknown[] = [
    // Hero header
    {
      op: "append",
      component: "Hero",
      props: {
        title: formatBillId(bill.congress, bill.bill_type, bill.bill_number),
        subtitle: bill.short_title || bill.title,
        background: getPartyColor(bill.sponsor_party),
      },
    },
    // Stats row
    {
      op: "append",
      component: "StatBlock",
      props: {
        columns: 4,
      },
      children: [
        {
          component: "DataTile",
          props: {
            label: "Sponsor",
            value: bill.sponsor_name || "Unknown",
            detail: bill.sponsor_party && bill.sponsor_state
              ? `${bill.sponsor_party}-${bill.sponsor_state}`
              : undefined,
          },
        },
        {
          component: "DataTile",
          props: {
            label: "Cosponsors",
            value: bill.cosponsors_count?.toString() || "0",
          },
        },
        {
          component: "DataTile",
          props: {
            label: "Policy Area",
            value: bill.policy_area || "General",
          },
        },
        {
          component: "DataTile",
          props: {
            label: "Status",
            value: bill.status || "Introduced",
            color: getStatusColor(bill.status),
          },
        },
      ],
    },
  ];

  // Summary section
  if (bill.summary) {
    components.push({
      op: "append",
      component: "TextContent",
      props: {
        title: "Summary",
        content: bill.summary,
      },
    });
  }

  // Actions timeline
  if (bill.actions && bill.actions.length > 0) {
    components.push({
      op: "append",
      component: "Timeline",
      props: {
        title: "Legislative Actions",
      },
      children: bill.actions.slice(0, 10).map((action) => ({
        component: "TimelineItem",
        props: {
          date: action.date,
          title: action.text,
          subtitle: action.chamber,
        },
      })),
    });
  }

  // Committees
  if (bill.committees && bill.committees.length > 0) {
    components.push({
      op: "append",
      component: "List",
      props: {
        title: "Committees",
        variant: "grid",
        gap: "sm",
      },
      children: bill.committees.map((committee) => ({
        component: "Tag",
        props: {
          label: committee.name,
          variant: "outline",
        },
      })),
    });
  }

  // Follow-up suggestions for exploration
  components.push({
    op: "append",
    component: "FollowupBlock",
    props: {
      title: "Explore further",
    },
    children: generateFollowupSuggestions("bill_detail", {
      sponsorName: bill.sponsor_name,
      policyArea: bill.policy_area,
    }),
  });

  return JSON.stringify(components);
}

/**
 * Generate C1 template for member profile
 *
 * Renders member info with photo, stats, and contact information
 */
export function memberProfileTemplate(member: MemberResult): string {
  const components: unknown[] = [
    // Hero with photo
    {
      op: "append",
      component: "Hero",
      props: {
        title: member.name,
        subtitle: member.title || `${member.party === "D" ? "Democrat" : member.party === "R" ? "Republican" : member.party} - ${member.state}${member.district ? ` District ${member.district}` : ""}`,
        image: member.photo_url,
        background: getPartyColor(member.party),
      },
    },
    // Stats
    {
      op: "append",
      component: "StatBlock",
      props: {
        columns: 4,
      },
      children: [
        {
          component: "DataTile",
          props: {
            label: "Chamber",
            value: member.chamber === "senate" ? "Senate" : "House",
          },
        },
        {
          component: "DataTile",
          props: {
            label: "Bills Sponsored",
            value: member.sponsored_bills_count?.toString() || "—",
          },
        },
        {
          component: "DataTile",
          props: {
            label: "Bills Cosponsored",
            value: member.cosponsored_bills_count?.toString() || "—",
          },
        },
        member.votes_with_party_pct && {
          component: "DataTile",
          props: {
            label: "Votes with Party",
            value: `${member.votes_with_party_pct}%`,
          },
        },
      ].filter(Boolean),
    },
  ];

  // Contact information
  components.push({
    op: "append",
    component: "List",
    props: {
      title: "Contact Information",
      variant: "list",
      gap: "sm",
    },
    children: [
      member.office && {
        component: "TextContent",
        props: {
          label: "Office",
          content: member.office,
        },
      },
      member.phone && {
        component: "TextContent",
        props: {
          label: "Phone",
          content: member.phone,
        },
      },
      member.website && {
        component: "TextContent",
        props: {
          label: "Website",
          content: member.website,
          link: member.website,
        },
      },
    ].filter(Boolean),
  });

  // Committees
  if (member.committees && member.committees.length > 0) {
    components.push({
      op: "append",
      component: "List",
      props: {
        title: "Committee Assignments",
        variant: "grid",
        gap: "sm",
      },
      children: member.committees.map((committee) => ({
        component: "MiniCard",
        props: {
          title: committee.name,
          subtitle: committee.rank,
        },
      })),
    });
  }

  // Follow-up suggestions for exploration
  components.push({
    op: "append",
    component: "FollowupBlock",
    props: {
      title: "Explore further",
    },
    children: generateFollowupSuggestions("member", {
      sponsorName: member.name,
      state: member.state,
    }),
  });

  return JSON.stringify(components);
}

/**
 * Generate C1 template for news search results
 *
 * Renders news articles as a list with headlines, sources, and dates
 */
export function newsResultsTemplate(
  articles: NewsResult[],
  options: { query?: string } = {}
): string {
  const { query } = options;

  if (articles.length === 0) {
    return JSON.stringify([
      {
        op: "append",
        component: "TextContent",
        props: {
          content: `No news found${query ? ` for "${query}"` : ""}`,
        },
      },
    ]);
  }

  const components: unknown[] = [
    // Header
    {
      op: "append",
      component: "InlineHeader",
      props: {
        title: query ? `News about "${query}"` : "Latest News",
        subtitle: `${articles.length} article${articles.length !== 1 ? "s" : ""} found`,
      },
    },
    // List of articles
    {
      op: "append",
      component: "List",
      props: {
        variant: "list",
        gap: "md",
      },
      children: articles.map((article, index) => {
        // Use article title if it's not a generic "Source X", otherwise use source name
        const displayTitle = article.title && !article.title.startsWith("Source ")
          ? article.title
          : article.source;
        const displaySubtitle = article.title?.startsWith("Source ")
          ? `Source ${index + 1}`
          : article.source;

        const tags: unknown[] = [
          {
            component: "Tag",
            props: {
              label: article.source,
              variant: "outline",
            },
          },
        ];

        // Only add date tag if we have a valid date
        if (article.published_date) {
          tags.push({
            component: "Tag",
            props: {
              label: new Date(article.published_date).toLocaleDateString(),
              variant: "ghost",
            },
          });
        }

        // Get image from either image or image_url field
        const articleImage = article.image || article.image_url;

        return {
          component: "MiniCard",
          props: {
            title: displayTitle,
            subtitle: displaySubtitle,
            description: article.snippet || undefined,
            image: articleImage,
            onClick: {
              action: "link",
              payload: {
                url: article.url,
              },
            },
          },
          children: [
            {
              component: "List",
              props: {
                variant: "inline",
                gap: "sm",
              },
              children: tags,
            },
          ],
        };
      }),
    },
    // Follow-up suggestions for exploration
    {
      op: "append",
      component: "FollowupBlock",
      props: {
        title: "Explore further",
      },
      children: generateFollowupSuggestions("news", {
        query,
      }),
    },
  ];

  return JSON.stringify(components);
}

/**
 * Generate C1 template for state bill search results
 *
 * Renders state legislation with state badge, identifier, and status
 */
export function stateBillResultsTemplate(
  bills: StateBillResult[],
  options: { query?: string; state?: string } = {}
): string {
  const { query, state } = options;

  if (bills.length === 0) {
    return JSON.stringify([
      {
        op: "append",
        component: "TextContent",
        props: {
          content: `No state bills found${query ? ` for "${query}"` : ""}${state ? ` in ${state}` : ""}`,
        },
      },
    ]);
  }

  const components: unknown[] = [
    // Header
    {
      op: "append",
      component: "InlineHeader",
      props: {
        title: state
          ? `${state} Legislation${query ? ` - "${query}"` : ""}`
          : `State Legislation${query ? ` - "${query}"` : ""}`,
        subtitle: `${bills.length} bill${bills.length !== 1 ? "s" : ""} found`,
      },
    },
    // List of bills
    {
      op: "append",
      component: "List",
      props: {
        variant: "grid",
        gap: "md",
      },
      children: bills.map((bill) => ({
        component: "MiniCard",
        props: {
          title: bill.title,
          subtitle: `${bill.state} ${bill.identifier} (${bill.session})`,
          description: bill.sponsors?.length
            ? `Sponsored by ${bill.sponsors.map((s) => s.name).join(", ")}`
            : undefined,
        },
        children: [
          {
            component: "List",
            props: {
              variant: "inline",
              gap: "sm",
            },
            children: [
              // State badge
              {
                component: "Tag",
                props: {
                  label: bill.state,
                  variant: "solid",
                  color: "#3b82f6",
                },
              },
              // Classification tags
              ...(bill.classification || []).slice(0, 2).map((cls) => ({
                component: "Tag",
                props: {
                  label: cls,
                  variant: "outline",
                },
              })),
              // Status if available
              bill.status && {
                component: "Tag",
                props: {
                  label: bill.status,
                  color: getStatusColor(bill.status),
                  variant: "outline",
                },
              },
            ].filter(Boolean),
          },
          // Latest action
          bill.latest_action && {
            component: "TextContent",
            props: {
              content: bill.latest_action,
              variant: "caption",
              color: "#6b7280",
            },
          },
        ].filter(Boolean),
      })),
    },
    // Follow-up suggestions for exploration
    {
      op: "append",
      component: "FollowupBlock",
      props: {
        title: "Explore further",
      },
      children: generateFollowupSuggestions("state_bill", {
        query,
        state: state || bills[0]?.state,
      }),
    },
  ];

  return JSON.stringify(components);
}

/**
 * Generate C1 template for error state
 */
export function errorTemplate(
  error: string,
  options: { title?: string; suggestion?: string } = {}
): string {
  const { title = "Error", suggestion } = options;

  const components: unknown[] = [
    {
      op: "append",
      component: "TextContent",
      props: {
        title,
        content: error,
        variant: "error",
      },
    },
  ];

  if (suggestion) {
    components.push({
      op: "append",
      component: "TextContent",
      props: {
        content: suggestion,
        variant: "caption",
      },
    });
  }

  return JSON.stringify(components);
}

/**
 * Generate C1 template for loading state
 */
export function loadingTemplate(message = "Loading..."): string {
  return JSON.stringify([
    {
      op: "append",
      component: "Progress",
      props: {
        label: message,
        variant: "indeterminate",
      },
    },
  ]);
}

/**
 * Generate C1 template for web search results
 *
 * Renders an AI-generated answer with source citations
 */
export function webSearchResultsTemplate(
  answer: string,
  citations: Array<{ url: string; title?: string }>,
  options: { query?: string } = {}
): string {
  const { query } = options;

  const components: unknown[] = [
    // Header
    {
      op: "append",
      component: "InlineHeader",
      props: {
        title: query ? `Search: "${query}"` : "Search Results",
        subtitle: `${citations.length} source${citations.length !== 1 ? "s" : ""} found`,
      },
    },
    // Answer content
    {
      op: "append",
      component: "TextContent",
      props: {
        content: answer,
      },
    },
  ];

  // Add citations section if there are any
  if (citations.length > 0) {
    components.push(
      {
        op: "append",
        component: "InlineHeader",
        props: {
          title: "Sources",
          subtitle: `${citations.length} source${citations.length !== 1 ? "s" : ""} cited`,
        },
      },
      {
        op: "append",
        component: "List",
        props: {
          variant: "list",
          gap: "sm",
        },
        children: citations.map((citation, index) => {
          const sourceName = extractSourceFromUrl(citation.url);
          return {
            component: "MiniCard",
            props: {
              title: citation.title || sourceName,
              subtitle: `Source ${index + 1}`,
              onClick: {
                action: "link",
                payload: {
                  url: citation.url,
                },
              },
            },
            children: [
              {
                component: "Tag",
                props: {
                  label: sourceName,
                  variant: "outline",
                },
              },
            ],
          };
        }),
      }
    );
  }

  // Follow-up suggestions
  components.push({
    op: "append",
    component: "FollowupBlock",
    props: {
      title: "Explore further",
    },
    children: generateFollowupSuggestions("web_search", { query }),
  });

  return JSON.stringify(components);
}

/**
 * Generate C1 template for citations/sources section
 *
 * Renders a list of sources with links for attribution
 */
export function citationsTemplate(
  citations: Array<{ url: string; title?: string; source?: string }>,
  options: { title?: string } = {}
): string {
  const { title = "Sources" } = options;

  if (citations.length === 0) {
    return JSON.stringify([]);
  }

  return JSON.stringify([
    {
      op: "append",
      component: "InlineHeader",
      props: {
        title,
        subtitle: `${citations.length} source${citations.length !== 1 ? "s" : ""} cited`,
      },
    },
    {
      op: "append",
      component: "List",
      props: {
        variant: "list",
        gap: "sm",
      },
      children: citations.map((citation, index) => ({
        component: "MiniCard",
        props: {
          title: citation.title || `Source ${index + 1}`,
          subtitle: citation.source || extractSourceFromUrl(citation.url),
          onClick: {
            action: "link",
            payload: {
              url: citation.url,
            },
          },
        },
        children: [
          {
            component: "Tag",
            props: {
              label: citation.source || extractSourceFromUrl(citation.url),
              variant: "outline",
            },
          },
        ],
      })),
    },
  ]);
}

/**
 * Extract source name from URL for citation display
 */
function extractSourceFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace("www.", "");
    // Common news sources - return friendly names
    const sourceMap: Record<string, string> = {
      "nytimes.com": "New York Times",
      "washingtonpost.com": "Washington Post",
      "cnn.com": "CNN",
      "foxnews.com": "Fox News",
      "bbc.com": "BBC",
      "bbc.co.uk": "BBC",
      "reuters.com": "Reuters",
      "apnews.com": "Associated Press",
      "politico.com": "Politico",
      "thehill.com": "The Hill",
      "congress.gov": "Congress.gov",
      "govtrack.us": "GovTrack",
      "rollcall.com": "Roll Call",
      "npr.org": "NPR",
      "axios.com": "Axios",
      "bloomberg.com": "Bloomberg",
    };
    return sourceMap[hostname] || hostname;
  } catch {
    return "Unknown Source";
  }
}

// Export all templates
export const c1Templates = {
  billSearchResults: billSearchResultsTemplate,
  billDetail: billDetailTemplate,
  memberProfile: memberProfileTemplate,
  newsResults: newsResultsTemplate,
  stateBillResults: stateBillResultsTemplate,
  webSearchResults: webSearchResultsTemplate,
  citations: citationsTemplate,
  error: errorTemplate,
  loading: loadingTemplate,
};
