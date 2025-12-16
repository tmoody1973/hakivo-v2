'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// Initialize PostHog only on client side
// Uses /ingest proxy (configured in next.config.ts) to avoid ad blockers
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  try {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      // Use our own domain proxy to avoid ad blockers
      api_host: '/ingest',
      ui_host: 'https://us.posthog.com', // For toolbar/session recording UI
      person_profiles: 'identified_only',
      capture_pageview: false, // We capture manually for Next.js app router
      capture_pageleave: true,
      autocapture: true,
    });
  } catch (e) {
    // PostHog blocked or network issue - fail silently
    console.debug('[PostHog] Analytics unavailable');
  }
}

// Component to capture pageviews with Next.js app router
function PostHogPageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && typeof window !== 'undefined') {
      let url = window.origin + pathname;
      const search = searchParams?.toString();
      if (search) {
        url = url + '?' + search;
      }
      posthog.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams]);

  return null;
}

// Wrapper with Suspense for searchParams
export function PostHogPageview() {
  return (
    <Suspense fallback={null}>
      <PostHogPageviewTracker />
    </Suspense>
  );
}

// Main PostHog provider component
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // Only wrap with provider if PostHog is initialized
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

// Export posthog instance for direct usage
export { posthog };
