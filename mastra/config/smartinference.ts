/**
 * SmartInference Configuration for Hakivo Congressional Assistant
 *
 * Provides intelligent model routing based on task complexity and type.
 * Uses Cerebras for ultra-fast inference with gpt-oss-120b model.
 *
 * Model Tiers:
 * - Fast: Quick responses for simple queries (Cerebras gpt-oss-120b)
 * - Standard: Balanced performance (Cerebras gpt-oss-120b)
 * - Complex: Deep analysis and reasoning (Cerebras gpt-oss-120b)
 * - Creative: UI generation and creative content (thesys C1)
 *
 * CEREBRAS BENEFITS:
 * - 10x faster inference than typical cloud providers
 * - OpenAI-compatible API
 * - High-quality 120B parameter model
 * - Competitive pricing
 */

import { openai, createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

// Create anthropic provider instance (fallback)
const anthropic = createAnthropic({});

/**
 * Cerebras Provider - Ultra-fast inference with gpt-oss-120b
 *
 * Cerebras offers blazing fast inference speeds (10x faster than typical)
 * with OpenAI-compatible API. Perfect for real-time chat applications.
 */
const cerebrasAI = createOpenAI({
  apiKey: process.env.CEREBRAS_API_KEY,
  baseURL: "https://api.cerebras.ai/v1",
});

/**
 * Thesys C1 Provider - Uses OpenAI-compatible API with thesys baseURL
 * Requires THESYS_API_KEY environment variable
 */
const thesysC1 = createOpenAI({
  apiKey: process.env.THESYS_API_KEY,
  baseURL: "https://api.thesys.dev/v1/embed",
});

// Model configuration types
export type ModelTier = "fast" | "standard" | "complex" | "creative";
export type TaskType =
  | "simple_query"
  | "bill_search"
  | "bill_analysis"
  | "vote_analysis"
  | "representative_lookup"
  | "news_search"
  | "comparison"
  | "report_generation"
  | "ui_generation"
  | "conversation";

interface ModelConfig {
  provider: "openai" | "anthropic" | "thesys" | "cerebras";
  modelId: string;
  maxTokens: number;
  temperature: number;
  description: string;
}

interface TaskClassification {
  tier: ModelTier;
  confidence: number;
  reasoning: string;
}

// Available models by tier
// Note: Using Cerebras for ultra-fast inference (10x faster than typical)
// Cerebras gpt-oss-120b provides high-quality responses at incredible speed
export const MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
  fast: {
    provider: "cerebras",
    modelId: "gpt-oss-120b", // Ultra-fast inference via Cerebras
    maxTokens: 1000,
    temperature: 0.7,
    description: "Ultra-fast responses via Cerebras gpt-oss-120b",
  },
  standard: {
    provider: "cerebras",
    modelId: "gpt-oss-120b", // High-quality model with blazing speed
    maxTokens: 4000,
    temperature: 0.7,
    description: "Balanced performance via Cerebras gpt-oss-120b",
  },
  complex: {
    provider: "cerebras",
    modelId: "gpt-oss-120b", // Use same model for complex tasks
    maxTokens: 8000,
    temperature: 0.5,
    description: "Deep reasoning via Cerebras gpt-oss-120b",
  },
  creative: {
    provider: "thesys",
    modelId: "c1/anthropic/claude-sonnet-4/v-20250815",
    maxTokens: 4000,
    temperature: 0.8,
    description: "Generative UI powered by thesys C1",
  },
};

// Task type to model tier mapping
export const TASK_TO_TIER: Record<TaskType, ModelTier> = {
  simple_query: "fast",
  bill_search: "fast",
  representative_lookup: "fast",
  news_search: "fast",
  bill_analysis: "standard",
  vote_analysis: "standard",
  conversation: "standard",
  comparison: "complex",
  report_generation: "complex",
  ui_generation: "creative",
};

// Keywords for task classification
const TASK_KEYWORDS: Record<TaskType, string[]> = {
  simple_query: ["what is", "define", "explain", "who is", "when"],
  bill_search: ["find bill", "search bill", "bills about", "legislation on", "show me bills"],
  bill_analysis: [
    "analyze",
    "analysis",
    "what does the bill say",
    "provisions",
    "impact",
    "summary",
    "explain the bill",
  ],
  vote_analysis: [
    "vote",
    "voted",
    "voting record",
    "how did they vote",
    "vote breakdown",
    "yea",
    "nay",
  ],
  representative_lookup: [
    "my representative",
    "my senator",
    "who represents",
    "my congressman",
    "my legislator",
  ],
  news_search: ["news", "latest", "current events", "headlines", "what's happening"],
  comparison: [
    "compare",
    "difference between",
    "versus",
    "vs",
    "similar to",
    "contrast",
    "both bills",
  ],
  report_generation: [
    "report",
    "briefing",
    "presentation",
    "summary report",
    "weekly briefing",
    "generate document",
  ],
  ui_generation: [
    "show me",
    "display",
    "visualize",
    "chart",
    "graph",
    "timeline",
    "card",
  ],
  conversation: [],
};

