/**
 * Thesys Artifact API Integration
 *
 * OpenAI-compatible client for generating interactive documents
 * using the Thesys C1 DSL format (reports and slides).
 *
 * API Docs: https://docs.thesys.dev/guides/artifacts/generating
 */

import OpenAI from "openai";
import type { RunnableToolFunctionWithParse } from "openai/lib/RunnableFunction";

// Thesys API configuration - Different endpoints for different purposes
// Artifact endpoint - for generating C1 DSL documents (reports, slides)
const THESYS_ARTIFACT_BASE = "https://api.thesys.dev/v1/artifact";
const THESYS_ARTIFACT_MODEL = "c1/artifact/v-20251030";

// Embed/Chat endpoint - for tool calling and chat completions
const THESYS_EMBED_BASE = "https://api.thesys.dev/v1/embed";
const THESYS_CHAT_MODEL = "c1/anthropic/claude-sonnet-4/v-20251130"; // Latest stable - supports tool calling

// Lazy-initialized OpenAI clients for Thesys (separate clients for different endpoints)
let _thesysArtifactClient: OpenAI | null = null;
let _thesysEmbedClient: OpenAI | null = null;
let _lastApiKey: string | null = null;

function getThesysArtifactClient(): OpenAI {
  const apiKey = process.env.THESYS_API_KEY;
  if (!apiKey) {
    throw new Error("THESYS_API_KEY environment variable is not set");
  }

  if (!_thesysArtifactClient || _lastApiKey !== apiKey) {
    _thesysArtifactClient = new OpenAI({
      baseURL: THESYS_ARTIFACT_BASE,
      apiKey,
    });
    _lastApiKey = apiKey;
  }

  return _thesysArtifactClient;
}

function getThesysEmbedClient(): OpenAI {
  const apiKey = process.env.THESYS_API_KEY;
  if (!apiKey) {
    throw new Error("THESYS_API_KEY environment variable is not set");
  }

  if (!_thesysEmbedClient || _lastApiKey !== apiKey) {
    _thesysEmbedClient = new OpenAI({
      baseURL: THESYS_EMBED_BASE,
      apiKey,
    });
    _lastApiKey = apiKey;
  }

  return _thesysEmbedClient;
}

// Backwards compatibility alias
function getThesysClient(): OpenAI {
  return getThesysArtifactClient();
}

/**
 * Supported artifact types
 */
export type ArtifactType = "slides" | "report";

/**
 * Custom action schema for C1 artifacts
 */
export interface CustomActionSchema {
  type: "string" | "number" | "boolean";
  description: string;
  enum?: string[];
}

/**
 * Custom action definition for C1 artifacts
 */
export interface CustomAction {
  description: string;
  parameters: Record<string, CustomActionSchema>;
}

/**
 * Predefined custom actions for Hakivo congressional artifacts
 */
export const HAKIVO_CUSTOM_ACTIONS: Record<string, CustomAction> = {
  track_bill: {
    description: "Add a bill to the user's tracked legislation list",
    parameters: {
      billId: { type: "string", description: "The bill identifier (e.g., hr-123-119)" },
      billTitle: { type: "string", description: "The title of the bill" },
    },
  },
  view_bill_details: {
    description: "View comprehensive details about a specific bill",
    parameters: {
      billId: { type: "string", description: "The bill identifier" },
    },
  },
  view_sponsor: {
    description: "View details about a bill's sponsor",
    parameters: {
      bioguideId: { type: "string", description: "The bioguide ID of the sponsor" },
      name: { type: "string", description: "Name of the sponsor" },
    },
  },
  share_result: {
    description: "Share the current result via link or social media",
    parameters: {
      shareType: { type: "string", description: "Type of share", enum: ["link", "twitter", "email"] },
      content: { type: "string", description: "Content to share" },
    },
  },
  explore_related: {
    description: "Explore related bills or topics",
    parameters: {
      query: { type: "string", description: "The search query for related content" },
      type: { type: "string", description: "Type of content", enum: ["bills", "news", "members"] },
    },
  },
  download_report: {
    description: "Download the current artifact as a document",
    parameters: {
      format: { type: "string", description: "Download format", enum: ["pdf", "docx", "md"] },
    },
  },
};

/**
 * Artifact generation options
 */
export interface ArtifactGenerationOptions {
  /** Unique identifier for the artifact (required for edits) */
  id: string;
  /** Type of artifact to generate */
  type: ArtifactType;
  /** System prompt for high-level generation instructions */
  systemPrompt: string;
  /** User prompt with context and requirements */
  userPrompt: string;
  /** Optional: Enable streaming response */
  stream?: boolean;
  /** Optional: Custom actions to enable for this artifact */
  customActions?: Record<string, CustomAction>;
  /** Optional: Follow-up suggestions context */
  followUpContext?: {
    billId?: string;
    sponsorId?: string;
    policyArea?: string;
  };
}

/**
 * Artifact edit options
 */
