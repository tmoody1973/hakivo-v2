'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, TrendingUp, List, Bookmark, Sparkles, Clock, ChevronLeft, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface BillAction {
  id: string;
  bill: {
    congress: number;
    type: string;
    number: number;
    title: string;
    url: string;
    inDatabase?: boolean;
    dbBillId?: string | null;
  };
  action: {
    date: string;
    text: string;
    status: string;
  };
  chamber: string;
  fetchedAt: number;
}

interface LatestActionsResponse {
  actions: BillAction[];
  count: number;
  lastUpdated: number | null;
  message?: string;
  error?: string;
}

const ITEMS_PER_PAGE = 5;
const BILLS_API_URL = process.env.NEXT_PUBLIC_BILLS_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function LatestActionsWidget() {
  const router = useRouter();
  const [actions, setActions] = useState<BillAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingBillId, setLoadingBillId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLatestActions() {
      try {
        const response = await fetch('/api/congress/latest-actions?limit=50');

        if (!response.ok) {
          throw new Error(`Failed to fetch latest actions: ${response.statusText}`);
        }

        const data: LatestActionsResponse = await response.json();

        if (data.error) {
          setError(data.message || data.error);
        } else {
          setActions(data.actions);
        }
      } catch (err) {
        console.error('Error fetching latest actions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load latest actions');
      } finally {
        setLoading(false);
      }
    }

    fetchLatestActions();
  }, []);

  // Calculate pagination
  const totalPages = Math.ceil(actions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentActions = actions.slice(startIndex, endIndex);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const getStatusBadgeColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('passed')) {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    if (statusLower.includes('committee')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    if (statusLower.includes('introduced')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    if (statusLower.includes('law')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const formatBillNumber = (type: string, number: number) => {
    const typeMap: Record<string, string> = {
      'hr': 'H.R.',
      's': 'S.',
      'hjres': 'H.J.Res.',
      'sjres': 'S.J.Res.',
      'hconres': 'H.Con.Res.',
      'sconres': 'S.Con.Res.',
      'hres': 'H.Res.',
      'sres': 'S.Res.',
    };
    return `${typeMap[type.toLowerCase()] || type.toUpperCase()} ${number}`;
  };

  // Handle clicking on a bill action - navigate to bill detail page
  // If bill is not in database, it will be auto-fetched from Congress.gov
  const handleBillClick = async (action: BillAction) => {
    const billId = `${action.bill.congress}-${action.bill.type}-${action.bill.number}`;
    setLoadingBillId(action.id);

    try {
      // If bill is already in database, navigate directly
      if (action.bill.inDatabase) {
        router.push(`/legislation/${action.bill.congress}/${action.bill.type}/${action.bill.number}`);
        return;
      }

      // Bill not in database - fetch from Congress.gov via our API (auto-fetch enabled by default)
      const response = await fetch(
        `${BILLS_API_URL}/bills/${action.bill.congress}/${action.bill.type}/${action.bill.number}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch bill details');
      }

      // Update local state to reflect that bill is now in database
      setActions(prevActions =>
        prevActions.map(a =>
          a.id === action.id
            ? { ...a, bill: { ...a.bill, inDatabase: true } }
            : a
        )
      );

      // Navigate to bill detail page
      router.push(`/legislation/${action.bill.congress}/${action.bill.type}/${action.bill.number}`);
    } catch (err) {
      console.error('Error fetching bill:', err);
      // Fallback: open Congress.gov URL in new tab
      window.open(action.bill.url, '_blank');
    } finally {
      setLoadingBillId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Latest Bill Actions
          </CardTitle>
          <CardDescription>Recent activity on tracked legislation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Latest Bill Actions
          </CardTitle>
          <CardDescription>Recent activity on tracked legislation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded-lg">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Latest Bill Actions
        </CardTitle>
        <CardDescription>Recent activity on tracked legislation</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="latest" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="latest" className="flex items-center gap-1.5">
              <List className="h-3.5 w-3.5" />
              Latest Actions
            </TabsTrigger>
            <TabsTrigger value="tracked" className="flex items-center gap-1.5">
              <Bookmark className="h-3.5 w-3.5" />
              Tracked Bills
            </TabsTrigger>
            <TabsTrigger value="recent" className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Recently Introduced
            </TabsTrigger>
          </TabsList>

          <TabsContent value="latest" className="mt-0">
            <div className="space-y-3">
              {currentActions.map((action) => (
                <div
                  key={action.id}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                  onClick={() => handleBillClick(action)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleBillClick(action)}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-primary group-hover:underline">
                          {formatBillNumber(action.bill.type, action.bill.number)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {action.chamber}
                        </Badge>
                        {loadingBillId === action.id && (
                          <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        )}
                        {!action.bill.inDatabase && loadingBillId !== action.id && (
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                      <h4 className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">{action.bill.title}</h4>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-xs whitespace-nowrap ${getStatusBadgeColor(action.action.status)}`}
                    >
                      {action.action.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1 line-clamp-1">{action.action.text}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(action.action.date), { addSuffix: true })}
                    </div>
                    <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      View details →
                    </span>
                  </div>
                </div>
              ))}

              {actions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No recent bill actions available.</p>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {getPageNumbers().map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">...</span>
                  ) : (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page as number)}
                      className="h-8 w-8 p-0"
                    >
                      {page}
                    </Button>
                  )
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tracked" className="mt-0">
            <div className="text-center py-8 text-muted-foreground">
              <Bookmark className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No tracked bills yet.</p>
              <p className="text-xs mt-1">Start tracking bills to see updates here.</p>
            </div>
          </TabsContent>

          <TabsContent value="recent" className="mt-0">
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Recently introduced bills coming soon.</p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
