"use client";

import { ThemeProvider } from "@thesysai/genui-sdk";
import { ReactNode, useState, useEffect } from "react";
import "@crayonai/react-ui/styles/index.css";
import {
  hakivoLightTheme,
  hakivoDarkTheme,
  hakivoThemeMode,
} from "@/lib/c1-theme";

interface C1ProviderProps {
  children: ReactNode;
}

/**
 * C1Provider - Wraps the app with thesys C1 ThemeProvider
 *
 * Required for rendering C1Component generative UI elements.
 * Should be placed high in the component tree (e.g., in layout.tsx)
 *
 * Uses Hakivo's custom dark theme with teal/cyan accents
 * to match the app's design system.
 *
 * Note: ThemeProvider is only rendered after mount to prevent
 * hydration mismatches caused by different portal UIDs on server vs client.
 */
export function C1Provider({ children }: C1ProviderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render children without ThemeProvider during SSR to avoid hydration mismatch
  // ThemeProvider generates different portal UIDs on server vs client
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeProvider
      theme={hakivoLightTheme}
      darkTheme={hakivoDarkTheme}
      mode={hakivoThemeMode}
    >
      {children}
    </ThemeProvider>
  );
}
