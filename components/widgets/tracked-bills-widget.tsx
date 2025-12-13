"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, BookmarkX, ExternalLink, Loader2, Bell, BellOff, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useTracking,
  TrackedFederalBill,
  TrackedStateBill,
} from "@/lib/hooks/use-tracking";

interface TrackedBillsWidgetProps {
  token: string | null;
}

export function TrackedBillsWidget({ token }: TrackedBillsWidgetProps) {
  const {
    trackedItems,
    counts,
    loading,
    error,
    untrackFederalBill,
    untrackStateBill,
  } = useTracking({ token });

  const [untrackingId, setUntrackingId] = useState<string | null>(null);

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

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getPartyColor = (party?: string) => {
    switch (party?.toUpperCase()) {
      case "D":
      case "DEMOCRAT":
      case "DEMOCRATIC":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "R":
      case "REPUBLICAN":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" />
            Tracked Bills
          </CardTitle>
          <CardDescription>Bills you're following</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" />
            Tracked Bills
          </CardTitle>
          <CardDescription>Bills you're following</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Unable to load tracked bills
          </p>
        </CardContent>
      </Card>
    );
  }

  const federalBills = trackedItems?.federalBills || [];
  const stateBills = trackedItems?.stateBills || [];
  const totalBills = (counts?.federalBills || 0) + (counts?.stateBills || 0);

  if (totalBills === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" />
            Tracked Bills
          </CardTitle>
          <CardDescription>Bills you're following</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              You haven't tracked any bills yet
            </p>
            <Link href="/legislation">
              <Button variant="outline" size="sm">
                Browse Legislation
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bookmark className="h-5 w-5" />
              Tracked Bills
            </CardTitle>
            <CardDescription>
              {totalBills} bill{totalBills !== 1 ? "s" : ""} tracked
            </CardDescription>
          </div>
          <Link href="/settings?tab=tracked">
            <Button variant="ghost" size="sm" className="text-xs">
              Manage
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue={federalBills.length > 0 ? "federal" : "state"} className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-8 mb-3">
            <TabsTrigger value="federal" className="text-xs">
              Federal ({counts?.federalBills || 0})
            </TabsTrigger>
            <TabsTrigger value="state" className="text-xs">
              State ({counts?.stateBills || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="federal" className="mt-0 space-y-2">
            {federalBills.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No federal bills tracked
              </p>
            ) : (
              federalBills.slice(0, 3).map((bill) => (
                <div
                  key={bill.trackingId}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/bills/${bill.billId}`}
                        className="hover:underline"
                      >
                        <h4 className="font-medium text-sm line-clamp-2">
                          {bill.billType.toUpperCase()} {bill.billNumber}:{" "}
                          {bill.title}
                        </h4>
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        {bill.sponsor && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${getPartyColor(
                              bill.sponsor.party
                            )}`}
                          >
                            {bill.sponsor.lastName} ({bill.sponsor.party})
                          </Badge>
                        )}
                        {bill.latestActionDate && (
                          <span className="text-xs text-muted-foreground">
                            {formatDate(bill.latestActionDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0"
                      onClick={() => handleUntrackFederal(bill)}
                      disabled={untrackingId === bill.trackingId}
                    >
                      {untrackingId === bill.trackingId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <BookmarkX className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
            {federalBills.length > 3 && (
              <Link href="/settings?tab=tracked" className="block">
                <Button variant="ghost" className="w-full text-xs" size="sm">
                  View all {federalBills.length} federal bills
                </Button>
              </Link>
            )}
          </TabsContent>

          <TabsContent value="state" className="mt-0 space-y-2">
            {stateBills.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No state bills tracked
              </p>
            ) : (
              stateBills.slice(0, 3).map((bill) => (
                <div
                  key={bill.trackingId}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/state-bills/${encodeURIComponent(bill.billId)}`}
                        className="hover:underline"
                      >
                        <h4 className="font-medium text-sm line-clamp-2">
                          {bill.identifier}: {bill.title || "Untitled"}
                        </h4>
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {bill.stateName}
                        </Badge>
                        {bill.latestActionDate && (
                          <span className="text-xs text-muted-foreground">
                            {formatDate(bill.latestActionDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0"
                      onClick={() => handleUntrackState(bill)}
                      disabled={untrackingId === bill.trackingId}
                    >
                      {untrackingId === bill.trackingId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <BookmarkX className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
            {stateBills.length > 3 && (
              <Link href="/settings?tab=tracked" className="block">
                <Button variant="ghost" className="w-full text-xs" size="sm">
                  View all {stateBills.length} state bills
                </Button>
              </Link>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
