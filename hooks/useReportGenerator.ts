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

        // Use synchronous generate-enriched endpoint
        // This calls Gamma API directly and returns generationId
        const generateResponse = await fetch('/api/gamma/generate-enriched', {
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
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!generateResponse.ok) {
          const errorData = await generateResponse.json();
          const errorDetails = errorData.details ? `: ${errorData.details}` : '';
          throw new Error((errorData.error || 'Failed to generate') + errorDetails);
        }

        const generateData = await generateResponse.json();

        updateState({
          phase: 'processing',
          progress: 40,
          message: 'Document generation started. Waiting for Gamma...',
          generationResult: generateData,
        });

        // Poll for completion using generation ID
        return await pollForCompletion(generateData.generationId, generateData.documentId);
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
   * Poll for document completion using document ID
   * Used for async enqueue-enriched flow with background processing
   */
  const pollForDocumentCompletion = useCallback(
    async (documentId: string): Promise<GenerationResult | null> => {
      return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 180; // 15 minutes max (5 second intervals)

        const checkStatus = async () => {
          attempts++;

          if (attempts > maxAttempts) {
            updateState({
              phase: 'failed',
              error: 'Document processing timed out',
            });
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            resolve(null);
            return;
          }

          try {
            const response = await fetch(`/api/gamma/document-status/${documentId}`, {
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
              enrichment_pending: 25,
              enriching: 40,
              generating: 60,
              pending: 70,
              processing: 80,
              completed: 100,
            };

            const progress = progressMap[data.status] || 50;

            // Update message based on status
            const messageMap: Record<string, string> = {
              enrichment_pending: 'Waiting for background processor...',
              enriching: 'Fetching bill details, news, and related data...',
              generating: 'Creating document with Gamma AI...',
              pending: 'Gamma is processing your document...',
              processing: 'Finalizing document...',
              completed: 'Document generated successfully!',
            };

            if (data.status === 'completed') {
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
              }

              const result: GenerationResult = {
                documentId,
                generationId: data.gamma_generation_id || '',
                status: 'completed',
                url: data.gamma_url,
                thumbnailUrl: data.gamma_thumbnail_url,
                title: data.title,
                cardCount: data.card_count,
                // Include exports if available from Gamma
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
                error: data.error_message || 'Document generation failed',
              });

              resolve(null);
            } else {
              updateState({
                phase: data.status === 'enriching' ? 'enriching' : 'processing',
                progress,
                message: messageMap[data.status] || `Processing... ${data.status}`,
              });
            }
          } catch {
            // Silently retry on transient errors
            console.error('[useReportGenerator] Document status check error, retrying...');
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
   * Export save result with full response data
   */
  interface SaveExportResult {
    success: boolean;
    exports: { pdf?: string; pptx?: string };
    status?: string;
    gammaUrl?: string;
    message?: string;
    hint?: string;
    retryAfter?: number;
  }

  /**
   * Save exports (PDF/PPTX) to storage
   * @param generationId - The Gamma generation ID (NOT Hakivo's document ID)
   * @param formats - Array of export formats to request
   * @returns Full response including success status, exports, and hints
   */
  const saveExports = useCallback(
    async (generationId: string, formats: ('pdf' | 'pptx')[]): Promise<SaveExportResult | null> => {
      if (!accessToken) return null;

      updateState({
        phase: 'saving',
        progress: 90,
        message: 'Checking export availability...',
      });

      try {
        const response = await fetch(`/api/gamma/save/${generationId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ exportFormats: formats }),
        });

        const data = await response.json();

        // Check if exports are available
        const hasExports = data.exports && (data.exports.pdf || data.exports.pptx);

        if (hasExports) {
          updateState({
            phase: 'completed',
            progress: 100,
            message: 'Exports ready!',
          });
        } else {
          // Exports not ready yet - this is expected for recent documents
          updateState({
            phase: 'completed',
            progress: 100,
            message: data.message || 'Export check complete',
          });
        }

        return {
          success: data.success ?? hasExports,
          exports: data.exports || {},
          status: data.status,
          gammaUrl: data.gammaUrl,
          message: data.message,
          hint: data.hint,
          retryAfter: data.retryAfter,
        };
      } catch (error) {
        console.error('[useReportGenerator] Save exports error:', error);
        updateState({
          phase: 'completed',
          progress: 100,
          message: 'Export check failed',
        });
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
