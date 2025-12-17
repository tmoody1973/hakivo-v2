'use client';

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import type { EnrichmentOptions } from '@/components/studio/EnrichmentOptionsPanel';
import type { DataSource } from '@/components/studio/DataSourceSelector';

/**
 * Generation status phases
 */
export type GenerationPhase =
  | 'idle'
  | 'enriching'
  | 'generating'
  | 'processing'
  | 'saving'
  | 'completed'
  | 'failed';

/**
 * Enrichment result from the API
 */
export interface EnrichmentResult {
  enrichedText: string;
  billDetails?: {
    id: string;
    title: string;
    sponsor?: { name: string; party: string; state: string };
    cosponsors?: Array<{ name: string; party: string }>;
    status?: string;
    introducedDate?: string;
    latestAction?: { date: string; text: string };
  };
  newsContext?: {
    summary: string;
    keyPoints: string[];
    sources: Array<{ title: string; url: string }>;
  };
  relatedBills?: Array<{
    id: string;
    title: string;
    similarity: number;
  }>;
  campaignFinance?: {
    totalRaised: number;
    totalSpent: number;
    cashOnHand: number;
    topContributors: Array<{ name: string; amount: number }>;
  };
  votingRecords?: {
    totalVotes: number;
    partyLoyalty: number;
    recentVotes: Array<{ bill: string; vote: string; date: string }>;
  };
}

/**
 * Generation result from the API
 */
export interface GenerationResult {
  documentId: string;
  generationId: string;
  status: string;
  url?: string;
  thumbnailUrl?: string;
  title?: string;
  cardCount?: number;
  exports?: {
    pdf?: string;
    pptx?: string;
  };
  error?: string;
  enrichment?: {
    sourcesUsed: string[];
    errors: string[];
    billDetails?: { id: string; title: string };
    relatedBillsCount: number;
    hasNewsContext: boolean;
    hasCampaignFinance: boolean;
  };
}

/**
 * Generation state
 */
export interface GenerationState {
  phase: GenerationPhase;
  progress: number;
  message: string;
  enrichmentResult?: EnrichmentResult;
  generationResult?: GenerationResult;
  error?: string;
}

/**
 * Gamma options for document generation
 */
export interface GammaOptions {
  format?: 'presentation' | 'document' | 'webpage';
  textMode?: 'generate' | 'condense' | 'preserve';
  template?: string;
  themeId?: string;
  numCards?: number;
  textOptions?: {
    amount?: string;
    tone?: string;
    audience?: string;
    language?: string;
  };
  imageOptions?: {
    source?: string;
    style?: string;
  };
  exportAs?: 'pdf' | 'pptx';
}

/**
 * Hook for managing the report generation workflow
 */
