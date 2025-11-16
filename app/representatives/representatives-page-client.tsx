"use client";

import { FC, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Mail, MapPin, Building2, Search, CheckCircle, XCircle, Minus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ListSkeleton } from "@/components/ui/loading-skeleton";
import { useOnline } from "@/lib/hooks/use-online";

interface Representative {
  id: string;
  name: string;
  role: string;
  party: string;
  state: string;
  district?: string;
  image?: string;
  initials: string;
  bio?: string;
  committees?: string[];
  phone?: string;
  email?: string;
  offices?: string[];
  recentVotes?: Array<{
    bill: string;
    title: string;
    vote: string;
    date: string;
  }>;
  yearsInOffice?: number;
  billsSponsored?: number;
}

interface RepresentativesPageClientProps {
  initialUserRepresentatives?: Representative[];
  initialAllMembers?: Representative[];
}

export const RepresentativesPageClient: FC<RepresentativesPageClientProps> = ({
  initialUserRepresentatives = [],
  initialAllMembers = [],
}) => {
  const [userReps, setUserReps] = useState<Representative[]>(initialUserRepresentatives);
  const [allMembers, setAllMembers] = useState<Representative[]>(initialAllMembers);
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [partyFilter, setPartyFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOnline = useOnline();

  // Fetch representatives
  const fetchRepresentatives = async () => {
    if (!isOnline) {
      setError("You're offline. Please check your internet connection.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/representatives');
      // const data = await response.json();

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // For now, use initial data if available
      if (initialUserRepresentatives.length > 0) {
        setUserReps(initialUserRepresentatives);
      }
      if (initialAllMembers.length > 0) {
        setAllMembers(initialAllMembers);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load representatives. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialUserRepresentatives.length > 0 || initialAllMembers.length > 0) {
      fetchRepresentatives();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    fetchRepresentatives();
  };

  const getVoteIcon = (vote: string) => {
    if (vote === "yes") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (vote === "no") return <XCircle className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const filteredMembers = allMembers.filter((member) => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesState = stateFilter === "all" || member.state === stateFilter;
    const matchesParty = partyFilter === "all" || member.party.toLowerCase() === partyFilter.toLowerCase();
    return matchesSearch && matchesState && matchesParty;
  });

  // Show loading state
  if (isLoading && userReps.length === 0 && allMembers.length === 0) {
    return (
      <div className="min-h-screen px-6 md:px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Your Representatives</h1>
            <p className="text-muted-foreground mt-2">
              Connect with your elected officials and track their legislative activity
            </p>
          </div>
          <ListSkeleton count={6} type="representative" />
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !isLoading) {
    return (
      <div className="min-h-screen px-6 md:px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Your Representatives</h1>
            <p className="text-muted-foreground mt-2">
              Connect with your elected officials and track their legislative activity
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

  // Show empty state for user representatives
  if (userReps.length === 0 && !isLoading && !error) {
    return (
      <div className="min-h-screen px-6 md:px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Your Representatives</h1>
            <p className="text-muted-foreground mt-2">
              Connect with your elected officials and track their legislative activity
            </p>
          </div>
          <EmptyState
            icon={<Building2 className="h-16 w-16" />}
            title="No Representatives Found"
            description="We couldn't find representatives for your location. Please check your location settings or search for representatives manually."
            action={{
              label: "Retry",
              onClick: handleRetry
            }}
          />
        </div>
      </div>
    );
  }

  // Show results
  return (
    <div className="min-h-screen px-6 md:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold">Your Representatives</h1>
          <p className="text-muted-foreground mt-2">
            Connect with your elected officials and track their legislative activity
          </p>
        </div>

        {/* Your Representatives Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Massachusetts Representatives</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {userReps.map((rep) => (
              <Card key={rep.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="text-center">
                  <Avatar className="h-24 w-24 mx-auto mb-4">
                    <AvatarImage src={rep.image || "/placeholder.svg"} alt={rep.name} />
                    <AvatarFallback>{rep.initials}</AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-lg">{rep.name}</CardTitle>
                  <CardDescription>
                    {rep.role}
                    {rep.district && ` • ${rep.district}`}
                  </CardDescription>
                  <Badge variant={rep.party === "Democrat" ? "default" : "secondary"} className="mx-auto mt-2">
                    {rep.party}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-muted">
                      <div className="text-2xl font-bold text-primary">{rep.yearsInOffice}</div>
                      <div className="text-xs text-muted-foreground">Years</div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted">
                      <div className="text-2xl font-bold text-primary">{rep.billsSponsored}</div>
                      <div className="text-xs text-muted-foreground">Bills</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Button className="w-full" variant="outline">
                      <Phone className="h-4 w-4 mr-2" />
                      {rep.phone}
                    </Button>
                    <Button className="w-full" variant="outline">
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                  </div>
                  <Button className="w-full" asChild>
                    <Link href={`/representatives/${rep.id}`}>
                      View Full Profile
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* All Members Directory */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle>All Members of Congress</CardTitle>
              <CardDescription>Search and filter representatives and senators</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filters */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, state, or district..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    <SelectItem value="MA">Massachusetts</SelectItem>
                    <SelectItem value="NY">New York</SelectItem>
                    <SelectItem value="FL">Florida</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={partyFilter} onValueChange={setPartyFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="All Parties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Parties</SelectItem>
                    <SelectItem value="democrat">Democrat</SelectItem>
                    <SelectItem value="republican">Republican</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Members Grid */}
              {filteredMembers.length === 0 ? (
                <EmptyState
                  icon={<Search className="h-12 w-12" />}
                  title="No Members Found"
                  description="No representatives match your search criteria. Try adjusting your filters."
                  action={{
                    label: "Clear Filters",
                    onClick: () => {
                      setSearchQuery("");
                      setStateFilter("all");
                      setPartyFilter("all");
                    }
                  }}
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredMembers.map((member) => (
                    <Link key={member.id} href={`/representatives/${member.id}`}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={member.image || "/placeholder.svg"} alt={member.name} />
                              <AvatarFallback>{member.initials}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm truncate">{member.name}</h4>
                              <p className="text-xs text-muted-foreground">{member.role}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {member.state}
                                  {member.district && `-${member.district}`}
                                </Badge>
                                <Badge variant={member.party === "Democrat" ? "default" : "secondary"} className="text-xs">
                                  {member.party.charAt(0)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
};
