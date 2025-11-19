"use client"
import { useEffect, useState } from "react"
import { Phone, Mail } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth/auth-context"
import { getRepresentatives, Representative } from "@/lib/api/backend"

export function RepresentativesHorizontalWidget() {
  const { accessToken } = useAuth()
  const [representatives, setRepresentatives] = useState<Representative[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRepresentatives() {
      if (!accessToken) {
        setLoading(false)
        return
      }

      try {
        const response = await getRepresentatives(accessToken)
        if (response.success) {
          setRepresentatives(response.data || [])
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
  }, [accessToken])

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

  if (error || representatives.length === 0) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Representatives</CardTitle>
        <CardDescription>
          {representatives[0]?.state && `${representatives[0].state} elected officials`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
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
                  <Badge variant="outline" className="text-xs whitespace-nowrap">
                    {rep.party.charAt(0)}
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
      </CardContent>
    </Card>
  )
}
