"use client"

import { useState } from "react"
import { FileText, Users, Calendar, ChevronDown, ChevronUp, Bookmark, BookmarkCheck, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Sponsor {
  name: string
  party: string
  state: string
  imageUrl?: string
}

interface BillCardProps {
  billNumber: string
  title: string
  /** Sponsor can be an object or a string like "Rep. Name (D-CA)" */
  sponsor: Sponsor | string
  status: string
  lastAction?: string
  lastActionDate?: string
  subjects?: string[]
  cosponsorsCount?: number
  summary?: string
  congressGovUrl?: string
  isTracked?: boolean
  onTrack?: () => void
  onUntrack?: () => void
  onViewDetails?: () => void
  className?: string
}

/** Parse sponsor string like "Rep. Name (D-CA)" into Sponsor object */
function parseSponsor(sponsor: Sponsor | string): Sponsor {
  if (typeof sponsor === "object") return sponsor

  // Try to parse "Rep. Name (D-CA)" format
  const match = sponsor.match(/^(.+?)\s*\(([DRIL])-([A-Z]{2})\)$/)
  if (match) {
    return {
      name: match[1].trim(),
      party: match[2],
      state: match[3],
    }
  }

  // Fallback: just use the string as the name
  return { name: sponsor, party: "I", state: "" }
}

// Status colors
const statusColors: Record<string, string> = {
  "Introduced": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "In Committee": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Passed House": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Passed Senate": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "To President": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Signed into Law": "bg-green-500/20 text-green-400 border-green-500/30",
  "Vetoed": "bg-red-500/20 text-red-400 border-red-500/30",
}

// Party colors
const partyColors: Record<string, string> = {
  "D": "bg-blue-500",
  "R": "bg-red-500",
  "I": "bg-purple-500",
}

export function BillCard({
  billNumber,
  title,
  sponsor: sponsorProp,
  status,
  lastAction,
  lastActionDate,
  subjects = [],
  cosponsorsCount = 0,
  summary,
  congressGovUrl,
  isTracked = false,
  onTrack,
  onUntrack,
  onViewDetails,
  className,
}: BillCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [tracking, setTracking] = useState(isTracked)

  // Parse sponsor - handles both string and object formats
  const sponsor = parseSponsor(sponsorProp)

  const handleTrackClick = () => {
    if (tracking) {
      onUntrack?.()
    } else {
      onTrack?.()
    }
    setTracking(!tracking)
  }

  const statusColor = statusColors[status] || "bg-gray-500/20 text-gray-400 border-gray-500/30"
  const partyColor = partyColors[sponsor.party] || "bg-gray-500"

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)]",
        "overflow-hidden transition-all duration-200",
        "hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
        "animate-message-in",
        className
      )}
    >
      {/* Header */}
      <div className="p-4 space-y-3">
        {/* Bill number and status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="font-mono text-sm font-semibold text-primary">
                {billNumber}
              </span>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-xs", statusColor)}>
            {status}
          </Badge>
        </div>

        {/* Title */}
        <h3 className="text-sm font-medium leading-snug line-clamp-2">
          {title}
        </h3>

        {/* Sponsor */}
        <div className="flex items-center gap-2">
          <div className="relative">
            {sponsor.imageUrl ? (
              <img
                src={sponsor.imageUrl}
                alt={sponsor.name}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {sponsor.name.split(" ").map(n => n[0]).join("")}
              </div>
            )}
            <div
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--chat-surface)]",
                partyColor
              )}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{sponsor.name}</span>
            {sponsor.party && sponsor.state && (
              <>
                <span className="mx-1">·</span>
                <span>{sponsor.party}-{sponsor.state}</span>
              </>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {cosponsorsCount > 0 && (
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span>{cosponsorsCount} cosponsors</span>
            </div>
          )}
          {lastActionDate && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>{lastActionDate}</span>
            </div>
          )}
        </div>

        {/* Subject tags */}
        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {subjects.slice(0, 3).map((subject) => (
              <Badge
                key={subject}
                variant="secondary"
                className="text-[10px] px-2 py-0"
              >
                {subject}
              </Badge>
            ))}
            {subjects.length > 3 && (
              <Badge variant="secondary" className="text-[10px] px-2 py-0">
                +{subjects.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Expandable section */}
      {(summary || lastAction) && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-2 flex items-center justify-between text-xs font-medium text-muted-foreground hover:bg-[var(--chat-surface-elevated)] transition-colors border-t border-[var(--chat-border-subtle)]"
          >
            <span>{isExpanded ? "Show less" : "Show more"}</span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {isExpanded && (
            <div className="px-4 pb-4 space-y-3 animate-fade-in">
              {lastAction && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Latest Action
                  </p>
                  <p className="text-sm">{lastAction}</p>
                </div>
              )}
              {summary && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Summary
                  </p>
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {summary}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div className="px-4 py-3 flex items-center gap-2 border-t border-[var(--chat-border-subtle)] bg-[var(--chat-surface-elevated)]">
        <Button
          variant={tracking ? "secondary" : "default"}
          size="sm"
          onClick={handleTrackClick}
          className={cn(
            "flex-1",
            tracking && "bg-primary/10 text-primary hover:bg-primary/20"
          )}
        >
          {tracking ? (
            <>
              <BookmarkCheck className="h-4 w-4 mr-1.5" />
              Tracking
            </>
          ) : (
            <>
              <Bookmark className="h-4 w-4 mr-1.5" />
              Track Bill
            </>
          )}
        </Button>
        {congressGovUrl && (
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <a href={congressGovUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
        {onViewDetails && (
          <Button variant="outline" size="sm" onClick={onViewDetails}>
            Details
          </Button>
        )}
      </div>
    </div>
  )
}
