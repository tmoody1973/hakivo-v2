import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import OpenAI from "openai";
import {
  generateArtifact,
  editArtifact as editArtifactApi,
  generateArtifactId,
  type ArtifactType,
} from "./thesys";
import {
  saveArtifact as saveArtifactToVultr,
  updateArtifact as updateArtifactInVultr,
  type ArtifactMetadata as VultrArtifactMetadata,
} from "../../lib/vultr-artifacts";

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

// API endpoints
const DB_ADMIN_API = process.env.NEXT_PUBLIC_DASHBOARD_API_URL ||
  "https://svc-01ka8k5e6tr0kgy0jkzj9m4q19.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

// C1 Artifacts client (fallback for legacy code)
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

// Result types
// NOTE: Fields must match what the chat page ArtifactViewer expects:
// id, type, template, title, content, audience
interface ArtifactResult {
  success: boolean;
  id?: string;           // UI expects 'id' not 'artifactId'
  type: ArtifactType;    // UI expects 'type' not 'artifactType'
  template?: string;     // Template used for generation
  title?: string;        // Document title
  content?: string;      // C1 DSL content
  audience?: string;     // Target audience
  shareToken?: string;
  error?: string;
}

/**
 * Save artifact to database and Vultr storage
 */
async function saveArtifactToDatabase(params: {
  id: string;
  userId: string;
  type: ArtifactType;
  template: string;
  title: string;
  content: string;
  subjectType?: string;
  subjectId?: string;
  subjectContext?: Record<string, unknown>;
  audience?: string;
}): Promise<{ success: boolean; vultrKey?: string; error?: string }> {
  try {
    // First, save to Vultr storage
    let vultrKey: string | undefined;
    try {
      const vultrMetadata: VultrArtifactMetadata = {
        type: params.type,
        template: params.template,
        title: params.title,
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        audience: params.audience || "general",
      };

      const vultrResult = await saveArtifactToVultr(
        params.userId,
        params.id,
        params.content,
        vultrMetadata
      );

      if (vultrResult.success && vultrResult.key) {
        vultrKey = vultrResult.key;
      } else {
        console.warn("Failed to save to Vultr:", vultrResult.error);
      }
    } catch (vultrError) {
      console.warn("Vultr storage error (continuing with DB only):", vultrError);
    }

    // Then save to database (with vultr_key if available)
    const response = await fetch(`${DB_ADMIN_API}/artifacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: params.id,
        user_id: params.userId,
        type: params.type,
        template: params.template,
        title: params.title,
        content: params.content,
        subject_type: params.subjectType,
        subject_id: params.subjectId,
        subject_context: params.subjectContext ? JSON.stringify(params.subjectContext) : null,
        audience: params.audience || "general",
        vultr_key: vultrKey,
      }),
    });

    const result = await response.json();
    return { success: result.success, vultrKey, error: result.error };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save artifact",
    };
  }
}

/**
 * Update artifact in database and Vultr storage
 */
async function updateArtifactInDatabase(
  id: string,
  updates: Record<string, unknown>,
  vultrKey?: string,
  vultrMetadata?: VultrArtifactMetadata
): Promise<{ success: boolean; error?: string }> {
  try {
    // If we have a vultr key and updated content, update Vultr storage
    if (vultrKey && updates.content && vultrMetadata) {
      try {
        await updateArtifactInVultr(
          vultrKey,
          updates.content as string,
          vultrMetadata
        );
      } catch (vultrError) {
        console.warn("Vultr storage update error (continuing with DB):", vultrError);
      }
    }

    // Update database
    const response = await fetch(`${DB_ADMIN_API}/artifacts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    const result = await response.json();
    return { success: result.success, error: result.error };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update artifact",
    };
  }
}

// C1 Component guidelines for InlineHeader usage
const C1_STRUCTURE_GUIDELINES = `
## Content Structure Guidelines (C1 Components)

Use InlineHeader components to organize content into clear sections:
- InlineHeader creates visual section breaks with title and optional subtitle
- Use for major sections: "Key Provisions", "Fiscal Impact", "Stakeholder Analysis", etc.
- Follow InlineHeader with List, TextContent, or DataTile components for section content

Example structure:
{"op": "append", "component": "InlineHeader", "props": {"title": "Section Title", "subtitle": "Optional context"}}
{"op": "append", "component": "List", "props": {"variant": "grid"}, "children": [...]}

Use appropriate C1 components:
- InlineHeader: Section headers and content organization
- List: Container for multiple items (variant: "grid", "list", "inline")
- MiniCard: Compact cards with title, subtitle, tags
- DataTile: Key-value displays (label/value pairs)
- StatBlock: Groups of related statistics
- TextContent: Rich text paragraphs
- Tag: Status labels and category badges
- Timeline: Chronological events
- FollowupBlock: Suggested next queries for exploration
`;

