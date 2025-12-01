import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * Brief Generator - Multi-Stage Pipeline
 *
 * This observer handles brief generation in stages:
 * - Stage 1-4: Content gathering (user prefs, bills, actions, news)
 * - Stage 5: Script generation (Cerebras AI)
 * - Stage 6: Article generation (Cerebras AI)
 * - Stage 7: Set status to 'script_ready' for Netlify scheduled function
 *
 * Audio generation is handled by Netlify Scheduled Function (audio-processor):
 * - Runs every 2 minutes, polls for briefs with status='script_ready'
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
    console.log(`[STAGE-2a] Getting recently featured bills to avoid duplication...`);
    let recentlyFeaturedBillIds: string[] = [];
    try {
      recentlyFeaturedBillIds = await this.getRecentlyFeaturedBills(userId, 7); // Last 7 days
      console.log(`[STAGE-2a] Found ${recentlyFeaturedBillIds.length} recently featured bills to exclude`);
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
      const interestBills = await this.getBillsByInterests(
        policyInterests,
        startDate,
        endDate,
        [...recentlyFeaturedBillIds, ...repBills.map(b => b.id)],
        userId // Pass userId for seeded variation
      );
      console.log(`[STAGE-2b] Got ${interestBills.length} interest-matched bills`);

      // Combine: Rep bills first (max 2), then interest bills
      const repBillsToInclude = repBills.slice(0, 2);
      const interestBillsToInclude = interestBills.slice(0, 5 - repBillsToInclude.length);
      bills = [...repBillsToInclude, ...interestBillsToInclude];

      console.log(`[STAGE-2b] Total ${bills.length} personalized bills. Elapsed: ${Date.now() - startTime}ms`);
    } catch (billError) {
      console.error(`[STAGE-2b] FAILED:`, billError);
      await db.prepare('UPDATE briefs SET status = ?, updated_at = ? WHERE id = ?')
        .bind('failed', Date.now(), briefId).run();
      return;
    }

    if (bills.length === 0) {
      console.log(`⚠️ [STAGE-2b] No bills found matching interests`);
      await db.prepare('UPDATE briefs SET status = ?, updated_at = ? WHERE id = ?')
        .bind('failed', Date.now(), briefId).run();
      return;
    }

    // Track which are rep bills for script personalization
    const repBillIds = new Set(repBills.map(b => b.id));

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
    console.log(`[STAGE-4] Fetching personalized news from Exa...`);
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
      policyInterests
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
      const articleResult = await this.generateWrittenArticle(type, billsWithActions, newsArticles, headline);
      article = articleResult.article;
      wordCount = articleResult.wordCount;
      console.log(`[STAGE-6] Generated article: ${wordCount} words. Elapsed: ${Date.now() - startTime}ms`);
    } catch (articleError) {
      console.error(`[STAGE-6] Article generation failed (non-fatal):`, articleError);
      // Continue without article - non-fatal
    }

    // ==================== STAGE 7: GENERATE FEATURE IMAGE ====================
    console.log(`[STAGE-7] Generating feature image with Gemini...`);

    // Generate photo-realistic feature image using Gemini 2.5 Flash Image
    let featuredImage: string | null = null;
    try {
      featuredImage = await this.generateFeatureImage(headline, policyInterests, briefId);
      if (featuredImage) {
        console.log(`[STAGE-7] Generated feature image: ${featuredImage}`);
      } else {
        // Fallback: Try to get image from news articles
        console.log(`[STAGE-7] Image generation returned null, checking news articles...`);
        for (const article of newsArticles) {
          if (article.imageUrl) {
            featuredImage = article.imageUrl;
            console.log(`[STAGE-7] Using fallback image from news: ${featuredImage}`);
            break;
          }
        }
      }
    } catch (imageError) {
      console.error(`[STAGE-7] Image generation error (non-fatal):`, imageError);
      // Fallback: Try to get image from news articles
      for (const article of newsArticles) {
        if (article.imageUrl) {
          featuredImage = article.imageUrl;
          console.log(`[STAGE-7] Using fallback image from news: ${featuredImage}`);
          break;
        }
      }
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

    // Brief generation complete - audio will be processed by Netlify scheduled function
    console.log(`✅ [BRIEF-GEN] Script saved with status='script_ready'. Audio will be processed by Netlify scheduler.`);
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

      // Call Gemini 2.5 Flash Image API
      const geminiApiKey = this.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        console.warn('[IMAGE-GEN] GEMINI_API_KEY not set, skipping image generation');
        return null;
      }

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

      const result = await response.json();

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
   * This ensures each day's brief has fresh content
   */
  private async getRecentlyFeaturedBills(userId: string, daysBack: number = 7): Promise<string[]> {
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

    // Map user interests to policy_area values
    const policyAreaMap: Record<string, string[]> = {
      'Commerce & Labor': ['Commerce', 'Labor and Employment', 'Economics and Public Finance'],
      'Education & Science': ['Education', 'Science, Technology, Communications'],
      'Economy & Finance': ['Finance and Financial Sector', 'Economics and Public Finance', 'Taxation'],
      'Environment & Energy': ['Environmental Protection', 'Energy', 'Public Lands and Natural Resources'],
      'Health & Social Welfare': ['Health', 'Social Welfare', 'Families'],
      'Defense & Security': ['Armed Forces and National Security', 'Crime and Law Enforcement'],
      'Immigration': ['Immigration'],
      'Foreign Affairs': ['International Affairs', 'Foreign Trade and International Finance'],
      'Government': ['Government Operations and Politics', 'Congress'],
      'Civil Rights': ['Civil Rights and Liberties, Minority Issues']
    };

    // Map user interests to keywords for title matching (for bills without policy_area)
    const keywordMap: Record<string, string[]> = {
      'Commerce & Labor': ['commerce', 'business', 'trade', 'labor', 'employment', 'worker', 'job'],
      'Education & Science': ['education', 'school', 'science', 'research', 'technology', 'student'],
      'Economy & Finance': ['finance', 'tax', 'budget', 'economic', 'banking', 'fiscal'],
      'Environment & Energy': ['environment', 'energy', 'climate', 'conservation', 'pollution'],
      'Health & Social Welfare': ['health', 'medical', 'medicare', 'medicaid', 'welfare', 'social'],
      'Defense & Security': ['defense', 'military', 'security', 'armed forces', 'veteran'],
      'Immigration': ['immigration', 'immigrant', 'border', 'visa', 'asylum'],
      'Foreign Affairs': ['foreign', 'international', 'diplomatic', 'treaty'],
      'Government': ['government', 'federal', 'administration', 'agency'],
      'Civil Rights': ['civil rights', 'discrimination', 'equality', 'voting rights']
    };

    // Build list of policy areas and keywords to match
    const policyAreas: string[] = [];
    const keywords: string[] = [];
    for (const interest of interests) {
      const mapped = policyAreaMap[interest];
      if (mapped) {
        policyAreas.push(...mapped);
      }
      const kwds = keywordMap[interest];
      if (kwds) {
        keywords.push(...kwds);
      }
    }

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

    // Add user-specific variation: shuffle within date tiers
    // This ensures different users with same interests see different bill mixes
    if (userId && freshBills.length > 5) {
      // Create a simple hash from userId + today's date for deterministic but varied results
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const seed = userId + today;
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
      }

      // Use hash to pick a starting offset (0-4) for variety
      const offset = Math.abs(hash) % Math.min(5, freshBills.length);

      // Rotate the array by offset for variety
      const rotated = [...freshBills.slice(offset), ...freshBills.slice(0, offset)];
      console.log(`✓ Applied user-specific variation (offset: ${offset}) for ${freshBills.length} bills`);
      return rotated.slice(0, 5);
    }

    console.log(`✓ Total ${freshBills.length} fresh bills matching user interests`);
    return freshBills.slice(0, 5);
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
   * Supports localized news when state is provided
   */
  private async fetchNewsByInterests(interests: string[], state: string | null): Promise<any[]> {
    // Calculate date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    try {
      // If state is provided, add it to search terms for local news
      const searchTerms = state
        ? [...interests, state] // e.g., ["Economy & Finance", "WI"]
        : interests;

      const searchResults = await this.env.EXA_CLIENT.searchNews(
        searchTerms,
        startDate,
        endDate,
        state ? 5 : 10 // Fewer results for state-specific searches
      );

      return searchResults;
    } catch (error) {
      console.error(`Failed to fetch news articles${state ? ` for ${state}` : ''}:`, error);
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

    // System prompt for the script generation with personalization
    const systemPrompt = `You are a scriptwriter for "Hakivo Daily" - a PERSONALIZED civic engagement audio briefing inspired by The New York Times' "The Daily" podcast.

Your hosts are ${hostA} (female) and ${hostB} (male). They have great chemistry and naturally use each other's names in conversation.

=== LISTENER PROFILE (PERSONALIZE FOR THIS LISTENER) ===
Name: ${personalization.userName}
${spokenState ? `Location: ${spokenState}${personalization.district ? `, Congressional District ${personalization.district}` : ''}` : 'Location: Not specified'}
Policy Interests: ${personalization.policyInterests.join(', ')}

IMPORTANT PERSONALIZATION RULES:
1. Address the listener by name in the opening: "Good morning, ${personalization.userName}..." or "Hey ${personalization.userName}, welcome back..."
2. ${isTopStoryFromRep && topStoryBill ? `The TOP STORY is from this listener's OWN representative (${topStoryBill.first_name} ${topStoryBill.last_name}). Make it personal: "Your representative, ${topStoryBill.first_name} ${topStoryBill.last_name}, just introduced..."` : 'Connect stories to the listener\'s interests.'}
3. ${spokenState ? `Reference their state when relevant: "Here in ${spokenState}..." or "For folks in ${spokenState}..."` : 'Keep location references general.'}
4. This brief is UNIQUE to this listener - make them feel it was created just for them.

