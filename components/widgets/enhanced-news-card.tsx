"use client"

import { ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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

export function EnhancedNewsCard({ article }: EnhancedNewsCardProps) {
  // Format published date
  const publishedDate = new Date(article.publishedDate)
  const timeAgo = getTimeAgo(publishedDate)

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start gap-3">
          {/* Thumbnail Image - Bigger */}
          {article.imageUrl && (
            <div className="flex-shrink-0 w-32 h-32 rounded-md overflow-hidden bg-muted">
              <img
                src={article.imageUrl}
                alt={article.title}
                className="w-full h-full object-cover"
                onError={() => console.error('❌ [EnhancedNewsCard] Failed to load image:', article.imageUrl)}
                onLoad={() => console.log('✅ [EnhancedNewsCard] Image loaded:', article.imageUrl)}
              />
            </div>
          )}

          <div className="flex-1 space-y-1.5 min-w-0">
            {/* Category and Time */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs px-2 py-0">
                {article.interest}
              </Badge>
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>

            {/* Title - More compact */}
            <Link href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              <h3 className="font-semibold text-base leading-snug line-clamp-2">
                {article.title}
              </h3>
            </Link>

            {/* Compact summary preview - Always visible, no expand/collapse */}
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {article.summary}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 px-4 pb-3">
        {/* Source and Actions - Compact footer */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {article.sourceDomain}
            {article.author && ` • ${article.author}`}
          </span>
          <Button size="sm" variant="ghost" asChild className="h-7 text-xs">
            <Link href={article.url} target="_blank" rel="noopener noreferrer">
              Read Article
              <ExternalLink className="ml-1 h-3 w-3" />
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
