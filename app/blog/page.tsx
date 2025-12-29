import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { client } from '@/lib/sanity/client'
import { blogPostsQuery } from '@/lib/sanity/queries'
import type { BlogPost } from '@/lib/sanity/types'
import { ArrowRight, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Updates, insights, and news from the Hakivo team',
}

export const revalidate = 60 // Revalidate every 60 seconds

async function getBlogPosts(): Promise<BlogPost[]> {
  return await client.fetch(blogPostsQuery)
}

const ACCENT_COLORS = [
  'bg-blue-50 dark:bg-blue-950/30',
  'bg-purple-50 dark:bg-purple-950/30',
  'bg-green-50 dark:bg-green-950/30',
  'bg-amber-50 dark:bg-amber-950/30',
  'bg-pink-50 dark:bg-pink-950/30',
]

export default async function BlogPage() {
  const posts = await getBlogPosts()

  if (posts.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              News & Updates
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Product updates, insights, and stories from the Hakivo team
            </p>
          </div>
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">
              No blog posts yet. Check back soon!
            </p>
          </div>
        </div>
      </div>
    )
  }

  const [latestPost, ...featuredPosts] = posts
  const featuredSlice = featuredPosts.slice(0, 4)
  const remainingPosts = featuredPosts.slice(4)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            News & Updates
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Product updates, insights, and stories from the Hakivo team
          </p>
        </div>

        {/* Hero Section - Latest Post */}
        <Link
          href={`/blog/${latestPost.slug.current}`}
          className="group block mb-16 overflow-hidden rounded-2xl border border-border bg-card hover:shadow-xl transition-all duration-300"
        >
          <div className="grid md:grid-cols-2 gap-0">
            {/* Image Side */}
            {latestPost.featuredImage && (
              <div className="relative aspect-[4/3] md:aspect-auto md:h-full overflow-hidden bg-muted">
                <Image
                  src={latestPost.featuredImage}
                  alt={latestPost.featuredImageAlt || latestPost.title}
                  fill
                  priority
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            )}

            {/* Content Side */}
            <div className="p-8 md:p-12 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Calendar className="h-4 w-4" />
                <time dateTime={latestPost.publishedAt}>
                  {new Date(latestPost.publishedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
              </div>

              <h2 className="text-3xl md:text-4xl font-bold mb-4 group-hover:text-primary transition-colors">
                {latestPost.title}
              </h2>

              {latestPost.excerpt && (
                <p className="text-lg text-muted-foreground mb-6 line-clamp-3">
                  {latestPost.excerpt}
                </p>
              )}

              <div className="flex items-center gap-2 text-primary font-medium group-hover:gap-3 transition-all">
                Read more <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </div>
        </Link>

        {/* Featured Grid - Next 4 Posts */}
        {featuredSlice.length > 0 && (
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Featured</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredSlice.map((post, index) => (
                <Link
                  key={post._id}
                  href={`/blog/${post.slug.current}`}
                  className="group block rounded-xl overflow-hidden border border-border hover:shadow-lg transition-all duration-200"
                >
                  {/* Colored Background Section */}
                  <div className={`p-6 ${ACCENT_COLORS[index % ACCENT_COLORS.length]}`}>
                    {post.featuredImage ? (
                      <div className="relative aspect-[16/9] rounded-lg overflow-hidden mb-4">
                        <Image
                          src={post.featuredImage}
                          alt={post.featuredImageAlt || post.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[16/9] rounded-lg bg-background/50 mb-4" />
                    )}
                  </div>

                  {/* Content Section */}
                  <div className="p-6 bg-card">
                    <time className="text-xs text-muted-foreground block mb-2">
                      {new Date(post.publishedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </time>

                    <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      {post.title}
                    </h3>

                    {post.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {post.excerpt}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All News - Chronological List */}
        {remainingPosts.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-6">All News</h2>
            <div className="space-y-1">
              {remainingPosts.map((post) => (
                <Link
                  key={post._id}
                  href={`/blog/${post.slug.current}`}
                  className="group flex items-start gap-4 py-4 px-4 -mx-4 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  {/* Date */}
                  <time className="text-sm text-muted-foreground min-w-[120px] pt-1">
                    {new Date(post.publishedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </time>

                  {/* Content */}
                  <div className="flex-1">
                    {/* Categories/Tags */}
                    {(post.categories?.length || post.tags?.length) && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {post.categories?.map((category) => (
                          <span
                            key={category.slug.current}
                            className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
                          >
                            {category.title}
                          </span>
                        ))}
                        {post.tags?.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Title */}
                    <h3 className="font-semibold group-hover:text-primary transition-colors">
                      {post.title}
                    </h3>

                    {/* Excerpt */}
                    {post.excerpt && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {post.excerpt}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
