"use client";

import { useEffect, useState } from "react";

/**
 * useOnline Hook
 *
 * Detects online/offline status and provides real-time updates.
 * Useful for showing offline indicators and preventing API calls when offline.
 *
 * @returns boolean - true if online, false if offline
 */
export function useOnline(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);

    // Event listeners for online/offline
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
