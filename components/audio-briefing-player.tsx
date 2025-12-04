"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Play, Pause, RotateCcw, Volume2, VolumeX, FileText, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

interface AudioBriefingPlayerProps {
  audioBase64: string
  transcript: string
  title?: string
  duration?: number
  className?: string
}

/**
 * Audio Briefing Player Component
 *
 * Features:
 * - Play/pause controls
 * - Progress bar with seek
 * - Speed control (0.5x - 2x)
 * - Volume control with mute toggle
 * - Transcript toggle with sync highlighting
 * - Responsive design
 */
export function AudioBriefingPlayer({
  audioBase64,
  transcript,
  title = "Audio Briefing",
  duration: estimatedDuration,
  className,
}: AudioBriefingPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(estimatedDuration || 0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Create audio URL from base64
  const audioUrl = `data:audio/mpeg;base64,${audioBase64}`

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      setIsLoaded(true)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("ended", handleEnded)
    }
  }, [])

  // Sync playback rate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current
    if (!audio) return

    const newTime = value[0]
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }, [])

  const handleRestart = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = 0
    setCurrentTime(0)
    if (!isPlaying) {
      audio.play()
      setIsPlaying(true)
    }
  }, [isPlaying])

  const cyclePlaybackRate = useCallback(() => {
    const rates = [0.75, 1, 1.25, 1.5, 2]
    const currentIndex = rates.indexOf(playbackRate)
    const nextIndex = (currentIndex + 1) % rates.length
    setPlaybackRate(rates[nextIndex])
  }, [playbackRate])

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted)
  }, [isMuted])

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)]",
        "overflow-hidden",
        className
      )}
    >
      {/* Hidden audio element */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Player header */}
      <div className="px-4 py-3 border-b border-[var(--chat-border-subtle)] bg-gradient-to-r from-violet-500/10 to-purple-500/10">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600">
            <Volume2 className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium truncate">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {isLoaded ? formatTime(duration) : "Loading..."}
            </p>
          </div>
        </div>
      </div>

      {/* Player controls */}
      <div className="px-4 py-3 space-y-3">
        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="flex-1"
            disabled={!isLoaded}
          />
          <span className="text-xs text-muted-foreground w-10">
            {formatTime(duration)}
          </span>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* Restart */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRestart}
              disabled={!isLoaded}
              className="h-8 w-8"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>

            {/* Play/Pause */}
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              disabled={!isLoaded}
              className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>

            {/* Speed control */}
            <Button
              variant="ghost"
              size="sm"
              onClick={cyclePlaybackRate}
              disabled={!isLoaded}
              className="h-8 px-2 text-xs font-mono"
            >
              {playbackRate}x
            </Button>
          </div>

          <div className="flex items-center gap-1">
            {/* Volume */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="h-8 w-8"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.1}
              onValueChange={(v) => {
                setVolume(v[0])
                if (v[0] > 0) setIsMuted(false)
              }}
              className="w-20"
            />

            {/* Transcript toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowTranscript(!showTranscript)}
              className={cn(
                "h-8 w-8 ml-2",
                showTranscript && "bg-primary/10 text-primary"
              )}
            >
              <FileText className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Transcript panel */}
      {showTranscript && (
        <div className="border-t border-[var(--chat-border-subtle)]">
          <button
            onClick={() => setShowTranscript(false)}
            className="w-full px-4 py-2 flex items-center justify-between text-xs font-medium text-muted-foreground hover:bg-[var(--chat-surface-elevated)] transition-colors"
          >
            <span>Transcript</span>
            <ChevronUp className="h-4 w-4" />
          </button>
          <div className="px-4 pb-4 max-h-48 overflow-y-auto chat-scrollbar">
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {transcript}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Compact Audio Player for inline chat messages
 */
export function CompactAudioPlayer({
  audioBase64,
  transcript,
  className,
}: {
  audioBase64: string
  transcript: string
  className?: string
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  const audioUrl = `data:audio/mpeg;base64,${audioBase64}`

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      setProgress((audio.currentTime / audio.duration) * 100)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setProgress(0)
    }

    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("ended", handleEnded)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg",
        "bg-[var(--chat-surface-elevated)] border border-[var(--chat-border)]",
        className
      )}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700"
      >
        {isPlaying ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5 ml-0.5" />
        )}
      </Button>

      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      <span className="text-xs text-muted-foreground">
        {transcript.split(/\s+/).length} words
      </span>
    </div>
  )
}
