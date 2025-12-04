import OpenAI from "openai";

// C1 uses OpenAI-compatible API
export const c1Client = new OpenAI({
  apiKey: process.env.THESYS_API_KEY,
  baseURL: "https://api.thesys.dev/v1/embed",
});

// C1 Artifacts client for reports and presentations
export const c1ArtifactsClient = new OpenAI({
  apiKey: process.env.THESYS_API_KEY,
  baseURL: "https://api.thesys.dev/v1/artifact",
});

// Available C1 models (from https://docs.thesys.dev/api-reference/models-and-compatibility)
export const C1_MODELS = {
  // Stable models (production-recommended)
  CLAUDE_SONNET_4_EMBED: "c1/anthropic/claude-sonnet-4/v-20250930",
  CLAUDE_SONNET_4_VISUALIZE: "c1/anthropic/claude-sonnet-4/v-20250915",
  GPT5: "c1/openai/gpt-5/v-20250930",

  // Artifacts model
  ARTIFACT: "c1/artifact/v-20251030",

  // Experimental models (lower cost)
  CLAUDE_HAIKU_EXP: "c1-exp/anthropic/claude-3.5-haiku/v-20250709",
  GPT4_1_EXP: "c1-exp/openai/gpt-4.1/v-20250617",

  // Default for chat
  DEFAULT: "c1/openai/gpt-5/v-20250930",
} as const;

// Artifact types
export const C1_ARTIFACT_TYPES = {
  REPORT: "report",
  SLIDES: "slides",
} as const;

export type C1Model = (typeof C1_MODELS)[keyof typeof C1_MODELS];
export type C1ArtifactType = (typeof C1_ARTIFACT_TYPES)[keyof typeof C1_ARTIFACT_TYPES];
