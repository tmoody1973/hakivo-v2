"use client"

import { useState } from "react"
import { ExternalLink, Newspaper, FileText, Filter } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Policy interests matching onboarding
export const POLICY_INTERESTS = [
  'Environment & Energy',
  'Health & Social Welfare',
  'Economy & Finance',
  'Education & Science',
  'Civil Rights & Law',
  'Commerce & Labor',
  'Government & Politics',
  'Foreign Policy & Defense',
  'Housing & Urban Development',
  'Agriculture & Food',
  'Sports, Arts & Culture',
  'Immigration & Indigenous Issues',
]

// Mock news data
const newsArticles = [
  {
    title: "Senate Debates Infrastructure Bill Amendments",
    source: "The Hill",
    time: "2 hours ago",
    category: "Environment & Energy",
    excerpt: "Key amendments proposed to the infrastructure package as debate continues on the Senate floor.",
    url: "#",
  },
  {
    title: "New Healthcare Legislation Introduced in House",
    source: "Politico",
    time: "5 hours ago",
    category: "Health & Social Welfare",
    excerpt: "Bipartisan group introduces comprehensive healthcare reform bill addressing prescription costs.",
    url: "#",
  },
  {
    title: "Climate Policy Updates from EPA",
    source: "Reuters",
    time: "8 hours ago",
    category: "Environment & Energy",
    excerpt: "Environmental Protection Agency announces new emissions standards for power plants.",
    url: "#",
  },
  {
    title: "Education Funding Bill Passes Committee",
    source: "NPR",
    time: "1 day ago",
    category: "Education & Science",
    excerpt: "House Education Committee approves increased funding for public schools and student aid programs.",
    url: "#",
  },
  {
    title: "Federal Reserve Announces Interest Rate Decision",
    source: "Bloomberg",
    time: "3 hours ago",
    category: "Economy & Finance",
    excerpt: "Central bank holds rates steady amid mixed economic signals and inflation concerns.",
    url: "#",
  },
  {
    title: "Supreme Court Hears Voting Rights Case",
    source: "CNN",
    time: "6 hours ago",
    category: "Civil Rights & Law",
    excerpt: "Landmark case challenges state restrictions on ballot access and early voting procedures.",
    url: "#",
  },
]

// Mock legislation data
const legislationItems = [
  {
    billNumber: "H.R. 3684",
    title: "Infrastructure Investment and Jobs Act",
    sponsor: "Rep. DeFazio",
    status: "Passed House",
    category: "Environment & Energy",
    summary: "A $1.2 trillion bipartisan infrastructure package investing in roads, bridges, broadband, and clean energy.",
    lastAction: "Referred to Senate Committee",
    lastActionDate: "2 days ago",
  },
  {
    billNumber: "S. 1932",
    title: "Build Back Better Act",
    sponsor: "Sen. Sanders",
    status: "In Committee",
    category: "Health & Social Welfare",
    summary: "Expands Medicare, lowers prescription drug costs, and invests in home and community-based care.",
    lastAction: "Committee hearing scheduled",
    lastActionDate: "1 day ago",
  },
  {
    billNumber: "H.R. 5376",
    title: "Clean Energy Innovation Act",
    sponsor: "Rep. Ocasio-Cortez",
    status: "Introduced",
    category: "Environment & Energy",
    summary: "Accelerates clean energy deployment through tax incentives and research funding.",
    lastAction: "Introduced in House",
    lastActionDate: "5 hours ago",
  },
  {
    billNumber: "S. 2089",
    title: "Education Equity Act",
    sponsor: "Sen. Warren",
    status: "Passed Senate",
    category: "Education & Science",
    summary: "Increases federal funding for Title I schools and expands access to early childhood education.",
    lastAction: "Passed Senate by voice vote",
    lastActionDate: "3 days ago",
  },
  {
    billNumber: "H.R. 4567",
    title: "Small Business Recovery Act",
    sponsor: "Rep. Jeffries",
    status: "In Committee",
    category: "Economy & Finance",
    summary: "Provides grants and loans to small businesses impacted by economic downturn.",
    lastAction: "Markup session held",
    lastActionDate: "1 week ago",
  },
  {
    billNumber: "S. 1776",
    title: "Voting Rights Advancement Act",
    sponsor: "Sen. Klobuchar",
    status: "On Senate Floor",
    category: "Civil Rights & Law",
    summary: "Restores and strengthens the Voting Rights Act to protect ballot access.",
    lastAction: "Debate opened on Senate floor",
    lastActionDate: "4 hours ago",
  },
]

interface PersonalizedContentWidgetProps {
  userInterests?: string[]
}

export function PersonalizedContentWidget({ userInterests = [] }: PersonalizedContentWidgetProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  // Filter items based on selected category and user interests
  const getFilteredItems = (items: typeof newsArticles | typeof legislationItems) => {
    let filtered = items

    // If user has interests, filter to show only those categories
    if (userInterests.length > 0) {
      filtered = filtered.filter(item => userInterests.includes(item.category))
    }

    // If a specific category is selected (not "all"), filter further
    if (selectedCategory !== "all") {
      filtered = filtered.filter(item => item.category === selectedCategory)
    }

    return filtered
  }

  const filteredNews = getFilteredItems(newsArticles)
  const filteredLegislation = getFilteredItems(legislationItems)

  // Get categories to show in dropdown (either user's interests or all)
  const availableCategories = userInterests.length > 0 ? userInterests : POLICY_INTERESTS

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <div>
            <CardTitle>Personalized Content</CardTitle>
            <CardDescription>Content matching your interests</CardDescription>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 pt-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {availableCategories.map((interest) => (
                <SelectItem key={interest} value={interest}>
                  {interest}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="news" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="news" className="flex items-center gap-2">
              <Newspaper className="h-4 w-4" />
              News
            </TabsTrigger>
            <TabsTrigger value="legislation" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Legislation
            </TabsTrigger>
          </TabsList>

          {/* News Tab */}
          <TabsContent value="news" className="mt-4">
            {filteredNews.length > 0 ? (
              <div className="space-y-4">
                {filteredNews.map((article, index) => (
                  <div key={index} className="group pb-4 border-b last:border-b-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">
                        {article.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{article.time}</span>
                    </div>
                    <h4 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                      {article.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {article.excerpt}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">{article.source}</span>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        Read More
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No news articles found for selected category</p>
                <p className="text-xs mt-1">Try selecting a different category</p>
              </div>
            )}
            <Button variant="outline" className="w-full mt-4 bg-transparent" size="sm">
              View All News
            </Button>
          </TabsContent>

          {/* Legislation Tab */}
          <TabsContent value="legislation" className="mt-4">
            {filteredLegislation.length > 0 ? (
              <div className="space-y-4">
                {filteredLegislation.map((bill, index) => (
                  <div key={index} className="group pb-4 border-b last:border-b-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">
                        {bill.category}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {bill.status}
                      </Badge>
                    </div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{bill.billNumber}</span>
                      <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">
                        {bill.title}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {bill.summary}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Sponsor: <span className="font-medium">{bill.sponsor}</span>
                      </span>
                      <span className="text-muted-foreground">{bill.lastActionDate}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Latest: {bill.lastAction}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No legislation found for selected category</p>
                <p className="text-xs mt-1">Try selecting a different category</p>
              </div>
            )}
            <Button variant="outline" className="w-full mt-4 bg-transparent" size="sm">
              View All Legislation
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
