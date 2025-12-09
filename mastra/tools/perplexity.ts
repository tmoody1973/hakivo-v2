import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { newsResultsTemplate, webSearchResultsTemplate } from "./c1-templates";

/**
 * Perplexity Search Tool for Hakivo Congressional Assistant
 *
 * Provides current news and web search functionality using the Perplexity API.
 * Perplexity provides AI-powered search with citations and real-time information.
 *
 * API Documentation: https://docs.perplexity.ai/
 */

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
const LINKPREVIEW_API_URL = "https://api.linkpreview.net";

// Get API key from environment
function getPerplexityApiKey(): string | undefined {
  return (
    process.env.PERPLEXITY_API_KEY ||
    process.env.NEXT_PUBLIC_PERPLEXITY_API_KEY
  );
}

// Get LinkPreview API key from environment
function getLinkPreviewApiKey(): string | undefined {
  return process.env.LINKPREVIEW_API_KEY;
}

/**
 * Fetch og:image and metadata from a URL using LinkPreview API
 */
interface LinkPreviewResult {
  title: string;
  description: string;
  image: string;
  url: string;
}

async function fetchLinkPreview(url: string): Promise<LinkPreviewResult | null> {
  const apiKey = getLinkPreviewApiKey();
  if (!apiKey) return null;

  try {
    const response = await fetch(LINKPREVIEW_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Linkpreview-Api-Key": apiKey,
      },
      body: `q=${encodeURIComponent(url)}`,
    });

    if (!response.ok) {
      console.warn(`LinkPreview API error for ${url}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn(`LinkPreview fetch error for ${url}:`, error);
    return null;
  }
}

/**
 * Enrich articles with images from LinkPreview API (for articles missing images)
 * This is done in parallel to minimize latency
 */
async function enrichArticlesWithImages(articles: NewsArticle[]): Promise<NewsArticle[]> {
  // Only fetch images for articles that don't have one (max 5 to avoid rate limits)
  const articlesNeedingImages = articles.filter(a => !a.image).slice(0, 5);

  console.log(`[LinkPreview] Articles needing images: ${articlesNeedingImages.length} of ${articles.length}`);

  if (articlesNeedingImages.length === 0) {
    console.log(`[LinkPreview] All articles have images, skipping enrichment`);
    return articles;
  }

  const apiKey = getLinkPreviewApiKey();
  if (!apiKey) {
    console.log(`[LinkPreview] No API key configured, skipping enrichment`);
    return articles;
  }

  // Fetch all previews in parallel
  const previewPromises = articlesNeedingImages.map(article =>
    fetchLinkPreview(article.url)
  );

  const previews = await Promise.all(previewPromises);

  // Create a map of URL -> image
  const imageMap = new Map<string, string>();
  articlesNeedingImages.forEach((article, index) => {
    const preview = previews[index];
    if (preview?.image) {
      imageMap.set(article.url, preview.image);
      console.log(`[LinkPreview] Got image for ${article.url}: ${preview.image.substring(0, 50)}...`);
    }
  });

  console.log(`[LinkPreview] Successfully fetched ${imageMap.size} images`);

  // Update articles with images
  return articles.map(article => {
    if (!article.image && imageMap.has(article.url)) {
      return { ...article, image: imageMap.get(article.url) };
    }
    return article;
  });
}

// Result types
interface PerplexityCitation {
  url: string;
  title?: string;
}

interface PerplexitySearchResult {
  title: string;
  url: string;
  date?: string; // Format: "2023-12-25"
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
  search_results?: PerplexitySearchResult[];
  images?: string[]; // URLs to images when return_images is true
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
  image?: string;
  relevanceScore: number;
}

interface SearchResult {
  success: boolean;
  answer: string;
  citations: PerplexityCitation[];
  query: string;
  error?: string;
  c1Template?: string;
  templateType?: string;
}

interface NewsSearchResult {
  success: boolean;
  articles: NewsArticle[];
  count: number;
  query: string;
  summary?: string;
  error?: string;
  c1Template?: string;
  templateType?: string;
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
 * Get today's date formatted for search queries
 */
function getTodayFormatted(): { iso: string; readable: string; month: string; year: number } {
  const today = new Date();
  return {
    iso: today.toISOString().split('T')[0], // "2025-12-05"
    readable: today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), // "December 5, 2025"
    month: today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), // "December 2025"
    year: today.getFullYear(),
  };
}

/**
 * Get the next recency level to try (progressive expansion)
 */
function getNextRecency(current: string): string | null {
  const progression: Record<string, string | null> = {
    day: "week",
    week: "month",
    month: null, // No further expansion
  };
  return progression[current] || null;
}

/**
 * Perform a Perplexity search with progressive recency expansion
 * If no results found for current recency, expands to next level automatically
 */
async function searchWithProgressiveRecency(
  apiKey: string,
  systemPrompt: string,
  searchQuery: string,
  initialRecency: string,
  maxExpansions: number = 2
): Promise<{ data: PerplexityResponse; finalRecency: string; expanded: boolean }> {
  let currentRecency = initialRecency;
  let expansionCount = 0;

  while (expansionCount <= maxExpansions) {
    const today = getTodayFormatted();
    const recencyContext: Record<string, string> = {
      day: `from ${today.readable} or the day before`,
      week: `from the week of ${today.readable}`,
      month: `from ${today.month}`,
    };

    const promptWithDate = systemPrompt.replace(
      /Today's date is [^.]+\./,
      `Today's date is ${today.readable}.`
    ).replace(
      /Search for the most recent[^.]+about/,
      `Search for the most recent news ${recencyContext[currentRecency]} about`
    );

    const response = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: promptWithDate },
          { role: "user", content: searchQuery },
        ],
        max_tokens: 1024,
        temperature: 0.2,
        return_citations: true,
        return_images: true,
        search_recency_filter: currentRecency,
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data: PerplexityResponse = await response.json();
    const citations = data.citations || [];
    const answer = data.choices[0]?.message?.content || "";

    // Check if we got meaningful results
    const hasResults = citations.length > 0 && answer.length > 100;

    if (hasResults || !getNextRecency(currentRecency)) {
      // Got results or no more expansion possible
      return {
        data,
        finalRecency: currentRecency,
        expanded: expansionCount > 0
      };
    }

    // Expand to next recency level
    const nextRecency = getNextRecency(currentRecency);
    if (nextRecency) {
      currentRecency = nextRecency;
      expansionCount++;
    } else {
      break;
    }
  }

  // Return last result even if empty
  const finalResponse = await fetch(PERPLEXITY_API_URL, {
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
      return_images: true,
      search_recency_filter: currentRecency,
    }),
  });

  const finalData: PerplexityResponse = await finalResponse.json();
  return { data: finalData, finalRecency: currentRecency, expanded: true };
}

