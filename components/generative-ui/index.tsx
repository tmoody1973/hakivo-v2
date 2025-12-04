"use client"

/**
 * Generative UI Components for Hakivo Congressional Assistant
 *
 * These components are designed to be rendered by thesys C1 generative UI
 * in response to user queries about legislation, representatives, and voting.
 *
 * Component Registry:
 * - BillCard: Display bill information with status, sponsor, tracking
 * - RepresentativeProfile: Display representative details with contact info
 * - VotingChart: Visualize vote breakdowns with party split
 * - BillTimeline: Show legislative journey through stages
 * - NewsCard: Display news articles from Tavily search
 */

// Export all components
export { BillCard } from "./bill-card"
export { RepresentativeProfile } from "./representative-profile"
export { VotingChart } from "./voting-chart"
export { BillTimeline } from "./bill-timeline"
export { NewsCard, NewsCardGrid } from "./news-card"

// Re-export types
export type { } from "./bill-card"
export type { } from "./representative-profile"
export type { } from "./voting-chart"
export type { } from "./bill-timeline"
export type { } from "./news-card"

// Import components for registry
import { BillCard } from "./bill-card"
import { RepresentativeProfile } from "./representative-profile"
import { VotingChart } from "./voting-chart"
import { BillTimeline } from "./bill-timeline"
import { NewsCard, NewsCardGrid } from "./news-card"

/**
 * Component Registry for C1 Generative UI
 *
 * Maps component names used in agent responses to actual React components.
 * C1 will reference these by name when generating UI.
 */
export const componentRegistry = {
  BillCard,
  RepresentativeProfile,
  VotingChart,
  BillTimeline,
  NewsCard,
  NewsCardGrid,
} as const

export type ComponentName = keyof typeof componentRegistry

/**
 * Render a component from the registry by name
 *
 * @param componentName - Name of the component to render
 * @param props - Props to pass to the component
 */
export function renderComponent(
  componentName: ComponentName,
  props: Record<string, unknown>
) {
  const Component = componentRegistry[componentName]
  if (!Component) {
    console.warn(`Unknown component: ${componentName}`)
    return null
  }
  // @ts-expect-error - Dynamic props
  return <Component {...props} />
}

/**
 * Parse component markup from AI response and render it
 *
 * Looks for patterns like:
 * <BillCard billNumber="H.R. 1234" title="..." />
 *
 * @param content - AI response content that may contain component markup
 */
export function parseAndRenderComponents(content: string) {
  const componentPattern = /<(\w+)\s+([^>]*)\/>/g
  const matches = content.matchAll(componentPattern)

  const components: { name: string; props: Record<string, unknown>; raw: string }[] = []

  for (const match of matches) {
    const [raw, name, propsStr] = match

    if (name in componentRegistry) {
      // Parse props from the string (simplified - real implementation would be more robust)
      const props: Record<string, unknown> = {}
      const propPattern = /(\w+)=\{([^}]+)\}|(\w+)="([^"]*)"/g
      let propMatch

      while ((propMatch = propPattern.exec(propsStr)) !== null) {
        const key = propMatch[1] || propMatch[3]
        const value = propMatch[2] || propMatch[4]

        // Try to parse as JSON for complex values
        if (propMatch[2]) {
          try {
            props[key] = JSON.parse(propMatch[2])
          } catch {
            props[key] = propMatch[2]
          }
        } else {
          props[key] = value
        }
      }

      components.push({ name, props, raw })
    }
  }

  return components
}

/**
 * Component Wrapper for streaming support
 *
 * Wraps generative UI components with loading states
 * for progressive rendering during streaming responses.
 */
export function StreamingComponentWrapper({
  isLoading,
  children,
}: {
  isLoading?: boolean
  children: React.ReactNode
}) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-3" />
        <div className="h-3 bg-muted rounded w-full mb-2" />
        <div className="h-3 bg-muted rounded w-2/3" />
      </div>
    )
  }

  return <>{children}</>
}
