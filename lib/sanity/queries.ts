import { groq } from 'next-sanity'

// Get all blog posts (sorted by publish date, newest first)
export const blogPostsQuery = groq`
  *[_type == "blogPost"] | order(publishedAt desc) {
    _id,
    title,
    slug,
    author,
    publishedAt,
    excerpt,
    "featuredImage": featuredImage.asset->url,
    "featuredImageAlt": featuredImage.alt,
    tags,
    categories[]-> {
      title,
      slug
    }
  }
`

// Get a single blog post by slug
export const blogPostBySlugQuery = groq`
  *[_type == "blogPost" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    author,
    publishedAt,
    excerpt,
    content[]{
      ...,
      _type == "image" => {
        ...,
        "url": asset->url,
        "dimensions": asset->metadata.dimensions
      }
    },
    "featuredImage": featuredImage.asset->url,
    "featuredImageAlt": featuredImage.alt,
    tags,
    categories[]-> {
      title,
      slug
    },
    seo
  }
`

// Get recent blog posts (limit)
export const recentBlogPostsQuery = (limit: number = 5) => groq`
  *[_type == "blogPost"] | order(publishedAt desc) [0...${limit}] {
    _id,
    title,
    slug,
    author,
    publishedAt,
    excerpt,
    "featuredImage": featuredImage.asset->url,
    "featuredImageAlt": featuredImage.alt,
    tags
  }
`
