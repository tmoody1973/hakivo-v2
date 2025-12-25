/**
 * Netlify Background Function for Image Processing
 *
 * Generates WSJ-style editorial sketch images for briefs using Gemini 2.0 Flash.
 * This function:
 * 1. Finds briefs without images (NULL or empty featured_image)
 * 2. Finds briefs with EXTERNAL images (not from Vultr) and replaces them with WSJ-style
 *
 * All generated images are uploaded to Vultr S3 storage and the brief is updated.
 * This ensures a consistent, premium editorial look across all briefs.
 *
 * Background functions get 15-minute timeout (vs 10s for regular functions).
 */
import type { Context } from "@netlify/functions";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Gemini image generation endpoint - using gemini-2.5-flash-image for higher quotas
// Migrated from gemini-2.0-flash-exp per rate limit recommendation
const GEMINI_IMAGE_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

// Get Raindrop service URL from env or use default
// IMPORTANT: Update RAINDROP_DASHBOARD_URL env var in Netlify when deploying new versions
// To find current URL: cd hakivo-api && npx raindrop build find
const getDashboardUrl = () => {
  const envUrl = Netlify.env.get('RAINDROP_DASHBOARD_URL');
  if (envUrl) return envUrl;
  // Fallback to latest known URL (updated 2025-12-25)
  return 'https://svc-01kc6rbecv0s5k4yk6ksdaqyzp.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
};

interface Brief {
  id: string;
  title: string;
  news_json: string | null;
  featured_image: string | null;
}

/**
 * Query database for briefs that need WSJ-style featured images
 * This includes:
 * 1. Briefs with no featured_image (NULL or empty)
 * 2. Briefs with external images (not from Vultr storage) - to replace with WSJ-style
 */
async function getBriefsNeedingImages(): Promise<Brief[]> {
  // Vultr storage URL prefix - images from our storage don't need replacement
  const vultrPrefix = 'https://sjc1.vultrobjects.com';

  // Get briefs where:
  // - featured_image is NULL/empty, OR
  // - featured_image exists but is NOT from Vultr (external image to replace)
  // Limit to 3 per run to avoid timeout
  const query = `SELECT id, title, news_json, featured_image FROM briefs WHERE status IN ('completed', 'script_ready', 'audio_processing') AND (featured_image IS NULL OR featured_image = '' OR (featured_image IS NOT NULL AND featured_image != '' AND featured_image NOT LIKE '${vultrPrefix}%')) ORDER BY created_at DESC LIMIT 3`;

  console.log(`[IMAGE] Querying for briefs needing WSJ-style images...`);

  const response = await fetch(`${getDashboardUrl()}/api/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    console.error(`[IMAGE] Failed to query briefs: ${response.status}`);
    return [];
  }

  const result = await response.json() as { results?: Brief[] };
  const briefs = result.results || [];

  // Log what we found
  briefs.forEach(brief => {
    if (!brief.featured_image) {
      console.log(`[IMAGE] Brief ${brief.id}: No image, will generate`);
    } else {
      console.log(`[IMAGE] Brief ${brief.id}: Replacing external image with WSJ-style`);
    }
  });

  return briefs;
}

/**
 * Update brief with featured image URL
 */
async function updateBriefImage(briefId: string, imageUrl: string): Promise<void> {
  const timestamp = Date.now();
  const query = `UPDATE briefs SET featured_image = '${imageUrl}', updated_at = ${timestamp} WHERE id = '${briefId}'`;

  const response = await fetch(`${getDashboardUrl()}/api/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    console.error(`[IMAGE] Failed to update brief image: ${response.status}`);
  }
}

/**
 * Generate date-based file key for images
 * Format: images/YYYY/MM/DD/brief-{briefId}-{timestamp}.png
 */
function generateFileKey(briefId: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const ts = date.getTime();

  return `images/${year}/${month}/${day}/brief-${briefId}-${ts}.png`;
}

/**
 * Upload image to Vultr S3-compatible storage
 */
