import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PodcastEpisodeClient, type PodcastEpisode } from "./podcast-episode-client"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hakivo.com"
const BILLS_API_URL = process.env.NEXT_PUBLIC_BILLS_API_URL ||
  "https://svc-01kc6rbecv0s5k4yk6ksdaqyzh.01k66gywmx8x4r0w31fdjjfekf.lmapp.run"

/**
 * Fetch podcast episode data from API
 * Used for both metadata generation and page rendering
 */
async function getEpisodeData(id: string): Promise<PodcastEpisode | null> {
  try {
    const response = await fetch(`${BILLS_API_URL}/podcasts/${id}`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    })

    if (!response.ok) {
      console.error("[Podcast Page] Failed to fetch episode:", response.status)
      return null
    }

    const data = await response.json()
    return data.episode || data || null
  } catch (error) {
    console.error("[Podcast Page] Error fetching episode:", error)
    return null
  }
}

type Props = {
  params: Promise<{ id: string }>
}

/**
 * Generate dynamic metadata for podcast episode pages
 * This enables SEO - Google will see proper titles, descriptions, and structured data
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const episode = await getEpisodeData(id)

  if (!episode) {
    return {
      title: "Episode Not Found",
      description: "The requested podcast episode could not be found.",
    }
  }

  // Format duration for display
  const durationMins = episode.audioDuration
    ? `${Math.floor(episode.audioDuration / 60)} min`
    : ""

  // Build SEO-optimized title
  const title = episode.headline || episode.title

  // Build description - use content summary, law description, or fallback
  let description = episode.description || ""
  if (!description && episode.content) {
    // Extract first paragraph from markdown content
    description = episode.content.split("\n\n")[0].replace(/[#*_]/g, "").slice(0, 200)
  }
  if (!description) {
    description = episode.law?.description || ""
  }
  if (!description || description.length < 50) {
    description = `Listen to Episode ${episode.episodeNumber} of Civic Pulse: ${title}. ${durationMins ? `${durationMins} episode` : "Podcast"} explaining ${episode.law?.name || "landmark legislation"} and its impact on America.`
  }

  const pageUrl = `${SITE_URL}/podcast/${id}`
  const imageUrl = episode.thumbnailUrl || `${SITE_URL}/podcast-og.png`

  return {
    title,
    description: description.slice(0, 160),
    keywords: [
      episode.law?.name,
      episode.law?.category,
      "podcast",
      "civic engagement",
      "legislation explained",
      "american history",
      episode.law?.presidentSigned ? `President ${episode.law.presidentSigned}` : null,
      String(episode.law?.year),
    ].filter(Boolean) as string[],
    authors: [{ name: "Hakivo", url: SITE_URL }],
    openGraph: {
      type: "article",
      title,
      description: description.slice(0, 200),
      url: pageUrl,
      siteName: "Hakivo",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: "en_US",
      publishedTime: episode.publishedAt
        ? new Date(episode.publishedAt).toISOString()
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: description.slice(0, 200),
      images: [imageUrl],
      creator: "@hakivoapp",
    },
    alternates: {
      canonical: pageUrl,
    },
    other: {
      // Podcast-specific meta tags
      "og:audio": episode.audioUrl || "",
      "og:audio:type": "audio/mpeg",
      "article:section": episode.law?.category || "History",
      "article:tag": episode.law?.name || "Legislation",
    },
  }
}

/**
 * Server Component - Fetches data and passes to client component
 *
 * This pattern enables:
 * 1. SEO - generateMetadata runs on server, Google sees full content
 * 2. Interactivity - Client component handles audio player, tabs
 * 3. Performance - Data fetched once, shared between metadata and page
 */
export default async function PodcastEpisodePage({ params }: Props) {
  const { id } = await params
  const episode = await getEpisodeData(id)

  if (!episode) {
    notFound()
  }

  return <PodcastEpisodeClient episode={episode} />
}
