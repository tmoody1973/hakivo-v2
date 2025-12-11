/**
 * Image Search Tool for C1/Thesys
 *
 * Searches for images using Google Custom Search API.
 * Returns image URLs - the model decides how to use them in C1 components.
 */

import type { RunnableToolFunctionWithParse } from "openai/lib/RunnableFunction.mjs";
import type { JSONSchema } from "openai/lib/jsonschema.mjs";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { WriteProgress, ImageSearchResult, ImageSearchItem } from "./types";

// Google Custom Search configuration
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CX_KEY = process.env.GOOGLE_CX || process.env.GOOGLE_CX_KEY;

/**
 * Input schema for image search
 */
const imageSearchSchema = z.object({
  altText: z
    .array(z.string())
    .describe(
      "Array of descriptive texts to search for images. Example: ['Nancy Pelosi official portrait', 'US Capitol building']"
    ),
  size: z
    .enum(["small", "medium", "large"])
    .optional()
    .describe("Preferred image size (default: medium)"),
});

type ImageSearchInput = z.infer<typeof imageSearchSchema>;

/**
 * Search for a single image using Google Custom Search
 */
async function searchImage(
  query: string,
  size: string = "medium"
): Promise<ImageSearchItem> {
  // Check for API keys
  if (!GOOGLE_API_KEY || !GOOGLE_CX_KEY) {
    return {
      altText: query,
      imageUrl: null,
      thumbnailUrl: null,
      error: "Google Image Search not configured (missing API key or CX)",
    };
  }

  try {
    const params = new URLSearchParams({
      key: GOOGLE_API_KEY,
      cx: GOOGLE_CX_KEY,
      q: query,
      searchType: "image",
      num: "1",
      imgSize: size,
      safe: "active",
    });

    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?${params.toString()}`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const items = data.items || [];

    if (items.length === 0) {
      return {
        altText: query,
        imageUrl: null,
        thumbnailUrl: null,
      };
    }

    const item = items[0];
    return {
      altText: query,
      imageUrl: item.link || null,
      thumbnailUrl: item.image?.thumbnailLink || null,
    };
  } catch (error) {
    console.error(`[searchImage] Error for "${query}":`, error);
    return {
      altText: query,
      imageUrl: null,
      thumbnailUrl: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Creates the image search tool for C1/OpenAI format
 */
export const createSearchImagesTool = (
  writeProgress?: WriteProgress
): RunnableToolFunctionWithParse<ImageSearchInput> => ({
  type: "function",
  function: {
    name: "searchImages",
    description: `Search for images based on descriptive text using Google Image Search.

ONLY USE THIS TOOL when you need actual images to include in responses. DO NOT generate image URLs yourself.

USE THIS TOOL for:
- Official photos of Congress members
- Images of the Capitol, government buildings
- Topic illustrations for reports
- News event imagery

Returns both full-size imageUrl and thumbnailUrl for each search.
Use thumbnailUrl for lists and previews, imageUrl for featured images.

Example input: ["Nancy Pelosi official portrait", "US Capitol building exterior"]`,
    parse: JSON.parse,
    parameters: zodToJsonSchema(imageSearchSchema) as JSONSchema,
    function: async ({
      altText,
      size = "medium",
    }: ImageSearchInput): Promise<ImageSearchResult> => {
      try {
        if (!altText || altText.length === 0) {
          return {
            success: false,
            images: [],
            error: "No search terms provided",
          };
        }

        writeProgress?.({
          title: "Searching Images",
          content: `Finding ${altText.length} image${altText.length > 1 ? "s" : ""}...`,
        });

        // Search for all images in parallel
        const results = await Promise.all(
          altText.map((text) => searchImage(text, size))
        );

        const successCount = results.filter((r) => r.imageUrl !== null).length;

        writeProgress?.({
          title: "Images Found",
          content: `Retrieved ${successCount} of ${altText.length} images`,
        });

        return {
          success: successCount > 0,
          images: results,
          error: successCount === 0 ? "No images found for any search terms" : undefined,
        };
      } catch (error) {
        console.error("[searchImages] Error:", error);
        return {
          success: false,
          images: [],
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
export const searchImagesTool = createSearchImagesTool();

/**
 * Utility: Get Congress member photo URL
 *
 * Uses the Congress.gov image service for official member photos
 */
export function getMemberPhotoUrl(bioguideId: string): string {
  return `https://bioguide.congress.gov/bioguide/photo/${bioguideId[0]}/${bioguideId}.jpg`;
}
