"use client"
import type React from "react"
import { Play, Clock, Bookmark, Download, Pause } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"

export function DailyBriefWidget() {
  const [isPlaying, setIsPlaying] = useState(false)

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
              src="/us-capitol-building-congressional-legislation-brie.jpg" 
              alt="Daily Legislative Brief"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 text-xs py-0">
                  Legislative Update
                </Badge>
                <span className="text-xs text-muted-foreground">January 11, 2025</span>
              </div>
              
              <h3 className="font-semibold text-base leading-tight">
                Daily Legislative Brief: Healthcare, Climate, and Education Updates
              </h3>
            </div>
            
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              Covering 5 bills matching your interests including healthcare reform, climate legislation, and education funding updates. Today's brief focuses on bipartisan efforts and key committee votes.
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                size="sm"
                onClick={() => setIsPlaying(!isPlaying)}
                className="rounded-full px-5 h-9 bg-primary hover:bg-primary/90"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5 mr-1.5 fill-current" />
                    Pause 2:50
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                    Listen 2:50
                  </>
                )}
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm"
                className="text-muted-foreground hover:text-foreground h-9 px-3"
              >
                <Bookmark className="h-3.5 w-3.5 mr-1.5" />
                Save
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm"
                className="text-muted-foreground hover:text-foreground h-9 px-3"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download
              </Button>
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
