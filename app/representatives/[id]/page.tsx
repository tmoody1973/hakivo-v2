'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getMemberById, getMemberCosponsoredLegislation, getMemberVotingRecord } from '@/lib/api/backend'
import type { VotingStats } from '@/lib/api/backend'
import { VotingRecordTab, VotingAnalyticsTab } from '@/components/representatives'
import {
  Loader2, Phone, MapPin, Globe, ExternalLink, Twitter, Facebook, Youtube, Instagram,
  FileText, TrendingUp, Calendar, Users, CheckCircle2, XCircle, MinusCircle, BarChart3
} from 'lucide-react'
import Link from 'next/link'

export default function RepresentativeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [bioguideId, setBioguideId] = useState<string>('')
  const [member, setMember] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cosponsoredBills, setCosponsoredBills] = useState<any[]>([])
  const [cosponsoredLoading, setCosponsoredLoading] = useState(false)
  const [cosponsoredTotal, setCosponsoredTotal] = useState(0)
  const [votingStats, setVotingStats] = useState<VotingStats | null>(null)
  const [votingStatsLoaded, setVotingStatsLoaded] = useState(false)

  useEffect(() => {
    params.then(p => setBioguideId(p.id))
  }, [params])

  useEffect(() => {
    if (!bioguideId) return

    async function fetchMember() {
      try {
        setLoading(true)
        setError(null)
        const response = await getMemberById(bioguideId)

        if (response.success && response.data) {
          setMember(response.data)
        } else {
          setError(response.error?.message || 'Failed to load representative')
        }
      } catch (err) {
        console.error('Failed to fetch representative:', err)
        setError('Failed to load representative')
      } finally {
        setLoading(false)
      }
    }

    fetchMember()
  }, [bioguideId])

  // Fetch co-sponsored bills
  const fetchCosponsoredBills = async () => {
    if (!bioguideId || cosponsoredBills.length > 0) return // Already loaded

    try {
      setCosponsoredLoading(true)
      const response = await getMemberCosponsoredLegislation(bioguideId, 20, 0)

      if (response.success && response.data) {
        setCosponsoredBills(response.data.cosponsoredBills || [])
        setCosponsoredTotal(response.data.pagination?.total || 0)
      }
    } catch (err) {
      console.error('Failed to fetch co-sponsored bills:', err)
    } finally {
      setCosponsoredLoading(false)
    }
  }

  // Fetch voting stats for the stats grid (House only)
  const fetchVotingStats = async () => {
    if (!bioguideId || votingStatsLoaded) return
    if (member?.chamber === 'Senate') return // Senate votes not available

    try {
      const response = await getMemberVotingRecord(bioguideId, { limit: 10 })
      if (response.success && response.data?.stats) {
        setVotingStats(response.data.stats)
      }
    } catch (err) {
      console.error('Failed to fetch voting stats:', err)
    } finally {
      setVotingStatsLoaded(true)
    }
  }

  // Fetch voting stats when member loads and is House
  useEffect(() => {
    if (member && member.chamber === 'House' && !votingStatsLoaded) {
      fetchVotingStats()
    }
  }, [member, votingStatsLoaded])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading representative...</p>
        </div>
      </div>
    )
  }

  if (error || !member) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold">Representative Not Found</h1>
          <p className="text-muted-foreground mt-2">{error || 'The representative you are looking for does not exist.'}</p>
          <Button asChild className="mt-4">
            <Link href="/representatives">Back to Representatives</Link>
          </Button>
        </Card>
      </div>
    )
  }

  const partyColor = member.party === 'Democratic' || member.party === 'Democrat' ? 'blue' :
                     member.party === 'Republican' ? 'red' : 'gray'

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 space-y-6">
      {/* Hero Section */}
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Avatar */}
            <Avatar className="w-32 h-32 md:w-48 md:h-48 border-4 border-background shadow-xl shrink-0 rounded-xl">
              <AvatarImage src={member.imageUrl || "/placeholder.svg"} alt={member.fullName} className="rounded-xl object-cover" />
              <AvatarFallback className="text-2xl md:text-4xl rounded-xl">{member.firstName?.[0]}{member.lastName?.[0]}</AvatarFallback>
            </Avatar>

            {/* Info */}
            <div className="flex-1 space-y-3">
              <div>
                <h1 className="text-2xl md:text-4xl font-bold">{member.fullName}</h1>
                <p className="text-lg md:text-xl text-muted-foreground mt-1">
                  U.S. {member.chamber === 'House' ? 'Representative' : 'Senator'}
                  {member.state && ` from ${member.state}`}
                  {member.district !== null && member.district !== undefined && ` - District ${member.district}`}
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

              {/* Contact Actions - Desktop */}
              <div className="hidden md:flex flex-wrap gap-2 pt-2">
                {member.url && (
                  <Button asChild size="sm">
                    <a href={member.url} target="_blank" rel="noopener noreferrer">
                      <Globe className="h-4 w-4 mr-2" />
                      Official Website
                    </a>
                  </Button>
                )}
                {member.phoneNumber && (
                  <Button asChild size="sm" variant="outline">
                    <a href={`tel:${member.phoneNumber}`}>
                      <Phone className="h-4 w-4 mr-2" />
                      {member.phoneNumber}
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Contact Actions - Mobile */}
          <div className="flex md:hidden flex-col gap-2 mt-4">
            {member.url && (
              <Button asChild size="sm" className="w-full">
                <a href={member.url} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-4 w-4 mr-2" />
                  Official Website
                </a>
              </Button>
            )}
            {member.phoneNumber && (
              <Button asChild size="sm" variant="outline" className="w-full">
                <a href={`tel:${member.phoneNumber}`}>
                  <Phone className="h-4 w-4 mr-2" />
                  {member.phoneNumber}
                </a>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Sponsored Bills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold">{member.sponsoredBillsCount || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Co-Sponsored
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold">
              {cosponsoredTotal > 0 ? cosponsoredTotal : '—'}
            </div>
            {cosponsoredTotal === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No data yet</p>
            )}
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
            {member.chamber === 'Senate' ? (
              <>
                <div className="text-2xl md:text-3xl font-bold text-muted-foreground">—</div>
                <p className="text-xs text-muted-foreground mt-1">Senate data unavailable</p>
              </>
            ) : votingStats ? (
              <>
                <div className="text-2xl md:text-3xl font-bold">{votingStats.totalVotes}</div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span className="text-green-600 dark:text-green-400">{votingStats.yeaVotes} Yea</span>
                  <span>/</span>
                  <span className="text-red-600 dark:text-red-400">{votingStats.nayVotes} Nay</span>
                </div>
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
              Missed Votes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {member.chamber === 'Senate' ? (
              <>
                <div className="text-2xl md:text-3xl font-bold text-muted-foreground">—</div>
                <p className="text-xs text-muted-foreground mt-1">Senate data unavailable</p>
              </>
            ) : votingStats ? (
              <>
                <div className="text-2xl md:text-3xl font-bold">{votingStats.notVotingCount}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {votingStats.attendancePercentage ? `${votingStats.attendancePercentage}% attendance` :
                   votingStats.totalVotes > 0 ?
                     `${Math.round(((votingStats.totalVotes - votingStats.notVotingCount) / votingStats.totalVotes) * 100)}% attendance` :
                     'No attendance data'}
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

      {/* Contact & Social Media */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Contact & Social Media
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Office Information */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">Office Information</h3>
              {member.officeAddress && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span className="text-sm">{member.officeAddress}</span>
                </div>
              )}
              {member.phoneNumber && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${member.phoneNumber}`} className="text-sm hover:underline">
                    {member.phoneNumber}
                  </a>
                </div>
              )}
            </div>

            {/* Social Media Links */}
            {member.socialMedia && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground">Follow Online</h3>
                <div className="flex flex-wrap gap-2">
                  {member.socialMedia.twitter && (
                    <Button asChild size="sm" variant="outline">
                      <a href={`https://twitter.com/${member.socialMedia.twitter}`} target="_blank" rel="noopener noreferrer">
                        <Twitter className="h-4 w-4 mr-2" />
                        Twitter
                      </a>
                    </Button>
                  )}
                  {member.socialMedia.facebook && (
                    <Button asChild size="sm" variant="outline">
                      <a href={member.socialMedia.facebook} target="_blank" rel="noopener noreferrer">
                        <Facebook className="h-4 w-4 mr-2" />
                        Facebook
                      </a>
                    </Button>
                  )}
                  {member.socialMedia.youtube && (
                    <Button asChild size="sm" variant="outline">
                      <a href={member.socialMedia.youtube} target="_blank" rel="noopener noreferrer">
                        <Youtube className="h-4 w-4 mr-2" />
                        YouTube
                      </a>
                    </Button>
                  )}
                  {member.socialMedia.instagram && (
                    <Button asChild size="sm" variant="outline">
                      <a href={`https://instagram.com/${member.socialMedia.instagram}`} target="_blank" rel="noopener noreferrer">
                        <Instagram className="h-4 w-4 mr-2" />
                        Instagram
                      </a>
                    </Button>
                  )}
                  {member.socialMedia.contactForm && (
                    <Button asChild size="sm" variant="outline">
                      <a href={member.socialMedia.contactForm} target="_blank" rel="noopener noreferrer">
                        <Globe className="h-4 w-4 mr-2" />
                        Contact Form
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Detailed Information */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className={`grid w-full ${member.chamber !== 'Senate' ? 'grid-cols-3 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-3'}`}>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sponsored">
            <span className="hidden sm:inline">Sponsored Bills</span>
            <span className="sm:hidden">Sponsored</span>
            {member.sponsoredBillsCount > 0 && (
              <Badge variant="secondary" className="ml-2 hidden md:inline-flex">{member.sponsoredBillsCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="cosponsored" onClick={fetchCosponsoredBills}>
            <span className="hidden sm:inline">Co-Sponsored</span>
            <span className="sm:hidden">Co-Spons.</span>
            <Badge variant="secondary" className="ml-2 hidden md:inline-flex">
              {cosponsoredTotal > 0 ? cosponsoredTotal : '—'}
            </Badge>
          </TabsTrigger>
          {member.chamber !== 'Senate' && (
            <>
              <TabsTrigger value="voting">
                <span className="hidden sm:inline">Voting Record</span>
                <span className="sm:hidden">Votes</span>
                <Badge variant="secondary" className="ml-2 hidden md:inline-flex">
                  {votingStats?.totalVotes ?? '—'}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="analytics">
                <BarChart3 className="h-4 w-4 mr-1 hidden sm:inline" />
                <span className="hidden sm:inline">Analytics</span>
                <span className="sm:hidden">Stats</span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Biographical Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {member.birthDate && (
                  <div>
                    <span className="text-sm font-semibold text-muted-foreground">Date of Birth</span>
                    <p>{new Date(member.birthDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</p>
                  </div>
                )}
                {member.birthPlace && (
                  <div>
                    <span className="text-sm font-semibold text-muted-foreground">Place of Birth</span>
                    <p>{member.birthPlace}</p>
                  </div>
                )}
                {member.gender && (
                  <div>
                    <span className="text-sm font-semibold text-muted-foreground">Gender</span>
                    <p>{member.gender}</p>
                  </div>
                )}
                {member.currentTerm && (
                  <div>
                    <span className="text-sm font-semibold text-muted-foreground">Current Term</span>
                    <p>{new Date(member.currentTerm.start).getFullYear()} - {new Date(member.currentTerm.end).getFullYear()}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* External Resources */}
          <Card>
            <CardHeader>
              <CardTitle>External Resources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {member.ids?.govtrack && (
                  <Button asChild size="sm" variant="outline">
                    <a href={`https://www.govtrack.us/congress/members/${member.ids.govtrack}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-2" />
                      GovTrack
                    </a>
                  </Button>
                )}
                {member.ids?.opensecrets && (
                  <Button asChild size="sm" variant="outline">
                    <a href={`https://www.opensecrets.org/members-of-congress/summary?cid=${member.ids.opensecrets}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-2" />
                      OpenSecrets
                    </a>
                  </Button>
                )}
                {member.ids?.votesmart && (
                  <Button asChild size="sm" variant="outline">
                    <a href={`https://justfacts.votesmart.org/candidate/${member.ids.votesmart}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-2" />
                      Vote Smart
                    </a>
                  </Button>
                )}
                {member.ids?.ballotpedia && (
                  <Button asChild size="sm" variant="outline">
                    <a href={`https://ballotpedia.org/${member.ids.ballotpedia}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-2" />
                      Ballotpedia
                    </a>
                  </Button>
                )}
                {member.ids?.wikipedia && (
                  <Button asChild size="sm" variant="outline">
                    <a href={`https://en.wikipedia.org/wiki/${member.ids.wikipedia}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-2" />
                      Wikipedia
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sponsored Bills Tab */}
        <TabsContent value="sponsored" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Sponsored Legislation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {member.sponsoredBills && member.sponsoredBills.length > 0 ? (
                <div className="space-y-3">
                  {member.sponsoredBills.map((bill: any, index: number) => (
                    <div key={index} className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {bill.billType?.toUpperCase()}. {bill.billNumber}
                          </Badge>
                          <Badge variant="secondary">
                            {bill.congress}th Congress
                          </Badge>
                        </div>
                        {bill.introducedDate && (
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(bill.introducedDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium mb-2">{bill.title}</h3>
                      {bill.latestActionText && (
                        <div className="text-sm text-muted-foreground">
                          <span className="font-semibold">Latest Action: </span>
                          {bill.latestActionText}
                          {bill.latestActionDate && (
                            <span className="ml-2">
                              ({new Date(bill.latestActionDate).toLocaleDateString()})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No sponsored bills available.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Co-Sponsored Bills Tab */}
        <TabsContent value="cosponsored" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Co-Sponsored Legislation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cosponsoredLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-3 text-muted-foreground">Loading co-sponsored bills...</span>
                </div>
              ) : cosponsoredBills.length > 0 ? (
                <div className="space-y-3">
                  {cosponsoredBills.map((bill: any, index: number) => (
                    <div key={index} className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {bill.billType?.toUpperCase()}. {bill.billNumber}
                          </Badge>
                          <Badge variant="secondary">
                            {bill.congress}th Congress
                          </Badge>
                        </div>
                        <div className="flex flex-col text-sm text-muted-foreground gap-1">
                          {bill.cosponsorDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Co-sponsored: {new Date(bill.cosponsorDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <h3 className="font-medium mb-2">{bill.title}</h3>
                      {bill.sponsor && (
                        <div className="text-sm text-muted-foreground mb-2">
                          <span className="font-semibold">Sponsor: </span>
                          {bill.sponsor.fullName} ({bill.sponsor.party} - {bill.sponsor.state})
                        </div>
                      )}
                      {bill.latestActionText && (
                        <div className="text-sm text-muted-foreground">
                          <span className="font-semibold">Latest Action: </span>
                          {bill.latestActionText}
                          {bill.latestActionDate && (
                            <span className="ml-2">
                              ({new Date(bill.latestActionDate).toLocaleDateString()})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <TrendingUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">No Co-Sponsored Bills Found</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {member.fullName} has not co-sponsored any bills yet, or the data hasn't been ingested.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Voting Record Tab - Only shown for House members */}
        {member.chamber !== 'Senate' && (
          <TabsContent value="voting" className="space-y-4">
            <VotingRecordTab
              memberId={bioguideId}
              memberChamber={member.chamber}
              isStateLegislator={false}
            />
          </TabsContent>
        )}

        {/* Voting Analytics Tab - Only shown for House members */}
        {member.chamber !== 'Senate' && (
          <TabsContent value="analytics" className="space-y-4">
            <VotingAnalyticsTab
              memberId={bioguideId}
              memberChamber={member.chamber}
              memberParty={member.party}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
