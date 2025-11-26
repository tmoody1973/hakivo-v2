"use client";

import { FC, useState, useCallback } from "react";
import { Search, Sparkles } from "lucide-react";
import { BillCard } from "@/components/bill-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ListSkeleton } from "@/components/ui/loading-skeleton";
import { useOnline } from "@/lib/hooks/use-online";
import { semanticSearchBills } from "@/lib/api/backend";

interface Bill {
  id: string;
  number: string;
  title: string;
  sponsor: {
    name: string;
    party: string;
    state: string;
    photo: string;
  };
  status: string;
  policyAreas: string[];
  dateIntroduced: string;
  summary: string;
  cosponsors: number;
}

interface LegislationPageClientProps {
  initialBills?: Bill[];
}

export const LegislationPageClient: FC<LegislationPageClientProps> = ({ initialBills = [] }) => {
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [congress, setCongress] = useState(119);
  const [limit, setLimit] = useState(10);
  const isOnline = useOnline();

  // Map API response to component format
  const mapApiBillToComponent = (apiBill: any): Bill => {
    // Format bill number (e.g., "hr" + "1397" -> "H.R. 1397")
    const formatBillNumber = (type: string, number: number): string => {
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

    // Map party to single letter
    const formatParty = (party: string): string => {
      if (party.toLowerCase().includes('democrat')) return 'D';
      if (party.toLowerCase().includes('republican')) return 'R';
      if (party.toLowerCase().includes('independent')) return 'I';
      return party.charAt(0).toUpperCase();
    };

    // Infer status from latest action text (simplified)
    const inferStatus = (actionText: string | null): string => {
      if (!actionText) return 'introduced';
      const text = actionText.toLowerCase();
      if (text.includes('became public law') || text.includes('signed into law')) return 'enacted';
      if (text.includes('passed senate')) return 'passed-senate';
      if (text.includes('passed house')) return 'passed-house';
      if (text.includes('committee')) return 'in-committee';
      return 'introduced';
    };

    return {
      id: apiBill.id,
      number: formatBillNumber(apiBill.type, apiBill.number),
      title: apiBill.title,
      sponsor: {
        name: apiBill.sponsor
          ? `${apiBill.sponsor.firstName} ${apiBill.sponsor.lastName}`
          : 'Unknown Sponsor',
        party: apiBill.sponsor ? formatParty(apiBill.sponsor.party) : 'Unknown',
        state: apiBill.sponsor?.state || 'Unknown',
        photo: '' // No photo in API response, will use fallback
      },
      status: inferStatus(apiBill.latestAction?.text),
      policyAreas: apiBill.policyArea ? [apiBill.policyArea] : [],
      dateIntroduced: apiBill.introducedDate,
      summary: apiBill.matchedChunk || apiBill.latestAction?.text || '',
      cosponsors: 0 // Not in semantic search response
    };
  };

  // Perform semantic search
  const performSearch = useCallback(async (query: string) => {
    if (!isOnline) {
      setError("You're offline. Please check your internet connection.");
      return;
    }

    if (!query.trim()) {
      setError("Please enter a search query");
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      console.log('[LegislationPage] Performing semantic search:', query);

      const result = await semanticSearchBills({
        query: query.trim(),
        limit,
        congress
      });

      if (result.success && result.data) {
        console.log('[LegislationPage] Search successful, found:', result.data.count, 'bills');
        const mappedBills = result.data.bills.map(mapApiBillToComponent);
        setBills(mappedBills);
      } else {
        throw new Error(result.error?.message || 'Search failed');
      }
    } catch (err) {
      console.error('[LegislationPage] Search error:', err);
      setError(err instanceof Error ? err.message : "Failed to load legislation. Please try again.");
      setBills([]);
    } finally {
      setIsLoading(false);
    }
  }, [congress, limit, isOnline]);

  const handleRetry = () => {
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
  };

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
  };

  // Render semantic search bar
  const renderSearchBar = () => (
    <form onSubmit={handleSearch} className="mb-8">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search legislation using natural language... (e.g., 'bills about healthcare reform')"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4"
          />
        </div>
        <Button
          type="submit"
          disabled={isLoading || !searchQuery.trim()}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          {isLoading ? "Searching..." : "AI Search"}
        </Button>
      </div>
      {hasSearched && !isLoading && !error && (
        <p className="text-sm text-muted-foreground mt-2">
          Found <span className="font-semibold text-foreground">{bills.length}</span> bills matching &ldquo;{searchQuery}&rdquo;
        </p>
      )}
    </form>
  );

  // Show loading state
  if (isLoading && bills.length === 0) {
    return (
      <div className="min-h-screen bg-background px-6 md:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-balance">Legislative Search</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered semantic search for Congressional legislation
          </p>
        </div>

        {renderSearchBar()}
        <ListSkeleton count={6} type="bill" />
      </div>
    );
  }

  // Show error state
  if (error && !isLoading) {
    return (
      <div className="min-h-screen bg-background px-6 md:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-balance">Legislative Search</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered semantic search for Congressional legislation
          </p>
        </div>

        {renderSearchBar()}

        <ErrorState
          message={error}
          type={!isOnline ? "network" : "server"}
          retry={handleRetry}
        />
      </div>
    );
  }

  // Show empty or initial state
  if (bills.length === 0) {
    return (
      <div className="min-h-screen bg-background px-6 md:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-balance">Legislative Search</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered semantic search for Congressional legislation
          </p>
        </div>

        {renderSearchBar()}

        {hasSearched ? (
          <EmptyState
            icon={<Search className="h-16 w-16" />}
            title="No Bills Found"
            description={`No legislation found matching "${searchQuery}". Try different search terms or check your spelling.`}
            action={{
              label: "Clear Search",
              onClick: () => {
                setSearchQuery("");
                setBills([]);
                setHasSearched(false);
              }
            }}
          />
        ) : (
          <EmptyState
            icon={<Sparkles className="h-16 w-16" />}
            title="Start Your Search"
            description="Use natural language to find legislation. Try searching for topics like &lsquo;healthcare reform&rsquo;, &lsquo;climate change&rsquo;, or &lsquo;tax credits for renewable energy&rsquo;."
          />
        )}
      </div>
    );
  }

  // Show results
  return (
    <div className="min-h-screen bg-background px-6 md:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-balance">Legislative Search</h1>
        <p className="text-muted-foreground mt-1">
          AI-powered semantic search for Congressional legislation
        </p>
      </div>

      {renderSearchBar()}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{bills.length}</span> results
          </p>
          <div className="flex items-center gap-2">
            <select
              value={congress}
              onChange={(e) => setCongress(Number(e.target.value))}
              className="text-sm border border-border rounded-md px-3 py-1.5 bg-card text-foreground"
              aria-label="Filter by Congress"
            >
              <option value={119}>119th Congress</option>
              <option value={118}>118th Congress</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {bills.map((bill) => (
            <BillCard key={bill.id} bill={bill} />
          ))}
        </div>
      </div>
    </div>
  );
};