IMPORTANT: Write ONLY natural spoken dialogue. NEVER include section labels, headers, or structural markers in the script. The hosts should NEVER say words like "cold open", "intro", "top story", "spotlight", "outro", or any section names. These are just internal guidance for you.

You have WEB SEARCH capability - use it to find the latest updates on these bills and any breaking news that would enhance the script. Search for recent developments, expert opinions, and real-world impacts.

NATURAL FLOW (hosts never announce these sections - they just flow naturally):

Opening (15-20 seconds):
- Start with a personalized greeting using the listener's name
- Hook them with today's top story
- Example: ${hostA.toUpperCase()}: [warmly] "Good morning, ${personalization.userName}. A bill that could change how millions of Americans access healthcare just cleared a major hurdle yesterday..."

Show Introduction (20-30 seconds):
- ${hostA.toUpperCase()}: "From Hakivo, I'm ${hostA}." ${hostB.toUpperCase()}: "And I'm ${hostB}." ${hostA.toUpperCase()}: "It's ${today}. Here's what you need to know today."

Main Story (2-3 minutes):
- Deep dive into the most significant legislative development
- ${isTopStoryFromRep ? 'IMPORTANT: This is from the listener\'s own representative - make it personal and relevant to them!' : 'Explain why it matters to everyday people'}
- What happens next
- Natural back-and-forth between hosts (use names: "That's right, ${hostB}..." or "Good point, ${hostA}...")

