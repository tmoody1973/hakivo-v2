"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
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
  BookmarkPlus,
  Share2,
  Loader2,
  Zap,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/lib/auth/auth-context"
import { getBillById } from "@/lib/api/backend"

interface BillData {
  id: string
  congress: number
  type: string
  number: number
  title: string
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
    status: string
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

const likelihoodConfig = {
  "very-low": { label: "Very Low", color: "text-red-600", percentage: 10 },
  low: { label: "Low", color: "text-orange-600", percentage: 30 },
  moderate: { label: "Moderate", color: "text-yellow-600", percentage: 50 },
  high: { label: "High", color: "text-green-600", percentage: 70 },
  "very-high": { label: "Very High", color: "text-emerald-600", percentage: 90 },
}

// Current congress (119th Congress: 2025-2027)
const CURRENT_CONGRESS = 119

export default function SimplifiedBillDetailPage() {
  const params = useParams()
  const router = useRouter()
  const simplifiedId = params?.id as string // e.g., "hr-1234" or "s-2767"
  const [bill, setBill] = useState<BillData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const { accessToken, isLoading: authLoading } = useAuth()

  // Convert simplified ID (hr-1234) to full ID (119-hr-1234)
  const fullBillId = simplifiedId ? `${CURRENT_CONGRESS}-${simplifiedId}` : null

  // Fetch bill data
  useEffect(() => {
    async function fetchBill() {
      if (!fullBillId) return

      try {
        console.log('[SimplifiedBillDetailPage] Starting fetch for bill:', fullBillId)
        console.log('[SimplifiedBillDetailPage] Auth loading:', authLoading)
        console.log('[SimplifiedBillDetailPage] Access token:', accessToken ? 'present' : 'missing')

        setLoading(true)
        setError(null)

        const response = await getBillById(fullBillId, accessToken || undefined)

        console.log('[SimplifiedBillDetailPage] Response:', response)

        if (response.success && response.data) {
          setBill(response.data.bill as BillData)
          setLoading(false)
        } else {
          setError(response.error?.message || "Failed to load bill details")
          setLoading(false)
        }
      } catch (err) {
        console.error("[SimplifiedBillDetailPage] Error fetching bill:", err)
        setError("Failed to load bill details")
        setLoading(false)
      }
    }

    // Wait for auth to finish loading before attempting to fetch
    if (fullBillId && !authLoading) {
      fetchBill()
    }
  }, [fullBillId, accessToken, authLoading])

  // Poll for updates when enrichment or analysis is processing
  useEffect(() => {
    if (!bill || !accessToken || authLoading || !fullBillId) return

    const isEnrichmentProcessing = bill.enrichment?.status === 'processing'
    const isAnalysisProcessing = bill.analysis?.status === 'processing'

    if (!isEnrichmentProcessing && !isAnalysisProcessing) return

    console.log('[SimplifiedBillDetailPage] Setting up polling - enrichment:', isEnrichmentProcessing, 'analysis:', isAnalysisProcessing)

    const pollInterval = setInterval(async () => {
      try {
        console.log('[SimplifiedBillDetailPage] Polling for updates...')
        const response = await getBillById(fullBillId, accessToken)

        if (response.success && response.data) {
          const newBill = response.data.bill as BillData

          const enrichmentComplete = isEnrichmentProcessing && newBill.enrichment?.status === 'complete'
          const analysisComplete = isAnalysisProcessing && newBill.analysis?.status === 'complete'

          if (enrichmentComplete) {
            console.log('[SimplifiedBillDetailPage] Enrichment completed!')
          }
          if (analysisComplete) {
            console.log('[SimplifiedBillDetailPage] Analysis completed!')
          }

          setBill(newBill)
        }
      } catch (err) {
        console.error('[SimplifiedBillDetailPage] Polling error:', err)
      }
    }, 5000) // Poll every 5 seconds

    return () => {
      console.log('[SimplifiedBillDetailPage] Clearing poll interval')
      clearInterval(pollInterval)
    }
  }, [bill, fullBillId, accessToken, authLoading])

  // Function to trigger bill analysis
  const handleAnalyzeBill = async () => {
    if (!fullBillId || !accessToken) {
      console.error('[SimplifiedBillDetailPage] Cannot analyze: missing fullBillId or accessToken')
      return
    }

    setAnalyzing(true)
    setAnalyzeError(null)

    try {
      console.log('[SimplifiedBillDetailPage] Triggering analysis for bill:', fullBillId)

      const response = await fetch(`/api/bills/${fullBillId}/analyze`, {
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
      console.log('[SimplifiedBillDetailPage] Analysis triggered successfully:', data)

      // Refresh bill data to show the analysis is in progress
      const billResponse = await getBillById(fullBillId, accessToken)
      if (billResponse.success && billResponse.data?.bill) {
        setBill(billResponse.data.bill)
      }
    } catch (err) {
      console.error('[SimplifiedBillDetailPage] Error triggering analysis:', err)
      setAnalyzeError(err instanceof Error ? err.message : 'Failed to trigger analysis')
    } finally {
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

  const likelihoodInfo = analysis?.passageLikelihood
    ? likelihoodConfig[analysis.passageLikelihood as keyof typeof likelihoodConfig]
    : null

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
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
              {/* Bill Number and Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-lg font-bold text-primary">
                  {billDisplayNumber}
                </span>
                {bill.policyArea && <Badge variant="secondary">{bill.policyArea}</Badge>}
                {enrichment && (
                  <Badge variant="outline" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI Enhanced
                  </Badge>
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold leading-tight">{bill.title}</h1>

              {/* Meta Info */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                {bill.introducedDate && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>
                      Introduced {new Date(bill.introducedDate).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                )}
                <span>•</span>
                <span>{bill.congress}th Congress</span>
                {bill.originChamber && (
                  <>
                    <span>•</span>
                    <span>Originated in {bill.originChamber}</span>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button>
                  <BookmarkPlus className="h-4 w-4 mr-2" />
                  Track This Bill
                </Button>
                <Button variant="outline">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button
                  variant="default"
                  onClick={handleAnalyzeBill}
                  disabled={analyzing || !!analysis}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : analysis ? (
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

        {/* Sponsor Info */}
        {sponsor && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sponsor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src="/placeholder.svg" alt={sponsor.fullName} />
                  <AvatarFallback>
                    {sponsor.firstName[0]}{sponsor.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold text-lg">
                    <span className={partyColor}>{sponsor.fullName}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {sponsor.party === "D" ? "Democrat" : sponsor.party === "R" ? "Republican" : sponsor.party} • {sponsor.state}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Basic Enrichment */}
        {enrichment && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Summary & Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
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
              <div className="grid md:grid-cols-2 gap-6">
                {/* Legislative Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Legislative Progress</span>
                    <span className="text-primary font-semibold">{enrichment.progressPercentage}%</span>
                  </div>
                  <Progress value={enrichment.progressPercentage} className="h-3" />
                  <p className="text-xs text-muted-foreground">{enrichment.currentStage}</p>
                </div>

                {/* Bipartisan Score */}
                {enrichment.bipartisanScore !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">Bipartisan Support</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={enrichment.bipartisanScore} className="h-3 flex-1" />
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
              <Tabs defaultValue="analysis" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="analysis">Analysis</TabsTrigger>
                  <TabsTrigger value="arguments">Arguments</TabsTrigger>
                  <TabsTrigger value="impact">Impact</TabsTrigger>
                  <TabsTrigger value="likelihood">Likelihood</TabsTrigger>
                </TabsList>

                {/* Analysis Tab */}
                <TabsContent value="analysis" className="space-y-4">
                  <Accordion type="single" collapsible className="w-full">
                    {/* Status Quo vs Change */}
                    <AccordionItem value="status-quo">
                      <AccordionTrigger>Status Quo vs. Proposed Change</AccordionTrigger>
                      <AccordionContent>
                        <p className="text-muted-foreground leading-relaxed">
                          {analysis.statusQuoVsChange}
                        </p>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Mechanism of Action */}
                    <AccordionItem value="mechanism">
                      <AccordionTrigger className="flex items-center gap-2">
                        <Gavel className="h-4 w-4" />
                        How This Bill Works
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-muted-foreground leading-relaxed">
                          {analysis.mechanismOfAction}
                        </p>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Section Breakdown */}
                    {analysis.sectionBreakdown && analysis.sectionBreakdown.length > 0 && (
                      <AccordionItem value="sections">
                        <AccordionTrigger>Bill Sections Breakdown</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3">
                            {analysis.sectionBreakdown.map((section, index) => (
                              <div key={index} className="border-l-2 border-primary pl-4">
                                <h4 className="font-semibold text-sm">{section.section}</h4>
                                <p className="text-muted-foreground text-sm">{section.summary}</p>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {/* Agency Powers */}
                    {analysis.agencyPowers && analysis.agencyPowers.length > 0 && (
                      <AccordionItem value="agencies">
                        <AccordionTrigger className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Agency Powers & Authorities
                        </AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-2 list-disc list-inside">
                            {analysis.agencyPowers.map((power, index) => (
                              <li key={index} className="text-muted-foreground">
                                {power}
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {/* Implementation Challenges */}
                    {analysis.implementationChallenges && analysis.implementationChallenges.length > 0 && (
                      <AccordionItem value="challenges">
                        <AccordionTrigger className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Implementation Challenges
                        </AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-2 list-disc list-inside">
                            {analysis.implementationChallenges.map((challenge, index) => (
                              <li key={index} className="text-muted-foreground">
                                {challenge}
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    )}
                  </Accordion>
                </TabsContent>

                {/* Arguments Tab */}
                <TabsContent value="arguments" className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Arguments For */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2 text-green-600">
                          <ThumbsUp className="h-4 w-4" />
                          Arguments For
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-3">
                          {analysis.argumentsFor?.map((arg, index) => (
                            <li key={index} className="text-sm">
                              <div className="flex gap-2">
                                <span className="text-green-600 font-semibold">+</span>
                                <div className="flex-1">
                                  <p className="font-medium text-foreground">{arg.point}</p>
                                  <p className="text-muted-foreground mt-1">{arg.evidence}</p>
                                </div>
                              </div>
                            </li>
                          )) || <p className="text-sm text-muted-foreground">No arguments listed</p>}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* Arguments Against */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                          <ThumbsDown className="h-4 w-4" />
                          Arguments Against
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-3">
                          {analysis.argumentsAgainst?.map((arg, index) => (
                            <li key={index} className="text-sm">
                              <div className="flex gap-2">
                                <span className="text-red-600 font-semibold">-</span>
                                <div className="flex-1">
                                  <p className="font-medium text-foreground">{arg.point}</p>
                                  <p className="text-muted-foreground mt-1">{arg.evidence}</p>
                                </div>
                              </div>
                            </li>
                          )) || <p className="text-sm text-muted-foreground">No arguments listed</p>}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Unintended Consequences */}
                  {analysis.unintendedConsequences && analysis.unintendedConsequences.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          Potential Unintended Consequences
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 list-disc list-inside">
                          {analysis.unintendedConsequences.map((consequence, index) => (
                            <li key={index} className="text-sm text-muted-foreground">
                              {consequence}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Impact Tab */}
                <TabsContent value="impact" className="space-y-4">
                  {/* Fiscal Impact */}
                  {analysis.fiscalImpact && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Fiscal Impact
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {analysis.fiscalImpact.estimatedCost && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Estimated Cost</p>
                            <p className="text-lg font-bold">{String(analysis.fiscalImpact.estimatedCost)}</p>
                          </div>
                        )}
                        {analysis.fiscalImpact.fundingSource && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Funding Source</p>
                            <p className="text-sm text-muted-foreground">{String(analysis.fiscalImpact.fundingSource)}</p>
                          </div>
                        )}
                        {analysis.fiscalImpact.timeframe && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Timeframe</p>
                            <p className="text-sm text-muted-foreground">{String(analysis.fiscalImpact.timeframe)}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Stakeholder Impact */}
                  {analysis.stakeholderImpact && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Stakeholder Impact
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {Object.entries(analysis.stakeholderImpact).map(([stakeholder, impact]) => (
                            <div key={stakeholder} className="border-l-2 border-primary pl-4">
                              <h4 className="font-semibold text-sm capitalize">{stakeholder.replace(/_/g, ' ')}</h4>
                              {typeof impact === 'string' ? (
                                <p className="text-muted-foreground text-sm">{impact}</p>
                              ) : typeof impact === 'object' && impact !== null ? (
                                <div className="space-y-2 mt-2">
                                  {Object.entries(impact).map(([subStakeholder, description]) => (
                                    <div key={subStakeholder} className="ml-4">
                                      <h5 className="font-medium text-xs capitalize text-foreground">{subStakeholder.replace(/_/g, ' ')}</h5>
                                      <p className="text-muted-foreground text-xs">{String(description)}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-muted-foreground text-sm">{String(impact)}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* State Impacts */}
                  {analysis.stateImpacts && Object.keys(analysis.stateImpacts).length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          State-Specific Impacts
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {Object.entries(analysis.stateImpacts).map(([state, impact]) => (
                            <div key={state} className="border-l-2 border-primary pl-4">
                              <h4 className="font-semibold text-sm">{state}</h4>
                              {typeof impact === 'string' ? (
                                <p className="text-muted-foreground text-sm">{impact}</p>
                              ) : typeof impact === 'object' && impact !== null ? (
                                <pre className="text-muted-foreground text-xs overflow-auto">{JSON.stringify(impact, null, 2)}</pre>
                              ) : (
                                <p className="text-muted-foreground text-sm">{String(impact)}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Likelihood Tab */}
                <TabsContent value="likelihood" className="space-y-4">
                  {/* Passage Likelihood */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Likelihood of Passage</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Progress value={likelihoodInfo?.percentage || 50} className="h-3" />
                        </div>
                        <Badge variant="outline" className={likelihoodInfo?.color}>
                          {likelihoodInfo?.label || analysis.passageLikelihood}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {analysis.passageReasoning}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Recent Developments */}
                  {analysis.recentDevelopments && analysis.recentDevelopments.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Recent Developments
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {analysis.recentDevelopments.map((dev, index) => (
                            <div key={index} className="flex gap-3">
                              <div className="flex-shrink-0 w-24 text-xs text-muted-foreground">
                                {new Date(dev.date).toLocaleDateString()}
                              </div>
                              <p className="text-sm text-muted-foreground flex-1">{dev.event}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* AI Thinking Summary */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        AI Analysis Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed italic">
                        {analysis.thinkingSummary}
                      </p>
                      <p className="text-xs text-muted-foreground mt-3">
                        Analysis model: {analysis.modelUsed}
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Latest Action (always shown) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Latest Action</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">{bill.latestActionText}</p>
            {bill.latestActionDate && (
              <p className="text-sm text-muted-foreground mt-2">
                {new Date(bill.latestActionDate).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
