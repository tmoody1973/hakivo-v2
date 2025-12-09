"use client"
import type React from "react"
import { Play, Clock, Mic, Pause, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { useAudioPlayer, type AudioTrack } from "@/lib/audio/audio-player-context"

interface PodcastEpisode {
  id: string;
  lawId: number;
  episodeNumber: number;
  title: string;
  headline: string;
  description: string | null;
  audioUrl: string | null;
  audioDuration: number | null;
  thumbnailUrl: string | null;
  status: string;
  createdAt: number;
  publishedAt: number | null;
  law: {
    year: number;
    category: string;
    publicLaw: string;
  };
}

export function PodcastWidget() {
  const { play, pause, currentTrack, isPlaying } = useAudioPlayer();
  const [episode, setEpisode] = useState<PodcastEpisode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<{ completedEpisodes: number; totalLaws: number } | null>(null);

  // Check if this episode is currently playing in the persistent player
  const isThisEpisodePlaying = episode && currentTrack?.id === episode.id && isPlaying;

  useEffect(() => {
    fetchLatestEpisode();
    fetchStats();
  }, []);

  const fetchLatestEpisode = async () => {
    try {
      const response = await fetch('/api/podcast?status=completed&limit=1');

      if (!response.ok) {
        setEpisode(null);
        return;
      }

      const data = await response.json();

      if (data.success && data.episodes && data.episodes.length > 0) {
        // Sort by episode number descending and select the newest
        const sorted = [...data.episodes].sort((a: PodcastEpisode, b: PodcastEpisode) => b.episodeNumber - a.episodeNumber);
        setEpisode(sorted[0]);
      } else {
        setEpisode(null);
      }
    } catch (err) {
      console.error('Error fetching latest podcast episode:', err);
      setEpisode(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Note: For now we just use the list API to get count
      const response = await fetch('/api/podcast?status=completed');
      if (response.ok) {
        const data = await response.json();
        setStats({
          completedEpisodes: data.episodes?.length || 0,
          totalLaws: 100
        });
      }
    } catch (err) {
      console.error('Error fetching podcast stats:', err);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayClick = () => {
    if (!episode?.audioUrl) return;

    // If this episode is already playing, pause it
    if (isThisEpisodePlaying) {
      pause();
      return;
    }

    // Create track object and dispatch to persistent player
    const track: AudioTrack = {
      id: episode.id,
      title: episode.headline || episode.title,
      type: 'podcast',
      audioUrl: episode.audioUrl,
      imageUrl: episode.thumbnailUrl,
      duration: episode.audioDuration || undefined,
      createdAt: new Date(episode.createdAt).toISOString(),
    };

    play(track);
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mic className="h-4 w-4 text-primary" />
            100 Laws Podcast
          </CardTitle>
          <CardDescription className="text-xs">Historic legislation that shaped America</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No episode available
  if (!episode) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mic className="h-4 w-4 text-primary" />
            100 Laws Podcast
          </CardTitle>
          <CardDescription className="text-xs">Historic legislation that shaped America</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Episodes are being generated. Check back soon!
            </p>
          </div>
          <div className="pt-2 border-t">
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground h-8 text-xs" asChild>
              <Link href="/podcast">
                <Clock className="mr-2 h-3.5 w-3.5" />
                View All Episodes
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mic className="h-4 w-4 text-primary" />
          100 Laws Podcast
        </CardTitle>
        <CardDescription className="text-xs">Historic legislation that shaped America</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-[240px_1fr] gap-4">
          <div className="aspect-video md:aspect-square rounded-lg overflow-hidden bg-muted relative">
            <img
              src={episode.thumbnailUrl || "/podcast-placeholder.jpg"}
              alt={episode.headline}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2">
              <Badge className="bg-black/70 text-white font-mono text-xs">
                EP {episode.episodeNumber}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 text-xs py-0">
                  {episode.law.category}
                </Badge>
                <span className="text-xs text-muted-foreground">{episode.law.year}</span>
              </div>

              <h3 className="font-semibold text-base leading-tight line-clamp-2">
                {episode.headline}
              </h3>

              <p className="text-xs text-muted-foreground line-clamp-2">
                {episode.title}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {episode.audioUrl ? (
                <Button
                  size="sm"
                  onClick={handlePlayClick}
                  className="rounded-full px-5 h-9 bg-primary hover:bg-primary/90"
                >
                  {isThisEpisodePlaying ? (
                    <>
                      <Pause className="h-3.5 w-3.5 mr-1.5 fill-current" />
                      Playing...
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                      Listen {formatDuration(episode.audioDuration)}
                    </>
                  )}
                </Button>
              ) : (
                <Badge variant="outline" className="text-xs">Audio generating...</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        {stats && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
            <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(stats.completedEpisodes / stats.totalLaws) * 100}%` }}
              />
            </div>
            <span>{stats.completedEpisodes}/100 episodes</span>
          </div>
        )}

        <div className="pt-2 border-t">
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground h-8 text-xs" asChild>
            <Link href="/podcast">
              <Clock className="mr-2 h-3.5 w-3.5" />
              View All Episodes
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Link({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  )
}
