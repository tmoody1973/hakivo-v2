"use client"
import type React from "react"
import { Play, Clock, Bookmark, Download, Pause, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth/auth-context"

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
}

export function DailyBriefWidget() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useAuth();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !accessToken) {
      setIsLoading(false);
      return;
    }

    fetchLatestBrief();
  }, [isAuthenticated, accessToken, authLoading]);

  const fetchLatestBrief = async () => {
    try {
      const response = await fetch('/api/briefs?limit=1&status=completed', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();

      if (data.success && data.briefs && data.briefs.length > 0) {
        setBrief(data.briefs[0]);
      }
    } catch (err) {
      console.error('Error fetching brief:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'long',
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

  const formatCurrentTime = (seconds: number, total: number | null) => {
    const current = Math.floor(seconds);
    const remaining = (total || 0) - current;
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayback = () => {
    if (!brief?.audioUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(brief.audioUrl);
      audioRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(audioRef.current?.currentTime || 0);
      });
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Loading state
  if (authLoading || isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Radio className="h-4 w-4 text-primary" />
            Today's Brief
          </CardTitle>
          <CardDescription className="text-xs">Your personalized legislative update</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No brief available
  if (!brief) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Radio className="h-4 w-4 text-primary" />
            Today's Brief
          </CardTitle>
          <CardDescription className="text-xs">Your personalized legislative update</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              Your first daily brief is being generated. Check back soon!
            </p>
          </div>
          <div className="pt-2 border-t">
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground h-8 text-xs" asChild>
              <Link href="/briefs">
                <Clock className="mr-2 h-3.5 w-3.5" />
                View Past Briefs
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
          <Radio className="h-4 w-4 text-primary" />
          Today's Brief
        </CardTitle>
        <CardDescription className="text-xs">Your personalized legislative update</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-[240px_1fr] gap-4">
          <div className="aspect-video md:aspect-square rounded-lg overflow-hidden bg-muted">
            <img
              src={brief.featuredImage || "/us-capitol-building-congressional-legislation-brie.jpg"}
              alt="Daily Legislative Brief"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 text-xs py-0">
                  {brief.type === 'daily' ? 'Daily Brief' : 'Weekly Brief'}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatDate(brief.createdAt)}</span>
              </div>

              <h3 className="font-semibold text-base leading-tight">
                {brief.title}
              </h3>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {brief.audioUrl ? (
                <Button
                  size="sm"
                  onClick={togglePlayback}
                  className="rounded-full px-5 h-9 bg-primary hover:bg-primary/90"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-3.5 w-3.5 mr-1.5 fill-current" />
                      {formatCurrentTime(currentTime, brief.audioDuration)}
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                      Listen {formatDuration(brief.audioDuration)}
                    </>
                  )}
                </Button>
              ) : (
                <Badge variant="outline" className="text-xs">Audio generating...</Badge>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground h-9 px-3"
              >
                <Bookmark className="h-3.5 w-3.5 mr-1.5" />
                Save
              </Button>

              {brief.audioUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground h-9 px-3"
                  asChild
                >
                  <a href={brief.audioUrl} download>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t">
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground h-8 text-xs" asChild>
            <Link href="/briefs">
              <Clock className="mr-2 h-3.5 w-3.5" />
              View Past Briefs
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Radio(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
    </svg>
  )
}

function Link({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  )
}
