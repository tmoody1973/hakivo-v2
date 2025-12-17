'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Newspaper,
  GitBranch,
  DollarSign,
  FileText,
  Vote,
  MapPin,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';

/**
 * Enrichment options matching backend EnrichmentOptions interface
 * @see hakivo-api/src/gamma-service/enrichment.ts
 */
export interface EnrichmentOptions {
  /** Include full bill details (text, sponsors, cosponsors) */
  includeBillDetails: boolean;

  /** Include member voting patterns */
  includeVotingRecords: boolean;

  /** Include recent news context from Perplexity */
  includeNewsContext: boolean;

  /** Include semantically related bills */
  includeRelatedBills: boolean;

  /** Include campaign finance data from FEC */
  includeCampaignFinance: boolean;

  /** Include district-specific analysis */
  includeDistrictImpact: boolean;

  /** Maximum number of related bills to include (1-10) */
  relatedBillsLimit: number;

  /** FEC election cycle for campaign finance */
  fecCycle: number;
}

/** Subject type determines which enrichments are applicable */
export type SubjectType = 'bill' | 'member' | 'policy' | 'general';

interface EnrichmentOption {
  key: keyof EnrichmentOptions;
  icon: typeof Newspaper;
  title: string;
  description: string;
  source: string;
  applicableTo: SubjectType[];
  preview: string;
}

const ENRICHMENT_OPTIONS: EnrichmentOption[] = [
  {
    key: 'includeNewsContext',
    icon: Newspaper,
    title: 'Recent News',
    description: 'Add real-time news coverage and analysis from reputable sources',
    source: 'Perplexity AI',
    applicableTo: ['bill', 'member', 'policy', 'general'],
    preview: 'Latest headlines, key developments, and expert analysis',
  },
  {
    key: 'includeRelatedBills',
    icon: GitBranch,
    title: 'Related Legislation',
    description: 'Find semantically similar bills and related policy proposals',
    source: 'AI Semantic Search',
    applicableTo: ['bill', 'policy', 'general'],
    preview: 'Up to 5 related bills with relevance scores',
  },
  {
    key: 'includeCampaignFinance',
    icon: DollarSign,
    title: 'Campaign Finance',
    description: 'Include fundraising data, top donors, and PAC contributions',
    source: 'FEC Database',
    applicableTo: ['member', 'bill'],
    preview: 'Total raised, spent, cash on hand, top contributors',
  },
  {
    key: 'includeBillDetails',
    icon: FileText,
    title: 'Bill Details',
    description: 'Full bill information including sponsors and cosponsors',
    source: 'Congressional Database',
    applicableTo: ['bill'],
    preview: 'Sponsor info, cosponsor list, committee assignments, status',
  },
  {
    key: 'includeVotingRecords',
    icon: Vote,
    title: 'Voting Records',
    description: 'Member voting history and party alignment statistics',
    source: 'Congressional Database',
    applicableTo: ['member'],
    preview: 'Recent votes, yea/nay percentages, party loyalty score',
  },
  {
    key: 'includeDistrictImpact',
    icon: MapPin,
    title: 'District Impact',
    description: 'Local analysis of how policies affect specific districts',
    source: 'AI Analysis',
    applicableTo: ['bill', 'policy'],
    preview: 'State/district population data, local implications',
  },
];

interface EnrichmentOptionsPanelProps {
  options: EnrichmentOptions;
  onChange: (options: EnrichmentOptions) => void;
  subjectType: SubjectType;
  className?: string;
}

