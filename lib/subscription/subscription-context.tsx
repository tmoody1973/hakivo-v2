'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/lib/auth/auth-context';

// Subscription status types
export type SubscriptionStatus = 'free' | 'active' | 'canceled' | 'past_due';

// Usage item type
export interface UsageItem {
  used: number | string;
  limit: number | string;
  remaining: number | string;
  canUseMore?: boolean;
  resetAt?: string | null;
}

// Subscription state type
export interface SubscriptionState {
  status: SubscriptionStatus;
  isPro: boolean;
  stripeCustomerId: string | null;
  startedAt: string | null;
  endsAt: string | null;
}

// Usage state type
export interface UsageState {
  briefs: UsageItem;
  artifacts: UsageItem;
  trackedBills: UsageItem & { count: number };
  followedMembers: UsageItem & { count: number };
}

// Features state type
export interface FeaturesState {
  dailyBriefing: boolean;
  realtimeAlerts: boolean;
  audioDigests: boolean;
  unlimitedBriefs: boolean;
  unlimitedTracking: boolean;
  unlimitedArtifacts: boolean;
}

// Full subscription context state
export interface SubscriptionContextState {
  subscription: SubscriptionState;
  usage: UsageState;
  features: FeaturesState;
  isLoading: boolean;
  error: string | null;
}

// Context actions
export interface SubscriptionContextType extends SubscriptionContextState {
  refreshSubscription: () => Promise<void>;
  checkLimit: (action: 'track_bill' | 'follow_member' | 'generate_brief' | 'generate_artifact') => Promise<{
    allowed: boolean;
    reason: string | null;
    currentCount?: number;
    limit?: number;
  }>;
  openCheckout: () => Promise<void>;
  openBillingPortal: () => Promise<void>;
  getUsagePercentage: (item: 'briefs' | 'artifacts' | 'trackedBills' | 'followedMembers') => number;
  hasUsageAlerts: boolean;
  usageAlerts: UsageAlert[];
}

// Usage alert type
export interface UsageAlert {
  id: string;
  type: 'warning' | 'limit_reached';
  category: 'briefs' | 'artifacts' | 'trackedBills' | 'followedMembers';
  message: string;
  action?: string;
}

// Create context
const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Default state
const defaultSubscriptionState: SubscriptionState = {
  status: 'free',
  isPro: false,
  stripeCustomerId: null,
  startedAt: null,
  endsAt: null,
};

const defaultUsageState: UsageState = {
  briefs: { used: 0, limit: 3, remaining: 3, resetAt: null },
  artifacts: { used: 0, limit: 3, remaining: 3, canUseMore: true },
  trackedBills: { used: 0, limit: 3, remaining: 3, count: 0, canUseMore: true },
  followedMembers: { used: 0, limit: 3, remaining: 3, count: 0, canUseMore: true },
};

const defaultFeaturesState: FeaturesState = {
  dailyBriefing: false,
  realtimeAlerts: false,
  audioDigests: false,
  unlimitedBriefs: false,
  unlimitedTracking: false,
  unlimitedArtifacts: false,
};