Quick News Updates (45-60 seconds):
- Transition naturally: "Before we move on, a few other stories caught our attention..."
- Quick hits on 2-3 related news stories${spokenState ? `\n- If any news is from ${spokenState}, highlight it: "And closer to home in ${spokenState}..."` : ''}

Other Bills Worth Watching (1-2 minutes):
- Transition naturally: "There's another bill moving through Congress that connects to this..."
- Quick look at 1-2 other relevant bills

Closing (30-45 seconds):
- "That's today's Hakivo Daily."
- Personalized call to action: "Want to track these bills, ${personalization.userName}? Open Hakivo to follow them and get alerts when they move."
- "You can read the full text, see how your representatives voted, and make your voice heard."
- Sign off personally: "I'm ${hostA}." "And I'm ${hostB}." "We'll be back tomorrow. Until then, stay informed, stay engaged."

CRITICAL FORMATTING RULES:
- Every line MUST start with "${hostA.toUpperCase()}:" or "${hostB.toUpperCase()}:" followed by dialogue
- Include emotional cues in brackets: [thoughtfully], [with urgency], [warmly], [seriously]
- NEVER write section headers or labels - only spoken dialogue
- Natural conversational flow - hosts should use each other's names occasionally
- Plain language - no political jargon
- ${hostB} adds context, asks clarifying questions, provides analysis

TARGET LENGTH: ${type === 'daily' ? '5-7 minutes' : '8-12 minutes'} (approximately ${type === 'daily' ? '1000-1400' : '1600-2400'} words)`;

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

=== NEWS COVERAGE ===
${newsSection || 'No recent news headlines'}

=== PERSONALIZATION REQUIREMENTS ===
1. START by greeting ${personalization.userName} by name warmly
2. ${isTopStoryFromRep ? `The TOP STORY is from ${personalization.userName}'s OWN representative - emphasize this personal connection!` : 'Make the top story feel relevant to their interests'}
3. ${localNews.length > 0 ? `Include the LOCAL news from ${spokenState} - make it feel personal` : 'Focus on national stories relevant to their interests'}
4. Follow the show structure: Personalized Opening → Intro → Top Story → Headlines → Spotlight → Personalized Outro
5. The HAKIVO OUTRO must include ${personalization.userName}'s name in the call to action
6. Every line starts with "${hostA.toUpperCase()}:" or "${hostB.toUpperCase()}:"
7. Include emotional cues in [brackets]
8. Make it conversational and engaging - this brief was made JUST for ${personalization.userName}

Generate a HEADLINE first (catchy, max 10 words, reflects top story).

Format your response EXACTLY as:
HEADLINE: [Your headline here]

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
    headline: string
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

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

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
5. Call to action: End by encouraging civic engagement

INTEGRATING NEWS SOURCES:
- WEAVE news headlines and reporting into your narrative
- Reference what major outlets are saying: "According to [source]..." or "As [outlet] reported..."
- Use news articles to provide additional context and credibility
- Link to news sources using markdown: [headline](url)

FORMATTING REQUIREMENTS:
- Use markdown formatting throughout
- Use ## for meaningful section headers (e.g., "## Border Security Measures", "## What This Means For You")
- Include hyperlinks: [bill name](congress.gov url) and [news headline](news url)
- Bold **key terms** and **bill names** on first mention
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

=== KEY LEGISLATION ===
${billsContext}

=== RELATED NEWS COVERAGE (integrate these into your article) ===
${newsContext}

Write the article naturally without any structural labels. Start directly with an engaging opening paragraph.
Include ## subheadings where they make sense to break up content.
Link all bills to their congress.gov URLs.
IMPORTANT: Reference the news articles in your writing - cite what reporters are saying, link to their coverage.
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