/**
 * Helper to build articles from Perplexity response
 * Uses search_results for metadata when available, falls back to citations
 */
function buildArticlesFromResponse(data: PerplexityResponse): NewsArticle[] {
  const searchResults = data.search_results || [];
  const citations = data.citations || [];
  const images = data.images || [];

  console.log(`[Perplexity] Building articles: searchResults=${searchResults.length}, citations=${citations.length}, images=${images.length}`);
  if (images.length > 0) {
    console.log(`[Perplexity] Images received:`, images.slice(0, 3));
  }

  // Helper to extract image URL from Perplexity's image response
  // Images can be either strings or objects like {image_url: "...", height: ..., width: ...}
  const getImageUrl = (img: unknown): string | undefined => {
    if (!img) return undefined;
    if (typeof img === "string") return img;
    if (typeof img === "object" && img !== null && "image_url" in img) {
      return (img as { image_url: string }).image_url;
    }
    return undefined;
  };

  // If we have search_results, use them for metadata
  if (searchResults.length > 0) {
    return searchResults.map((result, index) => ({
      title: result.title || extractSource(result.url),
      url: result.url,
      snippet: "",
      source: extractSource(result.url),
      date: result.date || null,
      image: getImageUrl(images[index]),
      relevanceScore: 1 - index * 0.1,
    }));
  }

  // Fall back to citations (just URLs)
  return citations.map((url, index) => ({
    title: extractSource(url),
    url,
    snippet: "",
    source: extractSource(url),
    date: null,
    image: getImageUrl(images[index]),
    relevanceScore: 1 - index * 0.1,
  }));
}

/**
 * Search News Tool - Search for current news using Gemini with Google Search grounding
 *
 * Searches for recent news articles about congressional topics,
 * bills, legislators, and policy areas using Google's Gemini AI with real-time search.
 */
