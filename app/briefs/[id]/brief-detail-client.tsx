"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Play, Pause, Download, Loader2, ArrowLeft, ExternalLink, FileText, User, Calendar, Newspaper, Share2, Sparkles, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/lib/auth/auth-context"
import { ShareButtons } from "@/components/share-buttons"
import { useAudioPlayer, type AudioTrack } from "@/lib/audio/audio-player-context"
import ReactMarkdown, { Components } from "react-markdown"
import remarkGfm from "remark-gfm"

// Process content to enhance markdown formatting
function processContent(content: string): string {
  if (!content) return '';

  // Split into lines for processing
  let lines = content.split('\n');
  let processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Skip empty lines but preserve them
    if (!line) {
      processedLines.push('');
      continue;
    }

    // Detect potential subheadings:
    // - Lines that are relatively short (< 80 chars)
    // - Don't end with common sentence endings
    // - Are followed by longer content
    // - Start with capital letter
    // - Common patterns like "What X Would Do", "The Impact of", "Why This Matters"
    const isShortLine = line.length < 80;
    const doesntEndWithPunctuation = !/[.!?,;:]$/.test(line);
    const startsWithCapital = /^[A-Z]/.test(line);
    const nextLine = lines[i + 1]?.trim() || '';
    const isFollowedByContent = nextLine.length > 100 || (nextLine.length > 0 && /^[A-Z]/.test(nextLine));

    // Common heading patterns
    const headingPatterns = [
      /^What .+ Would Do$/i,
      /^Why .+ Matter/i,
      /^The (Impact|Future|State|Role|Case) (of|for)/i,
      /^How .+ (Works|Affects|Changes)/i,
      /^Looking (Ahead|Forward|Back)/i,
      /^Key (Takeaways|Points|Findings|Provisions)/i,
      /^In (Summary|Conclusion|Context)/i,
      /^Background(:)?$/i,
      /^(A )?(New|Growing|Emerging) .+$/i,
      /^The (Bottom Line|Big Picture)$/i,
      /^Next Steps$/i,
      /^What('s| is) at Stake/i,
      /^(State|Local|Federal|National) (Context|Implications|Impact)/i,
    ];

    const matchesHeadingPattern = headingPatterns.some(pattern => pattern.test(line));

    // Check if this looks like a heading
    const looksLikeHeading = (
      isShortLine &&
      doesntEndWithPunctuation &&
      startsWithCapital &&
      isFollowedByContent &&
      !line.startsWith('#') && // Not already a heading
      !line.startsWith('-') && // Not a list item
      !line.startsWith('*') &&
      !line.startsWith('>') && // Not a blockquote
      line.split(' ').length >= 2 && // At least 2 words
      line.split(' ').length <= 10 // Not too many words
    ) || matchesHeadingPattern;

    if (looksLikeHeading && !line.startsWith('#')) {
      // Add as h2 heading with extra spacing
      processedLines.push('');
      processedLines.push(`## ${line}`);
      processedLines.push('');
    } else {
      processedLines.push(line);
    }
  }

  // Join and ensure proper paragraph spacing
  let result = processedLines.join('\n');

  // Ensure double newlines between paragraphs (for proper markdown rendering)
  // Replace single newlines between text blocks with double newlines
  result = result.replace(/([.!?])\n(?=[A-Z])/g, '$1\n\n');

  // Clean up excessive newlines
  result = result.replace(/\n{4,}/g, '\n\n\n');

  // Convert bill references to links where possible
  // Match patterns like "HR 5969", "S. 123", "H.R. 456"
  // IMPORTANT: Don't match inside URLs (preceded by / or -)
  result = result.replace(
    /(?<![\/\-a-zA-Z])(H\.?R\.?|S\.?|H\.?J\.?\s*Res\.?|S\.?J\.?\s*Res\.?)\s*(\d+)\b/gi,
    (match, type, number) => {
      const billType = type.replace(/\./g, '').replace(/\s/g, '').toLowerCase();
      return `[${match}](/bills/119-${billType}-${number})`;
    }
  );

  return result;
}

