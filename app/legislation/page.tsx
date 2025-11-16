import { LegislationFilters } from "@/components/legislation-filters"
import { BillCard } from "@/components/bill-card"
import { Button } from "@/components/ui/button"

// Mock data for demonstration
const mockBills = [
  {
    id: "hr-1234",
    number: "H.R. 1234",
    title: "Affordable Housing Investment Act of 2024",
    sponsor: {
      name: "Rep. Sarah Johnson",
      party: "D",
      state: "CA",
      photo: "/woman-representative.png"
    },
    status: "passed-house",
    policyAreas: ["Housing", "Economic Development"],
    dateIntroduced: "2024-03-15",
    summary: "This bill provides tax incentives for developers to build affordable housing units in urban areas and establishes a federal grant program for first-time homebuyers.",
    cosponsors: 45
  },
  {
    id: "s-567",
    number: "S. 567",
    title: "Clean Energy Infrastructure Investment Act",
    sponsor: {
      name: "Sen. Michael Chen",
      party: "D",
      state: "WA",
      photo: "/asian-man-senator.jpg"
    },
    status: "in-committee",
    policyAreas: ["Energy", "Environment", "Infrastructure"],
    dateIntroduced: "2024-02-28",
    summary: "Allocates $50 billion in federal funding to modernize the electrical grid, expand renewable energy infrastructure, and create green jobs across rural and urban communities.",
    cosponsors: 23
  },
  {
    id: "hr-891",
    number: "H.R. 891",
    title: "Student Loan Relief and Reform Act",
    sponsor: {
      name: "Rep. James Martinez",
      party: "D",
      state: "TX",
      photo: "/latino-man-representative.jpg"
    },
    status: "introduced",
    policyAreas: ["Education", "Finance"],
    dateIntroduced: "2024-04-01",
    summary: "Proposes student loan forgiveness up to $20,000 for borrowers earning under $75,000 annually and reforms the income-driven repayment system to cap payments at 5% of discretionary income.",
    cosponsors: 67
  },
  {
    id: "s-234",
    number: "S. 234",
    title: "Healthcare Price Transparency Act",
    sponsor: {
      name: "Sen. Rebecca Thompson",
      party: "R",
      state: "FL",
      photo: "/woman-senator.jpg"
    },
    status: "passed-senate",
    policyAreas: ["Healthcare", "Consumer Protection"],
    dateIntroduced: "2024-01-20",
    summary: "Requires hospitals and insurance companies to disclose all costs upfront, prohibits surprise medical billing, and establishes penalties for non-compliance with transparency requirements.",
    cosponsors: 34
  },
  {
    id: "hr-2045",
    number: "H.R. 2045",
    title: "AI Safety and Innovation Act",
    sponsor: {
      name: "Rep. David Kim",
      party: "D",
      state: "NY",
      photo: "/asian-man-representative.jpg"
    },
    status: "in-committee",
    policyAreas: ["Technology", "Regulation", "Privacy"],
    dateIntroduced: "2024-03-10",
    summary: "Creates a regulatory framework for artificial intelligence development, establishes safety standards, requires algorithmic impact assessments, and protects consumer data privacy in AI systems.",
    cosponsors: 29
  },
  {
    id: "s-789",
    number: "S. 789",
    title: "Border Security Enhancement Act",
    sponsor: {
      name: "Sen. Robert Williams",
      party: "R",
      state: "AZ",
      photo: "/man-senator.jpg"
    },
    status: "introduced",
    policyAreas: ["Immigration", "National Security"],
    dateIntroduced: "2024-04-05",
    summary: "Authorizes additional funding for border patrol personnel, technology upgrades at ports of entry, and expedited processing systems for asylum claims while maintaining humanitarian protections.",
    cosponsors: 18
  }
]

export default function LegislationPage() {
  return (
    <div className="min-h-screen bg-background px-6 md:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-balance">Legislative Search</h1>
        <p className="text-muted-foreground mt-1">
          Search and explore Congressional legislation
        </p>
      </div>

      <div className="mb-6">
        <LegislationFilters />
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{mockBills.length}</span> results
          </p>
          <select 
            className="text-sm border border-border rounded-md px-3 py-1.5 bg-card text-foreground"
            aria-label="Sort results"
          >
            <option>Most Relevant</option>
            <option>Most Recent</option>
            <option>Most Cosponsors</option>
            <option>Oldest First</option>
          </select>
        </div>

        <div className="space-y-4">
          {mockBills.map((bill) => (
            <BillCard key={bill.id} bill={bill} />
          ))}
        </div>

        {/* Load More */}
        <div className="flex justify-center pt-4">
          <Button variant="outline">Load More Results</Button>
        </div>
      </div>
    </div>
  )
}