// Audience-specific system prompts
const AUDIENCE_PROMPTS: Record<string, string> = {
  general: `Write for a general audience with no assumed expertise.
Use clear, accessible language and explain technical terms.
Focus on practical implications and what matters to everyday citizens.
${C1_STRUCTURE_GUIDELINES}`,

  professional: `Write for policy professionals, lobbyists, and government affairs staff.
Include technical legislative details, procedural context, and strategic analysis.
Use appropriate jargon but remain clear and well-organized.
${C1_STRUCTURE_GUIDELINES}`,

  academic: `Write for researchers, students, and educators.
Include proper citations, theoretical frameworks, and historical context.
Maintain scholarly objectivity and analytical rigor.
${C1_STRUCTURE_GUIDELINES}`,

  journalist: `Write in AP style for news professionals.
Lead with the newsworthy angle and key facts.
Include quotes-worthy sound bites and context for broader coverage.
${C1_STRUCTURE_GUIDELINES}`,

  educator: `Write for teachers and educational contexts.
Include learning objectives, discussion questions, and age-appropriate explanations.
Design content that can be adapted for different grade levels.
${C1_STRUCTURE_GUIDELINES}`,

  advocate: `Write for advocacy organizations and civic activists.
Include clear calls to action, talking points, and mobilization strategies.
Focus on impact and opportunities for constituent engagement.
${C1_STRUCTURE_GUIDELINES}`,
};

// Template system prompts with InlineHeader guidance
const TEMPLATE_PROMPTS: Record<string, string> = {
  bill_analysis: `Generate a comprehensive bill analysis report using InlineHeader components for each section:
1. Executive Summary (InlineHeader + TextContent with 2-3 paragraphs)
2. Key Provisions (InlineHeader + List of MiniCards with explanations)
3. Arguments For and Against (InlineHeader + two-column layout)
4. Fiscal Impact Analysis (InlineHeader + StatBlock with DataTiles)
5. Stakeholder Analysis (InlineHeader + List of stakeholders with positions)
6. Legislative Outlook (InlineHeader + Timeline of expected actions)
Use FollowupBlock at the end with related queries.`,

  rep_scorecard: `Generate a representative profile and scorecard using InlineHeader for each section:
1. Profile Overview (Hero + StatBlock with key stats)
2. Voting Statistics (InlineHeader + DataTiles for party alignment, attendance)
3. Key Votes Analysis (InlineHeader + Timeline of 5-10 significant votes)
4. Policy Priorities (InlineHeader + Tag cloud of focus areas)
5. Committee Assignments (InlineHeader + List of committee cards)
6. Constituent Services (InlineHeader + contact info and resources)
Use FollowupBlock with queries about bills sponsored, voting record.`,

  vote_breakdown: `Generate a vote analysis report using InlineHeader components:
1. Vote Summary (Hero with result, InlineHeader + StatBlock for vote counts)
2. Context and Background (InlineHeader + TextContent)
3. Party Breakdown (InlineHeader + visual breakdown with Tags)
4. Notable Cross-Party Votes (InlineHeader + List of MiniCards)
5. Key Absences (InlineHeader + List)
6. Impact Analysis (InlineHeader + TextContent)`,

  policy_brief: `Generate a policy landscape briefing using InlineHeader sections:
1. Issue Overview (InlineHeader + TextContent)
2. Current Legislative Activity (InlineHeader + List of bills as MiniCards)
3. Key Stakeholders (InlineHeader + grid of stakeholder cards)
4. Recent Developments (InlineHeader + Timeline)
5. Timeline of Major Actions (InlineHeader + Timeline component)
6. Outlook and Predictions (InlineHeader + TextContent)
Include FollowupBlock with queries about related bills and news.`,

  lesson_deck: `Generate an educational slide deck with InlineHeader sections:
1. Learning Objectives (InlineHeader + bullet List)
2. Key Vocabulary (InlineHeader + definition cards)
3. Background Context (InlineHeader + TextContent)
4. Main Content (InlineHeader for each of 3-5 core concepts)
5. Discussion Questions (InlineHeader + numbered List)
6. Activities and Assignments (InlineHeader + task cards)
7. Additional Resources (InlineHeader + resource links)`,

  advocacy_deck: `Generate an advocacy presentation with InlineHeader sections:
1. The Problem (InlineHeader + impactful statistics)
2. The Solution (InlineHeader + bill/policy summary)
3. Why Now (InlineHeader + urgency factors)
4. Success Stories (InlineHeader + case study cards)
5. Opposition Arguments & Responses (InlineHeader + two-column layout)
6. Call to Action (InlineHeader + action steps)
7. Next Steps (InlineHeader + timeline)`,

  news_brief: `Generate a news-style brief with InlineHeader sections:
1. Headline (Hero component)
2. Lead Paragraph (InlineHeader "Key Story" + TextContent with who, what, when, where, why)
3. Key Facts (InlineHeader + StatBlock or bullet List)
4. Quotes/Reactions (InlineHeader + quote cards)
5. Background (InlineHeader + TextContent)
6. What's Next (InlineHeader + upcoming events/timeline)
Include FollowupBlock with related news queries.`,
};

