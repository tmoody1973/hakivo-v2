"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  Sparkles,
  TrendingUp,
  Users,
  Building2,
  DollarSign,
  Target,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Gavel,
  MapPin,
  Clock,
  Bookmark,
  BookmarkPlus,
  BookmarkCheck,
  Loader2,
  Zap,
  Check,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import Link from "next/link"
import { ShareButtons } from "@/components/share-buttons"
import { TextComparison } from "@/components/bills/text-comparison"
import { useAuth } from "@/lib/auth/auth-context"
import { useSubscription } from "@/lib/subscription/subscription-context"
import { getBillById } from "@/lib/api/backend"
import { useTracking } from "@/lib/hooks/use-tracking"
import { UpgradeModal, useUpgradeModal } from "@/components/upgrade-modal"
import { analytics } from "@/lib/analytics"

interface BillData {
  id: string
  congress: number
  type: string
  number: number
  title: string
  text: string | null
  policyArea: string | null
  introducedDate: string | null
  latestAction?: {
    date: string | null
    text: string | null
  }
  latestActionDate?: string | null
  latestActionText?: string | null
  originChamber: string | null
  updateDate: string | null
  sponsor: {
    bioguideId: string
    firstName: string
    lastName: string
    fullName: string
    party: string
    state: string
  } | null
  enrichment: {
    plainLanguageSummary?: string
    keyPoints?: string[]
    readingTimeMinutes?: number
    impactLevel?: string
    bipartisanScore?: number
    currentStage?: string
    progressPercentage?: number
    tags?: string[]
    enrichedAt?: string
    modelUsed?: string
    status: string
    startedAt?: number
    completedAt?: number
  } | null
  analysis: {
    executiveSummary?: string
    statusQuoVsChange?: string
    sectionBreakdown?: Array<{
      section: string
      summary: string
    }>
    mechanismOfAction?: string
    agencyPowers?: string[]
    fiscalImpact?: {
      estimatedCost: string
      fundingSource: string
      timeframe: string
    }
    stakeholderImpact?: {
      [key: string]: string
    }
    unintendedConsequences?: string[]
    argumentsFor?: Array<{ point: string; evidence: string }>
    argumentsAgainst?: Array<{ point: string; evidence: string }>
    implementationChallenges?: string[]
    passageLikelihood?: string
    passageReasoning?: string
    recentDevelopments?: Array<{
      date: string
      event: string
    }>
    stateImpacts?: {
      [state: string]: string
    }
    thinkingSummary?: string
    analyzedAt?: string
    modelUsed?: string
    status?: string
    startedAt?: number
    completedAt?: number
  } | null
}

