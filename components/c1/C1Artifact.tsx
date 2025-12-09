"use client";

import { C1Component } from "@thesysai/genui-sdk";
import { useCallback, useState } from "react";

/**
 * Standard C1 action event structure
 */
interface Action {
  humanFriendlyMessage: string;
  llmFriendlyMessage: string;
}

/**
 * Custom action event with typed parameters
 * Matches Hakivo custom actions defined in thesys.ts
 */
export interface CustomActionEvent {
  type: "track_bill" | "view_bill_details" | "view_sponsor" | "share_result" | "explore_related" | "download_report" | string;
  params: Record<string, string | number | boolean>;
}

/**
 * Parse action events to extract custom action type and parameters
 */
function parseCustomAction(action: Action): CustomActionEvent | null {
  const message = action.llmFriendlyMessage;

  // Parse custom action patterns from C1 responses
  // Format: "ACTION_TYPE: param1=value1, param2=value2"
  const actionMatch = message.match(/^(\w+):\s*(.+)$/);
  if (actionMatch) {
    const type = actionMatch[1].toLowerCase();
    const paramsStr = actionMatch[2];
    const params: Record<string, string> = {};

    // Parse key=value pairs
    const paramPairs = paramsStr.split(",").map(p => p.trim());
    for (const pair of paramPairs) {
      const [key, value] = pair.split("=").map(s => s.trim());
      if (key && value) {
        params[key] = value;
      }
    }

    return { type, params };
  }

  // Try JSON parse if the message looks like JSON
  if (message.startsWith("{")) {
    try {
      return JSON.parse(message) as CustomActionEvent;
    } catch {
      // Not valid JSON
    }
  }

  return null;
}

interface C1ArtifactProps {
  /** The C1 API response to render */
  response: string;
  /** Whether the response is still streaming */
  isStreaming?: boolean;
  /** Callback when the response content is updated by C1 */
  onUpdate?: (content: string) => void;
  /** Callback when user interacts with the UI (button clicks, form submissions, etc.) */
  onAction?: (action: Action) => void;
  /** Callback for custom actions (track bill, share, explore, etc.) */
  onCustomAction?: (action: CustomActionEvent) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * C1Artifact - Renders interactive generative UI from thesys C1
 *
 * This component renders C1 API responses as interactive UI elements.
 * Users can interact with buttons, forms, and other generated components.
 * Interactions trigger the onAction callback with both human and LLM-friendly messages.
 *
 * @example
 * ```tsx
 * <C1Artifact
 *   response={c1Response}
 *   isStreaming={isStreaming}
 *   onAction={(action) => {
 *     // Send action.llmFriendlyMessage to backend for follow-up
 *     sendMessage(action.llmFriendlyMessage);
 *   }}
 * />
 * ```
 */
export function C1Artifact({
  response,
  isStreaming = false,
  onUpdate,
  onAction,
  onCustomAction,
  className,
}: C1ArtifactProps) {
  const [currentResponse, setCurrentResponse] = useState(response);

  // Handle content updates from C1
  const handleUpdate = useCallback(
    (message: string) => {
      setCurrentResponse(message);
      onUpdate?.(message);
    },
    [onUpdate]
  );

  // Handle user interactions
  const handleAction = useCallback(
    (action: Action) => {
      console.log("[C1Artifact] User action:", action.humanFriendlyMessage);

      // Try to parse as custom action first
      const customAction = parseCustomAction(action);
      if (customAction && onCustomAction) {
        console.log("[C1Artifact] Custom action detected:", customAction.type, customAction.params);
        onCustomAction(customAction);
        return;
      }

      // Fallback to standard action handler
      onAction?.(action);
    },
    [onAction, onCustomAction]
  );

  if (!response) {
    console.log("[C1Artifact] No response provided, returning null");
    return null;
  }

  console.log("[C1Artifact] Rendering with response:", {
    length: response.length,
    preview: response.slice(0, 150),
    isStreaming
  });

  return (
    <div className={className}>
      <C1Component
        c1Response={currentResponse}
        isStreaming={isStreaming}
        updateMessage={handleUpdate}
        onAction={handleAction}
      />
    </div>
  );
}

/**
 * Check if a response contains C1 generative UI markup
 * Thesys Artifacts API returns JSON component structures
 */
export function isC1Response(response: string): boolean {
  if (!response || typeof response !== "string") return false;

  // Thesys Artifacts API returns JSON with specific patterns:
  // - Array of objects with "op" (operations like "append")
  // - Objects with "component" keys (List, TextContent, InlineHeader, etc.)
  // - Objects with "variant" keys (ContentPage, etc.)
  // - Objects with "children" arrays containing nested components
  const artifactPatterns = [
    /"op"\s*:\s*"(append|replace|remove)"/i,
    /"component"\s*:\s*"(List|TextContent|InlineHeader|MiniCard|DataTile|Tag|Icon|MiniCardBlock|Hero|StatBlock|Chart|Table|Timeline|Progress|Card|Button|Form)"/i,
    /"variant"\s*:\s*"(ContentPage|CoverPage|TitlePage)"/i,
    /\[\s*\{\s*"op"\s*:/,  // Starts with array of operations
    /"children"\s*:\s*\[/,  // Has children array
  ];

  return artifactPatterns.some((pattern) => pattern.test(response));
}
