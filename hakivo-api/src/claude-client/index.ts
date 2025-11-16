import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import Anthropic from '@anthropic-ai/sdk';

export default class extends Service<Env> {
  private anthropic: Anthropic | null = null;

  /**
   * Initialize Anthropic client
   */
  private getAnthropicClient(): Anthropic {
    if (!this.anthropic) {
      const apiKey = process.env.ANTHROPIC_API_KEY;

      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is not set');
      }

      this.anthropic = new Anthropic({
        apiKey
      });
    }

    return this.anthropic;
  }

  /**
   * Generate podcast script AND written article for audio brief
   * Used by brief-generator observer
   *
   * @param newsArticles - Array of news articles from Exa.ai
   * @param billUpdates - Array of tracked bill updates
   * @param userInterests - User's policy interests
   * @param briefType - 'daily' or 'weekly'
   * @returns Both podcast script and written article
   */
  async generateBriefContent(
    newsArticles: Array<{ title: string; summary: string; url: string }>,
    billUpdates: Array<{ title: string; latestAction: string; summary: string }>,
    userInterests: string[],
    briefType: 'daily' | 'weekly'
  ): Promise<{
    podcastScript: string;
    writtenArticle: string;
    tokensUsed: number;
    estimatedCost: number;
  }> {
    const client = this.getAnthropicClient();

    const duration = briefType === 'daily' ? '7-9 minutes' : '15-20 minutes';
    const newsCount = newsArticles.length;
    const billCount = billUpdates.length;

    const systemPrompt = `You are a professional podcast scriptwriter and political journalist specializing in Congressional affairs.

Your task is to create TWO outputs for a ${briefType} legislative briefing (${duration} audio length):

1. PODCAST SCRIPT - Conversational dialogue format for text-to-speech synthesis:
   - Natural, engaging tone suitable for audio
   - 2-host format (Host A and Host B having a conversation)
   - Clear speaker labels (HOST A: / HOST B:)
   - Include transitions, rhetorical questions, and conversational markers
   - Target ${duration} when read aloud (approximately ${briefType === 'daily' ? '1400-1800' : '3000-4000'} words)
   - Make complex legislation accessible through dialogue

2. WRITTEN ARTICLE - Formal written summary for reading:
   - Professional journalistic style
   - Well-structured with clear sections
   - Include bullet points for key provisions
   - Provide links and references
   - Approximately ${briefType === 'daily' ? '800-1000' : '1500-2000'} words

User's policy interests: ${userInterests.join(', ')}

Format your response as JSON:
{
  "podcastScript": "HOST A: Welcome to your ${briefType} legislative briefing...",
  "writtenArticle": "# ${briefType === 'daily' ? 'Daily' : 'Weekly'} Legislative Briefing\\n\\n## News Summary\\n..."
}`;

    const newsSection = newsArticles.map((article, i) =>
      `${i + 1}. ${article.title}\n   Summary: ${article.summary}\n   Source: ${article.url}`
    ).join('\n\n');

    const billsSection = billUpdates.map((bill, i) =>
      `${i + 1}. ${bill.title}\n   Latest Action: ${bill.latestAction}\n   Summary: ${bill.summary}`
    ).join('\n\n');

    const userPrompt = `Create a ${briefType} legislative briefing covering the following:

NEWS (${newsCount} articles):
${newsSection}

TRACKED BILL UPDATES (${billCount} bills):
${billsSection}

Generate both the podcast script and written article in JSON format.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: briefType === 'daily' ? 4096 : 8192,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    if (!response.content || response.content.length === 0) {
      throw new Error('No content in Claude response');
    }

    const content = response.content[0];
    if (!content || content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON response
    let jsonText = (content as any).text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/```$/, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(jsonText);

    // Calculate token usage and cost
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const tokensUsed = inputTokens + outputTokens;

    // Claude Sonnet 4.5 pricing: $3/MTok input, $15/MTok output
    const estimatedCost = (inputTokens / 1_000_000 * 3) + (outputTokens / 1_000_000 * 15);

    console.log(`✓ Claude brief generation: ${tokensUsed} tokens used ($${estimatedCost.toFixed(4)})`);

    return {
      podcastScript: parsed.podcastScript || '',
      writtenArticle: parsed.writtenArticle || '',
      tokensUsed,
      estimatedCost
    };
  }

  /**
   * Generate a single message completion
   * General-purpose method for other use cases
   *
   * @param systemPrompt - System prompt
   * @param userPrompt - User prompt
   * @param maxTokens - Max tokens (default: 2048)
   * @param temperature - Temperature (default: 0.7)
   * @returns Generated text
   */
  async generateCompletion(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number = 2048,
    temperature: number = 0.7
  ): Promise<{ content: string; tokensUsed: number; estimatedCost: number }> {
    const client = this.getAnthropicClient();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    if (!response.content || response.content.length === 0) {
      throw new Error('No content in Claude response');
    }

    const content = response.content[0];
    if (!content || content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const tokensUsed = inputTokens + outputTokens;
    const estimatedCost = (inputTokens / 1_000_000 * 3) + (outputTokens / 1_000_000 * 15);

    return {
      content: (content as any).text,
      tokensUsed,
      estimatedCost
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
