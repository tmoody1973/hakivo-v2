"use client"

import { ExternalLink, Calendar, Newspaper } from "lucide-react"
import { cn } from "@/lib/utils"

interface NewsCardProps {
  headline: string
  source: string
  date: string
  snippet: string
  url: string
  imageUrl?: string
  relevanceScore?: number
  className?: string
}

export function NewsCard({
  headline,
  source,
  date,
  snippet,
  url,
  imageUrl,
  relevanceScore,
  className,
}: NewsCardProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group block rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)]",
        "overflow-hidden transition-all duration-200",
        "hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
        "animate-message-in",
        className
      )}
    >
      <div className="flex gap-4 p-4">
        {/* Image */}
        {imageUrl ? (
          <div className="relative shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-muted">
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ) : (
          <div className="shrink-0 w-24 h-24 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
            <Newspaper className="h-8 w-8 text-primary/50" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Source and date */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{source}</span>
            <span>·</span>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{date}</span>
            </div>
            {relevanceScore !== undefined && relevanceScore > 0.8 && (
              <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/20 text-primary">
                Highly Relevant
              </span>
            )}
          </div>

          {/* Headline */}
          <h3 className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {headline}
          </h3>

          {/* Snippet */}
          <p className="text-xs text-muted-foreground line-clamp-2">
            {snippet}
          </p>
        </div>

        {/* External link icon */}
        <div className="shrink-0 self-start">
          <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </a>
  )
}

/**
 * News Card Grid for displaying multiple news articles
 */
interface NewsCardGridProps {
  articles: NewsCardProps[]
  title?: string
  className?: string
}

export function NewsCardGrid({
  articles,
  title,
  className,
}: NewsCardGridProps) {
  if (articles.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No news articles found</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      {title && (
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Newspaper className="h-4 w-4" />
          <span>{title}</span>
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
            {articles.length} articles
          </span>
        </div>
      )}
      <div className="space-y-2">
        {articles.map((article, index) => (
          <NewsCard
            key={`${article.url}-${index}`}
            {...article}
          />
        ))}
      </div>
    </div>
  )
}
