/**
 * C1 Thread Service - Frontend wrapper for chat persistence
 * Communicates with the backend chat service to manage threads and messages
 */

// Use the Next.js API routes as proxy to the backend
const API_BASE = "/api/chat/c1";

export interface C1Thread {
  threadId: string;
  title: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface C1Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: Date;
}

/**
 * Get auth token from localStorage (matching auth-context.tsx storage keys)
 */
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  // Use the same key as auth-context.tsx
  return localStorage.getItem("hakivo_access_token");
}

/**
 * Create a new thread
 * Note: Backend will auto-create threads on first message if needed,
 * so local threads will still be persisted when messages are sent.
 */
export async function createThread(firstMessage: string): Promise<C1Thread> {
  const token = getAuthToken();
  const title = firstMessage.substring(0, 50) + (firstMessage.length > 50 ? "..." : "");

  console.log("[C1 Thread Service] Creating thread - token present:", !!token);

  try {
    const response = await fetch(`${API_BASE}/threads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ title }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log("[C1 Thread Service] Thread created:", data.threadId || data.id);
      return {
        threadId: data.threadId || data.id,
        title: data.title || data.name || title,
        createdAt: new Date(data.createdAt || Date.now()),
      };
    } else {
      console.warn("[C1 Thread Service] Thread creation failed:", response.status);
    }
  } catch (error) {
    console.warn("[C1 Thread Service] Backend unavailable:", error);
  }

  // Generate a local thread ID - backend will auto-create when first message is sent
  const localThreadId = crypto.randomUUID();
  console.log("[C1 Thread Service] Using local thread ID (will sync on first message):", localThreadId);

  return {
    threadId: localThreadId,
    title,
    createdAt: new Date(),
  };
}

/**
 * Get all threads for the current user
 */
export async function getThreadList(): Promise<C1Thread[]> {
  const token = getAuthToken();

  const response = await fetch(`${API_BASE}/threads`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      return []; // Not authenticated, return empty list
    }
    throw new Error("Failed to fetch threads");
  }

  const data = await response.json();
  const threads = data.threads || data || [];

  return threads.map((t: { id?: string; threadId?: string; title?: string; name?: string; createdAt?: string; updatedAt?: string }) => ({
    threadId: t.id || t.threadId,
    title: t.title || t.name || "Untitled",
    createdAt: new Date(t.createdAt || Date.now()),
    updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
  }));
}

/**
 * Get messages for a specific thread (UI format)
 */
export async function getUIThreadMessages(threadId: string): Promise<C1Message[]> {
  const token = getAuthToken();

  const response = await fetch(`${API_BASE}/threads/${threadId}/messages`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error("Failed to fetch messages");
  }

  const data = await response.json();
  const messages = data.messages || data || [];

  return messages
    .filter((m: { role: string }) => m.role !== "system")
    .map((m: { id?: string; messageId?: string; role: string; content: string; createdAt?: string }) => ({
      id: m.id || m.messageId || crypto.randomUUID(),
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
    }));
}

/**
 * Update a message in a thread
 */
export async function updateMessage(
  threadId: string,
  message: C1Message
): Promise<void> {
  const token = getAuthToken();

  await fetch(`${API_BASE}/threads/${threadId}/messages/${message.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      content: message.content,
    }),
  });
}

/**
 * Delete a thread
 */
export async function deleteThread(threadId: string): Promise<void> {
  const token = getAuthToken();

  const response = await fetch(`${API_BASE}/threads/${threadId}`, {
    method: "DELETE",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error("Failed to delete thread");
  }
}

/**
 * Update thread title
 */
export async function updateThread(params: {
  threadId: string;
  name: string;
}): Promise<void> {
  const token = getAuthToken();

  await fetch(`${API_BASE}/threads/${params.threadId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      title: params.name,
    }),
  });
}