export interface ArtifactEditOptions {
  /** ID of the artifact to edit */
  id: string;
  /** Type of artifact */
  type: ArtifactType;
  /** The existing artifact content (C1 DSL) */
  existingContent: string;
  /** Instructions for how to modify the artifact */
  editInstructions: string;
  /** System prompt for editing behavior */
  systemPrompt?: string;
}

/**
 * Generated artifact result
 */
export interface ArtifactResult {
  /** The generated C1 DSL content */
  content: string;
  /** Artifact ID */
  id: string;
  /** Artifact type */
  type: ArtifactType;
  /** Token usage information */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Generate an artifact using the Thesys API
 *
 * @param options - Generation options including prompts and artifact type
 * @returns The generated artifact with C1 DSL content
 */
export async function generateArtifact(
  options: ArtifactGenerationOptions
): Promise<ArtifactResult> {
  const { id, type, systemPrompt, userPrompt, stream = false } = options;

  if (!process.env.THESYS_API_KEY) {
    throw new Error("THESYS_API_KEY environment variable is not set");
  }

  try {
    if (stream) {
      // For streaming, return a generator
      throw new Error("Use generateArtifactStream for streaming responses");
    }

    // Build Thesys metadata (only artifact type and id are supported)
    const thesysMetadata: Record<string, unknown> = {
      c1_artifact_type: type,
      id: id,
    };

    const response = await getThesysClient().chat.completions.create({
      model: THESYS_ARTIFACT_MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      // @ts-ignore - Thesys uses metadata for C1 config
      metadata: {
        thesys: JSON.stringify(thesysMetadata),
      },
    });

    const content = response.choices[0]?.message?.content || "";

    return {
      content,
      id,
      type,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new Error(`Thesys API error: ${error.message} (${error.status})`);
    }
    throw error;
  }
}

/**
 * Generate an artifact with streaming response
 *
 * @param options - Generation options
 * @yields Chunks of C1 DSL content as they're generated
 */
export async function* generateArtifactStream(
  options: ArtifactGenerationOptions
): AsyncGenerator<string, ArtifactResult, unknown> {
  const { id, type, systemPrompt, userPrompt } = options;

  if (!process.env.THESYS_API_KEY) {
    throw new Error("THESYS_API_KEY environment variable is not set");
  }

  try {
    const stream = await getThesysClient().chat.completions.create({
      model: THESYS_ARTIFACT_MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      stream: true,
      // @ts-ignore - Thesys uses metadata for C1 config
      metadata: {
        thesys: JSON.stringify({
          c1_artifact_type: type,
          id: id,
        }),
      },
    });

    let fullContent = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullContent += content;
        yield content;
      }
    }

    return {
      content: fullContent,
      id,
      type,
    };
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new Error(`Thesys API error: ${error.message} (${error.status})`);
    }
    throw error;
  }
}

/**
 * Edit an existing artifact using the Thesys API
 *
 * @param options - Edit options including existing content and instructions
 * @returns The updated artifact with new C1 DSL content
 */
export async function editArtifact(
  options: ArtifactEditOptions
): Promise<ArtifactResult> {
  const {
    id,
    type,
    existingContent,
    editInstructions,
    systemPrompt = "You are an expert document editor. Modify the provided artifact according to the user's instructions while maintaining the document's structure and style.",
  } = options;

  if (!process.env.THESYS_API_KEY) {
    throw new Error("THESYS_API_KEY environment variable is not set");
  }

  try {
    const response = await getThesysClient().chat.completions.create({
      model: THESYS_ARTIFACT_MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Here is the existing artifact to edit:\n\n${existingContent}\n\n---\n\nEdit instructions: ${editInstructions}`,
        },
      ],
      // @ts-ignore - Thesys uses metadata for C1 config
      metadata: {
        thesys: JSON.stringify({
          c1_artifact_type: type,
          id: id,
        }),
      },
    });

    const content = response.choices[0]?.message?.content || "";

    return {
      content,
      id,
      type,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new Error(`Thesys API error: ${error.message} (${error.status})`);
    }
    throw error;
  }
}

/**
 * Edit an artifact with streaming response
 *
 * @param options - Edit options
 * @yields Chunks of updated C1 DSL content as they're generated
 */
export async function* editArtifactStream(
  options: ArtifactEditOptions
): AsyncGenerator<string, ArtifactResult, unknown> {
  const {
    id,
    type,
    existingContent,
    editInstructions,
    systemPrompt = "You are an expert document editor. Modify the provided artifact according to the user's instructions while maintaining the document's structure and style.",
  } = options;

  if (!process.env.THESYS_API_KEY) {
    throw new Error("THESYS_API_KEY environment variable is not set");
  }

  try {
    const stream = await getThesysClient().chat.completions.create({
      model: THESYS_ARTIFACT_MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Here is the existing artifact to edit:\n\n${existingContent}\n\n---\n\nEdit instructions: ${editInstructions}`,
        },
      ],
      stream: true,
      // @ts-ignore - Thesys uses metadata for C1 config
      metadata: {
        thesys: JSON.stringify({
          c1_artifact_type: type,
          id: id,
        }),
      },
    });

    let fullContent = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullContent += content;
        yield content;
      }
    }

    return {
      content: fullContent,
      id,
      type,
    };
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new Error(`Thesys API error: ${error.message} (${error.status})`);
    }
    throw error;
  }
}

