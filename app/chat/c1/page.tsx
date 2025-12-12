"use client";

import { C1Chat, ThemeProvider } from "@thesysai/genui-sdk";
import "@crayonai/react-ui/styles/index.css";
import { useEffect, useState } from "react";
import { hakivoLightTheme, hakivoDarkTheme } from "@/lib/c1-theme";

/**
 * C1 Chat Page - Uses Thesys C1 for generative UI with tool calling
 *
 * This page uses the C1Chat component which handles:
 * - Tool calling (searchNews, searchBills, searchMembers, searchImages)
 * - Report/Artifact generation with rich UI components
 * - Related queries suggestions
 * - Streaming responses
 */

export default function C1ChatPage() {
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering on client
  useEffect(() => {
    setMounted(true);
  }, []);

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
        />
      </ThemeProvider>
    </>
  );
}