/**
 * Create Artifact Tool
 *
 * The main orchestrator tool for generating documents.
 * Works with context gathered by other agent tools.
 */
export const createArtifactTool = createTool({
  id: "createArtifact",
  description: `Generate an interactive document (report or slides) using C1 Artifacts.

IMPORTANT: After calling this tool, DO NOT include the artifact content in your response.
The frontend automatically renders the artifact. Just say something like "Here's your report."

Use this AFTER gathering relevant data with other tools.

Templates: bill_analysis, rep_scorecard, vote_breakdown, policy_brief, lesson_deck, advocacy_deck, news_brief
Audiences: general, professional, academic, journalist, educator, advocate`,
  inputSchema: z.object({
    type: z.enum(["report", "slides"]).describe("Document type"),
    template: z.enum([
      "bill_analysis",
      "rep_scorecard",
      "vote_breakdown",
      "policy_brief",
      "lesson_deck",
      "advocacy_deck",
      "news_brief",
    ]).describe("Template to use"),
    title: z.string().describe("Document title"),
    audience: z.enum([
      "general",
      "professional",
      "academic",
      "journalist",
      "educator",
      "advocate",
    ]).optional().default("general").describe("Target audience"),
    context: z.string().describe("The context/data to include in the document (from other tools)"),
    subjectType: z.enum(["bill", "member", "vote", "committee", "custom"]).optional()
      .describe("Type of subject being documented"),
    subjectId: z.string().optional().describe("ID of the subject (bill_id, bioguide_id, etc.)"),
    userId: z.string().optional().describe("User ID for saving the artifact"),
  }),
  execute: async ({ context: params }): Promise<ArtifactResult> => {
    const {
      type,
      template,
      title,
      audience = "general",
      context,
      subjectType,
      subjectId,
      userId,
    } = params;

    try {
      // Generate artifact ID
      const artifactId = generateArtifactId();

      // Build system prompt combining audience and template
      const audiencePrompt = AUDIENCE_PROMPTS[audience] || AUDIENCE_PROMPTS.general;
      const templatePrompt = TEMPLATE_PROMPTS[template] || "";

      const systemPrompt = `You are an expert congressional analyst creating professional documents using C1 components.

${audiencePrompt}

${templatePrompt}

IMPORTANT: Structure your output using InlineHeader components to create clear visual sections.
Each major section should start with an InlineHeader followed by appropriate content components.
Be objective, factual, and non-partisan. Use clear structure and formatting.`;

      const userPrompt = `Create a ${type === "slides" ? "slide presentation" : "report"} with the title: "${title}"

Here is the context and data to include:

${context}

Generate a well-structured, professional document based on this information.`;

      // Generate artifact via Thesys API
      const result = await generateArtifact({
        id: artifactId,
        type,
        systemPrompt,
        userPrompt,
      });

      // Save to database if userId provided
      if (userId && result.content) {
        await saveArtifactToDatabase({
          id: artifactId,
          userId,
          type,
          template,
          title,
          content: result.content,
          subjectType,
          subjectId,
          audience,
        });
      }

      return {
        success: true,
        id: artifactId,
        type,
        template,
        title,
        content: result.content,
        audience,
      };
    } catch (error) {
      return {
        success: false,
        type,
        error: error instanceof Error ? error.message : "Unknown error generating artifact",
      };
    }
  },
});

