"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, FileText, Users, Calendar, ExternalLink, Bookmark, BookmarkCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Bill {
  id?: string
  bill_id?: string
  congress?: number
  bill_type?: string
  type?: string
  bill_number?: number
  number?: number
  title: string
  short_title?: string
  sponsor_name?: string
  sponsor_party?: string
  sponsor_state?: string
  policy_area?: string
  policyArea?: string
  latest_action_text?: string
  latest_action_date?: string
  similarity_score?: number
  relevanceScore?: number
  matched_content?: string
  matchedChunk?: string
  cosponsors_count?: number
}

interface BillsCarouselProps {
  bills: Bill[]
  query?: string
  summary?: string
  className?: string
  onTrackBill?: (billId: string) => void
}

// Party colors
const partyColors: Record<string, string> = {
  "D": "bg-blue-500",
  "R": "bg-red-500",
  "I": "bg-purple-500",
}

/**
 * Generate an AI-style relevance summary based on matched content and query
 */
function generateRelevanceSummary(bill: Bill, query?: string): string {
  const matchedContent = bill.matched_content || bill.matchedChunk || ""
  const policyArea = bill.policy_area || bill.policyArea || ""
  const title = bill.title || ""

  // If we have matched content, create a summary from it
  if (matchedContent && matchedContent.length > 50) {
    // Clean up the matched content
    let cleaned = matchedContent
      .replace(/<DOC>/g, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/_{2,}/g, "")
      .trim()

    // Extract the most relevant sentence or clause
    const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 20)
    if (sentences.length > 0) {
      // Find the most relevant sentence (contains query terms if available)
      let bestSentence = sentences[0]
      if (query) {
        const queryTerms = query.toLowerCase().split(/\s+/)
        for (const sentence of sentences) {
          const lower = sentence.toLowerCase()
          const matchCount = queryTerms.filter(term => lower.includes(term)).length
          if (matchCount > 0) {
            bestSentence = sentence
            break
          }
        }
      }

      // Truncate to reasonable length
      if (bestSentence.length > 150) {
        bestSentence = bestSentence.substring(0, 150).replace(/\s+\S*$/, "") + "..."
      }
      return bestSentence.trim()
    }
  }

  // Fallback: generate summary from title and policy area
  if (policyArea) {
    return `This ${policyArea.toLowerCase()} bill addresses issues related to ${query || "the topic you searched"}.`
  }

  // Last resort: use truncated title
  if (title.length > 100) {
    return title.substring(0, 100).replace(/\s+\S*$/, "") + "..."
  }
  return title
}

/**
 * Format bill ID for display (e.g., "H.R. 1234" or "S. 567")
 */
function formatBillNumber(bill: Bill): string {
  const type = (bill.bill_type || bill.type || "").toUpperCase()
  const number = bill.bill_number || bill.number

  const typeMap: Record<string, string> = {
    "HR": "H.R.",
    "S": "S.",
    "HRES": "H.Res.",
    "SRES": "S.Res.",
    "HJRES": "H.J.Res.",
    "SJRES": "S.J.Res.",
    "HCONRES": "H.Con.Res.",
    "SCONRES": "S.Con.Res.",
  }

  const formattedType = typeMap[type] || type
  return `${formattedType} ${number}`
}

/**
 * Construct internal bill ID for linking
 */
function constructBillId(bill: Bill): string {
  const congress = bill.congress || 119
  const type = (bill.bill_type || bill.type || "hr").toLowerCase()
  const number = bill.bill_number || bill.number
  return `${congress}-${type}-${number}`
}

/**
 * Bills Carousel - Horizontal scrolling cards with relevance summaries
 */
export function BillsCarousel({
  bills,
  query,
  summary,
  className,
  onTrackBill,
}: BillsCarouselProps) {
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
  }, [bills])

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
    }
  }

  if (!bills || bills.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No bills found</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4 animate-message-in", className)}>
      {/* Header */}
      <div className="rounded-lg border border-[var(--chat-border)] bg-[var(--chat-surface)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground text-base">Legislative Search</h3>
          </div>
          <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
            {bills.length} bills
          </span>
        </div>
        {summary && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {summary}
          </p>
        )}
      </div>

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
          {bills.map((bill, idx) => (
            <BillCarouselCard
              key={bill.id || bill.bill_id || `${bill.congress}-${bill.bill_type}-${bill.bill_number}` || idx}
              bill={bill}
              query={query}
              onTrack={onTrackBill}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Individual bill card in the carousel
 */
function BillCarouselCard({
  bill,
  query,
  onTrack,
}: {
  bill: Bill
  query?: string
  onTrack?: (billId: string) => void
}) {
  const [isTracking, setIsTracking] = useState(false)

  const billNumber = formatBillNumber(bill)
  const billId = constructBillId(bill)
  const policyArea = bill.policy_area || bill.policyArea
  const sponsorParty = bill.sponsor_party || ""
  const partyColor = partyColors[sponsorParty] || "bg-gray-500"
  const relevanceSummary = generateRelevanceSummary(bill, query)
  const similarityScore = bill.similarity_score || bill.relevanceScore || 0

  const handleTrack = () => {
    setIsTracking(!isTracking)
    if (onTrack && !isTracking) {
      onTrack(billId)
    }
  }

  return (
    <div className="flex-shrink-0 w-[300px] rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)] overflow-hidden transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 group flex flex-col">
      {/* Header with bill number and policy area */}
      <div className="p-4 pb-3 border-b border-[var(--chat-border-subtle)] bg-gradient-to-br from-violet-500/5 to-purple-500/5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <span className="font-mono text-sm font-semibold text-primary">
              {billNumber}
            </span>
          </div>
          {similarityScore > 0 && (
            <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/30">
              {Math.round(similarityScore)}% match
            </Badge>
          )}
        </div>
        {policyArea && (
          <Badge variant="secondary" className="text-[10px]">
            {policyArea}
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col space-y-3">
        {/* Title */}
        <h4 className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {bill.title}
        </h4>

        {/* AI Relevance Summary */}
        <div className="flex-1">
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 italic">
            &ldquo;{relevanceSummary}&rdquo;
          </p>
        </div>

        {/* Sponsor */}
        {bill.sponsor_name && (
          <div className="flex items-center gap-2 text-xs">
            <div className="relative">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                {bill.sponsor_name.split(" ").map(n => n[0]).slice(0, 2).join("")}
              </div>
              <div
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--chat-surface)]",
                  partyColor
                )}
              />
            </div>
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{bill.sponsor_name}</span>
              {sponsorParty && bill.sponsor_state && (
                <span className="ml-1">({sponsorParty}-{bill.sponsor_state})</span>
              )}
            </span>
          </div>
        )}

        {/* Meta info */}
        {bill.latest_action_date && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{bill.latest_action_date}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 flex items-center gap-2 border-t border-[var(--chat-border-subtle)] bg-[var(--chat-surface-elevated)]">
        <Button
          variant="default"
          size="sm"
          asChild
          className="flex-1 h-8 text-xs"
        >
          <Link href={`/bills/${billId}`}>
            View Details
          </Link>
        </Button>
        <Button
          variant={isTracking ? "secondary" : "outline"}
          size="sm"
          onClick={handleTrack}
          className={cn(
            "h-8 px-2",
            isTracking && "bg-primary/10 text-primary hover:bg-primary/20"
          )}
        >
          {isTracking ? (
            <BookmarkCheck className="h-4 w-4" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

export { type Bill as BillCarouselItem }