export function useReportGenerator() {
  const { accessToken } = useAuth();
  const [state, setState] = useState<GenerationState>({
    phase: 'idle',
    progress: 0,
    message: '',
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Update state helper
   */
  const updateState = useCallback((updates: Partial<GenerationState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState({
      phase: 'idle',
      progress: 0,
      message: '',
    });
  }, []);

  /**
   * Enrich content for preview (without generating)
   */
  const enrichContent = useCallback(
    async (
      dataSource: DataSource,
      enrichmentOptions: EnrichmentOptions
    ): Promise<EnrichmentResult | null> => {
      if (!accessToken) {
        updateState({ phase: 'failed', error: 'Not authenticated' });
        return null;
      }

      updateState({
        phase: 'enriching',
        progress: 10,
        message: 'Gathering enrichment data...',
      });

      try {
        abortControllerRef.current = new AbortController();

        // Build artifact from data source
        const artifact = {
          id: dataSource.id,
          title: dataSource.title,
          content: dataSource.content,
          subjectType: dataSource.metadata?.billId ? 'bill' : dataSource.type,
          subjectId: dataSource.metadata?.billId,
        };

        const response = await fetch('/api/gamma/enrich', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            artifact,
            options: enrichmentOptions,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Enrichment failed');
        }

        const data = await response.json();

        updateState({
          phase: 'idle',
          progress: 100,
          message: 'Enrichment complete',
          enrichmentResult: data.enrichedContent,
        });

        return data.enrichedContent;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return null;
        }
        console.error('[useReportGenerator] Enrichment error:', error);
        updateState({
          phase: 'failed',
          error: error instanceof Error ? error.message : 'Enrichment failed',
        });
        return null;
      }
    },
    [accessToken, updateState]
  );

  /**
   * Generate document with enrichment
   */
  const generate = useCallback(
    async (
      dataSource: DataSource,
      enrichmentOptions: EnrichmentOptions,
      gammaOptions: GammaOptions,
      title?: string
    ): Promise<GenerationResult | null> => {
      if (!accessToken) {
        updateState({ phase: 'failed', error: 'Not authenticated' });
        return null;
      }

      updateState({
        phase: 'enriching',
        progress: 5,
        message: 'Preparing content enrichment...',
      });

      try {
        abortControllerRef.current = new AbortController();

        // Build artifact from data source
        const artifact = {
          id: dataSource.id,
          title: dataSource.title,
          content: dataSource.content,
          subjectType: dataSource.metadata?.billId ? 'bill' : dataSource.type,
          subjectId: dataSource.metadata?.billId,
        };

        updateState({
          phase: 'enriching',
          progress: 15,
          message: 'Enriching content with external data...',
        });

        // Start enriched generation
        const response = await fetch('/api/gamma/generate-enriched', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            artifact,
            enrichmentOptions,
            gammaOptions,
            title: title || dataSource.title,
            // Skip slow enrichment for now to avoid timeout
            skipEnrichment: true,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Generation failed');
        }

        const data = await response.json();

        updateState({
          phase: 'generating',
          progress: 30,
          message: 'Content enriched. Starting document generation...',
          generationResult: data,
        });

        // Start polling for status
        return await pollForCompletion(data.generationId, data.documentId);
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return null;
        }
        console.error('[useReportGenerator] Generation error:', error);
        updateState({
          phase: 'failed',
          error: error instanceof Error ? error.message : 'Generation failed',
        });
        return null;
      }
    },
    [accessToken, updateState]
  );

  /**
   * Poll for generation completion
   */
  const pollForCompletion = useCallback(
    async (generationId: string, documentId: string): Promise<GenerationResult | null> => {
      return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 120; // 10 minutes max (5 second intervals)

        const checkStatus = async () => {
          attempts++;

          if (attempts > maxAttempts) {
            updateState({
              phase: 'failed',
              error: 'Generation timed out',
            });
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            resolve(null);
            return;
          }

          try {
            const response = await fetch(`/api/gamma/status/${generationId}`, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });

            if (!response.ok) {
              throw new Error('Status check failed');
            }

            const data = await response.json();

            // Update progress based on status
            const progressMap: Record<string, number> = {
              pending: 35,
              processing: 50,
              generating: 65,
              finalizing: 85,
              completed: 100,
            };

            const progress = progressMap[data.status] || 50;

            if (data.status === 'completed') {
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
              }

              const result: GenerationResult = {
                documentId,
                generationId,
                status: 'completed',
                url: data.url,
                thumbnailUrl: data.thumbnailUrl,
                title: data.title,
                cardCount: data.cardCount,
                exports: data.exports,
              };

              updateState({
                phase: 'completed',
                progress: 100,
                message: 'Document generated successfully!',
                generationResult: result,
              });

              resolve(result);
            } else if (data.status === 'failed') {
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
              }

              updateState({
                phase: 'failed',
                error: data.error || 'Generation failed',
              });

              resolve(null);
            } else {
              updateState({
                phase: 'processing',
                progress,
                message: `Processing... ${data.status}`,
              });
            }
          } catch {
            // Silently retry on transient errors
            console.error('[useReportGenerator] Status check error, retrying...');
          }
        };

        // Start polling
        checkStatus();
        pollingIntervalRef.current = setInterval(checkStatus, 5000);
      });
    },
    [accessToken, updateState]
  );

  /**
   * Save exports (PDF/PPTX) to storage
   */
  const saveExports = useCallback(
    async (documentId: string, formats: ('pdf' | 'pptx')[]): Promise<{ pdf?: string; pptx?: string } | null> => {
      if (!accessToken) return null;

      updateState({
        phase: 'saving',
        progress: 90,
        message: 'Saving export files...',
      });

      try {
        const response = await fetch(`/api/gamma/save/${documentId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ exportFormats: formats }),
        });

        if (!response.ok) {
          throw new Error('Failed to save exports');
        }

        const data = await response.json();

        updateState({
          phase: 'completed',
          progress: 100,
          message: 'Exports saved!',
        });

        return data.exports;
      } catch (error) {
        console.error('[useReportGenerator] Save exports error:', error);
        // Don't fail the whole generation, just log the error
        return null;
      }
    },
    [accessToken, updateState]
  );

  /**
   * Cancel the current operation
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    updateState({
      phase: 'idle',
      progress: 0,
      message: 'Cancelled',
    });
  }, [updateState]);

  return {
    state,
    enrichContent,
    generate,
    saveExports,
    cancel,
    reset,
    isIdle: state.phase === 'idle',
    isEnriching: state.phase === 'enriching',
    isGenerating: state.phase === 'generating' || state.phase === 'processing',
    isSaving: state.phase === 'saving',
    isCompleted: state.phase === 'completed',
    isFailed: state.phase === 'failed',
    isLoading: ['enriching', 'generating', 'processing', 'saving'].includes(state.phase),
  };
}
