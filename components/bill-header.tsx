import { ArrowLeft, Share2, BookmarkPlus } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface BillHeaderProps {
  billNumber: string
  congress: string
  title: string
  status: string
  sponsor: {
    name: string
    party: string
    state: string
  }
}

export function BillHeader({ billNumber, congress, title, status, sponsor }: BillHeaderProps) {
  return (
    <div className="border-b bg-card">
      <div className="container px-4 md:px-6 py-6">
        <div className="mb-4">
          <Link
            href="/legislation"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Legislation
          </Link>
        </div>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-mono text-muted-foreground">{billNumber}</span>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{congress}</span>
                <Badge className="ml-2">{status}</Badge>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-balance">{title}</h1>
              <p className="text-sm text-muted-foreground">
                Sponsored by {sponsor.name} ({sponsor.party}-{sponsor.state})
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button size="sm">
                <BookmarkPlus className="h-4 w-4 mr-2" />
                Track Bill
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
