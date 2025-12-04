"use client";

import { useEffect, useState } from "react";
import { C1Chat, ThemeProvider } from "@thesysai/genui-sdk";
import "@crayonai/react-ui/styles/index.css";
import { useAuth } from "@/lib/auth/auth-context";


const C1_USER_KEY = "hakivo_c1_user_id";

/**
 * Chat Page using thesys C1 Generative UI
 *
 * Uses the C1Chat component from the SDK which automatically:
 * - Renders generative UI components (cards, charts, tables)
 * - Handles streaming responses
 * - Manages conversation history
 * - Provides interactive UI elements
 *
 * User-aware: Clears chat history when user changes to prevent
 * data leakage between different users on the same device.
 */
export const ChatPageClient = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);

  // Check user identity and clear C1 data if user changed
  useEffect(() => {
    if (isLoading) return;

    const currentUserId = user?.id || "anonymous";
    const storedUserId = localStorage.getItem(C1_USER_KEY);

    console.log("[Chat] Current user:", currentUserId, "Stored user:", storedUserId);

    // If user is different from stored user, clear all C1 data
    if (storedUserId && storedUserId !== currentUserId) {
      console.log("[Chat] User changed from", storedUserId, "to", currentUserId, "- clearing C1 data");
      clearC1ChatData();
    }

    // Store current user ID for next comparison
    localStorage.setItem(C1_USER_KEY, currentUserId);

    // Mark as ready to render C1Chat
    setIsReady(true);
  }, [user?.id, isLoading]);

  // Also clear on logout (when isAuthenticated becomes false)
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      console.log("[Chat] User logged out, clearing C1 chat history");
      clearC1ChatData();
      localStorage.removeItem(C1_USER_KEY);
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading || !isReady) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Use user.id as key to force remount when user changes
  // This ensures C1Chat starts fresh for each user
  const chatKey = user?.id || "anonymous";

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full h-full">
      <ThemeProvider>
        <C1Chat
          key={chatKey}
          apiUrl="/api/chat/c1"
          disableThemeProvider
        />
      </ThemeProvider>
    </div>
  );
};

/**
 * Clear all C1 SDK localStorage data
 * The C1 SDK stores threads and messages in localStorage
 */
function clearC1ChatData() {
  if (typeof window === "undefined") return;

  // Find and remove all C1-related localStorage keys
  // Match known patterns and be more aggressive to catch all SDK storage
  const keysToRemove: string[] = [];
  const preservePatterns = ["hakivo_"]; // Our auth keys to preserve

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    // Skip our auth/app keys
    if (preservePatterns.some(pattern => key.startsWith(pattern))) {
      continue;
    }

    // Remove C1 SDK related keys
    if (
      key.includes("c1") ||
      key.includes("C1") ||
      key.includes("thread") ||
      key.includes("Thread") ||
      key.includes("crayon") ||
      key.includes("Crayon") ||
      key.includes("genui") ||
      key.includes("message") ||
      key.includes("Message") ||
      key.includes("chat") ||
      key.includes("Chat")
    ) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => {
    console.log("[Chat] Removing localStorage key:", key);
    localStorage.removeItem(key);
  });

  console.log(`[Chat] Cleared ${keysToRemove.length} C1 localStorage keys`);
}
