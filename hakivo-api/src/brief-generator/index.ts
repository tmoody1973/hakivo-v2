import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { getPolicyAreasForInterests, getKeywordsForInterests } from '../config/user-interests';
import type { FederalRegisterDocument } from '../federal-register-client';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Brief Generator - Multi-Stage Pipeline
 *
 * This observer handles brief generation in stages:
 * - Stage 1-4: Content gathering (user prefs, bills, actions, news)
 * - Stage 5: Script generation (Gemini 3 Flash - fast, rich writing)
 * - Stage 6: Article generation (Gemini 3 Flash - emotional depth & coherence)
 * - Stage 7: Set status to 'script_ready' and trigger immediate audio processing
 *
 * Audio generation is handled by Netlify Background Function (audio-processor):
 * - Immediately triggered after script generation completes (for fast new user experience)
 * - Also polled every 5 minutes by audio-retry-scheduler (for retries and cron briefs)
 * - 15-minute timeout (vs 30s observer limit)
 * - Uses Gemini TTS with multi-speaker dialogue
 * - Updates brief status to 'completed' or 'audio_failed' when done
 */
export default class extends Each<Body, Env> {
  async process(message: Message<Body>): Promise<void> {
    const { briefId, userId, type, startDate, endDate } = message.body;
    const startTime = Date.now();

    console.log(`🎙️ [BRIEF-GEN] Starting: ${briefId} (${type}) for user ${userId}`);

    try {
      // Wrap entire process in outer try-catch to catch any escaping errors
      await this.processStages(briefId, userId, type, startDate, endDate, startTime);
    } catch (outerError) {
      const errorMessage = outerError instanceof Error ? outerError.message : String(outerError);
      console.error(`❌ [BRIEF-GEN] OUTER CATCH - Unhandled error for ${briefId}: ${errorMessage}`);

      try {
        await this.env.APP_DB
          .prepare('UPDATE briefs SET status = ?, updated_at = ? WHERE id = ?')
          .bind('failed', Date.now(), briefId)
          .run();
      } catch (dbError) {
        console.error(`❌ [BRIEF-GEN] Failed to update status to failed: ${dbError}`);
      }
    }
  }

  /**
   * Process all stages of brief generation
   */
  private async processStages(
    briefId: string,
    userId: string,
    type: string,
    startDate: string,
    endDate: string,
    startTime: number
  ): Promise<void> {
    const db = this.env.APP_DB;
    console.log(`[STAGE-0] DB binding available: ${!!db}`);

    // Update status to processing
    console.log(`[STAGE-0] Updating status to processing...`);
    await db
      .prepare('UPDATE briefs SET status = ? WHERE id = ?')
      .bind('processing', briefId)
      .run();
    console.log(`[STAGE-0] Status updated. Elapsed: ${Date.now() - startTime}ms`);

    // ==================== STAGE 1: GET USER PREFERENCES & PROFILE ====================
    console.log(`[STAGE-1] Getting user preferences and profile for ${userId}...`);
    const userPrefs = await this.getUserPreferences(userId);
    const userProfile = await this.getUserProfile(userId);
    console.log(`[STAGE-1] Got prefs: ${userPrefs ? 'found' : 'not found'}, profile: ${userProfile ? 'found' : 'not found'}. Elapsed: ${Date.now() - startTime}ms`);

    if (!userPrefs) {
      console.log(`⚠️ [STAGE-1] No user preferences found for ${userId}`);
      await db.prepare('UPDATE briefs SET status = ?, updated_at = ? WHERE id = ?')
        .bind('failed', Date.now(), briefId).run();
      return;
    }

    // Extract personalization data
    const userName = userProfile?.first_name || 'there';
    const userState = userPrefs.state || null;
    const userDistrict = userPrefs.district || null;
    console.log(`📍 [STAGE-1] User: ${userName}, Location: ${userState ? `${userState}-${userDistrict}` : 'not set'}`);

    // Parse policy interests carefully
    console.log(`[STAGE-1] Raw policy_interests type: ${typeof userPrefs.policy_interests}`);
    console.log(`[STAGE-1] Raw policy_interests value: ${JSON.stringify(userPrefs.policy_interests).substring(0, 200)}`);

    let policyInterests: string[];
    try {
      if (typeof userPrefs.policy_interests === 'string') {
        policyInterests = JSON.parse(userPrefs.policy_interests);
      } else if (Array.isArray(userPrefs.policy_interests)) {
        policyInterests = userPrefs.policy_interests as string[];
      } else {
        console.log(`⚠️ [STAGE-1] Invalid policy_interests format`);
        await db.prepare('UPDATE briefs SET status = ?, updated_at = ? WHERE id = ?')
          .bind('failed', Date.now(), briefId).run();
        return;
      }
    } catch (parseError) {
      console.error(`[STAGE-1] Failed to parse policy_interests: ${parseError}`);
      await db.prepare('UPDATE briefs SET status = ?, updated_at = ? WHERE id = ?')
        .bind('failed', Date.now(), briefId).run();
      return;
    }

    if (!policyInterests || policyInterests.length === 0) {
      console.log(`⚠️ [STAGE-1] No policy interests for user ${userId}`);
      await db.prepare('UPDATE briefs SET status = ?, updated_at = ? WHERE id = ?')
        .bind('failed', Date.now(), briefId).run();
      return;
    }

    console.log(`📋 [STAGE-1] User interests (${policyInterests.length}): ${policyInterests.join(', ')}`);
    console.log(`[STAGE-1] Complete. Elapsed: ${Date.now() - startTime}ms`);

    // ==================== STAGE 2: GET RECENTLY FEATURED BILLS (for deduplication) ====================
    // Extend window to 30 days to prevent repeating bills within a month
    console.log(`[STAGE-2a] Getting recently featured bills to avoid duplication...`);
    let recentlyFeaturedBillIds: string[] = [];
    try {
      recentlyFeaturedBillIds = await this.getRecentlyFeaturedBills(userId, 30); // Last 30 days
      console.log(`[STAGE-2a] Found ${recentlyFeaturedBillIds.length} recently featured bills to exclude (30-day window)`);
    } catch (recentError) {
      console.warn(`[STAGE-2a] Failed to get recent bills (non-fatal):`, recentError);
    }

    // ==================== STAGE 2b: FETCH PERSONALIZED BILLS ====================
    console.log(`[STAGE-2b] Fetching personalized bills...`);
    let bills: any[];
    let repBills: any[] = [];

    try {
      // First priority: Get bills from user's representatives
      if (userState) {
        repBills = await this.getRepresentativeBills(userState, userDistrict, recentlyFeaturedBillIds);
        console.log(`[STAGE-2b] Got ${repBills.length} bills from user's representatives`);
      }

      // Second: Get interest-matched bills with variation
      // Use expanded date range (14 days) to ensure we find content even during quiet periods
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || '';
      const interestBills = await this.getBillsByInterests(
        policyInterests,
        fourteenDaysAgo, // Expanded date range
        endDate,
        [...recentlyFeaturedBillIds, ...repBills.map(b => b.id)],
        userId // Pass userId for seeded variation
      );
      console.log(`[STAGE-2b] Got ${interestBills.length} interest-matched bills (looking back 14 days)`);

      // FIXED: Interest bills FIRST (fresher, more relevant to user preferences)
      // Rep bills are supplementary - include only if recent (within 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || '';
      const recentRepBills = repBills.filter((b: any) =>
        b.latest_action_date && b.latest_action_date >= sevenDaysAgo
      );

      // Lead with interest-matched bills (up to 4), then add 1 recent rep bill if available
      const interestBillsToInclude = interestBills.slice(0, 4);
      const repBillsToInclude = recentRepBills.slice(0, 1); // Max 1 rep bill as bonus

      // Combine: Interest bills FIRST, then rep bill bonus
      bills = [...interestBillsToInclude, ...repBillsToInclude];

      console.log(`[STAGE-2b] Fresh content first: ${interestBillsToInclude.length} interest + ${repBillsToInclude.length} rep bills`);
      console.log(`[STAGE-2b] Total ${bills.length} personalized bills. Elapsed: ${Date.now() - startTime}ms`);
    } catch (billError) {
      console.error(`[STAGE-2b] FAILED:`, billError);
      await db.prepare('UPDATE briefs SET status = ?, updated_at = ? WHERE id = ?')
        .bind('failed', Date.now(), briefId).run();
      return;
    }

    // Note: If no bills found, we'll continue and rely on news articles
    // This ensures briefs can be generated even during Congressional recess
    if (bills.length === 0) {
      console.log(`⚠️ [STAGE-2b] No bills found matching interests - will rely on news articles`);
    }

    // Track which are rep bills for script personalization
    const repBillIds = new Set(repBills.map(b => b.id));

    // ==================== STAGE 2c: FETCH STATE LEGISLATURE BILLS ====================
    let stateBills: any[] = [];
    if (userState) {
      console.log(`[STAGE-2c] Fetching state legislature bills for ${userState}...`);
      console.log(`[STAGE-2c] Policy interests:`, policyInterests);
      console.log(`[STAGE-2c] Recently featured bill IDs:`, recentlyFeaturedBillIds.length);
      try {
        stateBills = await this.getStateBills(userState, policyInterests, recentlyFeaturedBillIds);
        console.log(`[STAGE-2c] ✅ Got ${stateBills.length} state bills. Elapsed: ${Date.now() - startTime}ms`);
        if (stateBills.length > 0) {
          console.log(`[STAGE-2c] State bills:`, stateBills.map(b => ({ id: b.id, identifier: b.identifier, title: b.title.substring(0, 50) })));
        } else {
          console.warn(`[STAGE-2c] ⚠️ NO state bills returned for ${userState} - this is unexpected!`);
        }
      } catch (stateError) {
        console.error(`[STAGE-2c] ❌ State bills fetch FAILED (non-fatal):`, stateError);
        // Continue without state bills - non-fatal
      }
    } else {
      console.log(`[STAGE-2c] No user state set, skipping state bills`);
    }

    // ==================== STAGE 2d: FETCH FEDERAL REGISTER DOCUMENTS ====================
    // Get recent executive orders, rules, and regulations matching user interests
    let federalRegisterDocs: FederalRegisterBriefDoc[] = [];
    console.log(`[STAGE-2d] Fetching Federal Register documents...`);
    try {
      federalRegisterDocs = await this.getFederalRegisterDocuments(policyInterests);
      console.log(`[STAGE-2d] Got ${federalRegisterDocs.length} Federal Register documents. Elapsed: ${Date.now() - startTime}ms`);
      if (federalRegisterDocs.length > 0) {
        console.log(`[STAGE-2d] Types: ${federalRegisterDocs.map(d => d.type).join(', ')}`);
      }
    } catch (frError) {
      console.error(`[STAGE-2d] Federal Register fetch FAILED (non-fatal):`, frError);
      // Continue without Federal Register - non-fatal
    }

    // ==================== STAGE 3: FETCH BILL ACTIONS ====================
    console.log(`[STAGE-3] Fetching bill actions...`);
    let billsWithActions: any[];
    try {
      billsWithActions = await this.getBillActions(bills);
      console.log(`[STAGE-3] Got actions for ${billsWithActions.length} bills. Elapsed: ${Date.now() - startTime}ms`);
    } catch (actionError) {
      console.error(`[STAGE-3] FAILED:`, actionError);
      // Continue without actions - non-fatal
      billsWithActions = bills.map(b => ({ ...b, actions: [] }));
    }

    // ==================== STAGE 4: FETCH NEWS HEADLINES (Federal + State + Policy) ====================
    console.log(`[STAGE-4] Fetching news headlines from Perplexity...`);
    let newsJSON: NewsJSON;
    try {
      newsJSON = await this.fetchNewsHeadlines(userId, userState, policyInterests);
      console.log(`[STAGE-4] Got ${newsJSON.total_items} news items (${newsJSON.deduplication_stats.duplicates_removed} duplicates removed). Elapsed: ${Date.now() - startTime}ms`);
      console.log(`[STAGE-4] Federal: ${newsJSON.categories.federal_legislation.length}, State: ${newsJSON.categories.state_legislation.length}, Policy: ${Object.keys(newsJSON.categories.policy_news).length} topics`);
    } catch (newsError) {
      console.error(`[STAGE-4] News fetch failed (non-fatal):`, newsError);
      // Continue with empty news - non-fatal
      newsJSON = {
        date_generated: new Date().toISOString(),
        user_state: userState || 'United States',
        categories: {
          federal_legislation: [],
          state_legislation: [],
          policy_news: {}
        },
        total_items: 0,
        deduplication_stats: {
          total_fetched: 0,
          duplicates_removed: 0,
          new_items_included: 0
        }
      };
    }

    // ==================== STAGE 4.5: BILL RESOLUTION PIPELINE ====================
    // Extract bill mentions from news and verify URLs via APIs
    console.log(`[STAGE-4.5] Resolving bill mentions from news content...`);
    let resolvedBills: ResolvedBill[] = [];
    let verifiedBillsContext = '';

    try {
      const mentions = this.extractBillMentions(newsJSON, userState);
      if (mentions.length > 0) {
        resolvedBills = await this.resolveBillMentions(mentions);
        verifiedBillsContext = this.buildVerifiedBillsContext(resolvedBills);
        console.log(`[STAGE-4.5] Bill resolution complete. ${resolvedBills.filter(b => b.found).length} verified. Elapsed: ${Date.now() - startTime}ms`);
      } else {
        console.log(`[STAGE-4.5] No bill mentions found in news content. Elapsed: ${Date.now() - startTime}ms`);
      }
    } catch (resolveError) {
      console.error(`[STAGE-4.5] Bill resolution failed (non-fatal):`, resolveError);
      // Continue without verified bills - non-fatal
    }

    // ==================== CHECKPOINT: SAVE CONTENT GATHERED ====================
    console.log(`[CHECKPOINT] Saving gathered content. Elapsed: ${Date.now() - startTime}ms`);
    await db.prepare('UPDATE briefs SET status = ? WHERE id = ?')
      .bind('content_gathered', briefId).run();

    // ==================== STAGE 5: GENERATE PERSONALIZED SCRIPT ====================
    console.log(`[STAGE-5] Generating personalized script with Claude Sonnet 4.5 + Web Search...`);
    let script: string;
    let headline: string;

    // Build personalization context
    const personalization = {
      userName,
      state: userState,
      district: userDistrict,
      repBillIds: Array.from(repBillIds),
      policyInterests,
      stateBills, // Include state legislature bills
      federalRegisterDocs // Include Federal Register documents (executive orders, rules, notices)
    };

    try {
      const scriptResult = await this.generateScript(type, billsWithActions, newsJSON, personalization);
      script = scriptResult.script;
      headline = scriptResult.headline;
      console.log(`[STAGE-5] Generated script: ${script.length} chars, headline: "${headline}". Elapsed: ${Date.now() - startTime}ms`);
    } catch (scriptError) {
      console.error(`[STAGE-5] Script generation FAILED:`, scriptError);
      await db.prepare('UPDATE briefs SET status = ?, updated_at = ? WHERE id = ?')
        .bind('failed', Date.now(), briefId).run();
      return;
    }

    // ==================== STAGE 6: GENERATE ARTICLE ====================
    console.log(`[STAGE-6] Generating written article with ${verifiedBillsContext ? 'verified bills context' : 'no verified bills'}...`);
    let article: string = '';
    let wordCount: number = 0;
    try {
      const articleResult = await this.generateWrittenArticle(type, billsWithActions, newsJSON, headline, stateBills, userState, verifiedBillsContext);
      article = articleResult.article;
      wordCount = articleResult.wordCount;
      console.log(`[STAGE-6] Generated article: ${wordCount} words. Elapsed: ${Date.now() - startTime}ms`);
    } catch (articleError) {
      console.error(`[STAGE-6] Article generation failed (non-fatal):`, articleError);
      // Continue without article - non-fatal
    }

    // ==================== STAGE 7: GET FEATURE IMAGE ====================
    // Cascade: 1) Gemini AI generation → 2) Perplexity images → 3) og:image fallback
    console.log(`[STAGE-7] Getting feature image...`);

    let featuredImage: string | null = null;

    // Step 1: Generate image with Gemini (preferred - consistent WSJ-style sketches)
    console.log(`[STAGE-7] Generating AI image with Gemini...`);
    try {
      featuredImage = await this.generateFeatureImage(headline, policyInterests, briefId);
      if (featuredImage) {
        console.log(`[STAGE-7] ✅ Generated Gemini image: ${featuredImage}`);
      }
    } catch (imageError) {
      console.error(`[STAGE-7] Gemini image generation failed:`, imageError);
    }

    // Step 2: Try og:image from news URLs if Gemini fails
    if (!featuredImage && newsJSON.total_items > 0) {
      console.log(`[STAGE-7] Gemini failed, trying og:image from news URLs...`);
      // Try federal legislation news first
      for (const article of newsJSON.categories.federal_legislation.slice(0, 2)) {
        if (article.url) {
          try {
            const ogImage = await this.fetchOgImage(article.url);
            if (ogImage) {
              featuredImage = ogImage;
              console.log(`[STAGE-7] Using og:image from ${article.url}: ${featuredImage}`);
              break;
            }
          } catch (ogError) {
            console.warn(`[STAGE-7] Failed to fetch og:image from ${article.url}`);
          }
        }
      }
    }

    // Step 4: Last resort - Pexels stock photos
    if (!featuredImage) {
      console.log(`[STAGE-7] Trying Pexels stock photos as last resort...`);
      try {
        featuredImage = await this.searchPexelsImage(policyInterests);
        if (featuredImage) {
          console.log(`[STAGE-7] Found Pexels image: ${featuredImage}`);
        }
      } catch (pexelsError) {
        console.error(`[STAGE-7] Pexels search failed (non-fatal):`, pexelsError);
      }
    }

    if (!featuredImage) {
      console.log(`[STAGE-7] No image available - brief will have no featured image`);
    }

    // ==================== STAGE 8: SAVE AND MARK FOR AUDIO PROCESSING ====================
    console.log(`[STAGE-8] Saving script and marking for audio processing...`);

    // Format news for storage (save full newsJSON structure)
    const newsJson = newsJSON.total_items > 0 ? JSON.stringify(newsJSON) : null;

    // Save the script and set status to 'script_ready'
    // Netlify scheduled function (audio-processor) polls for this status every 2 minutes
    await db.prepare(`
      UPDATE briefs
      SET status = ?, title = ?, script = ?, content = ?, featured_image = ?, news_json = ?, updated_at = ?
      WHERE id = ?
    `).bind('script_ready', headline, script, article, featuredImage, newsJson, Date.now(), briefId).run();

    // Save news URLs to cache for deduplication in future briefs
    await this.saveNewsToCache(userId, briefId, newsJSON);

    // NOTE: Bills save moved to audio-processor-background.mts as workaround for Raindrop deployment issue
    // The audio processor extracts both federal and state bills from article content and saves them
    // to brief_bills and brief_state_bills junction tables. This enables:
    // 1. Featured Legislation section on frontend
    // 2. Deduplication for future briefs (preventing repeat topics)
    // See saveFederalBillsFromContent() and saveStateBillsFromContent() in audio-processor-background.mts

    // Trigger Netlify audio processor immediately (don't wait for 5-minute scheduler)
    // This ensures new users don't have to wait for their first brief
    console.log(`🎧 [BRIEF-GEN] Triggering immediate audio processing for brief ${briefId}`);
    try {
      const audioResponse = await fetch('https://hakivo-v2.netlify.app/.netlify/functions/audio-processor-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'brief-generator-immediate', briefId }),
      });
      if (audioResponse.ok || audioResponse.status === 202) {
        console.log(`✅ [BRIEF-GEN] Audio processor triggered successfully (${audioResponse.status})`);
      } else {
        console.warn(`⚠️ [BRIEF-GEN] Audio processor trigger returned ${audioResponse.status} - scheduler will retry`);
      }
    } catch (audioError) {
      // Non-fatal: scheduler will pick up the brief within 5 minutes
      console.warn(`⚠️ [BRIEF-GEN] Failed to trigger audio processor immediately:`, audioError);
    }

