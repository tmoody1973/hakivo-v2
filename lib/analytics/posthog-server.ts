/**
 * Server-side PostHog client for LLM observability
 *
 * IMPORTANT: This file uses posthog-node which requires Node.js APIs.
 * Only import this in:
 * - API routes (app/api/...)
 * - Server components
 * - Server actions
 *
 * DO NOT import in client components or from lib/analytics/index.ts
 *
 * Tracks AI/LLM usage including:
 * - Model, provider, temperature
 * - Token usage (input/output)
 * - Latency
 * - Cost estimation
 *
 * @see https://posthog.com/docs/ai-engineering/observability
 */

import 'server-only';
import { PostHog } from 'posthog-node';

// Lazy-initialize PostHog client (only when needed)
let posthogClient: PostHog | null = null;

function getPostHogClient(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: 'https://us.i.posthog.com',
      // Batch events for efficiency
      flushAt: 10,
      flushInterval: 5000,
    });
  }

  return posthogClient;
}

// Cost per 1M tokens (approximate, update as needed)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  // Thesys C1 models (pricing TBD, using Claude pricing as proxy)
  'c1/anthropic/claude-sonnet-4/v-20251130': { input: 3.0, output: 15.0 },
  'c1/artifact/v-20251030': { input: 3.0, output: 15.0 },
  // Perplexity
  'sonar': { input: 1.0, output: 1.0 },
  'sonar-pro': { input: 3.0, output: 15.0 },
  // Default fallback
  'default': { input: 1.0, output: 1.0 },
};

interface LLMGenerationParams {
  // Required
  model: string;
  provider: string;

  // User identification
  distinctId: string; // user ID or anonymous ID

  // Input/Output
  input?: string | object; // prompt or messages
  output?: string; // completion

  // Token usage
  inputTokens?: number;
  outputTokens?: number;

  // Timing
  latencyMs?: number;

  // Optional metadata
  trace_id?: string;
  feature?: string; // e.g., 'chat', 'bill_analysis', 'artifact'
  threadId?: string;
  temperature?: number;

  // Tool usage
  toolsCalled?: string[];
}

/**
 * Track an LLM generation event
 *
 * PostHog uses the $ai_generation event for LLM observability
 * @see https://posthog.com/docs/ai-engineering/observability
 */
export function trackLLMGeneration(params: LLMGenerationParams): void {
  const client = getPostHogClient();
  if (!client) return;

  const {
    model,
    provider,
    distinctId,
    input,
    output,
    inputTokens = 0,
    outputTokens = 0,
    latencyMs,
    trace_id,
    feature,
    threadId,
    temperature,
    toolsCalled,
  } = params;

  // Calculate cost
  const costs = MODEL_COSTS[model] || MODEL_COSTS['default'];
  const inputCost = (inputTokens / 1_000_000) * costs.input;
  const outputCost = (outputTokens / 1_000_000) * costs.output;
  const totalCost = inputCost + outputCost;

  // Send the LLM observability event
  client.capture({
    distinctId,
    event: '$ai_generation',
    properties: {
      // Required LLM properties
      $ai_model: model,
      $ai_provider: provider,
      $ai_input_tokens: inputTokens,
      $ai_output_tokens: outputTokens,
      $ai_total_tokens: inputTokens + outputTokens,

      // Cost tracking
      $ai_input_cost_usd: inputCost,
      $ai_output_cost_usd: outputCost,
      $ai_total_cost_usd: totalCost,

      // Latency
      $ai_latency_ms: latencyMs,

      // Optional: input/output (can be large, consider truncating)
      ...(input && { $ai_input: typeof input === 'string' ? input.slice(0, 1000) : JSON.stringify(input).slice(0, 1000) }),
      ...(output && { $ai_output: output.slice(0, 1000) }),

      // Custom properties
      ...(trace_id && { $ai_trace_id: trace_id }),
      ...(temperature !== undefined && { $ai_temperature: temperature }),
      ...(toolsCalled && toolsCalled.length > 0 && { $ai_tools_called: toolsCalled }),

      // Feature tracking
      feature: feature || 'unknown',
      thread_id: threadId,
    },
  });
}

/**
 * Track a tool call within an LLM generation
 */
export function trackToolCall(params: {
  distinctId: string;
  toolName: string;
  latencyMs?: number;
  success: boolean;
  error?: string;
  trace_id?: string;
  feature?: string;
}): void {
  const client = getPostHogClient();
  if (!client) return;

  client.capture({
    distinctId: params.distinctId,
    event: '$ai_tool_call',
    properties: {
      tool_name: params.toolName,
      latency_ms: params.latencyMs,
      success: params.success,
      ...(params.error && { error: params.error }),
      ...(params.trace_id && { trace_id: params.trace_id }),
      feature: params.feature || 'chat',
    },
  });
}

/**
 * Flush pending events (call before response ends)
 */
export async function flushPostHog(): Promise<void> {
  const client = getPostHogClient();
  if (client) {
    await client.flush();
  }
}

/**
 * Shutdown PostHog client (for graceful shutdown)
 */
export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown();
    posthogClient = null;
  }
}
