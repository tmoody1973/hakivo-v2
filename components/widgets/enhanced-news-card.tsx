"use client"

import { useState } from "react"
import { ExternalLink, Clock, TrendingUp, Sparkles, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface NewsEnrichment {
  plainLanguageSummary: string
  keyPoints: string[]
  readingTimeMinutes: number
  impactLevel: string
  tags: string[]
  enrichedAt: string
  modelUsed: string
}

interface NewsArticle {
  id: string
  title: string
  url: string
  author: string | null
  summary: string
  imageUrl: string | null
  publishedDate: string
  fetchedAt: number
  score: number
  sourceDomain: string
  interest: string
  enrichment: NewsEnrichment | null
}

interface EnhancedNewsCardProps {
  article: NewsArticle
}

const impactLevelConfig = {
  low: { label: "Low Impact", color: "bg-slate-500/10 text-slate-700 dark:text-slate-400" },
  medium: { label: "Medium Impact", color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" },
  high: { label: "High Impact", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  critical: { label: "Critical Impact", color: "bg-red-500/10 text-red-700 dark:text-red-400" },
}

export function EnhancedNewsCard({ article }: EnhancedNewsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { enrichment } = article
  const impactInfo = enrichment?.impactLevel
    ? impactLevelConfig[enrichment.impactLevel as keyof typeof impactLevelConfig]
    : null

  // Format published date
  const publishedDate = new Date(article.publishedDate)
  const timeAgo = getTimeAgo(publishedDate)

  // Truncate summary for preview
  const SUMMARY_CHAR_LIMIT = 200
  const summary = enrichment?.plainLanguageSummary || article.summary
  const isSummaryLong = summary.length > SUMMARY_CHAR_LIMIT
  const displaySummary = isExpanded || !isSummaryLong
    ? summary
    : summary.slice(0, SUMMARY_CHAR_LIMIT) + '...'

  // Limit key points displayed
  const MAX_KEY_POINTS = 3
  const keyPoints = enrichment?.keyPoints || []
  const displayKeyPoints = isExpanded ? keyPoints : keyPoints.slice(0, MAX_KEY_POINTS)
  const hasMoreKeyPoints = keyPoints.length > MAX_KEY_POINTS

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          {/* Thumbnail Image */}
          {article.imageUrl && (
            <div className="flex-shrink-0 w-24 h-24 rounded-md overflow-hidden bg-muted">
              <img
                src={article.imageUrl}
                alt={article.title}
                className="w-full h-full object-cover"
                onError={() => console.error('❌ [EnhancedNewsCard] Failed to load image:', article.imageUrl)}
                onLoad={() => console.log('✅ [EnhancedNewsCard] Image loaded:', article.imageUrl)}
              />
            </div>
          )}

          <div className="flex-1 space-y-2 min-w-0">
            {/* Category and Time */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {article.interest}
              </Badge>
              {enrichment && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Enhanced
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>

            {/* Title */}
            <Link href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              <h3 className="font-semibold text-lg leading-tight text-balance">
                {article.title}
              </h3>
            </Link>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* AI-Enhanced Summary or Regular Summary */}
        {enrichment ? (
          <>
            {/* Plain Language Summary */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {displaySummary}
              </p>
            </div>

            {/* Key Points */}
            {keyPoints.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Key Points</h4>
                <ul className="space-y-1 list-disc list-inside">
                  {displayKeyPoints.map((point, index) => (
                    <li key={index} className="text-sm text-muted-foreground leading-relaxed">
                      {point}
                    </li>
                  ))}
                </ul>
                {hasMoreKeyPoints && !isExpanded && (
                  <p className="text-xs text-muted-foreground italic">
                    +{keyPoints.length - MAX_KEY_POINTS} more point{keyPoints.length - MAX_KEY_POINTS > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}

            {/* Expand/Collapse Button */}
            {(isSummaryLong || hasMoreKeyPoints) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full text-xs h-8"
              >
                {isExpanded ? (
                  <>
                    Show Less <ChevronUp className="ml-1 h-3 w-3" />
                  </>
                ) : (
                  <>
                    Show More <ChevronDown className="ml-1 h-3 w-3" />
                  </>
                )}
              </Button>
            )}

            {/* Reading Time and Impact Level */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{enrichment.readingTimeMinutes} min read</span>
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
                {(isExpanded ? enrichment.tags : enrichment.tags.slice(0, 4)).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {!isExpanded && enrichment.tags.length > 4 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    +{enrichment.tags.length - 4}
                  </Badge>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Regular Summary (when not enriched) */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {displaySummary}
            </p>
            {/* Expand/Collapse Button for regular summary */}
            {isSummaryLong && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full text-xs h-8"
              >
                {isExpanded ? (
                  <>
                    Show Less <ChevronUp className="ml-1 h-3 w-3" />
                  </>
                ) : (
                  <>
                    Show More <ChevronDown className="ml-1 h-3 w-3" />
                  </>
                )}
              </Button>
            )}
          </>
        )}

        {/* Source and Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs font-medium text-muted-foreground">
            {article.sourceDomain}
            {article.author && ` • ${article.author}`}
          </span>
          <Button size="sm" variant="ghost" asChild>
            <Link href={article.url} target="_blank" rel="noopener noreferrer">
              Read Article
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Helper function to calculate time ago
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) {
    return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
  } else if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }
}