/**
 * Classify a user query to determine the appropriate task type and model tier
 */
export function classifyQuery(query: string): TaskClassification {
  const lowerQuery = query.toLowerCase();

  // Check each task type for keyword matches
  let bestMatch: TaskType = "conversation";
  let bestMatchCount = 0;

  for (const [taskType, keywords] of Object.entries(TASK_KEYWORDS)) {
    const matchCount = keywords.filter((keyword) =>
      lowerQuery.includes(keyword.toLowerCase())
    ).length;

    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestMatch = taskType as TaskType;
    }
  }

  // Calculate confidence based on match strength
  const confidence =
    bestMatchCount > 0 ? Math.min(0.5 + bestMatchCount * 0.15, 0.95) : 0.3;

  const tier = TASK_TO_TIER[bestMatch];

  return {
    tier,
    confidence,
    reasoning: `Classified as "${bestMatch}" (${tier} tier) based on ${bestMatchCount} keyword matches`,
  };
}

/**
 * Get the appropriate model configuration for a query
 */
export function getModelForQuery(query: string): ModelConfig & { tier: ModelTier } {
  const classification = classifyQuery(query);
  const config = MODEL_CONFIGS[classification.tier];

  return {
    ...config,
    tier: classification.tier,
  };
}

/**
 * Get Mastra-compatible model instance for a tier
 *
 * Uses Cerebras for ultra-fast inference (10x faster than typical).
 * Falls back to Anthropic for complex reasoning and Thesys for generative UI.
 */
export function getMastraModel(tier: ModelTier = "standard") {
  const config = MODEL_CONFIGS[tier];

  switch (config.provider) {
    case "cerebras":
      // Cerebras gpt-oss-120b - ultra-fast inference
      return cerebrasAI(config.modelId);
    case "openai":
      return openai(config.modelId);
    case "anthropic":
      return anthropic(config.modelId);
    case "thesys":
      // Use thesys C1 provider for generative UI
      return thesysC1.chat(config.modelId);
    default:
      // Default to Cerebras gpt-oss-120b
      return cerebrasAI("gpt-oss-120b");
  }
}

/**
 * Create a model selector function for dynamic routing
 */
export function createModelSelector() {
  return {
    /**
     * Select model based on query analysis
     */
    forQuery: (query: string) => {
      const classification = classifyQuery(query);
      return {
        model: getMastraModel(classification.tier),
        config: MODEL_CONFIGS[classification.tier],
        classification,
      };
    },

    /**
     * Get model for specific task type
     */
    forTask: (taskType: TaskType) => {
      const tier = TASK_TO_TIER[taskType];
      return {
        model: getMastraModel(tier),
        config: MODEL_CONFIGS[tier],
        tier,
      };
    },

    /**
     * Get model by tier directly
     */
    forTier: (tier: ModelTier) => {
      return {
        model: getMastraModel(tier),
        config: MODEL_CONFIGS[tier],
        tier,
      };
    },
  };
}

// Export a default selector instance
export const modelSelector = createModelSelector();

/**
 * SmartInference context for agent configuration
 *
 * Use this to configure the agent with appropriate settings
 * based on the expected task complexity.
 */
export interface SmartInferenceContext {
  tier: ModelTier;
  model: ReturnType<typeof openai>;
  maxTokens: number;
  temperature: number;
}

/**
 * Get SmartInference context for agent configuration
 */
export function getSmartInferenceContext(
  query?: string,
  forceTier?: ModelTier
): SmartInferenceContext {
  let tier: ModelTier;

  if (forceTier) {
    tier = forceTier;
  } else if (query) {
    tier = classifyQuery(query).tier;
  } else {
    tier = "standard";
  }

  const config = MODEL_CONFIGS[tier];

  return {
    tier,
    model: getMastraModel(tier),
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  };
}

/**
 * Cost estimation for model usage
 */
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "gpt-oss-120b": { input: 0.0006, output: 0.0006 }, // Cerebras - very competitive pricing
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 }, // per 1K tokens
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "claude-sonnet-4-5-20250929": { input: 0.003, output: 0.015 },
  "c1/anthropic/claude-sonnet-4/v-20250815": { input: 0.003, output: 0.015 }, // thesys C1
};

/**
 * Estimate cost for a query based on expected token usage
 */
export function estimateCost(
  tier: ModelTier,
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): number {
  const config = MODEL_CONFIGS[tier];
  const costs = MODEL_COSTS[config.modelId];

  if (!costs) return 0;

  return (
    (estimatedInputTokens / 1000) * costs.input +
    (estimatedOutputTokens / 1000) * costs.output
  );
}
