"use client";

import { useState, useCallback, useEffect } from "react";

// Types for tracked items
export interface TrackedFederalBill {
  type: "federal_bill";
  trackingId: string;
  billId: string;
  trackedAt: number;
  notificationsEnabled: boolean;
  congress: number;
  billType: string;
  billNumber: number;
  title: string;
  policyArea?: string;
  latestActionDate?: string;
  latestActionText?: string;
  sponsor?: {
    firstName: string;
    lastName: string;
    party: string;
    state: string;
  } | null;
}

export interface TrackedStateBill {
  type: "state_bill";
  trackingId: string;
  billId: string;
  state: string;
  stateName: string;
  identifier: string;
  trackedAt: number;
  notificationsEnabled: boolean;
  title?: string;
  session?: string;
  subjects?: string[];
  chamber?: string;
  latestActionDate?: string;
  latestActionDescription?: string;
}

export interface BookmarkedArticle {
  type: "article";
  bookmarkId: string;
  articleUrl: string;
  title: string;
  summary?: string;
  imageUrl?: string;
  interest: string;
  savedAt: number;
}

export interface TrackedItems {
  federalBills: TrackedFederalBill[];
  stateBills: TrackedStateBill[];
  bookmarkedArticles: BookmarkedArticle[];
}

export interface TrackingCounts {
  federalBills: number;
  stateBills: number;
  bookmarkedArticles: number;
  total: number;
}

interface UseTrackingOptions {
  token?: string | null;
}

interface UseTrackingReturn {
  // State
  trackedItems: TrackedItems | null;
  counts: TrackingCounts | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchTrackedItems: () => Promise<void>;
  trackFederalBill: (
    billId: string,
    congress: number,
    billType: string,
    billNumber: number
  ) => Promise<boolean>;
  untrackFederalBill: (billId: string, trackingId: string) => Promise<boolean>;
  trackStateBill: (
    billId: string,
    state: string,
    identifier: string
  ) => Promise<boolean>;
  untrackStateBill: (billId: string, trackingId: string) => Promise<boolean>;

  // Helpers
  isFederalBillTracked: (billId: string) => boolean;
  isStateBillTracked: (billId: string) => boolean;
  getTrackingId: (billId: string) => string | null;
}

/**
 * useTracking Hook
 *
 * Manages bill tracking state, provides track/untrack functions,
 * and syncs with the backend API.
 *
 * @param options - Hook configuration options
 * @returns Tracking state and actions
 */
export function useTracking(options: UseTrackingOptions = {}): UseTrackingReturn {
  const { token } = options;

  const [trackedItems, setTrackedItems] = useState<TrackedItems | null>(null);
  const [counts, setCounts] = useState<TrackingCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all tracked items
  const fetchTrackedItems = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/tracked", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch tracked items");
      }

      const data = await response.json();
      if (data.success) {
        setTrackedItems(data.tracked);
        setCounts(data.counts);
      } else {
        throw new Error(data.error || "Failed to fetch tracked items");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Track a federal bill
  const trackFederalBill = useCallback(
    async (
      billId: string,
      congress: number,
      billType: string,
      billNumber: number
    ): Promise<boolean> => {
      if (!token) return false;

      try {
        const response = await fetch(`/api/bills/${billId}/track`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ congress, billType, billNumber }),
        });

        if (!response.ok) {
          throw new Error("Failed to track bill");
        }

        const data = await response.json();
        if (data.success) {
          // Optimistic update - refetch to get full data
          await fetchTrackedItems();
          return true;
        }
        return false;
      } catch (err) {
        console.error("Track federal bill error:", err);
        return false;
      }
    },
    [token, fetchTrackedItems]
  );

  // Untrack a federal bill
  const untrackFederalBill = useCallback(
    async (billId: string, trackingId: string): Promise<boolean> => {
      if (!token) return false;

      try {
        const response = await fetch(
          `/api/bills/${billId}/track?trackingId=${trackingId}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to untrack bill");
        }

        const data = await response.json();
        if (data.success) {
          // Optimistic update
          setTrackedItems((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              federalBills: prev.federalBills.filter(
                (b) => b.trackingId !== trackingId
              ),
            };
          });
          setCounts((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              federalBills: prev.federalBills - 1,
              total: prev.total - 1,
            };
          });
          return true;
        }
        return false;
      } catch (err) {
        console.error("Untrack federal bill error:", err);
        return false;
      }
    },
    [token]
  );

  // Track a state bill
  const trackStateBill = useCallback(
    async (
      billId: string,
      state: string,
      identifier: string
    ): Promise<boolean> => {
      if (!token) return false;

      try {
        const encodedBillId = encodeURIComponent(billId);
        const response = await fetch(`/api/state-bills/${encodedBillId}/track`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ state, identifier }),
        });

        if (!response.ok) {
          throw new Error("Failed to track state bill");
        }

        const data = await response.json();
        if (data.success) {
          // Optimistic update - refetch to get full data
          await fetchTrackedItems();
          return true;
        }
        return false;
      } catch (err) {
        console.error("Track state bill error:", err);
        return false;
      }
    },
    [token, fetchTrackedItems]
  );

  // Untrack a state bill
  const untrackStateBill = useCallback(
    async (billId: string, trackingId: string): Promise<boolean> => {
      if (!token) return false;

      try {
        const encodedBillId = encodeURIComponent(billId);
        const response = await fetch(
          `/api/state-bills/${encodedBillId}/track?trackingId=${trackingId}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to untrack state bill");
        }

        const data = await response.json();
        if (data.success) {
          // Optimistic update
          setTrackedItems((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              stateBills: prev.stateBills.filter(
                (b) => b.trackingId !== trackingId
              ),
            };
          });
          setCounts((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              stateBills: prev.stateBills - 1,
              total: prev.total - 1,
            };
          });
          return true;
        }
        return false;
      } catch (err) {
        console.error("Untrack state bill error:", err);
        return false;
      }
    },
    [token]
  );

  // Check if a federal bill is tracked
  const isFederalBillTracked = useCallback(
    (billId: string): boolean => {
      if (!trackedItems) return false;
      return trackedItems.federalBills.some((b) => b.billId === billId);
    },
    [trackedItems]
  );

  // Check if a state bill is tracked
  const isStateBillTracked = useCallback(
    (billId: string): boolean => {
      if (!trackedItems) return false;
      return trackedItems.stateBills.some((b) => b.billId === billId);
    },
    [trackedItems]
  );

  // Get the tracking ID for a bill (works for both federal and state)
  const getTrackingId = useCallback(
    (billId: string): string | null => {
      if (!trackedItems) return null;

      // Check federal bills
      const federalBill = trackedItems.federalBills.find(
        (b) => b.billId === billId
      );
      if (federalBill) return federalBill.trackingId;

      // Check state bills
      const stateBill = trackedItems.stateBills.find((b) => b.billId === billId);
      if (stateBill) return stateBill.trackingId;

      return null;
    },
    [trackedItems]
  );

  // Auto-fetch on token change
  useEffect(() => {
    if (token) {
      fetchTrackedItems();
    }
  }, [token, fetchTrackedItems]);

  return {
    trackedItems,
    counts,
    loading,
    error,
    fetchTrackedItems,
    trackFederalBill,
    untrackFederalBill,
    trackStateBill,
    untrackStateBill,
    isFederalBillTracked,
    isStateBillTracked,
    getTrackingId,
  };
}
