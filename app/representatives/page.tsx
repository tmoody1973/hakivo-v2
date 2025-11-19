"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Phone, Mail, MapPin, Building2, Search, CheckCircle, XCircle, Minus, Loader2, AlertCircle } from 'lucide-react'
import Link from "next/link"
import { getRepresentatives, searchMembers } from "@/lib/api/backend"
import { useAuth } from "@/lib/auth/auth-context"

// All 50 US states
const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
]

const userRepresentatives = [
  {
    id: "1",
    name: "Elizabeth Warren",
    role: "U.S. Senator",
    party: "Democrat",
    state: "MA",
    image: "/woman-senator.jpg",
    initials: "EW",
    bio: "Elizabeth Warren is a U.S. Senator from Massachusetts, serving since 2013. She is a former Harvard Law School professor and advocate for consumer protection.",
    committees: ["Banking, Housing, and Urban Affairs", "Finance", "Health, Education, Labor, and Pensions"],
    phone: "(202) 224-4543",
    email: "senator@warren.senate.gov",
    offices: ["Washington, DC", "Boston, MA", "Springfield, MA"],
    recentVotes: [
      { bill: "S. 1234", title: "Infrastructure Investment Act", vote: "yes", date: "2025-11-10" },
      { bill: "S. 5678", title: "Education Funding Bill", vote: "yes", date: "2025-11-08" },
      { bill: "S. 9012", title: "Tax Reform Amendment", vote: "no", date: "2025-11-05" },
    ],
    yearsInOffice: 12,
    billsSponsored: 134,
  },
  {
    id: "2",
    name: "Ed Markey",
    role: "U.S. Senator",
    party: "Democrat",
    state: "MA",
    image: "/man-senator.jpg",
    initials: "EM",
    bio: "Ed Markey has served as U.S. Senator from Massachusetts since 2013, and previously served in the House of Representatives for 37 years.",
    committees: ["Commerce, Science, and Transportation", "Environment and Public Works", "Foreign Relations"],
    phone: "(202) 224-2742",
    email: "senator@markey.senate.gov",
    offices: ["Washington, DC", "Boston, MA", "Fall River, MA"],
    recentVotes: [
      { bill: "S. 1234", title: "Infrastructure Investment Act", vote: "yes", date: "2025-11-10" },
      { bill: "S. 5678", title: "Education Funding Bill", vote: "yes", date: "2025-11-08" },
      { bill: "S. 9012", title: "Tax Reform Amendment", vote: "no", date: "2025-11-05" },
    ],
    yearsInOffice: 12,
    billsSponsored: 198,
  },
  {
    id: "3",
    name: "Katherine Clark",
    role: "U.S. Representative",
    party: "Democrat",
    state: "MA",
    district: "5th District",
    image: "/woman-representative.jpg",
    initials: "KC",
    bio: "Katherine Clark represents Massachusetts's 5th congressional district and serves as House Democratic Whip.",
    committees: ["Appropriations", "Select Committee on the Modernization of Congress"],
    phone: "(202) 225-2836",
    email: "rep.clark@mail.house.gov",
    offices: ["Washington, DC", "Framingham, MA"],
    recentVotes: [
      { bill: "H.R. 2345", title: "Affordable Housing Act", vote: "yes", date: "2025-11-12" },
      { bill: "H.R. 6789", title: "Healthcare Reform Bill", vote: "yes", date: "2025-11-09" },
      { bill: "H.R. 3456", title: "Defense Authorization", vote: "yes", date: "2025-11-06" },
    ],
    yearsInOffice: 11,
    billsSponsored: 87,
  },
]

