"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Building2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Users,
} from "lucide-react"
import Link from "next/link"
import { getStateBillById, StateBillDetail } from "@/lib/api/backend"

// US State names mapping
const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia", PR: "Puerto Rico"
}

export default function StateBillDetailPage() {
  const params = useParams()
  const billId = params?.id as string
  const [bill, setBill] = useState<StateBillDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchBill() {
      if (!billId) return

      try {
        console.log('[StateBillDetailPage] Fetching bill:', billId)
        setLoading(true)
        setError(null)

        const response = await getStateBillById(billId)

        if (response.success && response.data?.bill) {
          setBill(response.data.bill)
        } else {
          setError(response.error?.message || "Failed to load state bill details")
        }
      } catch (err) {
        console.error("[StateBillDetailPage] Error fetching bill:", err)
        setError("Failed to load state bill details")
      } finally {
        setLoading(false)
      }
    }

    fetchBill()
  }, [billId])

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading state bill...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error || !bill) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">{error || "State bill not found"}</p>
              <Button asChild className="mt-4">
                <Link href="/dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const stateName = STATE_NAMES[bill.state?.toUpperCase()] || bill.state
  const chamberDisplay = bill.chamber === 'lower' ? 'House' : bill.chamber === 'upper' ? 'Senate' : bill.chamber

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <Button variant="ghost" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>

        {/* Bill Header */}
        <Card>
          <CardHeader>
            <div className="space-y-4">
              {/* Bill Identifier and State Badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="gap-1">
                  <MapPin className="h-3 w-3" />
                  {stateName}
                </Badge>
                <span className="font-mono text-lg font-bold text-primary">
                  {bill.identifier}
                </span>
                {chamberDisplay && (
                  <Badge variant="outline" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {chamberDisplay}
                  </Badge>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold leading-tight">{bill.title}</h1>

              {/* Meta Info */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                {bill.session && (
                  <span>Session: {bill.session}</span>
                )}
                {bill.latestAction?.date && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      <span>
                        Last action: {new Date(bill.latestAction.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                {bill.openstatesUrl && (
                  <Button variant="outline" asChild>
                    <a href={bill.openstatesUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View on OpenStates
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Abstract / Summary */}
        {bill.abstract && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{bill.abstract}</p>
            </CardContent>
          </Card>
        )}

        {/* Subjects */}
        {bill.subjects && bill.subjects.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Subjects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {bill.subjects.map((subject, index) => (
                  <Badge key={index} variant="secondary">
                    {subject}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sponsors */}
        {bill.sponsors && bill.sponsors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Sponsors ({bill.sponsors.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bill.sponsors.map((sponsor, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{sponsor.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {sponsor.classification}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Latest Action */}
        {bill.latestAction?.description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Latest Action</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                {bill.latestAction.description}
              </p>
              {bill.latestAction.date && (
                <p className="text-sm text-muted-foreground mt-2">
                  {new Date(bill.latestAction.date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Text Versions */}
        {bill.textVersions && bill.textVersions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Bill Text Versions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bill.textVersions.map((version, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">
                        {version.note || `Version ${index + 1}`}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {version.date && (
                          <span>{new Date(version.date).toLocaleDateString()}</span>
                        )}
                        {version.mediaType && (
                          <>
                            <span>•</span>
                            <Badge variant="outline" className="text-xs">
                              {version.mediaType.includes('pdf') ? 'PDF' :
                               version.mediaType.includes('html') ? 'HTML' :
                               version.mediaType.split('/').pop()?.toUpperCase()}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href={version.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No text versions message */}
        {(!bill.textVersions || bill.textVersions.length === 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Bill Text
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Bill text is not available yet.</p>
                {bill.openstatesUrl && (
                  <Button variant="outline" size="sm" className="mt-3" asChild>
                    <a href={bill.openstatesUrl} target="_blank" rel="noopener noreferrer">
                      Check OpenStates for updates
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
