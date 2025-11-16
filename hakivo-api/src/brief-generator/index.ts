import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

export default class extends Each<Body, Env> {
  async process(message: Message<Body>): Promise<void> {
    const { briefId, userId, type, startDate, endDate } = message.body;

    console.log(`🎙️ Processing brief generation: ${briefId} (${type})`);

    try {
      const db = this.env.APP_DB;

      // Update status to processing
      await db
        .prepare('UPDATE briefs SET status = ? WHERE id = ?')
        .bind('processing', briefId)
        .run();

      // Step 1: Fetch relevant bills based on user's tracked bills and date range
      const trackedBills = await this.getTrackedBills(userId, startDate, endDate);

      if (trackedBills.length === 0) {
        console.log(`⚠️ No tracked bills found for brief ${briefId}`);
        await db
          .prepare('UPDATE briefs SET status = ? WHERE id = ?')
          .bind('failed', briefId)
          .run();
        return;
      }

      console.log(`✓ Found ${trackedBills.length} tracked bills with activity`);

      // Step 2: Fetch news articles for each bill using Exa
      const newsArticles = await this.fetchNewsArticles(trackedBills);
      console.log(`✓ Fetched ${newsArticles.length} news articles`);

      // Step 3: Generate script using Claude
      const script = await this.generateScript(type, trackedBills, newsArticles);
      console.log(`✓ Generated script: ${script.length} characters`);

      // Step 4: Generate audio using ElevenLabs
      const audioData = await this.generateAudio(script);
      console.log(`✓ Generated audio: ${audioData.byteLength} bytes`);

      // Step 5: Upload audio to SmartBucket
      const audioKey = `${briefId}.mp3`;
      await this.env.AUDIO_BRIEFS.put(audioKey, audioData, {
        httpMetadata: {
          contentType: 'audio/mpeg'
        },
        customMetadata: {
          briefId,
          userId,
          type,
          createdAt: new Date().toISOString()
        }
      });

      console.log(`✓ Uploaded audio to SmartBucket: ${audioKey}`);

      // Step 6: Update brief record with completion data
      await db
        .prepare(`
          UPDATE briefs
          SET status = ?, audio_url = ?, duration = ?, completed_at = ?
          WHERE id = ?
        `)
        .bind('completed', audioKey, audioData.byteLength, Date.now(), briefId)
        .run();

      console.log(`✅ Brief generation completed: ${briefId}`);
    } catch (error) {
      console.error(`❌ Brief generation failed for ${briefId}:`, error);

      // Mark as failed
      await this.env.APP_DB
        .prepare('UPDATE briefs SET status = ? WHERE id = ?')
        .bind('failed', briefId)
        .run();
    }
  }

  /**
   * Get tracked bills with recent activity in date range
   */
  private async getTrackedBills(userId: string, startDate: string, endDate: string): Promise<any[]> {
    const db = this.env.APP_DB;

    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp = new Date(endDate).getTime();

    const result = await db
      .prepare(`
        SELECT DISTINCT
          b.id,
          b.congress_id,
          b.bill_type,
          b.bill_number,
          b.title,
          b.latest_action_date,
          b.latest_action_text,
          b.sponsor_bioguide_id,
          m.first_name,
          m.last_name,
          m.party,
          m.state
        FROM bill_tracking bt
        INNER JOIN bills b ON bt.bill_id = b.id
        LEFT JOIN members m ON b.sponsor_bioguide_id = m.bioguide_id
        WHERE bt.user_id = ?
          AND b.latest_action_date >= ?
          AND b.latest_action_date <= ?
        ORDER BY b.latest_action_date DESC
        LIMIT 10
      `)
      .bind(userId, startTimestamp, endTimestamp)
      .all();

    return result.results || [];
  }

  /**
   * Fetch news articles for bills using Exa
   */
  private async fetchNewsArticles(bills: any[]): Promise<any[]> {
    const articles: any[] = [];

    // Collect policy topics from bills
    const interests = bills.map((bill: any) => bill.title).slice(0, 5);

    // Calculate date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    try {
      const searchResults = await this.env.EXA_CLIENT.searchNews(
        interests,
        startDate,
        endDate,
        10 // limit
      );

      return searchResults;
    } catch (error) {
      console.error('Failed to fetch news articles:', error);
      return [];
    }
  }

  /**
   * Generate brief script using Claude
   */
  private async generateScript(type: string, bills: any[], newsArticles: any[]): Promise<string> {
    const billsSummary = bills.map((bill: any) =>
      `- ${String(bill.bill_type).toUpperCase()} ${bill.bill_number}: ${bill.title}\n  Latest: ${bill.latest_action_text}\n  Sponsor: ${bill.first_name} ${bill.last_name} (${bill.party}-${bill.state})`
    ).join('\n\n');

    const newsSummary = newsArticles.map((article: any) =>
      `- ${article.title}\n  Summary: ${article.summary}\n  Source: ${article.url}`
    ).join('\n\n');

    const systemPrompt = `You are a professional podcast scriptwriter specializing in legislative briefings.
Write in a conversational, NPR-style tone suitable for audio narration.
Format scripts in dialogue format for two hosts (HOST A and HOST B).`;

    const userPrompt = `Generate a ${type} audio briefing script for legislative updates.

Bills with Recent Activity:
${billsSummary}

Related News Articles:
${newsSummary || 'No recent news articles found.'}

Requirements:
- 2-3 minutes of content when read aloud
- Start with a brief intro
- Cover 3-5 most important bills
- Include relevant news context
- End with a brief summary
- Use natural transitions between topics
- Format as HOST A: / HOST B: dialogue

Provide the script in dialogue format.`;

    const result = await this.env.CLAUDE_CLIENT.generateCompletion(
      systemPrompt,
      userPrompt,
      2000,
      0.7
    );

    return result.content;
  }

  /**
   * Generate audio using ElevenLabs
   */
  private async generateAudio(script: string): Promise<Uint8Array> {
    // For briefs, we use a single narrator voice instead of dialogue
    // If dialogue format is needed, use synthesizeDialogue
    const result = await this.env.ELEVENLABS_CLIENT.synthesizeDialogue(script);

    return result.audioBuffer;
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
