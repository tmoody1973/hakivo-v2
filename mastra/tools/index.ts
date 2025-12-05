/**
 * Mastra Tools Index
 *
 * Exports all tools for the Congressional Assistant agent.
 * Tools are organized by category:
 * - SmartSQL: Database queries (bills, members, state bills)
 * - SmartBucket: RAG and document storage (bill text search)
 * - SmartMemory: User context and preferences
 * - SmartInference: AI model configurations
 */

// SmartSQL Tools - Database queries
export {
  smartSqlTool,
  getBillDetailTool,
  getMemberDetailTool,
  smartSqlTools,
} from "./smartsql";

// SmartBucket Tools - RAG and semantic search
export {
  semanticSearchTool,
  billTextRagTool,
  compareBillsTool,
  policyAreaSearchTool,
  smartBucketTools,
} from "./smartbucket";

// SmartMemory Tools - User context and memory management
export {
  getUserContextTool,
  getUserRepresentativesTool,
  getTrackedBillsTool,
  getConversationHistoryTool,
  storeWorkingMemoryTool,
  getBriefingTemplatesTool,
  getPersonalizedRecommendationsTool,
  updateUserProfileTool,
  searchPastSessionsTool,
  smartMemoryTools,
} from "./smartmemory";

// Perplexity Tools - Web search (replaces Tavily)
export {
  searchNewsTool,
  searchCongressionalNewsTool,
  searchLegislatorNewsTool,
  webSearchTool,
  perplexityTools,
} from "./perplexity";

// OpenStates Tools - State legislation
export {
  searchStateBillsTool,
  getStateBillDetailsTool,
  getStateLegislatorsByLocationTool,
  getStateLegislatorDetailsTool,
  getStateLegislatorVotingRecordTool,
  openstatesTools,
} from "./openstates";

// C1 Artifacts Tools - Reports and presentations
export {
  generateBillReportTool,
  generateBriefingSlidesTool,
  c1ArtifactsTools,
} from "./c1-artifacts";

// Audio Briefing Tools - Text-to-speech briefings
export {
  generateAudioBriefingTool,
  generateBillAudioSummaryTool,
  generateDailyBriefingAudioTool,
  audioBriefingTools,
} from "./audio-briefing";

// Congressional Analytics Tools - Aggregation and journalist-style queries
export {
  getMostProlificSponsorsTool,
  getPolicyAreaBreakdownTool,
  getLegislativeProductivityTool,
  getPartisanBreakdownTool,
  getRecentBillsTool,
  searchBillsByStatusTool,
  congressionalAnalyticsTools,
} from "./congressional-analytics";

// Re-export all tools as a single object for agent configuration
import { smartSqlTools } from "./smartsql";
import { smartBucketTools } from "./smartbucket";
import { smartMemoryTools } from "./smartmemory";
import { perplexityTools } from "./perplexity";
import { openstatesTools } from "./openstates";
import { c1ArtifactsTools } from "./c1-artifacts";
import { audioBriefingTools } from "./audio-briefing";
import { congressionalAnalyticsTools } from "./congressional-analytics";

export const allTools = {
  ...smartSqlTools,
  ...smartBucketTools,
  ...smartMemoryTools,
  ...perplexityTools,
  ...openstatesTools,
  ...c1ArtifactsTools,
  ...audioBriefingTools,
  ...congressionalAnalyticsTools,
};
