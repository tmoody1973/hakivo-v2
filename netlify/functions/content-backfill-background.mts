/**
 * Netlify Background Function for Content Backfill
 *
 * Regenerates written articles for briefs that have scripts but empty content.
 * Uses Gemini Flash to convert podcast scripts into professional articles.
 *
 * Background functions get 15-minute timeout (vs 10s for regular functions).
 */
import type { Context } from "@netlify/functions";

// Gemini Flash for text generation (stable model)
const GEMINI_TEXT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Get Raindrop DB admin service URL from env or use default
const getDbAdminUrl = () => {
  const envUrl = Netlify.env.get('RAINDROP_DB_ADMIN_URL');
  if (envUrl) return envUrl;
  return 'https://svc-01kc6rbecv0s5k4yk6ksdaqyzq.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
};

interface BriefToBackfill {
  id: string;
  title: string;
  script: string;
  news_json: string | null;
  content_length: number;
}

interface NewsItem {
  headline: string;
  summary: string;
  url: string;
  source: string;
  date?: string;
}

interface NewsJSON {
  categories?: {
    federal_legislation?: NewsItem[];
    state_legislation?: NewsItem[];
    policy_news?: Record<string, NewsItem[]>;
  };
}

/**
 * Query database for briefs with scripts but empty content
 */
async function getBriefsNeedingBackfill(): Promise<BriefToBackfill[]> {
  const query = `SELECT id, title, script, news_json, LENGTH(content) as content_length FROM briefs WHERE status = 'completed' AND script IS NOT NULL AND LENGTH(script) > 500 AND (content IS NULL OR LENGTH(content) < 100) ORDER BY created_at DESC LIMIT 5`;

  console.log(`[BACKFILL] Querying for briefs needing content backfill...`);

  const response = await fetch(`${getDbAdminUrl()}/db-admin/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    console.error(`[BACKFILL] Failed to query briefs: ${response.status}`);
    return [];
  }

  const result = await response.json() as { results?: BriefToBackfill[] };
  const briefs = result.results || [];

  console.log(`[BACKFILL] Found ${briefs.length} briefs needing backfill`);
  return briefs;
}

/**
 * Update brief with regenerated content
 */
async function updateBriefContent(briefId: string, content: string): Promise<boolean> {
  const timestamp = Date.now();
  // Escape single quotes in content for SQL
  const escapedContent = content.replace(/'/g, "''");
  const query = `UPDATE briefs SET content = '${escapedContent}', updated_at = ${timestamp} WHERE id = '${briefId}'`;

  const response = await fetch(`${getDbAdminUrl()}/db-admin/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    console.error(`[BACKFILL] Failed to update brief content: ${response.status}`);
    return false;
  }

  return true;
}

/**
 * Extract all news sources from news_json for citation
 */
function extractNewsSources(newsJsonStr: string | null): string {
  if (!newsJsonStr) return '';

  try {
    const newsData: NewsJSON = JSON.parse(newsJsonStr);
    const sources: string[] = [];

    // Federal legislation
    if (newsData.categories?.federal_legislation) {
      for (const item of newsData.categories.federal_legislation) {
        sources.push(`- [${item.headline}](${item.url}) (${item.source})`);
      }
    }

    // State legislation
    if (newsData.categories?.state_legislation) {
      for (const item of newsData.categories.state_legislation) {
        sources.push(`- [${item.headline}](${item.url}) (${item.source})`);
      }
    }

    // Policy news by category
    if (newsData.categories?.policy_news) {
      for (const [category, items] of Object.entries(newsData.categories.policy_news)) {
        for (const item of items) {
          sources.push(`- [${item.headline}](${item.url}) (${item.source}) - ${category}`);
        }
      }
    }

    return sources.length > 0 ? sources.join('\n') : '';
  } catch {
    return '';
  }
}

/**
 * Extract bill references from script text
 */
function extractBillReferences(script: string): string[] {
  const bills: string[] = [];

  // Federal bills: H.R. 1234, S. 1234, HR1234, S1234
  const federalRegex = /\b(H\.?R\.?\s*\d+|S\.?\s*\d+)\b/gi;
  const federalMatches = script.match(federalRegex) || [];
  bills.push(...federalMatches.map(b => b.toUpperCase().replace(/\s+/g, ' ')));

  // State bills: House File 1234, HF 1234, Senate File 1234, SF 1234
  const stateRegex = /\b(House\s+File\s+\d+|HF\s*\d+|Senate\s+File\s+\d+|SF\s*\d+)\b/gi;
  const stateMatches = script.match(stateRegex) || [];
  bills.push(...stateMatches);

  return Array.from(new Set(bills)); // Deduplicate
}