/**
 * Validate that an artifact ID is in the correct format
 */
export function validateArtifactId(id: string): boolean {
  // IDs should be alphanumeric with hyphens, reasonable length
  return /^[a-zA-Z0-9-]{8,64}$/.test(id);
}

/**
 * Generate a unique artifact ID
 */
export function generateArtifactId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `art-${timestamp}-${random}`;
}

// =============================================================================
// THESYS TOOL CALLING - Native tool integration for data-driven artifacts
// =============================================================================

const RAINDROP_ADMIN_URL = "https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";
const BILLS_SERVICE_URL = "https://svc-01ka8k5e6tr0kgy0jkzj9m4q16.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

/**
 * Search bills in the Hakivo database
 */
async function searchBillsFunction(query: string, policyArea?: string, limit?: number): Promise<string> {
  try {
    const sqlQuery = policyArea
      ? `SELECT bill_type, bill_number, congress, title, short_title, sponsor_name, sponsor_party, sponsor_state, policy_area, latest_action_text, latest_action_date
         FROM bills
         WHERE congress = 119 AND policy_area ILIKE '%${policyArea}%'
         ORDER BY latest_action_date DESC NULLS LAST
         LIMIT ${limit || 10}`
      : `SELECT bill_type, bill_number, congress, title, short_title, sponsor_name, sponsor_party, sponsor_state, policy_area, latest_action_text, latest_action_date
         FROM bills
         WHERE congress = 119 AND (title ILIKE '%${query}%' OR short_title ILIKE '%${query}%' OR policy_area ILIKE '%${query}%')
         ORDER BY latest_action_date DESC NULLS LAST
         LIMIT ${limit || 10}`;

    const response = await fetch(`${RAINDROP_ADMIN_URL}/api/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: sqlQuery }),
    });

    if (!response.ok) {
      return JSON.stringify({ error: `Database error: ${response.status}`, bills: [] });
    }

    const data = await response.json();
    return JSON.stringify({
      success: true,
      count: data.rows?.length || 0,
      bills: data.rows || [],
    });
  } catch (error) {
    return JSON.stringify({ error: String(error), bills: [] });
  }
}

/**
 * Search news using Gemini with Google Search grounding
 * Replaces Perplexity for better results and inline citations
 */
async function searchNewsFunction(query: string, focus?: string): Promise<string> {
  // Import dynamically to avoid circular dependencies
  const { searchWithGemini } = await import("./gemini-search");

  try {
    const searchFocus = focus === "policy" ? "policy" : focus === "general" ? "general" : "news";
    const result = await searchWithGemini(query, {
      focus: searchFocus as "news" | "general" | "policy",
      maxArticles: 10
    });

    if (!result.success) {
      return JSON.stringify({
        error: result.error || "Gemini search failed",
        articles: []
      });
    }

    return JSON.stringify({
      success: true,
      summary: result.summaryWithCitations || result.summary,
      count: result.articles.length,
      articles: result.articles,
      citations: result.citations,
      keyFindings: result.keyFindings,
      relatedTopics: result.relatedTopics,
      c1Template: result.c1Template,
    });
  } catch (error) {
    return JSON.stringify({ error: String(error), articles: [] });
  }
}

/**
 * Semantic search bills using SmartBucket (vector similarity)
 */
async function semanticSearchBillsFunction(query: string, limit?: number, congress?: number): Promise<string> {
  try {
    const response = await fetch(`${BILLS_SERVICE_URL}/bills/semantic-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        limit: limit || 10,
        congress: congress || 119,
      }),
    });

    if (!response.ok) {
      return JSON.stringify({ error: `Semantic search failed: ${response.status}`, bills: [] });
    }

    const result = await response.json();
    const bills = result.bills || [];

    return JSON.stringify({
      success: true,
      count: bills.length,
      bills: bills.map((bill: Record<string, unknown>) => ({
        bill_id: `${bill.congress}-${bill.bill_type}-${bill.bill_number}`,
        title: bill.title,
        short_title: bill.short_title,
        sponsor: bill.sponsor_name
          ? `${bill.sponsor_name} (${bill.sponsor_party}-${bill.sponsor_state})`
          : null,
        policy_area: bill.policy_area,
        similarity_score: bill.similarity_score,
        latest_action: bill.latest_action_text,
        latest_action_date: bill.latest_action_date,
      })),
    });
  } catch (error) {
    return JSON.stringify({ error: String(error), bills: [] });
  }
}

