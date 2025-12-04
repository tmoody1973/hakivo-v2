import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import OpenAI from "openai";

/**
 * C1 Artifacts Tools for Hakivo Congressional Assistant
 *
 * Uses thesys.dev C1 Artifacts API to generate:
 * - Comprehensive bill analysis reports
 * - Briefing slide presentations
 * - District briefings
 * - Week in Congress summaries
 *
 * These are interactive documents that users can edit and export.
 */

// C1 Artifacts client
const getC1ArtifactsClient = () => {
  const apiKey = process.env.THESYS_API_KEY || process.env.NEXT_PUBLIC_THESYS_API_KEY;
  if (!apiKey) {
    throw new Error("THESYS_API_KEY not configured");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://api.thesys.dev/v1/artifact",
  });
};

// C1 Artifact types
type ArtifactType = "report" | "slides";

// Result types
interface ArtifactResult {
  success: boolean;
  artifactId?: string;
  artifactUrl?: string;
  artifactType: ArtifactType;
  content?: string;
  error?: string;
}

interface BillData {
  billId: string;
  congress?: number;
  billType?: string;
  billNumber?: number;
  title?: string;
  summary?: string;
  sponsor?: {
    name: string;
    party: string;
    state: string;
  };
  cosponsorsCount?: number;
  status?: string;
  latestAction?: string;
  policyArea?: string;
  committees?: string[];
  relatedBills?: string[];
}

/**
 * Generate Bill Report Tool
 *
 * Creates a comprehensive bill analysis report using C1 Artifacts.
 * The report includes executive summary, key provisions, fiscal impact,
 * stakeholder analysis, legislative history, and voting predictions.
 */