/**
 * Convert podcast script to written article using Gemini Flash
 */
async function scriptToArticle(brief: BriefToBackfill, geminiApiKey: string): Promise<string | null> {
  console.log(`[BACKFILL] Converting script to article for brief: ${brief.id}`);
  console.log(`[BACKFILL] Title: ${brief.title}`);
  console.log(`[BACKFILL] Script length: ${brief.script.length} chars`);

  try {
    // Extract sources and bills
    const sources = extractNewsSources(brief.news_json);
    const bills = extractBillReferences(brief.script);

    console.log(`[BACKFILL] Found ${bills.length} bill references, ${sources ? 'has' : 'no'} news sources`);

    const systemPrompt = `You are an expert political journalist transforming a podcast script into a professional written article.

CRITICAL REQUIREMENTS:
1. Convert the conversational podcast format into a formal written article
2. Include HYPERLINKS to sources using markdown format: [text](url)
3. When mentioning bills, link them:
   - Federal bills: [H.R. 1234](https://www.congress.gov/bill/119th-congress/house-bill/1234) or [S. 567](https://www.congress.gov/bill/119th-congress/senate-bill/567)
   - State bills (Minnesota): Link to openstates.org or legis.state.mn.us
4. Use professional journalistic style with proper paragraph structure
5. Include a compelling introduction and conclusion
6. Target 800-1200 words
7. NO markdown formatting in the title/headline (no ** or __)
8. Include section headers as ## Markdown
9. MINIMUM 5 hyperlinked citations to sources

OUTPUT: Return ONLY the article text in markdown format. No preamble or explanation.`;

    let userPrompt = `Convert this podcast script into a professional written article with proper source citations and hyperlinks:

TITLE: ${brief.title}

SCRIPT:
${brief.script}`;

    if (sources) {
      userPrompt += `

AVAILABLE SOURCE LINKS (use these for citations):
${sources}`;
    }

    if (bills.length > 0) {
      userPrompt += `

BILLS MENTIONED (link to congress.gov or state legislature):
${bills.join(', ')}`;
    }

    userPrompt += `

REQUIREMENTS:
- Include hyperlinks to sources throughout the article
- Link bill numbers to their official pages
- Use formal journalistic tone
- Structure with clear sections (## headers)
- Minimum 5 source citations with hyperlinks`;

    // Call Gemini Flash API
    const response = await fetch(`${GEMINI_TEXT_ENDPOINT}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 4000,
          responseMimeType: 'text/plain'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[BACKFILL] Gemini API error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const article = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!article || article.length < 200) {
      console.error(`[BACKFILL] Article too short: ${article?.length || 0} chars`);
      return null;
    }

    const wordCount = article.split(/\s+/).length;
    console.log(`[BACKFILL] Generated article: ${wordCount} words, ${article.length} chars`);

    return article;

  } catch (error) {
    console.error('[BACKFILL] Article generation error:', error);
    return null;
  }
}

/**
 * Background function handler - regenerates articles from scripts
 */
export default async (_req: Request, _context: Context) => {
  console.log('[BACKFILL] Background function triggered');

  const geminiApiKey = Netlify.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    console.error('[BACKFILL] GEMINI_API_KEY not configured');
    return new Response('GEMINI_API_KEY not configured', { status: 500 });
  }

  // Query for briefs needing backfill
  const briefs = await getBriefsNeedingBackfill();

  if (briefs.length === 0) {
    console.log('[BACKFILL] No briefs need backfill');
    return new Response(JSON.stringify({ message: 'No briefs need backfill', processed: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let successCount = 0;
  let failCount = 0;

  for (const brief of briefs) {
    const article = await scriptToArticle(brief, geminiApiKey);

    if (article) {
      const updated = await updateBriefContent(brief.id, article);
      if (updated) {
        successCount++;
        console.log(`[BACKFILL] ✓ Successfully backfilled brief ${brief.id}`);
      } else {
        failCount++;
        console.error(`[BACKFILL] ✗ Failed to update brief ${brief.id}`);
      }
    } else {
      failCount++;
      console.error(`[BACKFILL] ✗ Failed to generate article for brief ${brief.id}`);
    }

    // Small delay between requests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`[BACKFILL] Complete: ${successCount} success, ${failCount} failed`);

  return new Response(JSON.stringify({
    message: 'Backfill complete',
    processed: briefs.length,
    success: successCount,
    failed: failCount
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
