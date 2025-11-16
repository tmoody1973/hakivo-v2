"use client"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X } from 'lucide-react'

const billTypes = [
  { value: "all", label: "All Types" },
  { value: "hr", label: "House Bills" },
  { value: "s", label: "Senate Bills" },
  { value: "hjres", label: "House Resolutions" },
  { value: "sjres", label: "Senate Resolutions" }
]

const billStatuses = [
  { value: "all", label: "All Statuses" },
  { value: "introduced", label: "Introduced" },
  { value: "in-committee", label: "In Committee" },
  { value: "passed-house", label: "Passed House" },
  { value: "passed-senate", label: "Passed Senate" },
  { value: "enacted", label: "Enacted" }
]

const policyAreas = [
  { value: "all", label: "All Topics" },
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "environment", label: "Environment" },
  { value: "technology", label: "Technology" },
  { value: "immigration", label: "Immigration" },
  { value: "defense", label: "Defense" },
  { value: "economy", label: "Economy" },
  { value: "housing", label: "Housing" },
  { value: "transportation", label: "Transportation" },
  { value: "energy", label: "Energy" }
]

const sponsorParties = [
  { value: "all", label: "All Parties" },
  { value: "democrat", label: "Democrat" },
  { value: "republican", label: "Republican" },
  { value: "independent", label: "Independent" }
]

const congressSessions = [
  { value: "119", label: "119th Congress (2025-2026)" },
  { value: "118", label: "118th Congress (2023-2024)" }
]

export function LegislationFilters() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Congress Session */}
        <Select defaultValue="119">
          <SelectTrigger className="w-[220px]" aria-label="Select Congress session">
            <SelectValue placeholder="Congress Session" />
          </SelectTrigger>
          <SelectContent>
            {congressSessions.map((session) => (
              <SelectItem key={session.value} value={session.value}>
                {session.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Bill Type */}
        <Select defaultValue="all">
          <SelectTrigger className="w-[160px]" aria-label="Filter by bill type">
            <SelectValue placeholder="Bill Type" />
          </SelectTrigger>
          <SelectContent>
            {billTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status */}
        <Select defaultValue="all">
          <SelectTrigger className="w-[160px]" aria-label="Filter by bill status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {billStatuses.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Policy Area */}
        <Select defaultValue="all">
          <SelectTrigger className="w-[160px]" aria-label="Filter by policy topic">
            <SelectValue placeholder="Topic" />
          </SelectTrigger>
          <SelectContent>
            {policyAreas.map((area) => (
              <SelectItem key={area.value} value={area.value}>
                {area.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sponsor Party */}
        <Select defaultValue="all">
          <SelectTrigger className="w-[140px]" aria-label="Filter by sponsor party">
            <SelectValue placeholder="Party" />
          </SelectTrigger>
          <SelectContent>
            {sponsorParties.map((party) => (
              <SelectItem key={party.value} value={party.value}>
                {party.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2"
          aria-label="Clear all filters"
        >
          Clear All
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Active filters:</span>
        <Badge variant="secondary" className="gap-1.5">
          Healthcare
          <button
            aria-label="Remove Healthcare filter"
            className="hover:bg-muted rounded-sm"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          In Committee
          <button
            aria-label="Remove In Committee filter"
            className="hover:bg-muted rounded-sm"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      </div>
    </div>
  )
}
