import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * Brief Generator - Multi-Stage Pipeline
 *
 * This observer handles brief generation in stages:
 * - Stage 1-4: Content gathering (user prefs, bills, actions, news)
 * - Stage 5: Script generation (Cerebras AI)
 * - Stage 6: Article generation (Cerebras AI)
 * - Stage 7: Trigger async audio generation (Netlify Background Function)
 *
 * Audio generation is handled by Netlify Background Function:
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

    // ==================== STAGE 1: GET USER PREFERENCES ====================
    console.log(`[STAGE-1] Getting user preferences for ${userId}...`);
    const userPrefs = await this.getUserPreferences(userId);
    console.log(`[STAGE-1] Got prefs: ${userPrefs ? 'found' : 'not found'}. Elapsed: ${Date.now() - startTime}ms`);

    if (!userPrefs) {
      console.log(`⚠️ [STAGE-1] No user preferences found for ${userId}`);
      await db.prepare('UPDATE briefs SET status = ?, updated_at = ? WHERE id = ?')
        .bind('failed', Date.now(), briefId).run();
      return;
    }

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

    // ==================== STAGE 2: FETCH BILLS ====================
    console.log(`[STAGE-2] Fetching bills for interests...`);
    let bills: any[];
    try {
      bills = await this.getBillsByInterests(policyInterests, startDate, endDate);
      console.log(`[STAGE-2] Got ${bills.length} bills. Elapsed: ${Date.now() - startTime}ms`);
    } catch (billError) {
      console.error(`[STAGE-2] FAILED:`, billError);
      await db.prepare('UPDATE briefs SET status = ?, updated_at = ? WHERE id = ?')
        .bind('failed', Date.now(), briefId).run();
      return;
    }

    if (bills.length === 0) {
      console.log(`⚠️ [STAGE-2] No bills found matching interests`);
      await db.prepare('UPDATE briefs SET status = ?, updated_at = ? WHERE id = ?')
        .bind('failed', Date.now(), briefId).run();
      return;
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

    // ==================== STAGE 4: FETCH NEWS ====================
    console.log(`[STAGE-4] Fetching news from Exa...`);
    let newsArticles: any[] = [];
    try {
      newsArticles = await this.fetchNewsByInterests(policyInterests);
      console.log(`[STAGE-4] Got ${newsArticles.length} news articles. Elapsed: ${Date.now() - startTime}ms`);
    } catch (newsError) {
      console.error(`[STAGE-4] News fetch failed (non-fatal):`, newsError);
      // Continue without news - non-fatal
    }

    // ==================== CHECKPOINT: SAVE CONTENT GATHERED ====================
    console.log(`[CHECKPOINT] Saving gathered content. Elapsed: ${Date.now() - startTime}ms`);
    await db.prepare('UPDATE briefs SET status = ? WHERE id = ?')
      .bind('content_gathered', briefId).run();

    // ==================== STAGE 5: GENERATE SCRIPT ====================
    console.log(`[STAGE-5] Generating script with Cerebras...`);
    let script: string;
    let headline: string;
    try {
      const scriptResult = await this.generateScript(type, billsWithActions, newsArticles);
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

    // ==================== STAGE 7: TRIGGER AUDIO GENERATION (Netlify Background) ====================
    console.log(`[STAGE-7] Saving script and triggering Netlify background function...`);

    // Save the script and set status to generating
    await db.prepare(`
      UPDATE briefs
      SET status = ?, title = ?, script = ?, content = ?, updated_at = ?
      WHERE id = ?
    `).bind('generating', headline, script, article, Date.now(), briefId).run();

    // Trigger Netlify background function for async audio generation
    // Background function will update status to 'completed' or 'audio_failed'
    const netlifyUrl = 'https://hakivo-v2.netlify.app/api/generate-audio-background';

    try {
      console.log(`[STAGE-7] Calling Netlify background function: ${netlifyUrl}`);
      const bgResponse = await fetch(netlifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId, script })
      });

      if (bgResponse.status === 202) {
        console.log(`✅ [STAGE-7] Background function accepted (202). Audio will be generated async.`);
      } else {
        console.log(`⚠️ [STAGE-7] Unexpected response: ${bgResponse.status}. Audio generation may still proceed.`);
      }
    } catch (triggerError) {
      const errorMessage = triggerError instanceof Error ? triggerError.message : String(triggerError);
      console.error(`[STAGE-7] Failed to trigger background function:`, errorMessage);
      // Mark as script_ready so audio-retry-scheduler can pick it up later
      await db.prepare('UPDATE briefs SET status = ?, updated_at = ? WHERE id = ?')
        .bind('script_ready', Date.now(), briefId).run();
      console.log(`⚠️ [BRIEF-GEN] Script saved, audio will be retried by scheduler`);
      return;
    }

    // Brief generation complete - audio is being processed in background
    console.log(`✅ [BRIEF-GEN] Script ready, audio generating in background. Total time: ${Date.now() - startTime}ms`);
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
   * Get bills matching user's policy interests
   * Prioritizes interest matching over date - finds most recent bills that match interests
   * Maps user-friendly interest names to Congress.gov policy_area values
   */
  private async getBillsByInterests(interests: string[], _startDate: string, _endDate: string): Promise<any[]> {
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

    // Sort all found bills by latest_action_date and return top 15
    allBills.sort((a, b) => {
      const dateA = a.latest_action_date || '';
      const dateB = b.latest_action_date || '';
      return dateB.localeCompare(dateA);
    });

    console.log(`✓ Total ${allBills.length} bills matching user interests`);
    return allBills.slice(0, 15);
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
   * Fetch news articles based on user's policy interests
   */
  private async fetchNewsByInterests(interests: string[]): Promise<any[]> {
    // Calculate date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    try {
      const searchResults = await this.env.EXA_CLIENT.searchNews(
        interests,
        startDate,
        endDate,
        10
      );

      return searchResults;
    } catch (error) {
      console.error('Failed to fetch news articles:', error);
      return [];
    }
  }

  /**
   * Generate brief script using Cerebras in NPR/Marketplace style
   * Generates 6-8 minute dialogue with emotional cues for natural speech
   */
  private async generateScript(type: string, bills: any[], newsArticles: any[]): Promise<{
    script: string;
    headline: string;
  }> {
    const billsSummary = bills.map((bill: any) => {
      // Format recent actions if available
      const actionsText = bill.actions && bill.actions.length > 0
        ? bill.actions.slice(0, 3).map((a: any) => `    • ${a.action_date}: ${a.action_text}`).join('\n')
        : `    • ${bill.latest_action_date}: ${bill.latest_action_text}`;

      return `- ${String(bill.bill_type).toUpperCase()} ${bill.bill_number}: ${bill.title}
  Policy Area: ${bill.policy_area || 'General'}
  Sponsor: ${bill.first_name || 'Unknown'} ${bill.last_name || ''} (${bill.party || '?'}-${bill.state || '?'})
  Recent Actions:
${actionsText}
  Bill URL: https://www.congress.gov/bill/${bill.congress}th-congress/${bill.bill_type.toLowerCase()}/${bill.bill_number}`;
    }).join('\n\n');

    const newsSummary = newsArticles.map((article: any) =>
      `- ${article.title}
  Summary: ${article.summary}
  Source: ${article.url}
  Published: ${article.publishedAt || 'Recent'}`
    ).join('\n\n');

    // Get today's date for context
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const messages = [
      {
        role: 'system' as const,
        content: `You are an expert scriptwriter for NPR's Marketplace and Morning Edition podcasts.
Write in a conversational, engaging tone that's warm but informative - like Kai Ryssdal or Steve Inskeep.
Format scripts as natural dialogue between two co-hosts:
- HOST A: The main host who leads the conversation
- HOST B: The co-host who adds analysis, asks clarifying questions, and provides context

IMPORTANT FORMATTING RULES:
1. Every line MUST start with "HOST A:" or "HOST B:"
2. Include emotional cues in brackets at the start of dialogue lines: [cheerfully], [thoughtfully], [with concern], [excitedly], [in a more serious tone], [laughing], [curiously]
3. Use natural conversational transitions - don't just list topics
4. Include verbal pauses and natural speech patterns
5. Make it sound like a real conversation, not a scripted read

CONTENT STYLE:
- Open with a warm, engaging intro that hooks the listener
- Weave news stories and legislative updates together narratively
- Explain complex legislative terms in plain language
- Include brief analysis of why bills matter to everyday people
- Use specific examples to illustrate impact
- End with a forward-looking summary and sign-off

TARGET LENGTH: ${type === 'daily' ? '6-8 minutes' : '10-15 minutes'} of spoken content (approximately ${type === 'daily' ? '1200-1600' : '2000-3000'} words)`
      },
      {
        role: 'user' as const,
        content: `Generate a ${type} audio briefing script for ${today}.

=== LEGISLATIVE UPDATES ===
${billsSummary}

=== RELATED NEWS ===
${newsSummary || 'No recent news articles found.'}

=== REQUIREMENTS ===
1. Create an engaging, conversational dialogue between HOST A and HOST B
2. Open with a catchy hook that draws listeners in
3. Cover all provided bills and news, weaving them into a cohesive narrative
4. Include emotional cues in [brackets] before dialogue for natural delivery
5. Add transitions that sound natural ("Speaking of which...", "And that brings us to...", "But here's the thing...")
6. Include brief moments of light banter to keep it engaging
7. End with a warm sign-off

Also generate a HEADLINE - a catchy, unique title for this briefing (max 10 words).

Format your response EXACTLY as:
HEADLINE: [Your catchy headline here]

SCRIPT:
HOST A: [emotional cue] dialogue text...
HOST B: [emotional cue] dialogue text...
...`
      }
    ];

    const result = await this.env.CEREBRAS_CLIENT.generateCompletion(
      messages,
      0.75, // temperature for creative but coherent output
      4096  // max tokens for longer scripts
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

    console.log(`✓ Generated script with Cerebras: ${script.length} characters, headline: "${headline}"`);

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

    const messages = [
      {
        role: 'system' as const,
        content: `You are a senior NPR correspondent writing a detailed news article for the web.
Write in the style of NPR's long-form journalism - informative, engaging, and accessible to general audiences.

ARTICLE STRUCTURE (follow exactly):
1. LEAD PARAGRAPH: A compelling hook that summarizes the most important news
2. NUT GRAF: Context paragraph explaining why this matters
3. BODY SECTIONS: 3-5 sections covering different bills/news with subheadings
4. QUOTES/ANALYSIS: Include analysis of implications
5. WHAT'S NEXT: Forward-looking conclusion

FORMATTING REQUIREMENTS:
- Use markdown formatting
- Use ## for section headers
- Include hyperlinks in format: [text](url)
- Link ALL bill references to congress.gov
- Link ALL news references to source articles
- Bold key terms and bill names on first mention
- Include relevant statistics when available
- Write 600-900 words for daily, 1200-1500 for weekly

TONE:
- Authoritative but accessible
- Explain legislative jargon in plain language
- Include "why this matters" context
- Be objective and balanced`
      },
      {
        role: 'user' as const,
        content: `Write a detailed news article for: "${headline}"
Date: ${today}
Type: ${type} briefing

=== LEGISLATIVE UPDATES (include hyperlinks to all) ===
${billsContext}

=== RELATED NEWS (include hyperlinks to all) ===
${newsContext}

Write a comprehensive, NPR-style article that:
1. Opens with an engaging lead that hooks readers
2. Explains what's happening and why it matters
3. Links to every bill and news source mentioned
4. Provides context and analysis
5. Ends with what to watch for next

Use proper markdown formatting with headers, bold text, and hyperlinks.`
      }
    ];

    const result = await this.env.CEREBRAS_CLIENT.generateCompletion(
      messages,
      0.6, // temperature - slightly lower for more factual writing
      3000  // max tokens for detailed article
    );

    const article = result.content;
    const wordCount = article.split(/\s+/).length;

    console.log(`✓ Generated written article: ${wordCount} words`);

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