/**
 * Search congressional members/representatives
 */
async function searchMembersFunction(
  query?: string,
  state?: string,
  party?: string,
  chamber?: string
): Promise<string> {
  try {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (state) params.set("state", state);
    if (party) params.set("party", party);
    if (chamber) params.set("chamber", chamber);
    params.set("currentOnly", "true");
    params.set("limit", "20");

    const response = await fetch(`${BILLS_SERVICE_URL}/members/search?${params.toString()}`);

    if (!response.ok) {
      return JSON.stringify({ error: `Member search failed: ${response.status}`, members: [] });
    }

    const result = await response.json();
    const members = result.members || result || [];

    return JSON.stringify({
      success: true,
      count: members.length,
      members: members.map((m: Record<string, unknown>) => ({
        bioguide_id: m.bioguide_id,
        name: m.name || `${m.first_name} ${m.last_name}`,
        party: m.party,
        state: m.state,
        district: m.district,
        chamber: m.chamber,
        title: m.title,
        photo_url: m.image_url || m.photo_url,
        office: m.office_address,
        phone: m.phone,
        website: m.url,
      })),
    });
  } catch (error) {
    return JSON.stringify({ error: String(error), members: [] });
  }
}

/**
 * Get latest actions on federal bills (most recent legislative activity)
 */
