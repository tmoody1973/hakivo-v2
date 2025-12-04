"use client";

import { ThemeProvider } from "@thesysai/genui-sdk";
import { ReactNode } from "react";

interface C1ProviderProps {
  children: ReactNode;
}

/**
 * C1Provider - Wraps the app with thesys C1 ThemeProvider
 *
 * Required for rendering C1Component generative UI elements.
 * Should be placed high in the component tree (e.g., in layout.tsx)
 */
export function C1Provider({ children }: C1ProviderProps) {
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
}
