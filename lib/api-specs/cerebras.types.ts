/**
 * Cerebras API Types
 *
 * Type definitions for Cerebras inference API for bill analysis
 * and RAG-based chat using llama3.1-70b model.
 *
 * API Documentation: https://inference-docs.cerebras.ai/
 */

import { APIResponse } from './common.types';

// ============================================================================
// Chat Completion Types
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string; // 'llama3.1-70b'
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  time_info?: {
    prompt_time: number;
    completion_time: number;
    total_time: number;
  };
}

// ============================================================================
// Bill Analysis Types
// ============================================================================

export interface BillAnalysisRequest {
  billText: string; // Full bill text
  analysisType: 'summary' | 'impact' | 'stakeholders' | 'comprehensive';
}

export interface BillAnalysis {
  billId: string;
  analysisType: string;
  summary: string;
  keyProvisions?: string[];
  potentialImpact?: {
    category: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }[];
  stakeholders?: {
    group: string;
    stance: 'support' | 'oppose' | 'neutral';
    reasoning: string;
  }[];
  fiscalImpact?: string;
  generatedAt: string;
}

// ============================================================================
// RAG Chat Types
// ============================================================================

export interface RAGContext {
  chunks: string[]; // Retrieved text chunks from vector DB
  metadata?: {
    source: string;
    billId?: string;
    section?: string;
  }[];
}

export interface RAGChatRequest {
  question: string;
  context: RAGContext;
  conversationHistory?: ChatMessage[];
}

export interface RAGChatResponse {
  answer: string;
  sources?: string[];
  confidence?: number;
}

// ============================================================================
// Response Types
// ============================================================================

export type AnalyzeBillResponse = APIResponse<BillAnalysis>;
export type ChatWithBillResponse = APIResponse<RAGChatResponse>;
export type CerebrasCompletionResponse = APIResponse<ChatCompletionResponse>;