// Custom components for ReactMarkdown
const markdownComponents: Components = {
  // Style links to open in new tab for external URLs
  a: ({ href, children, ...props }) => {
    const isInternal = href?.startsWith('/');

    if (isInternal) {
      return (
        <a
          href={href}
          className="text-sky-600 dark:text-sky-400 font-medium underline underline-offset-2 decoration-sky-400/50 hover:decoration-sky-400 transition-colors"
          {...props}
        >
          {children}
        </a>
      );
    }

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sky-600 dark:text-sky-400 font-medium underline underline-offset-2 decoration-sky-400/50 hover:decoration-sky-400 transition-colors inline-flex items-center gap-1"
        {...props}
      >
        {children}
        <svg className="h-3 w-3 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    );
  },
  // Enhanced paragraph styling - high contrast for accessibility
  p: ({ children, ...props }) => (
    <p className="mb-6 leading-8 text-foreground" {...props}>
      {children}
    </p>
  ),
  // Enhanced heading styles
  h2: ({ children, ...props }) => (
    <h2
      className="text-2xl font-serif font-bold mt-12 mb-6 pb-3 border-b border-border/50 text-foreground tracking-tight"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="text-xl font-serif font-semibold mt-10 mb-4 text-foreground tracking-tight"
      {...props}
    >
      {children}
    </h3>
  ),
  // Style strong/bold text
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-foreground" {...props}>
      {children}
    </strong>
  ),
  // Style lists - high contrast for accessibility
  ul: ({ children, ...props }) => (
    <ul className="my-6 ml-6 list-disc space-y-2 text-foreground" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-6 ml-6 list-decimal space-y-2 text-foreground" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-7" {...props}>
      {children}
    </li>
  ),
  // Style blockquotes - high contrast for accessibility
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-6 border-l-4 border-sky-500/50 bg-muted/30 py-3 px-5 rounded-r-lg text-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),
};

interface FeaturedBill {
  id: string;
  congress: number;
  billType: string;
  billNumber: number;
  title: string;
  policyArea: string | null;
  latestActionDate: string | null;
  latestActionText: string | null;
  sponsor: {
    name: string;
    party: string;
    state: string;
  };
  congressUrl: string;
}

interface NewsArticle {
  title: string;
  url: string;
  summary: string;
  source: string;
}

interface Brief {
  id: string;
  type: string;
  title: string;
  headline: string;
  status: string;
  audioUrl: string | null;
  audioDuration: number | null;
  featuredImage: string | null;
  createdAt: number;
  script?: string;
  content?: string;
  interests?: string[];
  featuredBills?: FeaturedBill[];
  newsArticles?: NewsArticle[];
}