export const generateBillReportTool = createTool({
  id: "generateBillReport",
  description: `Generate a comprehensive bill analysis report using C1 Artifacts.

The report includes:
- Executive summary
- Key provisions breakdown
- Fiscal impact analysis
- Stakeholder analysis
- Legislative history timeline
- Voting predictions

Returns an interactive document that users can edit and export.`,
  inputSchema: z.object({
    billId: z.union([z.number(), z.string()]).describe("Bill ID to analyze"),
    billData: z.object({
      title: z.string().optional(),
      summary: z.string().optional(),
      sponsor: z.object({
        name: z.string(),
        party: z.string(),
        state: z.string(),
      }).optional(),
      cosponsorsCount: z.number().optional(),
      status: z.string().optional(),
      latestAction: z.string().optional(),
      policyArea: z.string().optional(),
      committees: z.array(z.string()).optional(),
    }).optional().describe("Pre-fetched bill data to include in the report"),
    sections: z.array(z.enum([
      "executive_summary",
      "key_provisions",
      "fiscal_impact",
      "stakeholder_analysis",
      "legislative_history",
      "voting_predictions",
      "public_opinion",
      "expert_analysis",
    ])).optional().describe("Sections to include (default: all)"),
    format: z.enum(["detailed", "summary", "brief"]).optional().default("detailed")
      .describe("Report detail level"),
  }),
  execute: async ({ context }): Promise<ArtifactResult> => {
    const { billId, billData, sections, format = "detailed" } = context;

    try {
      const client = getC1ArtifactsClient();

      // Build the report prompt
      const selectedSections = sections || [
        "executive_summary",
        "key_provisions",
        "fiscal_impact",
        "stakeholder_analysis",
        "legislative_history",
        "voting_predictions",
      ];

      const sectionInstructions = selectedSections.map(section => {
        switch (section) {
          case "executive_summary":
            return "## Executive Summary\nProvide a 2-3 paragraph overview of the bill's purpose, key provisions, and current status.";
          case "key_provisions":
            return "## Key Provisions\nList and explain the major provisions of the bill with their potential impacts.";
          case "fiscal_impact":
            return "## Fiscal Impact\nAnalyze the expected costs, funding sources, and economic implications.";
          case "stakeholder_analysis":
            return "## Stakeholder Analysis\nIdentify groups that would be affected and their likely positions.";
          case "legislative_history":
            return "## Legislative History\nProvide a timeline of the bill's journey through Congress.";
          case "voting_predictions":
            return "## Voting Outlook\nAnalyze the likelihood of passage and key factors affecting the vote.";
          case "public_opinion":
            return "## Public Opinion\nSummarize public sentiment and polling data if available.";
          case "expert_analysis":
            return "## Expert Analysis\nInclude perspectives from policy experts and think tanks.";
          default:
            return "";
        }
      }).filter(Boolean).join("\n\n");

      const formatInstruction = format === "brief"
        ? "Keep each section concise (2-3 sentences)."
        : format === "summary"
          ? "Provide moderate detail (1-2 paragraphs per section)."
          : "Provide comprehensive analysis (3-5 paragraphs per section with specific details).";

      const billContext = billData ? `
Bill Information:
- Title: ${billData.title || "Unknown"}
- Sponsor: ${billData.sponsor?.name || "Unknown"} (${billData.sponsor?.party || "?"}-${billData.sponsor?.state || "?"})
- Cosponsors: ${billData.cosponsorsCount || 0}
- Status: ${billData.status || "Unknown"}
- Latest Action: ${billData.latestAction || "Unknown"}
- Policy Area: ${billData.policyArea || "Unknown"}
${billData.committees?.length ? `- Committees: ${billData.committees.join(", ")}` : ""}
${billData.summary ? `\nSummary: ${billData.summary}` : ""}
` : `Bill ID: ${billId}`;

      const systemPrompt = `You are an expert congressional analyst creating a professional bill analysis report.
Be objective, factual, and non-partisan. Use clear language accessible to general audiences.
${formatInstruction}`;

      const userPrompt = `Generate a comprehensive bill analysis report for the following legislation:

${billContext}

Please include the following sections:

${sectionInstructions}

Format the report professionally with clear headings and structured content.`;

      // Call C1 Artifacts API
      const response = await client.chat.completions.create({
        model: "c1/artifact/v-20251030",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        // @ts-expect-error - C1-specific parameter
        artifact_type: "report",
      });

      const content = response.choices[0]?.message?.content ?? undefined;
      // @ts-expect-error - C1-specific response field
      const artifactId = response.artifact_id;
      // @ts-expect-error - C1-specific response field
      const artifactUrl = response.artifact_url;

      return {
        success: true,
        artifactId,
        artifactUrl,
        artifactType: "report",
        content,
      };
    } catch (error) {
      // If C1 isn't available, fall back to returning structured content
      if (error instanceof Error && error.message.includes("THESYS_API_KEY")) {
        return {
          success: false,
          artifactType: "report",
          error: "C1 Artifacts API not configured. Please set THESYS_API_KEY.",
        };
      }

      return {
        success: false,
        artifactType: "report",
        error: error instanceof Error ? error.message : "Unknown error generating report",
      };
    }
  },
});

/**
 * Generate Briefing Slides Tool
 *
 * Creates slide presentations using C1 Artifacts for:
 * - Personalized district briefings
 * - "Week in Congress" summaries
 * - Bill comparison presentations
 * - Voting record analysis decks
 */
