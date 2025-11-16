"use client";

import { FC, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ListSkeleton } from "@/components/ui/loading-skeleton";
import { useOnline } from "@/lib/hooks/use-online";

interface Brief {
  id: number;
  title: string;
  date: string;
  duration: string;
  type: string;
  topics: string[];
  description: string;
  imageUrl?: string;
}

interface BriefsPageClientProps {
  initialBriefs?: Brief[];
}

export const BriefsPageClient: FC<BriefsPageClientProps> = ({ initialBriefs = [] }) => {
  const [briefs, setBriefs] = useState<Brief[]>(initialBriefs);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all-time");
  const [topicFilter, setTopicFilter] = useState("all-topics");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const isOnline = useOnline();

  // Fetch briefs
  const fetchBriefs = async () => {
    if (!isOnline) {
      setError("You're offline. Please check your internet connection.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/briefs', { ... });
      // const data = await response.json();

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // For now, use initial briefs if available
      if (initialBriefs.length > 0) {
        setBriefs(initialBriefs);
      } else {
        setBriefs([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load briefs. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialBriefs.length > 0) {
      fetchBriefs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    fetchBriefs();
  };

  const filteredBriefs = briefs.filter((brief) => {
    const matchesSearch = brief.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         brief.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || brief.type.toLowerCase().includes(typeFilter.toLowerCase());
    const matchesTopic = topicFilter === "all-topics" || brief.topics.some(topic =>
      topic.toLowerCase() === topicFilter.toLowerCase()
    );
    return matchesSearch && matchesType && matchesTopic;
  });

  // Show loading state
  if (isLoading && briefs.length === 0) {
    return (
      <div className="min-h-screen pb-32 px-6 md:px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Legislative Briefs</h1>
            <p className="text-muted-foreground">
              Your personalized audio briefings on Congressional legislation
            </p>
          </div>
          <ListSkeleton count={6} type="brief" />
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !isLoading) {
    return (
      <div className="min-h-screen pb-32 px-6 md:px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Legislative Briefs</h1>
            <p className="text-muted-foreground">
              Your personalized audio briefings on Congressional legislation
            </p>
          </div>
          <ErrorState
            message={error}
            type={!isOnline ? "network" : "server"}
            retry={handleRetry}
          />
        </div>
      </div>
    );
  }

  // Show empty state
  if (filteredBriefs.length === 0 && hasSearched && !isLoading) {
    return (
      <div className="min-h-screen pb-32 px-6 md:px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Legislative Briefs</h1>
            <p className="text-muted-foreground">
              Your personalized audio briefings on Congressional legislation
            </p>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search briefs..."
                    className="w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Brief Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="daily">Daily Brief</SelectItem>
                    <SelectItem value="weekly-laws">Weekly - Laws</SelectItem>
                    <SelectItem value="weekly-president">Weekly - President</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-time">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={topicFilter} onValueChange={setTopicFilter}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Topics" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-topics">All Topics</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="climate">Climate</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <EmptyState
            icon={<Search className="h-16 w-16" />}
            title="No Briefs Found"
            description="We couldn't find any briefs matching your search criteria. Try adjusting your filters or check back later for new content."
            action={{
              label: "Clear Filters",
              onClick: () => {
                setSearchQuery("");
                setTypeFilter("all");
                setDateFilter("all-time");
                setTopicFilter("all-topics");
                setHasSearched(false);
              }
            }}
          />
        </div>
      </div>
    );
  }

  // Show results
  return (
    <div className="min-h-screen pb-32 px-6 md:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Legislative Briefs</h1>
          <p className="text-muted-foreground">
            Your personalized audio briefings on Congressional legislation
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search briefs..."
                  className="w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Brief Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="daily">Daily Brief</SelectItem>
                  <SelectItem value="weekly-laws">Weekly - Laws</SelectItem>
                  <SelectItem value="weekly-president">Weekly - President</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-time">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>

              <Select value={topicFilter} onValueChange={setTopicFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Topics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-topics">All Topics</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="climate">Climate</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="defense">Defense</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="immigration">Immigration</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Briefs Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBriefs.map((brief) => (
            <Card key={brief.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-video bg-muted overflow-hidden">
                <img
                  src={brief.imageUrl || "/placeholder.svg"}
                  alt={brief.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      {brief.type}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{brief.date}</span>
                  </div>

                  <h3 className="font-semibold text-lg leading-tight line-clamp-2">
                    {brief.title}
                  </h3>

                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {brief.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1">
                  {brief.topics.map((topic) => (
                    <Badge key={topic} variant="outline" className="text-xs">
                      {topic}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">{brief.duration}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/briefs/${brief.id}`}>View</a>
                    </Button>
                    <Button size="sm">
                      Play
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Load More */}
        <div className="flex justify-center pt-4">
          <Button variant="outline" size="lg" onClick={fetchBriefs} disabled={isLoading}>
            {isLoading ? "Loading..." : "Load More Briefs"}
          </Button>
        </div>
      </div>
    </div>
  );
};
