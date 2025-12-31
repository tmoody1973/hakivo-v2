'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  FileText,
  Newspaper,
  Wand2,
  Download,
  ExternalLink,
  RefreshCw,
  X,
} from 'lucide-react';
import type { GenerationState, GenerationResult } from '@/hooks/useReportGenerator';

/**
 * Convert Gamma docs URL to embed URL for iframe preview
 * Example input: https://gamma.app/docs/Texas-Redefines-Privacy-s57ul9u5xrcwq68?mode=doc
 * Example output: https://gamma.app/embed/s57ul9u5xrcwq68
 */
function getEmbedUrl(gammaUrl: string | undefined): string | null {
  if (!gammaUrl) return null;

  try {
    const url = new URL(gammaUrl);
    const pathParts = url.pathname.split('/');
    // Path is like /docs/Title-Here-docId
    const docPath = pathParts[pathParts.length - 1];
    // Extract doc ID - it's after the last hyphen
    const lastHyphenIndex = docPath.lastIndexOf('-');
    if (lastHyphenIndex === -1) return null;
    const docId = docPath.substring(lastHyphenIndex + 1);
    return `https://gamma.app/embed/${docId}`;
  } catch {
    return null;
  }
}

interface GenerationProgressProps {
  state: GenerationState;
  result?: GenerationResult;
  onCancel?: () => void;
  onRetry?: () => void;
  onViewDocument?: () => void;
  onDownload?: (format: 'pdf' | 'pptx') => void;
  className?: string;
}

const PHASE_CONFIG = {
  idle: {
    icon: Sparkles,
    label: 'Ready',
    description: 'Ready to generate your document',
    color: 'text-muted-foreground',
  },
  enriching: {
    icon: Newspaper,
    label: 'Enriching',
    description: 'Gathering data from multiple sources...',
    color: 'text-orange-600',
  },
  generating: {
    icon: Wand2,
    label: 'Generating',
    description: 'Creating your document with Gamma...',
    color: 'text-blue-600',
  },
  processing: {
    icon: Loader2,
    label: 'Processing',
    description: 'Finalizing your document...',
    color: 'text-purple-600',
  },
  saving: {
    icon: Download,
    label: 'Saving',
    description: 'Saving export files...',
    color: 'text-green-600',
  },
  completed: {
    icon: CheckCircle2,
    label: 'Complete',
    description: 'Your document is ready!',
    color: 'text-green-600',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    description: 'Something went wrong',
    color: 'text-destructive',
  },
};

export function GenerationProgress({
  state,
  result,
  onCancel,
  onRetry,
  onViewDocument,
  onDownload,
  className,
}: GenerationProgressProps) {
  const config = PHASE_CONFIG[state.phase];
  const Icon = config.icon;
  const isLoading = ['enriching', 'generating', 'processing', 'saving'].includes(state.phase);

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Progress bar at top */}
      {state.progress > 0 && state.progress < 100 && (
        <Progress value={state.progress} className="h-1 rounded-none" />
      )}

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center',
                state.phase === 'completed'
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : state.phase === 'failed'
                  ? 'bg-red-100 dark:bg-red-900/30'
                  : 'bg-muted'
              )}
            >
              <Icon
                className={cn('h-5 w-5', config.color, isLoading && 'animate-spin')}
              />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {config.label}
                {isLoading && (
                  <Badge variant="secondary" className="text-xs">
                    {state.progress}%
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {state.message || config.description}
              </CardDescription>
            </div>
          </div>

          {/* Cancel button during processing */}
          {isLoading && onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Progress steps */}
        {isLoading && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center text-xs',
                  state.phase === 'enriching'
                    ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30'
                    : state.progress > 25
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {state.progress > 25 ? <CheckCircle2 className="h-3.5 w-3.5" /> : '1'}
              </div>
              <span
                className={cn(
                  'text-sm',
                  state.phase === 'enriching' ? 'font-medium' : 'text-muted-foreground'
                )}
              >
                Enrich content with external data
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center text-xs',
                  state.phase === 'generating'
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
                    : state.progress > 50
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {state.progress > 50 ? <CheckCircle2 className="h-3.5 w-3.5" /> : '2'}
              </div>
              <span
                className={cn(
                  'text-sm',
                  state.phase === 'generating' ? 'font-medium' : 'text-muted-foreground'
                )}
              >
                Generate document with Gamma AI
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center text-xs',
                  state.phase === 'processing'
                    ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30'
                    : state.progress > 75
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {state.progress > 75 ? <CheckCircle2 className="h-3.5 w-3.5" /> : '3'}
              </div>
              <span
                className={cn(
                  'text-sm',
                  state.phase === 'processing' ? 'font-medium' : 'text-muted-foreground'
                )}
              >
                Process and finalize
              </span>
            </div>
          </div>
        )}

        {/* Error state */}
        {state.phase === 'failed' && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {state.error || 'An error occurred during generation'}
            </div>
            {onRetry && (
              <Button variant="outline" onClick={onRetry} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            )}
          </div>
        )}

        {/* Completed state */}
        {state.phase === 'completed' && result && (
          <div className="space-y-4">
            {/* Iframe Preview */}
            {getEmbedUrl(result.url) ? (
              <div className="rounded-lg overflow-hidden border bg-muted/30">
                <iframe
                  src={getEmbedUrl(result.url)!}
                  className="w-full aspect-[16/10]"
                  allow="fullscreen"
                  title={result.title || 'Document Preview'}
                />
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">Preview not available</p>
                <p className="text-amber-600 dark:text-amber-400 mt-1">
                  The document URL was not returned by Gamma. Check server logs for details.
                  {result.generationId && (
                    <span className="block mt-1 font-mono text-xs">
                      Generation ID: {result.generationId}
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Document info */}
            <div className="flex items-center gap-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              {result.thumbnailUrl ? (
                <img
                  src={result.thumbnailUrl}
                  alt="Document thumbnail"
                  className="w-20 h-14 object-cover rounded"
                />
              ) : (
                <div className="w-20 h-14 bg-muted rounded flex items-center justify-center">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{result.title || 'Your Document'}</p>
                <p className="text-sm text-muted-foreground">
                  {result.cardCount ? `${result.cardCount} slides generated` : 'Document generated'}
                </p>
              </div>
            </div>

            {/* Enrichment summary */}
            {result.enrichment && result.enrichment.sourcesUsed.length > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">Enriched with: </span>
                {result.enrichment.sourcesUsed.map((source, i) => (
                  <Badge key={i} variant="secondary" className="text-xs mr-1">
                    {source}
                  </Badge>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {result.url && onViewDocument && (
                <Button onClick={onViewDocument} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  View in Gamma
                </Button>
              )}
              {onDownload && (
                <Button variant="outline" onClick={() => onDownload('pdf')} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Idle state - no content needed */}
      </CardContent>
    </Card>
  );
}
