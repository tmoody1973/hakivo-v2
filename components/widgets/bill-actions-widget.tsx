"use client"

import { Clock, TrendingUp, Bookmark, Sparkles, List } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const latestActions = [
  {
    number: "H.R. 1234",
    title: "Clean Energy Investment Act",
    chamber: "House",
    action: "Passed (245-190)",
    date: "2 hours ago",
    status: "Passed House",
  },
  {
    number: "S. 567",
    title: "Healthcare Access Expansion",
    chamber: "Senate",
    action: "Referred to Finance Committee",
    date: "5 hours ago",
    status: "In Committee",
  },
  {
    number: "H.R. 890",
    title: "Education Funding Reform",
    chamber: "House",
    action: "Introduced by Rep. Smith",
    date: "1 day ago",
    status: "Introduced",
  },
  {
    number: "S. 234",
    title: "Immigration Policy Update",
    chamber: "Senate",
    action: "Scheduled for floor debate",
    date: "2 days ago",
    status: "Senate Floor",
  },
  {
    number: "H.R. 2345",
    title: "Tax Reform Proposal",
    chamber: "House",
    action: "Markup session scheduled",
    date: "2 days ago",
    status: "In Committee",
  },
]

const trackedBills = [
  {
    number: "H.R. 1234",
    title: "Clean Energy Investment Act",
    status: "Passed House",
    statusColor: "bg-green-500",
    date: "2 hours ago",
    action: "Passed by House (245-190)",
  },
  {
    number: "S. 567",
    title: "Healthcare Access Expansion",
    status: "In Committee",
    statusColor: "bg-yellow-500",
    date: "5 hours ago",
    action: "Referred to Finance Committee",
  },
  {
    number: "H.R. 890",
    title: "Education Funding Reform",
    status: "Introduced",
    statusColor: "bg-blue-500",
    date: "1 day ago",
    action: "Introduced by Rep. Smith",
  },
  {
    number: "S. 234",
    title: "Immigration Policy Update",
    status: "Senate Floor",
    statusColor: "bg-orange-500",
    date: "2 days ago",
    action: "Scheduled for floor debate",
  },
]

const recentlyIntroducedBills = [
  {
    number: "H.R. 3456",
    title: "Cybersecurity Infrastructure Act",
    sponsor: "Rep. Johnson (D-CA)",
    date: "3 hours ago",
    cosponsors: 24,
    category: "Technology",
  },
  {
    number: "S. 789",
    title: "Rural Broadband Expansion",
    sponsor: "Sen. Williams (R-TX)",
    date: "8 hours ago",
    cosponsors: 12,
    category: "Infrastructure",
  },
  {
    number: "H.R. 3457",
    title: "Student Loan Relief Program",
    sponsor: "Rep. Davis (D-NY)",
    date: "1 day ago",
    cosponsors: 45,
    category: "Education",
  },
  {
    number: "S. 790",
    title: "Veterans Healthcare Support",
    sponsor: "Sen. Martinez (D-AZ)",
    date: "1 day ago",
    cosponsors: 38,
    category: "Healthcare",
  },
]

export function BillActionsWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Latest Bill Actions
        </CardTitle>
        <CardDescription>Recent activity on tracked legislation</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="latest" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="latest" className="flex items-center gap-1.5">
              <List className="h-3.5 w-3.5" />
              Latest Actions
            </TabsTrigger>
            <TabsTrigger value="tracked" className="flex items-center gap-1.5">
              <Bookmark className="h-3.5 w-3.5" />
              Tracked Bills
            </TabsTrigger>
            <TabsTrigger value="recent" className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Recently Introduced
            </TabsTrigger>
          </TabsList>

          <TabsContent value="latest" className="mt-0">
            <div className="space-y-3">
              {latestActions.map((bill, index) => (
                <button
                  key={index}
                  className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{bill.number}</span>
                        <Badge variant="outline" className="text-xs">
                          {bill.chamber}
                        </Badge>
                      </div>
                      <h4 className="font-medium text-sm line-clamp-1">{bill.title}</h4>
                    </div>
                    <Badge variant="secondary" className="text-xs whitespace-nowrap">
                      {bill.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{bill.action}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {bill.date}
                  </div>
                </button>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4 bg-transparent" size="sm">
              View All Actions
            </Button>
          </TabsContent>

          <TabsContent value="tracked" className="mt-0">
            <div className="space-y-3">
              {trackedBills.map((bill, index) => (
                <button
                  key={index}
                  className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{bill.number}</span>
                        <div className={`h-2 w-2 rounded-full ${bill.statusColor}`} />
                      </div>
                      <h4 className="font-medium text-sm line-clamp-1">{bill.title}</h4>
                    </div>
                    <Badge variant="secondary" className="text-xs whitespace-nowrap">
                      {bill.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{bill.action}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {bill.date}
                  </div>
                </button>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4 bg-transparent" size="sm">
              View All Tracked Bills
            </Button>
          </TabsContent>

          <TabsContent value="recent" className="mt-0">
            <div className="space-y-3">
              {recentlyIntroducedBills.map((bill, index) => (
                <button
                  key={index}
                  className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{bill.number}</span>
                        <Badge variant="outline" className="text-xs">
                          {bill.category}
                        </Badge>
                      </div>
                      <h4 className="font-medium text-sm line-clamp-1">{bill.title}</h4>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">Sponsored by {bill.sponsor}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {bill.date}
                    </div>
                    <span className="text-xs text-muted-foreground">{bill.cosponsors} cosponsors</span>
                  </div>
                </button>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4 bg-transparent" size="sm">
              View All New Bills
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
