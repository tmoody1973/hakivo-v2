"use client"
import { useEffect, useState } from "react"
import { Phone, Mail, Building2, Landmark } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth/auth-context"
import { getRepresentatives, RepresentativesResponse } from "@/lib/api/backend"

export function RepresentativesHorizontalWidget() {
  const { accessToken, refreshToken, updateAccessToken } = useAuth()
  const [data, setData] = useState<RepresentativesResponse>({
    representatives: [],
    stateLegislators: [],
    userLocation: { state: '', district: undefined }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRepresentatives() {
      if (!accessToken) {
        setLoading(false)
        return
      }

      try {
        const response = await getRepresentatives(
          accessToken,
          refreshToken || undefined,
          updateAccessToken
        )
        if (response.success && response.data) {
          setData(response.data)
        } else {
          setError(response.error?.message || 'Failed to load representatives')
        }
      } catch (err) {
        setError('Failed to load representatives')
        console.error('Error fetching representatives:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchRepresentatives()
  }, [accessToken, refreshToken, updateAccessToken])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Representatives</CardTitle>
          <CardDescription>Loading your elected officials...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { representatives, stateLegislators, userLocation } = data
  const hasRepresentatives = representatives.length > 0 || stateLegislators.length > 0

  if (error || !hasRepresentatives) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Representatives</CardTitle>
          <CardDescription>
            {error || 'No representatives found. Please complete your onboarding.'}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Helper to get party color
  const getPartyColor = (party: string) => {
    const p = party.toLowerCase()
    if (p.includes('democrat')) return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    if (p.includes('republican')) return 'bg-red-500/10 text-red-500 border-red-500/20'
    return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
  }

  // Helper to get party initial
  const getPartyInitial = (party: string) => {
    const p = party.toLowerCase()
    if (p.includes('democrat')) return 'D'
    if (p.includes('republican')) return 'R'
    if (p.includes('independent')) return 'I'
    return party.charAt(0).toUpperCase()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Representatives</CardTitle>
        <CardDescription>
          {userLocation.state && `${userLocation.state} elected officials`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Federal Representatives Section */}
        {representatives.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Federal</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {representatives.map((rep) => (
                <Link
                  key={rep.bioguideId}
                  href={`/representatives/${rep.bioguideId}`}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={rep.imageUrl || "/placeholder.svg"} alt={rep.fullName} />
                    <AvatarFallback>{rep.initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-sm">{rep.fullName}</h4>
                        <p className="text-xs text-muted-foreground">{rep.role}</p>
                      </div>
                      <Badge variant="outline" className={`text-xs whitespace-nowrap ${getPartyColor(rep.party)}`}>
                        {getPartyInitial(rep.party)}
                      </Badge>
                    </div>
                    <div className="flex gap-2 mt-2" onClick={(e) => e.preventDefault()}>
                      {rep.phoneNumber && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs bg-transparent"
                          onClick={(e) => {
                            e.preventDefault()
                            window.open(`tel:${rep.phoneNumber}`, '_self')
                          }}
                        >
                          <Phone className="h-3 w-3 mr-1" />
                          Call
                        </Button>
                      )}
                      {rep.url && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs bg-transparent"
                          onClick={(e) => {
                            e.preventDefault()
                            window.open(rep.url, '_blank')
                          }}
                        >
                          <Mail className="h-3 w-3 mr-1" />
                          Contact
                        </Button>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* State Legislators Section */}
        {stateLegislators.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">State Legislature</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {stateLegislators.map((leg) => (
                <div
                  key={leg.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                >
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={leg.imageUrl || "/placeholder.svg"} alt={leg.fullName} />
                    <AvatarFallback>{leg.initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-sm">{leg.fullName}</h4>
                        <p className="text-xs text-muted-foreground">
                          {leg.role}
                          {leg.district && ` - District ${leg.district}`}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-xs whitespace-nowrap ${getPartyColor(leg.party)}`}>
                        {getPartyInitial(leg.party)}
                      </Badge>
                    </div>
                    {leg.email && (
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs bg-transparent"
                          onClick={() => window.open(`mailto:${leg.email}`, '_self')}
                        >
                          <Mail className="h-3 w-3 mr-1" />
                          Email
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
