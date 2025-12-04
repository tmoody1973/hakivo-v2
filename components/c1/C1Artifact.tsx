"use client";

import { C1Component } from "@thesysai/genui-sdk";
import { useCallback, useState } from "react";

interface Action {
  humanFriendlyMessage: string;
  llmFriendlyMessage: string;
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
      onAction?.(action);
    },
    [onAction]
  );

  if (!response) {
    return null;
  }

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
 * C1 responses typically contain React-like component syntax
 */
export function isC1Response(response: string): boolean {
  // C1 generates markup that looks like React JSX
  // Check for common C1 component patterns
  const c1Patterns = [
    /<C1Card/i,
    /<C1Button/i,
    /<C1Form/i,
    /<C1Chart/i,
    /<C1Table/i,
    /<C1List/i,
    /<C1Timeline/i,
    /<C1Progress/i,
    // Also check for common HTML-like structures from C1
    /<div class="c1-/i,
    /<section class="c1-/i,
    /data-c1-/i,
  ];

  return c1Patterns.some((pattern) => pattern.test(response));
}
