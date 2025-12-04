"use client";

import { useEffect, useRef } from "react";
import { C1Chat } from "@thesysai/genui-sdk";
import "@crayonai/react-ui/styles/index.css";
import { useAuth } from "@/lib/auth/auth-context";

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
  const prevUserIdRef = useRef<string | null>(null);

  // Clear C1 localStorage when user changes
  useEffect(() => {
    if (isLoading) return;

    const currentUserId = user?.id || null;
    const prevUserId = prevUserIdRef.current;

    // If user changed (including logout/login), clear C1 chat data
    if (prevUserId !== null && prevUserId !== currentUserId) {
      console.log("[Chat] User changed, clearing C1 chat history");
      clearC1ChatData();
    }

    prevUserIdRef.current = currentUserId;
  }, [user?.id, isLoading]);

  // Clear C1 chat data on logout
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      console.log("[Chat] User logged out, clearing C1 chat history");
      clearC1ChatData();
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
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
    <div className="min-h-[calc(100vh-4rem)]">
      <C1Chat
        key={chatKey}
        apiUrl="/api/chat/c1"
        agentName="Congressional Assistant"
        formFactor="full-page"
      />
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
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.includes("c1-") ||
      key.includes("thread") ||
      key.includes("crayon") ||
      key.includes("genui")
    )) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => {
    console.log("[Chat] Removing localStorage key:", key);
    localStorage.removeItem(key);
  });

  console.log(`[Chat] Cleared ${keysToRemove.length} C1 localStorage keys`);
}