export default function RepresentativesPage() {
  const { accessToken, refreshToken, updateAccessToken } = useAuth()

  // User's representatives state
  const [myRepresentatives, setMyRepresentatives] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // All members search/filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [stateFilter, setStateFilter] = useState("all")
  const [partyFilter, setPartyFilter] = useState("all")
  const [allMembers, setAllMembers] = useState<any[]>([])
  const [allMembersLoading, setAllMembersLoading] = useState(false)
  const [allMembersError, setAllMembersError] = useState<string | null>(null)
  const [totalMembers, setTotalMembers] = useState(0)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const LIMIT = 20

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch user's representatives
  useEffect(() => {
    async function fetchRepresentatives() {
      if (!accessToken) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const response = await getRepresentatives(
          accessToken,
          refreshToken || undefined,
          updateAccessToken
        )

        if (response.success && response.data) {
          setMyRepresentatives(response.data)
        } else {
          setError(response.error?.message || 'Failed to load representatives')
        }
      } catch (err) {
        console.error('Failed to fetch representatives:', err)
        setError('Failed to load representatives')
      } finally {
        setLoading(false)
      }
    }

    fetchRepresentatives()
  }, [accessToken, refreshToken, updateAccessToken])

  // Fetch all members when filters change
  useEffect(() => {
    async function fetchAllMembers() {
      try {
        setAllMembersLoading(true)
        setAllMembersError(null)

        const response = await searchMembers({
          query: debouncedSearchQuery || undefined,
          party: partyFilter !== 'all' ? partyFilter : undefined,
          state: stateFilter !== 'all' ? stateFilter : undefined,
          currentOnly: true,
          limit: LIMIT,
          offset: 0,
        })

        if (response.success && response.data) {
          console.log('[RepresentativesPage] Fetched members:', response.data.members?.length, 'members')
          console.log('[RepresentativesPage] First member:', JSON.stringify(response.data.members?.[0], null, 2))
          console.log('[RepresentativesPage] First member keys:', Object.keys(response.data.members?.[0] || {}))
          setAllMembers(response.data.members || [])
          setTotalMembers(response.data.pagination?.total || 0)
          setHasMore(response.data.pagination?.hasMore || false)
          setOffset(LIMIT)
        } else {
          setAllMembersError(response.error?.message || 'Failed to load members')
        }
      } catch (err) {
        console.error('Failed to fetch all members:', err)
        setAllMembersError('Failed to load members')
      } finally {
        setAllMembersLoading(false)
      }
    }

    fetchAllMembers()
  }, [debouncedSearchQuery, partyFilter, stateFilter])

  // Load more members
  const loadMore = async () => {
    if (!hasMore || allMembersLoading) return

    try {
      setAllMembersLoading(true)

      const response = await searchMembers({
        query: debouncedSearchQuery || undefined,
        party: partyFilter !== 'all' ? partyFilter : undefined,
        state: stateFilter !== 'all' ? stateFilter : undefined,
        currentOnly: true,
        limit: LIMIT,
        offset: offset,
      })

      if (response.success && response.data) {
        setAllMembers(prev => [...prev, ...(response.data.members || [])])
        setHasMore(response.data.pagination?.hasMore || false)
        setOffset(prev => prev + LIMIT)
      }
    } catch (err) {
      console.error('Failed to load more members:', err)
    } finally {
      setAllMembersLoading(false)
    }
  }

  const getVoteIcon = (vote: string) => {
    if (vote === "yes") return <CheckCircle className="h-4 w-4 text-green-500" />
    if (vote === "no") return <XCircle className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-muted-foreground" />
  }

  // Determine what state name to show
  const userState = myRepresentatives[0]?.state || "Your"
  const stateNames: Record<string, string> = {
    'WI': 'Wisconsin',
    'MA': 'Massachusetts',
    'NY': 'New York',
    'FL': 'Florida',
    'CA': 'California',
    'TX': 'Texas'
  }
  const stateName = stateNames[userState] || userState

  return (
    <div className="min-h-screen px-6 md:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold">Your Representatives</h1>
          <p className="text-muted-foreground mt-2">
            Connect with your elected officials and track their legislative activity
          </p>
        </div>

        {/* Your Representatives Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">{stateName} Representatives</h2>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Loading your representatives...</span>
            </div>
          )}

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-5 w-5" />
                  <div>
                    {error}
                    {error.includes('ZIP code') && (
                      <Link href="/settings" className="ml-2 underline">
                        Go to settings
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && !error && myRepresentatives.length === 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertCircle className="h-5 w-5" />
                  <div>
                    No representatives found. Please update your ZIP code in{' '}
                    <Link href="/settings" className="underline font-medium">
                      settings
                    </Link>
                    .
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && !error && myRepresentatives.length > 0 && (
            <div className="grid gap-6 md:grid-cols-3">
              {myRepresentatives.map((rep) => (
                <Card key={rep.bioguideId} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="text-center">
                    <Avatar className="h-24 w-24 mx-auto mb-4">
                      <AvatarImage src={rep.imageUrl || "/placeholder.svg"} alt={rep.fullName} />
                      <AvatarFallback>{rep.initials}</AvatarFallback>
                    </Avatar>
                    <CardTitle className="text-lg">{rep.fullName}</CardTitle>
                    <CardDescription>
                      {rep.role}
                      {rep.district && ` • District ${rep.district}`}
                    </CardDescription>
                    <Badge variant={rep.party === "Democrat" ? "default" : "secondary"} className="mx-auto mt-2">
                      {rep.party}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {rep.phoneNumber && (
                        <Button className="w-full" variant="outline" asChild>
                          <a href={`tel:${rep.phoneNumber}`}>
                            <Phone className="h-4 w-4 mr-2" />
                            {rep.phoneNumber}
                          </a>
                        </Button>
                      )}
                      {rep.url && (
                        <Button className="w-full" variant="outline" asChild>
                          <a href={rep.url} target="_blank" rel="noopener noreferrer">
                            <Mail className="h-4 w-4 mr-2" />
                            Contact
                          </a>
                        </Button>
                      )}
                    </div>
                    {rep.officeAddress && (
                      <div className="text-sm text-muted-foreground text-center">
                        <MapPin className="h-4 w-4 inline mr-1" />
                        {rep.officeAddress}
                      </div>
                    )}
                    <Button className="w-full" asChild>
                      <Link href={`/representatives/${rep.bioguideId}`}>
                        View Full Profile
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* All Members Directory */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle>All Members of Congress</CardTitle>
              <CardDescription>Search and filter representatives and senators</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filters */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, state, or district..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {US_STATES.map(state => (
                      <SelectItem key={state.code} value={state.code}>
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={partyFilter} onValueChange={setPartyFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="All Parties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Parties</SelectItem>
                    <SelectItem value="democrat">Democrat</SelectItem>
                    <SelectItem value="republican">Republican</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Members Grid */}
              {allMembersLoading && allMembers.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-3 text-muted-foreground">Loading members...</span>
                </div>
              ) : allMembersError ? (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertCircle className="h-5 w-5" />
                      <span>{allMembersError}</span>
                    </div>
                  </CardContent>
                </Card>
              ) : !allMembersLoading && allMembers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No members found matching your filters</p>
                </div>
              ) : (
                <>
                  {/* Debug info */}
                  {console.log('[RepresentativesPage] Rendering members, count:', allMembers.length)}
                  {console.log('[RepresentativesPage] Filtered members:', allMembers.filter(m => m.bioguideId).length)}

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {allMembers.filter(m => m.bioguideId).map((member, index) => {
                      // Generate initials from first and last name
                      const initials = `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`.toUpperCase()
                      const fullName = member.fullName || `${member.firstName || ''} ${member.middleName || ''} ${member.lastName || ''}`.trim()
                      const role = member.district ? `U.S. Representative` : `U.S. Senator`

                      return (
                        <Link key={`${member.bioguideId}-${index}`} href={`/representatives/${member.bioguideId}`}>
                          <Card className="hover:shadow-md transition-shadow cursor-pointer">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <Avatar className="h-12 w-12">
                                  <AvatarImage src={member.imageUrl || "/placeholder.svg"} alt={fullName} />
                                  <AvatarFallback>{initials}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm truncate">{fullName}</h4>
                                  <p className="text-xs text-muted-foreground">{role}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs">
                                      {member.state}
                                      {member.district && ` - ${member.district}`}
                                    </Badge>
                                    <Badge variant={member.party === "Democrat" ? "default" : "secondary"} className="text-xs">
                                      {member.party?.charAt(0) || '?'}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      )
                    })}
                  </div>

                  {/* Load More Button */}
                  {hasMore && (
                    <div className="mt-6 text-center">
                      <Button
                        onClick={loadMore}
                        disabled={allMembersLoading}
                        variant="outline"
                        className="w-full sm:w-auto"
                      >
                        {allMembersLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Loading more...
                          </>
                        ) : (
                          <>Load More ({allMembers.length} of {totalMembers})</>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Results count */}
                  {!hasMore && allMembers.length > 0 && (
                    <div className="mt-6 text-center text-sm text-muted-foreground">
                      Showing all {allMembers.length} member{allMembers.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
