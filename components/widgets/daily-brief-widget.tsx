"use client"
import type React from "react"
import { Play, Clock, Bookmark, Download, Pause, Loader2, Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { useAudioPlayer, type AudioTrack } from "@/lib/audio/audio-player-context"

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

// Progress steps for brief generation
const PROGRESS_STEPS = [
  { status: 'pending', label: 'Queued', description: 'Your brief is in the queue...' },
  { status: 'processing', label: 'Gathering Content', description: 'Finding legislation matching your interests...' },
  { status: 'content_gathered', label: 'Analyzing', description: 'Analyzing bills and fetching news...' },
  { status: 'script_ready', label: 'Generating Audio', description: 'Creating your personalized audio brief...' },
  { status: 'completed', label: 'Ready', description: 'Your brief is ready!' },
];

function getProgressInfo(status: string): { currentStep: number; label: string; description: string } {
  const stepIndex = PROGRESS_STEPS.findIndex(s => s.status === status);
  if (stepIndex === -1) {
    return { currentStep: 0, label: 'Starting', description: 'Initializing...' };
  }
  return {
    currentStep: stepIndex,
    label: PROGRESS_STEPS[stepIndex].label,
    description: PROGRESS_STEPS[stepIndex].description
  };
}

interface TriviaFact {
  fact: string;
  category: string;
}

export function DailyBriefWidget() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useAuth();
  const { play, pause, currentTrack, isPlaying } = useAudioPlayer();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingBriefId, setGeneratingBriefId] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<string>('pending');
  const [trivia, setTrivia] = useState<TriviaFact | null>(null);
  const [triviaLoading, setTriviaLoading] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if this brief is currently playing in the persistent player
  const isThisBriefPlaying = brief && currentTrack?.id === brief.id && isPlaying;

  // Fetch trivia fact
  const fetchTrivia = useCallback(async () => {
    setTriviaLoading(true);
    try {
      const response = await fetch('/api/trivia');
      if (response.ok) {
        const data = await response.json();
        setTrivia({ fact: data.fact, category: data.category });
      }
    } catch (err) {
      console.error('Error fetching trivia:', err);
    } finally {
      setTriviaLoading(false);
    }
  }, []);

  // Poll for brief status
  const pollBriefStatus = useCallback(async (briefId: string) => {
    try {
      const response = await fetch(`/api/briefs/status/${briefId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();

      if (data.success && data.brief) {
        // Update the generation status for progress display
        setGenerationStatus(data.brief.status);

        if (data.brief.status === 'completed' && data.brief.audioUrl) {
          // Brief is ready!
          setBrief({
            id: data.brief.id,
            type: 'daily',
            title: data.brief.title || "Today's Legislative Brief",
            headline: '',
            status: data.brief.status,
            audioUrl: data.brief.audioUrl,
            audioDuration: data.brief.audioDuration,
            featuredImage: data.brief.featuredImage,
            createdAt: data.brief.createdAt,
          });
          setIsGenerating(false);
          setGeneratingBriefId(null);
          setGenerationStatus('pending');

          // Clear polling
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        } else if (data.brief.status === 'failed') {
          // Generation failed
          setIsGenerating(false);
          setGeneratingBriefId(null);
          setGenerationStatus('pending');

          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
        // Otherwise keep polling (status is 'pending', 'processing', 'content_gathered', 'script_ready')
      }
    } catch (err) {
      console.error('Error polling brief status:', err);
    }
  }, [accessToken]);

  // Trigger on-demand brief generation
  const triggerBriefGeneration = useCallback(async () => {
    console.log('[DailyBriefWidget] triggerBriefGeneration called, accessToken:', !!accessToken, 'isGenerating:', isGenerating);

    if (!accessToken) {
      console.error('[DailyBriefWidget] No access token available');
      return;
    }

    if (isGenerating) {
      console.log('[DailyBriefWidget] Already generating, skipping');
      return;
    }

    setIsGenerating(true);
    console.log('[DailyBriefWidget] Starting brief generation...');

    // Start fetching trivia
    fetchTrivia();

    // Rotate trivia every 6 seconds
    const triviaInterval = setInterval(() => {
      fetchTrivia();
    }, 6000);

    try {
      console.log('[DailyBriefWidget] Calling /api/briefs/generate...');
      const response = await fetch('/api/briefs/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('[DailyBriefWidget] Generate response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DailyBriefWidget] Generate failed:', response.status, errorText);
        setIsGenerating(false);
        clearInterval(triviaInterval);
        return;
      }

      const data = await response.json();
      console.log('[DailyBriefWidget] Generate response data:', data);

      if (data.success) {
        if (data.status === 'completed' || data.audioUrl) {
          // Brief already exists, fetch it
          fetchLatestBrief();
          setIsGenerating(false);
          clearInterval(triviaInterval);
        } else if (data.briefId) {
          // Brief is being generated, start polling
          setGeneratingBriefId(data.briefId);

          // Poll every 3 seconds
          pollIntervalRef.current = setInterval(() => {
            pollBriefStatus(data.briefId);
          }, 3000);

          // Stop trivia rotation when brief is ready (handled in pollBriefStatus)
          // Store the trivia interval to clear it later
          const checkReady = setInterval(() => {
            if (!isGenerating) {
              clearInterval(triviaInterval);
              clearInterval(checkReady);
            }
          }, 1000);
        }
      } else {
        console.error('[DailyBriefWidget] Generate response not successful:', data);
        setIsGenerating(false);
        clearInterval(triviaInterval);
      }
    } catch (err) {
      console.error('[DailyBriefWidget] Error triggering brief generation:', err);
      setIsGenerating(false);
      clearInterval(triviaInterval);
    }
  }, [accessToken, isGenerating, fetchTrivia, pollBriefStatus]);

  // Check if today's brief exists
  const checkTodaysBrief = useCallback(async () => {
    try {
      const response = await fetch('/api/briefs?limit=1&status=completed', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) return null;

      const data = await response.json();

      if (data.success && data.briefs && data.briefs.length > 0) {
        const latestBrief = data.briefs[0];

        // Check if it's from today
        const briefDate = new Date(latestBrief.createdAt);
        const today = new Date();
        const isToday = briefDate.toDateString() === today.toDateString();

        if (isToday) {
          return latestBrief;
        }
      }

      return null;
    } catch (err) {
      console.error('Error checking today\'s brief:', err);
      return null;
    }
  }, [accessToken]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !accessToken) {
      setIsLoading(false);
      return;
    }

    fetchLatestBrief();
  }, [isAuthenticated, accessToken, authLoading]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const fetchLatestBrief = async () => {
    try {
      const response = await fetch('/api/briefs?limit=1&status=completed', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        setBrief(null);
        return;
      }

      const data = await response.json();

      if (data.success && data.briefs && data.briefs.length > 0) {
        const latestBrief = data.briefs[0];

        // Check if brief is from today - if not, show generate button
        const briefDate = new Date(latestBrief.createdAt);
        const today = new Date();
        const isToday = briefDate.toDateString() === today.toDateString();

        if (isToday) {
          setBrief(latestBrief);
        } else {
          // Brief is from a previous day - prompt user to generate today's
          console.log('[DailyBriefWidget] Latest brief is from', briefDate.toDateString(), ', not today');
          setBrief(null);
        }
      } else {
        setBrief(null);
      }
    } catch (err) {
      console.error('Error fetching brief:', err);
      setBrief(null);
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

  const handlePlayClick = () => {
    console.log('[DailyBriefWidget] handlePlayClick called, brief:', brief?.id, brief?.audioUrl);
    if (!brief?.audioUrl) {
      console.log('[DailyBriefWidget] No audio URL, returning');
      return;
    }

    // If this brief is already playing, pause it
    if (isThisBriefPlaying) {
      console.log('[DailyBriefWidget] Brief already playing, pausing');
      pause();
      return;
    }

    // Create track object and dispatch to persistent player
    const track: AudioTrack = {
      id: brief.id,
      title: brief.title,
      type: 'brief',
      audioUrl: brief.audioUrl,
      imageUrl: brief.featuredImage,
      duration: brief.audioDuration || undefined,
      createdAt: new Date(brief.createdAt).toISOString(),
    };

    console.log('[DailyBriefWidget] Playing track:', track);
    play(track);
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

  // Brief is generating - show progress steps and trivia
  if (isGenerating) {
    const progressInfo = getProgressInfo(generationStatus);
    const totalSteps = PROGRESS_STEPS.length - 1; // Exclude 'completed'

    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Radio className="h-4 w-4 text-primary animate-pulse" />
            Generating Your Brief
          </CardTitle>
          <CardDescription className="text-xs">Your personalized legislative update is being created</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress steps */}
          <div className="space-y-3">
            {/* Current step indicator */}
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{progressInfo.label}</p>
                <p className="text-xs text-muted-foreground">{progressInfo.description}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.min(((progressInfo.currentStep + 1) / totalSteps) * 100, 100)}%` }}
              />
            </div>

            {/* Step indicators */}
            <div className="flex justify-between text-[10px] text-muted-foreground">
              {PROGRESS_STEPS.slice(0, -1).map((step, index) => (
                <span
                  key={step.status}
                  className={index <= progressInfo.currentStep ? 'text-primary font-medium' : ''}
                >
                  {step.label}
                </span>
              ))}
            </div>
          </div>

          {/* Trivia section */}
          {trivia && (
            <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {trivia.category}
                  </Badge>
                  <p className="text-sm text-foreground leading-relaxed">
                    {trivia.fact}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!trivia && triviaLoading && (
            <div className="bg-muted/50 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-muted rounded w-full"></div>
              <div className="h-4 bg-muted rounded w-2/3 mt-2"></div>
            </div>
          )}

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

  // No brief available - offer to generate
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
        <CardContent className="space-y-4">
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              No brief available yet for today. Generate one now!
            </p>
            <Button
              onClick={triggerBriefGeneration}
              className="rounded-full px-6"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Today's Brief
            </Button>
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
                  onClick={handlePlayClick}
                  className="rounded-full px-5 h-9 bg-primary hover:bg-primary/90"
                >
                  {isThisBriefPlaying ? (
                    <>
                      <Pause className="h-3.5 w-3.5 mr-1.5 fill-current" />
                      Playing...
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