async function getLatestActionsFunction(limit?: number, policyArea?: string): Promise<string> {
  try {
    const sqlQuery = policyArea
      ? `SELECT bill_type, bill_number, congress, title, short_title, sponsor_name, sponsor_party, sponsor_state, policy_area, latest_action_text, latest_action_date
         FROM bills
         WHERE congress = 119 AND policy_area ILIKE '%${policyArea}%' AND latest_action_date IS NOT NULL
         ORDER BY latest_action_date DESC
         LIMIT ${limit || 15}`
      : `SELECT bill_type, bill_number, congress, title, short_title, sponsor_name, sponsor_party, sponsor_state, policy_area, latest_action_text, latest_action_date
         FROM bills
         WHERE congress = 119 AND latest_action_date IS NOT NULL
         ORDER BY latest_action_date DESC
         LIMIT ${limit || 15}`;

    const response = await fetch(`${RAINDROP_ADMIN_URL}/api/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: sqlQuery }),
    });

    if (!response.ok) {
      return JSON.stringify({ error: `Database error: ${response.status}`, bills: [] });
    }

    const data = await response.json();
    const bills = data.rows || [];

    return JSON.stringify({
      success: true,
      count: bills.length,
      bills: bills.map((bill: Record<string, unknown>) => ({
        bill_id: `${bill.bill_type}-${bill.bill_number}`,
        title: bill.title || bill.short_title,
        sponsor: bill.sponsor_name
          ? `${bill.sponsor_name} (${bill.sponsor_party}-${bill.sponsor_state})`
          : null,
        policy_area: bill.policy_area,
        latest_action: bill.latest_action_text,
        latest_action_date: bill.latest_action_date,
      })),
    });
  } catch (error) {
    return JSON.stringify({ error: String(error), bills: [] });
  }
}

/**
 * Search state bills using OpenStates API
 */
async function searchStateBillsFunction(
  state: string,
  query?: string,
  subject?: string,
  limit?: number
): Promise<string> {
  try {
    const params = new URLSearchParams({
      state: state.toUpperCase(),
      limit: String(limit || 15),
      sort: "latest_action_date",
      order: "desc",
    });

    if (query) params.set("query", query);
    if (subject) params.set("subject", subject);

    const response = await fetch(`${BILLS_SERVICE_URL}/state-bills?${params.toString()}`);

    if (!response.ok) {
      return JSON.stringify({ error: `State bills search failed: ${response.status}`, bills: [] });
    }

    const result = await response.json();
    const bills = result.bills || [];

    return JSON.stringify({
      success: true,
      state: state.toUpperCase(),
      count: bills.length,
      bills: bills.map((bill: Record<string, unknown>) => ({
        id: bill.id,
        identifier: bill.identifier,
        title: bill.title,
        session: bill.session,
        subjects: bill.subjects || [],
        chamber: bill.chamber,
        latest_action: (bill.latestAction as Record<string, unknown>)?.description,
        latest_action_date: (bill.latestAction as Record<string, unknown>)?.date,
        openstates_url: bill.openstatesUrl,
      })),
    });
  } catch (error) {
    return JSON.stringify({ error: String(error), bills: [] });
  }
}

/**
 * Thesys-compatible tool definitions for artifact generation
 */
export function getThesysTools() {
  return [
    {
      type: "function" as const,
      function: {
        name: "search_bills",
        description: "Search for US congressional bills in the Hakivo database. Returns bill titles, sponsors, policy areas, and latest actions.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for bills (e.g., 'artificial intelligence', 'healthcare', 'education')",
            },
            policy_area: {
              type: "string",
              description: "Optional policy area filter (e.g., 'Science, Technology, Communications', 'Health', 'Education')",
            },
            limit: {
              type: "number",
              description: "Maximum number of bills to return (default: 10)",
            },
          },
          required: ["query"],
        },
        parse: (input: string) => JSON.parse(input) as { query: string; policy_area?: string; limit?: number },
        function: async (args: { query: string; policy_area?: string; limit?: number }) => {
          console.log("[Thesys Tool] search_bills called with:", args);
          return searchBillsFunction(args.query, args.policy_area, args.limit);
        },
        strict: true,
      },
    },
    {
      type: "function" as const,
      function: {
        name: "search_news",
        description: "Search the web for news and information using Google Search with Gemini AI. Returns comprehensive results with inline citations, article list, and key findings. Best for current events, policy news, and research with citations.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for news (e.g., 'AI policy congress', 'healthcare reform news', 'climate legislation 2025')",
            },
            focus: {
              type: "string",
              enum: ["news", "general", "policy"],
              description: "Search focus: 'news' for recent articles, 'policy' for government/legislative sources, 'general' for comprehensive web search (default: news)",
            },
          },
          required: ["query"],
        },
        parse: (input: string) => JSON.parse(input) as { query: string; focus?: string },
        function: async (args: { query: string; focus?: string }) => {
          console.log("[Thesys Tool] search_news called with:", args);
          return searchNewsFunction(args.query, args.focus);
        },
        strict: true,
      },
    },
    {
      type: "function" as const,
      function: {
        name: "semantic_search_bills",
        description: "Search for bills using semantic similarity (meaning-based matching). Better for finding related legislation even when exact keywords don't match. Uses AI embeddings to understand intent.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Natural language query describing what you're looking for (e.g., 'legislation protecting endangered species', 'tax incentives for renewable energy')",
            },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 10)",
            },
            congress: {
              type: "number",
              description: "Congress number to search (default: 119 for current)",
            },
          },
          required: ["query"],
        },
        parse: (input: string) => JSON.parse(input) as { query: string; limit?: number; congress?: number },
        function: async (args: { query: string; limit?: number; congress?: number }) => {
          console.log("[Thesys Tool] semantic_search_bills called with:", args);
          return semanticSearchBillsFunction(args.query, args.limit, args.congress);
        },
        strict: true,
      },
    },
    {
      type: "function" as const,
      function: {
        name: "search_members",
        description: "Search for congressional representatives and senators. Find members by name, state, party, or chamber.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search by member name (e.g., 'Pelosi', 'Ted Cruz')",
            },
            state: {
              type: "string",
              description: "Two-letter state code (e.g., 'CA', 'TX', 'NY')",
            },
            party: {
              type: "string",
              enum: ["D", "R", "I"],
              description: "Party: D for Democrat, R for Republican, I for Independent",
            },
            chamber: {
              type: "string",
              enum: ["house", "senate"],
              description: "Chamber: house or senate",
            },
          },
        },
        parse: (input: string) => JSON.parse(input) as { query?: string; state?: string; party?: string; chamber?: string },
        function: async (args: { query?: string; state?: string; party?: string; chamber?: string }) => {
          console.log("[Thesys Tool] search_members called with:", args);
          return searchMembersFunction(args.query, args.state, args.party, args.chamber);
        },
        strict: true,
      },
    },
    {
      type: "function" as const,
      function: {
        name: "get_latest_actions",
        description: "Get the most recent legislative actions on federal bills. Shows what bills have had recent activity in Congress.",
        parameters: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of recent actions to return (default: 15)",
            },
            policy_area: {
              type: "string",
              description: "Filter by policy area (e.g., 'Health', 'Education', 'Defense')",
            },
          },
        },
        parse: (input: string) => JSON.parse(input) as { limit?: number; policy_area?: string },
        function: async (args: { limit?: number; policy_area?: string }) => {
          console.log("[Thesys Tool] get_latest_actions called with:", args);
          return getLatestActionsFunction(args.limit, args.policy_area);
        },
        strict: true,
      },
    },
    {
      type: "function" as const,
      function: {
        name: "search_state_bills",
        description: "Search for state-level legislation from any US state legislature. Uses OpenStates API data.",
        parameters: {
          type: "object",
          properties: {
            state: {
              type: "string",
              description: "State abbreviation (e.g., 'CA', 'TX', 'NY') - REQUIRED",
            },
            query: {
              type: "string",
              description: "Search query for bill text or title",
            },
            subject: {
              type: "string",
              description: "Subject/policy area filter (e.g., 'healthcare', 'education', 'environment')",
            },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 15)",
            },
          },
          required: ["state"],
        },
        parse: (input: string) => JSON.parse(input) as { state: string; query?: string; subject?: string; limit?: number },
        function: async (args: { state: string; query?: string; subject?: string; limit?: number }) => {
          console.log("[Thesys Tool] search_state_bills called with:", args);
          return searchStateBillsFunction(args.state, args.query, args.subject, args.limit);
        },
        strict: true,
      },
    },
  ];
}

/**
 * Pre-fetch data directly using tool functions - bypasses Thesys tool calling
 * This ensures we always get real data from our APIs
 */
async function prefetchDataForArtifact(userPrompt: string): Promise<string> {
  console.log("[Thesys Pre-fetch] Starting direct data gathering for:", userPrompt.substring(0, 100));

  const results: string[] = [];

  // Extract potential topics from the prompt
  const topicKeywords = userPrompt.toLowerCase();
  const isAI = topicKeywords.includes("ai") || topicKeywords.includes("artificial intelligence");
  const isHealth = topicKeywords.includes("health") || topicKeywords.includes("medical") || topicKeywords.includes("healthcare");
  const isDefense = topicKeywords.includes("defense") || topicKeywords.includes("military") || topicKeywords.includes("national security");
  const isEducation = topicKeywords.includes("education") || topicKeywords.includes("school");
  const isEnvironment = topicKeywords.includes("environment") || topicKeywords.includes("climate") || topicKeywords.includes("energy");

  // Build search queries based on detected topics
  const searchQueries: string[] = [];
  if (isAI) searchQueries.push("artificial intelligence");
  if (isHealth) searchQueries.push("healthcare");
  if (isDefense) searchQueries.push("defense");
  if (isEducation) searchQueries.push("education");
  if (isEnvironment) searchQueries.push("climate");

  // If no specific topic detected, use a broad search
  if (searchQueries.length === 0) {
    // Extract first few meaningful words from prompt
    const words = userPrompt.split(/\s+/).filter(w => w.length > 4).slice(0, 3);
    searchQueries.push(words.join(" ") || "legislation");
  }

  // Fetch bills data
  try {
    console.log("[Thesys Pre-fetch] Fetching bills for:", searchQueries[0]);
    const billsResult = await searchBillsFunction(searchQueries[0], undefined, 15);
    const billsData = JSON.parse(billsResult);
    if (billsData.success && billsData.bills?.length > 0) {
      results.push(`## Federal Legislation Data (from Congress.gov database)\n\n${JSON.stringify(billsData.bills, null, 2)}`);
      console.log("[Thesys Pre-fetch] Found", billsData.bills.length, "bills");
    }
  } catch (error) {
    console.error("[Thesys Pre-fetch] Bills fetch error:", error);
  }

  // Fetch semantic search results for better coverage
  try {
    console.log("[Thesys Pre-fetch] Semantic search for:", searchQueries[0]);
    const semanticResult = await semanticSearchBillsFunction(searchQueries[0], 10, 119);
    const semanticData = JSON.parse(semanticResult);
    if (semanticData.success && semanticData.bills?.length > 0) {
      results.push(`## Related Legislation (Semantic Search)\n\n${JSON.stringify(semanticData.bills, null, 2)}`);
      console.log("[Thesys Pre-fetch] Found", semanticData.bills.length, "semantically similar bills");
    }
  } catch (error) {
    console.error("[Thesys Pre-fetch] Semantic search error:", error);
  }

  // Fetch news data
  try {
    console.log("[Thesys Pre-fetch] Fetching news for:", searchQueries[0]);
    const newsResult = await searchNewsFunction(searchQueries[0] + " legislation congress", "policy");
    const newsData = JSON.parse(newsResult);
    if (newsData.success) {
      results.push(`## Recent News Coverage\n\nSummary: ${newsData.summary}\n\nArticles:\n${JSON.stringify(newsData.articles?.slice(0, 5), null, 2)}`);
      console.log("[Thesys Pre-fetch] Found", newsData.articles?.length || 0, "news articles");
    }
  } catch (error) {
    console.error("[Thesys Pre-fetch] News fetch error:", error);
  }

  // Fetch latest congressional actions
  try {
    console.log("[Thesys Pre-fetch] Fetching latest actions");
    const actionsResult = await getLatestActionsFunction(20);
    const actionsData = JSON.parse(actionsResult);
    if (actionsData.success && actionsData.actions?.length > 0) {
      results.push(`## Latest Congressional Actions\n\n${JSON.stringify(actionsData.actions.slice(0, 10), null, 2)}`);
      console.log("[Thesys Pre-fetch] Found", actionsData.actions.length, "recent actions");
    }
  } catch (error) {
    console.error("[Thesys Pre-fetch] Actions fetch error:", error);
  }

  const combinedData = results.join("\n\n---\n\n");
  console.log("[Thesys Pre-fetch] Total pre-fetched data length:", combinedData.length);

  return combinedData || "No data could be pre-fetched from legislative databases.";
}

