"use client"

import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Loader2, Mic, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Card } from "@/components/ui/card"
import { useAudioPlayer, formatTime, type AudioTrack } from "@/lib/audio/audio-player-context"
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

export function PersistentAudioPlayer() {
  const pathname = usePathname()
  const { accessToken, isAuthenticated } = useAuth()
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    play,
    togglePlay,
    seek,
    setVolume,
  } = useAudioPlayer()

  // Fetch latest brief for "ready to play" state
  const [latestBrief, setLatestBrief] = useState<Brief | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      setBriefLoading(false)
      return
    }

    fetchLatestBrief()
  }, [isAuthenticated, accessToken])

  const fetchLatestBrief = async () => {
    try {
      const response = await fetch('/api/briefs?limit=1&status=completed', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) return

      const data = await response.json()
      if (data.success && data.briefs && data.briefs.length > 0) {
        setLatestBrief(data.briefs[0])
      }
    } catch (err) {
      console.error('Error fetching latest brief:', err)
    } finally {
      setBriefLoading(false)
    }
  }

  // Don't show player on landing page, onboarding, or auth pages
  if (pathname === '/' || pathname === '/onboarding' || pathname?.startsWith('/auth')) {
    return null
  }

  // Don't show if not authenticated
  if (!isAuthenticated) {
    return null
  }

  // Show loading state briefly
  if (briefLoading && !currentTrack) {
    return null
  }

  // Determine what to display: current track or latest brief
  const displayTrack = currentTrack
  const displayBrief = !currentTrack ? latestBrief : null

  // If no track playing and no brief available, don't show player
  if (!displayTrack && !displayBrief) {
    return null
  }

  // Calculate progress percentage for slider
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  // Handle progress change from slider
  const handleProgressChange = (value: number[]) => {
    const newTime = (value[0] / 100) * duration
    seek(newTime)
  }

  // Handle volume change
  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0] / 100)
  }

  // Skip forward/back 15 seconds
  const skipForward = () => seek(currentTime + 15)
  const skipBack = () => seek(currentTime - 15)

  // Format date for display
  const formatDate = (dateStr?: string | number) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Handle play button click
  const handlePlayClick = () => {
    // If we have a current track, toggle play/pause
    if (currentTrack) {
      togglePlay()
      return
    }

    // Otherwise, play the latest brief
    if (displayBrief?.audioUrl) {
      const track: AudioTrack = {
        id: displayBrief.id,
        title: displayBrief.title,
        type: 'brief',
        audioUrl: displayBrief.audioUrl,
        imageUrl: displayBrief.featuredImage,
        duration: displayBrief.audioDuration || undefined,
        createdAt: new Date(displayBrief.createdAt).toISOString(),
      }
      play(track)
    }
  }

  // Get display info
  const title = displayTrack?.title || displayBrief?.title || 'Today\'s Brief'
  const imageUrl = displayTrack?.imageUrl || displayBrief?.featuredImage
  const type = displayTrack?.type || 'brief'
  const createdAt = displayTrack?.createdAt || (displayBrief?.createdAt ? new Date(displayBrief.createdAt).toISOString() : undefined)
  const displayDuration = displayTrack ? duration : (displayBrief?.audioDuration || 0)
  const hasAudio = displayTrack?.audioUrl || displayBrief?.audioUrl

  return (
    <Card className="fixed bottom-0 left-0 right-0 z-50 border-t rounded-none bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex items-center gap-4 px-4 md:px-6 py-3">
        {/* Now Playing Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-[0_0_280px]">
          {imageUrl ? (
            <div className="h-12 w-12 rounded overflow-hidden flex-shrink-0">
              <img
                src={imageUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="h-12 w-12 rounded bg-accent flex items-center justify-center flex-shrink-0">
              {type === 'brief' ? (
                <Radio className="h-6 w-6 text-accent-foreground" />
              ) : (
                <Mic className="h-6 w-6 text-accent-foreground" />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {type === 'brief' ? 'Daily Brief' : type}
              {createdAt && ` • ${formatDate(createdAt)}`}
              {displayDuration > 0 && ` • ${formatTime(displayDuration)}`}
            </p>
          </div>
        </div>

        {/* Player Controls */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={skipBack}
              title="Back 15s"
              disabled={!currentTrack}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="h-10 w-10"
              onClick={handlePlayClick}
              disabled={isLoading || !hasAudio}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={skipForward}
              title="Forward 15s"
              disabled={!currentTrack}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="hidden md:flex items-center gap-2 w-full max-w-md">
            <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[progressPercent]}
              onValueChange={handleProgressChange}
              max={100}
              step={0.1}
              className="flex-1"
              disabled={!currentTrack}
            />
            <span className="text-xs text-muted-foreground tabular-nums w-10">
              {formatTime(displayDuration)}
            </span>
          </div>
        </div>

        {/* Volume Control */}
        <div className="hidden lg:flex items-center gap-2 flex-[0_0_140px]">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setVolume(volume > 0 ? 0 : 0.75)}
          >
            {volume === 0 ? (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Volume2 className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          <Slider
            value={[volume * 100]}
            onValueChange={handleVolumeChange}
            max={100}
            step={1}
            className="w-20"
          />
        </div>
      </div>
    </Card>
  )
}
