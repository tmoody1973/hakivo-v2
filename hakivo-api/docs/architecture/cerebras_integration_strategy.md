# Cerebras Integration Strategy for RAG Chat

## Overview

Cerebras Cloud SDK provides ultra-fast LLM inference for the Hakivo bill chat assistant. Using the `gpt-oss-120b` model with streaming, the system delivers sub-2-second response times for bill Q&A powered by SmartBucket semantic search.

## Model Configuration

### Cerebras gpt-oss-120b

**Specifications:**
- **Model**: `gpt-oss-120b` (120 billion parameter open-source GPT)
- **Max Tokens**: 65,536 (supports very long bill contexts)
- **Streaming**: Enabled (reduces perceived latency)
- **Temperature**: 1.0 (balanced creativity)
- **Top-p**: 1.0 (full nucleus sampling)
- **Reasoning Effort**: "medium" (balanced between speed and accuracy)

**Performance:**
- Response time: ~1-2 seconds for typical queries
- Throughput: Up to 1800 tokens/second
- Context window: 65,536 tokens (can handle entire bill sections)

## SDK Installation

```bash
npm install @cerebras/cloud-sdk
```

## Implementation in cerebras-client Service

```typescript
// src/cerebras-client/index.ts
import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { Cerebras } from '@cerebras/cloud-sdk';

export default class CerebrasClient extends Service<Env> {
  private client: Cerebras;

  constructor(ctx: ExecutionContext, env: Env) {
    super(ctx, env);
    this.client = new Cerebras({
      apiKey: env.CEREBRAS_API_KEY
    });
  }

  async fetch(request: Request): Promise<Response> {
    return new Response('Not Implemented', { status: 501 });
  }

  /**
   * Generate chat completion with streaming
   * Used by chat-service for bill Q&A
   */
  async generateChatCompletion(params: {
    messages: ChatMessage[];
    systemPrompt?: string;
    maxTokens?: number;
  }): Promise<string> {
    const { messages, systemPrompt, maxTokens = 2048 } = params;

    // Build messages array
    const formattedMessages: any[] = [];

    if (systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    formattedMessages.push(...messages.map(m => ({
      role: m.role,
      content: m.content
    })));

    this.env.logger.info('Cerebras chat completion request', {
      messageCount: formattedMessages.length,
      maxTokens
    });

    try {
      // Create streaming completion
      const stream = await this.client.chat.completions.create({
        messages: formattedMessages,
        model: 'gpt-oss-120b',
        stream: true,
        max_completion_tokens: Math.min(maxTokens, 65536),
        temperature: 1,
        top_p: 1,
        reasoning_effort: 'medium'
      });

      // Collect streamed chunks
      let fullResponse = '';
      const startTime = Date.now();

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullResponse += content;
        }
      }

      const responseTime = Date.now() - startTime;

      // Log usage for monitoring
      await this.logApiUsage({
        model: 'gpt-oss-120b',
        inputTokens: this.estimateTokens(formattedMessages),
        outputTokens: this.estimateTokens([{ role: 'assistant', content: fullResponse }]),
        responseTime,
        cost: this.calculateCost(fullResponse.length)
      });

      this.env.logger.info('Cerebras chat completion success', {
        responseLength: fullResponse.length,
        responseTime,
        tokensPerSecond: Math.round((fullResponse.length / 4) / (responseTime / 1000))
      });

      return fullResponse;

    } catch (error) {
      this.env.logger.error(error as Error, {
        service: 'cerebras',
        operation: 'generateChatCompletion',
        messageCount: formattedMessages.length
      });
      throw error;
    }
  }

  /**
   * Generate chat completion with streaming response (for real-time UI)
   */
  async streamChatCompletion(params: {
    messages: ChatMessage[];
    systemPrompt?: string;
    maxTokens?: number;
  }): Promise<ReadableStream> {
    const { messages, systemPrompt, maxTokens = 2048 } = params;

    // Build messages array
    const formattedMessages: any[] = [];

    if (systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    formattedMessages.push(...messages.map(m => ({
      role: m.role,
      content: m.content
    })));

    const stream = await this.client.chat.completions.create({
      messages: formattedMessages,
      model: 'gpt-oss-120b',
      stream: true,
      max_completion_tokens: Math.min(maxTokens, 65536),
      temperature: 1,
      top_p: 1,
      reasoning_effort: 'medium'
    });

    // Convert Cerebras stream to web ReadableStream
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(new TextEncoder().encode(content));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(messages: ChatMessage[]): number {
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    return Math.ceil(totalChars / 4);  // ~4 chars per token
  }

  /**
   * Calculate approximate cost
   * Cerebras pricing: ~$0.60 per million tokens
   */
  private calculateCost(responseLength: number): number {
    const tokens = Math.ceil(responseLength / 4);
    return (tokens / 1_000_000) * 0.60;
  }

  /**
   * Log API usage for cost tracking
   */
  private async logApiUsage(params: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    responseTime: number;
    cost: number;
  }) {
    await this.env.APP_DB.exec(`
      INSERT INTO api_usage_logs (id, service, endpoint, tokens_used, cost_usd, response_time, status, created_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      crypto.randomUUID(),
      'cerebras',
      'chat.completions',
      params.inputTokens + params.outputTokens,
      params.cost,
      params.responseTime,
      200,
      Date.now(),
      JSON.stringify({
        model: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        tokensPerSecond: Math.round(params.outputTokens / (params.responseTime / 1000))
      })
    ]);
  }
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
```

## Usage in Chat Service

```typescript
// src/chat-service/index.ts

