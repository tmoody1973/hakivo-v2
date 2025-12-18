'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// Track if PostHog is successfully initialized
let posthogInitialized = false;

// TEMPORARILY DISABLED: PostHog was causing "TypeError: network error" and 400 Bad Request errors
// The /ingest proxy wasn't working correctly with Netlify rewrites
// TODO: Re-enable after fixing the proxy configuration or switching to direct PostHog connection
const POSTHOG_DISABLED = true;

// Initialize PostHog only on client side (when not disabled)
if (!POSTHOG_DISABLED && typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  try {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: 'https://us.i.posthog.com',
      ui_host: 'https://us.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: false,
      autocapture: false,
      disable_session_recording: true,
      advanced_disable_feature_flags: true,
      advanced_disable_decide: true,
    });
    posthogInitialized = true;
  } catch (e) {
    console.debug('[PostHog] Analytics unavailable');
    posthogInitialized = false;
  }
}

// Component to capture pageviews with Next.js app router
function PostHogPageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Skip if PostHog is disabled
    if (POSTHOG_DISABLED || !posthogInitialized) return;

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
  // Skip rendering entirely if PostHog is disabled
  if (POSTHOG_DISABLED) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <PostHogPageviewTracker />
    </Suspense>
  );
}

// Main PostHog provider component
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // Skip provider if PostHog is disabled - just render children
  if (POSTHOG_DISABLED) {
    return <>{children}</>;
  }

  // Only wrap with provider if PostHog is initialized
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

// Export posthog instance for direct usage (will be a no-op if disabled)
export { posthog };
