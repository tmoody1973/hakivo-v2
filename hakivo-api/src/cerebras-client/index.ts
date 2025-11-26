import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import Cerebras from '@cerebras/cerebras_cloud_sdk';

export default class extends Service<Env> {
  private cerebras: Cerebras | null = null;

  /**
   * Initialize Cerebras client
   */
  private getCerebrasClient(): Cerebras {
    if (!this.cerebras) {
      const apiKey = this.env.CEREBRAS_API_KEY;

      if (!apiKey) {
        throw new Error('CEREBRAS_API_KEY environment variable is not set');
      }

      this.cerebras = new Cerebras({
        apiKey
      });
    }

    return this.cerebras;
  }

  /**
   * Generate chat completion (non-streaming)
   * Used for chat-service RAG responses
   *
   * @param messages - Chat messages
   * @param temperature - Sampling temperature (0-2, default: 0.7)
   * @param maxTokens - Max completion tokens (default: 1024)
   * @returns Generated response text
   */
  async generateCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    temperature: number = 0.7,
    maxTokens: number = 1024
  ): Promise<{ content: string; tokensUsed: number }> {
    const client = this.getCerebrasClient();

    const response = await client.chat.completions.create({
      messages,
      model: 'gpt-oss-120b',
      stream: false,
      max_completion_tokens: maxTokens,
      temperature,
      top_p: 1
    });

    const choice = (response.choices as any[])[0];
    const content = choice?.message?.content || '';
    const usage = response.usage as { total_tokens?: number } | undefined;
    const tokensUsed = usage?.total_tokens || 0;

    console.log(`✓ Cerebras completion: ${tokensUsed} tokens used`);

    return {
      content,
      tokensUsed
    };
  }

  /**
   * Generate streaming chat completion
   * Used for real-time chat responses in chat-service
   *
   * @param messages - Chat messages
   * @param temperature - Sampling temperature (0-2, default: 0.7)
   * @param maxTokens - Max completion tokens (default: 1024)
   * @returns Async iterator of content chunks
   */
  async *generateStreamingCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    temperature: number = 0.7,
    maxTokens: number = 1024
  ): AsyncGenerator<string, void, unknown> {
    const client = this.getCerebrasClient();

    const stream = await client.chat.completions.create({
      messages,
      model: 'gpt-oss-120b',
      stream: true,
      max_completion_tokens: maxTokens,
      temperature,
      top_p: 1
    });

    for await (const chunk of stream) {
      const choice = (chunk.choices as any[])[0];
      const content = choice?.delta?.content || '';
      if (content) {
        yield content;
      }
    }
  }

  /**
   * Generate RAG-based answer from bill text chunks
   * Optimized for chat-service bill Q&A
   *
   * @param question - User question
   * @param context - Bill text chunks from SmartBucket
   * @param billTitle - Bill title for context
   * @returns Generated answer
   */
  async generateBillAnswer(
    question: string,
    context: string,
    billTitle: string
  ): Promise<{ answer: string; tokensUsed: number }> {
    const messages = [
      {
        role: 'system' as const,
        content: `You are a helpful assistant answering questions about US Congressional bills.
You will be provided with relevant sections from a bill and a user question.
Answer concisely and accurately based only on the provided context.
If the context doesn't contain enough information to answer the question, say so.
Always cite specific sections or provisions when possible.`
      },
      {
        role: 'user' as const,
        content: `Bill: ${billTitle}

Context from bill:
${context}

Question: ${question}`
      }
    ];

    const result = await this.generateCompletion(messages, 0.3, 512);
    return {
      answer: result.content,
      tokensUsed: result.tokensUsed
    };
  }

  /**
   * Generate summary of multiple bills for dashboard
   *
   * @param bills - Array of bill data with title, summary, and latest action
   * @returns Aggregated summary
   */
  async generateBillsSummary(
    bills: Array<{ title: string; summary: string; latestAction: string }>
  ): Promise<{ summary: string; tokensUsed: number }> {
    const billsText = bills.map((bill, i) =>
      `${i + 1}. ${bill.title}\n   Latest: ${bill.latestAction}\n   ${bill.summary}`
    ).join('\n\n');

    const messages = [
      {
        role: 'system' as const,
        content: 'You are a congressional analyst. Provide a concise summary of recent bill activity, highlighting key themes and important developments.'
      },
      {
        role: 'user' as const,
        content: `Summarize these recent bills:\n\n${billsText}`
      }
    ];

    const result = await this.generateCompletion(messages, 0.5, 256);
    return {
      summary: result.content,
      tokensUsed: result.tokensUsed
    };
  }

  /**
   * Generate comprehensive AI analysis for bill detail page
   * Provides structured analysis with what it does, who it affects, key provisions, and potential impact
   *
   * @param billTitle - Full bill title
   * @param billText - Full bill text or summary
   * @param billNumber - Bill number (e.g., "HR 1234")
   * @returns Structured analysis
   */
  async generateBillAnalysis(
    billTitle: string,
    billText: string,
    billNumber: string
  ): Promise<{
    whatItDoes: string;
    whoItAffects: string[];
    keyProvisions: string[];
    potentialBenefits: string[];
    potentialConcerns: string[];
    tokensUsed: number;
  }> {
    const messages = [
      {
        role: 'system' as const,
        content: `You are a legislative analyst providing clear, objective analysis of Congressional bills.
Analyze the bill and provide:
1. A plain-language summary of what the bill does (2-3 sentences)
2. A list of stakeholder groups affected (3-5 groups)
3. Key provisions as bullet points (3-5 provisions)
4. Potential benefits (2-4 benefits with brief explanations)
5. Potential concerns (2-4 concerns with brief explanations)

Format your response as JSON with this exact structure:
{
  "whatItDoes": "string",
  "whoItAffects": ["string", "string", ...],
  "keyProvisions": ["string", "string", ...],
  "potentialBenefits": ["string", "string", ...],
  "potentialConcerns": ["string", "string", ...]
}

Be objective and balanced. Present both benefits and concerns fairly.`
      },
      {
        role: 'user' as const,
        content: `Analyze ${billNumber}: ${billTitle}

Bill Text:
${billText.slice(0, 8000)}

Provide a structured analysis in JSON format.`
      }
    ];

    const result = await this.generateCompletion(messages, 0.4, 2048);

    try {
      // Extract JSON from response (handles cases where LLM adds markdown formatting)
      let jsonText = result.content.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/, '').replace(/```$/, '').trim();
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(jsonText);

      return {
        whatItDoes: parsed.whatItDoes || 'Analysis not available',
        whoItAffects: Array.isArray(parsed.whoItAffects) ? parsed.whoItAffects : [],
        keyProvisions: Array.isArray(parsed.keyProvisions) ? parsed.keyProvisions : [],
        potentialBenefits: Array.isArray(parsed.potentialBenefits) ? parsed.potentialBenefits : [],
        potentialConcerns: Array.isArray(parsed.potentialConcerns) ? parsed.potentialConcerns : [],
        tokensUsed: result.tokensUsed
      };
    } catch (error) {
      console.error('Failed to parse bill analysis JSON:', error);
      console.error('Raw response:', result.content);

      // Fallback to empty analysis
      return {
        whatItDoes: 'Unable to generate analysis at this time.',
        whoItAffects: [],
        keyProvisions: [],
        potentialBenefits: [],
        potentialConcerns: [],
        tokensUsed: result.tokensUsed
      };
    }
  }

  /**
   * Categorize news article using AI semantic understanding
   * Replaces keyword-based categorization with accurate semantic classification
   *
   * @mcp-tool
   * @mcp-description Categorize news article into correct policy interest using semantic understanding
   * @mcp-param title - Article title
   * @mcp-param summary - Article summary from Exa.ai
   * @mcp-param availableCategories - List of valid policy interest categories
   * @mcp-returns AI-determined category name
   * @mcp-cost ~$0.0001 per article (Cerebras gpt-oss-120b)
   *
   * @example
   * ```ts
   * const category = await cerebrasClient.categorizeNewsArticle(
   *   "Latest on Epstein files as Trump changes course",
   *   "President Trump is urging House Republicans to support release of files...",
   *   ["Civil Rights & Law", "Commerce & Labor", "Government & Politics"]
   * );
   * // Returns: "Civil Rights & Law"
   * ```
   */
  async categorizeNewsArticle(
    title: string,
    summary: string,
    availableCategories: string[]
  ): Promise<{ category: string; tokensUsed: number }> {
    const categoriesText = availableCategories.map((c, i) => `${i + 1}. ${c}`).join('\n');

    const messages = [
      {
        role: 'system' as const,
        content: `You are a news categorization expert. Analyze the article and determine which ONE policy interest category it belongs to based on its PRIMARY topic.

Ignore tangential keyword mentions - focus on what the article is ACTUALLY about.

Available categories:
${categoriesText}

Return your response as JSON with this exact structure:
{
  "category": "Category Name",
  "reasoning": "Brief explanation"
}`
      },
      {
        role: 'user' as const,
        content: `Categorize this news article:

Title: ${title}
Summary: ${summary}

Return JSON with the category name (must exactly match one from the list).`
      }
    ];

    const result = await this.generateCompletion(messages, 0.2, 150);

    try {
      // Extract JSON from response
      let jsonText = result.content.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/, '').replace(/```$/, '').trim();
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(jsonText);
      const category = parsed.category || parsed.Category || availableCategories[0];

      // Validate category is in available list
      if (!availableCategories.includes(category)) {
        console.warn(`AI returned invalid category: ${category}, using first available`);
        return {
          category: availableCategories[0]!,
          tokensUsed: result.tokensUsed
        };
      }

      return {
        category,
        tokensUsed: result.tokensUsed
      };
    } catch (error) {
      console.error('Failed to parse categorization JSON:', error);
      console.error('Raw response:', result.content);

      // Fallback: return first category
      return {
        category: availableCategories[0]!,
        tokensUsed: result.tokensUsed
      };
    }
  }

  /**
   * Calculate Levenshtein distance between two strings
   * Used for Stage 1 fast string similarity filtering
   *
   * @private
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0]![j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j]! + 1,        // deletion
          matrix[i]![j - 1]! + 1,        // insertion
          matrix[i - 1]![j - 1]! + cost  // substitution
        );
      }
    }

    return matrix[len1]![len2]!;
  }

  /**
   * Calculate similarity percentage between two strings (0-100)
   * Uses normalized Levenshtein distance
   *
   * @private
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 100; // Both empty = identical

    const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    const similarity = ((maxLen - distance) / maxLen) * 100;
    return similarity;
  }

  /**
   * Compare two articles for semantic duplicate detection
   * Stage 2 (Accurate) - Uses Cerebras LLM for semantic verification
   *
   * @private
   */
  private async compareArticlesForDuplicates(
    article1: { title: string; summary: string },
    article2: { title: string; summary: string }
  ): Promise<{ isDuplicate: boolean; confidence: number }> {
    const messages = [
      {
        role: 'system' as const,
        content: `You are a news deduplication expert. Compare these two news articles and determine if they cover the SAME underlying story (even if from different sources, angles, or publication dates).

Two articles are duplicates if they report on the same event, development, or news story - even if the headlines or specific details differ.

Return your response as JSON with this exact structure:
{
  "is_duplicate": true/false,
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}`
      },
      {
        role: 'user' as const,
        content: `Article 1:
Title: ${article1.title}
Summary: ${article1.summary}

Article 2:
Title: ${article2.title}
Summary: ${article2.summary}

Determine if these articles cover the SAME news story. Return JSON.`
      }
    ];

    const result = await this.generateCompletion(messages, 0.2, 200);

    try {
      // Extract JSON from response
      let jsonText = result.content.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/, '').replace(/```$/, '').trim();
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(jsonText);

      return {
        isDuplicate: parsed.is_duplicate || parsed.isDuplicate || false,
        confidence: parsed.confidence || 0
      };
    } catch (error) {
      console.error('Failed to parse deduplication JSON:', error);
      console.error('Raw response:', result.content);

      // Conservative fallback: assume not duplicate on error
      return {
        isDuplicate: false,
        confidence: 0
      };
    }
  }

  /**
   * Deduplicate news articles using two-stage approach
   * Adapted from Exa's websets-news-monitor pattern
   *
   * Stage 1 (Fast): String similarity filtering on titles (>70% similarity)
   * Stage 2 (Accurate): Cerebras semantic verification for likely duplicates
   *
   * @param articles - Articles to deduplicate (should all be from same category)
   * @returns Array of unique article IDs to keep, duplicate groups, and stats
   *
   * @example
   * ```ts
   * const result = await cerebrasClient.deduplicateArticles([
   *   { id: '1', title: 'Trump urges release of Epstein files', summary: '...', score: 0.95 },
   *   { id: '2', title: 'President pushes for Epstein documents', summary: '...', score: 0.88 },
   *   { id: '3', title: 'Senate passes climate bill', summary: '...', score: 0.92 }
   * ]);
   * // Returns: uniqueArticleIds: ['1', '3'], duplicatesRemoved: 1
   * ```
   */
  async deduplicateArticles(
    articles: Array<{
      id: string;
      title: string;
      summary: string;
      score: number; // Exa score
    }>
  ): Promise<{
    uniqueArticleIds: string[];
    duplicateGroups: Array<{
      kept: string;
      removed: string[];
      reason: string;
    }>;
    stats: {
      totalArticles: number;
      stage1Candidates: number;
      stage2Verified: number;
      duplicatesRemoved: number;
    };
  }> {
    const SIMILARITY_THRESHOLD = 70; // 70% title similarity triggers Stage 2
    const MAX_CANDIDATES_PER_ARTICLE = 10; // Limit comparisons to top 10 similar

    console.log(`🔍 Deduplication: Processing ${articles.length} articles`);

    if (articles.length === 0) {
      return {
        uniqueArticleIds: [],
        duplicateGroups: [],
        stats: {
          totalArticles: 0,
          stage1Candidates: 0,
          stage2Verified: 0,
          duplicatesRemoved: 0
        }
      };
    }

    // Track which articles are duplicates
    const duplicateMap = new Map<string, string>(); // duplicate ID -> kept ID
    const duplicateGroups: Array<{ kept: string; removed: string[]; reason: string }> = [];

    let stage1Candidates = 0;
    let stage2Verified = 0;

    // STAGE 1: Fast string similarity filtering
    for (let i = 0; i < articles.length; i++) {
      const article1 = articles[i]!;

      // Skip if already marked as duplicate
      if (duplicateMap.has(article1.id)) continue;

      const candidates: Array<{ article: typeof article1; similarity: number; index: number }> = [];

      // Compare with all subsequent articles
      for (let j = i + 1; j < articles.length; j++) {
        const article2 = articles[j]!;

        // Skip if already marked as duplicate
        if (duplicateMap.has(article2.id)) continue;

        const similarity = this.calculateSimilarity(article1.title, article2.title);

        if (similarity >= SIMILARITY_THRESHOLD) {
          candidates.push({ article: article2, similarity, index: j });
        }
      }

      if (candidates.length === 0) continue;

      // Sort by similarity and take top candidates
      candidates.sort((a, b) => b.similarity - a.similarity);
      const topCandidates = candidates.slice(0, MAX_CANDIDATES_PER_ARTICLE);

      stage1Candidates += topCandidates.length;

      // STAGE 2: Cerebras semantic verification for each candidate
      const duplicatesInGroup: string[] = [];

      for (const candidate of topCandidates) {
        const comparison = await this.compareArticlesForDuplicates(
          { title: article1.title, summary: article1.summary },
          { title: candidate.article.title, summary: candidate.article.summary }
        );

        stage2Verified++;

        if (comparison.isDuplicate && comparison.confidence > 0.7) {
          // Keep the article with highest Exa score
          const kept = article1.score >= candidate.article.score ? article1 : candidate.article;
          const removed = article1.score >= candidate.article.score ? candidate.article : article1;

          duplicateMap.set(removed.id, kept.id);
          duplicatesInGroup.push(removed.id);

          console.log(`  ✓ Duplicate: "${removed.title.slice(0, 40)}..." (${(comparison.confidence * 100).toFixed(0)}%)`);
        }
      }

      if (duplicatesInGroup.length > 0) {
        duplicateGroups.push({
          kept: article1.id,
          removed: duplicatesInGroup,
          reason: `${duplicatesInGroup.length} duplicate(s) with semantic match`
        });
      }
    }

    // Get unique article IDs (exclude duplicates)
    const uniqueArticleIds = articles
      .filter(article => !duplicateMap.has(article.id))
      .map(article => article.id);

    const stats = {
      totalArticles: articles.length,
      stage1Candidates,
      stage2Verified,
      duplicatesRemoved: duplicateMap.size
    };

    console.log(`  📊 Stage 1: ${stage1Candidates} candidate pairs (>70% similarity)`);
    console.log(`  📊 Stage 2: ${stage2Verified} LLM verifications`);
    console.log(`  ✅ Result: ${stats.duplicatesRemoved} duplicates removed, ${uniqueArticleIds.length} unique`);

    return {
      uniqueArticleIds,
      duplicateGroups,
      stats
    };
  }

  /**
   * Required fetch method for Raindrop Service
   * This is a private service, so fetch returns 501 Not Implemented
   */
  async fetch(_request: Request): Promise<Response> {
    return new Response('Not Implemented - Private Service', { status: 501 });
  }
}
