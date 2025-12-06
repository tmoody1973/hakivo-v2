"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Play, Pause, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { useAudioPlayer, type AudioTrack } from "@/lib/audio/audio-player-context";

interface Brief {
  id: string;
  type: string;
  title: string;
  headline: string;
  startDate: string;
  endDate: string;
  status: string;
  audioUrl: string | null;
  audioDuration: number | null;
  characterCount: number | null;
  featuredImage: string | null;
  createdAt: number;
  updatedAt: number;
}

export default function BriefsPage() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useAuth();
  const { play, pause, currentTrack, isPlaying } = useAudioPlayer();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Handle play button click - plays through persistent player
  const handlePlayBrief = (brief: Brief) => {
    if (!brief.audioUrl) return;

    // If this brief is currently playing, pause it
    if (currentTrack?.id === brief.id && isPlaying) {
      pause();
      return;
    }

    // Play this brief through the persistent player
    const track: AudioTrack = {
      id: brief.id,
      title: brief.title,
      type: 'brief',
      audioUrl: brief.audioUrl,
      imageUrl: brief.featuredImage,
      duration: brief.audioDuration || undefined,
      createdAt: new Date(brief.createdAt).toISOString(),
    };

    play(track);
  };

  // Check if a specific brief is currently playing
  const isBriefPlaying = (briefId: string) => {
    return currentTrack?.id === briefId && isPlaying;
  };

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !accessToken) {
      setIsLoading(false);
      setError("Please sign in to view your briefs");
      return;
    }

    fetchBriefs();
  }, [isAuthenticated, accessToken, authLoading]);

  const fetchBriefs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/briefs?status=completed', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch briefs');
      }

      const data = await response.json();

      if (data.success && data.briefs) {
        setBriefs(data.briefs);
      } else {
        setBriefs([]);
      }
    } catch (err) {
      console.error('Error fetching briefs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load briefs');
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

  // Filter briefs
  const filteredBriefs = briefs.filter((brief) => {
    const matchesSearch = brief.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || brief.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen pb-32 px-6 md:px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Legislative Briefs</h1>
            <p className="text-muted-foreground">
              Your personalized audio briefings on Congressional legislation
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
            <h1 className="text-3xl font-bold tracking-tight">Legislative Briefs</h1>
            <p className="text-muted-foreground">
              Your personalized audio briefings on Congressional legislation
            </p>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">{error}</p>
              <Button className="mt-4" onClick={fetchBriefs}>Try Again</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Empty state
  if (filteredBriefs.length === 0) {
    return (
      <div className="min-h-screen pb-32 px-6 md:px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Legislative Briefs</h1>
            <p className="text-muted-foreground">
              Your personalized audio briefings on Congressional legislation
            </p>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No Briefs Yet</h3>
              <p className="text-muted-foreground">
                Your personalized daily briefs will appear here. Check back soon!
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
          <h1 className="text-3xl font-bold tracking-tight">Legislative Briefs</h1>
          <p className="text-muted-foreground">
            Your personalized audio briefings on Congressional legislation
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search briefs..."
                  className="w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Brief Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="daily">Daily Brief</SelectItem>
                  <SelectItem value="weekly">Weekly Brief</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Briefs Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBriefs.map((brief) => (
            <Card key={brief.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-video bg-muted overflow-hidden">
                <img
                  src={brief.featuredImage || "/us-capitol-building-congressional-legislation-brie.jpg"}
                  alt={brief.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      {brief.type === 'daily' ? 'Daily Brief' : 'Weekly Brief'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{formatDate(brief.createdAt)}</span>
                  </div>

                  <h3 className="font-semibold text-lg leading-tight line-clamp-2">
                    {brief.title}
                  </h3>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">
                    {formatDuration(brief.audioDuration)}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/briefs/${brief.id}`}>View</a>
                    </Button>
                    {brief.audioUrl && (
                      <Button size="sm" onClick={() => handlePlayBrief(brief)}>
                        {isBriefPlaying(brief.id) ? (
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
