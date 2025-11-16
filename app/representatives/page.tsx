"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Phone, Mail, MapPin, Building2, Search, CheckCircle, XCircle, Minus } from 'lucide-react'
import Link from "next/link"

const userRepresentatives = [
  {
    id: "1",
    name: "Elizabeth Warren",
    role: "U.S. Senator",
    party: "Democrat",
    state: "MA",
    image: "/woman-senator.jpg",
    initials: "EW",
    bio: "Elizabeth Warren is a U.S. Senator from Massachusetts, serving since 2013. She is a former Harvard Law School professor and advocate for consumer protection.",
    committees: ["Banking, Housing, and Urban Affairs", "Finance", "Health, Education, Labor, and Pensions"],
    phone: "(202) 224-4543",
    email: "senator@warren.senate.gov",
    offices: ["Washington, DC", "Boston, MA", "Springfield, MA"],
    recentVotes: [
      { bill: "S. 1234", title: "Infrastructure Investment Act", vote: "yes", date: "2025-11-10" },
      { bill: "S. 5678", title: "Education Funding Bill", vote: "yes", date: "2025-11-08" },
      { bill: "S. 9012", title: "Tax Reform Amendment", vote: "no", date: "2025-11-05" },
    ],
    yearsInOffice: 12,
    billsSponsored: 134,
  },
  {
    id: "2",
    name: "Ed Markey",
    role: "U.S. Senator",
    party: "Democrat",
    state: "MA",
    image: "/man-senator.jpg",
    initials: "EM",
    bio: "Ed Markey has served as U.S. Senator from Massachusetts since 2013, and previously served in the House of Representatives for 37 years.",
    committees: ["Commerce, Science, and Transportation", "Environment and Public Works", "Foreign Relations"],
    phone: "(202) 224-2742",
    email: "senator@markey.senate.gov",
    offices: ["Washington, DC", "Boston, MA", "Fall River, MA"],
    recentVotes: [
      { bill: "S. 1234", title: "Infrastructure Investment Act", vote: "yes", date: "2025-11-10" },
      { bill: "S. 5678", title: "Education Funding Bill", vote: "yes", date: "2025-11-08" },
      { bill: "S. 9012", title: "Tax Reform Amendment", vote: "no", date: "2025-11-05" },
    ],
    yearsInOffice: 12,
    billsSponsored: 198,
  },
  {
    id: "3",
    name: "Katherine Clark",
    role: "U.S. Representative",
    party: "Democrat",
    state: "MA",
    district: "5th District",
    image: "/woman-representative.jpg",
    initials: "KC",
    bio: "Katherine Clark represents Massachusetts's 5th congressional district and serves as House Democratic Whip.",
    committees: ["Appropriations", "Select Committee on the Modernization of Congress"],
    phone: "(202) 225-2836",
    email: "rep.clark@mail.house.gov",
    offices: ["Washington, DC", "Framingham, MA"],
    recentVotes: [
      { bill: "H.R. 2345", title: "Affordable Housing Act", vote: "yes", date: "2025-11-12" },
      { bill: "H.R. 6789", title: "Healthcare Reform Bill", vote: "yes", date: "2025-11-09" },
      { bill: "H.R. 3456", title: "Defense Authorization", vote: "yes", date: "2025-11-06" },
    ],
    yearsInOffice: 11,
    billsSponsored: 87,
  },
]

const allMembers = [
  ...userRepresentatives,
  {
    id: "4",
    name: "Marco Rubio",
    role: "U.S. Senator",
    party: "Republican",
    state: "FL",
    image: "/placeholder.svg?height=100&width=100",
    initials: "MR",
  },
  {
    id: "5",
    name: "Alexandria Ocasio-Cortez",
    role: "U.S. Representative",
    party: "Democrat",
    state: "NY",
    district: "14th District",
    image: "/placeholder.svg?height=100&width=100",
    initials: "AOC",
  },
]

export default function RepresentativesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [stateFilter, setStateFilter] = useState("all")
  const [partyFilter, setPartyFilter] = useState("all")

  const getVoteIcon = (vote: string) => {
    if (vote === "yes") return <CheckCircle className="h-4 w-4 text-green-500" />
    if (vote === "no") return <XCircle className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-muted-foreground" />
  }

  const filteredMembers = allMembers.filter((member) => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesState = stateFilter === "all" || member.state === stateFilter
    const matchesParty = partyFilter === "all" || member.party.toLowerCase() === partyFilter.toLowerCase()
    return matchesSearch && matchesState && matchesParty
  })

  return (
    <div className="min-h-screen px-6 md:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold">Your Representatives</h1>
          <p className="text-muted-foreground mt-2">
            Connect with your elected officials and track their legislative activity
          </p>
        </div>

        {/* Your Representatives Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Massachusetts Representatives</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {userRepresentatives.map((rep) => (
              <Card key={rep.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="text-center">
                  <Avatar className="h-24 w-24 mx-auto mb-4">
                    <AvatarImage src={rep.image || "/placeholder.svg"} alt={rep.name} />
                    <AvatarFallback>{rep.initials}</AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-lg">{rep.name}</CardTitle>
                  <CardDescription>
                    {rep.role}
                    {rep.district && ` • ${rep.district}`}
                  </CardDescription>
                  <Badge variant={rep.party === "Democrat" ? "default" : "secondary"} className="mx-auto mt-2">
                    {rep.party}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-muted">
                      <div className="text-2xl font-bold text-primary">{rep.yearsInOffice}</div>
                      <div className="text-xs text-muted-foreground">Years</div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted">
                      <div className="text-2xl font-bold text-primary">{rep.billsSponsored}</div>
                      <div className="text-xs text-muted-foreground">Bills</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Button className="w-full" variant="outline">
                      <Phone className="h-4 w-4 mr-2" />
                      {rep.phone}
                    </Button>
                    <Button className="w-full" variant="outline">
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                  </div>
                  <Button className="w-full" asChild>
                    <Link href={`/representatives/${rep.id}`}>
                      View Full Profile
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* All Members Directory */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle>All Members of Congress</CardTitle>
              <CardDescription>Search and filter representatives and senators</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filters */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, state, or district..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    <SelectItem value="MA">Massachusetts</SelectItem>
                    <SelectItem value="NY">New York</SelectItem>
                    <SelectItem value="FL">Florida</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={partyFilter} onValueChange={setPartyFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="All Parties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Parties</SelectItem>
                    <SelectItem value="democrat">Democrat</SelectItem>
                    <SelectItem value="republican">Republican</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Members Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredMembers.map((member) => (
                  <Link key={member.id} href={`/representatives/${member.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={member.image || "/placeholder.svg"} alt={member.name} />
                            <AvatarFallback>{member.initials}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm truncate">{member.name}</h4>
                            <p className="text-xs text-muted-foreground">{member.role}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {member.state}
                                {member.district && `-${member.district}`}
                              </Badge>
                              <Badge variant={member.party === "Democrat" ? "default" : "secondary"} className="text-xs">
                                {member.party.charAt(0)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
