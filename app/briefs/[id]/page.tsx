import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

export default async function BriefDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Mock data based on ID
  const briefs: Record<string, any> = {
    "1": {
      id: 1,
      title: "Healthcare, Climate, and Education Updates",
      date: "January 11, 2025",
      duration: "5:42",
      type: "Daily Brief",
      topics: ["Healthcare", "Climate", "Education"],
      description: "Covering 5 bills matching your interests including healthcare reform, climate legislation, and education funding updates.",
      imageUrl: "/us-capitol-building-congressional-legislation-brie.jpg",
      audioUrl: "/audio/brief-1.mp3",
      summary: "Today's brief covers critical legislation across three key areas. In healthcare, the Senate Health Committee advanced a bipartisan bill to expand Medicare coverage for mental health services. Climate legislation saw progress with the House passing amendments to renewable energy tax credits. Education funding received attention as both chambers negotiated appropriations for Title I programs.",
      bills: [
        { number: "H.R. 2847", title: "Mental Health Coverage Expansion Act", status: "Committee Vote", vote: "Passed 15-8" },
        { number: "S. 1523", title: "Renewable Energy Tax Credit Enhancement", status: "House Passed", vote: "268-162" },
        { number: "H.R. 3991", title: "Title I Education Funding Authorization", status: "Conference Committee", vote: "Pending" },
        { number: "S. 892", title: "Climate Adaptation Infrastructure Act", status: "Senate Floor", vote: "Cloture Filed" },
        { number: "H.R. 4201", title: "School Nutrition Standards Modernization", status: "Committee Markup", vote: "Scheduled" }
      ],
      transcript: `Good morning, and welcome to your daily legislative brief for Saturday, January 11th, 2025.

[Healthcare Section]
We're starting today with healthcare, where the Senate Health, Education, Labor and Pensions Committee took significant action on mental health coverage. H.R. 2847, the Mental Health Coverage Expansion Act, passed committee by a vote of 15 to 8, with three Republicans joining all Democrats in support.

The bill expands Medicare coverage for mental health services, including telehealth therapy sessions and substance abuse treatment programs. Sponsor Senator Maria Gonzalez emphasized the bipartisan nature of the effort, noting that mental health has become a priority across party lines.

The Congressional Budget Office estimates the expansion would cost $42 billion over ten years but could save $15 billion in emergency care costs. The bill now moves to the full Senate, where leadership has indicated it could receive floor time next month.

[Climate Section]
Moving to climate legislation, the House yesterday passed key amendments to S. 1523, the Renewable Energy Tax Credit Enhancement Act. The final vote was 268 to 162, with 45 Republicans crossing party lines to support the measure.

The amendments extend solar and wind energy tax credits through 2030 and create new incentives for battery storage technology. Representative James Chen, who led the amendment effort, called it "a practical approach to energy independence that doesn't pick winners and losers."

Industry groups praised the passage, with the Solar Energy Industries Association projecting 200,000 new jobs over the next five years. The bill now returns to the Senate for concurrence on the House amendments.

[Education Section]
In education news, House and Senate negotiators met yesterday to resolve differences in H.R. 3991, the Title I Education Funding Authorization. The bill has been in conference committee for three weeks as lawmakers debate funding formulas for schools serving low-income students.

The House version allocates $18.2 billion annually, while the Senate bill provides $17.5 billion with different distribution criteria. Chairman Robert Williams indicated negotiators are "close to a framework" and expect to finalize the bill within two weeks.

[Additional Climate Action]
Also worth noting, S. 892, the Climate Adaptation Infrastructure Act, saw movement on the Senate floor with a cloture motion filed yesterday. The bill provides $25 billion for coastal resilience projects and climate-adaptive infrastructure in vulnerable communities.

Senator Lisa Park, the bill's sponsor, secured commitments from 62 senators to support cloture, indicating likely passage next week. The White House has signaled the President would sign the measure.

[Education Standards]
Finally, the House Education Committee has scheduled markup for H.R. 4201, the School Nutrition Standards Modernization Act, for next Thursday. The bill updates federal nutrition requirements for school meals, balancing health recommendations with practical kitchen constraints.

Committee Chair David Martinez expects the markup to be contentious, with Republicans seeking more flexibility for schools and Democrats pushing for stricter nutritional standards. Several advocacy groups have already submitted testimony for the hearing.

That concludes today's legislative brief. These five bills represent the key activity matching your interest areas. For more details on any of these items, visit your Hakivo dashboard where you can explore full bill text, vote records, and AI-powered analysis.

Thank you for staying informed with Hakivo.`
    },
    "2": {
      id: 2,
      title: "Defense Authorization and Budget Updates",
      date: "January 10, 2025",
      duration: "6:15",
      type: "Daily Brief",
      topics: ["Defense", "Budget"],
      description: "Key votes on defense spending and budget reconciliation measures with bipartisan committee actions.",
      imageUrl: "/capitol-defense.jpg",
      audioUrl: "/audio/brief-2.mp3",
      summary: "Today's legislative brief focuses on defense and budget priorities. The Senate Armed Services Committee completed markup of the annual National Defense Authorization Act, setting a topline of $886 billion for fiscal year 2026. Meanwhile, the House Budget Committee advanced reconciliation instructions affecting discretionary spending caps.",
      bills: [
        { number: "S. 2145", title: "National Defense Authorization Act FY2026", status: "Committee Passed", vote: "24-2" },
        { number: "H.R. 5201", title: "Budget Reconciliation Instructions", status: "Committee Vote", vote: "22-19" },
        { number: "S. 1876", title: "Military Housing Improvement Act", status: "Senate Floor", vote: "Pending" }
      ],
      transcript: "Good morning, and welcome to your daily legislative brief for Friday, January 10th, 2025..."
    }
  }

  const brief = briefs[id] || briefs["1"]

  return (
    <div className="min-h-screen pb-32 px-6 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back button */}
        <Button variant="ghost" asChild>
          <a href="/briefs" className="text-muted-foreground hover:text-foreground">
            ← Back to Briefs
          </a>
        </Button>

        {/* Hero Section */}
        <div className="space-y-4">
          <div className="aspect-[21/9] rounded-lg overflow-hidden bg-muted">
            <img 
              src={brief.imageUrl || "/placeholder.svg"} 
              alt={brief.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                {brief.type}
              </Badge>
              <span className="text-sm text-muted-foreground">{brief.date}</span>
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">{brief.duration}</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {brief.title}
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed">
              {brief.summary}
            </p>

            <div className="flex flex-wrap gap-2">
              {brief.topics.map((topic: string) => (
                <Badge key={topic} variant="outline">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Audio Player */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex-1 space-y-2">
                <div className="text-sm font-medium">Audio Brief</div>
                <div className="text-sm text-muted-foreground">
                  Listen to the complete audio briefing
                </div>
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Button size="lg" className="rounded-full px-6">
                  ▶ Play {brief.duration}
                </Button>
                <Button size="lg" variant="outline">
                  📥 Download
                </Button>
              </div>
            </div>

            {/* Progress bar placeholder */}
            <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary w-0" />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="bills" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bills">Bills Covered</TabsTrigger>
            <TabsTrigger value="transcript">Full Transcript</TabsTrigger>
          </TabsList>

          <TabsContent value="bills" className="space-y-4">
            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold text-lg">Bills Featured in This Brief</h3>
                
                <div className="space-y-4">
                  {brief.bills.map((bill: any, index: number) => (
                    <div key={index}>
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-medium">{bill.number}</span>
                            <Badge variant="outline" className="text-xs">{bill.status}</Badge>
                          </div>
                          <h4 className="font-medium">{bill.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            Latest Action: {bill.vote}
                          </p>
                        </div>
                        
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/bill/${bill.number.toLowerCase().replace('.', '-')}`}>
                            View Details
                          </a>
                        </Button>
                      </div>
                      {index < brief.bills.length - 1 && <Separator className="mt-4" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transcript" className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="prose prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {brief.transcript}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Related Briefs */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">More Briefs</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="w-24 h-24 rounded overflow-hidden bg-muted flex-shrink-0">
                    <img 
                      src="/technology-privacy.jpg" 
                      alt="Technology Brief"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-2 flex-1 min-w-0">
                    <Badge variant="secondary" className="text-xs">Daily Brief</Badge>
                    <h4 className="font-medium line-clamp-2 text-sm">
                      Technology and Privacy Legislation
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>January 9, 2025</span>
                      <span>•</span>
                      <span>5:28</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="w-24 h-24 rounded overflow-hidden bg-muted flex-shrink-0">
                    <img 
                      src="/immigration-policy.jpg" 
                      alt="Immigration Brief"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-2 flex-1 min-w-0">
                    <Badge variant="secondary" className="text-xs">Daily Brief</Badge>
                    <h4 className="font-medium line-clamp-2 text-sm">
                      Immigration and Border Policy Updates
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>January 8, 2025</span>
                      <span>•</span>
                      <span>7:12</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
