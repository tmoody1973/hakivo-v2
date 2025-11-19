'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { DailyBriefWidget } from "@/components/widgets/daily-brief-widget"
import { RepresentativesHorizontalWidget } from "@/components/widgets/representatives-horizontal-widget"
import { BillActionsWidget } from "@/components/widgets/bill-actions-widget"
import { PersonalizedNewsWidget } from "@/components/widgets/personalized-news-widget"

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    // Redirect to sign-in if not authenticated
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/signin');
    }
  }, [isAuthenticated, isLoading, router]);

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

          <PersonalizedNewsWidget />
        </div>
      </div>
    </div>
  )
}
