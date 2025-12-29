#!/usr/bin/env tsx
/**
 * Import Markdown Blog Post to Sanity
 *
 * Usage: npm run blog:import content/blog/my-post.md
 */

import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import matter from 'gray-matter'
import { createClient } from '@sanity/client'

// Load environment variables from .env.local
config({ path: '.env.local' })

const client = createClient({
  projectId: 's583epdw',
  dataset: 'production',
  apiVersion: '2024-01-01',
  token: process.env.SANITY_TOKEN, // You'll need to set this
  useCdn: false,
})

interface Frontmatter {
  title: string
  slug: string
  author?: string
  publishedAt: string
  excerpt?: string
  tags?: string[]
  categories?: string[]
  featuredImage?: {
    url: string
    alt: string
  }
  seo?: {
    metaDescription?: string
    metaKeywords?: string[]
  }
}

async function markdownToPortableText(markdown: string): Promise<any[]> {
  // Simple conversion - splits into paragraphs and converts basic markdown
  const lines = markdown.split('\n')
  const blocks: any[] = []
  let currentParagraph: string[] = []

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join('\n').trim()
      if (text) {
        blocks.push({
          _type: 'block',
          _key: `block-${blocks.length}`,
          style: 'normal',
          children: [
            {
              _type: 'span',
              _key: `span-${blocks.length}`,
              text: text,
              marks: [],
            },
          ],
          markDefs: [],
        })
      }
      currentParagraph = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // Heading
    if (trimmed.startsWith('# ')) {
      flushParagraph()
      blocks.push({
        _type: 'block',
        _key: `block-${blocks.length}`,
        style: 'h1',
        children: [
          {
            _type: 'span',
            _key: `span-${blocks.length}`,
            text: trimmed.slice(2),
            marks: [],
          },
        ],
        markDefs: [],
      })
    } else if (trimmed.startsWith('## ')) {
      flushParagraph()
      blocks.push({
        _type: 'block',
        _key: `block-${blocks.length}`,
        style: 'h2',
        children: [
          {
            _type: 'span',
            _key: `span-${blocks.length}`,
            text: trimmed.slice(3),
            marks: [],
          },
        ],
        markDefs: [],
      })
    } else if (trimmed.startsWith('### ')) {
      flushParagraph()
      blocks.push({
        _type: 'block',
        _key: `block-${blocks.length}`,
        style: 'h3',
        children: [
          {
            _type: 'span',
            _key: `span-${blocks.length}`,
            text: trimmed.slice(4),
            marks: [],
          },
        ],
        markDefs: [],
      })
    } else if (trimmed.startsWith('> ')) {
      flushParagraph()
      blocks.push({
        _type: 'block',
        _key: `block-${blocks.length}`,
        style: 'blockquote',
        children: [
          {
            _type: 'span',
            _key: `span-${blocks.length}`,
            text: trimmed.slice(2),
            marks: [],
          },
        ],
        markDefs: [],
      })
    } else if (trimmed === '') {
      flushParagraph()
    } else {
      currentParagraph.push(line)
    }
  }

  flushParagraph()
  return blocks
}

async function importBlogPost(filePath: string) {
  try {
    console.log(`📖 Reading: ${filePath}`)

    // Read and parse markdown file
    const fullPath = resolve(process.cwd(), filePath)
    const fileContent = readFileSync(fullPath, 'utf-8')
    const { data, content } = matter(fileContent)
    const frontmatter = data as Frontmatter

    // Validate required fields
    if (!frontmatter.title || !frontmatter.slug || !frontmatter.publishedAt) {
      throw new Error('Missing required frontmatter fields: title, slug, publishedAt')
    }

    console.log(`📝 Converting: "${frontmatter.title}"`)

    // Convert markdown to Portable Text
    const portableTextContent = await markdownToPortableText(content)

    // Build Sanity document
    const document: any = {
      _type: 'blogPost',
      title: frontmatter.title,
      slug: {
        _type: 'slug',
        current: frontmatter.slug,
      },
      publishedAt: new Date(frontmatter.publishedAt).toISOString(),
      content: portableTextContent,
    }

    // Optional fields
    if (frontmatter.author) {
      document.author = frontmatter.author
    }

    if (frontmatter.excerpt) {
      document.excerpt = frontmatter.excerpt
    }

    if (frontmatter.tags) {
      document.tags = frontmatter.tags
    }

    if (frontmatter.featuredImage) {
      console.log(`⚠️  Featured image URL found: ${frontmatter.featuredImage.url}`)
      console.log(`   Note: You'll need to upload the image manually in Sanity Studio`)
    }

    if (frontmatter.seo) {
      document.seo = frontmatter.seo
    }

    // Create draft in Sanity
    console.log(`🚀 Pushing to Sanity...`)
    const result = await client.create(document)

    console.log(`✅ Success! Draft created with ID: ${result._id}`)
    console.log(`📝 Edit in Studio: http://localhost:3333/structure/blogPost;${result._id}`)
    console.log(`\n💡 Next steps:`)
    console.log(`   1. Open Sanity Studio`)
    console.log(`   2. Find the draft post`)
    console.log(`   3. Add/adjust images if needed`)
    console.log(`   4. Polish the content`)
    console.log(`   5. Publish!`)

  } catch (error) {
    console.error(`❌ Error:`, error)
    process.exit(1)
  }
}

// Get file path from command line
const filePath = process.argv[2]

if (!filePath) {
  console.error(`Usage: npm run blog:import <path-to-markdown-file>`)
  console.error(`Example: npm run blog:import content/blog/my-post.md`)
  process.exit(1)
}

importBlogPost(filePath)
