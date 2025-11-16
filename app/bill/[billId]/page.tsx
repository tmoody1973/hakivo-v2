import { BillHeader } from "@/components/bill-header"
import { BillTimeline } from "@/components/bill-timeline"
import { BillAIChat } from "@/components/bill-ai-chat"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function BillDetailPage() {
  const bill = {
    number: "H.R. 1234",
    congress: "119th Congress (2025-2026)",
    title: "Clean Energy Investment and Innovation Act of 2025",
    status: "In Committee",
    sponsor: {
      name: "Rep. Maria Garcia",
      party: "D",
      state: "CA",
      image: "/representative.jpg",
    },
    coSponsors: 42,
  }

  return (
    <div className="px-6 md:px-8 py-6">
      <BillHeader
        billNumber={bill.number}
        congress={bill.congress}
        title={bill.title}
        status={bill.status}
        sponsor={bill.sponsor}
      />

      <div className="mt-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="text">Full Text</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="news">News</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Executive Summary</CardTitle>
                    <CardDescription>AI-generated overview of key provisions</CardDescription>
                  </CardHeader>
                  <CardContent className="prose prose-sm max-w-none">
                    <p className="leading-relaxed">
                      The Clean Energy Investment and Innovation Act establishes a comprehensive framework for
                      accelerating the transition to renewable energy sources across the United States. This
                      legislation aims to reduce carbon emissions by 50% by 2030 through strategic investments in
                      solar, wind, and emerging clean energy technologies.
                    </p>

                    <h4 className="font-semibold mt-4 mb-2">Key Provisions:</h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>$500 billion investment in renewable energy infrastructure over 10 years</li>
                      <li>Tax incentives for clean energy companies and homeowners installing solar panels</li>
                      <li>Creation of 2 million green jobs through workforce development programs</li>
                      <li>Research grants for next-generation battery storage and grid modernization</li>
                      <li>Phase-out of fossil fuel subsidies by 2028</li>
                    </ul>

                    <h4 className="font-semibold mt-4 mb-2">Potential Impact:</h4>
                    <p className="leading-relaxed text-muted-foreground">
                      If enacted, this bill would represent the largest federal investment in clean energy in U.S.
                      history. Economic models suggest it could reduce household energy costs by 15-20% within five
                      years while creating significant employment opportunities in renewable energy sectors.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Sponsor & Co-sponsors</CardTitle>
                    <CardDescription>{bill.coSponsors} co-sponsors</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-4 p-4 rounded-lg border">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={bill.sponsor.image || "/placeholder.svg"} alt={bill.sponsor.name} />
                        <AvatarFallback>MG</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{bill.sponsor.name}</h4>
                          <Badge variant="outline">
                            {bill.sponsor.party}-{bill.sponsor.state}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Primary Sponsor</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Member of the Energy and Commerce Committee
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Co-sponsors by party:</span>
                      <Badge variant="secondary">32 Democrats</Badge>
                      <Badge variant="secondary">10 Republicans</Badge>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="text">
                <Card>
                  <CardHeader>
                    <CardTitle>Full Text</CardTitle>
                    <CardDescription>Complete legislative text</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      <p className="text-muted-foreground leading-relaxed">
                        The full legislative text would appear here with section navigation and annotation
                        features...
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activity">
                <Card>
                  <CardHeader>
                    <CardTitle>Legislative Activity</CardTitle>
                    <CardDescription>Timeline of actions and votes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BillTimeline />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="news">
                <Card>
                  <CardHeader>
                    <CardTitle>Related News</CardTitle>
                    <CardDescription>Media coverage and analysis</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      News articles and media coverage would be displayed here...
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6">
            <BillAIChat />
          </div>
        </div>
      </div>
    </div>
  )
}