export function BriefDetailClient() {
  const params = useParams()
  const id = params.id as string
  const { accessToken, isLoading: authLoading } = useAuth()
  const { play, pause, currentTrack, isPlaying } = useAudioPlayer()

  const [brief, setBrief] = useState<Brief | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isThisBriefPlaying = brief && currentTrack?.id === brief.id && isPlaying

  useEffect(() => {
    if (authLoading) return

    // Allow public viewing - fetch without requiring authentication
    fetchBrief()
  }, [id, accessToken, authLoading])

  const fetchBrief = async () => {
    try {
      // Build headers - include auth if available (for personalized features)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      const response = await fetch(`/api/briefs/${id}`, {
        headers,
      })

      if (!response.ok) {
        if (response.status === 404) {
          setError('Brief not found')
        } else {
          setError('Failed to load brief')
        }
        return
      }

      const data = await response.json()
      if (data.success && data.brief) {
        setBrief(data.brief)
      } else {
        setError('Failed to load brief')
      }
    } catch (err) {
      console.error('Error fetching brief:', err)
      setError('Failed to load brief')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handlePlayClick = () => {
    if (!brief?.audioUrl) return

    if (isThisBriefPlaying) {
      pause()
      return
    }

    const track: AudioTrack = {
      id: brief.id,
      title: brief.title,
      type: 'brief',
      audioUrl: brief.audioUrl,
      imageUrl: brief.featuredImage,
      duration: brief.audioDuration || undefined,
      createdAt: new Date(brief.createdAt).toISOString(),
    }

    play(track)
  }

  const getTranscript = () => {
    if (brief?.script) {
      return brief.script
    }
    return 'Transcript not available for this brief.'
  }

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen pb-32 px-6 md:px-8 py-8">
        <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  // Error state
  if (error || !brief) {
    return (
      <div className="min-h-screen pb-32 px-6 md:px-8 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Button variant="ghost" asChild>
            <Link href="/briefs" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Briefs
            </Link>
          </Button>
          <div className="text-center py-20">
            <p className="text-muted-foreground">{error || 'Brief not found'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-32">
      {/* Back button */}
      <div className="px-6 md:px-8 py-4">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" asChild>
            <Link href="/briefs" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Briefs
            </Link>
          </Button>
        </div>
      </div>

      {/* Hero Image - Full Width */}
      <div className="w-full aspect-[21/9] md:aspect-[3/1] overflow-hidden bg-muted">
        <img
          src={brief.featuredImage || "/us-capitol-building-congressional-legislation-brie.jpg"}
          alt={brief.title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Article Content */}
      <div className="px-6 md:px-8 py-8">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Article Header */}
          <header className="space-y-4 border-b border-border pb-6">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/20 font-medium">
                {brief.type === 'daily' ? 'Daily Brief' : 'Weekly Brief'}
              </Badge>
              <span>{formatDate(brief.createdAt)}</span>
              {brief.audioDuration && (
                <>
                  <span>•</span>
                  <span>{formatDuration(brief.audioDuration)} listen</span>
                </>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold tracking-tight leading-tight">
              {brief.title}
            </h1>

            {brief.interests && brief.interests.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {brief.interests.map((interest: string) => (
                  <Badge key={interest} variant="outline" className="capitalize text-xs">
                    {interest.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            )}

            {/* Share Buttons */}
            <div className="flex items-center gap-3 pt-4">
              <span className="text-sm text-muted-foreground">Share:</span>
              <ShareButtons
                url={typeof window !== "undefined" ? `${window.location.origin}/briefs/${id}` : `/briefs/${id}`}
                title={brief.title}
                description={brief.headline || `Congressional news brief from ${formatDate(brief.createdAt)}`}
                hashtags={["Hakivo", "Congress", "DailyBrief"]}
                variant="inline"
                size="sm"
              />
            </div>
          </header>

          {/* Audio Player - Compact */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border">
            <div className="flex-1">
              <p className="text-sm font-medium">Listen to this brief</p>
              <p className="text-xs text-muted-foreground">Audio version available</p>
            </div>
            {brief.audioUrl ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={handlePlayClick}
                >
                  {isThisBriefPlaying ? (
                    <>
                      <Pause className="mr-1 h-3 w-3 fill-current" />
                      Playing
                    </>
                  ) : (
                    <>
                      <Play className="mr-1 h-3 w-3 fill-current" />
                      Play
                    </>
                  )}
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={brief.audioUrl} download>
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            ) : (
              <Badge variant="outline" className="text-xs">Generating...</Badge>
            )}
          </div>

          {/* Article Body - Tabs for Written/Transcript */}
          <Tabs defaultValue="article" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 max-w-xs">
              <TabsTrigger value="article" className="text-sm">
                <Newspaper className="mr-2 h-4 w-4" />
                Article
              </TabsTrigger>
              <TabsTrigger value="transcript" className="text-sm">
                <FileText className="mr-2 h-4 w-4" />
                Transcript
              </TabsTrigger>
            </TabsList>

            <TabsContent value="article" className="mt-0">
              {brief.content ? (
                <article className="max-w-none">
                  {/* Lead paragraph styling for first paragraph */}
                  <style jsx global>{`
                    .brief-article > p:first-of-type {
                      font-size: 1.125rem;
                      line-height: 2;
                      color: hsl(var(--foreground));
                    }
                  `}</style>
                  <div className="brief-article">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {processContent(brief.content)}
                    </ReactMarkdown>
                  </div>
                </article>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Written article not available for this brief.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="transcript" className="mt-0">
              <div className="bg-muted/30 rounded-lg p-6 border">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4 font-medium">
                    Audio Transcript
                  </p>
                  <div className="whitespace-pre-wrap text-sm leading-7 text-foreground/90 font-mono">
                    {getTranscript()}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Featured Bills Section */}
          {brief.featuredBills && brief.featuredBills.length > 0 && (
            <section className="space-y-4 pt-6 border-t border-border">
              <h2 className="text-xl font-serif font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Featured Legislation
              </h2>
              <div className="grid gap-4">
                {brief.featuredBills.map((bill) => (
                  <Card key={bill.id} className="hover:bg-accent/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="font-mono text-xs">
                              {bill.billType.toUpperCase()} {bill.billNumber}
                            </Badge>
                            {bill.policyArea && (
                              <Badge variant="outline" className="text-xs">
                                {bill.policyArea}
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-medium leading-snug">
                            {bill.title}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{bill.sponsor.name} ({bill.sponsor.party}-{bill.sponsor.state})</span>
                          </div>
                          {bill.latestActionText && (
                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium">Latest:</span> {bill.latestActionText}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 md:flex-col">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/bills/${bill.id}`}>
                              View Details
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <a href={bill.congressUrl} target="_blank" rel="noopener noreferrer">
                              Congress.gov <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* News Articles Section */}
          {brief.newsArticles && brief.newsArticles.length > 0 && (
            <section className="space-y-4 pt-6 border-t border-border">
              <h2 className="text-xl font-serif font-bold">Related News</h2>
              <div className="grid gap-3">
                {brief.newsArticles.map((article, idx) => (
                  <a
                    key={idx}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="font-medium group-hover:text-primary transition-colors line-clamp-2">
                        {article.title}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {article.summary}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        {article.source}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* AI Disclosure Footer */}
          <footer className="mt-8 pt-6 border-t border-border">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <Sparkles className="h-5 w-5 flex-shrink-0 text-primary/70 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-foreground/80">Generated with AI</p>
                <p>
                  This brief was created using artificial intelligence to summarize congressional news and legislation.
                  While we strive for accuracy, please verify any facts before sharing or acting on this information.
                  Sources are linked throughout for your reference.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
