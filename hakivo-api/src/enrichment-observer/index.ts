import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { GoogleGenAI } from '@google/genai';

/**
 * Policy Analyst System Prompt
 * Forensic legislative analysis framework with strict neutrality
 */
const POLICY_ANALYST_PROMPT = `You are a neutral policy analyst conducting forensic legislative analysis. Your role is to translate complex legislation into plain English while maintaining strict objectivity.

Core Principles:
- Strict neutrality: Present facts without bias
- Plain English: Avoid jargon, use accessible language
- Forensic depth: Analyze mechanisms, not just outcomes
- Steelman both sides: Present strongest arguments for and against
- Implementation focus: Identify practical challenges

Analysis Framework:
1. Executive Summary (BLUF - Bottom Line Up Front)
   - 2-3 sentences capturing core purpose and impact

2. Status Quo vs. Change
   - What exists now
   - What changes if this passes
   - Key differences

3. Mechanism of Action
   - How the bill actually works
   - What powers it grants/removes
   - Implementation pathway

4. Stakeholder Impact
   - Winners (who benefits and how)
   - Losers (who is disadvantaged)
   - Affected groups and magnitude

5. Arguments FOR (Steelmanned)
   - Strongest case for passage
   - Supporting evidence
   - Policy rationale

6. Arguments AGAINST (Steelmanned)
   - Strongest case against passage
   - Concerns and evidence
   - Alternative approaches

7. Implementation Challenges
   - Logistical hurdles
   - Resource requirements
   - Potential bottlenecks

8. Passage Likelihood
   - Current political dynamics
   - Historical precedent
   - Key factors affecting passage

Maintain objectivity. Present all perspectives fairly. Focus on mechanisms, not ideological framing.`;

/**
 * Enrichment Observer
 *
 * Processes messages from enrichment-queue to add AI-generated summaries and analysis.
 * Uses Gemini 3 Pro Preview for all enrichment:
 * - Quick summaries for news and bill cards
 * - Deep forensic analysis with thinking mode and Google Search for bill detail pages
 */
export default class EnrichmentObserver extends Each<EnrichmentMessage, Env> {
  private gemini?: GoogleGenAI;

  async process(message: Message<EnrichmentMessage>): Promise<void> {
    console.log('🔍 Enrichment Observer: Processing enrichment message');
    console.log(`   Type: ${message.body.type}`);

    const { type } = message.body;

    try {
      switch (type) {
        case 'enrich_news':
          await this.enrichNewsArticle(message.body);
          break;
        case 'enrich_bill':
          await this.enrichBill(message.body);
          break;
        case 'deep_analysis_bill':
          await this.deepAnalyzeBill(message.body);
          break;
        default:
          console.warn(`Unknown enrichment type: ${type}`);
      }

      console.log('✅ Enrichment complete');
    } catch (error) {
      console.error('❌ Enrichment failed:', error);
      throw error;
    }
  }

  /**
   * Initialize Gemini client (lazy loading)
   */
  private getGeminiClient(): GoogleGenAI {
    if (!this.gemini) {
      this.gemini = new GoogleGenAI({
        apiKey: this.env.GEMINI_API_KEY
      });
    }
    return this.gemini;
  }