async function uploadImage(briefId: string, imageBuffer: Uint8Array, mimeType: string): Promise<string> {
  const endpoint = Netlify.env.get('VULTR_ENDPOINT') || 'sjc1.vultrobjects.com';
  const accessKeyId = Netlify.env.get('VULTR_ACCESS_KEY');
  const secretAccessKey = Netlify.env.get('VULTR_SECRET_KEY');
  const bucketName = Netlify.env.get('VULTR_BUCKET_NAME') || 'hakivo';

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Missing Vultr S3 credentials');
  }

  const s3Client = new S3Client({
    endpoint: `https://${endpoint}`,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const key = generateFileKey(briefId);

  console.log(`[IMAGE] Uploading to Vultr: bucket=${bucketName}, key=${key}, size=${imageBuffer.length} bytes`);

  await s3Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: imageBuffer,
    ContentType: mimeType,
    CacheControl: 'public, max-age=31536000',
    Metadata: {
      briefId: briefId,
      generatedAt: new Date().toISOString(),
    },
  }));

  const url = `https://${endpoint}/${bucketName}/${key}`;
  console.log(`[IMAGE] Upload successful: ${url}`);

  return url;
}

/**
 * Generate WSJ-style editorial sketch image using Gemini
 */
async function generateImage(brief: Brief, geminiApiKey: string): Promise<string | null> {
  console.log(`[IMAGE] Generating image for brief: ${brief.id}`);
  console.log(`[IMAGE] Title: ${brief.title}`);

  try {
    // Extract policy topics from news_json if available
    let policyContext = 'legislation';
    if (brief.news_json) {
      try {
        const newsData = JSON.parse(brief.news_json);
        // Extract topics from news articles if available
        if (newsData.articles && Array.isArray(newsData.articles)) {
          const topics = newsData.articles
            .slice(0, 3)
            .map((a: any) => a.topic || a.category)
            .filter(Boolean);
          if (topics.length > 0) {
            policyContext = topics.join(', ');
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    // WSJ-inspired editorial sketch prompt
    const imagePrompt = `Wall Street Journal inspired sketch editorial image for a news article about ${policyContext}. The image should convey the essence of: "${brief.title}". Style: Hand-drawn editorial illustration, clean composition, suitable for a civic engagement platform. Include subtle American civic imagery like the Capitol building, congressional setting, or professional political environment. No text in the image.`;

    console.log(`[IMAGE] Prompt: ${imagePrompt.substring(0, 150)}...`);

    const response = await fetch(`${GEMINI_IMAGE_ENDPOINT}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: imagePrompt }]
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE']
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[IMAGE] Gemini API error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: {
              mimeType: string;
              data: string;
            }
          }>
        }
      }>
    };

    // Extract image data from response
    const candidates = result.candidates;
    if (!candidates || candidates.length === 0) {
      console.warn('[IMAGE] No candidates in Gemini response');
      return null;
    }

    const parts = candidates[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      console.warn('[IMAGE] No parts in Gemini response');
      return null;
    }

    // Find the image part
    const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
    if (!imagePart?.inlineData) {
      console.warn('[IMAGE] No image data in Gemini response');
      return null;
    }

    const { mimeType, data: base64Data } = imagePart.inlineData;
    console.log(`[IMAGE] Received image: ${mimeType}, ${base64Data.length} base64 chars`);

    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const imageBuffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      imageBuffer[i] = binaryString.charCodeAt(i);
    }

    // Upload to Vultr storage
    console.log('[IMAGE] Uploading image to Vultr storage...');
    const imageUrl = await uploadImage(brief.id, imageBuffer, mimeType);

    // Update brief with image URL
    await updateBriefImage(brief.id, imageUrl);

    console.log(`[IMAGE] Successfully generated image for brief ${brief.id}`);
    return imageUrl;

  } catch (error) {
    console.error('[IMAGE] Image generation error:', error);
    return null;
  }
}

/**
 * Background function handler - polls database for briefs needing images
 */
export default async (_req: Request, _context: Context) => {
  console.log('[IMAGE] Background function triggered');

  const geminiApiKey = Netlify.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    console.error('[IMAGE] GEMINI_API_KEY not configured');
    return;
  }

  // Query for briefs needing images
  const briefs = await getBriefsNeedingImages();

  if (briefs.length > 0) {
    console.log(`[IMAGE] Found ${briefs.length} brief(s) needing images`);

    for (const brief of briefs) {
      await generateImage(brief, geminiApiKey);
    }
  } else {
    console.log('[IMAGE] No briefs need image generation');
  }

  console.log('[IMAGE] Background function complete');
};
