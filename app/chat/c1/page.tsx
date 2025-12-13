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
import { Suspense, useEffect, useState, useCallback } from "react";
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

  // Prevent hydration mismatch by only rendering on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Thread list manager for sidebar and thread switching
  const threadListManager = useThreadListManager({
    fetchThreadList: useCallback(async (): Promise<Thread[]> => {
      const threads = await getThreadList();
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

  // Thread manager for message handling within a thread
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
    apiUrl: "/api/chat/c1",
  });

  // Handle URL threadId param on mount and changes
  useEffect(() => {
    const threadId = searchParams.get("threadId");
    if (threadId && threadListManager.selectedThreadId !== threadId) {
      threadListManager.selectThread(threadId);
    }
  }, [searchParams, threadListManager]);

  if (!mounted) {
    return (
      <div className="h-[calc(100vh-4rem)] w-full bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
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
          apiUrl="/api/chat/c1"
          agentName="Hakivo"
          formFactor="full-page"
          threadListManager={threadListManager}
          threadManager={threadManager}
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