/**
 * Generate an artifact with tool calling - Two-phase approach:
 * Phase 1: Use embed client with chat model to gather real data via tools
 * Phase 2: Use artifact client to generate C1 document with that data
 *
 * Now includes pre-fetch fallback to ensure we always have real data
 */
export async function generateArtifactWithTools(
  options: ArtifactGenerationOptions
): Promise<ArtifactResult> {
  const { id, type, systemPrompt, userPrompt } = options;

  if (!process.env.THESYS_API_KEY) {
    throw new Error("THESYS_API_KEY environment variable is not set");
  }

  const tools = getThesysTools();

  try {
    console.log("[Thesys] Phase 1: Gathering data with tools using embed endpoint");

    // PRE-FETCH: Directly gather data using tool functions (bypasses Thesys tool calling issues)
    console.log("[Thesys] Starting pre-fetch to guarantee real data...");
    const prefetchedData = await prefetchDataForArtifact(userPrompt);

    // Phase 1: Use the EMBED client (which supports tool calling) to gather additional data
    const dataGatheringPrompt = `You are a research assistant. Your task is to gather comprehensive data for a report about:

${userPrompt}

Use the available tools to search for:
1. Relevant federal legislation (search_bills or semantic_search_bills)
2. Recent news coverage (search_news)
3. Congressional member information if relevant (search_members)
4. Latest legislative actions (get_latest_actions)
5. State legislation if applicable (search_state_bills)

After gathering data, provide a structured summary of all findings including:
- Specific bill numbers and titles
- Sponsor names and parties
- Latest actions and dates
- Key news headlines and sources
- Any relevant quotes or statistics

Be thorough and factual. Include all data from tool results.`;

    // Use EMBED client for tool calling (as backup/supplement to pre-fetch)
    console.log("[Thesys] Starting runTools with", tools.length, "tools available");
    const runner = getThesysEmbedClient().beta.chat.completions.runTools({
      model: THESYS_CHAT_MODEL,
      messages: [
        { role: "system", content: "You are a legislative research assistant. Gather comprehensive data using the available tools." },
        { role: "user", content: dataGatheringPrompt },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: tools as unknown as RunnableToolFunctionWithParse<any>[],
    });

    // Log tool calls as they happen
    runner.on("functionCall", (call) => {
      console.log("[Thesys] Tool called:", call.name, "with args:", JSON.stringify(call.arguments).substring(0, 200));
    });
    runner.on("functionCallResult", (result) => {
      console.log("[Thesys] Tool result received, length:", String(result).length);
    });

    // Wait for data gathering to complete
    const gatheredData = await runner.finalContent();
    console.log("[Thesys] Phase 1 complete, gathered data length:", gatheredData?.length);
    console.log("[Thesys] Gathered data preview:", gatheredData?.substring(0, 500));

    // Phase 2: Use the ARTIFACT client to generate the C1 document
    console.log("[Thesys] Phase 2: Generating artifact with gathered data");

    // Combine pre-fetched data with any tool-gathered data
    // Pre-fetched data is guaranteed to have real data from our APIs
    const combinedData = `## Pre-Fetched Data (Direct API Access - AUTHORITATIVE)
${prefetchedData}

## Tool-Gathered Data (Thesys Embed - SUPPLEMENTARY)
${gatheredData || "No additional data gathered via tools."}`;

    console.log("[Thesys] Combined data length:", combinedData.length);

    const enrichedPrompt = `${userPrompt}

## Research Data
The following data was gathered from authoritative legislative databases (Congress.gov, SmartBuckets, SmartSQL):

${combinedData}

CRITICAL INSTRUCTIONS:
1. Use ONLY the bill numbers, titles, sponsors, and dates from the data above
2. DO NOT invent or fabricate any bill numbers or legislation
3. Every bill mentioned must have a real bill ID from the data (e.g., H.R. 1234, S. 567)
4. If a topic has no matching bills in the data, clearly state "No matching legislation found"
5. Include sponsor names with party affiliation and state (e.g., "Rep. Jane Smith (D-CA)")
6. Use actual latest_action_text and latest_action_date from the data

Create an accurate, well-cited document using ONLY facts from the research data above.`;

    // Use ARTIFACT client for C1 document generation
    const artifactResponse = await getThesysArtifactClient().chat.completions.create({
      model: THESYS_ARTIFACT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: enrichedPrompt },
      ],
      // @ts-ignore - Thesys metadata
      metadata: {
        thesys: JSON.stringify({
          c1_artifact_type: type,
          id: id,
        }),
      },
    });

    const content = artifactResponse.choices[0]?.message?.content || "";
    console.log("[Thesys] Phase 2 complete, artifact length:", content.length);

    return {
      content,
      id,
      type,
      usage: artifactResponse.usage
        ? {
            promptTokens: artifactResponse.usage.prompt_tokens,
            completionTokens: artifactResponse.usage.completion_tokens,
            totalTokens: artifactResponse.usage.total_tokens,
          }
        : undefined,
    };
  } catch (error) {
    console.error("[Thesys] Error with tool calling:", error);
    if (error instanceof OpenAI.APIError) {
      throw new Error(`Thesys API error: ${error.message} (${error.status})`);
    }
    throw error;
  }
}

