"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Play, Pause, Download, Loader2, ArrowLeft, Calendar, Clock, FileText, Scale, User } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAudioPlayer, type AudioTrack } from "@/lib/audio/audio-player-context"

interface PodcastEpisode {
  id: string;
  lawId: number;
  episodeNumber: number;
  title: string;
  headline: string;
  description: string | null;
  script: string | null;
  audioUrl: string | null;
  audioDuration: number | null;
  thumbnailUrl: string | null;
  characterCount: number | null;
  status: string;
  createdAt: number;
  publishedAt: number | null;
  law: {
    id: number;
    name: string;
    year: number;
    publicLaw: string;
    presidentSigned: string;
    category: string;
    description: string;
    keyProvisions: string[];
    historicalImpact: string;
  };
}

export default function PodcastDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { play, pause, currentTrack, isPlaying } = useAudioPlayer()

  const [episode, setEpisode] = useState<PodcastEpisode | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isThisEpisodePlaying = episode && currentTrack?.id === episode.id && isPlaying

  useEffect(() => {
    fetchEpisode()
  }, [id])

  const fetchEpisode = async () => {
    try {
      const response = await fetch(`/api/podcast/${id}`)

      if (!response.ok) {
        if (response.status === 404) {
          setError('Episode not found')
        } else {
          setError('Failed to load episode')
        }
        return
      }

      const data = await response.json()
      if (data.success && data.episode) {
        setEpisode(data.episode)
      } else {
        setError('Failed to load episode')
      }
    } catch (err) {
      console.error('Error fetching episode:', err)
      setError('Failed to load episode')
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
    if (!episode?.audioUrl) return

    if (isThisEpisodePlaying) {
      pause()
      return
    }

    const track: AudioTrack = {
      id: episode.id,
      title: episode.headline || episode.title,
      type: 'podcast',
      audioUrl: episode.audioUrl,
      imageUrl: episode.thumbnailUrl,
      duration: episode.audioDuration || undefined,
      createdAt: new Date(episode.createdAt).toISOString(),
    }

    play(track)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen pb-32 px-6 md:px-8 py-8">
        <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  // Error state
  if (error || !episode) {
    return (
      <div className="min-h-screen pb-32 px-6 md:px-8 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Button variant="ghost" asChild>
            <Link href="/podcast" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Podcast
            </Link>
          </Button>
          <div className="text-center py-20">
            <p className="text-muted-foreground">{error || 'Episode not found'}</p>
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
            <Link href="/podcast" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Podcast
            </Link>
          </Button>
        </div>
      </div>

      {/* Hero Image */}
      <div className="w-full aspect-[21/9] md:aspect-[3/1] overflow-hidden bg-muted relative">
        <img
          src={episode.thumbnailUrl || "/podcast-placeholder.jpg"}
          alt={episode.headline}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-4 left-4">
          <Badge className="bg-primary text-primary-foreground font-mono text-lg px-4 py-1">
            Episode {episode.episodeNumber}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 md:px-8 py-8">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Header */}
          <header className="space-y-4 border-b border-border pb-6">
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/20 font-medium">
                {episode.law.category}
              </Badge>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {episode.law.year}
              </span>
              {episode.audioDuration && (
                <>
                  <span>|</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatDuration(episode.audioDuration)} listen
                  </span>
                </>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold tracking-tight leading-tight">
              {episode.headline}
            </h1>

            <p className="text-xl text-muted-foreground">
              {episode.title}
            </p>
          </header>

          {/* Audio Player */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border">
            <div className="flex-1">
              <p className="text-sm font-medium">Listen to this episode</p>
              <p className="text-xs text-muted-foreground">
                Episode {episode.episodeNumber} of 100 Laws That Shaped America
              </p>
            </div>
            {episode.audioUrl ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={handlePlayClick}
                >
                  {isThisEpisodePlaying ? (
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
                  <a href={episode.audioUrl} download>
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            ) : (
              <Badge variant="outline" className="text-xs">Generating...</Badge>
            )}
          </div>

          {/* Content Tabs */}
          <Tabs defaultValue="about" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="about" className="text-sm">
                <Scale className="mr-2 h-4 w-4" />
                About
              </TabsTrigger>
              <TabsTrigger value="provisions" className="text-sm">
                <FileText className="mr-2 h-4 w-4" />
                Provisions
              </TabsTrigger>
              <TabsTrigger value="transcript" className="text-sm">
                <FileText className="mr-2 h-4 w-4" />
                Transcript
              </TabsTrigger>
            </TabsList>

            <TabsContent value="about" className="mt-0 space-y-6">
              {/* Law Info Card */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Public Law</p>
                      <p className="font-medium">{episode.law.publicLaw || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Signed By</p>
                      <p className="font-medium flex items-center gap-2">
                        <User className="h-4 w-4" />
                        President {episode.law.presidentSigned}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Year Enacted</p>
                      <p className="font-medium">{episode.law.year}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Category</p>
                      <p className="font-medium">{episode.law.category}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Description */}
              <div className="space-y-4">
                <h2 className="text-xl font-serif font-bold">Overview</h2>
                <p className="text-foreground leading-relaxed">
                  {episode.law.description}
                </p>
              </div>

              {/* Historical Impact */}
              <div className="space-y-4">
                <h2 className="text-xl font-serif font-bold">Historical Impact</h2>
                <p className="text-foreground leading-relaxed">
                  {episode.law.historicalImpact}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="provisions" className="mt-0">
              <div className="space-y-4">
                <h2 className="text-xl font-serif font-bold">Key Provisions</h2>
                <ul className="space-y-3">
                  {episode.law.keyProvisions.map((provision, idx) => (
                    <li key={idx} className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-foreground">{provision}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="transcript" className="mt-0">
              <div className="bg-muted/30 rounded-lg p-6 border">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4 font-medium">
                    Episode Transcript
                  </p>
                  {episode.script ? (
                    <div className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">
                      {episode.script}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Transcript not available for this episode.</p>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Episode Info Footer */}
          <div className="pt-6 border-t text-sm text-muted-foreground">
            <p>Published: {formatDate(episode.publishedAt || episode.createdAt)}</p>
            {episode.characterCount && (
              <p>Script length: {episode.characterCount.toLocaleString()} characters</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