const impactLevelConfig = {
  low: { label: "Low Impact", color: "bg-slate-500/10 text-slate-700 dark:text-slate-400" },
  medium: { label: "Medium Impact", color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" },
  high: { label: "High Impact", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  critical: { label: "Critical Impact", color: "bg-red-500/10 text-red-700 dark:text-red-400" },
}

// Likelihood config removed from UI - kept for future use
// const likelihoodConfig = {
//   "very-low": { label: "Very Low", color: "text-red-600", percentage: 10 },
//   low: { label: "Low", color: "text-orange-600", percentage: 30 },
//   moderate: { label: "Moderate", color: "text-yellow-600", percentage: 50 },
//   high: { label: "High", color: "text-green-600", percentage: 70 },
//   "very-high": { label: "Very High", color: "text-emerald-600", percentage: 90 },
// }

export function BillDetailClient() {
  const params = useParams()
  const billId = params?.id as string
  const [bill, setBill] = useState<BillData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [showFullText, setShowFullText] = useState(false)
  const [trackingAction, setTrackingAction] = useState(false)
  const { accessToken, isLoading: authLoading } = useAuth()
  const { checkLimit } = useSubscription()
  const { isOpen: isUpgradeModalOpen, trigger: upgradeModalTrigger, showUpgradeModal, setIsOpen: setUpgradeModalOpen } = useUpgradeModal()

  // Tracking hook
  const {
    isFederalBillTracked,
    getTrackingId,
    trackFederalBill,
    untrackFederalBill,
  } = useTracking({ token: accessToken })

  const isTracked = billId ? isFederalBillTracked(billId) : false
  const trackingId = billId ? getTrackingId(billId) : null

  // Handle track/untrack
  const handleTrackToggle = async () => {
    if (!bill || !accessToken) return

    // If user is trying to track (not untrack), check limits first
    if (!isTracked) {
      const limitCheck = await checkLimit('track_bill')
      if (!limitCheck.allowed) {
        // User has hit their tracking limit - show upgrade modal
        showUpgradeModal('tracked_bills_limit')
        return
      }
    }

    setTrackingAction(true)
    try {
      if (isTracked && trackingId) {
        await untrackFederalBill(billId, trackingId)
        analytics.billUntracked(billId)
      } else {
        await trackFederalBill(billId, bill.congress, bill.type, bill.number)
        analytics.billTracked(billId, bill.title)
      }
    } catch (err) {
      console.error('Error toggling track status:', err)
    } finally {
      setTrackingAction(false)
    }
  }

  // Fetch bill data
  useEffect(() => {
    async function fetchBill() {
      try {
        console.log('[BillDetailPage] Starting fetch for bill:', billId)
        console.log('[BillDetailPage] Auth loading:', authLoading)
        console.log('[BillDetailPage] Access token:', accessToken ? 'present' : 'missing')

        setLoading(true)
        setError(null)

        const response = await getBillById(billId, accessToken || undefined)

        console.log('[BillDetailPage] Response:', response)

        if (response.success && response.data) {
          const billData = response.data.bill as BillData
          setBill(billData)
          setLoading(false)

          // Track bill view in analytics
          analytics.billViewed(billId, billData.title, billData.originChamber || undefined)
        } else {
          setError(response.error?.message || "Failed to load bill details")
          setLoading(false)
        }
      } catch (err) {
        console.error("[BillDetailPage] Error fetching bill:", err)
        setError("Failed to load bill details")
        setLoading(false)
      }
    }

    // Wait for auth to finish loading before attempting to fetch
    if (billId && !authLoading) {
      fetchBill()
    }
  }, [billId, accessToken, authLoading])

  // Poll for updates when enrichment or analysis is processing
  useEffect(() => {
    // Only poll if we have a bill, auth token, and auth is not loading
    if (!bill || !accessToken || authLoading) return

    const isEnrichmentProcessing = bill.enrichment?.status === 'processing'
    const isAnalysisProcessing = bill.analysis?.status === 'processing'

    // Only set up polling if something is processing
    if (!isEnrichmentProcessing && !isAnalysisProcessing) return

    console.log('[BillDetailPage] Setting up polling - enrichment:', isEnrichmentProcessing, 'analysis:', isAnalysisProcessing)

    const pollInterval = setInterval(async () => {
      try {
        console.log('[BillDetailPage] Polling for updates...')
        const response = await getBillById(billId, accessToken)

        if (response.success && response.data) {
          const newBill = response.data.bill as BillData

          // Check if status changed from processing to complete
          const enrichmentComplete = isEnrichmentProcessing && newBill.enrichment?.status === 'complete'
          const analysisComplete = isAnalysisProcessing && newBill.analysis?.status === 'complete'

          if (enrichmentComplete) {
            console.log('[BillDetailPage] Enrichment completed!')
          }
          if (analysisComplete) {
            console.log('[BillDetailPage] Analysis completed!')
          }

          // Update bill data
          setBill(newBill)
        }
      } catch (err) {
        console.error('[BillDetailPage] Polling error:', err)
      }
    }, 5000) // Poll every 5 seconds

    // Cleanup interval on unmount or when dependencies change
    return () => {
      console.log('[BillDetailPage] Clearing poll interval')
      clearInterval(pollInterval)
    }
  }, [bill, billId, accessToken, authLoading])

  // Function to trigger bill analysis
  const handleAnalyzeBill = async () => {
    if (!billId || !accessToken) {
      console.error('[BillDetailPage] Cannot analyze: missing billId or accessToken')
      return
    }

    setAnalyzing(true)
    setAnalyzeError(null)

    try {
      console.log('[BillDetailPage] Triggering analysis for bill:', billId)

      const response = await fetch(`/api/bills/${billId}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to trigger analysis')
      }

      const data = await response.json()
      console.log('[BillDetailPage] Analysis triggered successfully:', data)

      // Poll for analysis completion
      let attempts = 0
      const maxAttempts = 24 // Poll for up to 2 minutes (24 * 5 seconds)

      const pollInterval = setInterval(async () => {
        attempts++
        console.log(`[BillDetailPage] Polling for analysis completion (attempt ${attempts}/${maxAttempts})`)

        try {
          const billResponse = await getBillById(billId, accessToken)
          if (billResponse.success && billResponse.data?.bill) {
            const updatedBill = billResponse.data.bill as BillData
            setBill(updatedBill)

            // Check if analysis is complete
            if (updatedBill.analysis?.status === 'complete') {
              console.log('[BillDetailPage] Analysis complete!')
              clearInterval(pollInterval)
              setAnalyzing(false)
            } else if (updatedBill.analysis?.status === 'failed') {
              console.error('[BillDetailPage] Analysis failed')
              clearInterval(pollInterval)
              setAnalyzeError('Analysis failed. Please try again.')
              setAnalyzing(false)
            }
          }

          // Stop polling after max attempts
          if (attempts >= maxAttempts) {
            console.log('[BillDetailPage] Max polling attempts reached')
            clearInterval(pollInterval)
            setAnalyzing(false)
          }
        } catch (pollError) {
          console.error('[BillDetailPage] Error polling for analysis:', pollError)
        }
      }, 5000) // Poll every 5 seconds

    } catch (err) {
      console.error('[BillDetailPage] Error triggering analysis:', err)
      setAnalyzeError(err instanceof Error ? err.message : 'Failed to trigger analysis')
      setAnalyzing(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !bill) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">{error || "Bill not found"}</p>
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

  const { enrichment, analysis, sponsor } = bill
  const billDisplayNumber = `${bill.type.toUpperCase()} ${bill.number}`
  const partyColor = sponsor?.party === "D" ? "text-blue-600" : sponsor?.party === "R" ? "text-red-600" : "text-gray-600"

  const impactInfo = enrichment?.impactLevel
    ? impactLevelConfig[enrichment.impactLevel as keyof typeof impactLevelConfig]
    : null

  // Likelihood info removed from UI - kept for future use
  // const likelihoodInfo = analysis?.passageLikelihood
  //   ? likelihoodConfig[analysis.passageLikelihood as keyof typeof likelihoodConfig]
  //   : null

  return (
    <div className="container mx-auto py-4 sm:py-8 px-3 sm:px-4">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        {/* Back Button - Sticky on mobile for easy navigation */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-3 px-3 py-2 sm:static sm:mx-0 sm:px-0 sm:py-0 sm:bg-transparent">
          <Button
            variant="ghost"
            asChild
            className="min-h-[44px] min-w-[44px] -ml-2"
            aria-label="Go back to dashboard"
          >
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
              <span>Back to Dashboard</span>
            </Link>
          </Button>
        </div>

        {/* Bill Header */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="space-y-3 sm:space-y-4">
              {/* Bill Number and Badges */}
              <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Bill identifiers">
                <span className="font-mono text-base sm:text-lg font-bold text-primary">
                  {billDisplayNumber}
                </span>
                {bill.policyArea && (
                  <Badge variant="secondary" className="text-xs sm:text-sm">
                    {bill.policyArea}
                  </Badge>
                )}
                {enrichment && (
                  <Badge variant="outline" className="gap-1 text-xs sm:text-sm">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    <span>AI Enhanced</span>
                  </Badge>
                )}
              </div>

              {/* Title */}
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight">
                {bill.title}
              </h1>

              {/* Meta Info */}
              <div
                className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-muted-foreground"
                role="group"
                aria-label="Bill metadata"
              >
                {bill.introducedDate && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <span>
                      Introduced{' '}
                      <time dateTime={bill.introducedDate}>
                        {new Date(bill.introducedDate).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </time>
                    </span>
                  </div>
                )}
                <span className="hidden sm:inline" aria-hidden="true">•</span>
                <span>{bill.congress}th Congress</span>
                {bill.originChamber && (
                  <>
                    <span className="hidden sm:inline" aria-hidden="true">•</span>
                    <span>Originated in {bill.originChamber}</span>
                  </>
                )}
              </div>

              {/* Actions - Stack on mobile, row on desktop */}
              <div
                className="flex flex-col sm:flex-row gap-2 sm:gap-2 pt-2"
                role="group"
                aria-label="Bill actions"
              >
                <Button
                  variant={isTracked ? "secondary" : "default"}
                  onClick={handleTrackToggle}
                  disabled={trackingAction || !accessToken}
                  className="min-h-[44px] w-full sm:w-auto justify-center"
                  aria-label={isTracked ? "Stop tracking this bill" : "Track this bill for updates"}
                  aria-pressed={isTracked}
                >
                  {trackingAction ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                      <span>{isTracked ? 'Untracking...' : 'Tracking...'}</span>
                    </>
                  ) : isTracked ? (
                    <>
                      <BookmarkCheck className="h-4 w-4 mr-2" aria-hidden="true" />
                      <span>Tracking</span>
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="h-4 w-4 mr-2" aria-hidden="true" />
                      <span>Track This Bill</span>
                    </>
                  )}
                </Button>

                <div className="flex gap-2 w-full sm:w-auto">
                  <div className="flex-1 sm:flex-none">
                    <ShareButtons
                      url={typeof window !== "undefined" ? `${window.location.origin}/bills/${billId}` : `/bills/${billId}`}
                      title={`${billDisplayNumber}: ${bill.title}`}
                      description={enrichment?.plainLanguageSummary || bill.title}
                      hashtags={["Hakivo", "Congress", bill.type.toUpperCase()]}
                    />
                  </div>

                  <Button
                    variant="default"
                    onClick={handleAnalyzeBill}
                    disabled={analyzing || !!analysis}
                    className="min-h-[44px] flex-1 sm:flex-none justify-center bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                    aria-label={analysis ? "Bill analysis is complete" : "Trigger AI analysis of this bill"}
                    aria-busy={analyzing}
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                        <span className="hidden xs:inline">Analyzing...</span>
                        <span className="xs:hidden">...</span>
                      </>
                    ) : analysis ? (
                      <>
                        <Sparkles className="h-4 w-4 sm:mr-2" aria-hidden="true" />
                        <span className="hidden sm:inline">Analysis Complete</span>
                        <span className="sm:hidden">Done</span>
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 sm:mr-2" aria-hidden="true" />
                        <span className="hidden sm:inline">Analyze This Bill</span>
                        <span className="sm:hidden">Analyze</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Analysis Error Message */}
              {analyzeError && (
                <div
                  className="mt-2 text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-950/30 rounded-md"
                  role="alert"
                  aria-live="polite"
                >
                  <AlertCircle className="h-4 w-4 inline mr-2" aria-hidden="true" />
                  {analyzeError}
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Sponsor Info */}
        {sponsor && (
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-2">
              <CardTitle className="text-base sm:text-lg">Sponsor</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-2 sm:pt-2">
              <Link
                href={`/representatives/${sponsor.bioguideId}`}
                className="flex items-center gap-3 sm:gap-4 p-2 -m-2 rounded-lg hover:bg-accent/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                aria-label={`View profile of ${sponsor.fullName}, ${sponsor.party === "D" ? "Democrat" : sponsor.party === "R" ? "Republican" : sponsor.party} from ${sponsor.state}`}
              >
                <Avatar className="h-12 w-12 sm:h-16 sm:w-16 flex-shrink-0">
                  <AvatarImage
                    src={`https://bioguide.congress.gov/bioguide/photo/${sponsor.bioguideId[0]}/${sponsor.bioguideId}.jpg`}
                    alt=""
                  />
                  <AvatarFallback aria-hidden="true">
                    {sponsor.firstName[0]}{sponsor.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base sm:text-lg truncate">
                    <span className={partyColor}>{sponsor.fullName}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {sponsor.party === "D" ? "Democrat" : sponsor.party === "R" ? "Republican" : sponsor.party}
                    <span aria-hidden="true"> • </span>
                    {sponsor.state}
                  </p>
                </div>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Basic Enrichment */}
        {enrichment && (
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" aria-hidden="true" />
                <span>AI Summary & Analysis</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4 sm:space-y-6">
              {/* Processing Status */}
              {enrichment.status === 'processing' && !enrichment.plainLanguageSummary && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      AI analysis in progress...
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Our AI is analyzing this bill. This typically takes 10-30 seconds.
                    </p>
                  </div>
                </div>
              )}

              {/* Plain Language Summary */}
              {enrichment.plainLanguageSummary && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Plain Language Summary</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {enrichment.plainLanguageSummary}
                  </p>
                </div>
              )}

              {/* Key Points */}
              {enrichment.keyPoints && enrichment.keyPoints.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Key Provisions</h3>
                  <ul className="space-y-2 list-disc list-inside">
                    {enrichment.keyPoints.map((point, index) => (
                      <li key={index} className="text-muted-foreground leading-relaxed">
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Separator />

              {/* Progress and Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Legislative Progress */}
                <div className="space-y-2" role="group" aria-label="Legislative progress">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Legislative Progress</span>
                    <span className="text-primary font-semibold">{enrichment.progressPercentage}%</span>
                  </div>
                  <Progress
                    value={enrichment.progressPercentage}
                    className="h-2 sm:h-3"
                    aria-label={`${enrichment.progressPercentage}% progress`}
                  />
                  <p className="text-xs text-muted-foreground">{enrichment.currentStage}</p>
                </div>

                {/* Bipartisan Score */}
                {enrichment.bipartisanScore !== undefined && (
                  <div className="space-y-2" role="group" aria-label="Bipartisan support score">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <span className="font-medium text-sm">Bipartisan Support</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={enrichment.bipartisanScore}
                        className="h-2 sm:h-3 flex-1"
                        aria-label={`${enrichment.bipartisanScore} out of 100 bipartisan score`}
                      />
                      <Badge
                        variant="outline"
                        className={
                          enrichment.bipartisanScore >= 70
                            ? "bg-green-500/10 text-green-700 dark:text-green-400"
                            : enrichment.bipartisanScore >= 40
                            ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                            : "bg-red-500/10 text-red-700 dark:text-red-400"
                        }
                      >
                        {enrichment.bipartisanScore}/100
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              {/* Impact and Tags */}
              <div className="flex items-center gap-3 flex-wrap">
                {impactInfo && (
                  <Badge className={impactInfo.color} variant="secondary">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {impactInfo.label}
                  </Badge>
                )}
                {enrichment.tags && enrichment.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deep Forensic Analysis */}
        {analysis && (
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Target className="h-4 w-4 sm:h-5 sm:w-5 text-primary" aria-hidden="true" />
                <span>Deep Forensic Analysis</span>
              </CardTitle>
              {analysis.analyzedAt && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                  Comprehensive analysis powered by AI
                  <span className="hidden sm:inline"> • Last updated </span>
                  <span className="sm:hidden"> · </span>
                  <time dateTime={analysis.analyzedAt}>
                    {new Date(analysis.analyzedAt).toLocaleDateString()}
                  </time>
                </p>
              )}
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4 sm:space-y-6">
              {/* Processing Status */}
              {analysis.status === 'processing' && !analysis.executiveSummary && (
                <div className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  <div>
                    <p className="font-medium text-purple-900 dark:text-purple-100">
                      Deep forensic analysis in progress...
                    </p>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Our AI is performing a comprehensive analysis of this legislation. This may take 30-60 seconds.
                    </p>
                  </div>
                </div>
              )}

              {/* Executive Summary */}
              {analysis.executiveSummary && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Executive Summary</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {analysis.executiveSummary}
                  </p>
                </div>
              )}

              <Separator />

              {/* Tabs for Different Analysis Sections */}
              {/* Simplified Analysis Layout - No Tabs */}
              <div className="space-y-6">
                {/* Who It Affects */}
                {analysis.stakeholderImpact && (
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
                  <h3 className="font-semibold text-sm sm:text-base mb-3">Potential Impact</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {/* Potential Benefits */}
                    <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                      <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
                        <CardTitle className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                          <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                          <span>Potential Benefits</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4 pt-0">
                        <ul className="space-y-2 sm:space-y-3" role="list" aria-label="List of potential benefits">
                          {analysis.argumentsFor && analysis.argumentsFor.length > 0 ? (
                            analysis.argumentsFor.map((benefit, index) => (
                              <li key={index} className="flex gap-2 text-sm">
                                <Check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                                <span className="text-green-900 dark:text-green-100">{String(benefit)}</span>
                              </li>
                            ))
                          ) : (
                            <li className="text-sm text-green-700 dark:text-green-300">No benefits listed</li>
                          )}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* Potential Concerns */}
                    <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                      <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
                        <CardTitle className="text-sm flex items-center gap-2 text-red-700 dark:text-red-400">
                          <AlertCircle className="h-4 w-4" aria-hidden="true" />
                          <span>Potential Concerns</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4 pt-0">
                        <ul className="space-y-2 sm:space-y-3" role="list" aria-label="List of potential concerns">
                          {analysis.argumentsAgainst && analysis.argumentsAgainst.length > 0 ? (
                            analysis.argumentsAgainst.map((concern, index) => (
                              <li key={index} className="flex gap-2 text-sm">
                                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                                <span className="text-red-900 dark:text-red-100">{String(concern)}</span>
                              </li>
                            ))
                          ) : (
                            <li className="text-sm text-red-700 dark:text-red-300">No concerns listed</li>
                          )}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Latest Action (always shown) */}
        {(bill.latestAction?.text || bill.latestActionText) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Latest Action</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                {bill.latestAction?.text || bill.latestActionText}
              </p>
              {(bill.latestAction?.date || bill.latestActionDate) && (
                <p className="text-sm text-muted-foreground mt-2">
                  {new Date(bill.latestAction?.date || bill.latestActionDate || '').toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Full Bill Text */}
        {bill.text ? (
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" aria-hidden="true" />
                  <span>Full Bill Text</span>
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFullText(!showFullText)}
                  className="min-h-[44px] min-w-[44px] shrink-0"
                  aria-expanded={showFullText}
                  aria-controls="bill-text-content"
                  aria-label={showFullText ? "Collapse bill text" : "Expand bill text"}
                >
                  {showFullText ? (
                    <>
                      <ChevronUp className="h-4 w-4 sm:mr-1" aria-hidden="true" />
                      <span className="hidden sm:inline">Collapse</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 sm:mr-1" aria-hidden="true" />
                      <span className="hidden sm:inline">Expand</span>
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0" id="bill-text-content">
              {showFullText ? (
                <pre className="whitespace-pre-wrap text-xs sm:text-sm text-muted-foreground font-mono bg-muted/50 p-3 sm:p-4 rounded-lg overflow-x-auto max-h-[400px] sm:max-h-[600px] overflow-y-auto">
                  {bill.text}
                </pre>
              ) : (
                <div className="space-y-2">
                  <pre className="whitespace-pre-wrap text-xs sm:text-sm text-muted-foreground font-mono bg-muted/50 p-3 sm:p-4 rounded-lg line-clamp-6">
                    {bill.text.substring(0, 500)}...
                  </pre>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Tap &quot;Expand&quot; to view the full bill text ({Math.round(bill.text.length / 1000)}k characters)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" aria-hidden="true" />
                <span>Full Bill Text</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <FileText className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
                <p className="text-sm sm:text-base">Bill text is not yet available.</p>
                <p className="text-xs sm:text-sm mt-1">
                  Text typically becomes available after a bill is formally introduced.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 min-h-[44px]"
                  asChild
                >
                  <a
                    href={`https://www.congress.gov/bill/${bill.congress}th-congress/${bill.type.toLowerCase().includes('hr') ? 'house' : 'senate'}-bill/${bill.number}/text`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Check Congress.gov for bill text (opens in new tab)"
                  >
                    Check Congress.gov
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Text Version Comparison */}
        <TextComparison
          congress={bill.congress}
          billType={bill.type}
          billNumber={bill.number}
        />
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        open={isUpgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        trigger={upgradeModalTrigger}
      />
    </div>
  )
}
