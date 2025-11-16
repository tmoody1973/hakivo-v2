import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const representativesData: Record<string, any> = {
  '1': {
    id: '1',
    name: 'Elizabeth Warren',
    title: 'Senator',
    party: 'Democrat',
    state: 'Massachusetts',
    district: '',
    image: '/woman-senator.jpg',
    phone: '(202) 224-4543',
    email: 'elizabeth_warren@warren.senate.gov',
    website: 'www.warren.senate.gov',
    twitter: '@SenWarren',
    bio: 'Elizabeth Warren is the senior United States Senator from Massachusetts. A former Harvard Law School professor, she is known for her expertise in bankruptcy law and consumer protection.',
    committees: [
      { name: 'Banking, Housing, and Urban Affairs', role: 'Member' },
      { name: 'Finance', role: 'Member' },
      { name: 'Armed Services', role: 'Member' }
    ],
    votes: [
      { bill: 'H.R. 1234 - Infrastructure Investment', vote: 'Yes', date: 'Nov 10, 2024' },
      { bill: 'S. 5678 - Climate Action Act', vote: 'Yes', date: 'Nov 5, 2024' },
      { bill: 'H.R. 9012 - Tax Reform Bill', vote: 'No', date: 'Oct 28, 2024' }
    ],
    sponsored: [
      { number: 'S. 2345', title: 'Student Loan Debt Relief Act', status: 'In Committee' },
      { number: 'S. 6789', title: 'Affordable Housing Expansion Act', status: 'Passed Senate' }
    ]
  },
  '2': {
    id: '2',
    name: 'Ed Markey',
    title: 'Senator',
    party: 'Democrat',
    state: 'Massachusetts',
    district: '',
    image: '/man-senator.jpg',
    phone: '(202) 224-2742',
    email: 'ed_markey@markey.senate.gov',
    website: 'www.markey.senate.gov',
    twitter: '@SenMarkey',
    bio: 'Ed Markey is the junior United States Senator from Massachusetts. He is a leader on climate change and clean energy policy.',
    committees: [
      { name: 'Environment and Public Works', role: 'Ranking Member' },
      { name: 'Commerce, Science, and Transportation', role: 'Member' }
    ],
    votes: [
      { bill: 'H.R. 1234 - Infrastructure Investment', vote: 'Yes', date: 'Nov 10, 2024' },
      { bill: 'S. 5678 - Climate Action Act', vote: 'Yes', date: 'Nov 5, 2024' }
    ],
    sponsored: [
      { number: 'S. 3456', title: 'Green New Deal Resolution', status: 'In Committee' }
    ]
  },
  '3': {
    id: '3',
    name: 'Ayanna Pressley',
    title: 'Representative',
    party: 'Democrat',
    state: 'Massachusetts',
    district: '7th District',
    image: '/woman-representative.png',
    phone: '(202) 225-5111',
    email: 'ayanna.pressley@mail.house.gov',
    website: 'pressley.house.gov',
    twitter: '@RepPressley',
    bio: 'Ayanna Pressley represents Massachusetts 7th Congressional District. She is a champion for equity and justice.',
    committees: [
      { name: 'Financial Services', role: 'Member' },
      { name: 'Oversight and Reform', role: 'Member' }
    ],
    votes: [
      { bill: 'H.R. 1234 - Infrastructure Investment', vote: 'Yes', date: 'Nov 10, 2024' },
      { bill: 'H.R. 9012 - Tax Reform Bill', vote: 'No', date: 'Oct 28, 2024' }
    ],
    sponsored: [
      { number: 'H.R. 4567', title: 'Criminal Justice Reform Act', status: 'In Committee' }
    ]
  }
}

export default async function RepresentativeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const rep = representativesData[id]

  if (!rep) {
    return (
      <div className="px-6 md:px-8 py-8">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold">Representative Not Found</h1>
          <p className="text-muted-foreground mt-2">The representative you are looking for does not exist.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="px-6 md:px-8 py-8 space-y-6">
      {/* Header Section */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <Avatar className="w-32 h-32">
            <AvatarImage src={rep.image || "/placeholder.svg"} alt={rep.name} />
            <AvatarFallback>{rep.name.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">{rep.name}</h1>
                <p className="text-lg text-muted-foreground mt-1">
                  {rep.title} • {rep.state} {rep.district && `- ${rep.district}`}
                </p>
                <Badge className="mt-2" variant={rep.party === 'Democrat' ? 'default' : 'secondary'}>
                  {rep.party}
                </Badge>
              </div>
              
              <div className="flex gap-2">
                <Button>Contact</Button>
                <Button variant="outline">Follow</Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{rep.phone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{rep.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Website</p>
                <p className="font-medium">{rep.website}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Twitter</p>
                <p className="font-medium">{rep.twitter}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="votes">Voting Record</TabsTrigger>
          <TabsTrigger value="bills">Sponsored Bills</TabsTrigger>
          <TabsTrigger value="committees">Committees</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Biography</h2>
            <p className="text-muted-foreground leading-relaxed">{rep.bio}</p>
          </Card>
        </TabsContent>

        <TabsContent value="votes" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Votes</h2>
            <div className="space-y-4">
              {rep.votes.map((vote: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium">{vote.bill}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{vote.date}</p>
                  </div>
                  <Badge variant={vote.vote === 'Yes' ? 'default' : 'destructive'}>
                    {vote.vote}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="bills" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Sponsored Legislation</h2>
            <div className="space-y-4">
              {rep.sponsored.map((bill: any, index: number) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{bill.number}</Badge>
                        <Badge>{bill.status}</Badge>
                      </div>
                      <h3 className="font-medium mt-2">{bill.title}</h3>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="committees" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Committee Assignments</h2>
            <div className="space-y-4">
              {rep.committees.map((committee: any, index: number) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{committee.name}</h3>
                    <Badge variant="secondary">{committee.role}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
