"use client"
import { Phone, Mail, ExternalLink } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

const representatives = [
  {
    name: "Elizabeth Warren",
    role: "U.S. Senator",
    party: "Democrat",
    state: "MA",
    image: "/senator-woman.jpg",
    initials: "EW",
  },
  {
    name: "Ed Markey",
    role: "U.S. Senator",
    party: "Democrat",
    state: "MA",
    image: "/senator-man.jpg",
    initials: "EM",
  },
  {
    name: "Katherine Clark",
    role: "U.S. Representative",
    party: "Democrat",
    district: "MA-5",
    image: "/representative-woman.jpg",
    initials: "KC",
  },
]

export function RepresentativesWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Representatives</CardTitle>
        <CardDescription>Massachusetts elected officials</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {representatives.map((rep, index) => (
          <div
            key={index}
            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <Avatar className="h-12 w-12">
              <AvatarImage src={rep.image || "/placeholder.svg"} alt={rep.name} />
              <AvatarFallback>{rep.initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-sm">{rep.name}</h4>
                  <p className="text-xs text-muted-foreground">{rep.role}</p>
                </div>
                <Badge variant="outline" className="text-xs whitespace-nowrap">
                  {rep.party.charAt(0)}
                </Badge>
              </div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" className="h-7 text-xs bg-transparent">
                  <Phone className="h-3 w-3 mr-1" />
                  Call
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs bg-transparent">
                  <Mail className="h-3 w-3 mr-1" />
                  Email
                </Button>
              </div>
            </div>
          </div>
        ))}
        <Button variant="ghost" className="w-full" size="sm">
          View All Representatives
          <ExternalLink className="ml-2 h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  )
}
