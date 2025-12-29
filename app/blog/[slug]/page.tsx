import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { PortableText } from '@portabletext/react'
import { client } from '@/lib/sanity/client'
import { blogPostBySlugQuery } from '@/lib/sanity/queries'
import type { BlogPost } from '@/lib/sanity/types'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const revalidate = 60 // Revalidate every 60 seconds

interface BlogPostPageProps {
  params: Promise<{
    slug: string
  }>
}

async function getBlogPost(slug: string): Promise<BlogPost | null> {
  return await client.fetch(blogPostBySlugQuery, { slug })
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getBlogPost(slug)

  if (!post) {
    return {
      title: 'Post Not Found',
    }
  }

  return {
    title: post.title,
    description: post.seo?.metaDescription || post.excerpt || post.title,
    keywords: post.seo?.metaKeywords || post.tags,
    openGraph: {
      title: post.title,
      description: post.seo?.metaDescription || post.excerpt || '',
      images: post.featuredImage ? [post.featuredImage] : [],
      type: 'article',
      publishedTime: post.publishedAt,
      authors: post.author ? [post.author] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.seo?.metaDescription || post.excerpt || '',
      images: post.featuredImage ? [post.featuredImage] : [],
    },
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params
  const post = await getBlogPost(slug)

  if (!post) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Back Button */}
        <Link href="/blog" className="inline-block mb-8">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Button>
        </Link>

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{post.title}</h1>

          {/* Meta Info */}
          <div className="flex items-center gap-4 text-muted-foreground">
            {post.author && (
              <span className="font-medium">{post.author}</span>
            )}
            {post.publishedAt && (
              <>
                <span>•</span>
                <time dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
              </>
            )}
          </div>

          {/* Categories & Tags */}
          {(post.categories?.length || post.tags?.length) && (
            <div className="flex flex-wrap gap-2 mt-4">
              {post.categories?.map((category) => (
                <span
                  key={category.slug.current}
                  className="text-sm px-3 py-1 rounded-full bg-primary/10 text-primary font-medium"
                >
                  {category.title}
                </span>
              ))}
              {post.tags?.map((tag) => (
                <span
                  key={tag}
                  className="text-sm px-3 py-1 rounded-full bg-accent text-accent-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Featured Image */}
        {post.featuredImage && (
          <div className="relative aspect-[16/9] rounded-lg overflow-hidden mb-8 bg-muted">
            <Image
              src={post.featuredImage}
              alt={post.featuredImageAlt || post.title}
              fill
              priority
              className="object-cover"
            />
          </div>
        )}

        {/* Content */}
        {post.content && (
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <PortableText
              value={post.content}
              components={{
                types: {
                  image: ({ value }) => (
                    <div className="relative aspect-[16/9] rounded-lg overflow-hidden my-8">
                      <Image
                        src={value.asset?.url || ''}
                        alt={value.alt || ''}
                        fill
                        className="object-cover"
                      />
                      {value.caption && (
                        <p className="text-sm text-center text-muted-foreground mt-2">
                          {value.caption}
                        </p>
                      )}
                    </div>
                  ),
                },
                marks: {
                  link: ({ children, value }) => {
                    const rel = !value.href?.startsWith('/')
                      ? 'noreferrer noopener'
                      : undefined
                    return (
                      <a
                        href={value.href}
                        rel={rel}
                        className="text-primary hover:underline"
                      >
                        {children}
                      </a>
                    )
                  },
                },
                block: {
                  h1: ({ children }) => (
                    <h1 className="text-4xl font-bold mt-8 mb-4">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-3xl font-bold mt-8 mb-4">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-2xl font-bold mt-6 mb-3">{children}</h3>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary pl-4 italic my-6">
                      {children}
                    </blockquote>
                  ),
                },
              }}
            />
          </div>
        )}

        {/* Back to Blog */}
        <div className="mt-16 pt-8 border-t border-border">
          <Link href="/blog">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to all posts
            </Button>
          </Link>
        </div>
      </article>
    </div>
  )
}