export const generateBriefingSlidesTool = createTool({
  id: "generateBriefingSlides",
  description: `Generate slide presentations using C1 Artifacts.

Types of presentations:
- District briefings: Personalized updates for a congressional district
- Week in Congress: Summary of the week's legislative activity
- Bill comparison: Side-by-side analysis of related bills
- Voting analysis: Representative's voting record breakdown

Returns interactive slides that users can edit and export.`,
  inputSchema: z.object({
    presentationType: z.enum([
      "district_briefing",
      "week_in_congress",
      "bill_comparison",
      "voting_analysis",
    ]).describe("Type of presentation to generate"),
    title: z.string().optional().describe("Presentation title"),
    // District briefing params
    state: z.string().optional().describe("State code for district briefing"),
    district: z.number().optional().describe("Congressional district number"),
    // Week in Congress params
    weekStart: z.string().optional().describe("Start date for week summary (ISO format)"),
    // Bill comparison params
    billIds: z.array(z.string()).optional().describe("Bill IDs to compare"),
    // Voting analysis params
    bioguideId: z.string().optional().describe("Bioguide ID for voting analysis"),
    // Content data
    data: z.record(z.unknown()).optional().describe("Pre-fetched data for the presentation"),
    slideCount: z.number().optional().default(10).describe("Target number of slides"),
  }),
  execute: async ({ context }): Promise<ArtifactResult> => {
    const {
      presentationType,
      title,
      state,
      district,
      weekStart,
      billIds,
      bioguideId,
      data,
      slideCount = 10,
    } = context;

    try {
      const client = getC1ArtifactsClient();

      // Build presentation-specific prompts
      let presentationTitle = title;
      let presentationPrompt = "";

      switch (presentationType) {
        case "district_briefing":
          presentationTitle = title || `District Briefing: ${state}-${district}`;
          presentationPrompt = `Create a ${slideCount}-slide congressional district briefing for ${state} District ${district}.

Include:
1. Title slide with district info
2. Your Representatives (federal and state)
3. Recent votes by your representatives
4. Bills affecting your district
5. Upcoming committee hearings
6. Recent floor activity
7. District-specific policy updates
8. How to engage with your representatives
9. Key dates and deadlines
10. Resources and next steps

${data ? `Data: ${JSON.stringify(data)}` : ""}`;
          break;

        case "week_in_congress":
          const weekDate = weekStart ? new Date(weekStart).toLocaleDateString() : "this week";
          presentationTitle = title || `Week in Congress: ${weekDate}`;
          presentationPrompt = `Create a ${slideCount}-slide "Week in Congress" summary for ${weekDate}.

Include:
1. Title slide
2. Week at a Glance (key statistics)
3. Major Bills Passed
4. Key Committee Actions
5. Floor Debate Highlights
6. Notable Votes
7. Legislation Introduced
8. Upcoming Schedule
9. Political Context/Analysis
10. Looking Ahead

${data ? `Data: ${JSON.stringify(data)}` : ""}`;
          break;

        case "bill_comparison":
          presentationTitle = title || "Bill Comparison Analysis";
          presentationPrompt = `Create a ${slideCount}-slide comparison of the following bills: ${billIds?.join(", ") || "multiple bills"}.

Include:
1. Title slide
2. Overview of each bill
3. Key similarities
4. Key differences
5. Sponsor analysis
6. Committee status comparison
7. Stakeholder positions
8. Fiscal impact comparison
9. Likelihood of passage
10. Recommendations

${data ? `Data: ${JSON.stringify(data)}` : ""}`;
          break;

        case "voting_analysis":
          presentationTitle = title || "Voting Record Analysis";
          presentationPrompt = `Create a ${slideCount}-slide voting record analysis for representative ${bioguideId || "the selected member"}.

Include:
1. Title slide with member photo and info
2. Voting statistics overview
3. Party alignment scores
4. Key votes on major legislation
5. Policy area breakdown
6. Comparison with party averages
7. District alignment analysis
8. Notable controversial votes
9. Trends over time
10. Summary and conclusions

${data ? `Data: ${JSON.stringify(data)}` : ""}`;
          break;
      }

      const systemPrompt = `You are creating a professional congressional briefing presentation.
Design visually appealing slides with:
- Clear headings
- Bullet points (3-5 per slide)
- Key statistics highlighted
- Non-partisan, factual content
- Professional tone

Format each slide clearly with "Slide X:" headers.`;

      const response = await client.chat.completions.create({
        model: "c1/artifact/v-20251030",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: presentationPrompt },
        ],
        // @ts-expect-error - C1-specific parameter
        artifact_type: "slides",
        artifact_title: presentationTitle,
      });

      const content = response.choices[0]?.message?.content ?? undefined;
      // @ts-expect-error - C1-specific response field
      const artifactId = response.artifact_id;
      // @ts-expect-error - C1-specific response field
      const artifactUrl = response.artifact_url;

      return {
        success: true,
        artifactId,
        artifactUrl,
        artifactType: "slides",
        content,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("THESYS_API_KEY")) {
        return {
          success: false,
          artifactType: "slides",
          error: "C1 Artifacts API not configured. Please set THESYS_API_KEY.",
        };
      }

      return {
        success: false,
        artifactType: "slides",
        error: error instanceof Error ? error.message : "Unknown error generating slides",
      };
    }
  },
});

// Export all C1 Artifacts tools
export const c1ArtifactsTools = {
  generateBillReport: generateBillReportTool,
  generateBriefingSlides: generateBriefingSlidesTool,
};
