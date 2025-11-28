"use client"

import { ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface NewsEnrichment {
  plainLanguageSummary?: string
  keyPoints?: string[]
  readingTimeMinutes?: number
  impactLevel?: string
  tags?: string[]
  enrichedAt?: string
  modelUsed?: string
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
  enrichment?: NewsEnrichment | null
}

interface EnhancedNewsCardProps {
  article: NewsArticle
}

export function EnhancedNewsCard({ article }: EnhancedNewsCardProps) {
  // Format published date
  const publishedDate = new Date(article.publishedDate)
  const timeAgo = getTimeAgo(publishedDate)

  // Clean up author text - Exa sometimes returns extra metadata
  const cleanAuthor = (author: string | null): string | null => {
    if (!author) return null
    // Remove common suffixes like "US News Reporter", "ShareNewsweek", "Trust Project member", etc.
    let clean = author
      .replace(/\s*(US News Reporter|News Reporter|Reporter|Share|ShareNewsweek|is a Trust Project member|Trust Project member|Staff Writer|Correspondent|Editor|Contributor).*$/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
    // If nothing left or too short, skip
    if (clean.length < 2) return null
    return clean
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3 pt-3 px-4">
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

          <div className="flex-1 flex flex-col justify-between min-w-0 h-32">
            <div className="space-y-0.5">
              {/* Category and Time */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs px-2 py-0">
                  {article.interest}
                </Badge>
                <span className="text-xs text-muted-foreground">{timeAgo}</span>
              </div>

              {/* Title - More compact */}
              <Link href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                  {article.title}
                </h3>
              </Link>

              {/* Compact summary preview */}
              <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                {article.summary}
              </p>
            </div>

            {/* Source and Actions - Aligned with bottom of image */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground truncate">
                {article.sourceDomain}
                {cleanAuthor(article.author) && ` • ${cleanAuthor(article.author)}`}
              </span>
              <Button size="sm" variant="ghost" asChild className="h-6 text-xs px-2 flex-shrink-0">
                <Link href={article.url} target="_blank" rel="noopener noreferrer">
                  Read
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
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
