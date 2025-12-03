'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getStateLegislatorById, getStateLegislatorVotingRecord } from '@/lib/api/backend'
import { VotingRecordTab } from '@/components/representatives'
import {
  Loader2, MapPin, Globe, ExternalLink,
  BarChart3, CheckCircle2, XCircle, Building2
} from 'lucide-react'
import Link from 'next/link'

export default function StateLegislatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [legislatorId, setLegislatorId] = useState<string>('')
  const [member, setMember] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [votingStats, setVotingStats] = useState<any>(null)
  const [votingStatsLoaded, setVotingStatsLoaded] = useState(false)

  useEffect(() => {
    params.then(p => setLegislatorId(p.id))
  }, [params])

  useEffect(() => {
    if (!legislatorId) return

    async function fetchMember() {
      try {
        setLoading(true)
        setError(null)
        const response = await getStateLegislatorById(legislatorId)

        if (response.success && response.data) {
          setMember(response.data)
        } else {
          setError(response.error?.message || 'Failed to load state legislator')
        }
      } catch (err) {
        console.error('Failed to fetch state legislator:', err)
        setError('Failed to load state legislator')
      } finally {
        setLoading(false)
      }
    }

    fetchMember()
  }, [legislatorId])

  // Fetch voting stats when member loads
  const fetchVotingStats = async () => {
    if (!legislatorId || votingStatsLoaded) return

    try {
      const response = await getStateLegislatorVotingRecord(legislatorId, { limit: 20 })
      if (response.success && response.data?.stats) {
        setVotingStats(response.data.stats)
      }
    } catch (err) {
      console.error('Failed to fetch voting stats:', err)
    } finally {
      setVotingStatsLoaded(true)
    }
  }

  useEffect(() => {
    if (member && !votingStatsLoaded) {
      fetchVotingStats()
    }
  }, [member, votingStatsLoaded])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading state legislator...</p>
        </div>
      </div>
    )
  }

  if (error || !member) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold">State Legislator Not Found</h1>
          <p className="text-muted-foreground mt-2">{error || 'The state legislator you are looking for does not exist.'}</p>
          <Button asChild className="mt-4">
            <Link href="/representatives">Back to Representatives</Link>
          </Button>
        </Card>
      </div>
    )
  }

  const partyColor = member.party === 'Democratic' || member.party === 'Democrat' ? 'blue' :
                     member.party === 'Republican' ? 'red' : 'gray'

  const chamberName = member.chamber === 'upper' ? 'State Senate' :
                      member.chamber === 'lower' ? 'State House' :
                      member.chamber

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 space-y-6">
      {/* Hero Section */}
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-r from-emerald-500/10 to-teal-500/10 p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Avatar */}
            <Avatar className="w-32 h-32 md:w-48 md:h-48 border-4 border-background shadow-xl shrink-0 rounded-xl">
              <AvatarImage src={member.imageUrl || "/placeholder.svg"} alt={member.fullName} className="rounded-xl object-cover" />
              <AvatarFallback className="text-2xl md:text-4xl rounded-xl">{member.firstName?.[0]}{member.lastName?.[0]}</AvatarFallback>
            </Avatar>

            {/* Info */}
            <div className="flex-1 space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                    <Building2 className="h-3 w-3 mr-1" />
                    State Legislator
                  </Badge>
                </div>
                <h1 className="text-2xl md:text-4xl font-bold">{member.fullName}</h1>
                <p className="text-lg md:text-xl text-muted-foreground mt-1">
                  {chamberName}
                  {member.state && `, ${member.state}`}
                  {member.district && ` - District ${member.district}`}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant={partyColor === 'blue' ? 'default' : 'secondary'} className="px-3 py-1">
                  {member.party}
                </Badge>
                {member.currentMember && (
                  <Badge variant="outline" className="px-3 py-1">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Currently Serving
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Chamber
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{chamberName}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              District
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold">{member.district || '—'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Votes Cast
            </CardTitle>
          </CardHeader>
          <CardContent>
            {votingStats ? (
              <>
                <div className="text-2xl md:text-3xl font-bold">{votingStats.totalVotes || '—'}</div>
                {votingStats.yeaVotes !== undefined && (
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="text-green-600 dark:text-green-400">{votingStats.yeaVotes} Yea</span>
                    <span>/</span>
                    <span className="text-red-600 dark:text-red-400">{votingStats.nayVotes} Nay</span>
                  </div>
                )}
              </>
            ) : votingStatsLoaded ? (
              <>
                <div className="text-2xl md:text-3xl font-bold text-muted-foreground">—</div>
                <p className="text-xs text-muted-foreground mt-1">No data available</p>
              </>
            ) : (
              <>
                <div className="text-2xl md:text-3xl font-bold text-muted-foreground">...</div>
                <p className="text-xs text-muted-foreground mt-1">Loading</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Absent
            </CardTitle>
          </CardHeader>
          <CardContent>
            {votingStats ? (
              <>
                <div className="text-2xl md:text-3xl font-bold">{votingStats.absentVotes || votingStats.notVotingCount || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {votingStats.totalVotes > 0
                    ? `${Math.round(((votingStats.totalVotes - (votingStats.absentVotes || votingStats.notVotingCount || 0)) / votingStats.totalVotes) * 100)}% attendance`
                    : 'No attendance data'}
                </p>
              </>
            ) : votingStatsLoaded ? (
              <>
                <div className="text-2xl md:text-3xl font-bold text-muted-foreground">—</div>
                <p className="text-xs text-muted-foreground mt-1">No data available</p>
              </>
            ) : (
              <>
                <div className="text-2xl md:text-3xl font-bold text-muted-foreground">...</div>
                <p className="text-xs text-muted-foreground mt-1">Loading</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* External Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            External Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <a
                href={`https://openstates.org/person/${encodeURIComponent(member.id.replace('ocd-person/', ''))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3 mr-2" />
                Open States
              </a>
            </Button>
            {member.state && (
              <Button asChild size="sm" variant="outline">
                <a
                  href={`https://ballotpedia.org/${encodeURIComponent(member.fullName.replace(/ /g, '_'))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3 mr-2" />
                  Ballotpedia
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Detailed Information */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="voting">
            <BarChart3 className="h-4 w-4 mr-1 hidden sm:inline" />
            <span className="hidden sm:inline">Voting Record</span>
            <span className="sm:hidden">Votes</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>About {member.fullName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <span className="text-sm font-semibold text-muted-foreground">Full Name</span>
                  <p>{member.fullName}</p>
                </div>
                <div>
                  <span className="text-sm font-semibold text-muted-foreground">Party</span>
                  <p>{member.party}</p>
                </div>
                <div>
                  <span className="text-sm font-semibold text-muted-foreground">State</span>
                  <p>{member.state}</p>
                </div>
                <div>
                  <span className="text-sm font-semibold text-muted-foreground">Chamber</span>
                  <p>{chamberName}</p>
                </div>
                {member.district && (
                  <div>
                    <span className="text-sm font-semibold text-muted-foreground">District</span>
                    <p>{member.district}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>State Legislation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                This legislator serves in the {member.state} {chamberName}.
                View their voting record to see how they've voted on state bills.
              </p>
              <div className="mt-4">
                <Button asChild variant="outline">
                  <Link href={`/state-bills?state=${encodeURIComponent(member.state)}`}>
                    Browse {member.state} State Bills
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Voting Record Tab */}
        <TabsContent value="voting" className="space-y-4">
          <VotingRecordTab
            memberId={legislatorId}
            memberChamber={member.chamber}
            isStateLegislator={true}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
