"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Play, Pause, Loader2, Clock, Calendar, Search, ChevronRight } from "lucide-react";
import { useAudioPlayer, type AudioTrack } from "@/lib/audio/audio-player-context";

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

// Platform links for podcast distribution
const PLATFORM_LINKS = [
  { name: "Apple Podcasts", url: "https://podcasts.apple.com/us/podcast/100-laws-that-change-america/id1859402488", icon: "🎧" },
  { name: "Spotify", url: "https://open.spotify.com/show/0uXNW7aFYmjsihiIDOgVuB", icon: "🎵" },
  { name: "RSS Feed", url: "https://www.spreaker.com/show/6817395/episodes/feed", icon: "📡" },
];

export default function PodcastPage() {
  const { play, pause, currentTrack, isPlaying } = useAudioPlayer();
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Handle play button click
  const handlePlayEpisode = (episode: PodcastEpisode) => {
    if (!episode.audioUrl) return;

    if (currentTrack?.id === episode.id && isPlaying) {
      pause();
      return;
    }

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

  const isEpisodePlaying = (episodeId: string) => {
    return currentTrack?.id === episodeId && isPlaying;
  };

  useEffect(() => {
    fetchEpisodes();
  }, []);

  const fetchEpisodes = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/podcast?status=completed');

      if (!response.ok) {
        throw new Error('Failed to fetch episodes');
      }

      const data = await response.json();

      if (data.success && data.episodes) {
        // Sort by episode number descending (newest first)
        const sorted = [...data.episodes].sort((a, b) => b.episodeNumber - a.episodeNumber);
        setEpisodes(sorted);
      } else {
        setEpisodes([]);
      }
    } catch (err) {
      console.error('Error fetching episodes:', err);
      setError(err instanceof Error ? err.message : 'Failed to load episodes');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Filter episodes by search
  const filteredEpisodes = episodes.filter((episode) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      episode.title.toLowerCase().includes(query) ||
      episode.headline.toLowerCase().includes(query) ||
      (episode.description?.toLowerCase().includes(query) ?? false) ||
      String(episode.law.year).includes(query)
    );
  });

  return (
    <div className="min-h-screen pb-32">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-primary/10 via-primary/5 to-background">
        <div className="max-w-6xl mx-auto px-6 md:px-8 py-12 md:py-16">
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
            {/* Podcast Artwork */}
            <div className="flex-shrink-0 mx-auto md:mx-0">
              <div className="w-64 h-64 md:w-80 md:h-80 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/10">
                <img
                  src="/podcast-hakivo.png"
                  alt="Signed Into Law Podcast"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Podcast Info */}
            <div className="flex-1 space-y-6 text-center md:text-left">
              <div className="space-y-2">
                <p className="text-sm font-medium text-primary uppercase tracking-wider">
                  A Hakivo Original Podcast
                </p>
                <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight">
                  Signed Into Law
                </h1>
                <p className="text-xl text-muted-foreground">
                  The 100 bills that built modern America
                </p>
              </div>

              <div className="space-y-4 text-foreground/80 max-w-2xl">
                <p className="leading-relaxed">
                  Every law tells a story—of movements that demanded change, crises that forced action, and compromises that shaped a nation.
                </p>
                <p className="leading-relaxed">
                  <strong>Signed Into Law</strong> is a daily podcast from Hakivo, the AI-powered civic engagement platform that turns dense legislative text into clear, listenable audio briefings.
                </p>
                <p className="leading-relaxed">
                  Each episode unpacks one of the 100 most consequential pieces of US legislation from 1900 to 2000: the debates behind them, the provisions within them, and the legacy they left.
                </p>
              </div>

              {/* Progress indicator */}
              <div className="flex items-center gap-4 justify-center md:justify-start">
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(episodes.length, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {episodes.length}/100 episodes
                  </span>
                </div>
              </div>

              {/* Platform Links */}
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                {PLATFORM_LINKS.map((platform) => (
                  <Button
                    key={platform.name}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    asChild
                  >
                    <a href={platform.url} target="_blank" rel="noopener noreferrer">
                      <span>{platform.icon}</span>
                      {platform.name}
                    </a>
                  </Button>
                ))}
              </div>

              <p className="text-sm text-muted-foreground italic">
                Subscribe and start your 100-day civic education journey.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Episodes Section */}
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h2 className="text-2xl font-serif font-bold">
            Episodes
          </h2>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search episodes..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchEpisodes}>Try Again</Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredEpisodes.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground">
              {searchQuery ? 'No episodes match your search.' : 'Episodes coming soon!'}
            </p>
          </div>
        )}

        {/* Episode List */}
        {!isLoading && !error && filteredEpisodes.length > 0 && (
          <div className="space-y-1">
            {filteredEpisodes.map((episode, index) => (
              <div
                key={episode.id}
                className={`group flex items-start gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors ${
                  index !== filteredEpisodes.length - 1 ? 'border-b border-border/50' : ''
                }`}
              >
                {/* Episode Number / Play Button */}
                <div className="flex-shrink-0 w-16 flex flex-col items-center gap-1">
                  {episode.audioUrl ? (
                    <button
                      onClick={() => handlePlayEpisode(episode)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        isEpisodePlaying(episode.id)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted group-hover:bg-primary group-hover:text-primary-foreground'
                      }`}
                    >
                      {isEpisodePlaying(episode.id) ? (
                        <Pause className="h-5 w-5 fill-current" />
                      ) : (
                        <Play className="h-5 w-5 fill-current ml-0.5" />
                      )}
                    </button>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-sm font-mono text-muted-foreground">
                        {episode.episodeNumber}
                      </span>
                    </div>
                  )}
                </div>

                {/* Episode Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium">Episode {episode.episodeNumber}</span>
                    <span>·</span>
                    <span>{episode.law.year}</span>
                    <span>·</span>
                    <Badge variant="outline" className="text-xs font-normal">
                      {episode.law.category}
                    </Badge>
                  </div>

                  <Link
                    href={`/podcast/${episode.id}`}
                    className="block group/link"
                  >
                    <h3 className="font-semibold text-lg leading-snug group-hover/link:text-primary transition-colors line-clamp-1">
                      {episode.headline}
                    </h3>
                  </Link>

                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {episode.description || episode.title}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
                    {episode.audioDuration && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDuration(episode.audioDuration)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(episode.publishedAt || episode.createdAt)}
                    </span>
                  </div>
                </div>

                {/* View Arrow */}
                <div className="flex-shrink-0 self-center">
                  <Link
                    href={`/podcast/${episode.id}`}
                    className="p-2 rounded-full hover:bg-muted transition-colors"
                  >
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* About Section */}
      <div className="bg-muted/30 border-t">
        <div className="max-w-6xl mx-auto px-6 md:px-8 py-12">
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold mb-3">About This Podcast</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Produced using AI voice generation technology, this series brings Hakivo's mission to life—making democracy understandable, one bill at a time.
            </p>
            <p className="text-sm text-muted-foreground">
              From the Antiquities Act to the Americans with Disabilities Act, each episode offers a 10-12 minute deep dive into the laws that shaped the American experience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
