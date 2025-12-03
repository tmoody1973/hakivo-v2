"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, XCircle, Users, TrendingUp } from 'lucide-react'
import type { VotingStats } from '@/lib/api/backend'

interface VotingStatsCardsProps {
  stats: VotingStats | null
  loading?: boolean
}

export function VotingStatsCards({ stats, loading = false }: VotingStatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-3">
              <div className="h-4 bg-muted rounded w-24" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const attendancePercentage = stats.attendancePercentage ??
    (stats.totalVotes > 0
      ? Math.round(((stats.totalVotes - stats.notVotingCount) / stats.totalVotes) * 100)
      : 0)

  const partyAlignment = stats.partyAlignmentPercentage ?? null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Votes Cast */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Votes Cast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl md:text-3xl font-bold">{stats.totalVotes}</div>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span className="text-green-600 dark:text-green-400">
              {stats.yeaVotes} Yea
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-red-600 dark:text-red-400">
              {stats.nayVotes} Nay
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Attendance / Missed Votes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl md:text-3xl font-bold">{attendancePercentage}%</div>
          <div className="flex items-center gap-2 mt-2">
            <Progress value={attendancePercentage} className="h-1.5 flex-1" />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.notVotingCount} missed vote{stats.notVotingCount !== 1 ? 's' : ''}
          </div>
        </CardContent>
      </Card>

      {/* Party Alignment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            Party Alignment
          </CardTitle>
        </CardHeader>
        <CardContent>
          {partyAlignment !== null ? (
            <>
              <div className="text-2xl md:text-3xl font-bold">{partyAlignment}%</div>
              <div className="flex items-center gap-2 mt-2">
                <Progress value={partyAlignment} className="h-1.5 flex-1" />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Votes with party majority
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl md:text-3xl font-bold text-muted-foreground">—</div>
              <div className="text-xs text-muted-foreground mt-1">
                Not available
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Vote Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Vote Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.totalVotes > 0 ? (
            <>
              <div className="flex items-end gap-1">
                <span className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-400">
                  {Math.round((stats.yeaVotes / (stats.yeaVotes + stats.nayVotes)) * 100) || 0}%
                </span>
                <span className="text-sm text-muted-foreground mb-1">Yea</span>
              </div>
              <div className="mt-2">
                <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                  <div
                    className="bg-green-500 transition-all"
                    style={{ width: `${(stats.yeaVotes / (stats.yeaVotes + stats.nayVotes)) * 100}%` }}
                  />
                  <div
                    className="bg-red-500 transition-all"
                    style={{ width: `${(stats.nayVotes / (stats.yeaVotes + stats.nayVotes)) * 100}%` }}
                  />
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.presentVotes ? `${stats.presentVotes} Present` : null}
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl md:text-3xl font-bold text-muted-foreground">—</div>
              <div className="text-xs text-muted-foreground mt-1">
                No votes recorded
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
