'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getMemberById } from '@/lib/api/backend'
import { Loader2, Phone, Mail, Globe, ExternalLink } from 'lucide-react'

const representativesDataOLD: Record<string, any> = {
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

export default function RepresentativeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [bioguideId, setBioguideId] = useState<string>('')
  const [member, setMember] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    params.then(p => setBioguideId(p.id))
  }, [params])

  useEffect(() => {
    if (!bioguideId) return

    async function fetchMember() {
      try {
        setLoading(true)
        setError(null)
        const response = await getMemberById(bioguideId)

        if (response.success && response.data) {
          setMember(response.data)
        } else {
          setError(response.error?.message || 'Failed to load representative')
        }
      } catch (err) {
        console.error('Failed to fetch representative:', err)
        setError('Failed to load representative')
      } finally {
        setLoading(false)
      }
    }

    fetchMember()
  }, [bioguideId])

  if (loading) {
    return (
      <div className="px-6 md:px-8 py-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading representative...</p>
        </div>
      </div>
    )
  }

  if (error || !member) {
    return (
      <div className="px-6 md:px-8 py-8">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold">Representative Not Found</h1>
          <p className="text-muted-foreground mt-2">{error || 'The representative you are looking for does not exist.'}</p>
        </Card>
      </div>
    )
  }

  const rep = member

  return (
    <div className="px-6 md:px-8 py-8 space-y-6">
      {/* Header Section */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <Avatar className="w-32 h-32">
            <AvatarImage src={rep.imageUrl || "/placeholder.svg"} alt={rep.fullName} />
            <AvatarFallback>{rep.firstName?.[0]}{rep.lastName?.[0]}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">{rep.fullName}</h1>
                <p className="text-lg text-muted-foreground mt-1">
                  U.S. {rep.chamber === 'House' ? 'Representative' : 'Senator'} • {rep.state} {rep.district !== null && rep.district !== undefined && `District ${rep.district}`}
                </p>
                <Badge className="mt-2" variant={rep.party === 'Democratic' || rep.party === 'Democrat' ? 'default' : 'secondary'}>
                  {rep.party}
                </Badge>
              </div>

              <div className="flex gap-2">
                {rep.url && (
                  <Button asChild>
                    <a href={rep.url} target="_blank" rel="noopener noreferrer">
                      <Globe className="h-4 w-4 mr-2" />
                      Website
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {rep.phoneNumber && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone
                  </p>
                  <p className="font-medium">{rep.phoneNumber}</p>
                </div>
              )}
              {rep.officeAddress && (
                <div>
                  <p className="text-sm text-muted-foreground">Office</p>
                  <p className="font-medium text-sm">{rep.officeAddress}</p>
                </div>
              )}
              {rep.url && (
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Website
                  </p>
                  <a href={rep.url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline flex items-center gap-1">
                    {rep.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bills">Sponsored Bills</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">About</h2>
            <div className="space-y-4 text-muted-foreground">
              {rep.birthDate && (
                <div>
                  <span className="font-semibold text-foreground">Born:</span> {new Date(rep.birthDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              )}
              {rep.gender && (
                <div>
                  <span className="font-semibold text-foreground">Gender:</span> {rep.gender}
                </div>
              )}
              {rep.currentMember && (
                <div>
                  <Badge variant="outline">Current Member</Badge>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="bills" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Sponsored Legislation</h2>
            {rep.sponsoredBills && rep.sponsoredBills.length > 0 ? (
              <div className="space-y-4">
                {rep.sponsoredBills.map((bill: any, index: number) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">
                            {bill.billType?.toUpperCase()}. {bill.billNumber}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Congress {bill.congress}
                          </span>
                        </div>
                        <h3 className="font-medium">{bill.title}</h3>
                        {bill.introducedDate && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Introduced: {new Date(bill.introducedDate).toLocaleDateString()}
                          </p>
                        )}
                        {bill.latestActionText && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Latest Action: {bill.latestActionText}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No sponsored bills available.</p>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
