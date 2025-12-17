'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Users,
  Newspaper,
  GitBranch,
  DollarSign,
  Vote,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';
import type { EnrichmentResult } from '@/hooks/useReportGenerator';
import type { DataSource } from './DataSourceSelector';
import type { EnrichmentOptions } from './EnrichmentOptionsPanel';

interface ContentPreviewProps {
  dataSource: DataSource;
  enrichmentOptions: EnrichmentOptions;
  enrichmentResult?: EnrichmentResult;
  isLoading?: boolean;
  error?: string;
  onRefresh?: () => void;
  className?: string;
}

export function ContentPreview({
  dataSource,
  enrichmentOptions,
  enrichmentResult,
  isLoading,
  error,
  onRefresh,
  className,
}: ContentPreviewProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    content: true,
    billDetails: false,
    news: false,
    relatedBills: false,
    finance: false,
    votes: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const enabledEnrichments = [
    enrichmentOptions.includeNewsContext && 'News',
    enrichmentOptions.includeRelatedBills && 'Related Bills',
    enrichmentOptions.includeCampaignFinance && 'Finance',
    enrichmentOptions.includeBillDetails && 'Bill Details',
    enrichmentOptions.includeVotingRecords && 'Votes',
    enrichmentOptions.includeDistrictImpact && 'District',
  ].filter(Boolean);

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={cn('border-destructive', className)}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">Failed to enrich content</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh} className="mt-4">
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{dataSource.title}</CardTitle>
              <CardDescription className="mt-1">
                {enabledEnrichments.length > 0 ? (
                  <>Enriched with: {enabledEnrichments.join(', ')}</>
                ) : (
                  <>No enrichments selected</>
                )}
              </CardDescription>
            </div>
            {enrichmentResult && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Preview Ready
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Original Content */}
      <Collapsible open={expandedSections.content} onOpenChange={() => toggleSection('content')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">Source Content</CardTitle>
                </div>
                {expandedSections.content ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {dataSource.content.substring(0, 1000)}
                  {dataSource.content.length > 1000 && '...'}
                </p>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Bill Details */}
      {enrichmentResult?.billDetails && (
        <Collapsible
          open={expandedSections.billDetails}
          onOpenChange={() => toggleSection('billDetails')}
        >
          <Card className="border-blue-200 dark:border-blue-900">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-sm">Bill Details</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {enrichmentResult.billDetails.id}
                    </Badge>
                  </div>
                  {expandedSections.billDetails ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-3">
                <div>
                  <p className="text-sm font-medium">{enrichmentResult.billDetails.title}</p>
                  {enrichmentResult.billDetails.status && (
                    <Badge variant="secondary" className="mt-1">
                      {enrichmentResult.billDetails.status}
                    </Badge>
                  )}
                </div>

                {enrichmentResult.billDetails.sponsor && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>
                      Sponsor: {enrichmentResult.billDetails.sponsor.name} (
                      {enrichmentResult.billDetails.sponsor.party}-
                      {enrichmentResult.billDetails.sponsor.state})
                    </span>
                  </div>
                )}

                {enrichmentResult.billDetails.cosponsors &&
                  enrichmentResult.billDetails.cosponsors.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {enrichmentResult.billDetails.cosponsors.length} cosponsors
                    </div>
                  )}

                {enrichmentResult.billDetails.latestAction && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Latest: </span>
                    {enrichmentResult.billDetails.latestAction.text}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* News Context */}
      {enrichmentResult?.newsContext && (
        <Collapsible open={expandedSections.news} onOpenChange={() => toggleSection('news')}>
          <Card className="border-orange-200 dark:border-orange-900">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Newspaper className="h-4 w-4 text-orange-600" />
                    <CardTitle className="text-sm">News Context</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {enrichmentResult.newsContext.sources?.length || 0} sources
                    </Badge>
                  </div>
                  {expandedSections.news ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-3">
                <p className="text-sm">{enrichmentResult.newsContext.summary}</p>

                {enrichmentResult.newsContext.keyPoints &&
                  enrichmentResult.newsContext.keyPoints.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Key Points:</p>
                      <ul className="text-sm space-y-1">
                        {enrichmentResult.newsContext.keyPoints.slice(0, 5).map((point, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-muted-foreground">•</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {enrichmentResult.newsContext.sources &&
                  enrichmentResult.newsContext.sources.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {enrichmentResult.newsContext.sources.slice(0, 3).map((source, i) => (
                        <a
                          key={i}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {source.title}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Related Bills */}
      {enrichmentResult?.relatedBills && enrichmentResult.relatedBills.length > 0 && (
        <Collapsible
          open={expandedSections.relatedBills}
          onOpenChange={() => toggleSection('relatedBills')}
        >
          <Card className="border-purple-200 dark:border-purple-900">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-purple-600" />
                    <CardTitle className="text-sm">Related Bills</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {enrichmentResult.relatedBills.length} found
                    </Badge>
                  </div>
                  {expandedSections.relatedBills ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {enrichmentResult.relatedBills.map((bill, i) => (
                    <div key={i} className="flex items-start justify-between p-2 rounded bg-muted/50">
                      <div className="min-w-0">
                        <Badge variant="secondary" className="text-xs mb-1">
                          {bill.id}
                        </Badge>
                        <p className="text-sm truncate">{bill.title}</p>
                      </div>
                      <Badge variant="outline" className="text-xs ml-2 shrink-0">
                        {Math.round(bill.similarity * 100)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Campaign Finance */}
      {enrichmentResult?.campaignFinance && (
        <Collapsible open={expandedSections.finance} onOpenChange={() => toggleSection('finance')}>
          <Card className="border-green-200 dark:border-green-900">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <CardTitle className="text-sm">Campaign Finance</CardTitle>
                  </div>
                  {expandedSections.finance ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-lg font-semibold text-green-600">
                      ${(enrichmentResult.campaignFinance.totalRaised / 1000000).toFixed(1)}M
                    </p>
                    <p className="text-xs text-muted-foreground">Raised</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-red-600">
                      ${(enrichmentResult.campaignFinance.totalSpent / 1000000).toFixed(1)}M
                    </p>
                    <p className="text-xs text-muted-foreground">Spent</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">
                      ${(enrichmentResult.campaignFinance.cashOnHand / 1000000).toFixed(1)}M
                    </p>
                    <p className="text-xs text-muted-foreground">On Hand</p>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Voting Records */}
      {enrichmentResult?.votingRecords && (
        <Collapsible open={expandedSections.votes} onOpenChange={() => toggleSection('votes')}>
          <Card className="border-indigo-200 dark:border-indigo-900">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Vote className="h-4 w-4 text-indigo-600" />
                    <CardTitle className="text-sm">Voting Records</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {enrichmentResult.votingRecords.totalVotes} votes
                    </Badge>
                  </div>
                  {expandedSections.votes ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="text-center mb-3">
                  <p className="text-2xl font-bold text-indigo-600">
                    {Math.round(enrichmentResult.votingRecords.partyLoyalty)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Party Loyalty Score</p>
                </div>

                {enrichmentResult.votingRecords.recentVotes &&
                  enrichmentResult.votingRecords.recentVotes.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Recent Votes:</p>
                      {enrichmentResult.votingRecords.recentVotes.slice(0, 3).map((vote, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="truncate max-w-[200px]">{vote.bill}</span>
                          <Badge
                            variant={vote.vote === 'Yea' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {vote.vote}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
