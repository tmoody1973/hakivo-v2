"use client"

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { VotingStatsCards } from './VotingStatsCards'
import { VoteHistoryList } from './VoteHistoryList'
import { getMemberVotingRecord, getStateLegislatorVotingRecord } from '@/lib/api/backend'
import type { VotingStats, VoteRecord, VotingRecordResponse } from '@/lib/api/backend'
import { AlertCircle, BarChart3, Loader2 } from 'lucide-react'

interface VotingRecordTabProps {
  memberId: string
  memberChamber: string
  isStateLegislator?: boolean
}

export function VotingRecordTab({ memberId, memberChamber, isStateLegislator = false }: VotingRecordTabProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<VotingStats | null>(null)
  const [votes, setVotes] = useState<VoteRecord[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [dataAvailable, setDataAvailable] = useState(true)
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null)

  // Check if Senate member (federal) - hide tab for them
  const isFederalSenate = !isStateLegislator && (memberChamber === 'Senate' || memberChamber === 'senate')

  const fetchVotingRecord = useCallback(async () => {
    if (isFederalSenate) {
      setDataAvailable(false)
      setUnavailableReason('Senate voting records are not available through the Congress.gov API at this time.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      let response: { success: boolean; data?: VotingRecordResponse; error?: { message: string } }

      if (isStateLegislator) {
        response = await getStateLegislatorVotingRecord(memberId, { limit: 50 })
      } else {
        response = await getMemberVotingRecord(memberId, { limit: 50 })
      }

      if (response.success && response.data) {
        const data = response.data

        if (!data.dataAvailability?.hasData) {
          setDataAvailable(false)
          setUnavailableReason(data.dataAvailability?.message || 'No voting records available')
        } else {
          setDataAvailable(true)
          setStats(data.stats)
          setVotes(data.votes)
          setHasMore(data.pagination?.hasMore || false)
        }
      } else {
        setError(response.error?.message || 'Failed to load voting record')
      }
    } catch (err) {
      console.error('Failed to fetch voting record:', err)
      setError('Failed to load voting record')
    } finally {
      setLoading(false)
    }
  }, [memberId, isStateLegislator, isFederalSenate])

  useEffect(() => {
    fetchVotingRecord()
  }, [fetchVotingRecord])

  // Senate unavailable banner
  if (isFederalSenate) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Senate Votes Not Available</AlertTitle>
          <AlertDescription>
            The Congress.gov API does not currently provide Senate voting records.
            House voting records are available for House members.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Voting Record
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">Senate Voting Data Unavailable</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                The Congress.gov API (beta) currently only provides House roll call votes.
                Senate voting records are not available at this time.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <VotingStatsCards stats={null} loading={true} />
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
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Voting Record</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  // Data not available
  if (!dataAvailable) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Voting Data Not Available</AlertTitle>
          <AlertDescription>
            {unavailableReason || 'No voting records are available for this representative.'}
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Voting Record
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">No Voting Records Found</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {unavailableReason || 'No voting records are available for this representative at this time.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success - show stats and vote history
  return (
    <div className="space-y-6">
      <VotingStatsCards stats={stats} />
      <VoteHistoryList
        votes={votes}
        hasMore={hasMore}
        isStateLegislator={isStateLegislator}
      />
    </div>
  )
}
