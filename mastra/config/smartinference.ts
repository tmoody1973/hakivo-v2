/**
 * SmartInference Configuration for Hakivo Congressional Assistant
 *
 * Provides intelligent model routing based on task complexity and type.
 * Uses Cerebras via Mastra for ultra-fast inference.
 *
 * Model Tiers:
 * - Fast: Quick responses for simple queries (Cerebras GPT-OSS 120B)
 * - Standard: Balanced performance (Cerebras GPT-OSS 120B)
 * - Complex: Deep analysis and reasoning (Cerebras ZAI GLM 4.6)
 * - Creative: Creative content (Cerebras Qwen 3 235B)
 *
 * CEREBRAS BENEFITS:
 * - 10x faster inference than typical cloud providers
 * - High-quality models at incredible speed
 * - Competitive pricing
 * - Mastra native integration via model router
 */

/**
 * Mastra Model Router Strings
 *
 * Mastra's built-in model router uses format: "provider/model-id"
 * - Cerebras models: "cerebras/llama-3.3-70b", "cerebras/gpt-oss-120b"
 * - OpenAI models: "openai/gpt-4o", "openai/gpt-4o-mini"
 *
 * These are returned as strings and used directly in Agent config.
 * Authentication is automatic via CEREBRAS_API_KEY env var.
 */

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
  provider: "openai" | "anthropic" | "cerebras";
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
// Note: Using Mastra's built-in Cerebras model router
// Available Cerebras models: gpt-oss-120b, qwen-3-235b-a22b-instruct-2507, zai-glm-4.6
export const MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
  fast: {
    provider: "cerebras",
    modelId: "cerebras/gpt-oss-120b", // Mastra model router format
    maxTokens: 1000,
    temperature: 0.7,
    description: "Ultra-fast responses via Cerebras GPT-OSS 120B",
  },
  standard: {
    provider: "cerebras",
    modelId: "cerebras/gpt-oss-120b", // High-quality model with blazing speed
    maxTokens: 4000,
    temperature: 0.7,
    description: "Balanced performance via Cerebras GPT-OSS 120B",
  },
  complex: {
    provider: "cerebras",
    modelId: "cerebras/zai-glm-4.6", // Advanced reasoning model
    maxTokens: 8000,
    temperature: 0.5,
    description: "Deep reasoning via Cerebras ZAI GLM 4.6",
  },
  creative: {
    provider: "cerebras",
    modelId: "cerebras/qwen-3-235b-a22b-instruct-2507", // Creative/advanced model
    maxTokens: 4000,
    temperature: 0.8,
    description: "Creative content via Cerebras Qwen 3 235B",
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
 * Get Mastra-compatible model for a tier
 *
 * Returns model string for Mastra's built-in model router OR
 * provider instance for external APIs (thesys).
 *
 * Mastra model router format: "provider/model-id"
 * - Uses CEREBRAS_API_KEY automatically for cerebras/ models
 * - Uses OPENAI_API_KEY automatically for openai/ models
 */
export function getMastraModel(tier: ModelTier = "standard"): string {
  const config = MODEL_CONFIGS[tier];

  switch (config.provider) {
    case "cerebras":
      // Return Mastra model router string (e.g., "cerebras/gpt-oss-120b")
      return config.modelId;
    case "openai":
      // Return OpenAI model via Mastra router
      return `openai/${config.modelId}`;
    case "anthropic":
      // Return Anthropic model via Mastra router
      return `anthropic/${config.modelId}`;
    default:
      // Default to Cerebras GPT-OSS
      return "cerebras/gpt-oss-120b";
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
  model: string; // Mastra model router string (e.g., "cerebras/gpt-oss-120b")
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
  // Cerebras models via Mastra
  "cerebras/gpt-oss-120b": { input: 0.00025, output: 0.00069 }, // $0.25/$0.69 per 1M tokens
  "cerebras/qwen-3-235b-a22b-instruct-2507": { input: 0.0006, output: 0.001 }, // $0.60/$1 per 1M tokens
  "cerebras/zai-glm-4.6": { input: 0.0006, output: 0.001 }, // Estimated similar to qwen
  // OpenAI fallbacks
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 }, // per 1K tokens
  "gpt-4o": { input: 0.0025, output: 0.01 },
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
