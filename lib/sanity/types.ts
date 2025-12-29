import type { PortableTextBlock } from '@portabletext/types'

export interface Category {
  title: string
  slug: {
    current: string
  }
}

export interface BlogPost {
  _id: string
  title: string
  slug: {
    current: string
  }
  author?: string
  publishedAt: string
  excerpt?: string
  content?: PortableTextBlock[]
  featuredImage?: string
  featuredImageAlt?: string
  tags?: string[]
  categories?: Category[]
  seo?: {
    metaDescription?: string
    metaKeywords?: string[]
  }
}
