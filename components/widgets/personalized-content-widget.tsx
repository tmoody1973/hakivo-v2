"use client"

import { useState, useEffect } from "react"
import { ExternalLink, Newspaper, FileText, Filter, Bookmark, BookmarkCheck, Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/lib/auth/auth-context"
import { getPersonalizedNews, bookmarkArticle, getPersonalizedBills, bookmarkBill } from "@/lib/api/backend"
import { EnhancedNewsCard } from "@/components/widgets/enhanced-news-card"
import { EnhancedBillCard } from "@/components/widgets/enhanced-bill-card"
import policyInterestMapping from "@/hakivo-api/docs/architecture/policy_interest_mapping.json"

// Policy interests matching onboarding
export const POLICY_INTERESTS = [
  'Environment & Energy',
  'Health & Social Welfare',
  'Economy & Finance',
  'Education & Science',
  'Civil Rights & Law',
  'Commerce & Labor',
  'Government & Politics',
  'Foreign Policy & Defense',
  'Housing & Urban Development',
  'Agriculture & Food',
  'Sports, Arts & Culture',
  'Immigration & Indigenous Issues',
]

interface NewsArticle {
  id: string
  interest: string
  title: string
  url: string
  author: string | null
  summary: string
  imageUrl: string | null
  publishedDate: string
  fetchedAt: number
  score: number
  sourceDomain: string
  enrichment: {
    plainLanguageSummary: string
    keyPoints: string[]
    readingTimeMinutes: number
    impactLevel: string
    tags: string[]
    enrichedAt: string
    modelUsed: string
  } | null
}

interface Bill {
  id: string
  congress: number
  billType: string
  billNumber: number
  title: string
  policyArea: string | null
  introducedDate: string | null
  latestActionDate: string | null
  latestActionText: string | null
  originChamber: string | null
  updateDate: string | null
  sponsor: {
    firstName: string
    lastName: string
    party: string
    state: string
  } | null
  enrichment: {
    plainLanguageSummary: string
    keyPoints: string[]
    readingTimeMinutes: number
    impactLevel: string
    bipartisanScore: number
    currentStage: string
    progressPercentage: number
    tags: string[]
    enrichedAt: string
    modelUsed: string
  } | null
}

interface PersonalizedContentWidgetProps {
  userInterests?: string[]
}

const ITEMS_PER_PAGE = 5;

export function PersonalizedContentWidget({ userInterests = [] }: PersonalizedContentWidgetProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [billsLoading, setBillsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [billsError, setBillsError] = useState<string | null>(null)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [bookmarkedBillIds, setBookmarkedBillIds] = useState<Set<string>>(new Set())
  const [bookmarkingId, setBookmarkingId] = useState<string | null>(null)
  const [bookmarkingBillId, setBookmarkingBillId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [billsLastUpdated, setBillsLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("news")
  const [newsCurrentPage, setNewsCurrentPage] = useState(1)
  const [billsCurrentPage, setBillsCurrentPage] = useState(1)

  const { accessToken} = useAuth()

  // Fetch personalized news on mount
  useEffect(() => {
    const fetchNews = async () => {
      if (!accessToken) {
        setError('Please sign in to view personalized news')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const response = await getPersonalizedNews(accessToken, 20)

        if (response.success && response.data) {
          setNewsArticles(response.data.articles)
          setLastUpdated(new Date())
        } else {
          setError(response.error?.message || 'Failed to load news')
        }
      } catch (err) {
        console.error('[PersonalizedContentWidget] Error fetching news:', err)
        setError('Failed to load personalized news')
      } finally {
        setLoading(false)
      }
    }

    fetchNews()
  }, [accessToken])

  // Manual refresh function
  const handleRefresh = async () => {
    if (!accessToken || isRefreshing) return

    try {
      setIsRefreshing(true)
      setError(null)

      const response = await getPersonalizedNews(accessToken, 20)

      if (response.success && response.data) {
        setNewsArticles(response.data.articles)
        setLastUpdated(new Date())
      } else {
        setError(response.error?.message || 'Failed to refresh news')
      }
    } catch (err) {
      console.error('[PersonalizedContentWidget] Error refreshing news:', err)
      setError('Failed to refresh news')
    } finally {
      setIsRefreshing(false)
    }
  }

  // Fetch personalized bills when legislation tab is activated
  useEffect(() => {
    const fetchBills = async () => {
      if (!accessToken || activeTab !== 'legislation' || bills.length > 0) {
        return
      }

      try {
        setBillsLoading(true)
        setBillsError(null)

        const response = await getPersonalizedBills(accessToken, 20)

        if (response.success && response.data) {
          setBills(response.data.bills)
          setBillsLastUpdated(new Date())
        } else {
          setBillsError(response.error?.message || 'Failed to load bills')
        }
      } catch (err) {
        console.error('[PersonalizedContentWidget] Error fetching bills:', err)
        setBillsError('Failed to load personalized bills')
      } finally {
        setBillsLoading(false)
      }
    }

    fetchBills()
  }, [accessToken, activeTab, bills.length])

  // Filter news based on selected category
  const getFilteredNews = () => {
    if (selectedCategory === "all") {
      return newsArticles
    }
    return newsArticles.filter(article => article.interest === selectedCategory)
  }

  // Filter bills based on selected category
  const getFilteredBills = () => {
    if (selectedCategory === "all") {
      return bills
    }

    // Map user-friendly interest to Congress.gov policy_area values
    const mapping = policyInterestMapping.find(m => m.interest === selectedCategory)
    if (!mapping) {
      return bills // If no mapping found, return all bills
    }

    // Filter bills whose policyArea matches any of the mapped policy_areas
    return bills.filter(bill =>
      bill.policyArea && mapping.policy_areas.includes(bill.policyArea)
    )
  }

  const filteredNews = getFilteredNews()
  const filteredBills = getFilteredBills()

  // Reset page when filter changes
  useEffect(() => {
    setNewsCurrentPage(1)
    setBillsCurrentPage(1)
  }, [selectedCategory])

  // Pagination for News
  const newsTotalPages = Math.ceil(filteredNews.length / ITEMS_PER_PAGE)
  const newsStartIndex = (newsCurrentPage - 1) * ITEMS_PER_PAGE
  const newsEndIndex = newsStartIndex + ITEMS_PER_PAGE
  const paginatedNews = filteredNews.slice(newsStartIndex, newsEndIndex)

  // Pagination for Bills
  const billsTotalPages = Math.ceil(filteredBills.length / ITEMS_PER_PAGE)
  const billsStartIndex = (billsCurrentPage - 1) * ITEMS_PER_PAGE
  const billsEndIndex = billsStartIndex + ITEMS_PER_PAGE
  const paginatedBills = filteredBills.slice(billsStartIndex, billsEndIndex)

  // Generate page numbers helper
  const getPageNumbers = (currentPage: number, totalPages: number) => {
    const pages: (number | string)[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      }
    }
    return pages
  }

  // Get categories to show in dropdown (either user's interests or all)
  const availableCategories = userInterests.length > 0 ? userInterests : POLICY_INTERESTS

  // Handle bookmark toggle
  const handleBookmark = async (article: NewsArticle) => {
    if (!accessToken) {
      console.error('[PersonalizedContentWidget] No access token - sign in required')
      return
    }

    try {
      setBookmarkingId(article.id)

      const response = await bookmarkArticle(accessToken, {
        articleUrl: article.url,
        title: article.title,
        summary: article.summary,
        imageUrl: article.imageUrl || undefined,
        interest: article.interest
      })

      if (response.success) {
        setBookmarkedIds(prev => new Set([...prev, article.id]))
        console.log('[PersonalizedContentWidget] Article bookmarked successfully:', article.title)
      } else {
        console.error('[PersonalizedContentWidget] Failed to bookmark:', response.error?.message)
      }
    } catch (err) {
      console.error('[PersonalizedContentWidget] Error bookmarking:', err)
    } finally {
      setBookmarkingId(null)
    }
  }

  // Handle bill bookmark toggle
  const handleBookmarkBill = async (bill: Bill) => {
    if (!accessToken) {
      console.error('[PersonalizedContentWidget] No access token - sign in required')
      return
    }

    try {
      setBookmarkingBillId(bill.id)

      const response = await bookmarkBill(accessToken, {
        billId: bill.id,
        title: bill.title,
        policyArea: bill.policyArea || 'Unknown',
        latestActionText: bill.latestActionText || undefined,
        latestActionDate: bill.latestActionDate || undefined
      })

      if (response.success) {
        setBookmarkedBillIds(prev => new Set([...prev, bill.id]))
        console.log('[PersonalizedContentWidget] Bill bookmarked successfully:', bill.title)
      } else {
        console.error('[PersonalizedContentWidget] Failed to bookmark bill:', response.error?.message)
      }
    } catch (err) {
      console.error('[PersonalizedContentWidget] Error bookmarking bill:', err)
    } finally {
      setBookmarkingBillId(null)
    }
  }

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    return 'Just now'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <div>
            <CardTitle>Personalized Content</CardTitle>
            <CardDescription>
              News matching your interests
              {lastUpdated && (
                <span className="text-xs ml-2">
                  • Updated {formatRelativeTime(lastUpdated.toISOString())}
                </span>
              )}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
            className="h-8 px-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 pt-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {availableCategories.map((interest) => (
                <SelectItem key={interest} value={interest}>
                  {interest}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="news" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="news" className="flex items-center gap-2">
              <Newspaper className="h-4 w-4" />
              News
            </TabsTrigger>
            <TabsTrigger value="legislation" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Legislation
            </TabsTrigger>
          </TabsList>

          {/* News Tab */}
          <TabsContent value="news" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-muted-foreground">
                <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => window.location.reload()}
                >
                  Try Again
                </Button>
              </div>
            ) : filteredNews.length > 0 ? (
              <>
                <div className="space-y-4">
                  {paginatedNews.map((article) => (
                    <EnhancedNewsCard key={article.id} article={article} />
                  ))}
                </div>

                {/* News Pagination */}
                {newsTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNewsCurrentPage(p => Math.max(1, p - 1))}
                      disabled={newsCurrentPage === 1}
                      className="h-8"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {getPageNumbers(newsCurrentPage, newsTotalPages).map((page, index) => (
                      page === '...' ? (
                        <span key={`news-ellipsis-${index}`} className="px-2 text-muted-foreground">...</span>
                      ) : (
                        <Button
                          key={`news-${page}`}
                          variant={newsCurrentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNewsCurrentPage(page as number)}
                          className="h-8 w-8 p-0"
                        >
                          {page}
                        </Button>
                      )
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNewsCurrentPage(p => Math.min(newsTotalPages, p + 1))}
                      disabled={newsCurrentPage === newsTotalPages}
                      className="h-8"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No news articles found</p>
                <p className="text-xs mt-1">
                  {selectedCategory !== "all"
                    ? "Try selecting a different category"
                    : "Check back soon for new articles"}
                </p>
              </div>
            )}
          </TabsContent>

          {/* Legislation Tab */}
          <TabsContent value="legislation" className="mt-4">
            {billsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : billsError ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">{billsError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => window.location.reload()}
                >
                  Try Again
                </Button>
              </div>
            ) : filteredBills.length > 0 ? (
              <>
                <div className="space-y-4">
                  {paginatedBills.map((bill) => (
                    <EnhancedBillCard key={bill.id} bill={bill} />
                  ))}
                </div>

                {/* Bills Pagination */}
                {billsTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBillsCurrentPage(p => Math.max(1, p - 1))}
                      disabled={billsCurrentPage === 1}
                      className="h-8"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {getPageNumbers(billsCurrentPage, billsTotalPages).map((page, index) => (
                      page === '...' ? (
                        <span key={`bills-ellipsis-${index}`} className="px-2 text-muted-foreground">...</span>
                      ) : (
                        <Button
                          key={`bills-${page}`}
                          variant={billsCurrentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setBillsCurrentPage(page as number)}
                          className="h-8 w-8 p-0"
                        >
                          {page}
                        </Button>
                      )
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBillsCurrentPage(p => Math.min(billsTotalPages, p + 1))}
                      disabled={billsCurrentPage === billsTotalPages}
                      className="h-8"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No bills found</p>
                <p className="text-xs mt-1">
                  {selectedCategory !== "all"
                    ? "Try selecting a different category"
                    : "Check back soon for new legislation"}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
