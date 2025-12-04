"use client"

import { usePathname } from 'next/navigation'
import { DashboardHeader } from "./dashboard-header"

export function ConditionalNav() {
  const pathname = usePathname()

  // Hide navigation on landing page, auth pages, and onboarding
  const hideNav = pathname === "/" ||
                  pathname?.startsWith('/auth') ||
                  pathname === '/onboarding'

  if (hideNav) {
    return null
  }

  return <DashboardHeader />
}
