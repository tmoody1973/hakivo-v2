"use client"

import { usePathname } from 'next/navigation'
import { DashboardHeader } from "./dashboard-header"
import { SearchBar } from "./search-bar"

export function ConditionalNav() {
  const pathname = usePathname()
  
  if (pathname === "/") {
    return null
  }

  return (
    <>
      <DashboardHeader />
      <SearchBar />
    </>
  )
}
