import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Perplexity Search Tool for Hakivo Congressional Assistant
 *
 * Provides current news and web search functionality using the Perplexity API.
 * Perplexity provides AI-powered search with citations and real-time information.
 *
 * API Documentation: https://docs.perplexity.ai/
 */

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

// Get API key from environment
function getPerplexityApiKey(): string | undefined {
  return (
    process.env.PERPLEXITY_API_KEY ||
    process.env.NEXT_PUBLIC_PERPLEXITY_API_KEY
  );
}

// Result types
interface PerplexityCitation {
  url: string;
  title?: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  citations?: string[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface NewsArticle {
  title: string;
  url: string;
  snippet: string;
  source: string;
  date: string | null;
  relevanceScore: number;
}

interface SearchResult {
  success: boolean;
  answer: string;
  citations: PerplexityCitation[];
  query: string;
  error?: string;
}

interface NewsSearchResult {
  success: boolean;
  articles: NewsArticle[];
  count: number;
  query: string;
  summary?: string;
  error?: string;
}

/**
 * Extract domain/source name from URL
 */
function extractSource(url: string): string {
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
      "nbcnews.com": "NBC News",
      "cbsnews.com": "CBS News",
      "abcnews.go.com": "ABC News",
      "npr.org": "NPR",
      "pbs.org": "PBS",
      "usatoday.com": "USA Today",
      "wsj.com": "Wall Street Journal",
      "axios.com": "Axios",
      "bloomberg.com": "Bloomberg",
      "congress.gov": "Congress.gov",
      "govtrack.us": "GovTrack",
      "rollcall.com": "Roll Call",
    };
    return sourceMap[hostname] || hostname;
  } catch {
    return "Unknown Source";
  }
}

/**
 * Search News Tool - Search for current news using Perplexity
 *
 * Searches for recent news articles about congressional topics,
 * bills, legislators, and policy areas using Perplexity's AI-powered search.
 */
