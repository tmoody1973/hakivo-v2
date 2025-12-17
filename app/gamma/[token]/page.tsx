'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Download,
  ExternalLink,
  FileText,
  Presentation,
  Globe,
  Eye,
  Calendar,
  User,
  Loader2,
  AlertCircle,
  Share2,
  Copy,
  Check,
  Twitter,
  Linkedin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SharedGammaDocument {
  id: string;
  title: string;
  format: 'presentation' | 'document' | 'webpage';
  template?: string;
  cardCount?: number;
  gammaUrl?: string;
  thumbnailUrl?: string;
  pdfUrl?: string;
  pptxUrl?: string;
  subjectType?: string;
  subjectId?: string;
  audience?: string;
  viewCount: number;
  createdAt: string;
  author?: string;
}

export default function PublicGammaPage() {
  const params = useParams();
  const token = params.token as string;

  const [document, setDocument] = useState<SharedGammaDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        // Fetch document
        const response = await fetch(`/api/gamma/share/${token}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to load document');
          return;
        }

        setDocument(data.document);

        // Track view (fire and forget)
        fetch(`/api/gamma/share/${token}`, { method: 'POST' }).catch(() => {});
      } catch (err) {
        console.error('Error fetching document:', err);
        setError('Failed to load document');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchDocument();
    }
  }, [token]);

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'presentation':
        return <Presentation className="h-5 w-5" />;
      case 'document':
        return <FileText className="h-5 w-5" />;
      case 'webpage':
        return <Globe className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getFormatLabel = (format: string) => {
    switch (format) {
      case 'presentation':
        return 'Presentation';
      case 'document':
        return 'Document';
      case 'webpage':
        return 'Webpage';
      default:
        return format;
    }
  };

  const getTemplateLabel = (template?: string) => {
    if (!template) return null;
    const labels: Record<string, string> = {
      policy_brief: 'Policy Brief',
      lesson_guide: 'Lesson Guide',
      advocacy_deck: 'Advocacy Deck',
      citizen_guide: 'Citizen Guide',
    };
    return labels[template] || template.replace(/_/g, ' ');
  };

  const getEmbedUrl = () => {
    if (!document?.gammaUrl) return null;
    // Convert gamma_url to embed URL
    // Gamma URLs typically look like: https://gamma.app/docs/xyz
    // Embed URLs are: https://gamma.app/embed/xyz
    return document.gammaUrl.replace('/docs/', '/embed/');
  };

  const handleCopyLink = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSocialShare = (platform: 'twitter' | 'linkedin') => {
    if (!document) return;
    const url = encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '');
    const text = encodeURIComponent(`Check out this ${document.format}: ${document.title}`);

    let shareLink = '';
    if (platform === 'twitter') {
      shareLink = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    } else if (platform === 'linkedin') {
      shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    }

    if (shareLink) {
      window.open(shareLink, '_blank', 'width=600,height=400');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Document Not Available</h1>
          <p className="text-muted-foreground mb-6">
            {error === 'Document not found or not public'
              ? "This document doesn't exist, has been deleted, or is private."
              : error}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Go to Hakivo
          </Link>
        </div>
      </div>
    );
  }

  if (!document) {
    return null;
  }

  const embedUrl = getEmbedUrl();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">H</span>
              </div>
              <span className="font-semibold text-lg">Hakivo</span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span>{document.viewCount + 1}</span>
              </div>
              <Link
                href="/"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
              >
                Try Hakivo Free
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Document Info */}
      <div className="border-b bg-card/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-muted rounded">
                  {getFormatIcon(document.format)}
                  <span>{getFormatLabel(document.format)}</span>
                </span>
                {getTemplateLabel(document.template) && (
                  <span className="px-2 py-0.5 bg-muted rounded">
                    {getTemplateLabel(document.template)}
                  </span>
                )}
                {document.cardCount && (
                  <span className="flex items-center gap-1">
                    <Presentation className="h-3.5 w-3.5" />
                    {document.cardCount} slides
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold">{document.title}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {document.author && (
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {document.author}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(document.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Share buttons */}
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Link
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSocialShare('twitter')}
              >
                <Twitter className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSocialShare('linkedin')}
              >
                <Linkedin className="h-4 w-4" />
              </Button>

              {/* Download buttons */}
              {document.pdfUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(document.pdfUrl, '_blank')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  PDF
                </Button>
              )}
              {document.pptxUrl && document.format === 'presentation' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(document.pptxUrl, '_blank')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  PPTX
                </Button>
              )}

              {/* Open in Gamma */}
              {document.gammaUrl && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => window.open(document.gammaUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open in Gamma
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content - Gamma embed */}
      <main className="flex-1 bg-muted/30">
        <div className="relative w-full" style={{ minHeight: 'calc(100vh - 280px)' }}>
          {/* Loading state for iframe */}
          {embedUrl && iframeLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading presentation...</p>
            </div>
          )}

          {/* Gamma Embed */}
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className={`w-full h-full border-0 ${iframeLoading ? 'invisible' : 'visible'}`}
              style={{ minHeight: 'calc(100vh - 280px)' }}
              onLoad={() => setIframeLoading(false)}
              allow="fullscreen"
              title={document.title}
            />
          ) : (
            // Fallback when no embed URL available
            <div className="flex flex-col items-center justify-center gap-6 py-16">
              {document.thumbnailUrl ? (
                <img
                  src={document.thumbnailUrl}
                  alt={document.title}
                  className="max-w-lg max-h-80 rounded-lg shadow-lg object-contain"
                />
              ) : (
                <div className="h-48 w-64 rounded-lg bg-muted flex items-center justify-center">
                  {getFormatIcon(document.format)}
                </div>
              )}
              <div className="text-center">
                <h3 className="font-semibold text-lg">Preview Not Available</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  View or download the document using the buttons above.
                </p>
                {document.gammaUrl && (
                  <Button onClick={() => window.open(document.gammaUrl, '_blank')}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in Gamma
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* CTA section */}
      <section className="bg-card border-t">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h2 className="text-2xl font-bold mb-3">Create Your Own Professional Documents</h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Hakivo helps you understand legislation and create beautiful presentations,
            policy briefs, and educational materials about Congress.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
            >
              Get Started Free
            </Link>
            <Link
              href="/"
              className="px-6 py-3 border rounded-md hover:bg-accent font-medium"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">H</span>
              </div>
              <span>&copy; {new Date().getFullYear()} Hakivo. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-foreground">
                Terms
              </Link>
              <Link href="/contact" className="hover:text-foreground">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
