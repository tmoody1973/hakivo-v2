"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { BookmarkPlus, BookmarkCheck, MessageSquare, ExternalLink, Sparkles, TrendingUp, Users, Loader2 } from 'lucide-react'
import Link from "next/link"

interface BillEnrichment {
  plainLanguageSummary: string
  keyPoints: string[]
  readingTimeMinutes: number
  impactLevel: string
  bipartisanScore: number
  currentStage: string
  progressPercentage: number
  tags: string[]
  enrichedAt: string
  modelUsed: string
}

interface BillSponsor {
  firstName: string
  lastName: string
  party: string
  state: string
}

interface EnrichedBill {
  id: string
  congress: number
  billType: string
  billNumber: number
  title: string
  policyArea: string | null
  introducedDate: string | null
  latestActionDate: string | null
  latestActionText: string | null
  originChamber: string | null
  updateDate: string | null
  sponsor: BillSponsor | null
  enrichment: BillEnrichment | null
}

interface EnhancedBillCardProps {
  bill: EnrichedBill
  isTracked?: boolean
  onTrack?: (billId: string) => Promise<boolean>
  onUntrack?: (billId: string) => Promise<boolean>
}

const impactLevelConfig = {
  low: { label: "Low Impact", color: "bg-slate-500/10 text-slate-700 dark:text-slate-400" },
  medium: { label: "Medium Impact", color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" },
  high: { label: "High Impact", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  critical: { label: "Critical Impact", color: "bg-red-500/10 text-red-700 dark:text-red-400" },
}

const stageConfig = {
  introduced: { label: "Introduced", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  "in-committee": { label: "In Committee", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
  "passed-house": { label: "Passed House", color: "bg-green-500/10 text-green-700 dark:text-green-400" },
  "passed-senate": { label: "Passed Senate", color: "bg-green-500/10 text-green-700 dark:text-green-400" },
  enacted: { label: "Enacted", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  failed: { label: "Failed", color: "bg-red-500/10 text-red-700 dark:text-red-400" },
}

export function EnhancedBillCard({ bill, isTracked = false, onTrack, onUntrack }: EnhancedBillCardProps) {
  const [tracked, setTracked] = useState(isTracked)
  const [isLoading, setIsLoading] = useState(false)

  const { enrichment, sponsor } = bill
  const partyColor = sponsor?.party === "D" ? "text-blue-600" : sponsor?.party === "R" ? "text-red-600" : "text-gray-600"

  const handleTrackClick = async () => {
    if (isLoading) return

    setIsLoading(true)
    try {
      if (tracked && onUntrack) {
        const success = await onUntrack(bill.id)
        if (success) setTracked(false)
      } else if (!tracked && onTrack) {
        const success = await onTrack(bill.id)
        if (success) setTracked(true)
      }
    } catch (error) {
      console.error('Track/untrack error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const impactInfo = enrichment?.impactLevel
    ? impactLevelConfig[enrichment.impactLevel as keyof typeof impactLevelConfig]
    : null

  const stageInfo = enrichment?.currentStage
    ? stageConfig[enrichment.currentStage as keyof typeof stageConfig] || stageConfig.introduced
    : null

  // Format bill number
  const billDisplayNumber = `${bill.billType.toUpperCase()} ${bill.billNumber}`

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            {/* Bill Number and Status */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold text-primary">
                {billDisplayNumber}
              </span>
              {stageInfo && (
                <Badge className={stageInfo.color} variant="secondary">
                  {stageInfo.label}
                </Badge>
              )}
              {enrichment && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Enhanced
                </Badge>
              )}
            </div>

            {/* Title */}
            <Link href={`/bills/${bill.id}`} className="hover:underline">
              <h3 className="font-semibold text-lg leading-tight text-balance">
                {bill.title}
              </h3>
            </Link>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sponsor Info */}
        {sponsor && (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={`/placeholder.svg`} alt={`${sponsor.firstName} ${sponsor.lastName}`} />
              <AvatarFallback>{sponsor.firstName[0]}{sponsor.lastName[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                Sponsored by <span className={partyColor}>{sponsor.firstName} {sponsor.lastName}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {sponsor.party}-{sponsor.state}
              </p>
            </div>
            {bill.introducedDate && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(bill.introducedDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            )}
          </div>
        )}

        {/* AI-Enhanced Content or Regular Info */}
        {enrichment ? (
          <>
            {/* Plain Language Summary */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {enrichment.plainLanguageSummary}
              </p>
            </div>

            {/* Key Points */}
            {enrichment.keyPoints && enrichment.keyPoints.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Key Provisions</h4>
                <ul className="space-y-1.5 list-disc list-inside">
                  {enrichment.keyPoints.slice(0, 3).map((point, index) => (
                    <li key={index} className="text-sm text-muted-foreground leading-relaxed">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Legislative Progress</span>
                <span className="text-primary font-semibold">{enrichment.progressPercentage}%</span>
              </div>
              <Progress value={enrichment.progressPercentage} className="h-2" />
            </div>

            {/* Bipartisan Score and Impact Level */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Bipartisan Score:</span>
                <Badge
                  variant="outline"
                  className={
                    enrichment.bipartisanScore >= 70
                      ? "bg-green-500/10 text-green-700 dark:text-green-400"
                      : enrichment.bipartisanScore >= 40
                      ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                      : "bg-red-500/10 text-red-700 dark:text-red-400"
                  }
                >
                  {enrichment.bipartisanScore}/100
                </Badge>
              </div>
              {impactInfo && (
                <Badge className={impactInfo.color} variant="secondary">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {impactInfo.label}
                </Badge>
              )}
            </div>

            {/* Tags */}
            {enrichment.tags && enrichment.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {enrichment.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Latest Action (when not enriched) */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Latest Action</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {bill.latestActionText}
              </p>
              {bill.latestActionDate && (
                <p className="text-xs text-muted-foreground">
                  {new Date(bill.latestActionDate).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              )}
            </div>

            {/* Policy Area */}
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-xs">
                {bill.policyArea}
              </Badge>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button size="sm" variant="default" asChild>
            <Link href={`/bills/${bill.id}`}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              View Details
            </Link>
          </Button>
          <Button
            size="sm"
            variant={tracked ? "secondary" : "outline"}
            onClick={handleTrackClick}
            disabled={isLoading || (!onTrack && !onUntrack)}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : tracked ? (
              <BookmarkCheck className="h-3.5 w-3.5 mr-1.5" />
            ) : (
              <BookmarkPlus className="h-3.5 w-3.5 mr-1.5" />
            )}
            {tracked ? "Tracked" : "Track"}
          </Button>
          <Button size="sm" variant="outline">
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            Ask AI
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
