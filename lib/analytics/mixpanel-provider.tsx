'use client';

import mixpanel from 'mixpanel-browser';
import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// Track if Mixpanel is successfully initialized
let mixpanelInitialized = false;

// Initialize Mixpanel only on client side
if (typeof window !== 'undefined') {
  try {
    mixpanel.init('bf867f69e7d9ad9b9943925f7930492c', {
      debug: true,
      track_pageview: true,
      persistence: 'localStorage',
      autocapture: true,
      record_sessions_percent: 100,
      api_host: '/mp',  // Use Netlify proxy to avoid ad blockers
    });
    mixpanelInitialized = true;
  } catch (e) {
    console.debug('[Mixpanel] Analytics unavailable');
    mixpanelInitialized = false;
  }
}

// Component to capture pageviews with Next.js app router
function MixpanelPageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!mixpanelInitialized) return;

    if (pathname && typeof window !== 'undefined') {
      let url = window.origin + pathname;
      const search = searchParams?.toString();
      if (search) {
        url = url + '?' + search;
      }

      mixpanel.track('Page View', {
        page_url: url,
        page_title: document.title,
      });
    }
  }, [pathname, searchParams]);

  return null;
}

// Wrapper with Suspense for searchParams
export function MixpanelPageview() {
  return (
    <Suspense fallback={null}>
      <MixpanelPageviewTracker />
    </Suspense>
  );
}

// Main Mixpanel provider component
export function MixpanelProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Export mixpanel instance for direct usage
export { mixpanel };
