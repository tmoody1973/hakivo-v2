"use client"

import { Search } from 'lucide-react'
import { Input } from "@/components/ui/input"

export function SearchBar() {
  return (
    <div className="border-b bg-card">
      <div className="px-6 md:px-8 py-3">
        <div className="relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" placeholder="Search legislation, representatives, bills..." className="w-full pl-10" />
        </div>
      </div>
    </div>
  )
}
