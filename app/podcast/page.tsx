"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Play, Pause, Loader2, Mic, Calendar, Clock } from "lucide-react";
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

export default function PodcastPage() {
  const { play, pause, currentTrack, isPlaying } = useAudioPlayer();
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [decadeFilter, setDecadeFilter] = useState("all");

  // Handle play button click - plays through persistent player
  const handlePlayEpisode = (episode: PodcastEpisode) => {
    if (!episode.audioUrl) return;

    // If this episode is currently playing, pause it
    if (currentTrack?.id === episode.id && isPlaying) {
      pause();
      return;
    }

    // Play this episode through the persistent player
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

  // Check if a specific episode is currently playing
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
        setEpisodes(data.episodes);
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

  // Format date for display
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format duration for display
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get unique categories from episodes
  const categories = [...new Set(episodes.map(ep => ep.law.category))].filter(Boolean);

  // Get unique decades from episodes
  const decades = [...new Set(episodes.map(ep => Math.floor(ep.law.year / 10) * 10))].sort();

  // Filter episodes
  const filteredEpisodes = episodes.filter((episode) => {
    const matchesSearch =
      episode.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      episode.headline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (episode.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesCategory = categoryFilter === "all" || episode.law.category === categoryFilter;
    const matchesDecade = decadeFilter === "all" || Math.floor(episode.law.year / 10) * 10 === parseInt(decadeFilter);
    return matchesSearch && matchesCategory && matchesDecade;
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen pb-32 px-6 md:px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Mic className="h-8 w-8 text-primary" />
              100 Laws That Shaped America
            </h1>
            <p className="text-muted-foreground">
              A narrative journey through the legislation that defined our nation
            </p>
          </div>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen pb-32 px-6 md:px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Mic className="h-8 w-8 text-primary" />
              100 Laws That Shaped America
            </h1>
            <p className="text-muted-foreground">
              A narrative journey through the legislation that defined our nation
            </p>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">{error}</p>
              <Button className="mt-4" onClick={fetchEpisodes}>Try Again</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Empty state
  if (filteredEpisodes.length === 0) {
    return (
      <div className="min-h-screen pb-32 px-6 md:px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Mic className="h-8 w-8 text-primary" />
              100 Laws That Shaped America
            </h1>
            <p className="text-muted-foreground">
              A narrative journey through the legislation that defined our nation
            </p>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <Mic className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No Episodes Yet</h3>
              <p className="text-muted-foreground">
                Episodes are being generated. Check back soon for new content!
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 px-6 md:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Mic className="h-8 w-8 text-primary" />
            100 Laws That Shaped America
          </h1>
          <p className="text-muted-foreground">
            A narrative journey through the legislation that defined our nation
          </p>
        </div>

        {/* Progress Banner */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Series Progress</p>
                <p className="text-xs text-muted-foreground">
                  {episodes.length} of 100 episodes available
                </p>
              </div>
              <div className="w-32 bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${episodes.length}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search episodes..."
                  className="w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={decadeFilter} onValueChange={setDecadeFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Decade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Decades</SelectItem>
                  {decades.map(decade => (
                    <SelectItem key={decade} value={String(decade)}>{decade}s</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Episodes Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEpisodes.map((episode) => (
            <Card key={episode.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-video bg-muted overflow-hidden relative">
                <img
                  src={episode.thumbnailUrl || "/podcast-placeholder.jpg"}
                  alt={episode.headline}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2">
                  <Badge className="bg-black/70 text-white font-mono">
                    EP {episode.episodeNumber}
                  </Badge>
                </div>
                <div className="absolute bottom-2 right-2">
                  <Badge variant="secondary" className="bg-black/70 text-white">
                    {episode.law.year}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                      {episode.law.category}
                    </Badge>
                  </div>

                  <h3 className="font-semibold text-lg leading-tight line-clamp-2">
                    {episode.headline}
                  </h3>

                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {episode.title}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {formatDuration(episode.audioDuration)}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/podcast/${episode.id}`}>View</a>
                    </Button>
                    {episode.audioUrl && (
                      <Button size="sm" onClick={() => handlePlayEpisode(episode)}>
                        {isEpisodePlaying(episode.id) ? (
                          <>
                            <Pause className="h-4 w-4 mr-1" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-1" />
                            Play
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
