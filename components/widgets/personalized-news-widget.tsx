"use client"
import { ExternalLink, Newspaper } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const newsArticles = [
  {
    title: "Senate Debates Infrastructure Bill Amendments",
    source: "The Hill",
    time: "2 hours ago",
    category: "Infrastructure",
    excerpt: "Key amendments proposed to the infrastructure package as debate continues on the Senate floor.",
    url: "#",
  },
  {
    title: "New Healthcare Legislation Introduced in House",
    source: "Politico",
    time: "5 hours ago",
    category: "Healthcare",
    excerpt: "Bipartisan group introduces comprehensive healthcare reform bill addressing prescription costs.",
    url: "#",
  },
  {
    title: "Climate Policy Updates from EPA",
    source: "Reuters",
    time: "8 hours ago",
    category: "Environment",
    excerpt: "Environmental Protection Agency announces new emissions standards for power plants.",
    url: "#",
  },
  {
    title: "Education Funding Bill Passes Committee",
    source: "NPR",
    time: "1 day ago",
    category: "Education",
    excerpt: "House Education Committee approves increased funding for public schools and student aid programs.",
    url: "#",
  },
]

export function PersonalizedNewsWidget() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Personalized News</CardTitle>
            <CardDescription>News matching your interests</CardDescription>
          </div>
          <Newspaper className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {newsArticles.map((article, index) => (
            <div key={index} className="group pb-4 border-b last:border-b-0 last:pb-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <Badge variant="secondary" className="text-xs">
                  {article.category}
                </Badge>
                <span className="text-xs text-muted-foreground">{article.time}</span>
              </div>
              <h4 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">{article.title}</h4>
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{article.excerpt}</p>
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
        <Button variant="outline" className="w-full mt-4 bg-transparent" size="sm">
          View All News
        </Button>
      </CardContent>
    </Card>
  )
}
