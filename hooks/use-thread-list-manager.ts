"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { Thread, ThreadMessage } from "./use-thread-manager";

export interface ThreadGroup {
  label: string;
  threads: Thread[];
}

export interface UseThreadListManagerOptions {
  userId?: string | null;
  autoSave?: boolean;
}

const STORAGE_KEY_BASE = "hakivo_chat_sessions";
const CURRENT_SESSION_KEY_BASE = "hakivo_current_session";

const getStorageKey = (userId: string | null) =>
  userId ? `${STORAGE_KEY_BASE}_${userId}` : STORAGE_KEY_BASE;

const getCurrentSessionKey = (userId: string | null) =>
  userId ? `${CURRENT_SESSION_KEY_BASE}_${userId}` : CURRENT_SESSION_KEY_BASE;

/**
 * Load threads from localStorage
 */
function loadThreadsFromStorage(userId: string | null): Thread[] {
  if (typeof window === "undefined") return [];
  try {
    const storageKey = getStorageKey(userId);
    const stored = localStorage.getItem(storageKey);
    if (!stored) return [];
    const sessions = JSON.parse(stored);
    return sessions.map((s: Thread) => ({
      ...s,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt),
      messages: s.messages.map((m: ThreadMessage) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
    }));
  } catch {
    return [];
  }
}

/**
 * Save threads to localStorage
 */
function saveThreadsToStorage(threads: Thread[], userId: string | null) {
  if (typeof window === "undefined") return;
  const storageKey = getStorageKey(userId);
  localStorage.setItem(storageKey, JSON.stringify(threads));
}

/**
 * Group threads by date for display
 */
function groupThreadsByDate(threads: Thread[]): ThreadGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const groups: ThreadGroup[] = [
    { label: "Today", threads: [] },
    { label: "Yesterday", threads: [] },
    { label: "Previous 7 Days", threads: [] },
    { label: "Older", threads: [] },
  ];

  threads.forEach((thread) => {
    const threadDate = new Date(thread.updatedAt);
    if (threadDate >= today) {
      groups[0].threads.push(thread);
    } else if (threadDate >= yesterday) {
      groups[1].threads.push(thread);
    } else if (threadDate >= weekAgo) {
      groups[2].threads.push(thread);
    } else {
      groups[3].threads.push(thread);
    }
  });

  return groups.filter((g) => g.threads.length > 0);
}

/**
 * useThreadListManager - Hook for managing the list of conversation threads
 *
 * Handles loading, saving, filtering, and organizing threads.
 */
export function useThreadListManager(
  options: UseThreadListManagerOptions = {}
) {
  const { userId = null, autoSave = true } = options;

  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load threads on mount
  useEffect(() => {
    const loaded = loadThreadsFromStorage(userId);
    setThreads(loaded);

    // Restore current thread ID
    if (typeof window !== "undefined") {
      const currentSessionKey = getCurrentSessionKey(userId);
      const savedId = localStorage.getItem(currentSessionKey);
      if (savedId && loaded.find((t) => t.id === savedId)) {
        setCurrentThreadId(savedId);
      }
    }

    setIsLoaded(true);
  }, [userId]);

  // Auto-save threads when they change
  useEffect(() => {
    if (autoSave && isLoaded && threads.length > 0) {
      saveThreadsToStorage(threads, userId);
    }
  }, [threads, userId, autoSave, isLoaded]);

  // Save current thread ID
  useEffect(() => {
    if (currentThreadId && typeof window !== "undefined") {
      const currentSessionKey = getCurrentSessionKey(userId);
      localStorage.setItem(currentSessionKey, currentThreadId);
    }
  }, [currentThreadId, userId]);

  // Get current thread
  const currentThread = useMemo(
    () => threads.find((t) => t.id === currentThreadId) || null,
    [threads, currentThreadId]
  );

  // Filter threads by search query
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const query = searchQuery.toLowerCase();
    return threads.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        t.messages.some((m) => m.content.toLowerCase().includes(query))
    );
  }, [threads, searchQuery]);

  // Group filtered threads by date
  const groupedThreads = useMemo(
    () => groupThreadsByDate(filteredThreads),
    [filteredThreads]
  );

  // Add or update a thread
  const upsertThread = useCallback((thread: Thread) => {
    setThreads((prev) => {
      const existingIndex = prev.findIndex((t) => t.id === thread.id);
      if (existingIndex >= 0) {
        // Update existing
        const updated = [...prev];
        updated[existingIndex] = thread;
        // Sort by updatedAt (most recent first)
        return updated.sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
        );
      }
      // Add new (at the beginning)
      return [thread, ...prev];
    });
  }, []);

  // Delete a thread
  const deleteThread = useCallback(
    (threadId: string) => {
      setThreads((prev) => prev.filter((t) => t.id !== threadId));

      if (currentThreadId === threadId) {
        setCurrentThreadId(null);
        if (typeof window !== "undefined") {
          const currentSessionKey = getCurrentSessionKey(userId);
          localStorage.removeItem(currentSessionKey);
        }
      }
    },
    [currentThreadId, userId]
  );

  // Select a thread
  const selectThread = useCallback((threadId: string | null) => {
    setCurrentThreadId(threadId);
  }, []);

  // Get a thread by ID
  const getThread = useCallback(
    (threadId: string): Thread | null => {
      return threads.find((t) => t.id === threadId) || null;
    },
    [threads]
  );

  // Clear all threads
  const clearAllThreads = useCallback(() => {
    setThreads([]);
    setCurrentThreadId(null);
    if (typeof window !== "undefined") {
      const storageKey = getStorageKey(userId);
      const currentSessionKey = getCurrentSessionKey(userId);
      localStorage.removeItem(storageKey);
      localStorage.removeItem(currentSessionKey);
    }
  }, [userId]);

  return {
    // State
    threads,
    filteredThreads,
    groupedThreads,
    currentThread,
    currentThreadId,
    searchQuery,
    isLoaded,

    // Actions
    upsertThread,
    deleteThread,
    selectThread,
    getThread,
    clearAllThreads,
    setSearchQuery,
    setCurrentThreadId,
  };
}

export type ThreadListManager = ReturnType<typeof useThreadListManager>;