// Provider component
export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, accessToken, isAuthenticated } = useAuth();

  const [state, setState] = useState<SubscriptionContextState>({
    subscription: defaultSubscriptionState,
    usage: defaultUsageState,
    features: defaultFeaturesState,
    isLoading: true,
    error: null,
  });

  // Fetch subscription status from API
  const refreshSubscription = useCallback(async () => {
    if (!user?.id || !accessToken) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/subscription/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscription status');
      }

      const data = await response.json();

      setState({
        subscription: {
          status: data.subscription?.status || 'free',
          isPro: data.subscription?.isPro || false,
          stripeCustomerId: data.subscription?.stripeCustomerId || null,
          startedAt: data.subscription?.startedAt || null,
          endsAt: data.subscription?.endsAt || null,
        },
        usage: {
          briefs: {
            used: data.usage?.briefs?.used || 0,
            limit: data.usage?.briefs?.limit || 3,
            remaining: data.usage?.briefs?.remaining || 3,
            resetAt: data.usage?.briefs?.resetAt || null,
          },
          artifacts: {
            used: data.usage?.artifacts?.used || 0,
            limit: data.usage?.artifacts?.limit || 3,
            remaining: data.usage?.artifacts?.remaining || 3,
            canUseMore: data.usage?.artifacts?.canCreateMore ?? true,
          },
          trackedBills: {
            used: data.usage?.trackedBills?.count || 0,
            limit: data.usage?.trackedBills?.limit || 3,
            remaining: typeof data.usage?.trackedBills?.limit === 'number'
              ? data.usage.trackedBills.limit - (data.usage?.trackedBills?.count || 0)
              : 'unlimited',
            count: data.usage?.trackedBills?.count || 0,
            canUseMore: data.usage?.trackedBills?.canTrackMore ?? true,
          },
          followedMembers: {
            used: data.usage?.followedMembers?.count || 0,
            limit: data.usage?.followedMembers?.limit || 3,
            remaining: typeof data.usage?.followedMembers?.limit === 'number'
              ? data.usage.followedMembers.limit - (data.usage?.followedMembers?.count || 0)
              : 'unlimited',
            count: data.usage?.followedMembers?.count || 0,
            canUseMore: data.usage?.followedMembers?.canFollowMore ?? true,
          },
        },
        features: {
          dailyBriefing: data.features?.dailyBriefing || false,
          realtimeAlerts: data.features?.realtimeAlerts || false,
          audioDigests: data.features?.audioDigests || false,
          unlimitedBriefs: data.features?.unlimitedBriefs || false,
          unlimitedTracking: data.features?.unlimitedTracking || false,
          unlimitedArtifacts: data.features?.unlimitedArtifacts || false,
        },
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('[Subscription] Error fetching status:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load subscription',
      }));
    }
  }, [user?.id, accessToken]);

  // Check if action is allowed
  const checkLimit = useCallback(async (
    action: 'track_bill' | 'follow_member' | 'generate_brief' | 'generate_artifact'
  ) => {
    if (!user?.id || !accessToken) {
      return { allowed: false, reason: 'Not authenticated' };
    }

    // Pro users can do everything
    if (state.subscription.isPro) {
      return { allowed: true, reason: null };
    }

    try {
      const response = await fetch(`/api/subscription/check-limit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          allowed: false,
          reason: data.reason || 'Limit reached',
          currentCount: data.currentCount,
          limit: data.limit,
        };
      }

      return {
        allowed: data.allowed,
        reason: data.reason,
        currentCount: data.currentCount,
        limit: data.limit,
      };
    } catch (error) {
      console.error('[Subscription] Error checking limit:', error);
      return { allowed: true, reason: null }; // Default to allowing on error
    }
  }, [user?.id, accessToken, state.subscription.isPro]);

  // Open Stripe checkout
  const openCheckout = useCallback(async () => {
    if (!user?.id || !accessToken) {
      console.error('[Subscription] Cannot open checkout: not authenticated');
      return;
    }

    try {
      const response = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userId: user.id,
          successUrl: `${window.location.origin}/settings?tab=subscription&upgrade=success`,
          cancelUrl: `${window.location.origin}/settings?tab=subscription&upgrade=canceled`,
        }),
      });

      const data = await response.json();

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        console.error('[Subscription] No checkout URL returned:', data);
      }
    } catch (error) {
      console.error('[Subscription] Error creating checkout:', error);
    }
  }, [user?.id, accessToken]);

  // Open Stripe billing portal
  const openBillingPortal = useCallback(async () => {
    if (!user?.id || !accessToken) {
      console.error('[Subscription] Cannot open portal: not authenticated');
      return;
    }

    try {
      const response = await fetch('/api/subscription/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userId: user.id,
          returnUrl: `${window.location.origin}/settings?tab=subscription`,
        }),
      });

      const data = await response.json();

      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      } else {
        console.error('[Subscription] No portal URL returned:', data);
      }
    } catch (error) {
      console.error('[Subscription] Error creating portal session:', error);
    }
  }, [user?.id, accessToken]);

  // Calculate usage percentage for progress bars
  const getUsagePercentage = useCallback((item: 'briefs' | 'artifacts' | 'trackedBills' | 'followedMembers'): number => {
    const usage = state.usage[item];

    if (typeof usage.limit === 'string' && usage.limit === 'unlimited') {
      return 0; // Pro users show empty bar
    }

    const used = typeof usage.used === 'number' ? usage.used : 0;
    const limit = typeof usage.limit === 'number' ? usage.limit : 3;

    return Math.min(100, Math.round((used / limit) * 100));
  }, [state.usage]);

  // Generate usage alerts for free users
  const usageAlerts = React.useMemo((): UsageAlert[] => {
    if (state.subscription.isPro) return [];

    const alerts: UsageAlert[] = [];

    // Check each usage category
    const categories: Array<{
      key: 'briefs' | 'artifacts' | 'trackedBills' | 'followedMembers';
      label: string;
    }> = [
      { key: 'briefs', label: 'briefs' },
      { key: 'artifacts', label: 'documents' },
      { key: 'trackedBills', label: 'tracked bills' },
      { key: 'followedMembers', label: 'followed members' },
    ];

    for (const { key, label } of categories) {
      const usage = state.usage[key];
      const used = typeof usage.used === 'number' ? usage.used : 0;
      const limit = typeof usage.limit === 'number' ? usage.limit : 3;
      const percentage = (used / limit) * 100;

      if (percentage >= 100) {
        alerts.push({
          id: `${key}-limit`,
          type: 'limit_reached',
          category: key,
          message: `You've used all ${limit} ${label}. Upgrade for unlimited.`,
          action: 'Upgrade to Pro',
        });
      } else if (percentage >= 67) {
        alerts.push({
          id: `${key}-warning`,
          type: 'warning',
          category: key,
          message: `${used}/${limit} ${label} used. ${limit - used} remaining.`,
          action: 'Upgrade for unlimited',
        });
      }
    }

    return alerts;
  }, [state.usage, state.subscription.isPro]);

  // Load subscription on mount and when auth changes
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      refreshSubscription();
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [isAuthenticated, user?.id, refreshSubscription]);

  const contextValue: SubscriptionContextType = {
    ...state,
    refreshSubscription,
    checkLimit,
    openCheckout,
    openBillingPortal,
    getUsagePercentage,
    hasUsageAlerts: usageAlerts.length > 0,
    usageAlerts,
  };

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// useSubscription hook
export function useSubscription(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
