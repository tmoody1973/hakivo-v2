"use client"
import { useEffect, useState } from "react"
import { ExternalLink, Newspaper, Loader2, AlertCircle, Sparkles } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth/auth-context"
import { getPersonalizedNews } from "@/lib/api/backend"

type NewsArticle = {
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

export function PersonalizedNewsWidget() {
  const { accessToken } = useAuth()
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchNews() {
      if (!accessToken) {
        setLoading(false)
        return
      }

      try {
        const response = await getPersonalizedNews(accessToken, 5)
        console.log('📰 [WIDGET] News API Response:', response)
        if (response.success && response.data) {
          console.log('📸 [WIDGET] First article:', response.data.articles[0])
          console.log('🖼️ [WIDGET] First article imageUrl:', response.data.articles[0]?.imageUrl)
          console.log('🔍 [WIDGET] All articles imageUrls:', response.data.articles.map((a: NewsArticle) => ({ title: a.title, imageUrl: a.imageUrl })))
          const articlesData = response.data.articles
          setArticles(articlesData)

          // DEBUG: Log state after setting
          setTimeout(() => {
            console.log('✅ [WIDGET] Articles in state after update:', articlesData.length)
          }, 100)
        } else {
          setError(response.error?.message || 'Failed to load news')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load news')
      } finally {
        setLoading(false)
      }
    }

    fetchNews()
  }, [accessToken])

  const getTimeAgo = (publishedDate: string) => {
    const now = new Date()
    const published = new Date(publishedDate)
    const diffInMs = now.getTime() - published.getTime()
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))

    // Handle negative time (future dates) gracefully
    if (diffInMs < 0) return 'Just now'
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays === 1) return 'Yesterday'
    if (diffInDays < 7) return `${diffInDays}d ago`
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`
    return published.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Extract clean summary from potentially long text
  const getCleanSummary = (summary: string) => {
    if (!summary) return 'No summary available'

    // Remove markdown links and clean up
    let clean = summary.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    clean = clean.replace(/#+\s/g, '') // Remove markdown headers
    clean = clean.replace(/\*\*/g, '') // Remove bold
    clean = clean.replace(/\n+/g, ' ') // Replace newlines with space
    clean = clean.trim()

    // Get first sentence or first 150 characters
    const firstSentence = clean.match(/^[^.!?]+[.!?]/)
    if (firstSentence && firstSentence[0].length < 200) {
      return firstSentence[0]
    }

    // Fallback: first 150 chars + ellipsis
    return clean.substring(0, 150) + (clean.length > 150 ? '...' : '')
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Personalized News
            </CardTitle>
            <CardDescription>News matching your policy interests</CardDescription>
          </div>
          <Newspaper className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive py-4">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && articles.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No personalized news available yet.</p>
            <p className="text-xs mt-1">Set your policy interests to see relevant news.</p>
          </div>
        )}

        {!loading && !error && articles.length > 0 && (
          <div className="space-y-3">
            {articles.map((article, index) => {
              // DEBUG: Log each article's imageUrl during render
              if (index === 0) {
                console.log(`🎨 [RENDER] First article imageUrl: "${article.imageUrl}" (type: ${typeof article.imageUrl}, truthy: ${!!article.imageUrl})`)
              }

              return (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  {/* Thumbnail - Compact on left */}
                  {article.imageUrl ? (
                    <div className="flex-shrink-0 w-24 h-24 rounded-md overflow-hidden bg-muted">
                      <img
                        src={article.imageUrl}
                        alt={article.title}
                        className="w-full h-full object-cover"
                        onError={() => console.error('❌ [IMG] Failed to load:', article.imageUrl)}
                        onLoad={() => console.log('✅ [IMG] Loaded successfully:', article.imageUrl)}
                      />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-24 h-24 rounded-md bg-muted flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">No image</span>
                    </div>
                  )}

                {/* Content - Main area */}
                <div className="flex-1 min-w-0">
                  {/* Metadata bar */}
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs capitalize font-normal">
                      {article.interest.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {getTimeAgo(article.publishedDate)}
                    </span>
                  </div>

                  {/* Title - Bold headline */}
                  <h3 className="font-bold text-sm mb-1 line-clamp-2 group-hover:text-primary transition-colors leading-tight">
                    {article.title}
                  </h3>

                  {/* Summary - SHORT and clean */}
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2 leading-relaxed">
                    {getCleanSummary(article.summary)}
                  </p>

                  {/* Source */}
                  <div className="flex items-center gap-1">
                    <Newspaper className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground capitalize">
                      {article.sourceDomain.replace(/\.com|\.org|\.net/g, '')}
                    </span>
                  </div>
                </div>

                {/* External link icon */}
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 self-start mt-1" />
              </a>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
