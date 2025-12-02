"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  AlertCircle,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  BookmarkPlus,
  Building2,
  Check,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Sparkles,
  Target,
  ThumbsUp,
  Users,
  Zap,
} from "lucide-react"
import Link from "next/link"
import { getStateBillById, StateBillDetail } from "@/lib/api/backend"
import { useAuth } from "@/lib/auth/auth-context"
import { useTracking } from "@/lib/hooks/use-tracking"

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

// Analysis type
interface StateBillAnalysis {
  billId: string
  status: 'pending' | 'processing' | 'complete' | 'failed'
  executiveSummary?: string
  statusQuoVsChange?: string
  sectionBreakdown?: string[]
  mechanismOfAction?: string
  agencyPowers?: string[]
  fiscalImpact?: {
    estimatedCost?: string
    fundingSource?: string
    timeframe?: string
  }
  stakeholderImpact?: Record<string, string>
  unintendedConsequences?: string[]
  argumentsFor?: string[]
  argumentsAgainst?: string[]
  implementationChallenges?: string[]
  passageLikelihood?: number
  passageReasoning?: string
  analyzedAt?: number
}

export default function StateBillDetailPage() {
  const params = useParams()
  const billId = params?.id as string
  const [bill, setBill] = useState<StateBillDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<StateBillAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [trackingAction, setTrackingAction] = useState(false)
  const { accessToken, isLoading: authLoading } = useAuth()

  // Tracking hook
  const {
    isStateBillTracked,
    getTrackingId,
    trackStateBill,
    untrackStateBill,
  } = useTracking({ token: accessToken })

  const isTracked = billId ? isStateBillTracked(billId) : false
  const trackingId = billId ? getTrackingId(billId) : null

  // Handle track/untrack
  const handleTrackToggle = async () => {
    if (!bill || !accessToken) return

    setTrackingAction(true)
    try {
      if (isTracked && trackingId) {
        await untrackStateBill(billId, trackingId)
      } else {
        await trackStateBill(billId, bill.state || '', bill.identifier)
      }
    } catch (err) {
      console.error('Error toggling track status:', err)
    } finally {
      setTrackingAction(false)
    }
  }

  // Fetch bill on load
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

  // Fetch existing analysis on load
  useEffect(() => {
    async function fetchAnalysis() {
      if (!billId || authLoading) return

      try {
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        }
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`
        }

        const response = await fetch(`/api/state-bills/${encodeURIComponent(billId)}/analysis`, {
          headers,
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.analysis) {
            setAnalysis(data.analysis)
          }
        }
      } catch (err) {
        console.log('[StateBillDetailPage] No existing analysis:', err)
      }
    }

    fetchAnalysis()
  }, [billId, authLoading, accessToken])

  // Function to trigger bill analysis
  const handleAnalyzeBill = async () => {
    if (!billId) return

    setAnalyzing(true)
    setAnalyzeError(null)

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      console.log('[StateBillDetailPage] Triggering analysis for state bill:', billId)

      const response = await fetch(`/api/state-bills/${encodeURIComponent(billId)}/analyze`, {
        method: 'POST',
        headers,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to trigger analysis')
      }

      const data = await response.json()
      console.log('[StateBillDetailPage] Analysis triggered successfully:', data)

      // Poll for analysis completion
      let attempts = 0
      const maxAttempts = 24 // Poll for up to 2 minutes (24 * 5 seconds)

      const pollInterval = setInterval(async () => {
        attempts++
        console.log(`[StateBillDetailPage] Polling for analysis completion (attempt ${attempts}/${maxAttempts})`)

        try {
          const analysisResponse = await fetch(`/api/state-bills/${encodeURIComponent(billId)}/analysis`, {
            headers,
          })

          if (analysisResponse.ok) {
            const analysisData = await analysisResponse.json()
            if (analysisData.success && analysisData.analysis) {
              setAnalysis(analysisData.analysis)

              if (analysisData.analysis.status === 'complete') {
                console.log('[StateBillDetailPage] Analysis complete!')
                clearInterval(pollInterval)
                setAnalyzing(false)
              } else if (analysisData.analysis.status === 'failed') {
                console.error('[StateBillDetailPage] Analysis failed')
                clearInterval(pollInterval)
                setAnalyzeError('Analysis failed. Please try again.')
                setAnalyzing(false)
              }
            }
          }

          // Stop polling after max attempts
          if (attempts >= maxAttempts) {
            console.log('[StateBillDetailPage] Max polling attempts reached')
            clearInterval(pollInterval)
            setAnalyzing(false)
          }
        } catch (pollError) {
          console.error('[StateBillDetailPage] Error polling for analysis:', pollError)
        }
      }, 5000) // Poll every 5 seconds

    } catch (err) {
      console.error('[StateBillDetailPage] Error triggering analysis:', err)
      setAnalyzeError(err instanceof Error ? err.message : 'Failed to trigger analysis')
      setAnalyzing(false)
    }
  }

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
              <div className="flex items-center gap-2 pt-2 flex-wrap">
                <Button
                  variant={isTracked ? "secondary" : "default"}
                  onClick={handleTrackToggle}
                  disabled={trackingAction || !accessToken}
                >
                  {trackingAction ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isTracked ? 'Untracking...' : 'Tracking...'}
                    </>
                  ) : isTracked ? (
                    <>
                      <BookmarkCheck className="h-4 w-4 mr-2" />
                      Tracking
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="h-4 w-4 mr-2" />
                      Track This Bill
                    </>
                  )}
                </Button>
                {bill.openstatesUrl && (
                  <Button variant="outline" asChild>
                    <a href={bill.openstatesUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View on OpenStates
                    </a>
                  </Button>
                )}
                <Button
                  variant="default"
                  onClick={handleAnalyzeBill}
                  disabled={analyzing || analysis?.status === 'complete'}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : analysis?.status === 'complete' ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analysis Complete
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Analyze This Bill
                    </>
                  )}
                </Button>
              </div>

              {/* Analysis Error Message */}
              {analyzeError && (
                <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {analyzeError}
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Deep Forensic Analysis */}
        {analysis && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Deep Forensic Analysis
              </CardTitle>
              {analysis.analyzedAt && (
                <p className="text-sm text-muted-foreground mt-2">
                  Comprehensive analysis powered by AI • Last updated {new Date(analysis.analyzedAt).toLocaleDateString()}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Processing Status */}
              {(analysis.status === 'processing' || analysis.status === 'pending') && !analysis.executiveSummary && (
                <div className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  <div>
                    <p className="font-medium text-purple-900 dark:text-purple-100">
                      Deep forensic analysis in progress...
                    </p>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Our AI is performing a comprehensive analysis of this state legislation. This may take 30-60 seconds.
                    </p>
                  </div>
                </div>
              )}

              {/* Executive Summary */}
              {analysis.executiveSummary && analysis.executiveSummary !== 'Analysis in progress...' && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Executive Summary</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {analysis.executiveSummary}
                  </p>
                </div>
              )}

              {analysis.status === 'complete' && (
                <>
                  <Separator />

                  {/* Simplified Analysis Layout */}
                  <div className="space-y-6">
                    {/* Who It Affects */}
                    {analysis.stakeholderImpact && Object.keys(analysis.stakeholderImpact).length > 0 && (
                      <div>
                        <h3 className="font-semibold text-base mb-3">Who It Affects</h3>
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(analysis.stakeholderImpact).map((stakeholder) => (
                            <Badge key={stakeholder} variant="secondary" className="capitalize">
                              {stakeholder.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Key Provisions */}
                    {analysis.sectionBreakdown && analysis.sectionBreakdown.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-base mb-3">Key Provisions</h3>
                        <ul className="space-y-2">
                          {analysis.sectionBreakdown.map((provision, index) => (
                            <li key={index} className="flex gap-2">
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground">{String(provision)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Potential Impact - Two Column Grid */}
                    <div>
                      <h3 className="font-semibold text-base mb-3">Potential Impact</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Potential Benefits */}
                        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                              <ThumbsUp className="h-4 w-4" />
                              Potential Benefits
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-3">
                              {analysis.argumentsFor && analysis.argumentsFor.length > 0 ? (
                                analysis.argumentsFor.map((benefit, index) => (
                                  <li key={index} className="flex gap-2 text-sm">
                                    <Check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                    <span className="text-green-900 dark:text-green-100">{String(benefit)}</span>
                                  </li>
                                ))
                              ) : (
                                <p className="text-sm text-green-700 dark:text-green-300">No benefits listed</p>
                              )}
                            </ul>
                          </CardContent>
                        </Card>

                        {/* Potential Concerns */}
                        <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2 text-red-700 dark:text-red-400">
                              <AlertCircle className="h-4 w-4" />
                              Potential Concerns
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-3">
                              {analysis.argumentsAgainst && analysis.argumentsAgainst.length > 0 ? (
                                analysis.argumentsAgainst.map((concern, index) => (
                                  <li key={index} className="flex gap-2 text-sm">
                                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                    <span className="text-red-900 dark:text-red-100">{String(concern)}</span>
                                  </li>
                                ))
                              ) : (
                                <p className="text-sm text-red-700 dark:text-red-300">No concerns listed</p>
                              )}
                            </ul>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* Passage Likelihood */}
                    {analysis.passageLikelihood !== undefined && (
                      <div>
                        <h3 className="font-semibold text-base mb-3">Passage Likelihood</h3>
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold text-primary">{analysis.passageLikelihood}%</div>
                          {analysis.passageReasoning && (
                            <p className="text-sm text-muted-foreground">{analysis.passageReasoning}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

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