export const searchNewsTool = createTool({
  id: "searchNews",
  description: `Search for current news about legislation, representatives, or political topics using Perplexity AI.
Use this tool to:
- Find recent news about specific bills or legislation
- Get updates on congressional actions
- Find news about specific legislators
- Search for policy-related news coverage

Returns an AI-summarized answer with citations to source articles.`,
  inputSchema: z.object({
    query: z
      .string()
      .describe("Search query for news, e.g., 'healthcare reform legislation 2025' or 'Senator Smith healthcare vote'"),
    topic: z
      .enum(["bills", "legislators", "votes", "policy", "state"])
      .optional()
      .describe("Focus area to improve search relevance"),
    recency: z
      .enum(["day", "week", "month"])
      .optional()
      .default("week")
      .describe("How recent the news should be"),
  }),
  execute: async ({ context }): Promise<NewsSearchResult> => {
    const { query, topic, recency = "week" } = context;

    const apiKey = getPerplexityApiKey();

    if (!apiKey) {
      return {
        success: false,
        articles: [],
        count: 0,
        query,
        error: "Perplexity API key not configured. Please set PERPLEXITY_API_KEY environment variable.",
      };
    }

    try {
      // Build context-aware query
      let searchQuery = query;
      if (topic) {
        const topicContext: Record<string, string> = {
          bills: "congressional legislation bills",
          legislators: "congress representative senator",
          votes: "congressional vote voting record",
          policy: "federal government policy",
          state: "state legislature governor",
        };
        searchQuery = `${query} ${topicContext[topic] || ""}`;
      }

      // Add recency context
      const recencyContext: Record<string, string> = {
        day: "from today or yesterday",
        week: "from the past week",
        month: "from the past month",
      };

      const systemPrompt = `You are a congressional news research assistant. Search for recent news ${recencyContext[recency]} about the following topic. Focus on factual, non-partisan reporting from reputable news sources. Provide a brief summary of the key developments and cite your sources.`;

      const response = await fetch(PERPLEXITY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: searchQuery },
          ],
          max_tokens: 1024,
          temperature: 0.2,
          return_citations: true,
          search_recency_filter: recency,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
      }

      const data: PerplexityResponse = await response.json();

      // Extract the answer
      const answer = data.choices[0]?.message?.content || "";

      // Transform citations to articles format
      const articles: NewsArticle[] = (data.citations || []).map((url, index) => ({
        title: `Source ${index + 1}`,
        url,
        snippet: "",
        source: extractSource(url),
        date: null,
        relevanceScore: 1 - index * 0.1, // Higher rank = higher score
      }));

      return {
        success: true,
        articles,
        count: articles.length,
        query: searchQuery,
        summary: answer,
      };
    } catch (error) {
      return {
        success: false,
        articles: [],
        count: 0,
        query,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
});

/**
 * Search Congressional News Tool - Specialized for Congress.gov and official sources
 *
 * Uses Perplexity to search for official congressional news and updates.
 */
export const searchCongressionalNewsTool = createTool({
  id: "searchCongressionalNews",
  description: `Search for official congressional news from trusted government and news sources using Perplexity AI.
Prioritizes sources like Congress.gov, GovTrack, The Hill, Politico, and Roll Call.
Use this for reliable, factual updates on congressional activities.`,
  inputSchema: z.object({
    query: z
      .string()
      .describe("Search query for congressional news"),
    chamber: z
      .enum(["house", "senate", "both"])
      .optional()
      .default("both")
      .describe("Which chamber to focus on"),
    recency: z
      .enum(["day", "week", "month"])
      .optional()
      .default("week")
      .describe("How recent the news should be"),
  }),
  execute: async ({ context }): Promise<NewsSearchResult> => {
    const { query, chamber = "both", recency = "week" } = context;

    const apiKey = getPerplexityApiKey();

    if (!apiKey) {
      return {
        success: false,
        articles: [],
        count: 0,
        query,
        error: "Perplexity API key not configured.",
      };
    }

    try {
      // Build chamber-specific query
      let chamberQuery = query;
      if (chamber === "house") {
        chamberQuery = `${query} House of Representatives`;
      } else if (chamber === "senate") {
        chamberQuery = `${query} U.S. Senate`;
      } else {
        chamberQuery = `${query} U.S. Congress`;
      }

      const recencyContext: Record<string, string> = {
        day: "from today or yesterday",
        week: "from the past week",
        month: "from the past month",
      };

      const systemPrompt = `You are a congressional news research assistant. Search for recent official congressional news ${recencyContext[recency]} about the following topic. Focus on trusted sources like Congress.gov, GovTrack, The Hill, Politico, Roll Call, C-SPAN, NPR, AP News, and Reuters. Provide factual, non-partisan information with citations.`;

      const response = await fetch(PERPLEXITY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: chamberQuery },
          ],
          max_tokens: 1024,
          temperature: 0.2,
          return_citations: true,
          search_recency_filter: recency,
        }),
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data: PerplexityResponse = await response.json();
      const answer = data.choices[0]?.message?.content || "";

      const articles: NewsArticle[] = (data.citations || []).map((url, index) => ({
        title: `Source ${index + 1}`,
        url,
        snippet: "",
        source: extractSource(url),
        date: null,
        relevanceScore: 1 - index * 0.1,
      }));

      return {
        success: true,
        articles,
        count: articles.length,
        query: chamberQuery,
        summary: answer,
      };
    } catch (error) {
      return {
        success: false,
        articles: [],
        count: 0,
        query,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Search Legislator News Tool - Find news about specific legislators
 */
export const searchLegislatorNewsTool = createTool({
  id: "searchLegislatorNews",
  description: `Search for news about a specific legislator using Perplexity AI.
Use this to find recent coverage of a representative or senator,
including their statements, votes, and activities.`,
  inputSchema: z.object({
    name: z
      .string()
      .describe("Name of the legislator, e.g., 'Nancy Pelosi' or 'Mitch McConnell'"),
    state: z
      .string()
      .optional()
      .describe("State abbreviation to narrow results, e.g., 'CA' or 'KY'"),
    topic: z
      .string()
      .optional()
      .describe("Optional topic to focus on, e.g., 'healthcare' or 'immigration'"),
    recency: z
      .enum(["day", "week", "month"])
      .optional()
      .default("week"),
  }),
  execute: async ({ context }): Promise<NewsSearchResult> => {
    const { name, state, topic, recency = "week" } = context;

    const apiKey = getPerplexityApiKey();

    if (!apiKey) {
      return {
        success: false,
        articles: [],
        count: 0,
        query: name,
        error: "Perplexity API key not configured.",
      };
    }

    try {
      // Build legislator-focused query
      let searchQuery = name;
      if (state) {
        searchQuery += ` ${state}`;
      }
      if (topic) {
        searchQuery += ` ${topic}`;
      }
      searchQuery += " congress legislator";

      const recencyContext: Record<string, string> = {
        day: "from today or yesterday",
        week: "from the past week",
        month: "from the past month",
      };

      const systemPrompt = `You are a congressional research assistant. Search for recent news ${recencyContext[recency]} about the legislator mentioned. Include information about their recent statements, votes, committee work, and any news coverage. Provide factual, non-partisan information with citations.`;

      const response = await fetch(PERPLEXITY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: searchQuery },
          ],
          max_tokens: 1024,
          temperature: 0.2,
          return_citations: true,
          search_recency_filter: recency,
        }),
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data: PerplexityResponse = await response.json();
      const answer = data.choices[0]?.message?.content || "";

      const articles: NewsArticle[] = (data.citations || []).map((url, index) => ({
        title: `Source ${index + 1}`,
        url,
        snippet: "",
        source: extractSource(url),
        date: null,
        relevanceScore: 1 - index * 0.1,
      }));

      return {
        success: true,
        articles,
        count: articles.length,
        query: searchQuery,
        summary: answer,
      };
    } catch (error) {
      return {
        success: false,
        articles: [],
        count: 0,
        query: name,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * General Web Search Tool - For broader searches
 */
export const webSearchTool = createTool({
  id: "webSearch",
  description: `Perform a general web search using Perplexity AI to find information about any topic.
Use this for broader searches that aren't specifically about news or legislators.
Returns an AI-summarized answer with source citations.`,
  inputSchema: z.object({
    query: z
      .string()
      .describe("Search query"),
    detailed: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to return a more detailed response"),
  }),
  execute: async ({ context }): Promise<SearchResult> => {
    const { query, detailed = false } = context;

    const apiKey = getPerplexityApiKey();

    if (!apiKey) {
      return {
        success: false,
        answer: "",
        citations: [],
        query,
        error: "Perplexity API key not configured.",
      };
    }

    try {
      const systemPrompt = detailed
        ? "You are a helpful research assistant. Provide a comprehensive, well-organized answer with citations."
        : "You are a helpful research assistant. Provide a concise, accurate answer with citations.";

      const response = await fetch(PERPLEXITY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query },
          ],
          max_tokens: detailed ? 2048 : 1024,
          temperature: 0.2,
          return_citations: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data: PerplexityResponse = await response.json();
      const answer = data.choices[0]?.message?.content || "";

      const citations: PerplexityCitation[] = (data.citations || []).map((url) => ({
        url,
        title: extractSource(url),
      }));

      return {
        success: true,
        answer,
        citations,
        query,
      };
    } catch (error) {
      return {
        success: false,
        answer: "",
        citations: [],
        query,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Export all Perplexity tools as a collection
export const perplexityTools = {
  searchNews: searchNewsTool,
  searchCongressionalNews: searchCongressionalNewsTool,
  searchLegislatorNews: searchLegislatorNewsTool,
  webSearch: webSearchTool,
};
