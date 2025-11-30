"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Play, Pause, Download, Loader2, ArrowLeft, ExternalLink, FileText, User, Calendar } from "lucide-react"
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
        <div className="max-w-5xl mx-auto flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  // Error state
  if (error || !brief) {
    return (
      <div className="min-h-screen pb-32 px-6 md:px-8 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
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
    <div className="min-h-screen pb-32 px-6 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back button */}
        <Button variant="ghost" asChild>
          <Link href="/briefs" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Briefs
          </Link>
        </Button>

        {/* Hero Section */}
        <div className="space-y-4">
          <div className="aspect-[21/9] rounded-lg overflow-hidden bg-muted">
            <img
              src={brief.featuredImage || "/us-capitol-building-congressional-legislation-brie.jpg"}
              alt={brief.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                {brief.type === 'daily' ? 'Daily Brief' : 'Weekly Brief'}
              </Badge>
              <span className="text-sm text-muted-foreground">{formatDate(brief.createdAt)}</span>
              {brief.audioDuration && (
                <>
                  <span className="text-sm text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">{formatDuration(brief.audioDuration)}</span>
                </>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {brief.title}
            </h1>

            {brief.interests && brief.interests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {brief.interests.map((interest: string) => (
                  <Badge key={interest} variant="outline" className="capitalize">
                    {interest.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Audio Player */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex-1 space-y-2">
                <div className="text-sm font-medium">Audio Brief</div>
                <div className="text-sm text-muted-foreground">
                  Listen to the complete audio briefing
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                {brief.audioUrl ? (
                  <>
                    <Button
                      size="lg"
                      className="rounded-full px-6"
                      onClick={handlePlayClick}
                    >
                      {isThisBriefPlaying ? (
                        <>
                          <Pause className="mr-2 h-4 w-4 fill-current" />
                          Playing...
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4 fill-current" />
                          Play {formatDuration(brief.audioDuration)}
                        </>
                      )}
                    </Button>
                    <Button size="lg" variant="outline" asChild>
                      <a href={brief.audioUrl} download>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </a>
                    </Button>
                  </>
                ) : (
                  <Badge variant="outline">Audio generating...</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Featured Bills Section */}
        {brief.featuredBills && brief.featuredBills.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Featured Legislation
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {brief.featuredBills.map((bill) => (
                <Card key={bill.id} className="hover:bg-accent/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="secondary" className="font-mono">
                        {bill.billType.toUpperCase()} {bill.billNumber}
                      </Badge>
                      {bill.policyArea && (
                        <Badge variant="outline" className="text-xs">
                          {bill.policyArea}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base leading-tight line-clamp-2">
                      {bill.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>{bill.sponsor.name} ({bill.sponsor.party}-{bill.sponsor.state})</span>
                    </div>
                    {bill.latestActionText && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Latest Action: {bill.latestActionDate}</span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {bill.latestActionText}
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/bills/${bill.id}`}>
                          View on Hakivo
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={bill.congressUrl} target="_blank" rel="noopener noreferrer">
                          Congress.gov <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="article" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="article">Written Detail</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
          </TabsList>

          <TabsContent value="article" className="space-y-4">
            <Card>
              <CardContent className="p-6">
                {brief.content ? (
                  <article className="prose prose-invert max-w-none prose-headings:text-foreground prose-headings:font-semibold prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-lg prose-p:text-muted-foreground prose-p:leading-relaxed prose-strong:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-ul:text-muted-foreground prose-li:text-muted-foreground prose-blockquote:border-primary prose-blockquote:text-muted-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {brief.content}
                    </ReactMarkdown>
                  </article>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Written detail not available for this brief.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transcript" className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="prose prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {getTranscript()}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* News Articles Section */}
        {brief.newsArticles && brief.newsArticles.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Related News</h2>
            <div className="grid gap-3">
              {brief.newsArticles.map((article, idx) => (
                <Card key={idx} className="hover:bg-accent/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:text-primary transition-colors line-clamp-2"
                        >
                          {article.title}
                        </a>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {article.summary}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Source: {article.source}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={article.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
