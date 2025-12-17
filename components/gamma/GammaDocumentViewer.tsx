"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Download,
  ExternalLink,
  Share2,
  Copy,
  Check,
  X,
  Maximize2,
  Minimize2,
  Loader2,
  FileText,
  Presentation,
  Globe,
  AlertCircle,
} from "lucide-react";

interface GammaDocument {
  id: string;
  title: string;
  format: "presentation" | "document" | "webpage";
  status: "pending" | "processing" | "completed" | "failed";
  gamma_url?: string;
  gamma_embed_url?: string;
  gamma_thumbnail_url?: string;
  pdf_url?: string;
  pptx_url?: string;
  is_public?: boolean;
  share_token?: string;
  card_count?: number;
  view_count?: number;
  created_at: string;
  updated_at: string;
}

interface GammaDocumentViewerProps {
  document: GammaDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onShare?: (isPublic: boolean) => Promise<void>;
}

export function GammaDocumentViewer({
  document,
  isOpen,
  onClose,
  onShare,
}: GammaDocumentViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Reset states when document changes or modal opens
  useEffect(() => {
    if (isOpen && document) {
      setIframeLoading(true);
      setIframeError(false);
      setCopied(false);
    }
  }, [isOpen, document?.id]);

  const handleIframeLoad = useCallback(() => {
    setIframeLoading(false);
  }, []);

  const handleIframeError = useCallback(() => {
    setIframeLoading(false);
    setIframeError(true);
  }, []);

  const copyShareLink = useCallback(async () => {
    if (!document) return;

    const shareUrl = document.gamma_url ||
      (document.share_token && `${window.location.origin}/gamma/${document.share_token}`);

    if (shareUrl) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }
  }, [document]);

  const handleShare = useCallback(async () => {
    if (!document || !onShare) return;
    setSharing(true);
    try {
      await onShare(!document.is_public);
    } finally {
      setSharing(false);
    }
  }, [document, onShare]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const getFormatIcon = (format: string) => {
    switch (format) {
      case "presentation":
        return <Presentation className="h-5 w-5" />;
      case "document":
        return <FileText className="h-5 w-5" />;
      case "webpage":
        return <Globe className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getEmbedUrl = () => {
    if (!document) return null;

    // Use embed URL if available
    if (document.gamma_embed_url) {
      return document.gamma_embed_url;
    }

    // Convert gamma_url to embed URL
    // Gamma URLs typically look like: https://gamma.app/docs/xyz
    // Embed URLs are: https://gamma.app/embed/xyz
    if (document.gamma_url) {
      return document.gamma_url.replace("/docs/", "/embed/");
    }

    return null;
  };

  if (!document) return null;

  const embedUrl = getEmbedUrl();
  const isProcessing = document.status === "processing" || document.status === "pending";
  const hasFailed = document.status === "failed";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={`${
          isFullscreen
            ? "w-screen h-screen max-w-none rounded-none"
            : "max-w-5xl h-[85vh]"
        } flex flex-col p-0 gap-0`}
      >
        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-4 py-3 border-b flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              {getFormatIcon(document.format)}
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {document.title}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {document.format.charAt(0).toUpperCase() + document.format.slice(1)}
                {document.card_count ? ` • ${document.card_count} slides` : ""}
                {document.view_count ? ` • ${document.view_count} views` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Open in Gamma */}
            {document.gamma_url && document.status === "completed" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(document.gamma_url, "_blank")}
                title="Open in Gamma"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}

            {/* Download PDF */}
            {document.pdf_url && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(document.pdf_url, "_blank")}
                className="text-red-600 hover:text-red-700"
                title="Download PDF"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}

            {/* Download PPTX */}
            {document.pptx_url && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(document.pptx_url, "_blank")}
                className="text-orange-600 hover:text-orange-700"
                title="Download PowerPoint"
              >
                <Presentation className="h-4 w-4" />
              </Button>
            )}

            {/* Share Toggle */}
            {onShare && document.status === "completed" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                disabled={sharing}
                className={document.is_public ? "text-green-600" : ""}
                title={document.is_public ? "Make Private" : "Share Document"}
              >
                {sharing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Copy Link */}
            {(document.gamma_url || document.share_token) && document.status === "completed" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={copyShareLink}
                title={copied ? "Copied!" : "Copy Link"}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Fullscreen Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>

            {/* Close */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 relative overflow-hidden bg-muted/30">
          {/* Processing State */}
          {isProcessing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <h3 className="font-semibold text-lg">Generating Document...</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This may take a minute or two.
                </p>
              </div>
            </div>
          )}

          {/* Failed State */}
          {hasFailed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background">
              <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg">Generation Failed</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  There was an error generating this document.
                </p>
              </div>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          )}

          {/* Iframe Loading State */}
          {!isProcessing && !hasFailed && iframeLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading preview...</p>
            </div>
          )}

          {/* Iframe Error State */}
          {!isProcessing && !hasFailed && iframeError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <h3 className="font-semibold">Preview Unavailable</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Unable to load the document preview.
                </p>
              </div>
              <div className="flex gap-2">
                {document.gamma_url && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(document.gamma_url, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in Gamma
                  </Button>
                )}
                {document.pdf_url && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(document.pdf_url, "_blank")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Gamma Embed Iframe */}
          {!isProcessing && !hasFailed && embedUrl && (
            <iframe
              src={embedUrl}
              className={`w-full h-full border-0 ${iframeLoading ? "invisible" : "visible"}`}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              allow="fullscreen"
              title={document.title}
            />
          )}

          {/* No Embed URL Fallback */}
          {!isProcessing && !hasFailed && !embedUrl && document.status === "completed" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background">
              {document.gamma_thumbnail_url ? (
                <img
                  src={document.gamma_thumbnail_url}
                  alt={document.title}
                  className="max-w-md max-h-64 rounded-lg shadow-lg object-contain"
                />
              ) : (
                <div className="h-32 w-48 rounded-lg bg-muted flex items-center justify-center">
                  {getFormatIcon(document.format)}
                </div>
              )}
              <div className="text-center">
                <h3 className="font-semibold">Preview Not Available</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  View or download the document using the buttons below.
                </p>
              </div>
              <div className="flex gap-2">
                {document.gamma_url && (
                  <Button
                    onClick={() => window.open(document.gamma_url, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in Gamma
                  </Button>
                )}
                {document.pdf_url && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(document.pdf_url, "_blank")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Status Badge */}
        {document.is_public && (
          <div className="flex-shrink-0 px-4 py-2 border-t bg-green-50 dark:bg-green-900/10">
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <Share2 className="h-4 w-4" />
              <span>This document is publicly shared</span>
              <button
                onClick={copyShareLink}
                className="ml-auto underline hover:no-underline"
              >
                {copied ? "Copied!" : "Copy share link"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Export type for use in other components
export type { GammaDocument };