export const searchNewsTool = createTool({
  id: "searchNews",
  description: `Search for current news about legislation, representatives, or political topics using Google Gemini AI with real-time search grounding.
Use this tool to:
- Find recent news about specific bills or legislation
- Get updates on congressional actions
- Find news about specific legislators
- Search for policy-related news coverage

Returns an AI-summarized answer with inline citations and source articles with thumbnails.`,
  inputSchema: z.object({
    query: z
      .string()
      .describe("Search query for news, e.g., 'healthcare reform legislation 2025' or 'Senator Smith healthcare vote'"),
    topic: z
      .enum(["bills", "legislators", "votes", "policy", "state"])
      .optional()
      .describe("Focus area to improve search relevance"),
    focus: z
      .enum(["news", "general", "policy"])
      .optional()
      .default("news")
      .describe("Search focus: news (recent articles), general (comprehensive), policy (government sources)"),
  }),
  execute: async ({ context }): Promise<NewsSearchResult> => {
    const { query, topic, focus = "news" } = context;

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

      // Use Gemini search with Google Search grounding
      const { searchWithGemini } = await import("./gemini-search");
      const result = await searchWithGemini(searchQuery, {
        focus: focus as "news" | "general" | "policy",
        maxArticles: 10,
      });

      if (!result.success) {
        // Fallback to Perplexity if Gemini fails
        console.log("[searchNews] Gemini failed, falling back to Perplexity");
        return await searchWithPerplexityFallback(searchQuery, topic);
      }

      // Transform Gemini results to match expected format
      // Use imageUrl from Gemini if available, otherwise will be enriched by LinkPreview
      let articles: NewsArticle[] = result.articles.map((article, index) => ({
        title: article.title,
        url: article.url,
        snippet: article.snippet || "",
        source: article.source,
        date: article.date || null,
        image: article.imageUrl, // Use Gemini's image if available, LinkPreview will fill gaps
        relevanceScore: 1 - index * 0.1,
      }));

      // Enrich articles with images from LinkPreview
      articles = await enrichArticlesWithImages(articles);

      // Generate C1 template for rich UI rendering
      const c1Template = newsResultsTemplate(
        articles.map((a) => ({
          title: a.title,
          url: a.url,
          source: a.source,
          published_date: a.date || undefined,
          snippet: a.snippet || undefined,
          image: a.image,
        })),
        { query: searchQuery }
      );

      return {
        success: true,
        articles,
        count: articles.length,
        query: searchQuery,
        summary: result.summaryWithCitations || result.summary,
        c1Template,
        templateType: "newsResults",
      };
    } catch (error) {
      console.error("[searchNews] Error:", error);
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
 * Fallback to Perplexity search if Gemini fails
 */
async function searchWithPerplexityFallback(
  searchQuery: string,
  topic?: string
): Promise<NewsSearchResult> {
  const apiKey = getPerplexityApiKey();

  if (!apiKey) {
    return {
      success: false,
      articles: [],
      count: 0,
      query: searchQuery,
      error: "Both Gemini and Perplexity search failed. Please check API keys.",
    };
  }

  const today = getTodayFormatted();
  const systemPrompt = `You are a congressional news research assistant. Today's date is ${today.readable}. Search for the most recent news about the following topic. Focus on factual, non-partisan reporting from reputable news sources. Provide a brief summary of the key developments and cite your sources. Prioritize the most recent articles first.`;

  const { data, finalRecency, expanded } = await searchWithProgressiveRecency(
    apiKey,
    systemPrompt,
    searchQuery,
    "day"
  );

  const answer = data.choices[0]?.message?.content || "";
  let articles = buildArticlesFromResponse(data);
  articles = await enrichArticlesWithImages(articles);

  const expandedNote = expanded
    ? `\n\n(Note: Expanded search to "${finalRecency}" timeframe)`
    : "";

  const c1Template = newsResultsTemplate(
    articles.map((a) => ({
      title: a.title,
      url: a.url,
      source: a.source,
      published_date: a.date || undefined,
      snippet: a.snippet || undefined,
      image: a.image,
    })),
    { query: searchQuery }
  );

  return {
    success: true,
    articles,
    count: articles.length,
    query: searchQuery,
    summary: answer + expandedNote,
    c1Template,
    templateType: "newsResults",
  };
}

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
      .default("day")
      .describe("How recent the news should be - use 'day' for 'latest' or 'recent' queries"),
  }),
  execute: async ({ context }): Promise<NewsSearchResult> => {
    const { query, chamber = "both", recency = "day" } = context;

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

      const today = getTodayFormatted();
      const systemPrompt = `You are a congressional news research assistant. Today's date is ${today.readable}. Search for the most recent official congressional news about the following topic. Focus on trusted sources like Congress.gov, GovTrack, The Hill, Politico, Roll Call, C-SPAN, NPR, AP News, and Reuters. Provide factual, non-partisan information with citations. Prioritize the most recent articles first.`;

      // Use progressive search - starts with requested recency, expands if no results
      const { data, finalRecency, expanded } = await searchWithProgressiveRecency(
        apiKey,
        systemPrompt,
        chamberQuery,
        recency
      );

      const answer = data.choices[0]?.message?.content || "";

      // Transform response to articles format using search_results metadata
      let articles = buildArticlesFromResponse(data);

      // Enrich articles with images from LinkPreview (for those missing images)
      articles = await enrichArticlesWithImages(articles);

      // Add note if search was expanded
      const expandedNote = expanded
        ? `\n\n(Note: No news found for "${recency}" timeframe, expanded search to "${finalRecency}")`
        : "";

      // Generate C1 template for rich UI rendering
      const c1Template = newsResultsTemplate(
        articles.map((a) => ({
          title: a.title,
          url: a.url,
          source: a.source,
          published_date: a.date || undefined,
          snippet: a.snippet || undefined,
          image: a.image,
        })),
        { query: chamberQuery }
      );

      return {
        success: true,
        articles,
        count: articles.length,
        query: chamberQuery,
        summary: answer + expandedNote,
        c1Template,
        templateType: "newsResults",
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
      .default("day")
      .describe("How recent the news should be - use 'day' for 'latest' queries"),
  }),
  execute: async ({ context }): Promise<NewsSearchResult> => {
    const { name, state, topic, recency = "day" } = context;

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

      const today = getTodayFormatted();
      const systemPrompt = `You are a congressional research assistant. Today's date is ${today.readable}. Search for the most recent news about the legislator mentioned. Include information about their recent statements, votes, committee work, and any news coverage. Provide factual, non-partisan information with citations. Prioritize the most recent articles first.`;

      // Use progressive search - starts with requested recency, expands if no results
      const { data, finalRecency, expanded } = await searchWithProgressiveRecency(
        apiKey,
        systemPrompt,
        searchQuery,
        recency
      );

      const answer = data.choices[0]?.message?.content || "";

      // Transform response to articles format using search_results metadata
      let articles = buildArticlesFromResponse(data);

      // Enrich articles with images from LinkPreview (for those missing images)
      articles = await enrichArticlesWithImages(articles);

      // Add note if search was expanded
      const expandedNote = expanded
        ? `\n\n(Note: No news found for "${recency}" timeframe, expanded search to "${finalRecency}")`
        : "";

      // Generate C1 template for rich UI rendering
      const c1Template = newsResultsTemplate(
        articles.map((a) => ({
          title: a.title,
          url: a.url,
          source: a.source,
          published_date: a.date || undefined,
          snippet: a.snippet || undefined,
          image: a.image,
        })),
        { query: searchQuery }
      );

      return {
        success: true,
        articles,
        count: articles.length,
        query: searchQuery,
        summary: answer + expandedNote,
        c1Template,
        templateType: "newsResults",
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
          return_images: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data: PerplexityResponse = await response.json();
      const answer = data.choices[0]?.message?.content || "";
      const searchResults = data.search_results || [];

      // Use search_results for better metadata when available
      const citations: PerplexityCitation[] = searchResults.length > 0
        ? searchResults.map((result) => ({
            url: result.url,
            title: result.title || extractSource(result.url),
          }))
        : (data.citations || []).map((url) => ({
            url,
            title: extractSource(url),
          }));

      // Generate C1 template for rich UI rendering
      const c1Template = webSearchResultsTemplate(answer, citations, { query });

      return {
        success: true,
        answer,
        citations,
        query,
        c1Template,
        templateType: "webSearchResults",
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
