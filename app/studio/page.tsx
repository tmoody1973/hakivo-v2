'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Dynamic import with SSR disabled to avoid DOMMatrix error during prerendering
const StudioContent = dynamic(() => import('./StudioContent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  ),
});

export default function StudioPage() {
  return <StudioContent />;
}
