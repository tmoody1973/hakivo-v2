"use client"

import { useState, useEffect } from "react"
import { ExternalLink, Newspaper, FileText, Filter, Bookmark, BookmarkCheck, Loader2 } from "lucide-react"
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
import { getPersonalizedNews, bookmarkArticle } from "@/lib/api/backend"

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
}

interface PersonalizedContentWidgetProps {
  userInterests?: string[]
}

export function PersonalizedContentWidget({ userInterests = [] }: PersonalizedContentWidgetProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [bookmarkingId, setBookmarkingId] = useState<string | null>(null)

  const { accessToken } = useAuth()

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

  // Filter news based on selected category
  const getFilteredNews = () => {
    if (selectedCategory === "all") {
      return newsArticles
    }
    return newsArticles.filter(article => article.interest === selectedCategory)
  }

  const filteredNews = getFilteredNews()

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
            <CardDescription>News matching your interests</CardDescription>
          </div>
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
        <Tabs defaultValue="news" className="w-full">
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
              <div className="space-y-4">
                {filteredNews.map((article) => {
                  const isBookmarked = bookmarkedIds.has(article.id)
                  const isBookmarking = bookmarkingId === article.id

                  return (
                    <div key={article.id} className="group pb-4 border-b last:border-b-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">
                          {article.interest}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(article.publishedDate)}
                        </span>
                      </div>
                      <h4 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                        {article.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {article.summary}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          {article.sourceDomain}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleBookmark(article)}
                            disabled={isBookmarking || isBookmarked}
                          >
                            {isBookmarking ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : isBookmarked ? (
                              <>
                                <BookmarkCheck className="mr-1 h-3 w-3" />
                                Saved
                              </>
                            ) : (
                              <>
                                <Bookmark className="mr-1 h-3 w-3" />
                                Save
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            asChild
                          >
                            <a href={article.url} target="_blank" rel="noopener noreferrer">
                              Read
                              <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
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

          {/* Legislation Tab - Coming Soon */}
          <TabsContent value="legislation" className="mt-4">
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">Legislation tracking coming soon</p>
              <p className="text-xs mt-1">
                We're working on bringing you personalized bill tracking
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
