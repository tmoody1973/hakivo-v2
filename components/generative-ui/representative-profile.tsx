"use client"

import { useState } from "react"
import { Phone, Globe, Mail, Users, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface RepresentativeProfileProps {
  name: string
  party: "D" | "R" | "I" | string
  state: string
  district?: number | null
  chamber: "Senate" | "House" | string
  imageUrl?: string
  phone?: string
  email?: string
  website?: string
  office?: string
  committees?: string[]
  votingAlignmentScore?: number
  sponsoredBillsCount?: number
  termStart?: string
  termEnd?: string
  socialLinks?: {
    twitter?: string
    facebook?: string
  }
  onContact?: () => void
  onViewVotes?: () => void
  className?: string
}

// Party configurations
const partyConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  D: { color: "text-blue-400", bgColor: "bg-blue-500", label: "Democrat" },
  R: { color: "text-red-400", bgColor: "bg-red-500", label: "Republican" },
  I: { color: "text-purple-400", bgColor: "bg-purple-500", label: "Independent" },
}

export function RepresentativeProfile({
  name,
  party,
  state,
  district,
  chamber,
  imageUrl,
  phone,
  email,
  website,
  office,
  committees = [],
  votingAlignmentScore,
  sponsoredBillsCount,
  termStart,
  termEnd,
  socialLinks,
  onContact,
  onViewVotes,
  className,
}: RepresentativeProfileProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const partyInfo = partyConfig[party] || {
    color: "text-gray-400",
    bgColor: "bg-gray-500",
    label: party,
  }

  const chamberTitle = chamber === "Senate" ? "Senator" : "Representative"
  const location = district ? `${state}-${district}` : state

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
      {/* Header with photo */}
      <div className="relative">
        {/* Party color bar */}
        <div className={cn("h-1", partyInfo.bgColor)} />

        <div className="p-4">
          <div className="flex gap-4">
            {/* Photo */}
            <div className="relative shrink-0">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={name}
                  className="h-20 w-20 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted text-xl font-semibold">
                  {name.split(" ").map(n => n[0]).join("")}
                </div>
              )}
              <div
                className={cn(
                  "absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-[var(--chat-surface)]",
                  "flex items-center justify-center text-xs font-bold text-white",
                  partyInfo.bgColor
                )}
              >
                {party}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{name}</h3>
              <p className="text-sm text-muted-foreground">
                {chamberTitle} · {location}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  variant="outline"
                  className={cn("text-xs", partyInfo.color, "border-current/30")}
                >
                  {partyInfo.label}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {chamber}
                </Badge>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            {votingAlignmentScore !== undefined && (
              <div className="p-3 rounded-lg bg-[var(--chat-surface-elevated)]">
                <p className="text-xs text-muted-foreground mb-1">Party Alignment</p>
                <div className="flex items-center gap-2">
                  <Progress value={votingAlignmentScore} className="h-2 flex-1" />
                  <span className="text-sm font-semibold">{votingAlignmentScore.toFixed(1)}%</span>
                </div>
              </div>
            )}
            {sponsoredBillsCount !== undefined && (
              <div className="p-3 rounded-lg bg-[var(--chat-surface-elevated)]">
                <p className="text-xs text-muted-foreground mb-1">Bills Sponsored</p>
                <p className="text-lg font-semibold">{sponsoredBillsCount}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div className="px-4 py-3 border-t border-[var(--chat-border-subtle)] space-y-2">
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Phone className="h-4 w-4" />
            <span>{phone}</span>
          </a>
        )}
        {website && (
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Globe className="h-4 w-4" />
            <span className="truncate">{website.replace(/^https?:\/\//, "")}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        )}
        {email && (
          <a
            href={`mailto:${email}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Mail className="h-4 w-4" />
            <span className="truncate">{email}</span>
          </a>
        )}
      </div>

      {/* Expandable committees section */}
      {committees.length > 0 && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-2 flex items-center justify-between text-xs font-medium text-muted-foreground hover:bg-[var(--chat-surface-elevated)] transition-colors border-t border-[var(--chat-border-subtle)]"
          >
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {committees.length} Committee{committees.length !== 1 ? "s" : ""}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {isExpanded && (
            <div className="px-4 pb-4 animate-fade-in">
              <div className="flex flex-wrap gap-1.5">
                {committees.map((committee) => (
                  <Badge
                    key={committee}
                    variant="secondary"
                    className="text-xs"
                  >
                    {committee}
                  </Badge>
                ))}
              </div>
              {termStart && termEnd && (
                <p className="text-xs text-muted-foreground mt-3">
                  Term: {termStart} - {termEnd}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div className="px-4 py-3 flex items-center gap-2 border-t border-[var(--chat-border-subtle)] bg-[var(--chat-surface-elevated)]">
        {onContact && (
          <Button variant="default" size="sm" onClick={onContact} className="flex-1">
            <Phone className="h-4 w-4 mr-1.5" />
            Contact
          </Button>
        )}
        {onViewVotes && (
          <Button variant="outline" size="sm" onClick={onViewVotes} className="flex-1">
            View Votes
          </Button>
        )}
        {website && (
          <Button variant="outline" size="sm" asChild>
            <a href={website} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}
