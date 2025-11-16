import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

export default async function BriefsPage() {
  const briefs = [
    {
      id: 1,
      title: "Healthcare, Climate, and Education Updates",
      date: "January 11, 2025",
      duration: "5:42",
      type: "Daily Brief",
      topics: ["Healthcare", "Climate", "Education"],
      description: "Covering 5 bills matching your interests including healthcare reform, climate legislation, and education funding updates.",
      imageUrl: "/us-capitol-building-congressional-legislation-brie.jpg"
    },
    {
      id: 2,
      title: "Defense Authorization and Budget Updates",
      date: "January 10, 2025",
      duration: "6:15",
      type: "Daily Brief",
      topics: ["Defense", "Budget"],
      description: "Key votes on defense spending and budget reconciliation measures with bipartisan committee actions.",
      imageUrl: "/capitol-defense.jpg"
    },
    {
      id: 3,
      title: "Weekly Review: New Laws Enacted",
      date: "January 8, 2025",
      duration: "8:30",
      type: "Weekly - Laws",
      topics: ["Multiple"],
      description: "Review of all bills signed into law this week, including infrastructure improvements and small business support.",
      imageUrl: "/president-signing-law.jpg"
    },
    {
      id: 4,
      title: "Technology and Privacy Legislation",
      date: "January 9, 2025",
      duration: "5:28",
      type: "Daily Brief",
      topics: ["Technology", "Privacy"],
      description: "New developments in data privacy laws and technology regulation with Senate committee hearings.",
      imageUrl: "/technology-privacy.jpg"
    },
    {
      id: 5,
      title: "Immigration and Border Policy Updates",
      date: "January 8, 2025",
      duration: "7:12",
      type: "Daily Brief",
      topics: ["Immigration"],
      description: "Comprehensive coverage of immigration reform proposals and border security legislation.",
      imageUrl: "/immigration-policy.jpg"
    },
    {
      id: 6,
      title: "Presidential Actions This Week",
      date: "January 7, 2025",
      duration: "9:45",
      type: "Weekly - President",
      topics: ["Executive"],
      description: "Review of executive orders, bill signings, and presidential statements from this week.",
      imageUrl: "/white-house.png"
    }
  ]

  return (
    <div className="min-h-screen pb-32 px-6 md:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Legislative Briefs</h1>
          <p className="text-muted-foreground">
            Your personalized audio briefings on Congressional legislation
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input 
                  placeholder="Search briefs..." 
                  className="w-full"
                />
              </div>
              
              <Select defaultValue="all">
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Brief Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="daily">Daily Brief</SelectItem>
                  <SelectItem value="weekly-laws">Weekly - Laws</SelectItem>
                  <SelectItem value="weekly-president">Weekly - President</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="all-time">
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-time">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="all-topics">
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Topics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-topics">All Topics</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="climate">Climate</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="defense">Defense</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="immigration">Immigration</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Briefs Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {briefs.map((brief) => (
            <Card key={brief.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-video bg-muted overflow-hidden">
                <img 
                  src={brief.imageUrl || "/placeholder.svg"} 
                  alt={brief.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      {brief.type}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{brief.date}</span>
                  </div>
                  
                  <h3 className="font-semibold text-lg leading-tight line-clamp-2">
                    {brief.title}
                  </h3>
                  
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {brief.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1">
                  {brief.topics.map((topic) => (
                    <Badge key={topic} variant="outline" className="text-xs">
                      {topic}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">{brief.duration}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/briefs/${brief.id}`}>View</a>
                    </Button>
                    <Button size="sm">
                      Play
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Load More */}
        <div className="flex justify-center pt-4">
          <Button variant="outline" size="lg">
            Load More Briefs
          </Button>
        </div>
      </div>
    </div>
  )
}
