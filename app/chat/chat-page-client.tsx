"use client";

import { C1Chat } from "@thesysai/genui-sdk";
import "@crayonai/react-ui/styles/index.css";

/**
 * Chat Page using thesys C1 Generative UI
 *
 * Uses the C1Chat component from the SDK which automatically:
 * - Renders generative UI components (cards, charts, tables)
 * - Handles streaming responses
 * - Manages conversation history
 * - Provides interactive UI elements
 */
export const ChatPageClient = () => {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <C1Chat
        apiUrl="/api/chat/c1"
        agentName="Congressional Assistant"
        formFactor="full-page"
      />
    </div>
  );
};
