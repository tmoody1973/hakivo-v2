"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Play, Pause, Download, Loader2, ArrowLeft, ExternalLink, FileText, User, Calendar, Newspaper } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/lib/auth/auth-context"
import { useAudioPlayer, type AudioTrack } from "@/lib/audio/audio-player-context"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

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

export default function BriefDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { accessToken, isAuthenticated, isLoading: authLoading } = useAuth()
  const { play, pause, currentTrack, isPlaying } = useAudioPlayer()

  const [brief, setBrief] = useState<Brief | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isThisBriefPlaying = brief && currentTrack?.id === brief.id && isPlaying

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated || !accessToken) {
      setIsLoading(false)
      setError('Please log in to view briefs')
      return
    }

    fetchBrief()
  }, [id, isAuthenticated, accessToken, authLoading])

  const fetchBrief = async () => {
    try {
      const response = await fetch(`/api/briefs/${id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
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
                <article className="prose prose-lg prose-slate dark:prose-invert max-w-none
                  prose-headings:font-serif prose-headings:font-bold prose-headings:tracking-tight
                  prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:border-b prose-h2:border-border/50 prose-h2:pb-3
                  prose-h3:text-xl prose-h3:mt-10 prose-h3:mb-4
                  prose-p:text-base prose-p:leading-8 prose-p:text-foreground/85 prose-p:mb-6
                  prose-p:first-of-type:text-lg prose-p:first-of-type:leading-9 prose-p:first-of-type:text-foreground/90
                  prose-strong:text-foreground prose-strong:font-semibold
                  prose-a:text-sky-600 dark:prose-a:text-sky-400 prose-a:font-medium prose-a:underline prose-a:underline-offset-2 prose-a:decoration-sky-400/50 hover:prose-a:decoration-sky-400
                  prose-ul:my-6 prose-ul:text-foreground/85 prose-li:my-2 prose-li:leading-7
                  prose-ol:my-6 prose-ol:text-foreground/85
                  prose-blockquote:border-l-4 prose-blockquote:border-sky-500/50 prose-blockquote:bg-muted/30
                  prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:rounded-r-lg
                  prose-blockquote:not-italic prose-blockquote:text-foreground/80
                ">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {brief.content}
                  </ReactMarkdown>
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
        </div>
      </div>
    </div>
  )
}
