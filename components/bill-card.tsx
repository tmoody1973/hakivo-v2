"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BookmarkPlus, MessageSquare, ExternalLink } from 'lucide-react'
import Link from "next/link"

interface BillCardProps {
  bill: {
    id: string
    number: string
    title: string
    sponsor: {
      name: string
      party: string
      state: string
      photo: string
    }
    status: string
    policyAreas: string[]
    dateIntroduced: string
    summary: string
    cosponsors: number
  }
}

const statusConfig = {
  "introduced": { label: "Introduced", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  "in-committee": { label: "In Committee", color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" },
  "passed-house": { label: "Passed House", color: "bg-green-500/10 text-green-700 dark:text-green-400" },
  "passed-senate": { label: "Passed Senate", color: "bg-green-500/10 text-green-700 dark:text-green-400" },
  "enacted": { label: "Enacted", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" }
}

export function BillCard({ bill }: BillCardProps) {
  const statusInfo = statusConfig[bill.status as keyof typeof statusConfig] || statusConfig.introduced
  const partyColor = bill.sponsor.party === "D" ? "text-blue-600" : "text-red-600"

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold text-primary">
                {bill.number}
              </span>
              <Badge className={statusInfo.color} variant="secondary">
                {statusInfo.label}
              </Badge>
            </div>
            <Link href={`/bills/${bill.id}`} className="hover:underline">
              <h3 className="font-semibold text-lg leading-tight text-balance">
                {bill.title}
              </h3>
            </Link>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Sponsor Info */}
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={bill.sponsor.photo || "/placeholder.svg"} alt={bill.sponsor.name} />
            <AvatarFallback>{bill.sponsor.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              Sponsored by <span className={partyColor}>{bill.sponsor.name}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {bill.sponsor.party}-{bill.sponsor.state} • {bill.cosponsors} cosponsors
            </p>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {new Date(bill.dateIntroduced).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            })}
          </span>
        </div>

        {/* Summary */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {bill.summary}
        </p>

        {/* Policy Areas */}
        <div className="flex flex-wrap gap-1.5">
          {bill.policyAreas.map((area) => (
            <Badge key={area} variant="outline" className="text-xs">
              {area}
            </Badge>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" variant="default" asChild>
            <Link href={`/bills/${bill.id}`}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              View Details
            </Link>
          </Button>
          <Button size="sm" variant="outline">
            <BookmarkPlus className="h-3.5 w-3.5 mr-1.5" />
            Track
          </Button>
          <Button size="sm" variant="outline">
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            Ask AI
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
