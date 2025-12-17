import { MetadataRoute } from 'next'

/**
 * Dynamic Sitemap for Hakivo
 *
 * Generates sitemap.xml with all public pages:
 * - Static pages (home, podcast listing)
 * - Dynamic bill pages
 * - Dynamic representative pages
 * - Dynamic podcast episode pages
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hakivo.com'
const BILLS_API_URL = process.env.NEXT_PUBLIC_BILLS_API_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzh.01k66gywmx8x4r0w31fdjjfekf.lmapp.run'
// Podcast data is on the briefs service (different from bills)
const BRIEFS_API_URL = process.env.NEXT_PUBLIC_BRIEFS_API_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzj.01k66gywmx8x4r0w31fdjjfekf.lmapp.run'

interface Bill {
  id: string
  congress: number
  billType: string
  billNumber: number
  updatedAt?: string
}

interface Member {
  bioguideId: string
  updatedAt?: string
}

interface PodcastEpisode {
  id: string
  publishedAt?: string
  updatedAt?: string
}

/**
 * Fetch bills for sitemap (lightweight - just IDs and dates)
 */
async function getBillsForSitemap(): Promise<Bill[]> {
  try {
    // Fetch recent bills (limit to most important for sitemap size)
    const response = await fetch(`${BILLS_API_URL}/bills?limit=1000&congress=119`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    })

    if (!response.ok) {
      console.error('[Sitemap] Failed to fetch bills:', response.status)
      return []
    }

    const data = await response.json()
    return data.bills || []
  } catch (error) {
    console.error('[Sitemap] Error fetching bills:', error)
    return []
  }
}

/**
 * Fetch members for sitemap
 */
async function getMembersForSitemap(): Promise<Member[]> {
  try {
    const response = await fetch(`${BILLS_API_URL}/members?limit=600&currentOnly=true`, {
      next: { revalidate: 86400 }, // Cache for 24 hours (members don't change often)
    })

    if (!response.ok) {
      console.error('[Sitemap] Failed to fetch members:', response.status)
      return []
    }

    const data = await response.json()
    return data.members || []
  } catch (error) {
    console.error('[Sitemap] Error fetching members:', error)
    return []
  }
}

/**
 * Fetch podcast episodes for sitemap
 */
async function getPodcastEpisodesForSitemap(): Promise<PodcastEpisode[]> {
  try {
    // Podcasts are on briefs service, API uses /podcast (singular)
    const response = await fetch(`${BRIEFS_API_URL}/podcast?limit=500`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    })

    if (!response.ok) {
      console.error('[Sitemap] Failed to fetch podcasts:', response.status)
      return []
    }

    const data = await response.json()
    return data.episodes || data.podcasts || []
  } catch (error) {
    console.error('[Sitemap] Error fetching podcasts:', error)
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch all dynamic content in parallel
  const [bills, members, episodes] = await Promise.all([
    getBillsForSitemap(),
    getMembersForSitemap(),
    getPodcastEpisodesForSitemap(),
  ])

  const now = new Date().toISOString()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/podcast`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/representatives`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/bills`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ]

  // Bill pages - format: /bills/119-hr-1234
  const billPages: MetadataRoute.Sitemap = bills.map((bill) => {
    const billId = bill.id || `${bill.congress}-${bill.billType}-${bill.billNumber}`
    return {
      url: `${SITE_URL}/bills/${billId}`,
      lastModified: bill.updatedAt || now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }
  })

  // Representative pages - format: /representatives/P000197
  const memberPages: MetadataRoute.Sitemap = members.map((member) => ({
    url: `${SITE_URL}/representatives/${member.bioguideId}`,
    lastModified: member.updatedAt || now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  // Podcast episode pages - format: /podcast/123
  const podcastPages: MetadataRoute.Sitemap = episodes.map((episode) => ({
    url: `${SITE_URL}/podcast/${episode.id}`,
    lastModified: episode.updatedAt || episode.publishedAt || now,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  console.log(`[Sitemap] Generated: ${staticPages.length} static, ${billPages.length} bills, ${memberPages.length} members, ${podcastPages.length} podcasts`)

  return [
    ...staticPages,
    ...podcastPages,  // Podcasts high priority
    ...billPages,
    ...memberPages,
  ]
}
