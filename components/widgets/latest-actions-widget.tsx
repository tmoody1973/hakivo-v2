'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, TrendingUp, List, Bookmark, BookmarkX, Sparkles, Clock, ChevronLeft, ChevronRight, ExternalLink, Loader2, Landmark, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getStateBills, StateBill } from '@/lib/api/backend';
import { useTracking, TrackedFederalBill, TrackedStateBill } from '@/lib/hooks/use-tracking';

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

// State name mapping for display
const STATE_NAMES: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'District of Columbia', 'PR': 'Puerto Rico'
};

interface LatestActionsWidgetProps {
  userState?: string | null;
  token?: string | null;
}

export function LatestActionsWidget({ userState, token }: LatestActionsWidgetProps) {
  const router = useRouter();
  const [actions, setActions] = useState<BillAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingBillId, setLoadingBillId] = useState<string | null>(null);

  // State bills state
  const [stateBills, setStateBills] = useState<StateBill[]>([]);
  const [stateBillsLoading, setStateBillsLoading] = useState(false);
  const [stateBillsError, setStateBillsError] = useState<string | null>(null);
  const [stateBillsPage, setStateBillsPage] = useState(1);
  const [stateBillsFetched, setStateBillsFetched] = useState(false);

  // Tracked bills state (using the useTracking hook)
  const {
    trackedItems,
    counts: trackedCounts,
    loading: trackedLoading,
    untrackFederalBill,
    untrackStateBill,
  } = useTracking({ token });
  const [untrackingId, setUntrackingId] = useState<string | null>(null);
  const [trackedBillsPage, setTrackedBillsPage] = useState(1);

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

  // Fetch state bills when userState is available (lazy load on tab click)
  const fetchStateBills = async () => {
    if (!userState || stateBillsFetched) return;

    setStateBillsLoading(true);
    setStateBillsError(null);

    try {
      const response = await getStateBills({
        state: userState,
        limit: 50,
        sort: 'latest_action_date',
        order: 'desc',
      });

      if (response.success && response.data) {
        setStateBills(response.data.bills);
        setStateBillsFetched(true);
      } else {
        setStateBillsError(response.error?.message || 'Failed to load state bills');
      }
    } catch (err) {
      console.error('Error fetching state bills:', err);
      setStateBillsError(err instanceof Error ? err.message : 'Failed to load state bills');
    } finally {
      setStateBillsLoading(false);
    }
  };

  // Handle tab change to trigger lazy loading of state bills
  const handleTabChange = (value: string) => {
    if (value === 'state' && !stateBillsFetched && userState) {
      fetchStateBills();
    }
  };

  // Tracked bills handlers
  const handleUntrackFederal = async (bill: TrackedFederalBill) => {
    setUntrackingId(bill.trackingId);
    await untrackFederalBill(bill.billId, bill.trackingId);
    setUntrackingId(null);
  };

  const handleUntrackState = async (bill: TrackedStateBill) => {
    setUntrackingId(bill.trackingId);
    await untrackStateBill(bill.billId, bill.trackingId);
    setUntrackingId(null);
  };

  const formatTrackedDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Combined tracked bills for pagination
  const allTrackedBills = [
    ...(trackedItems?.federalBills || []).map(b => ({ ...b, billType: 'federal' as const })),
    ...(trackedItems?.stateBills || []).map(b => ({ ...b, billType: 'state' as const })),
  ].sort((a, b) => b.trackedAt - a.trackedAt);

  const trackedBillsTotalPages = Math.ceil(allTrackedBills.length / ITEMS_PER_PAGE);
  const trackedBillsStartIndex = (trackedBillsPage - 1) * ITEMS_PER_PAGE;
  const trackedBillsEndIndex = trackedBillsStartIndex + ITEMS_PER_PAGE;
  const currentTrackedBills = allTrackedBills.slice(trackedBillsStartIndex, trackedBillsEndIndex);

  // Calculate pagination for federal actions
  const totalPages = Math.ceil(actions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentActions = actions.slice(startIndex, endIndex);

  // Calculate pagination for state bills
  const stateBillsTotalPages = Math.ceil(stateBills.length / ITEMS_PER_PAGE);
  const stateBillsStartIndex = (stateBillsPage - 1) * ITEMS_PER_PAGE;
  const stateBillsEndIndex = stateBillsStartIndex + ITEMS_PER_PAGE;
  const currentStateBills = stateBills.slice(stateBillsStartIndex, stateBillsEndIndex);

  // Generate page numbers to display (reusable for both federal and state bills)
  const getPageNumbers = (total: number, current: number) => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      if (current <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(total);
      } else if (current >= total - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = total - 3; i <= total; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = current - 1; i <= current + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(total);
      }
    }
    return pages;
  };

  // Get chamber display name
  const getChamberDisplay = (chamber: string | null) => {
    if (!chamber) return 'Unknown';
    return chamber === 'upper' ? 'Senate' : chamber === 'lower' ? 'House' : chamber;
  };

  // Get party color for sponsor badge
  const getPartyColor = (party: string | null) => {
    if (!party) return 'bg-gray-100 text-gray-800 border-gray-200';
    const partyLower = party.toLowerCase();
    if (partyLower.includes('democrat')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (partyLower.includes('republican')) return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
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
        router.push(`/bills/${billId}`);
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
      router.push(`/bills/${billId}`);
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
        <Tabs defaultValue="latest" className="w-full" onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="latest" className="flex items-center gap-1.5">
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Latest</span>
              <span className="sm:hidden">Latest</span>
            </TabsTrigger>
            <TabsTrigger value="state" className="flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">State Bills</span>
              <span className="sm:hidden">State</span>
            </TabsTrigger>
            <TabsTrigger value="tracked" className="flex items-center gap-1.5">
              <Bookmark className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tracked</span>
              <span className="sm:hidden">Tracked</span>
            </TabsTrigger>
            <TabsTrigger value="recent" className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Recent</span>
              <span className="sm:hidden">Recent</span>
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

                {getPageNumbers(totalPages, currentPage).map((page, index) => (
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

          <TabsContent value="state" className="mt-0">
            {!userState ? (
              <div className="text-center py-8 text-muted-foreground">
                <Landmark className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Set your state in your profile to see state legislation.</p>
              </div>
            ) : stateBillsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : stateBillsError ? (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded-lg">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm">{stateBillsError}</p>
              </div>
            ) : stateBills.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Landmark className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent state bills found for {STATE_NAMES[userState] || userState}.</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {currentStateBills.map((bill) => (
                    <div
                      key={bill.id}
                      onClick={() => router.push(`/state-bills/${bill.detailId || encodeURIComponent(bill.id)}`)}
                      className="block p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && router.push(`/state-bills/${bill.detailId || encodeURIComponent(bill.id)}`)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-mono text-primary group-hover:underline">
                              {bill.identifier}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {getChamberDisplay(bill.chamber)}
                            </Badge>
                            {bill.sponsor && (
                              <Badge
                                variant="secondary"
                                className={`text-xs ${getPartyColor(bill.sponsor.party)}`}
                              >
                                {bill.sponsor.name}
                                {bill.sponsor.party && ` (${bill.sponsor.party.charAt(0)})`}
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                            {bill.title}
                          </h4>
                        </div>
                      </div>
                      {bill.latestAction.description && (
                        <p className="text-xs text-muted-foreground mb-1 line-clamp-1">
                          {bill.latestAction.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {bill.latestAction.date
                            ? formatDistanceToNow(new Date(bill.latestAction.date), { addSuffix: true })
                            : 'No recent action'}
                        </div>
                        <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          View details →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* State Bills Pagination Controls */}
                {stateBillsTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStateBillsPage(p => Math.max(1, p - 1))}
                      disabled={stateBillsPage === 1}
                      className="h-8"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {getPageNumbers(stateBillsTotalPages, stateBillsPage).map((page, index) => (
                      page === '...' ? (
                        <span key={`state-ellipsis-${index}`} className="px-2 text-muted-foreground">...</span>
                      ) : (
                        <Button
                          key={`state-${page}`}
                          variant={stateBillsPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setStateBillsPage(page as number)}
                          className="h-8 w-8 p-0"
                        >
                          {page}
                        </Button>
                      )
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStateBillsPage(p => Math.min(stateBillsTotalPages, p + 1))}
                      disabled={stateBillsPage === stateBillsTotalPages}
                      className="h-8"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="tracked" className="mt-0">
            {trackedLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : allTrackedBills.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tracked bills yet.</p>
                <p className="text-xs mt-1 mb-4">Start tracking bills to see updates here.</p>
                <Link href="/legislation">
                  <Button variant="outline" size="sm">
                    Browse Legislation
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {currentTrackedBills.map((bill) => {
                    if (bill.billType === 'federal') {
                      const federalBill = bill as TrackedFederalBill & { billType: 'federal' };
                      return (
                        <div
                          key={federalBill.trackingId}
                          className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <Link
                                href={`/bills/${federalBill.billId}`}
                                className="hover:underline"
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-mono text-primary">
                                    {federalBill.billType.toUpperCase()} {federalBill.billNumber}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    Federal
                                  </Badge>
                                </div>
                                <h4 className="font-medium text-sm line-clamp-2">
                                  {federalBill.title}
                                </h4>
                              </Link>
                              <div className="flex items-center gap-2 mt-1">
                                {federalBill.sponsor && (
                                  <Badge
                                    variant="secondary"
                                    className={`text-xs ${getPartyColor(federalBill.sponsor.party)}`}
                                  >
                                    {federalBill.sponsor.lastName} ({federalBill.sponsor.party})
                                  </Badge>
                                )}
                                {federalBill.latestActionDate && (
                                  <span className="text-xs text-muted-foreground">
                                    {formatTrackedDate(federalBill.latestActionDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 shrink-0"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleUntrackFederal(federalBill);
                              }}
                              disabled={untrackingId === federalBill.trackingId}
                            >
                              {untrackingId === federalBill.trackingId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <BookmarkX className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    } else {
                      const stateBill = bill as TrackedStateBill & { billType: 'state' };
                      return (
                        <div
                          key={stateBill.trackingId}
                          className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <Link
                                href={`/state-bills/${encodeURIComponent(stateBill.billId)}`}
                                className="hover:underline"
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-mono text-primary">
                                    {stateBill.identifier}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {stateBill.stateName}
                                  </Badge>
                                </div>
                                <h4 className="font-medium text-sm line-clamp-2">
                                  {stateBill.title || 'Untitled'}
                                </h4>
                              </Link>
                              <div className="flex items-center gap-2 mt-1">
                                {stateBill.latestActionDate && (
                                  <span className="text-xs text-muted-foreground">
                                    {formatTrackedDate(stateBill.latestActionDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 shrink-0"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleUntrackState(stateBill);
                              }}
                              disabled={untrackingId === stateBill.trackingId}
                            >
                              {untrackingId === stateBill.trackingId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <BookmarkX className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>

                {/* Tracked Bills Pagination Controls */}
                {trackedBillsTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTrackedBillsPage(p => Math.max(1, p - 1))}
                      disabled={trackedBillsPage === 1}
                      className="h-8"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {getPageNumbers(trackedBillsTotalPages, trackedBillsPage).map((page, index) => (
                      page === '...' ? (
                        <span key={`tracked-ellipsis-${index}`} className="px-2 text-muted-foreground">...</span>
                      ) : (
                        <Button
                          key={`tracked-${page}`}
                          variant={trackedBillsPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setTrackedBillsPage(page as number)}
                          className="h-8 w-8 p-0"
                        >
                          {page}
                        </Button>
                      )
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTrackedBillsPage(p => Math.min(trackedBillsTotalPages, p + 1))}
                      disabled={trackedBillsPage === trackedBillsTotalPages}
                      className="h-8"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* View all link */}
                {allTrackedBills.length > 5 && (
                  <div className="mt-4 pt-4 border-t">
                    <Link href="/settings?tab=tracked" className="block">
                      <Button variant="ghost" className="w-full text-xs" size="sm">
                        Manage all {allTrackedBills.length} tracked bills
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            )}
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
