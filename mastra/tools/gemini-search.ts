/**
 * Gemini Search Tool with Google Search Grounding
 *
 * Uses Gemini 2.5 Flash with Google Search grounding for high-quality
 * news and web search with inline citations and structured output.
 *
 * Features:
 * - Google Search grounding for real-time web data
 * - Structured JSON output for consistent responses
 * - Inline citations with source attribution
 * - C1 component mapping for dynamic UI generation
 */

import { GoogleGenAI } from "@google/genai";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Gemini configuration
const GEMINI_MODEL = "gemini-2.5-flash";

// Lazy-initialized Gemini client
let _geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY environment variable is not set");
  }

  if (!_geminiClient) {
    _geminiClient = new GoogleGenAI({ apiKey });
  }

  return _geminiClient;
}

/**
 * Structured output schema for news search results
 */
const newsSearchSchema = {
  type: "object" as const,
  properties: {
    summary: {
      type: "string",
      description: "A comprehensive summary of the search results with [n] citation markers for sources",
    },
    keyFindings: {
      type: "array",
      description: "Key findings or takeaways from the search",
      items: {
        type: "object",
        properties: {
          point: { type: "string", description: "A key finding or fact" },
          citationIndex: { type: "integer", description: "Citation index [n] referencing the source" },
        },
        required: ["point"],
      },
    },
    articles: {
      type: "array",
      description: "List of relevant news articles found",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Article headline" },
          source: { type: "string", description: "Publication or website name" },
          url: { type: "string", description: "Article URL" },
          date: { type: "string", description: "Publication date if available" },
          snippet: { type: "string", description: "Brief excerpt or description" },
          imageUrl: { type: "string", description: "URL of the article's thumbnail or featured image if available" },
        },
        required: ["title", "source", "url"],
      },
    },
    relatedTopics: {
      type: "array",
      description: "Related topics for further exploration",
      items: { type: "string" },
    },
  },
  required: ["summary", "articles"],
};

/**
 * Process grounding metadata to create inline citations
 */
function processInlineCitations(
  text: string,
  groundingMetadata: {
    groundingChunks?: Array<{ web?: { uri: string; title: string } }>;
    groundingSupports?: Array<{
      segment: { startIndex: number; endIndex: number };
      groundingChunkIndices: number[];
    }>;
  }
): { textWithCitations: string; citations: Array<{ index: number; title: string; url: string }> } {
  const chunks = groundingMetadata.groundingChunks || [];
  const supports = groundingMetadata.groundingSupports || [];

  // Build citations list from chunks
  const citations = chunks.map((chunk, index) => ({
    index: index + 1,
    title: chunk.web?.title || "Source",
    url: chunk.web?.uri || "",
  }));

  // Process supports in reverse order to avoid index shifting
  let result = text;
  const sortedSupports = [...supports].sort((a, b) => b.segment.endIndex - a.segment.endIndex);

  for (const support of sortedSupports) {
    const citationMarkers = support.groundingChunkIndices
      .map((idx) => `[${idx + 1}]`)
      .join("");

    // Insert citation at end of segment
    result = result.slice(0, support.segment.endIndex) + citationMarkers + result.slice(support.segment.endIndex);
  }

  return { textWithCitations: result, citations };
}

/**
 * Generate C1 template for news search results
 */
