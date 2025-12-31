'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Presentation,
  Globe,
  Download,
  ExternalLink,
  Loader2,
  Clock,
  FolderOpen,
  AlertCircle,
  RefreshCw,
  Trash2,
  Eye,
} from 'lucide-react';

/**
 * Document from gamma_documents table
 */
export interface GammaDocument {
  id: string;
  user_id: string;
  gamma_generation_id: string;
  gamma_url: string | null;
  gamma_thumbnail_url: string | null;
  title: string;
  format: 'presentation' | 'document' | 'webpage';
  template: string | null;
  card_count: number;
  pdf_url: string | null;
  pptx_url: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  subject_type: string | null;
  subject_id: string | null;
  created_at: number;
  updated_at: number;
}

interface StudioLibraryProps {
  onCreateNew: () => void;
  onSelectDocument?: (doc: GammaDocument) => void;
  className?: string;
}

const FORMAT_ICONS = {
  presentation: Presentation,
  document: FileText,
  webpage: Globe,
};

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

/**
 * Extract presentation ID from Gamma URL for embed
 * Note: Gamma uses Iframely for embedding. Direct embed URLs don't work.
 * We'll use the share/present mode instead.
 */
function getPresentUrl(gammaUrl: string | null): string | null {
  if (!gammaUrl) return null;

  try {
    // Gamma URLs look like: https://gamma.app/docs/Title-abc123xyz
    // Present mode URL: https://gamma.app/docs/Title-abc123xyz?mode=present
    const url = new URL(gammaUrl);
    url.searchParams.set('mode', 'present');
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp * 1000; // Convert to ms if needed

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function StudioLibrary({ onCreateNew, onSelectDocument, className }: StudioLibraryProps) {
  const { accessToken } = useAuth();
  const [documents, setDocuments] = useState<GammaDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/gamma/documents', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load documents');
      }

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('[StudioLibrary] Error fetching documents:', err);
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleViewInGamma = (doc: GammaDocument) => {
    if (doc.gamma_url) {
      window.open(doc.gamma_url, '_blank');
    }
  };

  const handleDownload = async (doc: GammaDocument, format: 'pdf' | 'pptx') => {
    const url = format === 'pdf' ? doc.pdf_url : doc.pptx_url;
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handlePreview = (doc: GammaDocument) => {
    // Open in Gamma's present mode for a fullscreen preview
    const presentUrl = getPresentUrl(doc.gamma_url);
    if (presentUrl) {
      window.open(presentUrl, '_blank');
    } else if (doc.gamma_url) {
      window.open(doc.gamma_url, '_blank');
    }
    if (onSelectDocument) {
      onSelectDocument(doc);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('text-center py-12', className)}>
        <AlertCircle className="h-12 w-12 mx-auto text-destructive/60 mb-4" />
        <h3 className="text-lg font-medium mb-2">Failed to Load Documents</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={fetchDocuments} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  // Empty state
  if (documents.length === 0) {
    return (
      <div className={cn('text-center py-12', className)}>
        <div className="w-16 h-16 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-4">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No Documents Yet</h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          Create your first professional document from legislative data using Hakivo Studio.
        </p>
        <Button onClick={onCreateNew} className="gap-2">
          <FileText className="h-4 w-4" />
          Create Your First Document
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Your Documents</h2>
          <p className="text-sm text-muted-foreground">
            {documents.length} document{documents.length !== 1 ? 's' : ''} generated
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDocuments} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={onCreateNew} className="gap-2">
            <FileText className="h-4 w-4" />
            New Document
          </Button>
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {documents.map((doc) => {
          const FormatIcon = FORMAT_ICONS[doc.format] || FileText;

          return (
            <Card
              key={doc.id}
              className="overflow-hidden transition-all hover:shadow-md cursor-pointer"
            >
              {/* Thumbnail / Preview */}
              <div
                className="relative aspect-video bg-muted"
                onClick={() => handlePreview(doc)}
              >
                {doc.gamma_thumbnail_url ? (
                  <img
                    src={doc.gamma_thumbnail_url}
                    alt={doc.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FormatIcon className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                )}

                {/* Preview overlay - opens in Gamma's present mode */}
                <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                  <Button variant="secondary" size="sm" className="gap-2">
                    <Eye className="h-4 w-4" />
                    Preview
                  </Button>
                </div>

                {/* Status badge */}
                {doc.status !== 'completed' && (
                  <div className="absolute top-2 right-2">
                    <Badge className={cn('text-xs', STATUS_COLORS[doc.status])}>
                      {doc.status === 'processing' && (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      )}
                      {doc.status}
                    </Badge>
                  </div>
                )}
              </div>

              <CardContent className="p-4">
                {/* Title */}
                <h3 className="font-medium line-clamp-2 mb-2">{doc.title}</h3>

                {/* Meta info */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <FormatIcon className="h-3.5 w-3.5" />
                    <span className="capitalize">{doc.format}</span>
                  </div>
                  {doc.card_count > 0 && (
                    <span>{doc.card_count} slides</span>
                  )}
                  <div className="flex items-center gap-1 ml-auto">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatRelativeTime(doc.created_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {doc.gamma_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewInGamma(doc);
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View in Gamma
                    </Button>
                  )}
                  {doc.pdf_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(doc, 'pdf');
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
