'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { DailyBriefWidget } from "@/components/widgets/daily-brief-widget"
import { RepresentativesHorizontalWidget } from "@/components/widgets/representatives-horizontal-widget"
import { BillActionsWidget } from "@/components/widgets/bill-actions-widget"
import { PersonalizedContentWidget } from "@/components/widgets/personalized-content-widget"
import { getUserPreferences } from '@/lib/api/backend';

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, accessToken } = useAuth();
  const [userInterests, setUserInterests] = useState<string[]>([]);

  useEffect(() => {
    // Redirect to sign-in if not authenticated
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/signin');
    }
  }, [isAuthenticated, isLoading, router]);

  // Fetch user preferences to get policy interests
  useEffect(() => {
    const fetchPreferences = async () => {
      if (accessToken && isAuthenticated) {
        try {
          const response = await getUserPreferences(accessToken);
          if (response.success && response.data) {
            // Extract policy interests from preferences
            const preferences = response.data as any;
            if (preferences.policyInterests) {
              setUserInterests(preferences.policyInterests);
            }
          }
        } catch (error) {
          console.error('[Dashboard] Failed to fetch user preferences:', error);
        }
      }
    };

    fetchPreferences();
  }, [accessToken, isAuthenticated]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't render dashboard if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="py-6 px-4 md:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Good morning, {user?.firstName || 'there'}</h1>
        <p className="text-muted-foreground mt-1">Here's your civic engagement dashboard for today</p>
      </div>

      <div className="space-y-6">
        <RepresentativesHorizontalWidget />

        <DailyBriefWidget />

        <div className="grid gap-6 md:grid-cols-2">
          <BillActionsWidget />

          <PersonalizedContentWidget userInterests={userInterests} />
        </div>
      </div>
    </div>
  )
}
