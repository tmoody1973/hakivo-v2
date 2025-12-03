"use client"

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { getMemberVotingRecord } from '@/lib/api/backend'
import type { VotingStats, VoteRecord } from '@/lib/api/backend'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, LineChart, Line, Legend,
  RadialBarChart, RadialBar
} from 'recharts'
import {
  AlertCircle, BarChart3, Loader2, TrendingUp, Users,
  CheckCircle2, XCircle, Target, Calendar, Award,
  ThumbsUp, ThumbsDown, Minus
} from 'lucide-react'

interface VotingAnalyticsTabProps {
  memberId: string
  memberChamber: string
  memberParty?: string
}

interface MonthlyVoteData {
  month: string
  yea: number
  nay: number
  present: number
  notVoting: number
}

interface KeyVote {
  id: string
  date: string
  question: string
  result: string
  memberVote: string
  bill?: {
    type?: string
    number?: string
    title?: string
  }
}

const VOTE_COLORS = {
  yea: '#22c55e',
  nay: '#ef4444',
  present: '#eab308',
  notVoting: '#94a3b8'
}

export function VotingAnalyticsTab({ memberId, memberChamber, memberParty }: VotingAnalyticsTabProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<VotingStats | null>(null)
  const [votes, setVotes] = useState<VoteRecord[]>([])
  const [dataAvailable, setDataAvailable] = useState(true)

  const isFederalSenate = memberChamber === 'Senate' || memberChamber === 'senate'

  const fetchVotingData = useCallback(async () => {
    if (isFederalSenate) {
      setDataAvailable(false)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Fetch votes for analytics - reduced from 100 to 25 for faster initial load
      // Backend now uses parallel batch processing for better performance
      const response = await getMemberVotingRecord(memberId, { limit: 25 })

      if (response.success && response.data) {
        const data = response.data

        if (!data.dataAvailability?.hasData) {
          setDataAvailable(false)
        } else {
          setDataAvailable(true)
          setStats(data.stats)
          setVotes(data.votes)
        }
      } else {
        setError(response.error?.message || 'Failed to load voting analytics')
      }
    } catch (err) {
      console.error('Failed to fetch voting analytics:', err)
      setError('Failed to load voting analytics')
    } finally {
      setLoading(false)
    }
  }, [memberId, isFederalSenate])

  useEffect(() => {
    fetchVotingData()
  }, [fetchVotingData])

  // Process votes into monthly data for trend chart
  const monthlyData = useMemo((): MonthlyVoteData[] => {
    if (!votes.length) return []

    const monthMap = new Map<string, MonthlyVoteData>()

    votes.forEach(vote => {
      if (!vote.voteDate) return

      const date = new Date(vote.voteDate)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthLabel,
          yea: 0,
          nay: 0,
          present: 0,
          notVoting: 0
        })
      }

      const data = monthMap.get(monthKey)!
      const memberVote = vote.memberVote?.toLowerCase()

      if (memberVote === 'yea' || memberVote === 'aye' || memberVote === 'yes') {
        data.yea++
      } else if (memberVote === 'nay' || memberVote === 'no') {
        data.nay++
      } else if (memberVote === 'present') {
        data.present++
      } else {
        data.notVoting++
      }
    })

    // Sort by date and take last 6 months
    return Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([_, data]) => data)
  }, [votes])

  // Pie chart data for vote distribution
  const pieData = useMemo(() => {
    if (!stats) return []

    const total = stats.yeaVotes + stats.nayVotes + (stats.presentVotes || 0) + stats.notVotingCount

    return [
      { name: 'Yea', value: stats.yeaVotes, color: VOTE_COLORS.yea, percentage: total > 0 ? Math.round((stats.yeaVotes / total) * 100) : 0 },
      { name: 'Nay', value: stats.nayVotes, color: VOTE_COLORS.nay, percentage: total > 0 ? Math.round((stats.nayVotes / total) * 100) : 0 },
      { name: 'Present', value: stats.presentVotes || 0, color: VOTE_COLORS.present, percentage: total > 0 ? Math.round(((stats.presentVotes || 0) / total) * 100) : 0 },
      { name: 'Not Voting', value: stats.notVotingCount, color: VOTE_COLORS.notVoting, percentage: total > 0 ? Math.round((stats.notVotingCount / total) * 100) : 0 }
    ].filter(d => d.value > 0)
  }, [stats])

  // Identify key/notable votes
  const keyVotes = useMemo((): KeyVote[] => {
    if (!votes.length) return []

    // Get votes that have bill information (more significant)
    return votes
      .filter(v => v.bill?.title || v.bill?.number)
      .slice(0, 5)
      .map(v => ({
        id: v.id || v.voteId || String(v.rollCallNumber),
        date: v.voteDate,
        question: v.voteQuestion || v.motion || 'Vote',
        result: v.voteResult,
        memberVote: v.memberVote,
        bill: v.bill
      }))
  }, [votes])

  // Calculate attendance rate
  const attendanceRate = useMemo(() => {
    if (!stats || stats.totalVotes === 0) return 0
    return Math.round(((stats.totalVotes - stats.notVotingCount) / stats.totalVotes) * 100)
  }, [stats])

  // Calculate voting decisiveness (Yea or Nay vs Present/Abstain)
  const decisiveness = useMemo(() => {
    if (!stats) return 0
    const decisiveVotes = stats.yeaVotes + stats.nayVotes
    const totalCast = stats.totalVotes - stats.notVotingCount
    if (totalCast === 0) return 0
    return Math.round((decisiveVotes / totalCast) * 100)
  }, [stats])

  // Radial chart data for attendance gauge
  const attendanceGaugeData = useMemo(() => [
    { name: 'Attendance', value: attendanceRate, fill: attendanceRate >= 90 ? '#22c55e' : attendanceRate >= 70 ? '#eab308' : '#ef4444' }
  ], [attendanceRate])

  // Custom tooltip for pie chart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-card border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">{data.value} votes ({data.percentage}%)</p>
        </div>
      )
    }
    return null
  }

  // Get vote icon
  const getVoteIcon = (vote: string) => {
    const v = vote?.toLowerCase()
    if (v === 'yea' || v === 'aye' || v === 'yes') return <ThumbsUp className="h-4 w-4 text-green-500" />
    if (v === 'nay' || v === 'no') return <ThumbsDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-muted-foreground" />
  }

  // Senate unavailable
  if (isFederalSenate) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Senate Analytics Not Available</AlertTitle>
          <AlertDescription>
            Voting analytics are only available for House members. The Congress.gov API does not provide Senate voting data.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-muted rounded w-24" />
              </CardHeader>
              <CardContent>
                <div className="h-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Analytics</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  // No data available
  if (!dataAvailable || !stats) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Analytics Not Available</AlertTitle>
          <AlertDescription>
            No voting data is available to generate analytics for this representative.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Votes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Total Votes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalVotes}</div>
            <p className="text-xs text-muted-foreground mt-1">
              119th Congress
            </p>
          </CardContent>
        </Card>

        {/* Attendance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              <span className={attendanceRate >= 90 ? 'text-green-500' : attendanceRate >= 70 ? 'text-yellow-500' : 'text-red-500'}>
                {attendanceRate}%
              </span>
            </div>
            <Progress value={attendanceRate} className="h-1.5 mt-2" />
          </CardContent>
        </Card>

        {/* Decisiveness */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4" />
              Decisiveness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{decisiveness}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Clear Yea/Nay votes
            </p>
          </CardContent>
        </Card>

        {/* Party Alignment */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Party Alignment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.partyAlignmentPercentage !== null && stats.partyAlignmentPercentage !== undefined ? (
              <>
                <div className="text-3xl font-bold">{stats.partyAlignmentPercentage}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Votes with {memberParty || 'party'}
                </p>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-muted-foreground">—</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Not calculated
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vote Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Vote Distribution
            </CardTitle>
            <CardDescription>
              Breakdown of all votes cast
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percentage }) => `${name}: ${percentage}%`}
                    labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {pieData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm">{entry.name}: {entry.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Voting Trends Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Voting Trends
            </CardTitle>
            <CardDescription>
              Monthly voting activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <XAxis
                      dataKey="month"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Legend />
                    <Bar dataKey="yea" stackId="votes" fill={VOTE_COLORS.yea} name="Yea" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="nay" stackId="votes" fill={VOTE_COLORS.nay} name="Nay" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="present" stackId="votes" fill={VOTE_COLORS.present} name="Present" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="notVoting" stackId="votes" fill={VOTE_COLORS.notVoting} name="Not Voting" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                <p>Not enough data for trend analysis</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attendance Gauge & Key Votes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Gauge */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Attendance Rate
            </CardTitle>
            <CardDescription>
              Participation in roll call votes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="90%"
                  barSize={20}
                  data={attendanceGaugeData}
                  startAngle={180}
                  endAngle={0}
                >
                  <RadialBar
                    background={{ fill: 'hsl(var(--muted))' }}
                    dataKey="value"
                    cornerRadius={10}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center -mt-20">
              <div className="text-4xl font-bold">{attendanceRate}%</div>
              <p className="text-sm text-muted-foreground mt-1">
                {stats.notVotingCount} missed of {stats.totalVotes} votes
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Key Votes */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Notable Votes
            </CardTitle>
            <CardDescription>
              Recent legislative votes with bill information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {keyVotes.length > 0 ? (
              <div className="space-y-3">
                {keyVotes.map((vote) => (
                  <div key={vote.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="mt-0.5">
                      {getVoteIcon(vote.memberVote)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {vote.bill?.type && vote.bill?.number && (
                          <Badge variant="outline" className="font-mono text-xs">
                            {vote.bill.type.toUpperCase()} {vote.bill.number}
                          </Badge>
                        )}
                        <Badge
                          variant={vote.result?.toLowerCase().includes('pass') ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {vote.result}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">
                        {vote.bill?.title || vote.question}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(vote.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                        {' · '}
                        Voted: <span className={
                          vote.memberVote?.toLowerCase().includes('yea') || vote.memberVote?.toLowerCase().includes('yes')
                            ? 'text-green-500 font-medium'
                            : vote.memberVote?.toLowerCase().includes('nay') || vote.memberVote?.toLowerCase().includes('no')
                              ? 'text-red-500 font-medium'
                              : 'text-muted-foreground'
                        }>
                          {vote.memberVote}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No notable votes with bill information available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vote Breakdown Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Vote Summary
          </CardTitle>
          <CardDescription>
            Detailed breakdown of voting record
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold text-green-500">{stats.yeaVotes}</div>
              <p className="text-sm text-muted-foreground">Yea Votes</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
              <div className="text-2xl font-bold text-red-500">{stats.nayVotes}</div>
              <p className="text-sm text-muted-foreground">Nay Votes</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <Minus className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <div className="text-2xl font-bold text-yellow-500">{stats.presentVotes || 0}</div>
              <p className="text-sm text-muted-foreground">Present</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted border">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <div className="text-2xl font-bold">{stats.notVotingCount}</div>
              <p className="text-sm text-muted-foreground">Not Voting</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
