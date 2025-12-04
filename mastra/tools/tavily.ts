import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Tavily Search Tool for Hakivo Congressional Assistant
 *
 * Provides current news search functionality using the Tavily API.
 * Search for news about bills, legislators, political developments,
 * and policy topics.
 *
 * API Documentation: https://docs.tavily.com/
 */

const TAVILY_API_URL = "https://api.tavily.com/search";

// Get API key from environment
function getTavilyApiKey(): string | undefined {
  // Try different environment variable locations
  return (
    process.env.TAVILY_API_KEY ||
    process.env.NEXT_PUBLIC_TAVILY_API_KEY
  );
}

// Result types
interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

interface TavilySearchResponse {
  query: string;
  results: TavilySearchResult[];
  response_time: number;
  images?: string[];
}

interface NewsArticle {
  title: string;
  url: string;
  snippet: string;
  source: string;
  date: string | null;
  relevanceScore: number;
}

interface SearchNewsResult {
  success: boolean;
  articles: NewsArticle[];
  count: number;
  query: string;
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
 * Build Tavily search query with congressional context
 */
function buildCongressionalQuery(
  query: string,
  topic?: string
): string {
  // If topic is provided, add congressional context
  if (topic) {
    const topicQueries: Record<string, string> = {
      bills: `${query} congress legislation bill`,
      legislators: `${query} congress representative senator`,
      votes: `${query} congress vote voting record`,
      policy: `${query} policy government federal`,
      state: `${query} state legislature governor`,
    };
    return topicQueries[topic] || query;
  }
  return query;
}

/**
 * Search News Tool - Search for current news using Tavily
 *
 * Searches for recent news articles about congressional topics,
 * bills, legislators, and policy areas.
 */
export const searchNewsTool = createTool({
  id: "searchNews",
  description: `Search for current news about legislation, representatives, or political topics.
Use this tool to:
- Find recent news about specific bills or legislation
- Get updates on congressional actions
- Find news about specific legislators
- Search for policy-related news coverage

Returns structured results with title, source, date, and snippet.`,
  inputSchema: z.object({
    query: z
      .string()
      .describe("Search query for news, e.g., 'border security legislation' or 'Senator Smith healthcare vote'"),
    topic: z
      .enum(["bills", "legislators", "votes", "policy", "state"])
      .optional()
      .describe("Focus area to improve search relevance"),
    recency: z
      .enum(["day", "week", "month"])
      .optional()
      .default("week")
      .describe("How recent the news should be"),
    maxResults: z
      .number()
      .optional()
      .default(5)
      .describe("Maximum number of results to return (1-10)"),
    includeDomains: z
      .array(z.string())
      .optional()
      .describe("Specific domains to search, e.g., ['politico.com', 'thehill.com']"),
    excludeDomains: z
      .array(z.string())
      .optional()
      .describe("Domains to exclude from results"),
  }),
  execute: async ({ context }): Promise<SearchNewsResult> => {
    const {
      query,
      topic,
      recency = "week",
      maxResults = 5,
      includeDomains,
      excludeDomains,
    } = context;

    const apiKey = getTavilyApiKey();

    if (!apiKey) {
      return {
        success: false,
        articles: [],
        count: 0,
        query,
        error: "Tavily API key not configured. Please set TAVILY_API_KEY environment variable.",
      };
    }

    try {
      // Calculate days based on recency
      const recencyDays: Record<string, number> = {
        day: 1,
        week: 7,
        month: 30,
      };
      const days = recencyDays[recency] || 7;

      // Build the search query with congressional context
      const searchQuery = buildCongressionalQuery(query, topic);

      // Prepare Tavily API request
      const requestBody: Record<string, unknown> = {
        api_key: apiKey,
        query: searchQuery,
        search_depth: "advanced",
        include_answer: false,
        include_images: false,
        include_raw_content: false,
        max_results: Math.min(maxResults, 10),
        days,
      };

      // Add domain filters if provided
      if (includeDomains && includeDomains.length > 0) {
        requestBody.include_domains = includeDomains;
      }
      if (excludeDomains && excludeDomains.length > 0) {
        requestBody.exclude_domains = excludeDomains;
      }

      const response = await fetch(TAVILY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tavily API error: ${response.status} - ${errorText}`);
      }

      const data: TavilySearchResponse = await response.json();

      // Transform results to our format
      const articles: NewsArticle[] = data.results.map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.content.slice(0, 300) + (result.content.length > 300 ? "..." : ""),
        source: extractSource(result.url),
        date: result.published_date || null,
        relevanceScore: result.score,
      }));

      return {
        success: true,
        articles,
        count: articles.length,
        query: searchQuery,
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
 * Searches for official congressional news and updates from trusted government
 * and news sources.
 */
export const searchCongressionalNewsTool = createTool({
  id: "searchCongressionalNews",
  description: `Search for official congressional news from trusted government and news sources.
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
    maxResults: z
      .number()
      .optional()
      .default(5)
      .describe("Maximum number of results"),
  }),
  execute: async ({ context }): Promise<SearchNewsResult> => {
    const { query, chamber = "both", recency = "week", maxResults = 5 } = context;

    const apiKey = getTavilyApiKey();

    if (!apiKey) {
      return {
        success: false,
        articles: [],
        count: 0,
        query,
        error: "Tavily API key not configured.",
      };
    }

    try {
      // Build chamber-specific query
      let chamberQuery = query;
      if (chamber === "house") {
        chamberQuery = `${query} House Representatives`;
      } else if (chamber === "senate") {
        chamberQuery = `${query} Senate`;
      }

      const recencyDays: Record<string, number> = { day: 1, week: 7, month: 30 };
      const days = recencyDays[recency] || 7;

      // Prioritize official and trusted congressional news sources
      const trustedDomains = [
        "congress.gov",
        "govtrack.us",
        "politico.com",
        "thehill.com",
        "rollcall.com",
        "c-span.org",
        "npr.org",
        "apnews.com",
        "reuters.com",
      ];

      const response = await fetch(TAVILY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: chamberQuery,
          search_depth: "advanced",
          include_answer: false,
          include_images: false,
          include_raw_content: false,
          max_results: Math.min(maxResults, 10),
          days,
          include_domains: trustedDomains,
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`);
      }

      const data: TavilySearchResponse = await response.json();

      const articles: NewsArticle[] = data.results.map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.content.slice(0, 300) + (result.content.length > 300 ? "..." : ""),
        source: extractSource(result.url),
        date: result.published_date || null,
        relevanceScore: result.score,
      }));

      return {
        success: true,
        articles,
        count: articles.length,
        query: chamberQuery,
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
  description: `Search for news about a specific legislator.
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
    maxResults: z
      .number()
      .optional()
      .default(5),
  }),
  execute: async ({ context }): Promise<SearchNewsResult> => {
    const { name, state, topic, recency = "week", maxResults = 5 } = context;

    const apiKey = getTavilyApiKey();

    if (!apiKey) {
      return {
        success: false,
        articles: [],
        count: 0,
        query: name,
        error: "Tavily API key not configured.",
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

      const recencyDays: Record<string, number> = { day: 1, week: 7, month: 30 };
      const days = recencyDays[recency] || 7;

      const response = await fetch(TAVILY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: searchQuery,
          search_depth: "advanced",
          include_answer: false,
          include_images: false,
          max_results: Math.min(maxResults, 10),
          days,
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`);
      }

      const data: TavilySearchResponse = await response.json();

      const articles: NewsArticle[] = data.results.map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.content.slice(0, 300) + (result.content.length > 300 ? "..." : ""),
        source: extractSource(result.url),
        date: result.published_date || null,
        relevanceScore: result.score,
      }));

      return {
        success: true,
        articles,
        count: articles.length,
        query: searchQuery,
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

// Export all Tavily tools as a collection
export const tavilyTools = {
  searchNews: searchNewsTool,
  searchCongressionalNews: searchCongressionalNewsTool,
  searchLegislatorNews: searchLegislatorNewsTool,
};
