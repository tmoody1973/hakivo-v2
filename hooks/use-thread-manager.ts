"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export interface ThreadMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolResults?: Array<{
    toolName: string;
    result: Record<string, unknown>;
  }>;
}

export interface Thread {
  id: string;
  title: string;
  messages: ThreadMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UseThreadManagerOptions {
  userId?: string | null;
  onThreadChange?: (thread: Thread | null) => void;
}

const STORAGE_KEY_BASE = "hakivo_chat_sessions";
const CURRENT_SESSION_KEY_BASE = "hakivo_current_session";

const getStorageKey = (userId: string | null) =>
  userId ? `${STORAGE_KEY_BASE}_${userId}` : STORAGE_KEY_BASE;

const getCurrentSessionKey = (userId: string | null) =>
  userId ? `${CURRENT_SESSION_KEY_BASE}_${userId}` : CURRENT_SESSION_KEY_BASE;

const generateId = () =>
  `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const generateThreadId = () =>
  `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const generateTitle = (content: string): string => {
  const cleaned = content.replace(/\n/g, " ").trim();
  return cleaned.length > 50 ? cleaned.substring(0, 50) + "..." : cleaned;
};

/**
 * useThreadManager - Hook for managing individual thread state
 *
 * Handles the current active thread, message streaming, and persistence.
 */
export function useThreadManager(options: UseThreadManagerOptions = {}) {
  const { userId = null, onThreadChange } = options;

  const [currentThread, setCurrentThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const onThreadChangeRef = useRef(onThreadChange);

  // Keep callback ref up to date
  useEffect(() => {
    onThreadChangeRef.current = onThreadChange;
  }, [onThreadChange]);

  // Notify when thread changes
  useEffect(() => {
    onThreadChangeRef.current?.(currentThread);
  }, [currentThread]);

  // Create a new thread
  const createThread = useCallback(
    (firstMessage: string): Thread => {
      const newThread: Thread = {
        id: generateThreadId(),
        title: generateTitle(firstMessage),
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setCurrentThread(newThread);
      setMessages([]);
      return newThread;
    },
    []
  );

  // Load an existing thread
  const loadThread = useCallback((thread: Thread) => {
    setCurrentThread(thread);
    setMessages(thread.messages);
  }, []);

  // Clear current thread (start fresh)
  const clearThread = useCallback(() => {
    setCurrentThread(null);
    setMessages([]);

    // Clear from localStorage
    if (typeof window !== "undefined") {
      const currentSessionKey = getCurrentSessionKey(userId);
      localStorage.removeItem(currentSessionKey);
    }
  }, [userId]);

  // Add a user message
  const addUserMessage = useCallback(
    (content: string): ThreadMessage => {
      const userMessage: ThreadMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      // Auto-create thread if this is the first message
      let threadId = currentThread?.id;
      if (!threadId) {
        const newThread = createThread(content);
        threadId = newThread.id;
      }

      setMessages((prev) => [...prev, userMessage]);
      return userMessage;
    },
    [currentThread?.id, createThread]
  );

  // Add or update an assistant message (for streaming)
  const addAssistantMessage = useCallback(
    (
      id?: string,
      content?: string,
      toolResults?: ThreadMessage["toolResults"]
    ): string => {
      const messageId = id || generateId();

      setMessages((prev) => {
        const existingIndex = prev.findIndex((m) => m.id === messageId);

        if (existingIndex >= 0) {
          // Update existing message
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            content: content ?? updated[existingIndex].content,
            toolResults: toolResults ?? updated[existingIndex].toolResults,
          };
          return updated;
        }

        // Add new message
        return [
          ...prev,
          {
            id: messageId,
            role: "assistant" as const,
            content: content || "",
            timestamp: new Date(),
            toolResults,
          },
        ];
      });

      return messageId;
    },
    []
  );

  // Update thread with current messages
  const syncThread = useCallback(() => {
    if (!currentThread) return null;

    const updatedThread: Thread = {
      ...currentThread,
      messages,
      updatedAt: new Date(),
    };

    setCurrentThread(updatedThread);
    return updatedThread;
  }, [currentThread, messages]);

  // Get serializable messages for API calls
  const getMessagesForApi = useCallback(() => {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }, [messages]);

  // Regenerate last response (remove last assistant message)
  const removeLastAssistantMessage = useCallback(() => {
    setMessages((prev) => {
      // Find last assistant message index (compatible with older ES versions)
      let lastIndex = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === "assistant") {
          lastIndex = i;
          break;
        }
      }
      if (lastIndex >= 0) {
        return prev.slice(0, lastIndex);
      }
      return prev;
    });
  }, []);

  return {
    // State
    currentThread,
    messages,
    isLoading,
    setIsLoading,

    // Thread operations
    createThread,
    loadThread,
    clearThread,
    syncThread,

    // Message operations
    addUserMessage,
    addAssistantMessage,
    removeLastAssistantMessage,
    getMessagesForApi,

    // Direct setters for advanced use cases
    setCurrentThread,
    setMessages,
  };
}

export type ThreadManager = ReturnType<typeof useThreadManager>;
