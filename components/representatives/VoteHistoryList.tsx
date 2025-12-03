"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle2, XCircle, MinusCircle, AlertCircle, ExternalLink, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import type { VoteRecord } from '@/lib/api/backend'

interface VoteHistoryListProps {
  votes: VoteRecord[]
  loading?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  loadingMore?: boolean
  isStateLegislator?: boolean
}

function getVoteIcon(vote: string) {
  const normalizedVote = vote.toLowerCase()
  if (normalizedVote === 'yea' || normalizedVote === 'aye' || normalizedVote === 'yes') {
    return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
  }
  if (normalizedVote === 'nay' || normalizedVote === 'no') {
    return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
  }
  if (normalizedVote === 'present') {
    return <MinusCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
  }
  return <AlertCircle className="h-4 w-4 text-muted-foreground" />
}

function getVoteBadgeVariant(vote: string): "default" | "destructive" | "secondary" | "outline" {
  const normalizedVote = vote.toLowerCase()
  if (normalizedVote === 'yea' || normalizedVote === 'aye' || normalizedVote === 'yes') {
    return "default"
  }
  if (normalizedVote === 'nay' || normalizedVote === 'no') {
    return "destructive"
  }
  return "secondary"
}

function VoteHistoryItem({ vote, isStateLegislator }: { vote: VoteRecord; isStateLegislator?: boolean }) {
  const voteDate = new Date(vote.voteDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  const billLink = isStateLegislator && vote.bill?.id
    ? `/state-bills/${encodeURIComponent(vote.bill.id)}`
    : vote.bill?.type && vote.bill?.number
    ? `/bills/${vote.bill.type.toLowerCase()}${vote.bill.number}`
    : null

  return (
    <div className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        {/* Vote info */}
        <div className="flex-1 space-y-2">
          {/* Bill info */}
          {vote.bill && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {isStateLegislator
                  ? vote.bill.identifier || vote.bill.id
                  : `${vote.bill.type?.toUpperCase()} ${vote.bill.number}`
                }
              </Badge>
              {billLink && (
                <Button asChild variant="ghost" size="sm" className="h-6 px-2">
                  <Link href={billLink}>
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View Bill
                  </Link>
                </Button>
              )}
            </div>
          )}

          {/* Question / Motion */}
          <h4 className="font-medium text-sm">
            {vote.voteQuestion || vote.motion || 'Vote'}
          </h4>

          {/* Bill title */}
          {vote.bill?.title && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {vote.bill.title}
            </p>
          )}

          {/* Vote counts for state bills */}
          {(vote.yesCount !== undefined || vote.noCount !== undefined) && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {vote.yesCount !== undefined && (
                <span className="text-green-600 dark:text-green-400">
                  {vote.yesCount} Yes
                </span>
              )}
              {vote.noCount !== undefined && (
                <span className="text-red-600 dark:text-red-400">
                  {vote.noCount} No
                </span>
              )}
              {vote.absentCount !== undefined && vote.absentCount > 0 && (
                <span className="text-muted-foreground">
                  {vote.absentCount} Absent
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right side: date, result, member vote */}
        <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">{voteDate}</span>

          {/* Result badge */}
          <Badge
            variant={vote.voteResult?.toLowerCase().includes('pass') ? 'default' : 'secondary'}
            className="text-xs"
          >
            {vote.voteResult}
          </Badge>

          {/* Member's vote */}
          <div className="flex items-center gap-2">
            {getVoteIcon(vote.memberVote)}
            <Badge variant={getVoteBadgeVariant(vote.memberVote)}>
              {vote.memberVote}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )
}

export function VoteHistoryList({
  votes,
  loading = false,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  isStateLegislator = false
}: VoteHistoryListProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Recent Votes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading voting history...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (votes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Recent Votes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">No Voting Records Found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              No voting records are available for this representative at this time.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Recent Votes
          <Badge variant="secondary" className="ml-2">{votes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {votes.map((vote, index) => (
            <VoteHistoryItem
              key={vote.id || vote.voteId || vote.rollCallNumber || index}
              vote={vote}
              isStateLegislator={isStateLegislator}
            />
          ))}
        </div>

        {hasMore && onLoadMore && (
          <div className="mt-4 text-center">
            <Button
              variant="outline"
              onClick={onLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load More Votes'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
