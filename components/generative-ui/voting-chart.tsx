"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Check, X, Minus, HelpCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface PartyBreakdown {
  D: { yea: number; nay: number; present?: number; notVoting?: number }
  R: { yea: number; nay: number; present?: number; notVoting?: number }
  I?: { yea: number; nay: number; present?: number; notVoting?: number }
}

interface UserRepVote {
  name: string
  vote: "Yea" | "Nay" | "Present" | "Not Voting"
  party?: string
}

interface VotingChartProps {
  billNumber: string
  billTitle?: string
  yea: number
  nay: number
  present?: number
  notVoting?: number
  partyBreakdown?: PartyBreakdown
  userRepVote?: UserRepVote
  voteDate?: string
  result?: "Passed" | "Failed" | "Pending"
  chamber?: "House" | "Senate"
  className?: string
}

// Vote type configurations
const voteConfig = {
  yea: { color: "bg-emerald-500", label: "Yea", icon: Check },
  nay: { color: "bg-red-500", label: "Nay", icon: X },
  present: { color: "bg-amber-500", label: "Present", icon: Minus },
  notVoting: { color: "bg-gray-500", label: "Not Voting", icon: HelpCircle },
}

export function VotingChart({
  billNumber,
  billTitle,
  yea,
  nay,
  present = 0,
  notVoting = 0,
  partyBreakdown,
  userRepVote,
  voteDate,
  result,
  chamber,
  className,
}: VotingChartProps) {
  const [showDetails, setShowDetails] = useState(false)

  const total = yea + nay + present + notVoting
  const yeaPercent = total > 0 ? (yea / total) * 100 : 0
  const nayPercent = total > 0 ? (nay / total) * 100 : 0
  const presentPercent = total > 0 ? (present / total) * 100 : 0
  const notVotingPercent = total > 0 ? (notVoting / total) * 100 : 0

  const resultColor = result === "Passed"
    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    : result === "Failed"
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : "bg-amber-500/20 text-amber-400 border-amber-500/30"

  const userVoteColor = userRepVote?.vote === "Yea"
    ? "text-emerald-400"
    : userRepVote?.vote === "Nay"
      ? "text-red-400"
      : "text-muted-foreground"

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)]",
        "overflow-hidden transition-all duration-200",
        "animate-message-in",
        className
      )}
    >
      {/* Header */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="font-mono text-sm font-semibold text-primary">
              {billNumber}
            </span>
            {billTitle && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                {billTitle}
              </p>
            )}
          </div>
          {result && (
            <Badge variant="outline" className={cn("text-xs shrink-0", resultColor)}>
              {result}
            </Badge>
          )}
        </div>

        {/* Main vote bar */}
        <div className="space-y-2">
          <div className="h-8 rounded-lg overflow-hidden flex">
            {yeaPercent > 0 && (
              <div
                className="bg-emerald-500 flex items-center justify-center text-xs font-medium text-white transition-all duration-500"
                style={{ width: `${yeaPercent}%` }}
              >
                {yeaPercent >= 15 && yea}
              </div>
            )}
            {nayPercent > 0 && (
              <div
                className="bg-red-500 flex items-center justify-center text-xs font-medium text-white transition-all duration-500"
                style={{ width: `${nayPercent}%` }}
              >
                {nayPercent >= 15 && nay}
              </div>
            )}
            {presentPercent > 0 && (
              <div
                className="bg-amber-500 flex items-center justify-center text-xs font-medium text-white transition-all duration-500"
                style={{ width: `${presentPercent}%` }}
              />
            )}
            {notVotingPercent > 0 && (
              <div
                className="bg-gray-500 flex items-center justify-center text-xs font-medium text-white transition-all duration-500"
                style={{ width: `${notVotingPercent}%` }}
              />
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-emerald-500" />
              <span className="text-muted-foreground">Yea:</span>
              <span className="font-semibold">{yea}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-red-500" />
              <span className="text-muted-foreground">Nay:</span>
              <span className="font-semibold">{nay}</span>
            </div>
            {present > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-amber-500" />
                <span className="text-muted-foreground">Present:</span>
                <span className="font-semibold">{present}</span>
              </div>
            )}
            {notVoting > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-gray-500" />
                <span className="text-muted-foreground">Not Voting:</span>
                <span className="font-semibold">{notVoting}</span>
              </div>
            )}
          </div>
        </div>

        {/* User's representative vote highlight */}
        {userRepVote && (
          <div className="p-3 rounded-lg bg-[var(--chat-surface-elevated)] border border-[var(--chat-border-subtle)]">
            <p className="text-xs text-muted-foreground mb-1">Your Representative</p>
            <div className="flex items-center justify-between">
              <span className="font-medium">{userRepVote.name}</span>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  userRepVote.vote === "Yea" && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                  userRepVote.vote === "Nay" && "bg-red-500/20 text-red-400 border-red-500/30",
                  userRepVote.vote === "Present" && "bg-amber-500/20 text-amber-400 border-amber-500/30",
                  userRepVote.vote === "Not Voting" && "bg-gray-500/20 text-gray-400 border-gray-500/30"
                )}
              >
                {userRepVote.vote}
              </Badge>
            </div>
          </div>
        )}

        {voteDate && (
          <p className="text-xs text-muted-foreground">
            {chamber && `${chamber} · `}Voted on {voteDate}
          </p>
        )}
      </div>

      {/* Party breakdown (expandable) */}
      {partyBreakdown && (
        <>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full px-4 py-2 flex items-center justify-between text-xs font-medium text-muted-foreground hover:bg-[var(--chat-surface-elevated)] transition-colors border-t border-[var(--chat-border-subtle)]"
          >
            <span>Party Breakdown</span>
            {showDetails ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showDetails && (
            <div className="px-4 pb-4 space-y-3 animate-fade-in">
              {/* Democrats */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-blue-400">Democrats</span>
                  <span className="text-muted-foreground">
                    {partyBreakdown.D.yea + partyBreakdown.D.nay + (partyBreakdown.D.present || 0)} votes
                  </span>
                </div>
                <div className="h-4 rounded overflow-hidden flex bg-muted">
                  {partyBreakdown.D.yea > 0 && (
                    <div
                      className="bg-emerald-500 flex items-center justify-center text-[10px] font-medium text-white"
                      style={{
                        width: `${(partyBreakdown.D.yea / (partyBreakdown.D.yea + partyBreakdown.D.nay + (partyBreakdown.D.present || 0))) * 100}%`
                      }}
                    >
                      {partyBreakdown.D.yea}
                    </div>
                  )}
                  {partyBreakdown.D.nay > 0 && (
                    <div
                      className="bg-red-500 flex items-center justify-center text-[10px] font-medium text-white"
                      style={{
                        width: `${(partyBreakdown.D.nay / (partyBreakdown.D.yea + partyBreakdown.D.nay + (partyBreakdown.D.present || 0))) * 100}%`
                      }}
                    >
                      {partyBreakdown.D.nay}
                    </div>
                  )}
                </div>
              </div>

              {/* Republicans */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-red-400">Republicans</span>
                  <span className="text-muted-foreground">
                    {partyBreakdown.R.yea + partyBreakdown.R.nay + (partyBreakdown.R.present || 0)} votes
                  </span>
                </div>
                <div className="h-4 rounded overflow-hidden flex bg-muted">
                  {partyBreakdown.R.yea > 0 && (
                    <div
                      className="bg-emerald-500 flex items-center justify-center text-[10px] font-medium text-white"
                      style={{
                        width: `${(partyBreakdown.R.yea / (partyBreakdown.R.yea + partyBreakdown.R.nay + (partyBreakdown.R.present || 0))) * 100}%`
                      }}
                    >
                      {partyBreakdown.R.yea}
                    </div>
                  )}
                  {partyBreakdown.R.nay > 0 && (
                    <div
                      className="bg-red-500 flex items-center justify-center text-[10px] font-medium text-white"
                      style={{
                        width: `${(partyBreakdown.R.nay / (partyBreakdown.R.yea + partyBreakdown.R.nay + (partyBreakdown.R.present || 0))) * 100}%`
                      }}
                    >
                      {partyBreakdown.R.nay}
                    </div>
                  )}
                </div>
              </div>

              {/* Independents (if any) */}
              {partyBreakdown.I && (partyBreakdown.I.yea > 0 || partyBreakdown.I.nay > 0) && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-purple-400">Independents</span>
                    <span className="text-muted-foreground">
                      {partyBreakdown.I.yea + partyBreakdown.I.nay} votes
                    </span>
                  </div>
                  <div className="h-4 rounded overflow-hidden flex bg-muted">
                    {partyBreakdown.I.yea > 0 && (
                      <div
                        className="bg-emerald-500 flex items-center justify-center text-[10px] font-medium text-white"
                        style={{
                          width: `${(partyBreakdown.I.yea / (partyBreakdown.I.yea + partyBreakdown.I.nay)) * 100}%`
                        }}
                      >
                        {partyBreakdown.I.yea}
                      </div>
                    )}
                    {partyBreakdown.I.nay > 0 && (
                      <div
                        className="bg-red-500 flex items-center justify-center text-[10px] font-medium text-white"
                        style={{
                          width: `${(partyBreakdown.I.nay / (partyBreakdown.I.yea + partyBreakdown.I.nay)) * 100}%`
                        }}
                      >
                        {partyBreakdown.I.nay}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
