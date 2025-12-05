"use client"

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getMemberCampaignFinance } from '@/lib/api/backend'
import type { CampaignFinanceData, ContributionByEmployer, ContributionByOccupation, ContributionByIndustry } from '@/lib/api/backend'
import {
  AlertCircle,
  DollarSign,
  Loader2,
  Building2,
  Briefcase,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  PiggyBank,
  CreditCard
} from 'lucide-react'

interface CampaignFinanceTabProps {
  memberId: string
  memberName: string
}

// Format currency
function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`
  }
  return `$${amount.toLocaleString()}`
}

// Format full currency
function formatFullCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Financial summary card component
function FinanceSummaryCard({
  title,
  amount,
  icon: Icon,
  variant = 'default',
  description
}: {
  title: string
  amount: number
  icon: React.ElementType
  variant?: 'default' | 'success' | 'warning' | 'danger'
  description?: string
}) {
  const variantStyles = {
    default: 'text-foreground',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-red-600 dark:text-red-400',
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${variantStyles[variant]}`}>
          {formatCurrency(amount)}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

// Contributor row component
function ContributorRow({
  rank,
  name,
  amount,
  count
}: {
  rank: number
  name: string
  amount: number
  count: number
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground w-6">
          {rank}.
        </span>
        <span className="font-medium truncate max-w-[200px] sm:max-w-none">
          {name}
        </span>
      </div>
      <div className="text-right shrink-0">
        <div className="font-semibold text-green-600 dark:text-green-400">
          {formatFullCurrency(amount)}
        </div>
        <div className="text-xs text-muted-foreground">
          {count.toLocaleString()} contribution{count !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}

export function CampaignFinanceTab({ memberId, memberName }: CampaignFinanceTabProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CampaignFinanceData | null>(null)
  const [selectedCycle, setSelectedCycle] = useState<number>(2024)
  const [noDataAvailable, setNoDataAvailable] = useState(false)

  const fetchCampaignFinance = useCallback(async (cycle: number) => {
    try {
      setLoading(true)
      setError(null)
      setNoDataAvailable(false)

      const response = await getMemberCampaignFinance(memberId, cycle)

      if (response.success && response.data) {
        setData(response.data)
        // Update available cycles if provided
        if (response.data.availableCycles?.length > 0) {
          setSelectedCycle(response.data.cycle)
        }
      } else {
        // Check if it's a "no data" error vs a real error
        const errorMsg = response.error?.message || 'Failed to load campaign finance data'
        if (errorMsg.includes('No FEC') || errorMsg.includes('not found')) {
          setNoDataAvailable(true)
        } else {
          setError(errorMsg)
        }
      }
    } catch (err) {
      console.error('Failed to fetch campaign finance:', err)
      setError('Failed to load campaign finance data')
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    fetchCampaignFinance(selectedCycle)
  }, [fetchCampaignFinance, selectedCycle])

  const handleCycleChange = (value: string) => {
    const newCycle = parseInt(value, 10)
    setSelectedCycle(newCycle)
    fetchCampaignFinance(newCycle)
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        {/* Loading skeleton for summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Loading spinner for content */}
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Loading campaign finance data...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Campaign Finance</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  // No data available state
  if (noDataAvailable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Campaign Finance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <DollarSign className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">No Campaign Finance Data Available</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Campaign finance data is not available for {memberName}. This may be because
              they have not filed campaign finance reports or are not running for re-election.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Success - show campaign finance data
  if (!data) return null

  // Calculate percentage of individual vs PAC contributions
  const totalContributions = data.individualContributions + data.pacContributions + data.partyContributions
  const individualPct = totalContributions > 0 ? Math.round((data.individualContributions / totalContributions) * 100) : 0
  const pacPct = totalContributions > 0 ? Math.round((data.pacContributions / totalContributions) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Cycle Selector & External Links */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Election Cycle:</span>
          <Select value={String(selectedCycle)} onValueChange={handleCycleChange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Select cycle" />
            </SelectTrigger>
            <SelectContent>
              {(data.availableCycles?.length > 0 ? data.availableCycles : [2024, 2022, 2020, 2018]).map((cycle) => (
                <SelectItem key={cycle} value={String(cycle)}>
                  {cycle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.opensecretsId && (
            <Button asChild size="sm" variant="outline">
              <a
                href={`https://www.opensecrets.org/members-of-congress/summary?cid=${data.opensecretsId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3 mr-2" />
                OpenSecrets
              </a>
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <a
              href={`https://www.fec.gov/data/candidate/${data.candidateId}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3 w-3 mr-2" />
              FEC.gov
            </a>
          </Button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FinanceSummaryCard
          title="Total Raised"
          amount={data.totalRaised}
          icon={TrendingUp}
          variant="success"
        />
        <FinanceSummaryCard
          title="Total Spent"
          amount={data.totalSpent}
          icon={TrendingDown}
          variant="warning"
        />
        <FinanceSummaryCard
          title="Cash on Hand"
          amount={data.cashOnHand}
          icon={Wallet}
          variant="default"
        />
        <FinanceSummaryCard
          title="Debts"
          amount={data.debts}
          icon={CreditCard}
          variant={data.debts > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Contribution Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FinanceSummaryCard
          title="Individual Contributions"
          amount={data.individualContributions}
          icon={Users}
          description={`${individualPct}% of contributions`}
        />
        <FinanceSummaryCard
          title="PAC Contributions"
          amount={data.pacContributions}
          icon={Building2}
          description={`${pacPct}% of contributions`}
        />
        <FinanceSummaryCard
          title="Party Contributions"
          amount={data.partyContributions}
          icon={Briefcase}
        />
        <FinanceSummaryCard
          title="Self-Financed"
          amount={data.selfFinanced}
          icon={PiggyBank}
        />
      </div>

      {/* Top Industry & Individual Contributors - Main Feature */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Industry Contributors */}
        <Card className="border-amber-200 dark:border-amber-900">
          <CardHeader className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-amber-600" />
              Top Industry Contributors
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.topContributorsByIndustry?.length > 0 ? (
              <div className="divide-y">
                {data.topContributorsByIndustry
                  .filter((c: ContributionByIndustry) => {
                    const industry = (c.industry || '').toLowerCase();
                    // Filter out non-industry categories
                    const excluded = ['unknown/other', 'misc business', 'retired', 'homemakers/non-income earners'];
                    return !excluded.includes(industry);
                  })
                  .slice(0, 12)
                  .map((contrib: ContributionByIndustry, idx: number) => (
                  <div key={`industry-${idx}`} className="flex items-center justify-between py-3 px-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="font-medium truncate max-w-[200px] sm:max-w-none">
                        {contrib.industry}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-green-600 dark:text-green-400">
                        {formatFullCurrency(contrib.total)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No industry contribution data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Individual Contributors (Companies) */}
        <Card className="border-amber-200 dark:border-amber-900">
          <CardHeader className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-amber-600" />
              Top Individual Contributors
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.topContributorsByEmployer?.length > 0 ? (
              <div className="divide-y">
                {data.topContributorsByEmployer
                  .filter((c: ContributionByEmployer) => {
                    const name = (c.employer || '').toUpperCase().trim();
                    // Filter out generic/placeholder entries
                    const exactExclude = ['RETIRED', 'SELF-EMPLOYED', 'SELF EMPLOYED', 'NOT EMPLOYED', 'HOMEMAKER', 'NONE', 'N/A', 'NULL', 'UNKNOWN', ''];
                    if (exactExclude.includes(name)) return false;
                    // Filter out partial matches
                    if (name.startsWith('INFORMATION REQUESTED')) return false;
                    if (name.startsWith('SELF ')) return false;
                    if (name.includes('NOT EMPLOYED')) return false;
                    return true;
                  })
                  .slice(0, 12)
                  .map((contrib: ContributionByEmployer, idx: number) => (
                  <div key={`employer-${idx}`} className="flex items-center justify-between py-3 px-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="font-medium truncate max-w-[200px] sm:max-w-none">
                        {contrib.employer || 'Unknown'}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-green-600 dark:text-green-400">
                        {formatFullCurrency(contrib.total)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No individual contribution data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Secondary Contributors - Occupation breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="h-5 w-5" />
            Top Contributing Occupations
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Contributors grouped by occupation/profession
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {data.topContributorsByOccupation?.length > 0 ? (
            <div className="divide-y">
              {data.topContributorsByOccupation.slice(0, 10).map((contrib: ContributionByOccupation, idx: number) => (
                <ContributorRow
                  key={`${contrib.occupation}-${idx}`}
                  rank={idx + 1}
                  name={contrib.occupation || 'Unknown'}
                  amount={contrib.total}
                  count={contrib.count}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No occupation contribution data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contribution by Size Breakdown */}
      {data.contributionsBySize?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5" />
              Contributions by Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.contributionsBySize.map((bucket) => {
                const percentage = data.totalRaised > 0
                  ? Math.round((bucket.total / data.totalRaised) * 100)
                  : 0
                return (
                  <div key={bucket.size} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{bucket.sizeLabel}</span>
                      <span className="text-muted-foreground">
                        {formatFullCurrency(bucket.total)} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Source Note */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {data.source === 'cache' ? 'Cached Data' : 'FEC API'}
          </Badge>
          {data.coverageStart && data.coverageEnd && (
            <span>
              Coverage: {new Date(data.coverageStart).toLocaleDateString()} - {new Date(data.coverageEnd).toLocaleDateString()}
            </span>
          )}
        </div>
        {data.lastUpdated && (
          <span>
            Last updated: {new Date(data.lastUpdated).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  )
}
