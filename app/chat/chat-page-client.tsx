"use client";

import { CopilotKitChat } from "@/components/copilotkit-chat";

/**
 * Chat Page using CopilotKit with Mastra
 *
 * Uses CopilotKit + Mastra integration for:
 * - Intelligent chat with congressional assistant agent
 * - Generative UI with custom components (BillCard, VotingChart, etc.)
 * - Real-time tool calling for data retrieval
 * - Built-in conversation management
 */
export const ChatPageClient = () => {
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full h-full">
      <CopilotKitChat />
    </div>
  );
};
