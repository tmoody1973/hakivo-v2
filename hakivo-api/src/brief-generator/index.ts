import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { getPolicyAreasForInterests, getKeywordsForInterests } from '../config/user-interests';

/**
 * Brief Generator - Multi-Stage Pipeline
 *
 * This observer handles brief generation in stages:
 * - Stage 1-4: Content gathering (user prefs, bills, actions, news)
 * - Stage 5: Script generation (Cerebras AI)
 * - Stage 6: Article generation (Cerebras AI)
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
      try {
        stateBills = await this.getStateBills(userState, policyInterests, recentlyFeaturedBillIds);
        console.log(`[STAGE-2c] Got ${stateBills.length} state bills. Elapsed: ${Date.now() - startTime}ms`);
      } catch (stateError) {
        console.warn(`[STAGE-2c] State bills fetch failed (non-fatal):`, stateError);
        // Continue without state bills - non-fatal
      }
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

    // ==================== STAGE 4: FETCH PERSONALIZED NEWS ====================
    console.log(`[STAGE-4] Fetching personalized news from Perplexity...`);
    let newsArticles: any[] = [];
    try {
      // Fetch both national and state-specific news
      const nationalNews = await this.fetchNewsByInterests(policyInterests, null);
      console.log(`[STAGE-4] Got ${nationalNews.length} national news articles`);

      let stateNews: any[] = [];
      if (userState) {
        stateNews = await this.fetchNewsByInterests(policyInterests, userState);
        console.log(`[STAGE-4] Got ${stateNews.length} ${userState} news articles`);
      }

      // Combine: state news first (more personal), then national
      // Dedupe by URL
      const seenUrls = new Set<string>();
      for (const article of [...stateNews, ...nationalNews]) {
        if (!seenUrls.has(article.url)) {
          seenUrls.add(article.url);
          newsArticles.push({
            ...article,
            isLocal: stateNews.includes(article)
          });
        }
      }
      // Limit to 10 total
      newsArticles = newsArticles.slice(0, 10);

      console.log(`[STAGE-4] Total ${newsArticles.length} personalized news articles. Elapsed: ${Date.now() - startTime}ms`);
    } catch (newsError) {
      console.error(`[STAGE-4] News fetch failed (non-fatal):`, newsError);
      // Continue without news - non-fatal
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
      stateBills // Include state legislature bills
    };

    try {
      const scriptResult = await this.generateScript(type, billsWithActions, newsArticles, personalization);
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
    console.log(`[STAGE-6] Generating written article...`);
    let article: string = '';
    let wordCount: number = 0;
    try {
      const articleResult = await this.generateWrittenArticle(type, billsWithActions, newsArticles, headline, stateBills, userState);
      article = articleResult.article;
      wordCount = articleResult.wordCount;
      console.log(`[STAGE-6] Generated article: ${wordCount} words. Elapsed: ${Date.now() - startTime}ms`);
    } catch (articleError) {
      console.error(`[STAGE-6] Article generation failed (non-fatal):`, articleError);
      // Continue without article - non-fatal
    }

    // ==================== STAGE 7: GET FEATURE IMAGE ====================
    // Cascade: 1) Perplexity images → 2) og:image from URLs → 3) Gemini fallback
    console.log(`[STAGE-7] Getting feature image...`);

    let featuredImage: string | null = null;

    // Step 1: Try to get image from Perplexity news response
    for (const article of newsArticles) {
      // Check both article.image?.url (NewsArticle interface) and article.imageUrl (legacy)
      const imageUrl = article.image?.url || article.imageUrl;
      if (imageUrl) {
        featuredImage = imageUrl;
        console.log(`[STAGE-7] Using image from Perplexity: ${featuredImage}`);
        break;
      }
    }

    // Step 2: Try to fetch og:image from news article URLs
    if (!featuredImage && newsArticles.length > 0) {
      console.log(`[STAGE-7] No Perplexity images, trying to fetch og:image from news URLs...`);
      for (const article of newsArticles.slice(0, 3)) { // Try first 3 URLs
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

    // Step 3: Fall back to Gemini image generation
    if (!featuredImage) {
      console.log(`[STAGE-7] No og:image found, generating with Gemini...`);
      try {
        featuredImage = await this.generateFeatureImage(headline, policyInterests, briefId);
        if (featuredImage) {
          console.log(`[STAGE-7] Generated Gemini image: ${featuredImage}`);
        }
      } catch (imageError) {
        console.error(`[STAGE-7] Gemini image generation failed (non-fatal):`, imageError);
      }
    }

    // Step 4: Fall back to Pexels stock photo search
    if (!featuredImage) {
      console.log(`[STAGE-7] Gemini failed, trying Pexels...`);
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

    // Format news articles for storage
    const newsJson = newsArticles.length > 0 ? JSON.stringify(
      newsArticles.slice(0, 5).map((article: any) => ({
        title: article.title,
        url: article.url,
        summary: article.summary,
        source: article.url ? new URL(article.url).hostname.replace('www.', '') : 'Unknown'
      }))
    ) : null;

    // Save the script and set status to 'script_ready'
    // Netlify scheduled function (audio-processor) polls for this status every 2 minutes
    await db.prepare(`
      UPDATE briefs
      SET status = ?, title = ?, script = ?, content = ?, featured_image = ?, news_json = ?, updated_at = ?
      WHERE id = ?
    `).bind('script_ready', headline, script, article, featuredImage, newsJson, Date.now(), briefId).run();

    // Save featured bills for deduplication in future briefs
    const featuredBillIds = billsWithActions.map((b: any) => b.id);
    await this.saveFeaturedBills(briefId, featuredBillIds);

    // Save featured state bills for the "Related State Bills" section
    const featuredStateBillIds = stateBills.map((b: any) => b.id);
    await this.saveFeaturedStateBills(briefId, featuredStateBillIds);

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
      const newsSummary = newsArticles.slice(0, 3).map((n: any) => n.title || '').filter(Boolean).join('; ');

      // Format the episodic content - this becomes searchable history
      const episodeContent = [
        `Brief: ${type} brief for ${userName} (${userState || 'US'})`,
        `Topic: ${headline}`,
        `Policy Interests: ${policyInterests.join(', ')}`,
        `Featured Bills: ${billTitles}`,
        newsArticles.length > 0 ? `News: ${newsSummary}` : null,
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

      // Create a prompt for photo-realistic civic/political imagery
      const policyContext = policyAreas.slice(0, 3).join(', ') || 'legislation';
      const imagePrompt = `Photo-realistic editorial image for a news article about ${policyContext}. The image should convey the essence of: "${headline}". Style: Professional news photography, clean composition, natural lighting, suitable for a civic engagement platform. Include subtle American civic imagery like the Capitol building, congressional setting, or professional political environment. No text overlays, no artificial elements, photojournalistic quality.`;

      console.log(`[IMAGE-GEN] Prompt: ${imagePrompt.substring(0, 100)}...`);

      // Call Gemini 2.0 Flash (experimental) for image generation
      const geminiApiKey = this.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        console.warn('[IMAGE-GEN] GEMINI_API_KEY not set, skipping image generation');
        return null;
      }

      // Use gemini-2.0-flash-exp which supports image output with responseModalities
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
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
   * Save which bills were featured in this brief (for future deduplication)
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
    newsArticles: any[],
    personalization: {
      userName: string;
      state: string | null;
      district: number | null;
      repBillIds: string[];
      policyInterests: string[];
      stateBills: any[];
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

RELATED NEWS & CONTEXT (1-2 minutes):
- Smooth transition: "And ${hostB}, this isn't happening in isolation..."
- Connect to 2-3 news stories from different policy areas the listener cares about
- Quick, conversational updates${spokenState ? `\n- Local angle: "Closer to home in ${spokenState}..."` : ''}

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

    // Separate local news for highlighting
    const localNews = newsArticles.filter((a: any) => a.isLocal);
    const nationalNews = newsArticles.filter((a: any) => !a.isLocal);

    // Format news with local/national distinction
    const newsSection = [
      ...(localNews.length > 0 ? [`LOCAL NEWS (from ${spokenState || 'your area'}):\n${localNews.slice(0, 2).map((a: any) => `• ${a.title}`).join('\n')}`] : []),
      ...(nationalNews.length > 0 ? [`NATIONAL NEWS:\n${nationalNews.slice(0, 3).map((a: any) => `• ${a.title}`).join('\n')}`] : [])
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
` : ''}=== NEWS COVERAGE ===
${newsSection || 'No recent news headlines'}

=== PERSONALIZATION REQUIREMENTS ===
1. START by greeting ${personalization.userName} by name warmly
2. ${isTopStoryFromRep ? `The TOP STORY is from ${personalization.userName}'s OWN representative - emphasize this personal connection!` : 'Make the top story feel relevant to their interests'}
3. ${localNews.length > 0 ? `Include the LOCAL news from ${spokenState} - make it feel personal` : 'Focus on national stories relevant to their interests'}
4. ${stateBillsText ? `Include the STATE LEGISLATURE section - transition with "Now let's check in on what's happening in the ${spokenState || 'state'} legislature..." and cover 1-2 state bills` : 'No state bills this time'}
5. Follow the show structure: Personalized Opening → Intro → Top Story → Headlines → Spotlight${stateBillsText ? ' → State Legislature' : ''} → Personalized Outro
6. The HAKIVO OUTRO must include ${personalization.userName}'s name in the call to action
7. Every line starts with "${hostA.toUpperCase()}:" or "${hostB.toUpperCase()}:"
8. Include emotional cues in [brackets]
9. Make it conversational and engaging - this brief was made JUST for ${personalization.userName}

Generate a HEADLINE in the style of The New York Times.

NYT-STYLE HEADLINE RULES:
1. TELL A STORY, not just facts - capture the narrative arc and human stakes
2. USE STRONG VERBS - "Clears", "Gambles", "Battles", "Faces" instead of "Passes", "Is", "Has"
3. IMPLY THE "SO WHAT" - why should readers care about this?
4. CREATE TENSION - show the conflict, stakes, or uncertainty
5. MAX 12 WORDS - punchy and powerful

EXAMPLES of what we want:
- Instead of "Senate Passes Immigration Bill" → "A Nation's Immigration Debate Reaches Its Breaking Point"
- Instead of "Healthcare Bill Advances" → "Millions Face Uncertainty as Health Overhaul Moves Forward"
- Instead of "Climate Bill Clears House" → "Congress Bets Big on a Greener Future"
- Instead of "Defense Spending Increases" → "The Pentagon's Price Tag: What It Means for Your Taxes"
- Instead of "Tax Reform Introduced" → "A Tax Overhaul That Could Reshape the American Economy"

Think like a NYT editor: What's the STORY here? What's at STAKE? Who WINS and who LOSES?

Format your response EXACTLY as:
HEADLINE: [Your NYT-style headline here]

SCRIPT:
${hostA.toUpperCase()}: [emotional cue] dialogue...
${hostB.toUpperCase()}: [emotional cue] dialogue...
...`;

    // Use Claude Sonnet 4.5 with web search for enhanced, up-to-date content
    const result = await this.env.CLAUDE_CLIENT.generateWithWebSearch(
      systemPrompt,
      userPrompt,
      4096,  // max tokens for longer scripts
      0.75,  // temperature for creative but coherent output
      3      // max 3 web searches to keep costs reasonable
    );

    // Parse headline and script from response
    const content = result.content;
    let headline = `${type.charAt(0).toUpperCase() + type.slice(1)} Brief - ${new Date().toLocaleDateString()}`;
    let script = content;

    // Extract headline if present
    const headlineMatch = content.match(/HEADLINE:\s*(.+?)(?:\n|SCRIPT:)/i);
    if (headlineMatch) {
      headline = headlineMatch[1]!.trim();
    }

    // Extract script if marked
    const scriptMatch = content.match(/SCRIPT:\s*([\s\S]+)/i);
    if (scriptMatch) {
      script = scriptMatch[1]!.trim();
    }

    // Append AI disclosure to the audio script (will be read aloud at the end)
    const aiDisclosure = `\n\nThis brief was generated by artificial intelligence. While we strive for accuracy, please verify any facts before sharing or acting on this information. For the latest updates, visit hakivo.com.`;
    script = script + aiDisclosure;

    console.log(`✓ Generated script with Claude Sonnet 4.5: ${script.length} characters, headline: "${headline}", searches: ${result.searchesUsed || 0}`);

    return { script, headline };
  }

  /**
   * Generate extended written article for the brief detail page
   * Format similar to NPR articles with rich content and hyperlinks
   */
  private async generateWrittenArticle(
    type: string,
    bills: any[],
    newsArticles: any[],
    headline: string,
    stateBills: any[] = [],
    userState: string | null = null
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

    const newsLinks = newsArticles.map((article: any) => ({
      title: article.title,
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

You have WEB SEARCH capability - use it to find additional context, expert analysis, and recent developments that would enrich the article.

CRITICAL: DO NOT include labels like "Lead:", "Nut Graf:", or any structural markers. Write naturally like a published article.

ARTICLE STRUCTURE (follow but don't label):
1. Opening paragraph: A compelling hook that draws readers in immediately
2. Context: Why this matters to everyday Americans
3. Body: 2-3 sections with ## subheadings covering key developments
4. Analysis: What this means going forward
${stateBillsContext ? `5. State Legislature: A section covering relevant state legislation${stateName ? ` in ${stateName}` : ''}\n` : ''}6. Call to action: End by encouraging civic engagement

INTEGRATING NEWS SOURCES:
- WEAVE news headlines and reporting into your narrative
- Reference what major outlets are saying: "According to [source]..." or "As [outlet] reported..."
- Use news articles to provide additional context and credibility
- Link to news sources using markdown: [headline](url)
- CRITICAL: Use news article URLs EXACTLY as provided - do NOT modify them or insert bill links into URLs

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
- Empowering, not preachy`;

    // User prompt with context and instructions
    const userPrompt = `Write a polished news article for: "${headline}"
Date: ${today}
Type: ${type} briefing

Use web search to find additional context, expert opinions, or recent developments about the key legislation.

=== KEY FEDERAL LEGISLATION ===
${billsContext}
${stateBillsContext ? `
=== STATE LEGISLATION${stateName ? ` (${stateName})` : ''} ===
${stateBillsContext}
` : ''}
=== RELATED NEWS COVERAGE (integrate these into your article) ===
${newsContext}

Write the article naturally without any structural labels. Start directly with an engaging opening paragraph.
Include ## subheadings where they make sense to break up content.
Link all federal bills to their congress.gov URLs.
${stateBillsContext ? `IMPORTANT: Include a section about state legislation${stateName ? ` in ${stateName}` : ''}. Link state bills to their OpenStates URLs.\n` : ''}IMPORTANT: Reference the news articles in your writing - cite what reporters are saying, link to their coverage.
End with an empowering note about staying informed.`;

    // Use Claude Sonnet 4.5 with web search for enhanced article content
    const result = await this.env.CLAUDE_CLIENT.generateWithWebSearch(
      systemPrompt,
      userPrompt,
      3000,  // max tokens for detailed article
      0.6,   // temperature - slightly lower for more factual writing
      2      // max 2 web searches for articles
    );

    const article = result.content;
    const wordCount = article.split(/\s+/).length;

    console.log(`✓ Generated written article with Claude Sonnet 4.5: ${wordCount} words, searches: ${result.searchesUsed || 0}`);

    return { article, wordCount };
  }

}

export interface Body {
  briefId: string;
  userId: string;
  type: 'daily' | 'weekly' | 'custom';
  startDate: string;
  endDate: string;
  requestedAt: number;
}