/**
 * Edit Artifact Tool
 *
 * Modify an existing artifact based on user instructions.
 */
export const editArtifactTool = createTool({
  id: "editArtifact",
  description: `Edit an existing artifact based on user instructions.

IMPORTANT: After calling this tool, DO NOT include the artifact content in your response.
The frontend automatically renders the updated artifact. Just confirm the edit was made.

Use this when a user wants to modify, update, or refine an existing document.`,
  inputSchema: z.object({
    artifactId: z.string().describe("ID of the artifact to edit"),
    existingContent: z.string().describe("The current artifact content (C1 DSL)"),
    editInstructions: z.string().describe("Instructions for how to modify the artifact"),
    type: z.enum(["report", "slides"]).describe("Document type"),
    userId: z.string().optional().describe("User ID for updating the saved artifact"),
  }),
  execute: async ({ context: params }): Promise<ArtifactResult> => {
    const { artifactId, existingContent, editInstructions, type, userId } = params;

    try {
      const result = await editArtifactApi({
        id: artifactId,
        type,
        existingContent,
        editInstructions,
      });

      // Update in database if userId provided
      if (userId && result.content) {
        await updateArtifactInDatabase(artifactId, {
          content: result.content,
        });
      }

      return {
        success: true,
        id: artifactId,
        type,
        content: result.content,
      };
    } catch (error) {
      return {
        success: false,
        type,
        error: error instanceof Error ? error.message : "Unknown error editing artifact",
      };
    }
  },
});

/**
 * Generate Bill Report Tool
 *
 * Creates a comprehensive bill analysis report using C1 Artifacts.
 */
export const generateBillReportTool = createTool({
  id: "generateBillReport",
  description: `Generate a comprehensive bill analysis report using C1 Artifacts.

IMPORTANT: After calling this tool, DO NOT include the artifact content in your response.
The frontend automatically renders the report. Just say "Here's your bill analysis."

The report includes executive summary, key provisions, fiscal impact, stakeholder analysis, legislative history, and voting predictions.`,
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
    audience: z.enum(["general", "professional", "academic", "journalist"]).optional()
      .default("general").describe("Target audience"),
    userId: z.string().optional().describe("User ID for saving"),
  }),
  execute: async ({ context }): Promise<ArtifactResult> => {
    const { billId, billData, sections, format = "detailed", audience = "general", userId } = context;

    try {
      const artifactId = generateArtifactId();

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

      const audiencePrompt = AUDIENCE_PROMPTS[audience] || AUDIENCE_PROMPTS.general;

      const systemPrompt = `You are an expert congressional analyst creating a professional bill analysis report using C1 components.

${audiencePrompt}

${formatInstruction}

CRITICAL: Use InlineHeader components to create clear visual sections for each part of the report.
Each section (Executive Summary, Key Provisions, etc.) should start with an InlineHeader.
Follow InlineHeaders with appropriate content: TextContent for paragraphs, List for items, StatBlock for data.
Include a FollowupBlock at the end with suggested queries about the bill's sponsor, cosponsors, or related legislation.

Be objective, factual, and non-partisan.`;

      const userPrompt = `Generate a comprehensive bill analysis report for the following legislation:

${billContext}

Please include the following sections:

${sectionInstructions}

Format the report professionally with clear headings and structured content.`;

      const result = await generateArtifact({
        id: artifactId,
        type: "report",
        systemPrompt,
        userPrompt,
      });

      // Save to database
      if (userId && result.content) {
        await saveArtifactToDatabase({
          id: artifactId,
          userId,
          type: "report",
          template: "bill_analysis",
          title: `Bill Analysis: ${billData?.title || billId}`,
          content: result.content,
          subjectType: "bill",
          subjectId: String(billId),
          subjectContext: billData ? { ...billData } : undefined,
          audience,
        });
      }

      return {
        success: true,
        id: artifactId,
        type: "report" as const,
        template: "bill_analysis",
        title: `Bill Analysis: ${billData?.title || billId}`,
        content: result.content,
        audience,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("THESYS_API_KEY")) {
        return {
          success: false,
          type: "report" as const,
          error: "C1 Artifacts API not configured. Please set THESYS_API_KEY.",
        };
      }

      return {
        success: false,
        type: "report" as const,
        error: error instanceof Error ? error.message : "Unknown error generating report",
      };
    }
  },
});