    // ==================== STAGE 9: SAVE BRIEF TO SMARTMEMORY ====================
    // Save brief episode to SmartMemory for AI assistant context
    // This enables the congressional assistant to reference past briefs and learn user interests
    console.log(`[STAGE-9] Saving brief episode to SmartMemory...`);
    try {
      const civicMemory = this.env.CIVIC_MEMORY;

      // Start a working memory session for this brief episode
      const { sessionId, workingMemory } = await civicMemory.startWorkingMemorySession();

      // Create a structured episodic memory entry with brief details
      const billTitles = billsWithActions.slice(0, 5).map((b: any) => b.title || 'Untitled').join('; ');

      // Create news summary from newsJSON
      const allNews = [
        ...newsJSON.categories.federal_legislation,
        ...newsJSON.categories.state_legislation,
        ...Object.values(newsJSON.categories.policy_news).flat()
      ];
      const newsSummary = allNews.slice(0, 3).map(n => n.headline).join('; ');

      // Format the episodic content - this becomes searchable history
      const episodeContent = [
        `Brief: ${type} brief for ${userName} (${userState || 'US'})`,
        `Topic: ${headline}`,
        `Policy Interests: ${policyInterests.join(', ')}`,
        `Featured Bills: ${billTitles}`,
        newsJSON.total_items > 0 ? `News: ${newsSummary}` : null,
        stateBills && stateBills.length > 0 ? `State Bills: ${stateBills.length} from ${userState}` : null
      ].filter(Boolean).join('\n');

      // Add the brief episode to working memory
      await workingMemory.putMemory({
        content: episodeContent,
        key: `brief:${briefId}`,
        agent: 'brief-generator',
        timeline: `user:${userId}`
      });

      // End session and flush to episodic memory for permanent storage
      await workingMemory.endSession(true);

      console.log(`✅ [STAGE-9] Brief episode saved to SmartMemory (session: ${sessionId})`);
    } catch (memoryError) {
      // Non-fatal - brief generation still succeeds even if memory save fails
      console.warn(`⚠️ [STAGE-9] SmartMemory save failed (non-fatal):`, memoryError);
    }

