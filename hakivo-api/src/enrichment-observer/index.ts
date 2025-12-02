import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { GoogleGenAI } from '@google/genai';

/**
 * Policy Analyst System Prompt
 * Clear, accessible legislative analysis for everyday citizens
 */
const POLICY_ANALYST_PROMPT = `You are explaining a bill to everyday Americans. Use simple, clear language that anyone can understand - like explaining it to a friend over coffee.

Writing Guidelines:
- Use simple words: Say "people" not "stakeholders", "cost" not "fiscal impact"
- Short sentences: Keep them under 20 words when possible
- No jargon: Avoid legal terms, acronyms, and technical language
- Be neutral: Just the facts, no political spin
- Be specific: Use real examples and concrete details

What to Explain:
1. What It Does
   - In 2-3 simple sentences, what does this bill change?
   - Focus on the practical impact on people's lives

2. Current Situation vs. If This Passes
   - How things work now
   - How they would change
   - Keep it concrete and relatable

3. How It Works
   - Explain the main steps in simple terms
   - Who does what
   - When changes would happen

4. Who's Affected
   - List the main groups of people impacted
   - Explain clearly how it affects them
   - Use everyday language

5. Potential Benefits
   - What good things could happen
   - Be specific about who benefits and how
   - Use plain language

6. Potential Concerns
   - What problems could arise
   - Be specific about the concerns
   - Explain clearly without drama

7. Challenges to Make It Work
   - What practical problems might come up
   - What would be needed to implement this
   - Keep it understandable

8. Likelihood of Passing
   - Based on current politics, what are the chances?
   - What factors matter most
   - Simple percentage with brief explanation

Remember: Explain like you're talking to your neighbor, not writing a legal brief. Clear, simple, and helpful.`;

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
        case 'deep_analysis_state_bill':
          await this.deepAnalyzeStateBill(message.body);
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

      // Get bill text from database (already stored in bills.text column)
      const billText = (bill.text as string) || '';

      // Generate analysis using Cerebras (faster and cheaper than Gemini)
      const billType = String(bill.bill_type || '').toUpperCase();
      const billNum = bill.bill_number as number;
      const billNumber = `${billType} ${billNum}`;
      const billTitle = String(bill.title || '');

      // Use first 8000 characters of bill text (matches Cerebras client limit)
      const textToAnalyze = billText.slice(0, 8000);

      console.log(`  Calling Cerebras for bill analysis...`);

      // Use fetch instead of SDK for Cloudflare Workers compatibility
      const cerebraResponse = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.CEREBRAS_API_KEY}`
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are explaining a Congressional bill to everyday citizens in simple, clear language.

Write like you're talking to a friend:
- Use simple words and short sentences
- Avoid legal jargon and acronyms
- Be specific and concrete
- Stay neutral and factual

Provide:
1. What this bill does (2-3 simple sentences starting with "This bill would...")
2. Who's affected (3-5 groups in plain language - "people with student loans" not "student loan borrowers")
3. Main changes (3-5 clear points about what actually changes)
4. Potential benefits (2-4 good things that could happen, explained simply)
5. Potential concerns (2-4 problems that might arise, explained simply)

Format your response as JSON with this exact structure:
{
  "whatItDoes": "string (simple, conversational explanation)",
  "whoItAffects": ["string (everyday language)", "string", ...],
  "keyProvisions": ["string (what changes in plain terms)", "string", ...],
  "potentialBenefits": ["string (clear benefit)", "string", ...],
  "potentialConcerns": ["string (clear concern)", "string", ...]
}

Be fair and balanced. Explain both sides clearly without political spin.`
            },
            {
              role: 'user',
              content: `Analyze ${billNumber}: ${billTitle}

Bill Text:
${textToAnalyze}

Provide a structured analysis in JSON format.`
            }
          ],
          model: 'gpt-oss-120b',
          stream: false,
          max_completion_tokens: 2048,
          temperature: 0.4,
          top_p: 1
        })
      });

      if (!cerebraResponse.ok) {
        const errorText = await cerebraResponse.text();
        throw new Error(`Cerebras API error (${cerebraResponse.status}): ${errorText}`);
      }

      const cerebraData = await cerebraResponse.json() as {
        choices: Array<{ message: { content: string } }>;
        usage?: { total_tokens?: number };
      };

      const choice = cerebraData.choices[0];
      const responseText = choice?.message?.content || '';
      const usage = cerebraData.usage;
      const tokensUsed = usage?.total_tokens || 0;

      console.log(`  ✓ Cerebras analysis complete (${tokensUsed} tokens)`);

      // Parse JSON response
      let analysis: any;
      try {
        // Extract JSON from response (handles cases where LLM adds markdown formatting)
        let jsonText = responseText.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/```json\n?/, '').replace(/```$/, '').trim();
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```\n?/, '').replace(/```$/, '').trim();
        }

        analysis = JSON.parse(jsonText);
      } catch (error) {
        console.warn('  Failed to parse Cerebras JSON, using fallback');
        analysis = {
          whatItDoes: responseText.substring(0, 300),
          whoItAffects: [],
          keyProvisions: [],
          potentialBenefits: [],
          potentialConcerns: []
        };
      }

      const summary = analysis.whatItDoes || '';

      // Use structured key provisions from Cerebras analysis
      const keyPoints = analysis.keyProvisions || this.extractKeyPoints(summary);

      // Determine impact level (billTitle already declared above)
      const impactLevel = this.determineImpactLevel(billTitle, summary);

      // Calculate bipartisan score (placeholder - would need cosponsor data)
      const bipartisanScore = await this.calculateBipartisanScore(message.bill_id);

      // Determine current stage and progress
      const latestAction = bill.latest_action_text as string | null;
      const { stage, progress } = this.determineBillStage(latestAction);

      // Combine tags from policy area and who it affects
      const billTags = this.extractBillTags(bill, summary);
      const whoAffects = analysis.whoItAffects || [];
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
          'cerebras-gpt-oss-120b',
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
   * Deep analysis of a bill with Cerebras
   * Comprehensive forensic analysis for bill detail pages
   */
  private async deepAnalyzeBill(message: DeepAnalysisBillMessage): Promise<void> {
    console.log(`🔬 Deep analyzing bill: ${message.bill_id}`);

    const db = this.env.APP_DB;
    const startTime = Date.now();

    try {
      // Mark as processing
      await db
        .prepare(`
          INSERT OR REPLACE INTO bill_analysis (bill_id, status, started_at, analyzed_at, executive_summary)
          VALUES (?, 'processing', ?, ?, 'Analysis in progress...')
        `)
        .bind(message.bill_id, startTime, startTime)
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

      // Use Cerebras for faster, more cost-effective deep analysis
      const billTypeStr = String(bill.bill_type || '').toUpperCase();
      const billNumStr = bill.bill_number as number;

      console.log(`  Calling Cerebras for deep analysis...`);

      const analysisPrompt = `${POLICY_ANALYST_PROMPT}

Explain this bill to engaged citizens who want to understand what's really going on:

Bill: ${billTypeStr}${billNumStr} - ${bill.congress}th Congress
Title: ${bill.title}
Latest Action: ${bill.latest_action_text || 'None'}
${billText ? `\nFull Text:\n${billText.substring(0, 50000)}` : ''}

Write your analysis like you're explaining it to a friend. Use these guidelines:

1. **Executive Summary** (4-6 sentences for comprehensive context)
   - Start with the main point: "This bill would..."
   - Explain WHY this matters - what problem does it solve?
   - Add a concrete comparison or relatable example (like "roughly the cost of X")
   - Mention who this helps and who it might concern
   - Use everyday language - write like you're texting a friend
   - Avoid legal jargon completely

2. **Current Situation vs. If This Passes**
   - How things work NOW (in simple terms)
   - What CHANGES if this passes
   - Use concrete examples people can relate to

3. **Main Sections** (5-8 key provisions if full text available)
   - Break down the bill into easy-to-understand parts
   - For EACH section, explain:
     * What it changes (the action)
     * Why it matters (the impact)
     * Add context or examples when helpful (like "This hasn't changed since 1994")
   - Focus on what each section DOES, not legal language
   - Use relatable comparisons and real-world scenarios
   - Make each point comprehensive but still conversational

4. **How It Actually Works**
   - Explain the process step-by-step
   - Who's responsible for doing what
   - When changes would happen (timelines in plain terms)

5. **Government Agency Changes**
   - Which agencies get new powers or responsibilities
   - What they can now do (or can't do anymore)
   - Explain in concrete terms

6. **Cost and Funding**
   - How much money is involved (use relatable comparisons)
   - Where the money comes from
   - Timeline for spending
   - Keep numbers accessible (e.g., "about $50 per person" vs "$17.5 billion")

7. **Who's Affected and How**
   - List specific groups of people
   - Explain clearly how their lives would change
   - Use real-world scenarios
   - Be specific about winners and losers

8. **Possible Unintended Effects**
   - What unexpected things might happen
   - Secondary consequences to watch for
   - Explain in terms of real-world scenarios

9. **Why People Support This**
   - Strongest arguments FOR the bill
   - What problems it's trying to solve
   - Real benefits people could see
   - Be fair and clear

10. **Why People Oppose This**
    - Strongest arguments AGAINST the bill
    - Legitimate concerns and risks
    - What critics worry about
    - Be fair and clear

11. **Practical Challenges**
    - What would be hard to actually implement
    - What resources or changes are needed
    - Potential roadblocks
    - Keep it concrete

12. **Will It Pass?** (give a percentage 0-100)
    - Current political situation
    - What factors will decide it
    - Brief, clear explanation of your reasoning

13. **State-Specific Impact** (if relevant)
    - Which states are most affected
    - How impacts vary by location
    - Use specific examples

Return the analysis as a JSON object with these fields (use snake_case):
{
  "executive_summary": "string (4-6 comprehensive sentences starting with 'This bill would...'. Include WHY it matters, WHO it affects, and use a relatable comparison. Example: 'This bill would double the payment that bankruptcy trustees get for each Chapter 7 case, from $60 to $120. Right now, trustees only get $60 per case, a number that hasn't moved since 1994. This costs about $45 million extra each year – roughly the cost of a new car for every person in a small town of 10,000. It helps trustees keep up with inflation while keeping the bankruptcy system running without taxpayer money.')",
  "status_quo_vs_change": "string (explain current vs. future in simple, detailed terms with context)",
  "section_breakdown": ["array of 5-8 comprehensive provision explanations. Each should explain WHAT changes, WHY it matters, and add helpful context. Example: 'Section 3: Raises trustee pay from $60 to $120 per Chapter 7 case. This is the first raise since 1994 - if it had kept up with inflation, it would be over $125 today. The extra money helps trustees cover their costs and stay motivated to handle cases quickly.'"],
  "mechanism_of_action": "string (detailed step-by-step how it works in plain language)",
  "agency_powers": ["array of specific powers in plain language with context"],
  "fiscal_impact": {
    "estimatedCost": "string (use relatable comparisons like 'about $45 million extra each year – roughly the cost of a new car for every person in a small town of 10,000')",
    "fundingSource": "string (where money comes from, explained simply)",
    "timeframe": "string (when spending happens)"
  },
  "stakeholder_impact": {
    "group_name": "clear, comprehensive explanation of how they're affected and why it matters"
  },
  "unintended_consequences": ["array of possible unexpected effects with explanations"],
  "arguments_for": ["array of 3-5 strongest supporting arguments, each 1-2 sentences explaining the benefit clearly"],
  "arguments_against": ["array of 3-5 strongest opposing arguments, each 1-2 sentences explaining the concern clearly"],
  "implementation_challenges": ["array of practical obstacles with context"],
  "passage_likelihood": number (0-100),
  "passage_reasoning": "string (clear explanation with current political context)",
  "state_impacts": {
    "state_name": "specific impact on that state with examples"
  }
}

Remember: Write like you're talking to a friend, not writing a government report. Clear, simple, and practical.`;

      // Use fetch instead of SDK for Cloudflare Workers compatibility
      const cerebraResponse = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.CEREBRAS_API_KEY}`
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a neutral policy analyst conducting comprehensive forensic legislative analysis. Respond only with valid JSON.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          model: 'gpt-oss-120b',
          stream: false,
          max_completion_tokens: 4096,
          temperature: 0.3,
          top_p: 1
        })
      });

      if (!cerebraResponse.ok) {
        const errorText = await cerebraResponse.text();
        throw new Error(`Cerebras API error (${cerebraResponse.status}): ${errorText}`);
      }

      const cerebraData = await cerebraResponse.json() as {
        choices: Array<{ message: { content: string } }>;
        usage?: { total_tokens?: number };
      };

      const choice = cerebraData.choices[0];
      const analysisText = choice?.message?.content || '';
      const usage = cerebraData.usage;
      const tokensUsed = usage?.total_tokens || 0;

      console.log(`  ✓ Cerebras deep analysis complete (${tokensUsed} tokens)`);

      // Parse JSON response
      let analysis: any;
      try {
        // Extract JSON from response (handles cases where LLM adds markdown formatting)
        let jsonText = analysisText.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/```json\n?/, '').replace(/```$/, '').trim();
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```\n?/, '').replace(/```$/, '').trim();
        }

        analysis = JSON.parse(jsonText);
      } catch (error) {
        console.error('  Failed to parse Cerebras response as JSON, using raw text');
        analysis = {
          executive_summary: analysisText.substring(0, 500),
          status_quo_vs_change: 'Analysis failed to parse',
          mechanism_of_action: '',
          passage_likelihood: 50,
          passage_reasoning: 'Unable to determine'
        };
      }

      // No thinking summary for Cerebras
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
          analysis.executive_summary || 'Analysis pending - executive summary not yet available',
          analysis.status_quo_vs_change || 'Not available',
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
          'cerebras-gpt-oss-120b',
          startTime,
          completedAt
        )
        .run();

      console.log(`  ✓ Deep analysis complete in ${completedAt - startTime}ms: ${analysis.executive_summary?.substring(0, 80)}...`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      console.error(`  ✗ Failed to deep analyze bill:`, errorMessage);
      console.error(`  Stack:`, errorStack);

      // Mark as failed with Cerebras model name and error details
      const failedAt = Date.now();
      await db
        .prepare(`
          INSERT OR REPLACE INTO bill_analysis (
            bill_id, status, model_used, started_at, analyzed_at,
            executive_summary
          ) VALUES (?, 'failed', 'cerebras-gpt-oss-120b', ?, ?, ?)
        `)
        .bind(
          message.bill_id,
          startTime,
          failedAt,
          `Error: ${errorMessage}`
        )
        .run().catch(() => {}); // Ignore errors on error handling
      throw error;
    }
  }

  /**
   * Deep analysis for STATE BILLS
   * Similar to deepAnalyzeBill but for state legislation
   */
  private async deepAnalyzeStateBill(message: DeepAnalysisStateBillMessage): Promise<void> {
    console.log(`🏛️ Deep analyzing state bill: ${message.bill_id}`);

    const db = this.env.APP_DB;
    const startTime = Date.now();

    try {
      // Mark as processing
      await db
        .prepare(`
          INSERT OR REPLACE INTO state_bill_analysis (bill_id, status, started_at, analyzed_at, executive_summary)
          VALUES (?, 'processing', ?, ?, 'Analysis in progress...')
        `)
        .bind(message.bill_id, startTime, startTime)
        .run();

      // Fetch state bill from database
      const bill = await db
        .prepare('SELECT * FROM state_bills WHERE id = ?')
        .bind(message.bill_id)
        .first() as any;

      if (!bill) {
        console.warn(`  State bill ${message.bill_id} not found`);
        await db
          .prepare(`UPDATE state_bill_analysis SET status = 'failed' WHERE bill_id = ?`)
          .bind(message.bill_id)
          .run().catch(() => {});
        return;
      }

      // Get bill text from database
      const billText = (bill.full_text as string) || '';
      const billAbstract = (bill.abstract as string) || '';
      const pdfUrl = bill.full_text_url && bill.full_text_format?.includes('pdf') ? bill.full_text_url : null;

      // Parse subjects
      let subjects: string[] = [];
      try {
        if (bill.subjects) {
          subjects = typeof bill.subjects === 'string' ? JSON.parse(bill.subjects) : bill.subjects;
        }
      } catch { /* ignore */ }

      // Build content for analysis
      let textSection = '';
      if (billText && billText.length >= 100) {
        textSection = `\nFull Text:\n${billText.substring(0, 50000)}`;
      } else if (billAbstract) {
        textSection = `\nAbstract:\n${billAbstract}`;
      }
      if (pdfUrl) {
        textSection += `\n\nNote: PDF version available at: ${pdfUrl}`;
      }

      // Use Cerebras for state bill analysis
      console.log(`  Calling Cerebras for state bill analysis...`);

      const analysisPrompt = `${POLICY_ANALYST_PROMPT}

Explain this STATE LEGISLATURE bill to engaged citizens who want to understand what's really going on:

Bill: ${bill.identifier} - ${bill.state} ${bill.session_identifier}
Title: ${bill.title}
Chamber: ${bill.chamber === 'lower' ? 'State House/Assembly' : bill.chamber === 'upper' ? 'State Senate' : bill.chamber || 'Unknown'}
Subjects: ${subjects.length > 0 ? subjects.join(', ') : 'Not specified'}
Latest Action: ${bill.latest_action_description || 'None'} (${bill.latest_action_date || 'No date'})
${textSection}

Write your analysis like you're explaining it to a friend. Use these guidelines:

1. **Executive Summary** (4-6 sentences for comprehensive context)
   - Start with the main point: "This bill would..."
   - Explain WHY this matters for the state - what problem does it solve?
   - Add a concrete comparison or relatable example
   - Mention who this helps and who it might concern
   - Use everyday language - write like you're texting a friend

2. **Current Situation vs. If This Passes**
   - How things work NOW in the state (in simple terms)
   - What CHANGES if this passes
   - Use concrete examples people can relate to

3. **Main Sections** (5-8 key provisions if full text available)
   - Break down the bill into easy-to-understand parts
   - For EACH section, explain what changes, why it matters, and add context
   - Focus on what each section DOES, not legal language

4. **How It Actually Works**
   - Explain the process step-by-step
   - Who's responsible for doing what
   - When changes would happen

5. **State Agency Changes**
   - Which state agencies get new powers or responsibilities
   - What they can now do (or can't do anymore)

6. **Cost and Funding**
   - How much money is involved (use relatable comparisons)
   - Where the money comes from (state budget, fees, federal funds)
   - Timeline for spending

7. **Who's Affected and How**
   - List specific groups of state residents
   - Explain clearly how their lives would change
   - Use real-world scenarios

8. **Possible Unintended Effects**
   - What unexpected things might happen in the state
   - Secondary consequences to watch for

9. **Why People Support This**
   - Strongest arguments FOR the bill
   - What problems it's trying to solve for the state

10. **Why People Oppose This**
    - Strongest arguments AGAINST the bill
    - Legitimate concerns and risks

11. **Practical Challenges**
    - What would be hard to actually implement
    - What resources or changes are needed

12. **Will It Pass?** (give a percentage 0-100)
    - Current political situation in the state legislature
    - What factors will decide it

Return the analysis as a JSON object with these fields (use snake_case):
{
  "executive_summary": "string (4-6 comprehensive sentences starting with 'This bill would...')",
  "status_quo_vs_change": "string (explain current vs. future in simple terms)",
  "section_breakdown": ["array of 5-8 comprehensive provision explanations"],
  "mechanism_of_action": "string (step-by-step how it works)",
  "agency_powers": ["array of specific state agency powers"],
  "fiscal_impact": {
    "estimatedCost": "string (use relatable comparisons)",
    "fundingSource": "string (state budget, fees, etc.)",
    "timeframe": "string"
  },
  "stakeholder_impact": {
    "group_name": "explanation of how they're affected"
  },
  "unintended_consequences": ["array of possible unexpected effects"],
  "arguments_for": ["array of 3-5 strongest supporting arguments"],
  "arguments_against": ["array of 3-5 strongest opposing arguments"],
  "implementation_challenges": ["array of practical obstacles"],
  "passage_likelihood": number (0-100),
  "passage_reasoning": "string (clear explanation with state political context)"
}

Remember: Write like you're talking to a friend, not writing a government report. Clear, simple, and practical.`;

      // Use fetch instead of SDK for Cloudflare Workers compatibility
      const cerebraResponse = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.CEREBRAS_API_KEY}`
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a neutral policy analyst conducting comprehensive state legislative analysis. Respond only with valid JSON.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          model: 'gpt-oss-120b',
          stream: false,
          max_completion_tokens: 4096,
          temperature: 0.3,
          top_p: 1
        })
      });

      if (!cerebraResponse.ok) {
        const errorText = await cerebraResponse.text();
        throw new Error(`Cerebras API error (${cerebraResponse.status}): ${errorText}`);
      }

      const cerebraData = await cerebraResponse.json() as {
        choices: Array<{ message: { content: string } }>;
        usage?: { total_tokens?: number };
      };

      const choice = cerebraData.choices[0];
      const analysisText = choice?.message?.content || '';
      const usage = cerebraData.usage;
      const tokensUsed = usage?.total_tokens || 0;

      console.log(`  ✓ Cerebras state bill analysis complete (${tokensUsed} tokens)`);

      // Parse JSON response
      let analysis: any;
      try {
        // Extract JSON from response
        let jsonText = analysisText.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/```json\n?/, '').replace(/```$/, '').trim();
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```\n?/, '').replace(/```$/, '').trim();
        }

        analysis = JSON.parse(jsonText);
      } catch (error) {
        console.error('  Failed to parse Cerebras response as JSON, using raw text');
        analysis = {
          executive_summary: analysisText.substring(0, 500),
          status_quo_vs_change: 'Analysis failed to parse',
          mechanism_of_action: '',
          passage_likelihood: 50,
          passage_reasoning: 'Unable to determine'
        };
      }

      const completedAt = Date.now();

      // Insert comprehensive analysis into state_bill_analysis table
      await db
        .prepare(`
          INSERT OR REPLACE INTO state_bill_analysis (
            bill_id, executive_summary, status_quo_vs_change,
            section_breakdown, mechanism_of_action, agency_powers,
            fiscal_impact, stakeholder_impact, unintended_consequences,
            arguments_for, arguments_against, implementation_challenges,
            passage_likelihood, passage_reasoning,
            thinking_summary, analyzed_at, model_used,
            status, started_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'complete', ?, ?)
        `)
        .bind(
          message.bill_id,
          analysis.executive_summary || 'Analysis pending - executive summary not yet available',
          analysis.status_quo_vs_change || 'Not available',
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
          null, // No thinking summary for Cerebras
          completedAt,
          'cerebras-gpt-oss-120b',
          startTime,
          completedAt
        )
        .run();

      console.log(`  ✓ State bill analysis complete in ${completedAt - startTime}ms: ${analysis.executive_summary?.substring(0, 80)}...`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      console.error(`  ✗ Failed to analyze state bill:`, errorMessage);
      console.error(`  Stack:`, errorStack);

      // Mark as failed
      const failedAt = Date.now();
      await db
        .prepare(`
          INSERT OR REPLACE INTO state_bill_analysis (
            bill_id, status, model_used, started_at, analyzed_at,
            executive_summary
          ) VALUES (?, 'failed', 'cerebras-gpt-oss-120b', ?, ?, ?)
        `)
        .bind(
          message.bill_id,
          startTime,
          failedAt,
          `Error: ${errorMessage}`
        )
        .run().catch(() => {});
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

export interface DeepAnalysisStateBillMessage {
  type: 'deep_analysis_state_bill';
  bill_id: string;
  timestamp: string;
}

export type EnrichmentMessage = EnrichNewsMessage | EnrichBillMessage | DeepAnalysisBillMessage | DeepAnalysisStateBillMessage;

// Export Body as alias for Raindrop framework
export type Body = EnrichmentMessage;
