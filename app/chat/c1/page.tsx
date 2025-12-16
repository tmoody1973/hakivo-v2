"use client";

import {
  C1Chat,
  ThemeProvider,
  useThreadListManager,
  useThreadManager,
  Message,
} from "@thesysai/genui-sdk";

// Define Thread type locally since SDK doesn't export it
type Thread = {
  threadId: string;
  title: string;
  createdAt: Date;
};
import "@crayonai/react-ui/styles/index.css";
import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { hakivoLightTheme, hakivoDarkTheme } from "@/lib/c1-theme";
import {
  createThread,
  getThreadList,
  getUIThreadMessages,
  updateMessage,
  deleteThread,
  updateThread,
  C1Thread,
} from "@/lib/services/c1-thread-service";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "sonner";

/**
 * C1 Chat Page - Uses Thesys C1 for generative UI with tool calling
 *
 * This page uses the C1Chat component with persistence hooks for:
 * - Thread management (create, switch, delete threads)
 * - Message persistence across sessions
 * - Tool calling (searchNews, searchBills, searchMembers, searchImages)
 * - Report/Artifact generation with rich UI components
 * - Related queries suggestions
 * - Streaming responses
 */

function C1ChatContent() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/signin");
    }
  }, [isAuthenticated, authLoading, router]);

  // Prevent hydration mismatch by only rendering on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Thread list manager for sidebar and thread switching
  const threadListManager = useThreadListManager({
    fetchThreadList: useCallback(async (): Promise<Thread[]> => {
      console.log("[C1 Page] Fetching thread list...");
      const threads = await getThreadList();
      console.log("[C1 Page] Fetched threads:", threads.length, threads.map(t => ({ id: t.threadId, title: t.title })));
      return threads.map((t: C1Thread) => ({
        threadId: t.threadId,
        title: t.title,
        createdAt: t.createdAt,
      }));
    }, []),
    deleteThread: useCallback((threadId: string) => deleteThread(threadId), []),
    updateThread: useCallback(
      async (t: Thread): Promise<Thread> => {
        await updateThread({ threadId: t.threadId, name: t.title });
        return t;
      },
      []
    ),
    onSwitchToNew: useCallback(() => {
      router.replace(pathname);
    }, [router, pathname]),
    onSelectThread: useCallback(
      (threadId: string) => {
        console.log("[C1 Page] onSelectThread called with:", threadId);
        router.replace(`${pathname}?threadId=${threadId}`);
      },
      [router, pathname]
    ),
    createThread: useCallback(
      async (message: { message?: string }): Promise<Thread> => {
        const thread = await createThread(message.message || "New conversation");
        return {
          threadId: thread.threadId,
          title: thread.title,
          createdAt: thread.createdAt,
        };
      },
      []
    ),
  });

  // Custom processMessage to include auth headers in chat API requests
  // IMPORTANT: This must be passed to useThreadManager, NOT C1Chat directly
  const processMessage = useCallback(
    async (params: {
      threadId: string;
      messages: Message[];
      responseId: string;
      abortController: AbortController;
    }): Promise<Response> => {
      const token = localStorage.getItem("hakivo_access_token");
      console.log("[C1 Page] processMessage called - token present:", !!token);

      // Backend expects 'prompt' (single message), not 'messages' (array)
      // Get the last user message as the prompt
      const lastMessage = params.messages[params.messages.length - 1];

      return fetch("/api/chat/c1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          threadId: params.threadId,
          prompt: lastMessage, // Backend expects 'prompt' not 'messages'
          responseId: params.responseId,
        }),
        signal: params.abortController.signal,
      });
    },
    []
  );

  // Thread manager for message handling within a thread
  // processMessage is passed HERE to override the default apiUrl-based fetch
  const threadManager = useThreadManager({
    threadListManager,
    loadThread: useCallback(
      async (threadId: string): Promise<Message[]> => {
        const messages = await getUIThreadMessages(threadId);
        // Filter out system messages and ensure role is only user or assistant
        return messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          }));
      },
      []
    ),
    onUpdateMessage: useCallback(
      ({ message }: { message: Message }) => {
        if (threadListManager.selectedThreadId && message.content) {
          updateMessage(threadListManager.selectedThreadId, {
            id: message.id,
            role: message.role,
            content: message.content,
          });
        }
      },
      [threadListManager.selectedThreadId]
    ),
    processMessage, // Use custom processMessage with auth headers instead of apiUrl
  });

  // Track last URL threadId to only react when URL actually changes
  // This prevents race conditions when SDK internally clears selection before URL updates
  const lastUrlThreadId = useRef<string | null | undefined>(undefined);

  // Track messages for artifact save action (avoids circular ref in onAction)
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => {
    if (threadManager.messages) {
      messagesRef.current = threadManager.messages;
    }
  }, [threadManager.messages]);

  // Handle custom actions from C1 (save_artifact, download_artifact)
  // This is passed directly to C1Chat, NOT through useThreadManager
  // C1Action type: { type?: string; params?: Record<string, any>; humanFriendlyMessage: string; llmFriendlyMessage: string }
  const handleAction = useCallback(
    async (event: { type?: string; params?: Record<string, unknown> }) => {
      console.log("[C1 Page] onAction called:", event.type, event.params);
      const token = localStorage.getItem("hakivo_access_token");

      if (event.type === "save_artifact") {
        const { artifactId, title, type } = (event.params || {}) as {
          artifactId: string;
          title: string;
          type: "report" | "slides";
        };

        // Find the message containing this artifact
        const artifactMessage = messagesRef.current.find(
          (m) => m.role === "assistant" && m.content?.includes(artifactId)
        );

        if (!artifactMessage) {
          toast.error("Could not find artifact content to save");
          return;
        }

        try {
          const response = await fetch("/api/chat/c1/artifacts/save", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              artifactId,
              title,
              type,
              content: artifactMessage.content,
              threadId: threadListManager.selectedThreadId,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to save artifact");
          }

          toast.success("Document saved to your library!");
        } catch (error) {
          console.error("[C1 Page] Error saving artifact:", error);
          toast.error("Failed to save document");
        }
      } else if (event.type === "download_artifact") {
        const { artifactId, format = "html" } = (event.params || {}) as {
          artifactId: string;
          format?: "html" | "json";
        };

        // Download via C1 artifacts API - HTML can be printed to PDF in browser
        toast.info("Preparing download...");
        try {
          const response = await fetch(
            `/api/chat/c1/artifacts/download/${artifactId}?format=${format}`,
            {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            }
          );

          if (!response.ok) {
            throw new Error("Download failed");
          }

          // Trigger browser download
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          // HTML files can be opened in browser and printed to PDF
          a.download = `hakivo-document-${artifactId.slice(0, 8)}.html`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          toast.success("Download complete! Open the file and use Print > Save as PDF for PDF format.");
        } catch (error) {
          console.error("[C1 Page] Error downloading artifact:", error);
          toast.error("Download failed");
        }
      }
    },
    [threadListManager.selectedThreadId]
  );

  // Generate share link for current thread
  const generateShareLink = useCallback(
    async (messages: Message[]): Promise<string> => {
      // Get auth token for authenticated share creation
      const authToken = localStorage.getItem("hakivo_access_token");

      // Get thread title from first user message
      const firstUserMessage = messages.find((m) => m.role === "user");
      const content = firstUserMessage?.content || "";
      const title = content
        ? content.substring(0, 50) + (content.length > 50 ? "..." : "")
        : "Shared Conversation";

      // Create share via API (requires authentication)
      const response = await fetch("/api/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          sessionId: threadListManager.selectedThreadId || "unknown",
          title,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create share link");
      }

      const data = await response.json();
      const baseUrl = window.location.origin;
      return `${baseUrl}/share/${data.token}`;
    },
    [threadListManager.selectedThreadId]
  );

  // Handle URL threadId param on mount and changes
  useEffect(() => {
    const threadId = searchParams.get("threadId");

    // Only react if URL actually changed (not just SDK internal state)
    if (lastUrlThreadId.current === threadId) {
      console.log("[C1 Page] URL effect - URL unchanged, skipping:", threadId);
      return;
    }

    console.log("[C1 Page] URL effect - URL changed from:", lastUrlThreadId.current, "to:", threadId);
    lastUrlThreadId.current = threadId;

    if (threadId) {
      // URL has threadId - select it if not already selected
      if (threadListManager.selectedThreadId !== threadId) {
        console.log("[C1 Page] Calling selectThread from URL effect");
        threadListManager.selectThread(threadId);
      }
    } else {
      // URL has no threadId - ensure we're in "new chat" state
      if (threadListManager.selectedThreadId) {
        console.log("[C1 Page] Clearing selection for new chat");
        threadListManager.switchToNewThread();
      }
    }
  }, [searchParams, threadListManager]);

  // Show loading while checking auth or mounting
  if (!mounted || authLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] w-full bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Don't render chat if not authenticated (will redirect)
  if (!isAuthenticated) {
    return (
      <div className="h-[calc(100vh-4rem)] w-full bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Redirecting to sign in...</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        /* Hide audio player on this page */
        .persistent-audio-player {
          display: none !important;
        }
      `}</style>
      <ThemeProvider
        theme={hakivoLightTheme}
        darkTheme={hakivoDarkTheme}
        mode="dark"
      >
        <C1Chat
          agentName="Hakivo"
          formFactor="full-page"
          threadListManager={threadListManager}
          threadManager={threadManager}
          generateShareLink={generateShareLink}
          onAction={handleAction}
        />
      </ThemeProvider>
    </>
  );
}

// Loading fallback for Suspense
function C1ChatLoading() {
  return (
    <div className="h-[calc(100vh-4rem)] w-full bg-background flex items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  );
}

// Main page component with Suspense boundary for useSearchParams
export default function C1ChatPage() {
  return (
    <Suspense fallback={<C1ChatLoading />}>
      <C1ChatContent />
    </Suspense>
  );
}
