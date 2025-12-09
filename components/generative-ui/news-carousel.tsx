"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight, ExternalLink, Newspaper } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface NewsArticle {
  title: string
  source: string
  date?: string | null
  snippet?: string
  url: string
  image?: string
  imageUrl?: string
  summary?: string
}

interface NewsCarouselProps {
  articles: NewsArticle[]
  title?: string
  summary?: string
  className?: string
}

/**
 * News Carousel - Horizontal scrolling cards with images, titles, summaries, and read more buttons
 * Inspired by Thesys C1 component patterns
 */
export function NewsCarousel({
  articles,
  title,
  summary,
  className,
}: NewsCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const updateScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  useEffect(() => {
    updateScrollButtons()
    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener("scroll", updateScrollButtons)
      return () => container.removeEventListener("scroll", updateScrollButtons)
    }
  }, [articles])

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
    }
  }

  if (!articles || articles.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No news articles found</p>
      </div>
    )
  }

  // Clean and truncate summary for display
  const cleanSummary = (text: string | undefined) => {
    if (!text) return null
    // Remove citation references like [1], [2][3], etc.
    let cleaned = text.replace(/\[\d+\](\[\d+\])*/g, "")
    // Remove markdown bold markers
    cleaned = cleaned.replace(/\*\*/g, "")
    // Remove leading dashes/bullets
    cleaned = cleaned.replace(/^\s*-\s*/gm, "")
    // Collapse multiple spaces
    cleaned = cleaned.replace(/\s+/g, " ").trim()
    // Truncate to ~200 chars at word boundary
    if (cleaned.length > 200) {
      cleaned = cleaned.substring(0, 200).replace(/\s+\S*$/, "") + "..."
    }
    return cleaned
  }

  const displaySummary = cleanSummary(summary)

  return (
    <div className={cn("space-y-4 animate-message-in", className)}>
      {/* Header */}
      {(title || displaySummary) && (
        <div className="rounded-lg border border-[var(--chat-border)] bg-[var(--chat-surface)] p-4 space-y-3">
          {title && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground text-base">Related News</h3>
              </div>
              <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                {articles.length} articles
              </span>
            </div>
          )}
          {displaySummary && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
              {displaySummary}
            </p>
          )}
        </div>
      )}

      {/* Carousel container */}
      <div className="relative group">
        {/* Left arrow */}
        {canScrollLeft && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity bg-background/95 hover:bg-background border"
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}

        {/* Right arrow */}
        {canScrollRight && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity bg-background/95 hover:bg-background border"
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}

        {/* Scrollable cards */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1 scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {articles.map((article, idx) => (
            <NewsCarouselCard key={`${article.url}-${idx}`} article={article} />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Individual news card in the carousel
 */
function NewsCarouselCard({ article }: { article: NewsArticle }) {
  const imageUrl = article.image || article.imageUrl
  const description = article.summary || article.snippet || ""

  return (
    <div className="flex-shrink-0 w-[280px] rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)] overflow-hidden transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 group">
      {/* Image */}
      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-violet-500/20 to-purple-500/20">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = "none"
              e.currentTarget.nextElementSibling?.classList.remove("hidden")
            }}
          />
        ) : null}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center",
          imageUrl ? "hidden" : ""
        )}>
          <Newspaper className="h-12 w-12 text-primary/40" />
        </div>
        {/* Source badge */}
        <div className="absolute top-2 left-2">
          <span className="px-2 py-1 text-xs font-medium rounded-md bg-black/60 text-white backdrop-blur-sm">
            {article.source}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <h4 className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors min-h-[2.5rem]">
          {article.title}
        </h4>

        {/* Description/Summary */}
        <p className="text-xs text-muted-foreground line-clamp-3 min-h-[3rem]">
          {description || `Latest news from ${article.source}${article.date ? ` - ${article.date}` : ""}`}
        </p>

        {/* Read more button */}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors"
        >
          Read more
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  )
}

export { type NewsArticle }
