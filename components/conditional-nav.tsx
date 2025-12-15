"use client"

import { usePathname } from 'next/navigation'
import { DashboardHeader } from "./dashboard-header"
import { PublicHeader } from "./public-header"
import { useAuth } from "@/lib/auth/auth-context"

// Routes that are publicly accessible without authentication
// Includes shareable content pages (bills, briefs) for public sharing
const PUBLIC_ROUTES = ['/podcast', '/pricing', '/about', '/bills', '/briefs']

export function ConditionalNav() {
  const pathname = usePathname()
  const { isAuthenticated, isLoading } = useAuth()

  // Hide navigation on landing page, auth pages, and onboarding
  const hideNav = pathname === "/" ||
                  pathname?.startsWith('/auth') ||
                  pathname === '/onboarding'

  if (hideNav) {
    return null
  }

  // Check if current route is a public route
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route))

  // For public routes, show public header if not authenticated
  // For all other routes, show dashboard header (which will redirect if not authed)
  if (isPublicRoute && !isAuthenticated && !isLoading) {
    return <PublicHeader />
  }

  return <DashboardHeader />
}