/**
 * Generate an artifact with tool calling - STREAMING VERSION
 * Phase 1: Pre-fetch data + gather additional data using tools (non-streaming)
 * Phase 2: Stream the artifact generation
 *
 * Now includes pre-fetch to guarantee real data from our APIs
 * @yields Chunks of C1 DSL content as they're generated
 */
export async function* generateArtifactWithToolsStream(
  options: ArtifactGenerationOptions
): AsyncGenerator<{ type: "phase"; phase: string; message: string } | { type: "content"; content: string } | { type: "complete"; result: ArtifactResult }, void, unknown> {
  const { id, type, systemPrompt, userPrompt } = options;

  if (!process.env.THESYS_API_KEY) {
    throw new Error("THESYS_API_KEY environment variable is not set");
  }

  const tools = getThesysTools();

  try {
    // Yield phase 1 start
    yield { type: "phase", phase: "gathering", message: "Gathering research data from legislative databases..." };
    console.log("[Thesys Stream] Phase 1: Pre-fetching + Gathering data with tools");

    // PRE-FETCH: Directly gather data using tool functions (bypasses Thesys tool calling issues)
    console.log("[Thesys Stream] Starting pre-fetch to guarantee real data...");
    const prefetchedData = await prefetchDataForArtifact(userPrompt);
    console.log("[Thesys Stream] Pre-fetch complete, data length:", prefetchedData.length);

    // Phase 1: Also try to gather additional data with tools (as backup/supplement)
    const dataGatheringPrompt = `You are a research assistant. Your task is to gather comprehensive data for a report about:

${userPrompt}

Use the available tools to search for:
1. Relevant federal legislation (search_bills or semantic_search_bills)
2. Recent news coverage (search_news)
3. Congressional member information if relevant (search_members)
4. Latest legislative actions (get_latest_actions)
5. State legislation if applicable (search_state_bills)

After gathering data, provide a structured summary of all findings including:
- Specific bill numbers and titles
- Sponsor names and parties
- Latest actions and dates
- Key news headlines and sources
- Any relevant quotes or statistics

Be thorough and factual. Include all data from tool results.`;

    const runner = getThesysEmbedClient().beta.chat.completions.runTools({
      model: THESYS_CHAT_MODEL,
      messages: [
        { role: "system", content: "You are a legislative research assistant. Gather comprehensive data using the available tools." },
        { role: "user", content: dataGatheringPrompt },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: tools as unknown as RunnableToolFunctionWithParse<any>[],
    });

    const gatheredData = await runner.finalContent();
    console.log("[Thesys Stream] Tool gathering complete, data length:", gatheredData?.length);

    // Combine pre-fetched data with any tool-gathered data
    const combinedData = `## Pre-Fetched Data (Direct API Access - AUTHORITATIVE)
${prefetchedData}

## Tool-Gathered Data (Thesys Embed - SUPPLEMENTARY)
${gatheredData || "No additional data gathered via tools."}`;

    console.log("[Thesys Stream] Combined data length:", combinedData.length);

    // Yield phase 2 start
    yield { type: "phase", phase: "generating", message: "Generating your document..." };
    console.log("[Thesys Stream] Phase 2: Streaming artifact generation");

    // Phase 2: Stream the artifact generation
    const enrichedPrompt = `${userPrompt}

## Research Data
The following data was gathered from authoritative legislative databases (Congress.gov, SmartBuckets, SmartSQL):

${combinedData}

CRITICAL INSTRUCTIONS:
1. Use ONLY the bill numbers, titles, sponsors, and dates from the data above
2. DO NOT invent or fabricate any bill numbers or legislation
3. Every bill mentioned must have a real bill ID from the data (e.g., H.R. 1234, S. 567)
4. If a topic has no matching bills in the data, clearly state "No matching legislation found"
5. Include sponsor names with party affiliation and state (e.g., "Rep. Jane Smith (D-CA)")
6. Use actual latest_action_text and latest_action_date from the data

Create an accurate, well-cited document using ONLY facts from the research data above.`;

    // Use ARTIFACT client with STREAMING
    const stream = await getThesysArtifactClient().chat.completions.create({
      model: THESYS_ARTIFACT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: enrichedPrompt },
      ],
      stream: true,
      // @ts-ignore - Thesys metadata
      metadata: {
        thesys: JSON.stringify({
          c1_artifact_type: type,
          id: id,
        }),
      },
    });

    let fullContent = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullContent += content;
        yield { type: "content", content };
      }
    }

    console.log("[Thesys Stream] Phase 2 complete, artifact length:", fullContent.length);

    // Yield completion
    yield {
      type: "complete",
      result: {
        content: fullContent,
        id,
        type,
      },
    };
  } catch (error) {
    console.error("[Thesys Stream] Error:", error);
    if (error instanceof OpenAI.APIError) {
      throw new Error(`Thesys API error: ${error.message} (${error.status})`);
    }
    throw error;
  }
}