function generateNewsC1Template(
  data: {
    summary: string;
    keyFindings?: Array<{ point: string; citationIndex?: number }>;
    articles: Array<{ title: string; source: string; url: string; date?: string; snippet?: string; imageUrl?: string }>;
    relatedTopics?: string[];
  },
  citations: Array<{ index: number; title: string; url: string }>,
  query: string
): string {
  const articleCards = data.articles.slice(0, 6).map((article, idx) => ({
    component: "Card",
    props: {
      title: article.title,
      description: article.snippet || `From ${article.source}`,
      href: article.url,
      metadata: [article.source, article.date].filter(Boolean).join(" • "),
      ...(article.imageUrl ? { image: article.imageUrl } : {}),
    },
  }));

  const citationItems = citations.slice(0, 10).map((c) => ({
    title: `[${c.index}] ${c.title}`,
    subtitle: c.url,
    href: c.url,
  }));

  const c1Content = {
    component: "Report",
    props: {
      metadata: {
        title: { id: "news-title", text: `News: ${query}` },
      },
      pages: [
        {
          id: "summary-page",
          variant: "ContentPage",
          children: [
            {
              component: "InlineHeader",
              props: {
                heading: "Search Results",
                description: `Latest news and information about "${query}"`,
              },
            },
            {
              component: "TextContent",
              props: {
                children: data.summary,
              },
            },
            ...(data.keyFindings && data.keyFindings.length > 0
              ? [
                  {
                    component: "List",
                    props: {
                      heading: "Key Findings",
                      variant: "bullet",
                      items: data.keyFindings.map((f) => ({
                        title: f.point,
                      })),
                    },
                  },
                ]
              : []),
          ],
        },
        {
          id: "articles-page",
          variant: "ContentPage",
          children: [
            {
              component: "InlineHeader",
              props: {
                heading: "News Articles",
                description: `${data.articles.length} articles found`,
              },
            },
            {
              component: "Cards",
              props: {
                variant: "grid",
                children: articleCards,
              },
            },
          ],
        },
        ...(citations.length > 0
          ? [
              {
                id: "sources-page",
                variant: "ContentPage",
                children: [
                  {
                    component: "InlineHeader",
                    props: {
                      heading: "Sources",
                      description: "References and citations",
                    },
                  },
                  {
                    component: "List",
                    props: {
                      variant: "number",
                      items: citationItems,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    },
  };

  return JSON.stringify(c1Content);
}

/**
 * Search news and web content using Gemini with Google Search grounding
 */
export async function searchWithGemini(
  query: string,
  options: {
    focus?: "news" | "general" | "policy";
    maxArticles?: number;
  } = {}
): Promise<{
  success: boolean;
  summary: string;
  summaryWithCitations: string;
  articles: Array<{ title: string; source: string; url: string; date?: string; snippet?: string; imageUrl?: string }>;
  citations: Array<{ index: number; title: string; url: string }>;
  keyFindings?: Array<{ point: string; citationIndex?: number }>;
  relatedTopics?: string[];
  c1Template?: string;
  error?: string;
}> {
  try {
    const client = getGeminiClient();
    const { focus = "news", maxArticles = 10 } = options;

    // Build search prompt based on focus
    const focusInstructions = {
      news: "Focus on recent news articles, press releases, and current events coverage.",
      general: "Search for comprehensive information from authoritative sources.",
      policy: "Focus on government sources, policy documents, legislative news, and official statements.",
    };

    const searchPrompt = `Search for: "${query}"

${focusInstructions[focus]}

Provide:
1. A comprehensive summary with inline citations [n] referencing your sources
2. Key findings or facts discovered (with citation indices)
3. A list of the most relevant articles found (up to ${maxArticles}). For each article, try to include the thumbnail or featured image URL if available.
4. Related topics for further exploration

Be factual and cite your sources accurately. Include image URLs for articles when available from the search results.`;

    // Call Gemini with Google Search grounding and structured output
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: newsSearchSchema,
      },
    });

    // Parse structured response
    const responseText = response.text || "{}";
    let parsedResponse: {
      summary: string;
      keyFindings?: Array<{ point: string; citationIndex?: number }>;
      articles: Array<{ title: string; source: string; url: string; date?: string; snippet?: string; imageUrl?: string }>;
      relatedTopics?: string[];
    };

    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      // Fallback if JSON parsing fails
      parsedResponse = {
        summary: responseText,
        articles: [],
      };
    }

    // Process grounding metadata for citations
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata || {};
    const { textWithCitations, citations } = processInlineCitations(
      parsedResponse.summary,
      groundingMetadata as {
        groundingChunks?: Array<{ web?: { uri: string; title: string } }>;
        groundingSupports?: Array<{
          segment: { startIndex: number; endIndex: number };
          groundingChunkIndices: number[];
        }>;
      }
    );

    // Enrich articles with grounding chunks if available
    const groundingChunks = groundingMetadata.groundingChunks || [];
    const enrichedArticles = parsedResponse.articles.length > 0
      ? parsedResponse.articles
      : groundingChunks.slice(0, maxArticles).map((chunk) => {
          const web = chunk.web as { uri?: string; title?: string } | undefined;
          return {
            title: web?.title || "Article",
            source: web?.uri ? new URL(web.uri).hostname.replace("www.", "") : "Unknown",
            url: web?.uri || "",
          };
        });

    // Generate C1 template
    const c1Template = generateNewsC1Template(
      {
        summary: textWithCitations,
        keyFindings: parsedResponse.keyFindings,
        articles: enrichedArticles,
        relatedTopics: parsedResponse.relatedTopics,
      },
      citations,
      query
    );

    return {
      success: true,
      summary: parsedResponse.summary,
      summaryWithCitations: textWithCitations,
      articles: enrichedArticles,
      citations,
      keyFindings: parsedResponse.keyFindings,
      relatedTopics: parsedResponse.relatedTopics,
      c1Template,
    };
  } catch (error) {
    console.error("[Gemini Search] Error:", error);
    return {
      success: false,
      summary: "",
      summaryWithCitations: "",
      articles: [],
      citations: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Mastra tool for Gemini news search
 */
export const geminiSearchTool = createTool({
  id: "geminiSearch",
  description: `Search the web using Google Search with Gemini AI for comprehensive, cited results.
Best for:
- Current news and events
- Policy and government information
- Research with citations
- Real-time information

Returns structured results with inline citations, article list, and key findings.`,
  inputSchema: z.object({
    query: z.string().describe("Search query"),
    focus: z
      .enum(["news", "general", "policy"])
      .optional()
      .default("news")
      .describe("Search focus: news (recent articles), general (comprehensive), policy (government/legislative)"),
    maxArticles: z.number().optional().default(10).describe("Maximum number of articles to return"),
  }),
  execute: async ({ context }) => {
    const { query, focus, maxArticles } = context;
    return searchWithGemini(query, { focus, maxArticles });
  },
});

/**
 * Standalone function for use in Thesys tool calling
 */
export async function searchNewsWithGemini(
  query: string,
  focus?: "news" | "general" | "policy"
): Promise<string> {
  const result = await searchWithGemini(query, { focus: focus || "news" });
  return JSON.stringify(result);
}

// Export for use in other modules
export { getGeminiClient, GEMINI_MODEL };
