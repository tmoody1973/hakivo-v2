/**
 * Mastra Configuration Index
 *
 * Exports all configuration modules for the Congressional Assistant.
 */

// SmartInference - Intelligent model routing
export {
  // Types
  type ModelTier,
  type TaskType,
  type SmartInferenceContext,
  // Configuration
  MODEL_CONFIGS,
  TASK_TO_TIER,
  MODEL_COSTS,
  // Functions
  classifyQuery,
  getModelForQuery,
  getMastraModel,
  createModelSelector,
  getSmartInferenceContext,
  estimateCost,
  // Default selector
  modelSelector,
} from "./smartinference";