/**
 * Generate Briefing Slides Tool
 *
 * Creates slide presentations using C1 Artifacts.
 */
export const generateBriefingSlidesTool = createTool({
  id: "generateBriefingSlides",
  description: `Generate slide presentations using C1 Artifacts.

IMPORTANT: After calling this tool, DO NOT include the artifact content in your response.
The frontend automatically renders the slides. Just say "Here's your presentation."

Types: district_briefing, week_in_congress, bill_comparison, voting_analysis`,
  inputSchema: z.object({
    presentationType: z.enum([
      "district_briefing",
      "week_in_congress",
      "bill_comparison",
      "voting_analysis",
    ]).describe("Type of presentation to generate"),
    title: z.string().optional().describe("Presentation title"),
    state: z.string().optional().describe("State code for district briefing"),
    district: z.number().optional().describe("Congressional district number"),
    weekStart: z.string().optional().describe("Start date for week summary (ISO format)"),
    billIds: z.array(z.string()).optional().describe("Bill IDs to compare"),
    bioguideId: z.string().optional().describe("Bioguide ID for voting analysis"),
    data: z.record(z.unknown()).optional().describe("Pre-fetched data for the presentation"),
    slideCount: z.number().optional().default(10).describe("Target number of slides"),
    audience: z.enum(["general", "professional", "academic", "educator"]).optional()
      .default("general").describe("Target audience"),
    userId: z.string().optional().describe("User ID for saving"),
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
      audience = "general",
      userId,
    } = context;

    try {
      const artifactId = generateArtifactId();

      // Build presentation-specific prompts
      let presentationTitle = title;
      let presentationPrompt = "";
      let subjectType: "bill" | "member" | "vote" | "committee" | "custom" = "custom";
      let subjectId: string | undefined;

      switch (presentationType) {
        case "district_briefing":
          presentationTitle = title || `District Briefing: ${state}-${district}`;
          subjectType = "custom";
          subjectId = `${state}-${district}`;
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
          subjectType = "custom";
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
          subjectType = "bill";
          subjectId = billIds?.join(",");
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
          subjectType = "member";
          subjectId = bioguideId;
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

      const audiencePrompt = AUDIENCE_PROMPTS[audience] || AUDIENCE_PROMPTS.general;

      const systemPrompt = `You are creating a professional congressional briefing presentation using C1 components.

${audiencePrompt}

Design visually appealing slides with:
- Clear headings using InlineHeader components for each major section
- Bullet points (3-5 per slide) using List components
- Key statistics highlighted using StatBlock and DataTile components
- Non-partisan, factual content
- Professional tone

IMPORTANT: Use InlineHeader to introduce each slide's topic.
Use appropriate C1 components: MiniCard for entity cards, Tag for labels, Timeline for sequences.
Include a FollowupBlock at the end with suggested next queries.`;

      const result = await generateArtifact({
        id: artifactId,
        type: "slides",
        systemPrompt,
        userPrompt: presentationPrompt,
      });

      // Save to database
      if (userId && result.content) {
        await saveArtifactToDatabase({
          id: artifactId,
          userId,
          type: "slides",
          template: presentationType,
          title: presentationTitle || "Briefing Slides",
          content: result.content,
          subjectType,
          subjectId,
          subjectContext: data ? { ...data } : undefined,
          audience,
        });
      }

      return {
        success: true,
        id: artifactId,
        type: "slides" as const,
        template: presentationType,
        title: presentationTitle || "Briefing Slides",
        content: result.content,
        audience,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("THESYS_API_KEY")) {
        return {
          success: false,
          type: "slides" as const,
          error: "C1 Artifacts API not configured. Please set THESYS_API_KEY.",
        };
      }

      return {
        success: false,
        type: "slides" as const,
        error: error instanceof Error ? error.message : "Unknown error generating slides",
      };
    }
  },
});

// Export all C1 Artifacts tools
export const c1ArtifactsTools = {
  createArtifact: createArtifactTool,
  editArtifact: editArtifactTool,
  generateBillReport: generateBillReportTool,
  generateBriefingSlides: generateBriefingSlidesTool,
};
