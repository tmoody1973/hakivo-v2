import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Congressional Analytics Tools for Hakivo
 *
 * Provides aggregation and analytics queries for journalist-style questions:
 * - Most prolific bill sponsors
 * - Policy area breakdowns
 * - Legislative productivity metrics
 * - Partisan analysis
 * - Chamber comparisons
 */

// Admin dashboard endpoint for SQL queries
const ADMIN_SERVICE =
  "https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

/**
 * Execute SQL query against the admin dashboard
 */
async function executeAnalyticsQuery(
  sql: string
): Promise<{ success: boolean; results: Record<string, unknown>[]; error?: string }> {
  try {
    const response = await fetch(`${ADMIN_SERVICE}/api/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      throw new Error(`Query failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: data.success !== false,
      results: data.results || [],
      error: data.error,
    };
  } catch (error) {
    return {
      success: false,
      results: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get Most Prolific Sponsors Tool
 *
 * Returns the members who have sponsored the most bills in a given Congress.
 * Useful for identifying the most active legislators.
 */
export const getMostProlificSponsorsTool = createTool({
  id: "getMostProlificSponsors",
  description: `Get the most prolific bill sponsors in Congress.
Returns a ranked list of members by number of bills sponsored.
Use this for questions like "Who sponsors the most bills?" or "Most active legislators"`,
  inputSchema: z.object({
    congress: z
      .number()
      .optional()
      .default(119)
      .describe("Congress number (default: 119 for current)"),
    chamber: z
      .enum(["house", "senate", "both"])
      .optional()
      .default("both")
      .describe("Filter by chamber"),
    party: z
      .enum(["D", "R", "both"])
      .optional()
      .default("both")
      .describe("Filter by party: D (Democrat), R (Republican), or both"),
    limit: z
      .number()
      .optional()
      .default(15)
      .describe("Number of results to return"),
  }),
  execute: async ({ context }) => {
    const { congress = 119, chamber = "both", party = "both", limit = 15 } = context;

    let chamberFilter = "";
    if (chamber === "house") {
      chamberFilter = "AND LOWER(b.bill_type) IN ('hr', 'hres', 'hjres', 'hconres')";
    } else if (chamber === "senate") {
      chamberFilter = "AND LOWER(b.bill_type) IN ('s', 'sres', 'sjres', 'sconres')";
    }

    let partyFilter = "";
    if (party !== "both") {
      partyFilter = `AND (m.party = '${party}' OR m.party LIKE '${party === "D" ? "Dem%" : "Rep%"}')`;
    }

    const sql = `
      SELECT
        m.first_name || ' ' || m.last_name as name,
        m.party,
        m.state,
        COUNT(b.id) as bill_count
      FROM bills b
      JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
      WHERE b.congress = ${congress}
      ${chamberFilter}
      ${partyFilter}
      GROUP BY m.bioguide_id
      ORDER BY bill_count DESC
      LIMIT ${limit}
    `;

    const result = await executeAnalyticsQuery(sql);

    return {
      success: result.success,
      congress,
      chamber,
      party,
      sponsors: result.results,
      count: result.results.length,
      error: result.error,
    };
  },
});

/**
 * Get Policy Area Breakdown Tool
 *
 * Returns bill counts by policy area for a given Congress.
 * Useful for identifying legislative priorities and trends.
 */
export const getPolicyAreaBreakdownTool = createTool({
  id: "getPolicyAreaBreakdown",
  description: `Get a breakdown of bills by policy area.
Shows what topics Congress is focusing on most.
Use for questions like "What are the top legislative priorities?" or "Most active policy areas"`,
  inputSchema: z.object({
    congress: z
      .number()
      .optional()
      .default(119)
      .describe("Congress number (default: 119)"),
    chamber: z
      .enum(["house", "senate", "both"])
      .optional()
      .default("both")
      .describe("Filter by chamber"),
    limit: z
      .number()
      .optional()
      .default(15)
      .describe("Number of policy areas to return"),
  }),
  execute: async ({ context }) => {
    const { congress = 119, chamber = "both", limit = 15 } = context;

    let chamberFilter = "";
    if (chamber === "house") {
      chamberFilter = "AND origin_chamber = 'House'";
    } else if (chamber === "senate") {
      chamberFilter = "AND origin_chamber = 'Senate'";
    }

    const sql = `
      SELECT
        policy_area,
        COUNT(*) as bill_count
      FROM bills
      WHERE congress = ${congress}
      AND policy_area IS NOT NULL
      ${chamberFilter}
      GROUP BY policy_area
      ORDER BY bill_count DESC
      LIMIT ${limit}
    `;

    const result = await executeAnalyticsQuery(sql);

    // Calculate total for percentage
    const total = result.results.reduce(
      (sum, r) => sum + (r.bill_count as number),
      0
    );

    const breakdown = result.results.map((r) => ({
      ...r,
      percentage: total > 0 ? Math.round(((r.bill_count as number) / total) * 100) : 0,
    }));

    return {
      success: result.success,
      congress,
      chamber,
      policy_areas: breakdown,
      total_bills: total,
      count: result.results.length,
      error: result.error,
    };
  },
});

/**
 * Get Legislative Productivity Tool
 *
 * Returns overall legislative productivity metrics for a Congress.
 */
export const getLegislativeProductivityTool = createTool({
  id: "getLegislativeProductivity",
  description: `Get legislative productivity metrics for a Congress.
Returns total bills, breakdown by type, and chamber comparison.
Use for "How productive is this Congress?" or "House vs Senate comparison"`,
  inputSchema: z.object({
    congress: z
      .number()
      .optional()
      .default(119)
      .describe("Congress number (default: 119)"),
  }),
  execute: async ({ context }) => {
    const { congress = 119 } = context;

    // Get bill type breakdown
    const typeQuery = `
      SELECT
        LOWER(bill_type) as bill_type,
        origin_chamber,
        COUNT(*) as count
      FROM bills
      WHERE congress = ${congress}
      GROUP BY LOWER(bill_type), origin_chamber
      ORDER BY count DESC
    `;

    const typeResult = await executeAnalyticsQuery(typeQuery);

    // Get total counts by chamber
    const chamberQuery = `
      SELECT
        origin_chamber,
        COUNT(*) as total_bills
      FROM bills
      WHERE congress = ${congress}
      GROUP BY origin_chamber
    `;

    const chamberResult = await executeAnalyticsQuery(chamberQuery);

    // Get recent activity (last 30 days)
    const recentQuery = `
      SELECT COUNT(*) as recent_bills
      FROM bills
      WHERE congress = ${congress}
      AND latest_action_date >= date('now', '-30 days')
    `;

    const recentResult = await executeAnalyticsQuery(recentQuery);

    return {
      success: typeResult.success && chamberResult.success,
      congress,
      bill_types: typeResult.results,
      chamber_totals: chamberResult.results,
      recent_activity_30_days: recentResult.results[0]?.recent_bills || 0,
      total_bills: chamberResult.results.reduce(
        (sum, r) => sum + (r.total_bills as number),
        0
      ),
    };
  },
});

/**
 * Get Partisan Breakdown Tool
 *
 * Returns bill sponsorship breakdown by party for a policy area or overall.
 */
export const getPartisanBreakdownTool = createTool({
  id: "getPartisanBreakdown",
  description: `Get partisan breakdown of bill sponsorship.
Shows how many bills each party has sponsored, optionally filtered by policy area.
Use for "Partisan breakdown on healthcare" or "Which party sponsors more bills?"`,
  inputSchema: z.object({
    congress: z
      .number()
      .optional()
      .default(119)
      .describe("Congress number"),
    policyArea: z
      .string()
      .optional()
      .describe("Filter by policy area (e.g., 'Health', 'Immigration')"),
  }),
  execute: async ({ context }) => {
    const { congress = 119, policyArea } = context;

    let policyFilter = "";
    if (policyArea) {
      policyFilter = `AND b.policy_area LIKE '%${policyArea}%'`;
    }

    const sql = `
      SELECT
        CASE
          WHEN m.party IN ('D', 'Democrat', 'Democratic') THEN 'Democrat'
          WHEN m.party IN ('R', 'Republican') THEN 'Republican'
          ELSE 'Other'
        END as party,
        COUNT(*) as bill_count
      FROM bills b
      JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
      WHERE b.congress = ${congress}
      ${policyFilter}
      GROUP BY
        CASE
          WHEN m.party IN ('D', 'Democrat', 'Democratic') THEN 'Democrat'
          WHEN m.party IN ('R', 'Republican') THEN 'Republican'
          ELSE 'Other'
        END
      ORDER BY bill_count DESC
    `;

    const result = await executeAnalyticsQuery(sql);

    const total = result.results.reduce(
      (sum, r) => sum + (r.bill_count as number),
      0
    );

    const breakdown = result.results.map((r) => ({
      ...r,
      percentage: total > 0 ? Math.round(((r.bill_count as number) / total) * 100) : 0,
    }));

    return {
      success: result.success,
      congress,
      policy_area: policyArea || "All",
      partisan_breakdown: breakdown,
      total_bills: total,
      error: result.error,
    };
  },
});

/**
 * Get Recent Bills Tool
 *
 * Returns recently introduced or acted-upon bills with filtering options.
 */
export const getRecentBillsTool = createTool({
  id: "getRecentBills",
  description: `Get recently introduced or acted-upon legislation.
Use for "What bills were introduced this week?" or "Recent healthcare legislation"`,
  inputSchema: z.object({
    congress: z
      .number()
      .optional()
      .default(119)
      .describe("Congress number"),
    days: z
      .number()
      .optional()
      .default(7)
      .describe("Number of days to look back"),
    policyArea: z
      .string()
      .optional()
      .describe("Filter by policy area"),
    chamber: z
      .enum(["house", "senate", "both"])
      .optional()
      .default("both")
      .describe("Filter by chamber"),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Max results"),
  }),
  execute: async ({ context }) => {
    const {
      congress = 119,
      days = 7,
      policyArea,
      chamber = "both",
      limit = 20,
    } = context;

    let filters = [`congress = ${congress}`];

    if (policyArea) {
      filters.push(`policy_area LIKE '%${policyArea}%'`);
    }

    if (chamber === "house") {
      filters.push("origin_chamber = 'House'");
    } else if (chamber === "senate") {
      filters.push("origin_chamber = 'Senate'");
    }

    const sql = `
      SELECT
        id,
        congress || '-' || bill_type || '-' || bill_number as bill_id,
        title,
        bill_type,
        bill_number,
        origin_chamber,
        policy_area,
        introduced_date,
        latest_action_date,
        latest_action_text
      FROM bills
      WHERE ${filters.join(" AND ")}
      AND latest_action_date >= date('now', '-${days} days')
      ORDER BY latest_action_date DESC
      LIMIT ${limit}
    `;

    const result = await executeAnalyticsQuery(sql);

    return {
      success: result.success,
      congress,
      days,
      policy_area: policyArea || "All",
      chamber,
      bills: result.results,
      count: result.results.length,
      error: result.error,
    };
  },
});

/**
 * Search Bills by Status Tool
 *
 * Finds bills matching certain status keywords in latest_action_text.
 */
export const searchBillsByStatusTool = createTool({
  id: "searchBillsByStatus",
  description: `Search for bills by their status or latest action.
Use for "Bills signed into law" or "Passed the House" or "In committee"`,
  inputSchema: z.object({
    congress: z
      .number()
      .optional()
      .default(119)
      .describe("Congress number"),
    statusKeyword: z
      .string()
      .describe(
        "Status to search for: 'signed', 'passed', 'committee', 'referred', 'vetoed', 'became law'"
      ),
    chamber: z
      .enum(["house", "senate", "both"])
      .optional()
      .default("both")
      .describe("Filter by chamber"),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Max results"),
  }),
  execute: async ({ context }) => {
    const { congress = 119, statusKeyword, chamber = "both", limit = 20 } = context;

    // Map common status keywords to SQL patterns
    const statusPatterns: Record<string, string> = {
      signed: "%Signed by President%",
      "became law": "%Became Public Law%",
      passed: "%Passed%",
      "passed house": "%Passed House%",
      "passed senate": "%Passed Senate%",
      vetoed: "%Vetoed%",
      committee: "%Committee%",
      referred: "%Referred to%",
    };

    const pattern =
      statusPatterns[statusKeyword.toLowerCase()] || `%${statusKeyword}%`;

    let chamberFilter = "";
    if (chamber === "house") {
      chamberFilter = "AND origin_chamber = 'House'";
    } else if (chamber === "senate") {
      chamberFilter = "AND origin_chamber = 'Senate'";
    }

    const sql = `
      SELECT
        id,
        congress || '-' || bill_type || '-' || bill_number as bill_id,
        title,
        bill_type,
        bill_number,
        origin_chamber,
        policy_area,
        latest_action_date,
        latest_action_text
      FROM bills
      WHERE congress = ${congress}
      AND latest_action_text LIKE '${pattern}'
      ${chamberFilter}
      ORDER BY latest_action_date DESC
      LIMIT ${limit}
    `;

    const result = await executeAnalyticsQuery(sql);

    return {
      success: result.success,
      congress,
      status_keyword: statusKeyword,
      chamber,
      bills: result.results,
      count: result.results.length,
      error: result.error,
    };
  },
});

// Export all analytics tools
export const congressionalAnalyticsTools = {
  getMostProlificSponsors: getMostProlificSponsorsTool,
  getPolicyAreaBreakdown: getPolicyAreaBreakdownTool,
  getLegislativeProductivity: getLegislativeProductivityTool,
  getPartisanBreakdown: getPartisanBreakdownTool,
  getRecentBills: getRecentBillsTool,
  searchBillsByStatus: searchBillsByStatusTool,
};