async sendMessage(sessionId: string, userMessage: string): Promise<ChatResponse> {
  // 1. Get chat session with bill context
  const session = await this.getSession(sessionId);

  // 2. Search bill-texts SmartBucket for relevant chunks
  const relevantChunks = await this.env.BILL_TEXTS.search({
    query: userMessage,
    filter: { billId: session.billId },
    limit: 5
  });

  // 3. Build context from chunks
  const context = relevantChunks.map(chunk => chunk.content).join('\n\n');

  // 4. Build system prompt with bill context
  const systemPrompt = `You are a helpful legislative assistant. Answer questions about the following bill using ONLY the provided context. Cite specific sections when possible.

BILL CONTEXT:
${context}

If the answer is not in the context, say "I don't have enough information in this bill to answer that question."`;

  // 5. Get conversation history
  const history = await this.getMessageHistory(sessionId);

  // 6. Build messages array
  const messages = [
    ...history,
    { role: 'user', content: userMessage }
  ];

  // 7. Generate response with Cerebras
  const assistantResponse = await this.env.CEREBRAS_CLIENT.generateChatCompletion({
    messages,
    systemPrompt,
    maxTokens: 2048
  });

  // 8. Extract citations
  const citations = this.extractCitations(assistantResponse, relevantChunks);

  // 9. Store user message and assistant response
  await this.storeMessages(sessionId, [
    { role: 'user', content: userMessage },
    { role: 'assistant', content: assistantResponse }
  ]);

  return {
    messageId: crypto.randomUUID(),
    role: 'assistant',
    content: assistantResponse,
    citations,
    createdAt: Date.now()
  };
}
```

## Rate Limiting

Cerebras has generous rate limits, but we implement safeguards:

```typescript
async checkRateLimit(): Promise<boolean> {
  const key = 'cerebras:rate_limit:' + Math.floor(Date.now() / 60000); // per minute
  const current = await this.env.SESSION_CACHE.get(key);
  const count = current ? parseInt(current) : 0;

  if (count >= 100) {
    this.env.logger.warn('Cerebras rate limit reached', { count });
    return false;
  }

  await this.env.SESSION_CACHE.put(key, (count + 1).toString(), {
    expirationTtl: 60
  });

  return true;
}
```

## Error Handling

```typescript
try {
  const response = await this.client.chat.completions.create({...});
  return response;
} catch (error) {
  if (error.code === 'rate_limit_exceeded') {
    // Retry with exponential backoff
    await this.retryWithBackoff(() => this.client.chat.completions.create({...}));
  } else if (error.code === 'context_length_exceeded') {
    // Truncate context and retry
    this.env.logger.warn('Context too long, truncating');
    const truncatedMessages = this.truncateMessages(messages, 60000);
    return await this.client.chat.completions.create({
      messages: truncatedMessages,
      ...
    });
  } else {
    throw error;
  }
}
```

## Streaming Response Example (Frontend)

```typescript
// Example: Streaming chat response to frontend
async function streamChatResponse(sessionId: string, message: string) {
  const response = await fetch('/chat/sessions/' + sessionId + '/messages/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ content: message })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let assistantMessage = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    assistantMessage += chunk;

    // Update UI in real-time
    updateChatUI(assistantMessage);
  }
}
```

## Cost Monitoring

**Cerebras Pricing:**
- Input: ~$0.60 per million tokens
- Output: ~$0.60 per million tokens

**Typical Chat Query:**
- User question: 50 tokens
- Bill context: 1500 tokens (5 chunks × 300 tokens)
- System prompt: 100 tokens
- Response: 300 tokens
- **Total**: ~1950 tokens = $0.00117 per query

**Monthly Cost (1000 users, 5 queries/user/month):**
- 5000 queries × $0.00117 = **$5.85/month**

Very affordable compared to OpenAI GPT-4.

## Performance Optimization

### Context Truncation Strategy

```typescript
/**
 * Truncate messages to fit within max token limit
 */
truncateMessages(messages: ChatMessage[], maxTokens: number): ChatMessage[] {
  let totalTokens = 0;
  const truncated: ChatMessage[] = [];

  // Always keep system prompt (first message)
  if (messages[0]?.role === 'system') {
    truncated.push(messages[0]);
    totalTokens += this.estimateTokens([messages[0]]);
  }

  // Add messages from most recent, working backwards
  for (let i = messages.length - 1; i > 0; i--) {
    const msgTokens = this.estimateTokens([messages[i]]);

    if (totalTokens + msgTokens > maxTokens) {
      break;
    }

    truncated.unshift(messages[i]);
    totalTokens += msgTokens;
  }

  return truncated;
}
```

## Summary

**Integration Points:**
- ✅ Cerebras Cloud SDK: `@cerebras/cloud-sdk`
- ✅ Model: `gpt-oss-120b` with streaming
- ✅ Max tokens: 65,536 (full bill sections)
- ✅ Streaming: Enabled for real-time responses
- ✅ Reasoning effort: "medium" for accuracy

**Performance:**
- Response time: ~1-2 seconds
- Throughput: ~1800 tokens/second
- Cost: ~$0.00117 per query

**Use Cases:**
- Bill Q&A chat assistant
- Citation-backed answers from bill text
- Multi-turn conversations about legislation
- Real-time streaming for responsive UI
