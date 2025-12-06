import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * Podcast Generator Service
 *
 * Generates episodes for "100 Laws That Shaped America" podcast.
 * Each episode is a 10-12 minute multi-host narrative podcast
 * in the style of "This American Life".
 *
 * Anti-Hallucination Strategy:
 * - All facts come ONLY from the structured historic_laws database
 * - Claude's job is to make facts ENGAGING, not to add new facts
 * - Explicit instructions forbid making up dates, quotes, or events
 */

interface HistoricLaw {
  id: number;
  name: string;
  year: number;
  public_law: string;
  president_signed: string;
  category: string;
  description: string;
  key_provisions: string; // JSON string
  historical_impact: string;
}

interface GenerationResult {
  success: boolean;
  episodeId?: string;
  headline?: string;
  error?: string;
}

// Podcast-specific voice configuration (different from Daily Brief)
const PODCAST_VOICES = {
  hostA: 'Aoede',   // Expressive female (vs Kore for daily brief)
  hostB: 'Charon',  // Deep male (vs Puck for daily brief)
  nameA: 'Sarah',
  nameB: 'David'
};

/**
 * Podcast Generator Service
 */
export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'POST' && path === '/generate') {
      return this.handleGenerate(request);
    }

    if (request.method === 'POST' && path === '/generate-specific') {
      return this.handleGenerateSpecific(request);
    }

    if (request.method === 'GET' && path === '/next') {
      return this.handleGetNext();
    }

    if (request.method === 'GET' && path === '/status') {
      return this.handleStatus();
    }

    if (request.method === 'GET' && path === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'podcast-generator',
        voices: PODCAST_VOICES
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * Generate the next episode in sequence
   */
  private async handleGenerate(request: Request): Promise<Response> {
    try {
      // Get next ungenerated law
      const nextLaw = await this.getNextLaw();

      if (!nextLaw) {
        return new Response(JSON.stringify({
          success: false,
          error: 'All episodes have been generated'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await this.generateEpisode(nextLaw);

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[PODCAST-GEN] Generation failed:', errorMessage);
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Generate episode for a specific law ID
   */
  private async handleGenerateSpecific(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { lawId: number };

      if (!body.lawId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'lawId is required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const law = await this.getLawById(body.lawId);

      if (!law) {
        return new Response(JSON.stringify({
          success: false,
          error: `Law with id ${body.lawId} not found`
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await this.generateEpisode(law);

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get information about the next law to generate
   */
  private async handleGetNext(): Promise<Response> {
    const nextLaw = await this.getNextLaw();

    if (!nextLaw) {
      return new Response(JSON.stringify({
        hasNext: false,
        message: 'All episodes have been generated'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      hasNext: true,
      law: {
        id: nextLaw.id,
        name: nextLaw.name,
        year: nextLaw.year,
        category: nextLaw.category
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get generation status
   */
  private async handleStatus(): Promise<Response> {
    const db = this.env.APP_DB;

    const [totalResult, generatedResult, pendingResult] = await Promise.all([
      db.prepare('SELECT COUNT(*) as count FROM historic_laws').first(),
      db.prepare('SELECT COUNT(*) as count FROM historic_laws WHERE episode_generated = 1').first(),
      db.prepare("SELECT COUNT(*) as count FROM podcast_episodes WHERE status IN ('pending', 'generating', 'script_ready')").first()
    ]);

    const total = (totalResult as any)?.count || 0;
    const generated = (generatedResult as any)?.count || 0;
    const pending = (pendingResult as any)?.count || 0;

    return new Response(JSON.stringify({
      total,
      generated,
      remaining: total - generated,
      pendingProcessing: pending,
      percentComplete: Math.round((generated / total) * 100)
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get the next law that hasn't had an episode generated
   */
  private async getNextLaw(): Promise<HistoricLaw | null> {
    const result = await this.env.APP_DB
      .prepare(`
        SELECT * FROM historic_laws
        WHERE episode_generated = 0
        ORDER BY year ASC, id ASC
        LIMIT 1
      `)
      .first();

    return result as HistoricLaw | null;
  }

  /**
   * Get a specific law by ID
   */
  private async getLawById(lawId: number): Promise<HistoricLaw | null> {
    const result = await this.env.APP_DB
      .prepare('SELECT * FROM historic_laws WHERE id = ?')
      .bind(lawId)
      .first();

    return result as HistoricLaw | null;
  }

  /**
   * Generate a complete episode for a law
   */
  private async generateEpisode(law: HistoricLaw): Promise<GenerationResult> {
    const startTime = Date.now();
    const episodeId = `ep-${law.id}-${Date.now()}`;

    console.log(`🎙️ [PODCAST-GEN] Starting episode for: ${law.name} (${law.year})`);

    try {
      // Get episode number (count of existing episodes + 1)
      const countResult = await this.env.APP_DB
        .prepare('SELECT COUNT(*) as count FROM podcast_episodes')
        .first() as { count: number };
      const episodeNumber = (countResult?.count || 0) + 1;

      // Create initial episode record
      const now = Date.now();
      await this.env.APP_DB
        .prepare(`
          INSERT INTO podcast_episodes (
            id, law_id, episode_number, title, headline, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(episodeId, law.id, episodeNumber, law.name, 'Generating...', 'generating', now, now)
        .run();

      // Generate script and headline using Claude
      console.log(`[PODCAST-GEN] Generating script with Claude...`);
      const scriptResult = await this.generateScript(law);

      if (!scriptResult.script || !scriptResult.headline) {
        throw new Error('Failed to generate script or headline');
      }

      console.log(`[PODCAST-GEN] Script generated: ${scriptResult.script.length} chars`);
      console.log(`[PODCAST-GEN] Headline: ${scriptResult.headline}`);

      // Generate thumbnail
      console.log(`[PODCAST-GEN] Generating thumbnail...`);
      const thumbnailUrl = await this.generateThumbnail(law, episodeId);
      console.log(`[PODCAST-GEN] Thumbnail: ${thumbnailUrl || 'failed'}`);

      // Update episode record with script (audio will be processed separately)
      await this.env.APP_DB
        .prepare(`
          UPDATE podcast_episodes
          SET headline = ?,
              description = ?,
              script = ?,
              thumbnail_url = ?,
              character_count = ?,
              status = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .bind(
          scriptResult.headline,
          scriptResult.description,
          scriptResult.script,
          thumbnailUrl,
          scriptResult.script.length,
          'script_ready', // Ready for audio processing
          Date.now(),
          episodeId
        )
        .run();

      // Mark law as having episode generated
      await this.env.APP_DB
        .prepare('UPDATE historic_laws SET episode_generated = 1, episode_id = ?, updated_at = ? WHERE id = ?')
        .bind(episodeId, Date.now(), law.id)
        .run();

      const elapsed = Date.now() - startTime;
      console.log(`✅ [PODCAST-GEN] Episode ${episodeNumber} created in ${elapsed}ms: ${scriptResult.headline}`);

      return {
        success: true,
        episodeId,
        headline: scriptResult.headline
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ [PODCAST-GEN] Failed for ${law.name}:`, errorMessage);

      // Update episode status to failed
      await this.env.APP_DB
        .prepare("UPDATE podcast_episodes SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?")
        .bind(errorMessage, Date.now(), episodeId)
        .run();

      return {
        success: false,
        episodeId,
        error: errorMessage
      };
    }
  }

  /**
   * Generate podcast script using Claude
   * CRITICAL: Uses ONLY the structured law data to prevent hallucination
   */
  private async generateScript(law: HistoricLaw): Promise<{
    script: string;
    headline: string;
    description: string;
  }> {
    // Parse key provisions
    let keyProvisions: string[];
    try {
      keyProvisions = JSON.parse(law.key_provisions);
    } catch {
      keyProvisions = [law.key_provisions];
    }

    const { nameA, nameB } = PODCAST_VOICES;

    // Get decade context
    const decade = Math.floor(law.year / 10) * 10;
    const decadeContext = this.getDecadeContext(decade);

    // System prompt with anti-hallucination instructions
    const systemPrompt = `You are writing a podcast script for "100 Laws That Shaped America" - a narrative documentary podcast in the style of This American Life.

YOUR ROLE: You are a STORYTELLER, not a fact-finder. All facts have been verified and provided below. Your job is to make these facts COMPELLING through narrative, not to add new facts.

HOSTS: ${nameA} (female lead narrator) and ${nameB} (male color commentator who asks questions and adds perspective)

=== VERIFIED LAW DATA (THIS IS YOUR ONLY SOURCE OF TRUTH) ===
Name: ${law.name}
Year: ${law.year}
Public Law: ${law.public_law}
President Who Signed: ${law.president_signed}
Category: ${law.category}
Description: ${law.description}
Key Provisions:
${keyProvisions.map(p => `  • ${p}`).join('\n')}
Historical Impact: ${law.historical_impact}

=== HISTORICAL CONTEXT FOR THE ${decade}s ===
${decadeContext}

=== YOUR TASK ===
Create a 10-12 minute two-host podcast script (approximately 2000-2400 words) that:

1. COLD OPEN (30 seconds): Start with a compelling hook - paint a picture of what life was like BEFORE this law, or describe a pivotal moment that led to it

2. INTRODUCTION (1 minute): ${nameA} introduces the episode topic, ${nameB} sets up why it matters

3. THE PROBLEM (2-3 minutes): What was wrong? Why did America need this law? Use the description and historical context.

4. THE SOLUTION (2-3 minutes): Walk through the key provisions in plain language. What did this law actually DO?

5. THE IMPACT (2-3 minutes): How did this change America? Use the historical_impact field as your guide.

6. TODAY'S CONNECTION (1-2 minutes): How does this law still affect us today? Is it still in effect? Has it been modified?

7. CLOSE (30-45 seconds): Wrap up with a thought-provoking reflection

CRITICAL FORMATTING:
- Every line MUST start with "${nameA.toUpperCase()}:" or "${nameB.toUpperCase()}:" followed by dialogue
- Include emotional cues in brackets: [thoughtfully], [with wonder], [seriously], [warmly]
- ${nameB} should ask clarifying questions, express surprise, and help explain complex concepts
- Natural conversational flow - hosts use each other's names occasionally
- NO section headers in the actual script - just natural transitions

FORBIDDEN (THESE WILL CAUSE FACTUAL ERRORS):
- Making up specific vote counts, dates, or statistics not in the data above
- Inventing quotes from historical figures
- Adding "facts" about this law from your training data
- Claiming specific numbers of people affected unless stated above
- Making up names of legislators, activists, or other people

ALLOWED:
- Describing the general mood/context of the ${decade}s era
- Using vivid, evocative language to bring the story to life
- Making reasonable inferences about daily life in that era
- Referencing broadly known historical events from that decade
- Explaining what terms meant in plain language`;

    const userPrompt = `Generate the podcast script for Episode: "${law.name}" (${law.year})

After the script, provide:
1. HEADLINE: A catchy, engaging episode title (max 10 words) that would make someone want to listen
2. DESCRIPTION: A 2-3 sentence episode description for show notes

Format your response as:
HEADLINE: [Your engaging headline]

DESCRIPTION: [Your 2-3 sentence description]

SCRIPT:
${nameA.toUpperCase()}: [emotional cue] dialogue...
${nameB.toUpperCase()}: [emotional cue] dialogue...
...`;

    // Call Claude via the Claude client service
    const result = await this.env.CLAUDE_CLIENT.generateCompletion(
      systemPrompt,
      userPrompt,
      4096,  // max tokens
      0.7    // temperature - creative but coherent
    );

    // Parse the response
    const content = result.content || '';

    // Extract headline
    const headlineMatch = content.match(/HEADLINE:\s*(.+?)(?:\n|DESCRIPTION:)/i);
    const headline = headlineMatch?.[1]?.trim() || `Episode: ${law.name}`;

    // Extract description
    const descMatch = content.match(/DESCRIPTION:\s*(.+?)(?:\n\nSCRIPT:|SCRIPT:)/is);
    const description = descMatch?.[1]?.trim() || law.description;

    // Extract script
    const scriptMatch = content.match(/SCRIPT:\s*([\s\S]+)/i);
    let script = scriptMatch?.[1]?.trim() || content;

    // Clean up script - remove any remaining headers
    script = script.replace(/^(HEADLINE|DESCRIPTION|SCRIPT):.+?\n/gim, '').trim();

    return { script, headline, description };
  }

  /**
   * Generate episode thumbnail using Gemini
   */
  private async generateThumbnail(law: HistoricLaw, episodeId: string): Promise<string | null> {
    try {
      const geminiApiKey = this.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        console.warn('[PODCAST-GEN] GEMINI_API_KEY not set, skipping thumbnail');
        return null;
      }

      const decade = Math.floor(law.year / 10) * 10;

      const imagePrompt = `Create a vintage-inspired documentary poster image for a podcast episode about "${law.name}" from ${law.year}.

Style: Muted, sepia-toned colors reminiscent of ${decade}s photography and documents. Documentary aesthetic.
Theme: ${law.category}
Era: ${decade}s America

The image should evoke the historical period and the theme of ${law.description.substring(0, 100)}.

IMPORTANT:
- Do NOT include any text, words, titles, or labels in the image
- Focus on symbolic imagery that represents the law's theme
- Use period-appropriate visual elements
- Create a composition suitable for a podcast thumbnail (square format)`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: imagePrompt }] }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE']
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[PODCAST-GEN] Gemini image error: ${response.status} - ${errorText}`);
        return null;
      }

      const result = await response.json();
      const parts = result.candidates?.[0]?.content?.parts;
      const imagePart = parts?.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));

      if (!imagePart?.inlineData) {
        console.warn('[PODCAST-GEN] No image data in Gemini response');
        return null;
      }

      const { mimeType, data: base64Data } = imagePart.inlineData;

      // Convert base64 to Uint8Array
      const binaryString = atob(base64Data);
      const imageBuffer = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        imageBuffer[i] = binaryString.charCodeAt(i);
      }

      // Upload to Vultr storage
      const uploadResult = await this.env.VULTR_STORAGE_CLIENT.uploadImage(
        `podcast-${episodeId}`,
        imageBuffer,
        mimeType,
        { lawName: law.name, year: String(law.year) }
      );

      return uploadResult.url;

    } catch (error) {
      console.error('[PODCAST-GEN] Thumbnail generation failed:', error);
      return null;
    }
  }

  /**
   * Get historical context for a decade
   */
  private getDecadeContext(decade: number): string {
    const contexts: Record<number, string> = {
      1900: "The Progressive Era - America is industrializing rapidly. Muckraking journalists expose corruption. Theodore Roosevelt champions reform.",
      1910: "World War I looms. Women's suffrage movement gains momentum. The federal government expands its role in regulating business.",
      1920: "The Roaring Twenties - Prohibition, jazz, flappers. Economic boom followed by the 1929 crash. Immigration restrictions tighten.",
      1930: "The Great Depression devastates America. FDR's New Deal transforms government. One in four Americans unemployed at the worst.",
      1940: "World War II mobilizes the nation. The home front transforms. Post-war prosperity and the GI Bill reshape society.",
      1950: "Cold War tensions rise. McCarthyism and fear of communism. Suburban growth. The civil rights movement begins to stir.",
      1960: "The Civil Rights Movement reaches its peak. JFK, LBJ's Great Society. Vietnam War protests. Cultural revolution.",
      1970: "Watergate. Environmental movement. Women's rights. Economic stagflation. Distrust of government grows.",
      1980: "Reagan Revolution. Deregulation. Cold War tensions. Economic recovery. Beginning of the computer age.",
      1990: "End of Cold War. Technology boom. Globalization accelerates. Economic prosperity returns."
    };

    return contexts[decade] || `The ${decade}s in America - a time of significant change and development.`;
  }
}

// Export types
export interface PodcastGeneratorBody {
  lawId?: number;
}
