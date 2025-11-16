"use client";

import { FC } from "react";
import { WifiOff } from "lucide-react";
import { useOnline } from "@/lib/hooks/use-online";

/**
 * OfflineBanner Component
 *
 * Displays a banner at the top of the page when the user is offline.
 * Automatically appears/disappears based on network status.
 */
export const OfflineBanner: FC = () => {
  const isOnline = useOnline();

  if (isOnline) return null;

  return (
    <div className="bg-destructive text-destructive-foreground px-4 py-3 text-center flex items-center justify-center gap-2">
      <WifiOff className="h-4 w-4" />
      <span className="text-sm font-medium">
        You're currently offline. Some features may be unavailable.
      </span>
    </div>
  );
};