    // Brief generation complete
    console.log(`✅ [BRIEF-GEN] Script saved with status='script_ready'. Audio processing initiated.`);
    console.log(`✅ [BRIEF-GEN] Total time: ${Date.now() - startTime}ms`);
  }

  /**
   * Generate a photo-realistic feature image for the brief using Gemini 2.5 Flash Image
   * @param headline - Brief headline for image prompt
   * @param policyAreas - Policy areas to include in the prompt
   * @param briefId - Brief ID for file naming
   * @returns URL of the uploaded image, or null if generation fails
   */
  private async generateFeatureImage(
    headline: string,
    policyAreas: string[],
    briefId: string
  ): Promise<string | null> {
    try {
      console.log(`[IMAGE-GEN] Generating feature image for: "${headline}"`);

      // Create a prompt for WSJ-style editorial sketch imagery
      const policyContext = policyAreas.slice(0, 3).join(', ') || 'legislation';
      const imagePrompt = `Wall Street Journal inspired sketch editorial image for a news article about ${policyContext}. The image should convey the essence of: "${headline}". Style: Hand-drawn editorial illustration, clean composition, suitable for a civic engagement platform. Include subtle American civic imagery like the Capitol building, congressional setting, or professional political environment. No text in the image.`;

      console.log(`[IMAGE-GEN] Prompt: ${imagePrompt.substring(0, 100)}...`);

      // Call Gemini 2.5 Flash Image for generation
      const geminiApiKey = this.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        console.warn('[IMAGE-GEN] GEMINI_API_KEY not set, skipping image generation');
        return null;
      }

      // Use gemini-2.5-flash-image (migrated from gemini-2.0-flash-exp per rate limit recommendation)
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${geminiApiKey}`,
        {
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
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[IMAGE-GEN] Gemini API error: ${response.status} - ${errorText}`);
        return null;
      }

      const result = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data: string; mimeType?: string } }> } }> };

      // Extract image data from response
      const candidates = result.candidates;
      if (!candidates || candidates.length === 0) {
        console.warn('[IMAGE-GEN] No candidates in Gemini response');
        return null;
      }

      const parts = candidates[0]?.content?.parts;
      if (!parts || parts.length === 0) {
        console.warn('[IMAGE-GEN] No parts in Gemini response');
        return null;
      }

      // Find the image part
      const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
      if (!imagePart?.inlineData) {
        console.warn('[IMAGE-GEN] No image data in Gemini response');
        return null;
      }

      const { mimeType, data: base64Data } = imagePart.inlineData;
      console.log(`[IMAGE-GEN] Received image: ${mimeType}, ${base64Data.length} base64 chars`);

      // Convert base64 to Uint8Array
      const binaryString = atob(base64Data);
      const imageBuffer = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        imageBuffer[i] = binaryString.charCodeAt(i);
      }

      // Upload to Vultr storage
      const uploadResult = await this.env.VULTR_STORAGE_CLIENT.uploadImage(
        briefId,
        imageBuffer,
        mimeType,
        { headline: headline.substring(0, 100) }
      );

      console.log(`[IMAGE-GEN] Image uploaded: ${uploadResult.url}`);
      return uploadResult.url;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[IMAGE-GEN] Failed to generate image: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Fetch og:image from a news article URL
   * Extracts Open Graph image meta tag from HTML
   * @param url - URL to fetch og:image from
   * @returns Image URL or null if not found
   */
  private async fetchOgImage(url: string): Promise<string | null> {
    try {
      // Fetch the HTML with a short timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HakivoBot/1.0; +https://hakivo.com)',
          'Accept': 'text/html'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      // Get just the head section to avoid downloading full page
      const html = await response.text();
      const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
      const headContent: string = headMatch?.[1] ?? html.substring(0, 10000);

      // Look for og:image meta tag
      const ogImageMatch = headContent.match(
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
      ) ?? headContent.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
      );

      if (ogImageMatch && ogImageMatch[1]) {
        const imageUrl = ogImageMatch[1];
        // Validate it looks like a real image URL
        if (imageUrl.startsWith('http') && (
          imageUrl.includes('.jpg') ||
          imageUrl.includes('.jpeg') ||
          imageUrl.includes('.png') ||
          imageUrl.includes('.webp') ||
          imageUrl.includes('image') ||
          imageUrl.includes('/img/')
        )) {
          console.log(`[OG-IMAGE] Found og:image: ${imageUrl.substring(0, 100)}...`);
          return imageUrl;
        }
      }

      // Fallback: try twitter:image
      const twitterImageMatch = headContent.match(
        /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i
      ) ?? headContent.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i
      );

      if (twitterImageMatch && twitterImageMatch[1]) {
        const imageUrl = twitterImageMatch[1];
        if (imageUrl.startsWith('http')) {
          console.log(`[OG-IMAGE] Found twitter:image: ${imageUrl.substring(0, 100)}...`);
          return imageUrl;
        }
      }

      return null;
    } catch (error) {
      // Silently fail - this is a non-critical fallback
      return null;
    }
  }

  /**
   * Search Pexels for a stock photo matching policy interests
   * Uses civic/political search terms based on policy areas
   * @param policyInterests - Array of policy interest categories
   * @returns Image URL or null if not found
   */
  private async searchPexelsImage(policyInterests: string[]): Promise<string | null> {
    try {
      // Access PEXELS_API_KEY from env - will be added after raindrop build validate
      const pexelsApiKey = (this.env as any).PEXELS_API_KEY as string | undefined;
      if (!pexelsApiKey) {
        console.warn('[PEXELS] PEXELS_API_KEY not set, skipping Pexels search');
        return null;
      }

      // Map policy interests to Pexels-friendly search terms
      // IMPORTANT: Keys must match exactly with user-interests.ts interest names
      const searchTermMap: Record<string, string[]> = {
        'Environment & Energy': ['nature', 'solar panels', 'wind turbines', 'clean energy'],
        'Health & Social Welfare': ['healthcare', 'hospital', 'medical', 'family'],
        'Economy & Finance': ['finance', 'stock market', 'money', 'banking'],
        'Education & Science': ['classroom', 'university', 'science lab', 'research'],
        'Civil Rights & Law': ['protest', 'voting', 'civil rights', 'justice'],
        'Commerce & Labor': ['business meeting', 'office', 'workers', 'factory'],
        'Government & Politics': ['capitol building', 'congress', 'government', 'voting'],
        'Foreign Policy & Defense': ['military', 'diplomacy', 'world map', 'american flag'],
        'Housing & Urban Development': ['housing', 'city', 'urban', 'construction'],
        'Agriculture & Food': ['farming', 'agriculture', 'food', 'rural'],
        'Sports, Arts & Culture': ['sports', 'art', 'culture', 'museum'],
        'Immigration & Indigenous Issues': ['immigration', 'border', 'diversity', 'heritage']
      };

      // Get search terms from first interest, with fallback to civic imagery
      const interest = policyInterests[0] || 'Government & Politics';
      const terms = searchTermMap[interest] || ['capitol building', 'congress'];
      const searchQuery = terms[Math.floor(Math.random() * terms.length)] || 'capitol building';

      console.log(`[PEXELS] Searching for: "${searchQuery}"`);

      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=5&orientation=landscape`,
        {
          headers: {
            'Authorization': pexelsApiKey
          }
        }
      );

      if (!response.ok) {
        console.error(`[PEXELS] API error: ${response.status}`);
        return null;
      }

      const data = await response.json() as { photos?: Array<{ src: { large: string } }> };

      if (!data.photos || data.photos.length === 0) {
        console.warn('[PEXELS] No photos found');
        return null;
      }

      // Pick a random photo from results for variety
      const randomIndex = Math.floor(Math.random() * data.photos.length);
      const photo = data.photos[randomIndex];
      if (!photo) {
        console.warn('[PEXELS] No photo at selected index');
        return null;
      }
      const imageUrl = photo.src.large;

      console.log(`[PEXELS] Found image: ${imageUrl.substring(0, 80)}...`);
      return imageUrl;

    } catch (error) {
      console.error('[PEXELS] Search failed:', error);
      return null;
    }
  }

  /**
   * Get user preferences including policy interests
   */
  private async getUserPreferences(userId: string): Promise<any> {
    const db = this.env.APP_DB;
    return await db
      .prepare('SELECT * FROM user_preferences WHERE user_id = ?')
      .bind(userId)
      .first();
  }

  /**
   * Get user profile (name, email, etc.)
   */
  private async getUserProfile(userId: string): Promise<any> {
    const db = this.env.APP_DB;
    return await db
      .prepare('SELECT id, email, first_name, last_name FROM users WHERE id = ?')
      .bind(userId)
      .first();
  }

  /**
   * Get bills sponsored by user's representatives (House rep + Senators)
   * This provides the most personalized content - what YOUR reps are doing
   */
  private async getRepresentativeBills(
    state: string,
    district: number | null,
    excludeBillIds: string[] = []
  ): Promise<any[]> {
    const db = this.env.APP_DB;

    // Build exclusion clause
    const excludeClause = excludeBillIds.length > 0
      ? `AND b.id NOT IN (${excludeBillIds.map(() => '?').join(', ')})`
      : '';

    // Get bills from House rep (state + district match)
    let houseBills: any[] = [];
    if (district) {
      const houseResult = await db
        .prepare(`
          SELECT
            b.id, b.congress, b.bill_type, b.bill_number, b.title,
            b.policy_area, b.latest_action_date, b.latest_action_text,
            b.sponsor_bioguide_id,
            m.first_name, m.last_name, m.party, m.state, m.district,
            'house_rep' as relationship
          FROM bills b
          JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
          WHERE m.state = ? AND m.district = ?
          ${excludeClause}
          ORDER BY b.latest_action_date DESC
          LIMIT 3
        `)
        .bind(state, district, ...excludeBillIds)
        .all();
      houseBills = houseResult.results || [];
    }

    // Get bills from Senators (state match, no district)
    const senateResult = await db
      .prepare(`
        SELECT
          b.id, b.congress, b.bill_type, b.bill_number, b.title,
          b.policy_area, b.latest_action_date, b.latest_action_text,
          b.sponsor_bioguide_id,
          m.first_name, m.last_name, m.party, m.state, m.district,
          'senator' as relationship
        FROM bills b
        JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
        WHERE m.state = ? AND (m.district IS NULL OR m.district = 0)
        ${excludeClause}
        ORDER BY b.latest_action_date DESC
        LIMIT 3
      `)
      .bind(state, ...excludeBillIds)
      .all();
    const senateBills = senateResult.results || [];

    // Combine and dedupe
    const allRepBills = [...houseBills, ...senateBills];
    const seen = new Set<string>();
    const uniqueRepBills = allRepBills.filter(b => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });

    console.log(`✓ Found ${uniqueRepBills.length} bills from user's representatives (${houseBills.length} House, ${senateBills.length} Senate)`);
    return uniqueRepBills;
  }

  /**
   * Get bill IDs that were featured in user's recent briefs (for deduplication)
   * This ensures each day's brief has fresh content by excluding bills
   * that were already featured within the lookback window.
   *
   * Default is 30 days to prevent the same bill appearing multiple times in a month.
   */
  private async getRecentlyFeaturedBills(userId: string, daysBack: number = 30): Promise<string[]> {
    const db = this.env.APP_DB;
    const cutoffTime = Date.now() - (daysBack * 24 * 60 * 60 * 1000);

    const result = await db
      .prepare(`
        SELECT DISTINCT bb.bill_id
        FROM brief_bills bb
        JOIN briefs b ON bb.brief_id = b.id
        WHERE b.user_id = ?
          AND b.created_at > ?
          AND b.status = 'completed'
      `)
      .bind(userId, cutoffTime)
      .all();

    return (result.results || []).map((r: any) => r.bill_id);
  }

  /**
   * DEPRECATED: Federal bills save moved to audio-processor-background.mts
   * This function is kept for reference but not currently called.
   * The workaround extracts bills from article content after generation.
   */
  private async saveFeaturedBills(briefId: string, billIds: string[]): Promise<void> {
    if (billIds.length === 0) return;

    const db = this.env.APP_DB;

    // Insert each bill featured in this brief
    for (const billId of billIds) {
      try {
        await db
          .prepare('INSERT INTO brief_bills (brief_id, bill_id, section_type) VALUES (?, ?, ?)')
          .bind(briefId, billId, 'featured')
          .run();
      } catch (insertError) {
        // Ignore duplicate key errors
        console.warn(`[SAVE-BILLS] Could not save bill ${billId}: ${insertError}`);
      }
    }

    console.log(`✓ Saved ${billIds.length} featured bills for deduplication`);
  }

  /**
   * Save which state bills were featured in this brief
   */
  /**
   * DEPRECATED: State bills save moved to audio-processor-background.mts
   * This function is kept for reference but not currently called.
   * The workaround extracts bills from article content after generation.
   */
  private async saveFeaturedStateBills(briefId: string, stateBillIds: string[]): Promise<void> {
    if (stateBillIds.length === 0) return;

    const db = this.env.APP_DB;

    // Insert each state bill featured in this brief
    for (const stateBillId of stateBillIds) {
      try {
        await db
          .prepare('INSERT INTO brief_state_bills (brief_id, state_bill_id) VALUES (?, ?)')
          .bind(briefId, stateBillId)
          .run();
      } catch (insertError) {
        // Ignore duplicate key errors
        console.warn(`[SAVE-STATE-BILLS] Could not save state bill ${stateBillId}: ${insertError}`);
      }
    }

    console.log(`✓ Saved ${stateBillIds.length} featured state bills`);
  }

  /**
   * Get bills matching user's policy interests with user-specific variation
   * Prioritizes interest matching over date - finds most recent bills that match interests
   * Maps user-friendly interest names to Congress.gov policy_area values
   * Excludes bills that were recently featured to ensure fresh content daily
   * Uses userId for seeded variation so different users see different bill mixes
   */
  private async getBillsByInterests(
    interests: string[],
    _startDate: string,
    _endDate: string,
    excludeBillIds: string[] = [],
    userId?: string
  ): Promise<any[]> {
    const db = this.env.APP_DB;

    // Use centralized interest mapping from user-interests.ts
    const policyAreas = getPolicyAreasForInterests(interests);
    const keywords = getKeywordsForInterests(interests);

    console.log(`✓ Mapped ${interests.length} interests to ${policyAreas.length} policy areas and ${keywords.length} keywords`);

    const allBills: any[] = [];

    // Strategy 1: Search by policy_area (ignore date - get most recent matching bills)
    if (policyAreas.length > 0) {
      const placeholders = policyAreas.map(() => '?').join(', ');
      const result = await db
        .prepare(`
          SELECT
            b.id, b.congress, b.bill_type, b.bill_number, b.title,
            b.policy_area, b.latest_action_date, b.latest_action_text,
            b.sponsor_bioguide_id,
            m.first_name, m.last_name, m.party, m.state
          FROM bills b
          LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
          WHERE b.policy_area IN (${placeholders})
          ORDER BY b.latest_action_date DESC
          LIMIT 10
        `)
        .bind(...policyAreas)
        .all();

      if (result.results && result.results.length > 0) {
        console.log(`✓ Found ${result.results.length} bills by policy_area`);
        allBills.push(...result.results);
      }
    }

    // Strategy 2: Search by title keywords (for Congress 119 bills without policy_area)
    if (keywords.length > 0) {
      const keywordConditions = keywords.map(() => `LOWER(b.title) LIKE ?`).join(' OR ');
      const keywordParams = keywords.map(k => `%${k.toLowerCase()}%`);

      const result = await db
        .prepare(`
          SELECT
            b.id, b.congress, b.bill_type, b.bill_number, b.title,
            b.policy_area, b.latest_action_date, b.latest_action_text,
            b.sponsor_bioguide_id,
            m.first_name, m.last_name, m.party, m.state
          FROM bills b
          LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
          WHERE (${keywordConditions})
          ORDER BY b.latest_action_date DESC
          LIMIT 10
        `)
        .bind(...keywordParams)
        .all();

      if (result.results && result.results.length > 0) {
        console.log(`✓ Found ${result.results.length} bills by keyword search`);
        // Add only bills not already in the list (dedupe by id)
        const existingIds = new Set(allBills.map(b => b.id));
        for (const bill of result.results) {
          if (!existingIds.has(bill.id)) {
            allBills.push(bill);
          }
        }
      }
    }

    // Filter out recently featured bills to avoid duplication
    const excludeSet = new Set(excludeBillIds);
    const freshBills = allBills.filter(b => !excludeSet.has(b.id));

    if (excludeBillIds.length > 0) {
      console.log(`✓ Excluded ${allBills.length - freshBills.length} recently featured bills`);
    }

    // Sort all found bills by latest_action_date first
    freshBills.sort((a, b) => {
      const dateA = a.latest_action_date || '';
      const dateB = b.latest_action_date || '';
      return dateB.localeCompare(dateA);
    });

    // INTEREST-BALANCED SELECTION: Ensure we cover 2-3 different user interests
    // Group bills by which interest they match
    const billsByInterest = new Map<string, any[]>();
    const interestToPolicyArea = new Map<string, string[]>();

    // Map each interest to its policy areas for matching
    for (const interest of interests) {
      const areas = getPolicyAreasForInterests([interest]);
      interestToPolicyArea.set(interest, areas);
      billsByInterest.set(interest, []);
    }

    // Categorize each bill by matching interest
    for (const bill of freshBills) {
      for (const [interest, areas] of interestToPolicyArea) {
        if (areas.includes(bill.policy_area)) {
          billsByInterest.get(interest)?.push(bill);
          break; // Each bill counted once
        }
      }
    }

    // Select 1-2 bills from each of 2-3 different interests
    const balancedBills: any[] = [];
    const coveredInterests: string[] = [];
    const TARGET_INTERESTS = 3; // Cover up to 3 different interests
    const BILLS_PER_INTEREST = 2; // 1-2 bills per interest

    // Sort interests by number of available bills (prioritize interests with content)
    const interestsWithBills = [...billsByInterest.entries()]
      .filter(([_, bills]) => bills.length > 0)
      .sort((a, b) => b[1].length - a[1].length);

    for (const [interest, bills] of interestsWithBills) {
      if (coveredInterests.length >= TARGET_INTERESTS) break;
      if (balancedBills.length >= 5) break;

      // Add 1-2 bills from this interest
      const billsToAdd = bills
        .filter(b => !balancedBills.some(existing => existing.id === b.id))
        .slice(0, BILLS_PER_INTEREST);

      if (billsToAdd.length > 0) {
        balancedBills.push(...billsToAdd);
        coveredInterests.push(interest);
      }
    }

    // If we still have room and need more bills, fill from remaining
    if (balancedBills.length < 4) {
      for (const bill of freshBills) {
        if (!balancedBills.some(b => b.id === bill.id)) {
          balancedBills.push(bill);
          if (balancedBills.length >= 5) break;
        }
      }
    }

    console.log(`✓ Interest-balanced selection: ${balancedBills.length} bills covering ${coveredInterests.length} interests: ${coveredInterests.join(', ')}`);
    return balancedBills.slice(0, 5);
  }

  /**
   * Get state bills matching user's interests from state_bills table
   * These bills are synced daily by state-sync-scheduler for active user states
   */
  private async getStateBills(
    state: string,
    interests: string[],
    excludeBillIds: string[] = []
  ): Promise<any[]> {
    const db = this.env.APP_DB;

    // Map user interests to state bill subjects (OpenStates uses different categories)
    const subjectMap: Record<string, string[]> = {
      'Commerce & Labor': ['Commerce', 'Labor', 'Business', 'Trade', 'Employment'],
      'Education & Science': ['Education', 'Science', 'Technology', 'Schools', 'Universities'],
      'Economy & Finance': ['Finance', 'Taxation', 'Budget', 'Banking', 'Economic Development'],
      'Environment & Energy': ['Environment', 'Energy', 'Natural Resources', 'Climate', 'Conservation'],
      'Health & Social Welfare': ['Health', 'Human Services', 'Public Health', 'Social Services', 'Welfare'],
      'Defense & Security': ['Public Safety', 'Law Enforcement', 'Emergency Management', 'Crime'],
      'Immigration': ['Immigration'],
      'Foreign Affairs': ['International Relations'],
      'Government': ['Government', 'State Agencies', 'Elections', 'Legislation'],
      'Civil Rights': ['Civil Rights', 'Human Rights', 'Voting', 'Discrimination']
    };

    // Build subject keywords to match
    const subjects: string[] = [];
    for (const interest of interests) {
      const mapped = subjectMap[interest];
      if (mapped) {
        subjects.push(...mapped);
      }
    }

    try {
      console.log(`[GET-STATE-BILLS] Searching for ${state} bills with ${subjects.length} subject keywords`);
      console.log(`[GET-STATE-BILLS] Subjects: ${subjects.slice(0, 5).join(', ')}`);
      console.log(`[GET-STATE-BILLS] Excluding ${excludeBillIds.length} recently featured bills`);

      // Build exclusion clause
      const excludeClause = excludeBillIds.length > 0
        ? `AND id NOT IN (${excludeBillIds.map(() => '?').join(', ')})`
        : '';

      // Try to match by subjects (stored as JSON array in state_bills)
      // Fall back to title keyword matching if needed
      if (subjects.length > 0) {
        const subjectConditions = subjects.map(() =>
          `LOWER(subjects) LIKE ? OR LOWER(title) LIKE ?`
        ).join(' OR ');
        const subjectParams = subjects.flatMap(s => [`%${s.toLowerCase()}%`, `%${s.toLowerCase()}%`]);

        console.log(`[GET-STATE-BILLS] Running subject/title match query for ${state.toUpperCase()}`);
        const result = await db
          .prepare(`
            SELECT
              id, state, session_identifier, identifier, title,
              subjects, chamber, latest_action_date, latest_action_description,
              full_text, full_text_url, full_text_format, abstract
            FROM state_bills
            WHERE state = ?
              AND (${subjectConditions})
              ${excludeClause}
            ORDER BY latest_action_date DESC
            LIMIT 5
          `)
          .bind(state.toUpperCase(), ...subjectParams, ...excludeBillIds)
          .all();

        console.log(`[GET-STATE-BILLS] Subject match query returned ${result.results?.length || 0} bills`);
        if (result.results && result.results.length > 0) {
          console.log(`✓ Found ${result.results.length} state bills matching interests for ${state}`);
          return result.results as any[];
        }
      }

      // Fallback: Get recent state bills regardless of subject match
      console.log(`[STATE-BILLS] No subject matches, getting recent bills for ${state}`);
      const fallbackResult = await db
        .prepare(`
          SELECT
            id, state, session_identifier, identifier, title,
            subjects, chamber, latest_action_date, latest_action_description,
            full_text, full_text_url, full_text_format, abstract
          FROM state_bills
          WHERE state = ?
            ${excludeClause}
          ORDER BY latest_action_date DESC
          LIMIT 3
        `)
        .bind(state.toUpperCase(), ...excludeBillIds)
        .all();

      return (fallbackResult.results || []) as any[];

    } catch (error) {
      console.error(`[STATE-BILLS] Failed to fetch state bills for ${state}:`, error);
      return [];
    }
  }

  /**
   * Get Federal Register documents (executive orders, rules, proposed rules, notices)
   * matching user policy interests from the last 14 days
   */
  private async getFederalRegisterDocuments(
    interests: string[]
  ): Promise<FederalRegisterBriefDoc[]> {
    const db = this.env.APP_DB;

    // Map user policy interests to Federal Register topics and agency keywords
    const topicMap: Record<string, string[]> = {
      'Commerce & Labor': ['commerce', 'trade', 'labor', 'employment', 'workforce', 'business'],
      'Education & Science': ['education', 'science', 'research', 'technology', 'stem'],
      'Economy & Finance': ['finance', 'banking', 'securities', 'treasury', 'economic'],
      'Environment & Energy': ['environmental', 'energy', 'climate', 'epa', 'conservation'],
      'Health & Social Welfare': ['health', 'medicare', 'medicaid', 'fda', 'cdc', 'welfare'],
      'Defense & Security': ['defense', 'homeland', 'security', 'military', 'veteran'],
      'Immigration': ['immigration', 'uscis', 'border', 'visa', 'asylum'],
      'Foreign Affairs': ['foreign', 'state department', 'international', 'treaty'],
      'Government': ['federal', 'agency', 'regulation', 'procurement'],
      'Civil Rights': ['civil rights', 'discrimination', 'voting', 'eeoc']
    };

    // Build search keywords from interests
    const keywords: string[] = [];
    for (const interest of interests) {
      const mapped = topicMap[interest];
      if (mapped) {
        keywords.push(...mapped);
      }
    }

    try {
      console.log(`[GET-FEDERAL-REGISTER] Searching for docs with ${keywords.length} keywords`);
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Build keyword conditions for title, abstract, topics, and agency_names
      let whereConditions = [`publication_date >= ?`];
      const params: (string | number)[] = [fourteenDaysAgo || ''];

      if (keywords.length > 0) {
        const keywordConditions = keywords.slice(0, 10).map(() =>
          `(LOWER(title) LIKE ? OR LOWER(abstract) LIKE ? OR LOWER(topics) LIKE ? OR LOWER(agency_names) LIKE ?)`
        ).join(' OR ');
        whereConditions.push(`(${keywordConditions})`);
        for (const kw of keywords.slice(0, 10)) {
          const pattern = `%${kw.toLowerCase()}%`;
          params.push(pattern, pattern, pattern, pattern);
        }
      }

      // Prioritize: Executive orders first, then significant rules, then proposed rules with open comments
      const result = await db
        .prepare(`
          SELECT
            id, document_number, type, subtype, title, abstract, action,
            dates, effective_on, publication_date, agencies, agency_names,
            topics, significant, html_url, pdf_url, comments_close_on, comment_url
          FROM federal_documents
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY
            CASE type
              WHEN 'PRESDOCU' THEN 1
              WHEN 'RULE' THEN 2
              WHEN 'PRORULE' THEN 3
              WHEN 'NOTICE' THEN 4
              ELSE 5
            END,
            significant DESC,
            publication_date DESC
          LIMIT 5
        `)
        .bind(...params)
        .all<{
          id: string;
          document_number: string;
          type: string;
          subtype: string | null;
          title: string;
          abstract: string | null;
          action: string | null;
          dates: string | null;
          effective_on: string | null;
          publication_date: string;
          agencies: string;
          agency_names: string;
          topics: string | null;
          significant: number;
          html_url: string;
          pdf_url: string | null;
          comments_close_on: string | null;
          comment_url: string | null;
        }>();

      console.log(`[GET-FEDERAL-REGISTER] Found ${result.results.length} matching documents`);

      // Transform to brief doc format
      return result.results.map(doc => ({
        document_number: doc.document_number,
        type: doc.type as 'RULE' | 'PRORULE' | 'NOTICE' | 'PRESDOCU',
        title: doc.title,
        abstract: doc.abstract,
        action: doc.action,
        effective_on: doc.effective_on,
        publication_date: doc.publication_date,
        agency_names: doc.agency_names,
        topics: doc.topics,
        significant: doc.significant === 1,
        html_url: doc.html_url,
        comments_close_on: doc.comments_close_on,
        comment_url: doc.comment_url
      }));

    } catch (error) {
      console.error(`[GET-FEDERAL-REGISTER] Failed to fetch Federal Register documents:`, error);
      return [];
    }
  }

  /**
   * Get recent actions for bills
   */
  private async getBillActions(bills: any[]): Promise<any[]> {
    if (bills.length === 0) return [];

    const db = this.env.APP_DB;
    const billIds = bills.map(b => b.id);
    const placeholders = billIds.map(() => '?').join(', ');

    const actionsResult = await db
      .prepare(`
        SELECT bill_id, action_date, action_text, action_type
        FROM bill_actions
        WHERE bill_id IN (${placeholders})
        ORDER BY action_date DESC
      `)
      .bind(...billIds)
      .all();

    // Group actions by bill
    const actionsByBill = new Map<string, any[]>();
    for (const action of (actionsResult.results || [])) {
      const billId = action.bill_id as string;
      if (!actionsByBill.has(billId)) {
        actionsByBill.set(billId, []);
      }
      actionsByBill.get(billId)!.push(action);
    }

    // Attach actions to bills
    return bills.map(bill => ({
      ...bill,
      actions: actionsByBill.get(bill.id) || []
    }));
  }

  /**
   * Fetch news articles based on user's policy interests and optionally state
   * Uses Perplexity API with structured JSON output for reliable results
   * Supports localized news when state is provided
   */
  private async fetchNewsByInterests(interests: string[], state: string | null): Promise<any[]> {
    try {
      // Perplexity handles date filtering internally (last 7 days)
      // Pass interests and state for personalized news search
      const searchResults = await this.env.PERPLEXITY_CLIENT.searchNews(
        interests,
        state,
        state ? 5 : 10 // Fewer results for state-specific searches
      );

      // Map Perplexity response to include imageUrl for backward compatibility
      if (searchResults.length > 0) {
        return searchResults.map(article => ({
          title: article.title,
          summary: article.summary,
          url: article.url,
          publishedAt: article.publishedAt,
          source: article.source,
          category: article.category,
          imageUrl: article.image?.url || null,
          imageAlt: article.title || null
        }));
      }
    } catch (error) {
      console.error(`[PERPLEXITY] Failed to fetch news, falling back to pre-synced news:`, error);
    }

    // Fallback: Use pre-synced news from news_articles table
    console.log(`[NEWS-FALLBACK] Using pre-synced news from database for ${interests.join(', ')}`);
    return await this.fetchPreSyncedNews(interests);
  }

  /**
   * Fetch pre-synced news from news_articles table as fallback
   * Uses news that was synced by news-sync-scheduler
   * Only returns articles from the last 7 days
   */
  private async fetchPreSyncedNews(interests: string[]): Promise<any[]> {
    try {
      const db = this.env.APP_DB;

      // Map interests to the 'interest' column values in news_articles
      const placeholders = interests.map(() => '?').join(', ');

      // Get news from last 7 days only
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const result = await db
        .prepare(`
          SELECT id, title, summary, url, author, image_url, published_date, source_domain, interest
          FROM news_articles
          WHERE interest IN (${placeholders})
            AND published_date >= ?
          ORDER BY published_date DESC, score DESC
          LIMIT 15
        `)
        .bind(...interests, sevenDaysAgo)
        .all();

      if (!result.results || result.results.length === 0) {
        console.log(`[NEWS-FALLBACK] No pre-synced news found for interests`);
        return [];
      }

      console.log(`[NEWS-FALLBACK] Found ${result.results.length} pre-synced articles`);
      return result.results.map((article: any) => ({
        title: article.title,
        summary: article.summary,
        url: article.url,
        publishedAt: article.published_date,
        source: article.source_domain,
        category: article.interest,
        imageUrl: article.image_url,
        imageAlt: article.title
      }));
    } catch (error) {
      console.error(`[NEWS-FALLBACK] Failed to fetch pre-synced news:`, error);
      return [];
    }
  }

  /**
   * Generate brief script in "The Daily" style from New York Times
   * Structure: Cold Open → Top Story → Headlines → Spotlight → Hakivo Outro
   * Fully personalized with user's name, location, and representative context
   */
  private async generateScript(
    type: string,
    bills: any[],
    newsJSON: NewsJSON,
    personalization: {
      userName: string;
      state: string | null;
      district: number | null;
      repBillIds: string[];
      policyInterests: string[];
      stateBills: any[];
      federalRegisterDocs: FederalRegisterBriefDoc[];
    }
  ): Promise<{
    script: string;
    headline: string;
  }> {
    // Separate bills: prioritize rep bills as top story for maximum personalization
    const repBillIdSet = new Set(personalization.repBillIds);
    const repBills = bills.filter(b => repBillIdSet.has(b.id));
    const otherBills = bills.filter(b => !repBillIdSet.has(b.id));

    // Top story: prefer rep's bill if available (most personal)
    const topStoryBill = repBills[0] || otherBills[0];
    const isTopStoryFromRep = topStoryBill && repBillIdSet.has(topStoryBill.id);
    const spotlightBills = [...(repBills[0] ? otherBills.slice(0, 2) : otherBills.slice(1, 3))];

    // Format top story bill with full context
    const topStoryText = topStoryBill ? `
BILL: ${String(topStoryBill.bill_type).toUpperCase()} ${topStoryBill.bill_number}
TITLE: ${topStoryBill.title}
POLICY AREA: ${topStoryBill.policy_area || 'General'}
SPONSOR: ${topStoryBill.first_name || 'Unknown'} ${topStoryBill.last_name || ''} (${topStoryBill.party || '?'}-${topStoryBill.state || '?'})
IS USER'S REPRESENTATIVE: ${isTopStoryFromRep ? 'YES - This is from the listener\'s own representative!' : 'No'}
RECENT ACTIONS:
${topStoryBill.actions && topStoryBill.actions.length > 0
  ? topStoryBill.actions.slice(0, 3).map((a: any) => `  • ${a.action_date}: ${a.action_text}`).join('\n')
  : `  • ${topStoryBill.latest_action_date}: ${topStoryBill.latest_action_text}`}
URL: https://www.congress.gov/bill/${topStoryBill.congress}th-congress/${topStoryBill.bill_type.toLowerCase()}/${topStoryBill.bill_number}` : 'No top story available';

    // Format spotlight bills (shorter summaries)
    const spotlightText = spotlightBills.map((bill: any) => `
BILL: ${String(bill.bill_type).toUpperCase()} ${bill.bill_number} - ${bill.title}
SPONSOR: ${bill.first_name || ''} ${bill.last_name || ''} (${bill.party || '?'}-${bill.state || '?'})
LATEST: ${bill.latest_action_text}`).join('\n');

    // Format state legislature bills (if any)
    // Include full text or PDF URL for AI analysis, plus proper links
    const stateBillsText = personalization.stateBills.length > 0
      ? personalization.stateBills.map((bill: any) => {
          const subjects = bill.subjects ? (typeof bill.subjects === 'string' ? JSON.parse(bill.subjects) : bill.subjects) : [];
          const subjectStr = Array.isArray(subjects) && subjects.length > 0 ? subjects.slice(0, 3).join(', ') : 'General';

          // Generate proper state legislature link
          // Use OpenStates URL which redirects to official state legislature
          const stateCode = (bill.state || '').toLowerCase();
          const session = encodeURIComponent(bill.session_identifier || '');
          const identifier = encodeURIComponent(bill.identifier || '');
          const stateBillUrl = `https://openstates.org/${stateCode}/bills/${session}/${identifier}/`;

          // Determine what text content is available
          let textContent = '';
          if (bill.full_text) {
            // Truncate very long text to first 2000 chars for the prompt
            const truncatedText = bill.full_text.length > 2000
              ? bill.full_text.substring(0, 2000) + '... [truncated]'
              : bill.full_text;
            textContent = `\nFULL TEXT EXCERPT:\n${truncatedText}`;
          } else if (bill.abstract) {
            textContent = `\nABSTRACT: ${bill.abstract}`;
          }

          // If only PDF URL is available, note it for AI to potentially fetch
          let pdfNote = '';
          if (!bill.full_text && bill.full_text_url) {
            const isPdf = bill.full_text_format?.includes('pdf') || bill.full_text_url?.includes('.pdf');
            if (isPdf) {
              pdfNote = `\nPDF AVAILABLE: ${bill.full_text_url}`;
            } else {
              pdfNote = `\nTEXT URL: ${bill.full_text_url}`;
            }
          }

          return `
STATE BILL: ${bill.identifier} (${bill.state})
TITLE: ${bill.title}
CHAMBER: ${bill.chamber || 'Unknown'}
SUBJECTS: ${subjectStr}
LATEST ACTION: ${bill.latest_action_date || 'Unknown'} - ${bill.latest_action_description || 'No action recorded'}
URL: ${stateBillUrl}${textContent}${pdfNote}`;
        }).join('\n')
      : '';

    // Format Federal Register documents (executive orders, rules, proposed rules, notices)
    const federalRegisterText = personalization.federalRegisterDocs.length > 0
      ? personalization.federalRegisterDocs.map((doc) => {
          const typeLabel = {
            'PRESDOCU': 'EXECUTIVE ORDER',
            'RULE': 'FINAL RULE',
            'PRORULE': 'PROPOSED RULE',
            'NOTICE': 'NOTICE'
          }[doc.type] || doc.type;

          const commentsInfo = doc.comments_close_on
            ? `\nCOMMENT PERIOD CLOSES: ${doc.comments_close_on}${doc.comment_url ? ` (Submit at: ${doc.comment_url})` : ''}`
            : '';

          return `
${typeLabel}: ${doc.document_number}
TITLE: ${doc.title}
AGENCIES: ${doc.agency_names}
PUBLICATION DATE: ${doc.publication_date}
${doc.effective_on ? `EFFECTIVE DATE: ${doc.effective_on}` : ''}
${doc.abstract ? `SUMMARY: ${doc.abstract}` : ''}
${doc.action ? `ACTION: ${doc.action}` : ''}
${doc.significant ? 'SIGNIFICANT: Yes (economically significant or major policy impact)' : ''}${commentsInfo}
URL: ${doc.html_url}`;
        }).join('\n')
      : '';

    // Get today's date for context
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Host names for a personal touch
    const hostA = 'Arabella';
    const hostB = 'Mark';

    // Format state name for spoken form
    const stateNames: Record<string, string> = {
      'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
      'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
      'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
      'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
      'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
      'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
      'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
      'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
      'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
      'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
    };
    const spokenState = personalization.state ? stateNames[personalization.state] || personalization.state : null;

    // System prompt for the script generation with NPR Morning Edition feel
    const systemPrompt = `You are a scriptwriter for "Hakivo Daily" - a PERSONALIZED civic engagement audio briefing styled after NPR's Morning Edition. Think: warm, informative, human, and conversational.

CRITICAL CONSTRAINT: You have NO access to external information. You can ONLY discuss what is explicitly provided in the bills, legislative actions, and news articles below. If a fact is not in the provided data, DO NOT mention it. Every claim must come from the input data.

Your hosts are ${hostA} (female) and ${hostB} (male). They're like seasoned NPR hosts - warm, curious, knowledgeable. They have genuine chemistry and naturally weave conversation together.

=== LISTENER PROFILE (PERSONALIZE FOR THIS LISTENER) ===
Name: ${personalization.userName}
${spokenState ? `Location: ${spokenState}${personalization.district ? `, Congressional District ${personalization.district}` : ''}` : 'Location: Not specified'}
Policy Interests: ${personalization.policyInterests.join(', ')}

=== NPR MORNING EDITION STYLE ===
1. STORYTELLING FIRST: Don't just report facts - tell stories. "Let me paint a picture of what's happening..."
2. HUMAN IMPACT: Always connect policy to real people. "What this means for families in ${spokenState || 'your community'}..."
3. WARM TRANSITIONS: Smooth handoffs between topics. "Before we go further, ${hostB}, there's something our listeners should know..."
4. CURIOSITY & DEPTH: Hosts ask each other genuine questions. "${hostB}, help us understand - why does this matter right now?"
5. COMING UP TEASERS: Build anticipation. "Coming up, we'll look at what's happening in the ${spokenState || 'state'} legislature..."
6. CONTEXT & HISTORY: Brief background without being boring. "This has been building for months..."
7. MULTIPLE INTERESTS: Cover 2-3 different policy areas matching the listener's interests: ${personalization.policyInterests.slice(0, 3).join(', ')}

=== JOURNALISTIC NEUTRALITY (CRITICAL) ===
Like NPR journalists, hosts must be STRICTLY UNBIASED:
1. PRESENT ALL SIDES: "Supporters say this will... while critics argue..." - always include opposing viewpoints
2. NO PARTISAN LANGUAGE: Never use loaded terms like "radical", "extreme", "common sense". Just report the facts.
3. ATTRIBUTE CLAIMS: "According to the bill's sponsors..." or "Opponents point out..." - don't make claims, quote sources
4. EXPLAIN, DON'T ADVOCATE: Help listeners understand, never push them toward a position
5. EQUAL TREATMENT: Cover Republican and Democratic bills the same way - focus on policy impact, not party
6. CURIOSITY, NOT JUDGMENT: "${hostB}, what are both sides saying about this?" - genuine curiosity about all perspectives
7. FACTUAL FRAMING: "The bill would..." not "The bill aims to fix..." - describe actions, not intentions
8. RESPECT LISTENERS: Trust the audience to form their own opinions when given fair information

PERSONALIZATION RULES:
1. Open warmly with the listener's name: "Good morning, ${personalization.userName}..."
2. ${isTopStoryFromRep && topStoryBill ? `Highlight their representative: "Your representative, ${topStoryBill.first_name} ${topStoryBill.last_name}, is at the center of today's top story..."` : 'Connect stories to their specific interests.'}
3. ${spokenState ? `Make it local: "For listeners in ${spokenState}..." or "Here's what this means for ${spokenState}..."` : ''}
4. This brief is UNIQUE to ${personalization.userName} - make them feel it was created just for them.

IMPORTANT: Write ONLY natural spoken dialogue. NEVER include section labels. Hosts NEVER say "top story", "segment", "section" - they just flow naturally like NPR.

You have WEB SEARCH capability - use it for latest updates, expert quotes, and context.

=== NATURAL SHOW FLOW ===

OPENING HOOK (15-20 seconds):
- Hook immediately with a compelling angle: "${hostA.toUpperCase()}: [warmly] Good morning, ${personalization.userName}. [beat] Millions of Americans could see their health insurance costs change dramatically. And it all comes down to what happens in Congress this week..."
- Create intrigue, not just headlines

SHOW INTRO (15-20 seconds):
- "${hostA.toUpperCase()}: From Hakivo, I'm ${hostA}."
- "${hostB.toUpperCase()}: And I'm ${hostB}. It's ${today}."
- "${hostA.toUpperCase()}: Here's what's happening in the policy world that matters to you."

MAIN STORY (3-4 minutes):
- TELL A STORY, not just facts
- ${isTopStoryFromRep ? 'IMPORTANT: Their representative is involved - make it personal!' : 'Human impact angle - who does this affect and how?'}
- Natural host conversation: "${hostB}, walk us through this..." / "That's a great point, ${hostA}..."
- Include a "coming up" tease before transitioning

RELATED NEWS & CONTEXT (2-3 minutes):
- Smooth transition: "And ${hostB}, this isn't happening in isolation..."
- DISCUSS 3-6 news headlines from the listener's interest areas with their summaries
- Use conversational language: "${hostB}, I saw this morning that [outlet] reported..." then explain the summary
- Cover different policy areas: healthcare, education, immigration, etc. - match their interests
- Quick but substantive updates - give listeners enough detail to understand what's happening${spokenState ? `\n- Local angle: "Closer to home in ${spokenState}..."` : ''}

POLICY SPOTLIGHT (2-3 minutes):
- Transition: "Before we move on, there's another story that caught our attention..."
- Cover 1-2 additional bills from DIFFERENT interest areas than the main story
- Keep conversational: "${hostA}, this connects to something our listeners really care about..."
- Explain the stakes in human terms

${stateBillsText ? `STATE LEGISLATURE (1-2 minutes):
- NPR-style transition: "Now let's turn to what's happening closer to home in the ${spokenState} state capitol..."
- Cover 1-2 state bills with proper bill identifiers (e.g., "Senate Bill 123")
- Tell the local story: "This bill would change how ${spokenState} handles..."
- Connect to listener's interests
- "You can find more details on this at OpenStates - we'll link it in your brief."

` : ''}${federalRegisterText ? `EXECUTIVE BRANCH & FEDERAL REGISTER (1-2 minutes):
- Transition: "Now ${hostB}, let's check in on what the executive branch has been up to..."
- Cover executive orders, rules, or proposed regulations matching listener interests
- For EXECUTIVE ORDERS: Explain what the President is directing and who it affects
- For RULES: Explain how agencies are changing regulations and the impact on people/businesses
- For PROPOSED RULES: Highlight comment periods - "Listeners, if you have opinions on this, the public comment period closes on..."
- Connect to listener's interests: "This directly relates to ${personalization.policyInterests[0] || 'policy areas'} you care about..."
- Keep it accessible: "In plain terms, this means..."

` : ''}CLOSING (30-40 seconds):
- Warm wrap-up: "That's today's Hakivo Daily."
- Personal call to action: "${personalization.userName}, want to track these bills and see how they develop? Open Hakivo to follow them."
- NPR-style sign-off: "I'm ${hostA}." "And I'm ${hostB}." "We'll see you tomorrow. Stay curious, stay engaged."

=== CONVERSATIONAL AUTHENTICITY (SOUND LIKE REAL NPR) ===

TONE: Serious and authoritative but highly conversational. Like two intelligent colleagues discussing news over coffee - NOT a stiff formal reading.

HOST ROLES:
- ${hostA} (primary): Acts as the AUDIENCE'S PROXY. Summarizes complex ideas for clarity: "I guess we should remember the basic principle here is..." Slightly skeptical, probes for the "so what?" factor.
- ${hostB} (expert): The SUBJECT MATTER EXPERT. Uses phrases showing deep knowledge: "It was an interim ruling," "The report is nearly two months late." Provides context and analysis.

NATURAL SPEECH PATTERNS:
- Start answers with: "Right," "Well," "So," "Yeah," - makes it sound unscripted
- Filler words for naturalism: "Um, okay," "Yeah," "Right" - avoid sounding robotic
- Clarifications: "Just to be clear...", "I should say...", "It's worth noting..."

TRANSITION WORDS (use these!):
- "Now, it was already well established..."
- "But these documents do highlight..."
- "And I will note..."
- "I think the key thing here is..."
- "What's interesting about this is..."

NEWS PEG INTRO: Always start with a one-sentence summary of the news event before diving in.

NUANCE OVER HYPE:
- AVOID sensationalism. Never say "This is shocking" or "groundbreaking"
- INSTEAD: "It's pretty disturbing," "People have questions," "This is significant"
- Be measured: "This could have implications..." not "This will change everything!"

ACCURACY & CONTEXT:
- Heavy emphasis on accuracy: "I should say it's pretty disturbing," "Just to be clear..."
- Acknowledge limitations: "It's an interim ruling... not precedent-setting"
- When uncertain: "What we know so far is..." not definitive claims

=== CRITICAL FORMATTING RULES ===
- Every line: "${hostA.toUpperCase()}:" or "${hostB.toUpperCase()}:" followed by dialogue
- Emotional/tonal cues in brackets: [thoughtfully], [with concern], [curiously], [with a slight laugh], [nodding]
- NEVER section labels - only natural spoken dialogue
- Natural interruptions and reactions: "Right." "Mm-hmm." "Interesting."
- Plain language - explain jargon naturally when needed
- Pace varies - moments of urgency, moments of reflection

TARGET: ${type === 'daily' ? '6-8 minutes' : '10-12 minutes'} (${type === 'daily' ? '1200-1600' : '2000-2400'} words)`;

    // Extract all news from newsJSON structure
    const allNews = [
      ...newsJSON.categories.federal_legislation,
      ...newsJSON.categories.state_legislation,
      ...Object.values(newsJSON.categories.policy_news).flat()
    ];

    // Format news by category for script WITH full summaries and URLs
    const newsSection = [
      ...(newsJSON.categories.federal_legislation.length > 0 ? [`FEDERAL LEGISLATION NEWS:\n${newsJSON.categories.federal_legislation.slice(0, 2).map(n => `• HEADLINE: ${n.headline}\n  SOURCE: ${n.source}\n  SUMMARY: ${n.summary}\n  URL: ${n.url}`).join('\n\n')}`] : []),
      ...(newsJSON.categories.state_legislation.length > 0 ? [`STATE LEGISLATION NEWS (${spokenState || 'your area'}):\n${newsJSON.categories.state_legislation.slice(0, 2).map(n => `• HEADLINE: ${n.headline}\n  SOURCE: ${n.source}\n  SUMMARY: ${n.summary}\n  URL: ${n.url}`).join('\n\n')}`] : []),
      ...(Object.keys(newsJSON.categories.policy_news).length > 0 ? [`POLICY NEWS (by interest area):\n${Object.entries(newsJSON.categories.policy_news).flatMap(([interest, items]) => items.slice(0, 2).map(n => `• INTEREST: ${interest}\n  HEADLINE: ${n.headline}\n  SOURCE: ${n.source}\n  SUMMARY: ${n.summary}\n  URL: ${n.url}`)).slice(0, 6).join('\n\n')}`] : [])
    ].join('\n\n');

    // User prompt with personalized content
    const userPrompt = `Generate a PERSONALIZED Hakivo Daily script for ${personalization.userName} on ${today}.

=== LISTENER PROFILE ===
Name: ${personalization.userName}
${spokenState ? `Location: ${spokenState}${personalization.district ? ` (District ${personalization.district})` : ''}` : ''}
Interests: ${personalization.policyInterests.join(', ')}

First, use web search to find the latest updates and context on the top story bill. This will help make the script more current and informative.

=== TODAY'S TOP STORY ===
${topStoryText}

=== LEGISLATION SPOTLIGHT ===
${spotlightText || 'No additional bills for spotlight'}

${stateBillsText ? `=== STATE LEGISLATURE (${spokenState || personalization.state}) ===
${stateBillsText}
` : ''}${federalRegisterText ? `=== FEDERAL REGISTER (Executive Orders, Rules, Regulations) ===
${federalRegisterText}
` : ''}=== NEWS COVERAGE ===
${newsSection || 'No recent news headlines'}

=== PERSONALIZATION REQUIREMENTS ===
1. START by greeting ${personalization.userName} by name warmly
2. ${isTopStoryFromRep ? `The TOP STORY is from ${personalization.userName}'s OWN representative - emphasize this personal connection!` : 'Make the top story feel relevant to their interests'}
3. ${newsJSON.categories.state_legislation.length > 0 ? `Include the STATE LEGISLATION news from ${spokenState} - make it feel personal and relevant` : 'Focus on federal legislation and policy news relevant to their interests'}
4. ${stateBillsText ? `Include the STATE LEGISLATURE section - transition with "Now let's check in on what's happening in the ${spokenState || 'state'} legislature..." and cover 1-2 state bills` : 'No state bills this time'}
5. ${federalRegisterText ? `Include the FEDERAL REGISTER section - cover executive orders, rules, or proposed regulations. Highlight any open comment periods.` : 'No Federal Register documents this time'}
6. Follow the show structure: Personalized Opening → Intro → Top Story → Headlines → Spotlight${stateBillsText ? ' → State Legislature' : ''}${federalRegisterText ? ' → Federal Register' : ''} → Personalized Outro
7. The HAKIVO OUTRO must include ${personalization.userName}'s name in the call to action
8. Every line starts with "${hostA.toUpperCase()}:" or "${hostB.toUpperCase()}:"
9. Include emotional cues in [brackets]
10. Make it conversational and engaging - this brief was made JUST for ${personalization.userName}

Generate a HEADLINE in the style of The New York Times.

NYT-STYLE HEADLINE RULES:
1. TELL A STORY, not just facts - capture the narrative arc and human stakes
2. USE STRONG VERBS - "Clears", "Gambles", "Battles", "Faces" instead of "Passes", "Is", "Has"
3. IMPLY THE "SO WHAT" - why should readers care about this?
4. CREATE TENSION - show the conflict, stakes, or uncertainty
5. MAX 12 WORDS - punchy and powerful
6. PLAIN TEXT ONLY - NO markdown formatting (**bold**, _italic_, etc.) - headlines are displayed as-is

EXAMPLES of what we want:
- Instead of "Senate Passes Immigration Bill" → "A Nation's Immigration Debate Reaches Its Breaking Point"
- Instead of "Healthcare Bill Advances" → "Millions Face Uncertainty as Health Overhaul Moves Forward"
- Instead of "Climate Bill Clears House" → "Congress Bets Big on a Greener Future"
- Instead of "Defense Spending Increases" → "The Pentagon's Price Tag: What It Means for Your Taxes"
- Instead of "Tax Reform Introduced" → "A Tax Overhaul That Could Reshape the American Economy"

Think like a NYT editor: What's the STORY here? What's at STAKE? Who WINS and who LOSES?

Format your response EXACTLY as:
HEADLINE: [Your NYT-style headline here - plain text, no markdown]

SCRIPT:
${hostA.toUpperCase()}: [emotional cue] dialogue...
${hostB.toUpperCase()}: [emotional cue] dialogue...
...`;

    // Use Gemini 3 Flash - Fast, rich writing with emotional depth
    const genAI = new GoogleGenerativeAI(this.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      generationConfig: {
        temperature: 0.75,
        maxOutputTokens: 4096,
      }
    });

    const geminiResult = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt }
    ]);

    const response = geminiResult.response;
    const content = response.text();
    let headline = `${type.charAt(0).toUpperCase() + type.slice(1)} Brief - ${new Date().toLocaleDateString()}`;
    let script = content;

    // Extract headline if present
    const headlineMatch = content.match(/HEADLINE:\s*(.+?)(?:\n|SCRIPT:)/i);
    if (headlineMatch) {
      headline = headlineMatch[1]!.trim();
      // Strip markdown formatting (**, __, *, _) from headline
      headline = headline.replace(/(\*\*|__)(.*?)\1/g, '$2').replace(/(\*|_)(.*?)\1/g, '$2');
    }

    // Extract script if marked
    const scriptMatch = content.match(/SCRIPT:\s*([\s\S]+)/i);
    if (scriptMatch) {
      script = scriptMatch[1]!.trim();
    }

    // Append AI disclosure to the audio script (spoken by hosts at the end)
    const aiDisclosure = `\n\nHOST A: Before we go, a quick note—this brief was generated by artificial intelligence.\n\nHOST B: While we strive for accuracy, please verify any facts before sharing or acting on this information. For the latest updates, visit hakivo.com.`;
    script = script + aiDisclosure;

    console.log(`✓ Generated script with Gemini 3 Flash: ${script.length} characters, headline: "${headline}"`);

    return { script, headline };
  }

  /**
   * Generate extended written article for the brief detail page
   * Format similar to NPR articles with rich content and hyperlinks
   */
  private async generateWrittenArticle(
    type: string,
    bills: any[],
    newsJSON: NewsJSON,
    headline: string,
    stateBills: any[] = [],
    userState: string | null = null,
    verifiedBillsContext: string = ''
  ): Promise<{ article: string; wordCount: number }> {
    // Build bill links for hyperlinks with actions
    const billLinks = bills.map((bill: any) => {
      const recentActions = bill.actions && bill.actions.length > 0
        ? bill.actions.slice(0, 3).map((a: any) => `${a.action_date}: ${a.action_text}`).join('; ')
        : bill.latest_action_text;

      return {
        title: `${String(bill.bill_type).toUpperCase()} ${bill.bill_number}`,
        fullTitle: bill.title,
        policyArea: bill.policy_area || 'General',
        url: `https://www.congress.gov/bill/${bill.congress}th-congress/${bill.bill_type.toLowerCase()}/${bill.bill_number}`,
        recentActions,
        sponsor: `${bill.first_name || 'Unknown'} ${bill.last_name || ''} (${bill.party || '?'}-${bill.state || '?'})`
      };
    });

    // Extract all news from newsJSON structure
    const allNewsItems = [
      ...newsJSON.categories.federal_legislation,
      ...newsJSON.categories.state_legislation,
      ...Object.values(newsJSON.categories.policy_news).flat()
    ];

    const newsLinks = allNewsItems.map((article: any) => ({
      title: article.headline,
      url: article.url,
      summary: article.summary,
      source: article.url ? new URL(article.url).hostname.replace('www.', '') : 'Unknown'
    }));

    const billsContext = billLinks.map(b =>
      `Bill: ${b.title} - "${b.fullTitle}"
Policy Area: ${b.policyArea}
URL: ${b.url}
Recent Actions: ${b.recentActions}
Sponsor: ${b.sponsor}`
    ).join('\n\n');

    const newsContext = newsLinks.map(n =>
      `Article: ${n.title}
URL: ${n.url}
Source: ${n.source}
Summary: ${n.summary}`
    ).join('\n\n');

    // Build state bills context with OpenStates URLs
    const stateBillsContext = stateBills.length > 0 ? stateBills.map((bill: any) => {
      const stateCode = (bill.state || '').toLowerCase();
      const session = encodeURIComponent(bill.session_identifier || '');
      const identifier = encodeURIComponent(bill.identifier || '');
      const openstatesUrl = `https://openstates.org/${stateCode}/bills/${session}/${identifier}/`;
      const subjects = bill.subjects ? (typeof bill.subjects === 'string' ? JSON.parse(bill.subjects) : bill.subjects) : [];
      const subjectStr = Array.isArray(subjects) && subjects.length > 0 ? subjects.slice(0, 3).join(', ') : 'General';

      return `State Bill: ${bill.identifier} (${bill.state})
Title: ${bill.title}
Chamber: ${bill.chamber || 'Unknown'}
Subjects: ${subjectStr}
Latest Action: ${bill.latest_action_date || 'Unknown'} - ${bill.latest_action_description || 'No action recorded'}
URL: ${openstatesUrl}`;
    }).join('\n\n') : '';

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Get state name for personalization
    const stateNames: Record<string, string> = {
      'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
      'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
      'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
      'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
      'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
      'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
      'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
      'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
      'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
      'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
    };
    const stateName = userState ? stateNames[userState] || userState : null;

    // System prompt for article generation
    const systemPrompt = `You are a senior correspondent writing a detailed news article for Hakivo, a civic engagement platform.
Write in the style of NPR or The Atlantic - informative, engaging, and accessible to general audiences.

CRITICAL CONSTRAINT: You have NO access to external information. You can ONLY use facts from the bills, legislative actions, and news articles provided below. If a fact is not in the provided data, DO NOT include it. Every claim must be attributable to the input sources.

CRITICAL: DO NOT include labels like "Lead:", "Nut Graf:", or any structural markers. Write naturally like a published article.

ARTICLE STRUCTURE (follow but don't label):
1. Opening paragraph: A compelling hook that draws readers in immediately
2. Context: Why this matters to everyday Americans
3. Body: 2-3 sections with ## subheadings covering key developments
4. Analysis: What this means going forward
${stateBillsContext ? `5. State Legislature: MANDATORY section covering state legislation${stateName ? ` in ${stateName}` : ''} - you MUST include this\n` : ''}6. Call to action: End by encouraging civic engagement

INTEGRATING NEWS SOURCES (CRITICAL):
- EVERY factual claim, statistic, or quote MUST be cited with an inline link to the source
- Use markdown links for ALL citations: "According to [The Texas Tribune](url), Attorney General Paxton..."
- PERSONAL QUOTES: When quoting individuals, link their quote attribution to the source: "My kid has already lost one parent," [Jiannacopoulos told Wisconsin Public Radio](url), "and I'm going to be around..."
- When mentioning settlements, enforcement actions, or specific events, IMMEDIATELY link to the source
- Format citations naturally: "The [Washington Post reported](url) that..." or "A [$1.4B settlement with Meta](url) marked..."
- Do NOT make claims without linking to the source article
- Reference what major outlets are saying and link to their coverage
- CRITICAL: Use news article URLs EXACTLY as provided - do NOT modify them or insert bill links into URLs
- EVERY paragraph should include at least one linked citation to maintain credibility

${stateBillsContext ? `INTEGRATING STATE LEGISLATION:
- Include a section about state-level legislation${stateName ? ` happening in ${stateName}` : ''}
- Link state bills to their OpenStates URLs using markdown: [bill identifier](openstates url)
- Explain how state legislation connects to or differs from federal action
- Use ## State Legislature or ## What's Happening in ${stateName || 'Your State'} as the section header
` : ''}
FORMATTING REQUIREMENTS:
- Use markdown formatting throughout
- Use ## for meaningful section headers (e.g., "## Border Security Measures", "## What This Means For You")
- Include hyperlinks: [bill name](congress.gov url) and [news headline](news url)
${stateBillsContext ? '- Include hyperlinks for state bills: [state bill identifier](openstates url)\n' : ''}- Bold **key terms** and **bill names** on first mention
- Separate paragraphs with blank lines for readability
- Write 500-700 words for daily, 900-1200 for weekly

TONE:
- Professional yet conversational
- Explain jargon in plain language
- Focus on impact to readers
- Empowering, not preachy

CRITICAL URL RULE (MANDATORY - VIOLATIONS CAUSE BROKEN LINKS):
- ONLY use URLs that appear EXACTLY as provided in the source data above
- For federal bills: ONLY use URLs from KEY FEDERAL LEGISLATION section or VERIFIED BILLS section
- For state bills: ONLY use URLs from STATE LEGISLATION section or VERIFIED BILLS section
- For news: ONLY use URLs from RELATED NEWS COVERAGE section
- NEVER construct, guess, or create URLs yourself - this creates broken links
- NEVER use legiscan.com URLs - they are unreliable
- If a bill is mentioned in news but no URL is provided in the sections above, mention the bill WITHOUT a hyperlink
- Example of WRONG: Making up a URL like "https://legiscan.com/US/bill/SB2392"
- Example of RIGHT: Using exact URL from source data or mentioning "Senate Bill 2392" without a link`;

    // User prompt with context and instructions
    const userPrompt = `Write a polished news article for: "${headline}"
Date: ${today}
Type: ${type} briefing

Use ONLY the information provided below. Do not include any facts or context not present in these sources.

=== KEY FEDERAL LEGISLATION ===
${billsContext}
${stateBillsContext ? `
=== STATE LEGISLATION${stateName ? ` (${stateName})` : ''} ===
${stateBillsContext}
` : ''}
=== RELATED NEWS COVERAGE (integrate these into your article) ===
${newsContext}
${verifiedBillsContext ? `
=== VERIFIED BILLS FROM NEWS (use ONLY these URLs for bills mentioned in news) ===
${verifiedBillsContext}
` : ''}
Write the article naturally without any structural labels. Start directly with an engaging opening paragraph.
Include ## subheadings where they make sense to break up content.

CRITICAL REQUIREMENT - FEDERAL LEGISLATION:
- You MUST integrate the federal bills listed in "KEY FEDERAL LEGISLATION" into your article
- Link each bill to its congress.gov URL using markdown: [bill identifier](congress.gov url)
- Bills should be woven into the narrative where relevant - NOT listed separately
- Explain what each bill does and why it matters to readers
- This is NOT optional - federal legislation MUST appear when bills are provided

${stateBillsContext ? `CRITICAL REQUIREMENT - STATE LEGISLATION:
- You MUST include a dedicated ## State Legislature section covering the state bills provided
- Link each state bill to its OpenStates URL using markdown: [bill identifier](openstates url)
- This section is NOT optional - it must appear in every article when state bills are provided
` : ''}CRITICAL CITATION REQUIREMENT:
- EVERY claim, statistic, settlement amount, or fact MUST include an inline markdown link to the source article
- Do NOT write unsourced claims - if you mention a fact, link to the article where you found it
- Examples: "According to [The Texas Tribune](url)..." or "The [$1.4B Meta settlement](url)..."
- Aim for at least one cited source link per paragraph

FINAL URL REMINDER (READ THIS CAREFULLY):
- If news mentions a bill (e.g., "SB 2392", "H.R. 1234") that is NOT in the sections above, mention it by name WITHOUT a link
- DO NOT make up URLs like "legiscan.com/..." or "congress.gov/bill/..." for bills not in the provided data
- Only use URLs that appear EXACTLY in: KEY FEDERAL LEGISLATION, STATE LEGISLATION, VERIFIED BILLS, or NEWS COVERAGE sections
- Breaking this rule creates 404 errors and broken links for users

End with an empowering note about staying informed.`;

    // Use Gemini 3 Flash - Fast, rich writing with emotional depth
    const genAI = new GoogleGenerativeAI(this.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 3000,
      }
    });

    const geminiResult = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt }
    ]);

    const response = geminiResult.response;
    const article = response.text();
    const wordCount = article.split(/\s+/).length;

    console.log(`✓ Generated written article with Gemini 3 Flash: ${wordCount} words`);

    return { article, wordCount };
  }

  /**
   * Fetch news headlines via Perplexity API
   * Returns structured news JSON with federal/state legislation news + policy news
   */
  private async fetchNewsHeadlines(
    userId: string,
    userState: string | null,
    policyInterests: string[]
  ): Promise<NewsJSON> {
    console.log(`[NEWS] Fetching headlines for interests: ${policyInterests.join(', ')}`);
    const newsItems: (NewsItem & { category: string })[] = [];

    try {
      // 1. Federal legislation news
      console.log('[NEWS] Fetching federal legislation news...');
      const federalNewsResult = await this.env.PERPLEXITY_CLIENT.search({
        query: 'US Congress latest bills federal legislation news 2025',
        maxResults: 3
      });

      if (federalNewsResult?.results) {
        for (const item of federalNewsResult.results) {
          // Extract source from URL
          let source = 'Unknown';
          try {
            source = new URL(item.url).hostname.replace('www.', '');
          } catch {}

          newsItems.push({
            headline: item.headline || 'Untitled',
            summary: item.summary || '',
            url: item.url || '',
            source,
            date: item.publishedAt || new Date().toISOString(),
            category: 'federal_legislation'
          });
        }
      }

      // 2. State legislation news (if user has state)
      if (userState) {
        console.log(`[NEWS] Fetching ${userState} state legislation news...`);
        const stateNewsResult = await this.env.PERPLEXITY_CLIENT.search({
          query: `${userState} state legislature latest bills news 2025`,
          maxResults: 3
        });

        if (stateNewsResult?.results) {
          for (const item of stateNewsResult.results) {
            // Extract source from URL
            let source = 'Unknown';
            try {
              source = new URL(item.url).hostname.replace('www.', '');
            } catch {}

            newsItems.push({
              headline: item.headline || 'Untitled',
              summary: item.summary || '',
              url: item.url || '',
              source,
              date: item.publishedAt || new Date().toISOString(),
              category: 'state_legislation'
            });
          }
        }
      }

      // 3. Policy news by interest (limit to first 3 interests to avoid timeout)
      const limitedInterests = policyInterests.slice(0, 3);
      for (const interest of limitedInterests) {
        console.log(`[NEWS] Fetching ${interest} policy news...`);
        const policyNewsResult = await this.env.PERPLEXITY_CLIENT.search({
          query: `latest ${interest} policy news United States 2025`,
          maxResults: 2
        });

        if (policyNewsResult?.results) {
          for (const item of policyNewsResult.results) {
            // Extract source from URL
            let source = 'Unknown';
            try {
              source = new URL(item.url).hostname.replace('www.', '');
            } catch {}

            newsItems.push({
              headline: item.headline || 'Untitled',
              summary: item.summary || '',
              url: item.url || '',
              source,
              date: item.publishedAt || new Date().toISOString(),
              category: `policy_${interest}`
            });
          }
        }
      }

      console.log(`[NEWS] Fetched ${newsItems.length} total news items`);

      // 4. Deduplicate
      const totalFetched = newsItems.length;
      const deduplicatedNews = await this.deduplicateNews(userId, newsItems);
      console.log(`[NEWS] After deduplication: ${deduplicatedNews.length} items (removed ${totalFetched - deduplicatedNews.length} duplicates)`);

      // 5. Structure as JSON
      return this.structureNewsJSON(userState || 'United States', deduplicatedNews, totalFetched);

    } catch (error) {
      console.error(`[NEWS] Error fetching news: ${error}`);
      // Return empty news JSON on error
      return {
        date_generated: new Date().toISOString(),
        user_state: userState || 'United States',
        categories: {
          federal_legislation: [],
          state_legislation: [],
          policy_news: {}
        },
        total_items: 0,
        deduplication_stats: {
          total_fetched: 0,
          duplicates_removed: 0,
          new_items_included: 0
        }
      };
    }
  }

  /**
   * Deduplicate news against recent briefs (last 7 days)
   */
  private async deduplicateNews(
    userId: string,
    newsItems: (NewsItem & { category: string })[]
  ): Promise<(NewsItem & { category: string })[]> {
    const lookbackDays = 25;
    const cutoffTime = Date.now() - (lookbackDays * 24 * 60 * 60 * 1000);

    try {
      const recentUrls = await this.env.APP_DB.prepare(
        `SELECT news_url FROM news_cache
         WHERE user_id = ? AND included_at > ?`
      ).bind(userId, cutoffTime).all();

      const usedUrls = new Set(recentUrls.results.map((r: any) => r.news_url));
      return newsItems.filter(item => !usedUrls.has(item.url));

    } catch (error) {
      console.error(`[NEWS] Deduplication error: ${error}`);
      // On error, return all news (fail open)
      return newsItems;
    }
  }

  /**
   * Structure news into JSON format for prompts
   */
  private structureNewsJSON(
    userState: string,
    newsItems: (NewsItem & { category: string })[],
    totalFetched: number
  ): NewsJSON {
    const structured: NewsJSON = {
      date_generated: new Date().toISOString(),
      user_state: userState,
      categories: {
        federal_legislation: [],
        state_legislation: [],
        policy_news: {}
      },
      total_items: newsItems.length,
      deduplication_stats: {
        total_fetched: totalFetched,
        duplicates_removed: totalFetched - newsItems.length,
        new_items_included: newsItems.length
      }
    };

    for (const item of newsItems) {
      const { category, ...newsItem } = item;

      if (category === 'federal_legislation') {
        structured.categories.federal_legislation.push(newsItem);
      } else if (category === 'state_legislation') {
        structured.categories.state_legislation.push(newsItem);
      } else if (category.startsWith('policy_')) {
        const topic = category.replace('policy_', '');
        if (!structured.categories.policy_news[topic]) {
          structured.categories.policy_news[topic] = [];
        }
        structured.categories.policy_news[topic].push(newsItem);
      }
    }

    return structured;
  }

  /**
   * Save news URLs to cache after brief generation
   */
  private async saveNewsToCache(
    userId: string,
    briefId: string,
    newsJSON: NewsJSON
  ): Promise<void> {
    const now = Date.now();

    try {
      // Save federal legislation news
      for (const item of newsJSON.categories.federal_legislation) {
        await this.env.APP_DB.prepare(
          `INSERT OR IGNORE INTO news_cache
           (user_id, news_url, headline, category, included_at, brief_id)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(userId, item.url, item.headline, 'federal_legislation', now, briefId).run();
      }

      // Save state legislation news
      for (const item of newsJSON.categories.state_legislation) {
        await this.env.APP_DB.prepare(
          `INSERT OR IGNORE INTO news_cache
           (user_id, news_url, headline, category, included_at, brief_id)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(userId, item.url, item.headline, 'state_legislation', now, briefId).run();
      }

      // Save policy news
      for (const [topic, items] of Object.entries(newsJSON.categories.policy_news)) {
        for (const item of items) {
          await this.env.APP_DB.prepare(
            `INSERT OR IGNORE INTO news_cache
             (user_id, news_url, headline, category, included_at, brief_id)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(userId, item.url, item.headline, `policy_${topic}`, now, briefId).run();
        }
      }

      console.log(`[NEWS] Saved ${newsJSON.total_items} news items to cache`);
    } catch (error) {
      console.error(`[NEWS] Error saving to cache: ${error}`);
      // Don't fail the brief generation if cache save fails
    }
  }

  // ==================== BILL RESOLUTION PIPELINE ====================

  /**
   * Extract bill mentions from news content
   * Identifies federal and state bill references that need URL verification
   */
  private extractBillMentions(newsJSON: NewsJSON, userState: string | null): ExtractedBillMention[] {
    const mentions: ExtractedBillMention[] = [];
    const seen = new Set<string>();

    // Combine all news text for extraction
    const allNewsText: string[] = [];
    for (const item of newsJSON.categories.federal_legislation) {
      allNewsText.push(item.headline, item.summary);
    }
    for (const item of newsJSON.categories.state_legislation) {
      allNewsText.push(item.headline, item.summary);
    }
    for (const items of Object.values(newsJSON.categories.policy_news)) {
      for (const item of items) {
        allNewsText.push(item.headline, item.summary);
      }
    }

    const fullText = allNewsText.join(' ');

    // Federal bill patterns: H.R. 1234, HR1234, S. 567, S567, H.Res. 12, S.Res. 34
    const federalPatterns = [
      /\b(H\.?R\.?)\s*(\d+)\b/gi,          // H.R. 1234, HR1234
      /\b(S\.?)\s*(\d+)\b/gi,               // S. 567, S567
      /\b(H\.?\s*Res\.?)\s*(\d+)\b/gi,      // H.Res. 12
      /\b(S\.?\s*Res\.?)\s*(\d+)\b/gi,      // S.Res. 34
      /\b(H\.?\s*J\.?\s*Res\.?)\s*(\d+)\b/gi, // H.J.Res. 1
      /\b(S\.?\s*J\.?\s*Res\.?)\s*(\d+)\b/gi, // S.J.Res. 1
    ];

    for (const pattern of federalPatterns) {
      let match;
      while ((match = pattern.exec(fullText)) !== null) {
        const typeRaw = match[1]?.replace(/\./g, '').replace(/\s/g, '').toLowerCase() || '';
        const number = parseInt(match[2] || '0', 10);

        // Normalize bill type
        let billType = 'hr';
        if (typeRaw.startsWith('s') && !typeRaw.includes('res')) billType = 's';
        else if (typeRaw.includes('hres')) billType = 'hres';
        else if (typeRaw.includes('sres')) billType = 'sres';
        else if (typeRaw.includes('hjres')) billType = 'hjres';
        else if (typeRaw.includes('sjres')) billType = 'sjres';

        const key = `federal:${billType}:${number}`;
        if (!seen.has(key) && number > 0) {
          seen.add(key);
          mentions.push({
            original: match[0],
            type: 'federal',
            billType,
            billNumber: number,
            congress: 119 // Current congress
          });
        }
      }
    }

    // State bill patterns (only if we know user's state)
    if (userState) {
      const statePatterns = [
        /\b(AB|A\.B\.)\s*(\d+)\b/gi,           // Assembly Bill: AB 123
        /\b(SB|S\.B\.)\s*(\d+)\b/gi,           // Senate Bill: SB 456
        /\b(HB|H\.B\.)\s*(\d+)\b/gi,           // House Bill: HB 789
        /\bAssembly Bill\s*(\d+)\b/gi,         // Full name: Assembly Bill 123
        /\bSenate Bill\s*(\d+)\b/gi,           // Full name: Senate Bill 456
        /\bHouse Bill\s*(\d+)\b/gi,            // Full name: House Bill 789
      ];

      for (const pattern of statePatterns) {
        let match;
        while ((match = pattern.exec(fullText)) !== null) {
          let billType = '';
          let number = 0;

          if (match[1]) {
            // Short form: AB, SB, HB
            const typeRaw = match[1].replace(/\./g, '').toLowerCase();
            billType = typeRaw;
            number = parseInt(match[2] || '0', 10);
          } else {
            // Long form: Assembly Bill, Senate Bill, House Bill
            if (match[0].toLowerCase().includes('assembly')) billType = 'ab';
            else if (match[0].toLowerCase().includes('senate')) billType = 'sb';
            else if (match[0].toLowerCase().includes('house')) billType = 'hb';
            number = parseInt(match[1] || '0', 10);
          }

          const key = `state:${userState}:${billType}:${number}`;
          if (!seen.has(key) && number > 0 && billType) {
            seen.add(key);
            mentions.push({
              original: match[0],
              type: 'state',
              billType,
              billNumber: number,
              state: userState
            });
          }
        }
      }
    }

    console.log(`[BILL-RESOLVE] Extracted ${mentions.length} bill mentions from news content`);
    return mentions;
  }

  /**
   * Resolve federal bill via database first, then Congress.gov API
   * If found in API but not DB, adds to database
   */
  private async resolveFederalBill(mention: ExtractedBillMention): Promise<ResolvedBill> {
    const { billType, billNumber, congress = 119 } = mention;
    const db = this.env.APP_DB;

    console.log(`[BILL-RESOLVE] Resolving federal bill: ${billType.toUpperCase()} ${billNumber}`);

    // Step 1: Check our database first
    try {
      const dbResult = await db
        .prepare(`SELECT id, title, congress FROM bills WHERE bill_type = ? AND bill_number = ? AND congress = ? LIMIT 1`)
        .bind(billType.toUpperCase(), billNumber, congress)
        .first<{ id: string; title: string; congress: number }>();

      if (dbResult) {
        const url = `https://www.congress.gov/bill/${dbResult.congress}th-congress/${billType.toLowerCase()}/${billNumber}`;
        console.log(`[BILL-RESOLVE] ✅ Found in database: ${billType.toUpperCase()} ${billNumber}`);
        return {
          mention,
          found: true,
          url,
          title: dbResult.title,
          inDatabase: true,
          addedToDatabase: false
        };
      }
    } catch (dbError) {
      console.error(`[BILL-RESOLVE] Database lookup error:`, dbError);
    }

    // Step 2: Query Congress.gov API
    try {
      const apiResult = await this.env.CONGRESS_API_CLIENT.getBillDetails(congress, billType, billNumber);

      if (apiResult?.bill) {
        const bill = apiResult.bill;
        const url = `https://www.congress.gov/bill/${congress}th-congress/${billType.toLowerCase()}/${billNumber}`;

        console.log(`[BILL-RESOLVE] ✅ Found via Congress.gov API: ${bill.title?.substring(0, 50)}...`);

        // Step 3: Add to database for future use
        try {
          const now = Date.now();
          await db.prepare(`
            INSERT INTO bills (
              id, bill_type, bill_number, congress, title,
              policy_area, latest_action_text, latest_action_date,
              introduced_date, origin_chamber, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO NOTHING
          `).bind(
            `${billType}${billNumber}-${congress}`,
            billType.toUpperCase(),
            billNumber,
            congress,
            bill.title || `${billType.toUpperCase()} ${billNumber}`,
            bill.policyArea?.name || null,
            bill.latestAction?.text || null,
            bill.latestAction?.actionDate || null,
            bill.introducedDate || null,
            bill.originChamber || null,
            now,
            now
          ).run();

          console.log(`[BILL-RESOLVE] ➕ Added to database: ${billType.toUpperCase()} ${billNumber}`);

          return {
            mention,
            found: true,
            url,
            title: bill.title,
            inDatabase: false,
            addedToDatabase: true
          };
        } catch (insertError) {
          console.error(`[BILL-RESOLVE] Failed to insert bill:`, insertError);
          // Still return the bill even if insert failed
          return {
            mention,
            found: true,
            url,
            title: bill.title,
            inDatabase: false,
            addedToDatabase: false
          };
        }
      }
    } catch (apiError) {
      console.error(`[BILL-RESOLVE] Congress.gov API error:`, apiError);
    }

    // Bill not found
    console.log(`[BILL-RESOLVE] ❌ Bill not found: ${billType.toUpperCase()} ${billNumber}`);
    return {
      mention,
      found: false,
      inDatabase: false,
      addedToDatabase: false
    };
  }

  /**
   * Resolve state bill via database first, then OpenStates API
   * If found in API but not DB, adds to database
   */
  private async resolveStateBill(mention: ExtractedBillMention): Promise<ResolvedBill> {
    const { billType, billNumber, state } = mention;
    if (!state) {
      return { mention, found: false, inDatabase: false, addedToDatabase: false };
    }

    const db = this.env.APP_DB;
    const identifier = `${billType.toUpperCase()} ${billNumber}`;

    console.log(`[BILL-RESOLVE] Resolving state bill: ${state} ${identifier}`);

    // Step 1: Check our database first
    try {
      const dbResult = await db
        .prepare(`SELECT id, title, session_identifier FROM state_bills WHERE state = ? AND identifier = ? LIMIT 1`)
        .bind(state.toUpperCase(), identifier)
        .first<{ id: string; title: string; session_identifier: string }>();

      if (dbResult) {
        const session = encodeURIComponent(dbResult.session_identifier || '');
        const billId = encodeURIComponent(identifier);
        const url = `https://openstates.org/${state.toLowerCase()}/bills/${session}/${billId}/`;

        console.log(`[BILL-RESOLVE] ✅ Found in database: ${state} ${identifier}`);
        return {
          mention,
          found: true,
          url,
          title: dbResult.title,
          inDatabase: true,
          addedToDatabase: false
        };
      }
    } catch (dbError) {
      console.error(`[BILL-RESOLVE] Database lookup error:`, dbError);
    }

    // Step 2: Query OpenStates API
    try {
      // Search for the bill by identifier
      const results = await this.env.OPENSTATES_CLIENT.searchBillsByState(state, identifier, 5);

      // Find exact match
      const match = results.find((b: any) =>
        b.identifier?.toUpperCase() === identifier.toUpperCase()
      );

      if (match) {
        const session = encodeURIComponent(match.sessionIdentifier || match.session || '');
        const billId = encodeURIComponent(match.identifier || identifier);
        const url = `https://openstates.org/${state.toLowerCase()}/bills/${session}/${billId}/`;

        console.log(`[BILL-RESOLVE] ✅ Found via OpenStates API: ${match.title?.substring(0, 50)}...`);

        // Step 3: Add to database for future use
        try {
          const now = Date.now();
          await db.prepare(`
            INSERT INTO state_bills (
              id, state, identifier, title, session_identifier,
              chamber, subjects, latest_action_date, latest_action_description,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO NOTHING
          `).bind(
            match.id || `${state}-${identifier}`,
            state.toUpperCase(),
            match.identifier || identifier,
            match.title || identifier,
            match.sessionIdentifier || match.session || '',
            match.chamber || null,
            JSON.stringify(match.subjects || []),
            match.latestActionDate || null,
            match.latestActionDescription || null,
            now,
            now
          ).run();

          console.log(`[BILL-RESOLVE] ➕ Added to database: ${state} ${identifier}`);

          return {
            mention,
            found: true,
            url,
            title: match.title,
            inDatabase: false,
            addedToDatabase: true
          };
        } catch (insertError) {
          console.error(`[BILL-RESOLVE] Failed to insert state bill:`, insertError);
          return {
            mention,
            found: true,
            url,
            title: match.title,
            inDatabase: false,
            addedToDatabase: false
          };
        }
      }
    } catch (apiError) {
      console.error(`[BILL-RESOLVE] OpenStates API error:`, apiError);
    }

    // Bill not found
    console.log(`[BILL-RESOLVE] ❌ State bill not found: ${state} ${identifier}`);
    return {
      mention,
      found: false,
      inDatabase: false,
      addedToDatabase: false
    };
  }

  /**
   * Resolve all bill mentions from news content
   * Returns list of verified bills with correct URLs
   */
  private async resolveBillMentions(
    mentions: ExtractedBillMention[]
  ): Promise<ResolvedBill[]> {
    const resolved: ResolvedBill[] = [];

    // Process bills with rate limiting (avoid hammering APIs)
    for (const mention of mentions) {
      try {
        if (mention.type === 'federal') {
          const result = await this.resolveFederalBill(mention);
          resolved.push(result);
        } else if (mention.type === 'state') {
          const result = await this.resolveStateBill(mention);
          resolved.push(result);
        }

        // Small delay between API calls
        await new Promise(r => setTimeout(r, 100));
      } catch (error) {
        console.error(`[BILL-RESOLVE] Error resolving ${mention.original}:`, error);
        resolved.push({
          mention,
          found: false,
          inDatabase: false,
          addedToDatabase: false
        });
      }
    }

    const found = resolved.filter(r => r.found).length;
    const added = resolved.filter(r => r.addedToDatabase).length;
    console.log(`[BILL-RESOLVE] Resolved ${found}/${mentions.length} bills (${added} added to DB)`);

    return resolved;
  }

  /**
   * Build verified bills context for article generation
   * Only includes bills with confirmed URLs
   */
  private buildVerifiedBillsContext(resolvedBills: ResolvedBill[]): string {
    const verified = resolvedBills.filter(b => b.found && b.url);

    if (verified.length === 0) {
      return '';
    }

    const lines = verified.map(b => {
      const typeLabel = b.mention.type === 'federal'
        ? `${b.mention.billType.toUpperCase()} ${b.mention.billNumber}`
        : `${b.mention.state} ${b.mention.billType.toUpperCase()} ${b.mention.billNumber}`;

      return `Bill: ${typeLabel}
Title: ${b.title || 'Unknown'}
URL: ${b.url}
Source: ${b.inDatabase ? 'Database' : 'API-verified'}`;
    });

    return `
=== VERIFIED BILL REFERENCES (from news content) ===
These bills were mentioned in news and have been verified with official APIs.
Use these exact URLs when referencing these bills:

${lines.join('\n\n')}
`;
  }

}

// ==================== FEDERAL REGISTER TYPES ====================

interface FederalRegisterBriefDoc {
  document_number: string;
  type: 'RULE' | 'PRORULE' | 'NOTICE' | 'PRESDOCU';
  title: string;
  abstract: string | null;
  action: string | null;
  effective_on: string | null;
  publication_date: string;
  agency_names: string;
  topics: string | null;
  significant: boolean;
  html_url: string;
  comments_close_on: string | null;
  comment_url: string | null;
}

// ==================== NEWS TYPES ====================

interface NewsItem {
  headline: string;
  summary: string;
  url: string;
  source?: string;
  date: string;
  category?: string;
}

interface NewsJSON {
  date_generated: string;
  user_state: string;
  categories: {
    federal_legislation: NewsItem[];
    state_legislation: NewsItem[];
    policy_news: Record<string, NewsItem[]>;
  };
  total_items: number;
  deduplication_stats: {
    total_fetched: number;
    duplicates_removed: number;
    new_items_included: number;
  };
}

/**
 * Extracted bill mention from news content
 */
interface ExtractedBillMention {
  original: string;        // Original text (e.g., "H.R. 1234", "SB 456")
  type: 'federal' | 'state';
  billType: string;        // hr, s, hjres, sjres, ab, sb, hb, etc.
  billNumber: number;
  state?: string;          // For state bills
  congress?: number;       // For federal bills (default to 119)
}

/**
 * Resolved bill with verified URL
 */
interface ResolvedBill {
  mention: ExtractedBillMention;
  found: boolean;
  url?: string;
  title?: string;
  inDatabase: boolean;
  addedToDatabase: boolean;
}

export interface Body {
  briefId: string;
  userId: string;
  type: 'daily' | 'weekly' | 'custom';
  startDate: string;
  endDate: string;
  requestedAt: number;
}
