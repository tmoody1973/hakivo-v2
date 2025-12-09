'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArtifactViewer, type Artifact } from '@/components/artifacts';

interface PublicArtifact {
  id: string;
  type: 'report' | 'slides';
  template: string;
  title: string;
  content: string;
  subjectType?: string;
  subjectId?: string;
  audience?: string;
  shareToken: string;
  viewCount: number;
  createdAt: string;
}

export default function PublicArtifactPage() {
  const params = useParams();
  const token = params.token as string;

  const [artifact, setArtifact] = useState<PublicArtifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArtifact = async () => {
      try {
        const response = await fetch(`/api/artifacts/public?token=${token}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to load artifact');
          return;
        }

        setArtifact(data.artifact);
      } catch (err) {
        console.error('Error fetching artifact:', err);
        setError('Failed to load artifact');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchArtifact();
    }
  }, [token]);

  // Get template display name
  const getTemplateLabel = (template: string) => {
    const labels: Record<string, string> = {
      bill_analysis: 'Bill Analysis',
      rep_scorecard: 'Rep Scorecard',
      vote_breakdown: 'Vote Breakdown',
      policy_brief: 'Policy Brief',
      lesson_deck: 'Lesson Deck',
      advocacy_deck: 'Advocacy Deck',
      news_brief: 'News Brief',
      district_briefing: 'District Briefing',
      week_in_congress: 'Week in Congress',
      bill_comparison: 'Bill Comparison',
      voting_analysis: 'Voting Analysis',
    };
    return labels[template] || template;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
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
            <svg
              className="w-8 h-8 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Document Not Available</h1>
          <p className="text-muted-foreground mb-6">
            {error === 'Artifact not found'
              ? "This document doesn't exist or has been deleted."
              : error === 'This artifact is not publicly shared'
              ? 'This document is private and cannot be viewed.'
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

  // No artifact
  if (!artifact) {
    return null;
  }

  // Convert to Artifact type for viewer
  const viewerArtifact: Artifact = {
    id: artifact.id,
    type: artifact.type,
    template: artifact.template,
    title: artifact.title,
    content: artifact.content,
    subjectType: artifact.subjectType,
    subjectId: artifact.subjectId,
    audience: artifact.audience,
    shareToken: artifact.shareToken,
    createdAt: artifact.createdAt,
    viewCount: artifact.viewCount,
    isPublic: true,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">H</span>
              </div>
              <span className="font-semibold text-lg">Hakivo</span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {artifact.viewCount} view{artifact.viewCount !== 1 ? 's' : ''}
              </span>
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

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Document header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <span className="px-2 py-0.5 bg-muted rounded">
              {getTemplateLabel(artifact.template)}
            </span>
            <span>
              {new Date(artifact.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <h1 className="text-3xl font-bold">{artifact.title}</h1>
        </div>

        {/* Artifact viewer (read-only) */}
        <ArtifactViewer
          artifact={viewerArtifact}
          showHeader={false}
          showActions={false}
          readOnly={true}
          className="shadow-lg"
        />

        {/* CTA section */}
        <div className="mt-12 text-center py-12 border-t">
          <h2 className="text-2xl font-bold mb-3">Stay Informed on Policy</h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Hakivo helps you track legislation, understand policy, and create professional
            documents about Congress and your representatives.
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
      </main>

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