  /**
   * Enrich a news article with Gemini summary
   * Quick summaries for the personalized news feed
   */
  private async enrichNewsArticle(message: EnrichNewsMessage): Promise<void> {
    console.log(`📰 Enriching news article: ${message.article_id}`);

    const db = this.env.APP_DB;
    const gemini = this.getGeminiClient();

    try {
      // Fetch article content from database
      const article = await db
        .prepare('SELECT * FROM news_articles WHERE id = ?')
        .bind(message.article_id)
        .first();

      if (!article) {
        console.warn(`  Article ${message.article_id} not found`);
        return;
      }

      // Generate plain language summary with Gemini 3 Pro
      const prompt = `Summarize this news article in 2-3 sentences of plain English. Focus on key facts and relevance to citizens.

Article Title: ${article.title}
Article Content: ${article.description || article.summary || ''}

Provide a clear, concise summary that explains what happened and why it matters.`;

      const result = await gemini.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ]
      });

      const summary = result.text || '';

      // Extract key points (simple bullet extraction)
      const keyPoints = this.extractKeyPoints(summary);

      // Determine impact level based on content
      const articleTitle = String(article.title || '');
      const impactLevel = this.determineImpactLevel(articleTitle, summary);

      // Determine tags
      const tags = this.extractNewsTags(article, summary);

      // Insert enrichment into database
      const articleText = String(article.description || article.summary || '');
      await db
        .prepare(`
          INSERT OR REPLACE INTO news_enrichment (
            article_id, plain_language_summary, key_points,
            reading_time_minutes, impact_level, tags,
            enriched_at, model_used
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          message.article_id,
          summary,
          JSON.stringify(keyPoints),
          this.estimateReadingTime(articleText),
          impactLevel,
          JSON.stringify(tags),
          Date.now(),
          'gemini-3-pro-preview'
        )
        .run();

      console.log(`  ✓ News article enriched: ${summary.substring(0, 80)}...`);
    } catch (error) {
      console.error(`  ✗ Failed to enrich news article:`, error);
      throw error;
    }
  }

  /**
   * Enrich a bill with Gemini Pro summary for bill cards
   * Quick summaries for the personalized bills feed
   */
  private async enrichBill(message: EnrichBillMessage): Promise<void> {
    console.log(`📜 Enriching bill card: ${message.bill_id}`);

    const db = this.env.APP_DB;
    const gemini = this.getGeminiClient();
    const startTime = Date.now();

    try {
      // Mark as processing
      await db
        .prepare(`
          INSERT OR REPLACE INTO bill_enrichment (bill_id, status, started_at)
          VALUES (?, 'processing', ?)
        `)
        .bind(message.bill_id, startTime)
        .run();

      // Fetch bill from database
      const bill = await db
        .prepare('SELECT * FROM bills WHERE id = ?')
        .bind(message.bill_id)
        .first();

      if (!bill) {
        console.warn(`  Bill ${message.bill_id} not found`);
        await db
          .prepare(`UPDATE bill_enrichment SET status = 'failed' WHERE bill_id = ?`)
          .bind(message.bill_id)
          .run();
        return;
      }

      // Fetch bill text from SmartBucket if available
      let billText = '';
      try {
        const billTexts = this.env.BILL_TEXTS;
        const congress = bill.congress;
        const billType = bill.bill_type;
        const billNumber = bill.bill_number;
        const documentKey = `congress-${congress}/${billType}${billNumber}.txt`;

        const textObject = await billTexts.get(documentKey);
        if (textObject) {
          billText = await textObject.text();
        }
      } catch (error) {
        console.warn(`  Bill text not available, using title and summary only`);
      }

      // Generate comprehensive analysis with Gemini 3 Pro
      const prompt = `${POLICY_ANALYST_PROMPT}

Analyze this legislation and provide a structured summary for bill cards:

Bill: ${bill.bill_type}${bill.bill_number} - ${bill.congress}th Congress
Title: ${bill.title}
Latest Action: ${bill.latest_action_text || 'None'}
${billText ? `\nFull Text:\n${billText.substring(0, 30000)}` : ''}

Return a JSON object with these fields:
{
  "what_it_does": "2-3 sentence plain language summary of the bill's purpose and impact",
  "who_it_affects": ["group1", "group2", "group3"],
  "key_provisions": ["provision 1", "provision 2", "provision 3"],
  "potential_benefits": ["benefit 1", "benefit 2"],
  "potential_concerns": ["concern 1", "concern 2"]
}

Focus on:
- Clear, accessible language
- Specific stakeholder groups affected
- Concrete provisions and mechanisms
- Balanced benefits and concerns`;

      const result = await gemini.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ]
      });

      const responseText = result.text || '';

      // Parse JSON response
      let analysis: any;
      try {
        analysis = JSON.parse(responseText);
      } catch (error) {
        console.warn('  Failed to parse JSON, using fallback');
        analysis = {
          what_it_does: responseText.substring(0, 300),
          who_it_affects: [],
          key_provisions: [],
          potential_benefits: [],
          potential_concerns: []
        };
      }

      const summary = analysis.what_it_does || '';

      // Use structured key points from analysis
      const keyPoints = analysis.key_provisions || this.extractKeyPoints(summary);

      // Determine impact level
      const billTitle = String(bill.title || '');
      const impactLevel = this.determineImpactLevel(billTitle, summary);

      // Calculate bipartisan score (placeholder - would need cosponsor data)
      const bipartisanScore = await this.calculateBipartisanScore(message.bill_id);

      // Determine current stage and progress
      const latestAction = bill.latest_action_text as string | null;
      const { stage, progress } = this.determineBillStage(latestAction);

      // Combine tags from policy area and who it affects
      const billTags = this.extractBillTags(bill, summary);
      const whoAffects = analysis.who_it_affects || [];
      const tags = [...new Set([...billTags, ...whoAffects])];

      // Insert enrichment into database
      const completedAt = Date.now();
      await db
        .prepare(`
          INSERT OR REPLACE INTO bill_enrichment (
            bill_id, plain_language_summary, key_points,
            reading_time_minutes, impact_level, bipartisan_score,
            current_stage, progress_percentage, tags,
            enriched_at, model_used, status, started_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'complete', ?, ?)
        `)
        .bind(
          message.bill_id,
          summary,
          JSON.stringify(keyPoints),
          this.estimateReadingTime(billTitle),
          impactLevel,
          bipartisanScore,
          stage,
          progress,
          JSON.stringify(tags),
          completedAt,
          'gemini-3-pro-preview',
          startTime,
          completedAt
        )
        .run();

      console.log(`  ✓ Bill enriched in ${completedAt - startTime}ms: ${summary.substring(0, 80)}...`);
    } catch (error) {
      console.error(`  ✗ Failed to enrich bill:`, error);
      // Mark as failed
      await db
        .prepare(`UPDATE bill_enrichment SET status = 'failed' WHERE bill_id = ?`)
        .bind(message.bill_id)
        .run().catch(() => {}); // Ignore errors on error handling
      throw error;
    }
  }

  /**
   * Deep analysis of a bill with Gemini 3 Pro
   * Comprehensive forensic analysis for bill detail pages
   */
  private async deepAnalyzeBill(message: DeepAnalysisBillMessage): Promise<void> {
    console.log(`🔬 Deep analyzing bill: ${message.bill_id}`);

    const db = this.env.APP_DB;
    const gemini = this.getGeminiClient();
    const startTime = Date.now();

    try {
      // Mark as processing
      await db
        .prepare(`
          INSERT OR REPLACE INTO bill_analysis (bill_id, status, started_at)
          VALUES (?, 'processing', ?)
        `)
        .bind(message.bill_id, startTime)
        .run();

      // Fetch bill from database
      const bill = await db
        .prepare('SELECT * FROM bills WHERE id = ?')
        .bind(message.bill_id)
        .first();

      if (!bill) {
        console.warn(`  Bill ${message.bill_id} not found`);
        await db
          .prepare(`UPDATE bill_analysis SET status = 'failed' WHERE bill_id = ?`)
          .bind(message.bill_id)
          .run().catch(() => {});
        return;
      }

      // Get bill text from database (already in bills.text column)
      const billText = (bill.text as string) || '';

      // Use Gemini 3 Pro with thinking mode and web search
      const analysisPrompt = `${POLICY_ANALYST_PROMPT}

Conduct a comprehensive forensic analysis of this legislation:

Bill: ${bill.bill_type}${bill.bill_number} - ${bill.congress}th Congress
Title: ${bill.title}
Latest Action: ${bill.latest_action_text || 'None'}
${billText ? `\nFull Text:\n${billText.substring(0, 50000)}` : ''}

Provide a structured analysis following the policy analyst framework:

1. Executive Summary (2-3 sentences BLUF)
2. Status Quo vs. Change
3. Section-by-Section Breakdown (if full text available)
4. Mechanism of Action
5. Agency Powers Granted/Modified
6. Fiscal Impact
7. Stakeholder Impact (winners/losers)
8. Unintended Consequences
9. Arguments FOR (steelmanned)
10. Arguments AGAINST (steelmanned)
11. Implementation Challenges
12. Passage Likelihood (0-100) with reasoning
13. State-Specific Impacts (if applicable)

Return the analysis as a JSON object with these fields.`;

      const result = await gemini.models.generateContent({
        model: 'gemini-3-pro-preview',
        config: {
          tools: [
            {
              googleSearch: {}
            }
          ]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: analysisPrompt }]
          }
        ]
      }) as any;

      const analysisText = result.text || '';

      // Parse JSON response
      let analysis: any;
      try {
        analysis = JSON.parse(analysisText);
      } catch (error) {
        console.error('  Failed to parse Gemini response as JSON, using raw text');
        analysis = {
          executive_summary: analysisText.substring(0, 500),
          status_quo_vs_change: 'Analysis failed to parse',
          mechanism_of_action: '',
          passage_likelihood: 50,
          passage_reasoning: 'Unable to determine'
        };
      }

      // Extract thinking summary if available
      // TODO: Update thinking summary extraction for new SDK
      const thinkingSummary = null;

      const completedAt = Date.now();

      // Insert comprehensive analysis into database
      await db
        .prepare(`
          INSERT OR REPLACE INTO bill_analysis (
            bill_id, executive_summary, status_quo_vs_change,
            section_breakdown, mechanism_of_action, agency_powers,
            fiscal_impact, stakeholder_impact, unintended_consequences,
            arguments_for, arguments_against, implementation_challenges,
            passage_likelihood, passage_reasoning, recent_developments,
            state_impacts, thinking_summary, analyzed_at, model_used,
            status, started_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'complete', ?, ?)
        `)
        .bind(
          message.bill_id,
          analysis.executive_summary || '',
          analysis.status_quo_vs_change || '',
          JSON.stringify(analysis.section_breakdown || []),
          analysis.mechanism_of_action || '',
          JSON.stringify(analysis.agency_powers || []),
          JSON.stringify(analysis.fiscal_impact || {}),
          JSON.stringify(analysis.stakeholder_impact || {}),
          JSON.stringify(analysis.unintended_consequences || []),
          JSON.stringify(analysis.arguments_for || []),
          JSON.stringify(analysis.arguments_against || []),
          JSON.stringify(analysis.implementation_challenges || []),
          analysis.passage_likelihood || 50,
          analysis.passage_reasoning || '',
          JSON.stringify(analysis.recent_developments || []),
          JSON.stringify(analysis.state_impacts || {}),
          thinkingSummary,
          completedAt,
          'gemini-3-pro-preview',
          startTime,
          completedAt
        )
        .run();

      console.log(`  ✓ Deep analysis complete in ${completedAt - startTime}ms: ${analysis.executive_summary?.substring(0, 80)}...`);
    } catch (error) {
      console.error(`  ✗ Failed to deep analyze bill:`, error);
      // Mark as failed
      await db
        .prepare(`UPDATE bill_analysis SET status = 'failed' WHERE bill_id = ?`)
        .bind(message.bill_id)
        .run().catch(() => {}); // Ignore errors on error handling
      throw error;
    }
  }

  // Helper methods

  private extractKeyPoints(text: string): string[] {
    // Simple extraction - split by periods and take first 3 meaningful sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 3).map(s => s.trim());
  }

  private determineImpactLevel(title: string, summary: string): 'high' | 'medium' | 'low' {
    const highImpactKeywords = ['national', 'federal', 'major', 'crisis', 'emergency', 'trillion', 'billion'];
    const text = `${title} ${summary}`.toLowerCase();

    const highMatches = highImpactKeywords.filter(kw => text.includes(kw)).length;

    if (highMatches >= 2) return 'high';
    if (highMatches >= 1) return 'medium';
    return 'low';
  }

  private estimateReadingTime(text: string): number {
    const words = text.split(/\s+/).length;
    const minutes = Math.ceil(words / 200); // 200 words per minute
    return Math.max(1, Math.min(minutes, 10)); // Cap between 1-10 minutes
  }

  private extractNewsTags(article: any, summary: string): string[] {
    const tags: string[] = [];

    const text = `${article.title} ${summary}`.toLowerCase();

    // Check for breaking news indicators
    if (article.published_at && Date.now() - article.published_at < 3600000) {
      tags.push('breaking');
    }

    // Check for local news
    if (text.includes('local') || text.includes('city') || text.includes('county')) {
      tags.push('local');
    }

    // Check for trending topics
    if (text.includes('viral') || text.includes('trending')) {
      tags.push('trending');
    }

    return tags;
  }

  private extractBillTags(bill: any, summary: string): string[] {
    const tags: string[] = [];

    const text = `${bill.title} ${summary}`.toLowerCase();

    // Check for bipartisan indicators
    if (text.includes('bipartisan') || text.includes('both parties')) {
      tags.push('bipartisan');
    }

    // Check for urgent/priority bills
    if (text.includes('urgent') || text.includes('emergency') || text.includes('crisis')) {
      tags.push('urgent');
    }

    return tags;
  }

  private async calculateBipartisanScore(billId: string): Promise<number> {
    const db = this.env.APP_DB;

    try {
      // Get cosponsor party distribution
      const result = await db
        .prepare(`
          SELECT m.party, COUNT(*) as count
          FROM bill_cosponsors bc
          JOIN members m ON bc.member_bioguide_id = m.bioguide_id
          WHERE bc.bill_id = ?
          GROUP BY m.party
        `)
        .bind(billId)
        .all();

      const parties = result.results || [];

      if (parties.length === 0) return 0;
      if (parties.length === 1) return 25; // Single party support

      // Calculate diversity score (0-100)
      const total = parties.reduce((sum: number, p: any) => sum + p.count, 0);
      const distribution = parties.map((p: any) => p.count / total);
      const entropy = -distribution.reduce((sum: number, p: number) => sum + (p * Math.log2(p)), 0);
      const maxEntropy = Math.log2(parties.length);

      return Math.round((entropy / maxEntropy) * 100);
    } catch (error) {
      console.warn(`  Could not calculate bipartisan score:`, error);
      return 50; // Default middle score
    }
  }

  private determineBillStage(latestAction: string | null): { stage: string; progress: number } {
    if (!latestAction) {
      return { stage: 'Introduced', progress: 0 };
    }

    const action = latestAction.toLowerCase();

    if (action.includes('became public law') || action.includes('signed by president')) {
      return { stage: 'Enacted', progress: 100 };
    }
    if (action.includes('passed house') && action.includes('passed senate')) {
      return { stage: 'Awaiting President', progress: 90 };
    }
    if (action.includes('passed senate') || action.includes('passed house')) {
      return { stage: 'Passed Chamber', progress: 70 };
    }
    if (action.includes('committee')) {
      return { stage: 'Committee Review', progress: 30 };
    }
    if (action.includes('introduced')) {
      return { stage: 'Introduced', progress: 10 };
    }

    return { stage: 'In Progress', progress: 40 };
  }
}

/**
 * Message types for enrichment queue
 */
export interface EnrichNewsMessage {
  type: 'enrich_news';
  article_id: string;
  timestamp: string;
}

export interface EnrichBillMessage {
  type: 'enrich_bill';
  bill_id: string;
  timestamp: string;
}

export interface DeepAnalysisBillMessage {
  type: 'deep_analysis_bill';
  bill_id: string;
  timestamp: string;
}

export type EnrichmentMessage = EnrichNewsMessage | EnrichBillMessage | DeepAnalysisBillMessage;

// Export Body as alias for Raindrop framework
export type Body = EnrichmentMessage;
