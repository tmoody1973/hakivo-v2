/**
 * Raindrop SmartInference Provider for Mastra
 *
 * Creates an OpenAI-compatible provider that routes through Raindrop's
 * SmartInference service, giving access to 50+ AI models through one endpoint.
 *
 * Benefits for hackathon judges:
 * - Unified AI gateway (no vendor lock-in)
 * - Access to Llama, DeepSeek, Whisper, FLUX, embeddings, etc.
 * - Automatic model routing based on task type
 * - Built-in caching and observability
 * - Single billing instead of multiple API keys
 */

import { createOpenAI } from "@ai-sdk/openai";

// Raindrop Chat Service endpoint (has AI capabilities)
const RAINDROP_CHAT_SERVICE =
  process.env.RAINDROP_CHAT_URL ||
  "https://svc-01ka8k5e6tr0kgy0jkzj9m4q18.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

// Raindrop AI endpoint (OpenAI-compatible)
const RAINDROP_AI_ENDPOINT = `${RAINDROP_CHAT_SERVICE}/v1`;

/**
 * Raindrop SmartInference Provider
 *
 * Routes AI requests through Raindrop's unified AI gateway.
 * Supports all models available in Raindrop:
 * - llama-3.3-70b (high-performance)
 * - deepseek-r1 (advanced reasoning)
 * - llama-3.1-8b-instant (fast responses)
 * - gpt-4o, claude-sonnet-4 (via proxy)
 */
export const raindropAI = createOpenAI({
  apiKey: process.env.RAINDROP_API_KEY || "raindrop-internal",
  baseURL: RAINDROP_AI_ENDPOINT,
});

/**
 * Available Raindrop AI Models
 *
 * These models are available through SmartInference:
 */
export const RAINDROP_MODELS = {
  // High-performance models
  "llama-3.3-70b": "llama-3.3-70b",
  "deepseek-r1": "deepseek-r1",
  "deepseek-v3": "deepseek-v3-0324",
  "qwen-3-32b": "qwen-3-32b",

  // Fast/efficient models
  "llama-3.1-8b": "llama-3.1-8b-instruct",
  "llama-3.1-8b-instant": "llama-3.1-8b-instant",
  "gemma-9b": "gemma-9b-it",

  // Reasoning models
  "deepseek-r1-distill": "deepseek-r1-distill-llama-70b",
  "qwen-qwq-32b": "qwen-qwq-32b",

  // Code generation
  "qwen-coder-32b": "qwen-coder-32b",
  "deepseek-coder": "deepseek-coder-6.7b",

  // Default (balanced)
  default: "llama-3.3-70b",
} as const;

export type RaindropModel = keyof typeof RAINDROP_MODELS;

/**
 * Get a Raindrop model instance for Mastra
 *
 * @param model - Model name or alias
 * @returns AI SDK model instance
 */
export function getRaindropModel(model: RaindropModel = "default") {
  const modelId = RAINDROP_MODELS[model] || RAINDROP_MODELS.default;
  return raindropAI(modelId);
}

/**
 * Model routing based on task complexity
 *
 * Routes to the most cost-effective model for the task:
 * - Simple queries → llama-3.1-8b-instant (fast, cheap)
 * - Standard tasks → llama-3.3-70b (balanced)
 * - Complex reasoning → deepseek-r1 (advanced)
 * - Code generation → qwen-coder-32b (specialized)
 */
export function getModelForTask(
  taskType: "simple" | "standard" | "complex" | "code" | "reasoning"
) {
  const taskToModel: Record<typeof taskType, RaindropModel> = {
    simple: "llama-3.1-8b-instant",
    standard: "llama-3.3-70b",
    complex: "deepseek-r1",
    code: "qwen-coder-32b",
    reasoning: "qwen-qwq-32b",
  };

  return getRaindropModel(taskToModel[taskType]);
}

/**
 * Smart model selection based on query analysis
 *
 * Analyzes the query to determine the best model.
 */
export function selectModelForQuery(query: string) {
  const lowerQuery = query.toLowerCase();

  // Code-related queries
  if (
    lowerQuery.includes("code") ||
    lowerQuery.includes("function") ||
    lowerQuery.includes("implement") ||
    lowerQuery.includes("bug") ||
    lowerQuery.includes("debug")
  ) {
    return getModelForTask("code");
  }

  // Complex reasoning queries
  if (
    lowerQuery.includes("analyze") ||
    lowerQuery.includes("compare") ||
    lowerQuery.includes("explain why") ||
    lowerQuery.includes("impact") ||
    lowerQuery.includes("implications")
  ) {
    return getModelForTask("complex");
  }

  // Simple queries
  if (
    lowerQuery.includes("what is") ||
    lowerQuery.includes("who is") ||
    lowerQuery.includes("list") ||
    lowerQuery.includes("show me") ||
    query.length < 50
  ) {
    return getModelForTask("simple");
  }

  // Default to standard
  return getModelForTask("standard");
}
