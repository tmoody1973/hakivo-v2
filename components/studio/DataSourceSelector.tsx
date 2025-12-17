'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Radio,
  FileText,
  Bookmark,
  Search,
  MessageSquare,
  Check,
  Loader2,
  AlertCircle,
  Calendar,
  ChevronRight,
} from 'lucide-react';

// Data source types
export type DataSourceType = 'brief' | 'tracked' | 'search' | 'custom';

export interface DataSource {
  type: DataSourceType;
  id?: string;
  title: string;
  content: string;
  metadata?: {
    date?: string;
    billId?: string;
    congress?: number;
    type?: string;
  };
}

interface Brief {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  summary?: string;
}

interface TrackedBill {
  billId: string;
  title: string;
  congress: number;
  billType: string;
  billNumber: number;
  trackedAt: string;
}

interface DataSourceSelectorProps {
  onSelect: (source: DataSource | null) => void;
  selectedSource: DataSource | null;
}

export function DataSourceSelector({ onSelect, selectedSource }: DataSourceSelectorProps) {
  const { accessToken } = useAuth();
  const [sourceType, setSourceType] = useState<DataSourceType | null>(
    selectedSource?.type || null
  );

  // Data states
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [trackedBills, setTrackedBills] = useState<TrackedBill[]>([]);
  const [loadingBriefs, setLoadingBriefs] = useState(false);
  const [loadingTracked, setLoadingTracked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection states
  const [selectedBrief, setSelectedBrief] = useState<string | null>(null);
  const [selectedBill, setSelectedBill] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [customTopic, setCustomTopic] = useState('');

  // Fetch briefs when brief source type is selected
  useEffect(() => {
    if (sourceType === 'brief' && briefs.length === 0 && !loadingBriefs) {
      fetchBriefs();
    }
  }, [sourceType]);

  // Fetch tracked bills when tracked source type is selected
  useEffect(() => {
    if (sourceType === 'tracked' && trackedBills.length === 0 && !loadingTracked) {
      fetchTrackedBills();
    }
  }, [sourceType]);

  const fetchBriefs = async () => {
    if (!accessToken) return;
    setLoadingBriefs(true);
    setError(null);

    try {
      const response = await fetch('/api/briefs?limit=5&status=completed', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error('Failed to fetch briefs');

      const data = await response.json();
      setBriefs(data.briefs || []);
    } catch (err) {
      console.error('[DataSourceSelector] Error fetching briefs:', err);
      setError('Failed to load briefs');
    } finally {
      setLoadingBriefs(false);
    }
  };

  const fetchTrackedBills = async () => {
    if (!accessToken) return;
    setLoadingTracked(true);
    setError(null);

    try {
      const response = await fetch('/api/tracked', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error('Failed to fetch tracked bills');

      const data = await response.json();
      setTrackedBills(data.trackedBills || []);
    } catch (err) {
      console.error('[DataSourceSelector] Error fetching tracked:', err);
      setError('Failed to load tracked bills');
    } finally {
      setLoadingTracked(false);
    }
  };

  const handleSourceTypeSelect = (type: DataSourceType) => {
    setSourceType(type);
    // Clear previous selections
    setSelectedBrief(null);
    setSelectedBill(null);
    setSearchQuery('');
    setCustomTopic('');
    onSelect(null);
  };

  const handleBriefSelect = (brief: Brief) => {
    setSelectedBrief(brief.id);
    onSelect({
      type: 'brief',
      id: brief.id,
      title: brief.title,
      content: brief.summary || `Daily Brief from ${new Date(brief.createdAt).toLocaleDateString()}`,
      metadata: {
        date: brief.createdAt,
      },
    });
  };

  const handleTrackedBillSelect = (bill: TrackedBill) => {
    setSelectedBill(bill.billId);
    onSelect({
      type: 'tracked',
      id: bill.billId,
      title: bill.title,
      content: `${bill.billType.toUpperCase()} ${bill.billNumber} - ${bill.title}`,
      metadata: {
        billId: bill.billId,
        congress: bill.congress,
        type: bill.billType,
      },
    });
  };

  const handleCustomTopicSubmit = () => {
    if (!customTopic.trim()) return;
    onSelect({
      type: 'custom',
      title: customTopic.substring(0, 50) + (customTopic.length > 50 ? '...' : ''),
      content: customTopic,
    });
  };

  const sourceOptions = [
    {
      type: 'brief' as DataSourceType,
      icon: Radio,
      title: 'Daily Brief',
      description: 'Use your latest personalized briefing',
    },
    {
      type: 'tracked' as DataSourceType,
      icon: Bookmark,
      title: 'Tracked Bills',
      description: 'Choose from bills you\'re following',
    },
    {
      type: 'search' as DataSourceType,
      icon: Search,
      title: 'Search Legislation',
      description: 'Find a specific bill or topic',
    },
    {
      type: 'custom' as DataSourceType,
      icon: MessageSquare,
      title: 'Custom Topic',
      description: 'Enter your own topic or content',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Source Type Selection */}
      <div className="grid gap-3 sm:grid-cols-2">
        {sourceOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = sourceType === option.type;

          return (
            <Card
              key={option.type}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                isSelected && 'ring-2 ring-primary border-primary'
              )}
              onClick={() => handleSourceTypeSelect(option.type)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'h-10 w-10 rounded-lg flex items-center justify-center',
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-medium">{option.title}</CardTitle>
                      <CardDescription className="text-xs">{option.description}</CardDescription>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* Source-specific content */}
      {sourceType && (
        <Card>
          <CardContent className="pt-6">
            {/* Brief Selection */}
            {sourceType === 'brief' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Select a Brief</Label>
                {loadingBriefs ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : briefs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No briefs available yet</p>
                    <p className="text-xs mt-1">Generate your first brief from the dashboard</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {briefs.map((brief) => (
                      <div
                        key={brief.id}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                          selectedBrief === brief.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        )}
                        onClick={() => handleBriefSelect(brief)}
                      >
                        <div className="flex items-center gap-3">
                          <Radio className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{brief.title}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(brief.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        {selectedBrief === brief.id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tracked Bills Selection */}
            {sourceType === 'tracked' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Select a Tracked Bill</Label>
                {loadingTracked ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : trackedBills.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bookmark className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No tracked bills yet</p>
                    <p className="text-xs mt-1">Track bills from the legislation page</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {trackedBills.map((bill) => (
                      <div
                        key={bill.billId}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                          selectedBill === bill.billId
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        )}
                        onClick={() => handleTrackedBillSelect(bill)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                {bill.billType.toUpperCase()} {bill.billNumber}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {bill.congress}th Congress
                              </span>
                            </div>
                            <p className="text-sm font-medium truncate">{bill.title}</p>
                          </div>
                        </div>
                        {selectedBill === bill.billId && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Search */}
            {sourceType === 'search' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Search for Legislation</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., climate change, H.R. 1234, healthcare reform..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => {
                      if (searchQuery.trim()) {
                        onSelect({
                          type: 'search',
                          title: `Search: ${searchQuery}`,
                          content: searchQuery,
                        });
                      }
                    }}
                    disabled={!searchQuery.trim()}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Search our database of congressional legislation to find relevant bills
                </p>
              </div>
            )}

            {/* Custom Topic */}
            {sourceType === 'custom' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Enter Your Topic</Label>
                <textarea
                  className="w-full min-h-[120px] p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Describe the topic you want to create a document about...

Examples:
- The impact of recent tax legislation on small businesses
- Comparison of climate policy proposals in the 119th Congress
- Guide to understanding the federal budget process"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {customTopic.length} characters
                  </p>
                  <Button
                    size="sm"
                    onClick={handleCustomTopicSubmit}
                    disabled={!customTopic.trim()}
                  >
                    Use This Topic
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm mt-3">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
