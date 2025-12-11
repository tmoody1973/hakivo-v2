/**
 * News Search Tool for C1/Thesys
 *
 * Uses Gemini with Google Search grounding to find recent news.
 * Returns structured JSON data - the model decides how to format as C1 components.
 */

import type { RunnableToolFunctionWithParse } from "openai/lib/RunnableFunction.mjs";
import type { JSONSchema } from "openai/lib/jsonschema.mjs";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { searchWithGemini } from "../../../mastra/tools/gemini-search";
import type { WriteProgress, NewsSearchResult } from "./types";

/**
 * Input schema for news search
 */
const newsSearchSchema = z.object({
  query: z.string().describe("Search query for news articles"),
  focus: z
    .enum(["news", "general", "policy"])
    .optional()
    .describe(
      "Search focus: 'news' for recent articles, 'general' for comprehensive information, 'policy' for government/legislative sources"
    ),
  maxArticles: z
    .number()
    .optional()
    .describe("Maximum number of articles to return (default: 6)"),
});

type NewsSearchInput = z.infer<typeof newsSearchSchema>;

/**
 * Creates the news search tool for C1/OpenAI format
 *
 * @param writeProgress Optional callback for progress updates
 * @returns OpenAI-compatible tool definition
 */
export const createSearchNewsTool = (
  writeProgress?: WriteProgress
): RunnableToolFunctionWithParse<NewsSearchInput> => ({
  type: "function",
  function: {
    name: "searchNews",
    description: `Search for recent news articles on political topics, policy areas, or current events using Google Search.

USE THIS TOOL when the user asks about:
- Current events and breaking news
- Recent policy developments
- Political news and coverage
- What's happening with specific topics

Returns: Article titles, sources, URLs, publication dates, summaries with citations.

IMPORTANT: Always use this for current events - never rely on potentially outdated training data.`,
    parse: JSON.parse,
    parameters: zodToJsonSchema(newsSearchSchema) as JSONSchema,
    function: async ({
      query,
      focus = "news",
      maxArticles = 6,
    }: NewsSearchInput): Promise<NewsSearchResult> => {
      try {
        // Report progress if callback provided
        writeProgress?.({
          title: "Searching News",
          content: `Finding recent coverage about: ${query}`,
        });

        // Call existing Gemini search function
        const result = await searchWithGemini(query, {
          focus,
          maxArticles,
        });

        if (!result.success) {
          return {
            success: false,
            summary: "",
            articles: [],
            error: result.error || "News search failed",
          };
        }

        writeProgress?.({
          title: "Processing Results",
          content: `Found ${result.articles.length} relevant articles`,
        });

        // Return clean result for model to format
        return {
          success: true,
          summary: result.summaryWithCitations || result.summary,
          articles: result.articles.slice(0, maxArticles).map((article) => ({
            title: article.title,
            source: article.source,
            url: article.url,
            date: article.date,
            snippet: article.snippet,
            imageUrl: article.imageUrl,
          })),
          citations: result.citations,
          keyFindings: result.keyFindings,
          relatedTopics: result.relatedTopics,
        };
      } catch (error) {
        console.error("[searchNews] Error:", error);
        return {
          success: false,
          summary: "",
          articles: [],
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    strict: true,
  },
});

/**
 * Default export without progress callback
 */
export const searchNewsTool = createSearchNewsTool();
