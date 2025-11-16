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
      const apiKey = process.env.CEREBRAS_API_KEY;

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
      model: 'llama3.1-70b',
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
      model: 'llama3.1-70b',
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
   * Required fetch method for Raindrop Service
   * This is a private service, so fetch returns 501 Not Implemented
   */
  async fetch(_request: Request): Promise<Response> {
    return new Response('Not Implemented - Private Service', { status: 501 });
  }
}