export function EnrichmentOptionsPanel({
  options,
  onChange,
  subjectType,
  className,
}: EnrichmentOptionsPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Filter options applicable to the current subject type
  const applicableOptions = ENRICHMENT_OPTIONS.filter((opt) =>
    opt.applicableTo.includes(subjectType)
  );

  const enabledCount = applicableOptions.filter(
    (opt) => options[opt.key as keyof EnrichmentOptions] === true
  ).length;

  const handleToggle = (key: keyof EnrichmentOptions) => {
    onChange({
      ...options,
      [key]: !options[key],
    });
  };

  const handleRelatedBillsLimit = (value: number[]) => {
    onChange({
      ...options,
      relatedBillsLimit: value[0] || 5,
    });
  };

  // Get current election cycle
  const currentYear = new Date().getFullYear();
  const defaultCycle = currentYear % 2 === 0 ? currentYear : currentYear + 1;

  return (
    <TooltipProvider>
      <div className={cn('space-y-4', className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Enrich Your Content</h3>
          </div>
          <Badge variant="secondary">
            {enabledCount} of {applicableOptions.length} active
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground">
          Enhance your document with additional data from multiple sources. Each option adds
          relevant context to make your content more comprehensive.
        </p>

        {/* Quick toggles for primary options */}
        <div className="grid gap-3 sm:grid-cols-2">
          {applicableOptions.slice(0, 4).map((option) => {
            const Icon = option.icon;
            const isEnabled = options[option.key as keyof EnrichmentOptions] === true;

            return (
              <Card
                key={option.key}
                className={cn(
                  'cursor-pointer transition-all',
                  isEnabled && 'ring-1 ring-primary/50 bg-primary/5'
                )}
                onClick={() => handleToggle(option.key)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                          isEnabled ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{option.title}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="text-xs">{option.preview}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Source: {option.source}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {option.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => handleToggle(option.key)}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Additional options (if more than 4) */}
        {applicableOptions.length > 4 && (
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span>More enrichment options ({applicableOptions.length - 4} more)</span>
                {showAdvanced ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              {applicableOptions.slice(4).map((option) => {
                const Icon = option.icon;
                const isEnabled = options[option.key as keyof EnrichmentOptions] === true;

                return (
                  <Card
                    key={option.key}
                    className={cn(
                      'cursor-pointer transition-all',
                      isEnabled && 'ring-1 ring-primary/50 bg-primary/5'
                    )}
                    onClick={() => handleToggle(option.key)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                              isEnabled ? 'bg-primary text-primary-foreground' : 'bg-muted'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{option.title}</span>
                              <Badge variant="outline" className="text-xs">
                                {option.source}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {option.description}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => handleToggle(option.key)}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Advanced settings for enabled options */}
        {options.includeRelatedBills && (
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Related Bills Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Number of related bills</Label>
                  <span className="text-sm font-medium">{options.relatedBillsLimit}</span>
                </div>
                <Slider
                  value={[options.relatedBillsLimit]}
                  onValueChange={handleRelatedBillsLimit}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  More bills = more comprehensive but longer document
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {options.includeCampaignFinance && (
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Campaign Finance Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Election Cycle</Label>
                <Badge variant="secondary">{options.fecCycle || defaultCycle}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Using the {options.fecCycle || defaultCycle} election cycle data
              </p>
            </CardContent>
          </Card>
        )}

        {/* Summary of what will be included */}
        {enabledCount > 0 && (
          <div className="rounded-lg bg-muted/50 p-4">
            <h4 className="text-sm font-medium mb-2">Your document will include:</h4>
            <div className="flex flex-wrap gap-2">
              {applicableOptions
                .filter((opt) => options[opt.key as keyof EnrichmentOptions] === true)
                .map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <Badge key={opt.key} variant="secondary" className="gap-1">
                      <Icon className="h-3 w-3" />
                      {opt.title}
                    </Badge>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

/**
 * Get default enrichment options based on subject type
 */
export function getDefaultEnrichmentOptions(subjectType: SubjectType): EnrichmentOptions {
  const currentYear = new Date().getFullYear();
  const defaultCycle = currentYear % 2 === 0 ? currentYear : currentYear + 1;

  // Base options - always include news context
  const baseOptions: EnrichmentOptions = {
    includeBillDetails: false,
    includeVotingRecords: false,
    includeNewsContext: true, // Always on by default
    includeRelatedBills: false,
    includeCampaignFinance: false,
    includeDistrictImpact: false,
    relatedBillsLimit: 5,
    fecCycle: defaultCycle,
  };

  // Set defaults based on subject type
  switch (subjectType) {
    case 'bill':
      return {
        ...baseOptions,
        includeBillDetails: true,
        includeRelatedBills: true,
      };
    case 'member':
      return {
        ...baseOptions,
        includeVotingRecords: true,
        includeCampaignFinance: true,
      };
    case 'policy':
      return {
        ...baseOptions,
        includeRelatedBills: true,
      };
    case 'general':
    default:
      return baseOptions;
  }
}

/**
 * Detect subject type from data source
 */
export function detectSubjectType(dataSource: {
  type: string;
  metadata?: { billId?: string; bioguideId?: string };
}): SubjectType {
  if (dataSource.type === 'tracked' || dataSource.metadata?.billId) {
    return 'bill';
  }
  if (dataSource.metadata?.bioguideId) {
    return 'member';
  }
  if (dataSource.type === 'search') {
    return 'policy';
  }
  return 'general';
}
