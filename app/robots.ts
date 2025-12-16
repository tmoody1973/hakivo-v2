import { MetadataRoute } from 'next'

/**
 * Dynamic robots.txt for Hakivo
 *
 * Tells search engines:
 * - What to crawl (public content pages)
 * - What NOT to crawl (auth, dashboard, API, chat)
 * - Where to find the sitemap
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hakivo.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/bills',
          '/bills/*',
          '/representatives',
          '/representatives/*',
          '/podcast',
          '/podcast/*',
        ],
        disallow: [
          '/api/',           // API routes - not pages
          '/auth/',          // Authentication flows
          '/dashboard/',     // User-specific content
          '/dashboard',
          '/settings/',      // User settings
          '/settings',
          '/chat/',          // Chat app functionality
          '/chat',
          '/share/',         // Shared conversation pages (user-generated)
          '/_next/',         // Next.js internals
          '/admin/',         // Admin pages if any
        ],
      },
      {
        // Block AI training crawlers (optional - comment out if you want AI indexing)
        userAgent: 'GPTBot',
        disallow: ['/'],
      },
      {
        userAgent: 'ChatGPT-User',
        disallow: ['/'],
      },
      {
        userAgent: 'Google-Extended',
        disallow: ['/'],
      },
      {
        userAgent: 'CCBot',
        disallow: ['/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
