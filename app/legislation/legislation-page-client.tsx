"use client";

import { FC, useState, useEffect } from "react";
import { FileText, Search } from "lucide-react";
import { LegislationFilters } from "@/components/legislation-filters";
import { BillCard } from "@/components/bill-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ListSkeleton } from "@/components/ui/loading-skeleton";
import { useOnline } from "@/lib/hooks/use-online";

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
  const isOnline = useOnline();

  // Simulate API call
  const fetchBills = async () => {
    if (!isOnline) {
      setError("You're offline. Please check your internet connection.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/bills/search', { ... });
      // const data = await response.json();

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // For now, use initial bills if available
      if (initialBills.length > 0) {
        setBills(initialBills);
      } else {
        // Return empty to show empty state
        setBills([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load legislation. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialBills.length > 0) {
      fetchBills();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    fetchBills();
  };

  const handleSearch = () => {
    fetchBills();
  };

  // Show loading state
  if (isLoading && bills.length === 0) {
    return (
      <div className="min-h-screen bg-background px-6 md:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-balance">Legislative Search</h1>
          <p className="text-muted-foreground mt-1">
            Search and explore Congressional legislation
          </p>
        </div>

        <div className="mb-6">
          <LegislationFilters />
        </div>

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
            Search and explore Congressional legislation
          </p>
        </div>

        <div className="mb-6">
          <LegislationFilters />
        </div>

        <ErrorState
          message={error}
          type={!isOnline ? "network" : "server"}
          retry={handleRetry}
        />
      </div>
    );
  }

  // Show empty state
  if (bills.length === 0 && hasSearched && !isLoading) {
    return (
      <div className="min-h-screen bg-background px-6 md:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-balance">Legislative Search</h1>
          <p className="text-muted-foreground mt-1">
            Search and explore Congressional legislation
          </p>
        </div>

        <div className="mb-6">
          <LegislationFilters />
        </div>

        <EmptyState
          icon={<Search className="h-16 w-16" />}
          title="No Bills Found"
          description="We couldn't find any legislation matching your search criteria. Try adjusting your filters or search terms."
          action={{
            label: "Clear Filters",
            onClick: () => {
              setBills([]);
              setHasSearched(false);
            }
          }}
        />
      </div>
    );
  }

  // Show results
  return (
    <div className="min-h-screen bg-background px-6 md:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-balance">Legislative Search</h1>
        <p className="text-muted-foreground mt-1">
          Search and explore Congressional legislation
        </p>
      </div>

      <div className="mb-6">
        <LegislationFilters />
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{bills.length}</span> results
          </p>
          <select
            className="text-sm border border-border rounded-md px-3 py-1.5 bg-card text-foreground"
            aria-label="Sort results"
          >
            <option>Most Relevant</option>
            <option>Most Recent</option>
            <option>Most Cosponsors</option>
            <option>Oldest First</option>
          </select>
        </div>

        <div className="space-y-4">
          {bills.map((bill) => (
            <BillCard key={bill.id} bill={bill} />
          ))}
        </div>

        {/* Load More */}
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={handleSearch}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Load More Results"}
          </Button>
        </div>
      </div>
    </div>
  );
};
