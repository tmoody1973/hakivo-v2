'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ExternalLink,
  Download,
  Share2,
  Copy,
  Check,
  Mail,
  Link2,
  FileText,
  Presentation,
  MoreVertical,
  Eye,
  Trash2,
  Clock,
  Layers,
} from 'lucide-react';
import type { GenerationResult } from '@/hooks/useReportGenerator';

interface ResultViewerProps {
  result: GenerationResult;
  onViewInGamma?: () => void;
  onDownload?: (format: 'pdf' | 'pptx') => void;
  onShare?: (method: 'link' | 'email', data?: { email: string; message?: string }) => void;
  onDelete?: () => void;
  className?: string;
}

export function ResultViewer({
  result,
  onViewInGamma,
  onDownload,
  onShare,
  onDelete,
  className,
}: ResultViewerProps) {
  const [copied, setCopied] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareMessage, setShareMessage] = useState('');

  const shareUrl = result.url || `https://hakivo.com/gamma/${result.documentId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleEmailShare = () => {
    if (shareEmail && onShare) {
      onShare('email', { email: shareEmail, message: shareMessage });
      setShareEmail('');
      setShareMessage('');
    }
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Thumbnail/Preview */}
      <div className="relative bg-gradient-to-br from-primary/10 to-primary/5">
        {result.thumbnailUrl ? (
          <div className="aspect-video relative">
            <img
              src={result.thumbnailUrl}
              alt={result.title || 'Document preview'}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <h3 className="text-white font-semibold text-lg truncate">
                {result.title || 'Your Document'}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                {result.cardCount && (
                  <Badge variant="secondary" className="bg-white/20 text-white border-0">
                    <Layers className="h-3 w-3 mr-1" />
                    {result.cardCount} slides
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="aspect-video flex items-center justify-center">
            <div className="text-center">
              <Presentation className="h-16 w-16 mx-auto text-primary/40 mb-3" />
              <h3 className="font-semibold text-lg">{result.title || 'Your Document'}</h3>
              {result.cardCount && (
                <p className="text-sm text-muted-foreground mt-1">
                  {result.cardCount} slides generated
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Enrichment info */}
        {result.enrichment && result.enrichment.sourcesUsed.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground">Enriched with:</span>
            {result.enrichment.sourcesUsed.map((source, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {source}
              </Badge>
            ))}
          </div>
        )}

        {/* Primary Actions */}
        <div className="flex gap-2">
          {result.url && (
            <Button onClick={onViewInGamma} className="flex-1 gap-2">
              <ExternalLink className="h-4 w-4" />
              View in Gamma
            </Button>
          )}

          {/* Download dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onDownload?.('pdf')}
                disabled={!result.exports?.pdf}
              >
                <FileText className="h-4 w-4 mr-2" />
                Download PDF
                {!result.exports?.pdf && (
                  <span className="ml-2 text-xs text-muted-foreground">(generating...)</span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDownload?.('pptx')}
                disabled={!result.exports?.pptx}
              >
                <Presentation className="h-4 w-4 mr-2" />
                Download PowerPoint
                {!result.exports?.pptx && (
                  <span className="ml-2 text-xs text-muted-foreground">(generating...)</span>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Share dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Share2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Share Document</DialogTitle>
                <DialogDescription>
                  Share your document via link or email
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Copy link */}
                <div className="space-y-2">
                  <Label>Share Link</Label>
                  <div className="flex gap-2">
                    <Input
                      value={shareUrl}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyLink}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Email share */}
                <div className="space-y-2">
                  <Label>Send via Email</Label>
                  <Input
                    type="email"
                    placeholder="recipient@example.com"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                  />
                  <Input
                    placeholder="Add a message (optional)"
                    value={shareMessage}
                    onChange={(e) => setShareMessage(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleEmailShare} disabled={!shareEmail}>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* More options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopyLink}>
                <Link2 className="h-4 w-4 mr-2" />
                Copy Link
              </DropdownMenuItem>
              {result.url && (
                <DropdownMenuItem onClick={onViewInGamma}>
                  <Eye className="h-4 w-4 mr-2" />
                  View in Gamma
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Document
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact result card for document lists
 */
interface ResultCardProps {
  document: {
    id: string;
    title: string;
    format: string;
    template?: string;
    status: string;
    gamma_url?: string;
    gamma_thumbnail_url?: string;
    pdf_url?: string;
    pptx_url?: string;
    card_count?: number;
    created_at: number;
    view_count?: number;
  };
  onClick?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function ResultCard({ document, onClick, onDelete, className }: ResultCardProps) {
  const createdDate = new Date(document.created_at);
  const timeAgo = getTimeAgo(createdDate);

  return (
    <Card
      className={cn(
        'cursor-pointer hover:shadow-md transition-all group',
        className
      )}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="aspect-video relative bg-muted overflow-hidden">
        {document.gamma_thumbnail_url ? (
          <img
            src={document.gamma_thumbnail_url}
            alt={document.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {document.format === 'presentation' ? (
              <Presentation className="h-12 w-12 text-muted-foreground/50" />
            ) : (
              <FileText className="h-12 w-12 text-muted-foreground/50" />
            )}
          </div>
        )}

        {/* Status badge */}
        {document.status !== 'completed' && (
          <Badge
            variant={document.status === 'pending' ? 'secondary' : 'destructive'}
            className="absolute top-2 right-2"
          >
            {document.status}
          </Badge>
        )}
      </div>

      <CardContent className="p-3">
        <h4 className="font-medium text-sm truncate">{document.title}</h4>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{timeAgo}</span>
          {document.card_count && (
            <>
              <span>•</span>
              <Layers className="h-3 w-3" />
              <span>{document.card_count} slides</span>
            </>
          )}
          {document.view_count !== undefined && document.view_count > 0 && (
            <>
              <span>•</span>
              <Eye className="h-3 w-3" />
              <span>{document.view_count} views</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Get relative time string
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
