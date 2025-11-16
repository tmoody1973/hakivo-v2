"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Play, Pause, SkipBack, SkipForward, Volume2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Card } from "@/components/ui/card"

export function PersistentAudioPlayer() {
  const pathname = usePathname()
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState([35])
  const [volume, setVolume] = useState([75])

  // Don't show player on landing page or onboarding
  if (pathname === '/' || pathname === '/onboarding') {
    return null
  }

  return (
    <Card className="fixed bottom-0 left-0 right-0 z-50 border-t rounded-none bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex items-center gap-4 px-4 md:px-6 py-3">
        {/* Now Playing Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-[0_0_250px]">
          <div className="h-12 w-12 rounded bg-accent flex items-center justify-center flex-shrink-0">
            <Clock className="h-6 w-6 text-accent-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">Today's Legislative Brief</p>
            <p className="text-xs text-muted-foreground truncate">March 15, 2024 • 8 min</p>
          </div>
        </div>

        {/* Player Controls */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button variant="default" size="icon" className="h-10 w-10" onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="hidden md:flex items-center gap-2 w-full max-w-md">
            <span className="text-xs text-muted-foreground tabular-nums">2:45</span>
            <Slider value={progress} onValueChange={setProgress} max={100} step={1} className="flex-1" />
            <span className="text-xs text-muted-foreground tabular-nums">8:00</span>
          </div>
        </div>

        {/* Volume Control */}
        <div className="hidden lg:flex items-center gap-2 flex-[0_0_150px]">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Slider value={volume} onValueChange={setVolume} max={100} step={1} className="w-24" />
        </div>
      </div>
    </Card>
  )
}
