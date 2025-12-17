/**
 * JSON-LD Structured Data Components for SEO
 *
 * Generates Schema.org structured data for rich Google results.
 * @see https://developers.google.com/search/docs/appearance/structured-data
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hakivo.com"

interface OrganizationJsonLdProps {
  name?: string
  description?: string
  logo?: string
  url?: string
  sameAs?: string[]
}

/**
 * Organization schema - brand identity in Google
 */
export function OrganizationJsonLd({
  name = "Hakivo",
  description = "Civic engagement platform making Congressional legislation accessible through AI summaries, podcasts, and representative tracking.",
  logo = `${SITE_URL}/logo.png`,
  url = SITE_URL,
  sameAs = [],
}: OrganizationJsonLdProps = {}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    description,
    url,
    logo: {
      "@type": "ImageObject",
      url: logo,
    },
    sameAs,
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

interface WebSiteJsonLdProps {
  name?: string
  url?: string
  searchUrl?: string
}

/**
 * WebSite schema - enables sitelinks search box in Google
 */
export function WebSiteJsonLd({
  name = "Hakivo",
  url = SITE_URL,
  searchUrl = `${SITE_URL}/search?q={search_term_string}`,
}: WebSiteJsonLdProps = {}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: searchUrl,
      },
      "query-input": "required name=search_term_string",
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

interface BreadcrumbItem {
  name: string
  url: string
}

interface BreadcrumbJsonLdProps {
  items: BreadcrumbItem[]
}

/**
 * BreadcrumbList schema - navigation hierarchy in search results
 */
export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

interface PodcastEpisodeJsonLdProps {
  name: string
  description: string
  datePublished: string
  duration?: string // ISO 8601 duration format (e.g., "PT10M30S")
  audioUrl?: string
  imageUrl?: string
  episodeNumber?: number
  seriesName?: string
  url: string
}

/**
 * PodcastEpisode schema - rich results for podcast episodes
 */
export function PodcastEpisodeJsonLd({
  name,
  description,
  datePublished,
  duration,
  audioUrl,
  imageUrl,
  episodeNumber,
  seriesName = "Civic Pulse",
  url,
}: PodcastEpisodeJsonLdProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "PodcastEpisode",
    name,
    description,
    datePublished,
    url,
    partOfSeries: {
      "@type": "PodcastSeries",
      name: seriesName,
      url: `${SITE_URL}/podcast`,
    },
  }

  if (duration) {
    schema.timeRequired = duration
  }

  if (audioUrl) {
    schema.associatedMedia = {
      "@type": "MediaObject",
      contentUrl: audioUrl,
      encodingFormat: "audio/mpeg",
    }
  }

  if (imageUrl) {
    schema.image = imageUrl
  }

  if (episodeNumber) {
    schema.episodeNumber = episodeNumber
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

interface ArticleJsonLdProps {
  headline: string
  description: string
  datePublished: string
  dateModified?: string
  author?: string
  imageUrl?: string
  url: string
  section?: string
}

/**
 * Article schema - for written content like podcast transcripts
 */
export function ArticleJsonLd({
  headline,
  description,
  datePublished,
  dateModified,
  author = "Hakivo",
  imageUrl,
  url,
  section,
}: ArticleJsonLdProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    datePublished,
    dateModified: dateModified || datePublished,
    author: {
      "@type": "Organization",
      name: author,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Hakivo",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  }

  if (imageUrl) {
    schema.image = imageUrl
  }

  if (section) {
    schema.articleSection = section
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

interface PersonJsonLdProps {
  name: string
  jobTitle: string
  description?: string
  imageUrl?: string
  url: string
  memberOf?: string
  workLocation?: {
    state: string
    district?: string | number
  }
}

/**
 * Person schema - for representative pages
 */
export function PersonJsonLd({
  name,
  jobTitle,
  description,
  imageUrl,
  url,
  memberOf,
  workLocation,
}: PersonJsonLdProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    jobTitle,
    url,
  }

  if (description) {
    schema.description = description
  }

  if (imageUrl) {
    schema.image = imageUrl
  }

  if (memberOf) {
    schema.memberOf = {
      "@type": "GovernmentOrganization",
      name: memberOf,
    }
  }

  if (workLocation) {
    schema.workLocation = {
      "@type": "Place",
      name: workLocation.district
        ? `${workLocation.state} District ${workLocation.district}`
        : workLocation.state,
      address: {
        "@type": "PostalAddress",
        addressRegion: workLocation.state,
        addressCountry: "US",
      },
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

interface LegislationJsonLdProps {
  name: string
  description: string
  legislationIdentifier: string // e.g., "H.R. 1234"
  datePublished?: string
  legislationDate?: string
  legislationType?: string // e.g., "Bill", "Resolution"
  legislationPassedBy?: string // e.g., "United States House of Representatives"
  sponsor?: {
    name: string
    party?: string
    state?: string
  }
  url: string
}

/**
 * Legislation schema - for bill pages
 * Uses schema.org Legislation type for government documents
 */
export function LegislationJsonLd({
  name,
  description,
  legislationIdentifier,
  datePublished,
  legislationDate,
  legislationType = "Bill",
  legislationPassedBy,
  sponsor,
  url,
}: LegislationJsonLdProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Legislation",
    name,
    description,
    legislationIdentifier,
    url,
  }

  if (datePublished) {
    schema.datePublished = datePublished
  }

  if (legislationDate) {
    schema.legislationDate = legislationDate
  }

  if (legislationType) {
    schema.legislationType = legislationType
  }

  if (legislationPassedBy) {
    schema.legislationPassedBy = {
      "@type": "GovernmentOrganization",
      name: legislationPassedBy,
    }
  }

  if (sponsor) {
    schema.sponsor = {
      "@type": "Person",
      name: sponsor.name,
      ...(sponsor.party && { affiliation: sponsor.party }),
      ...(sponsor.state && {
        workLocation: {
          "@type": "Place",
          name: sponsor.state,
        },
      }),
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

/**
 * Format seconds to ISO 8601 duration (e.g., "PT10M30S")
 */
export function formatDurationISO8601(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  let duration = "PT"
  if (hours > 0) duration += `${hours}H`
  if (minutes > 0) duration += `${minutes}M`
  if (secs > 0 || duration === "PT") duration += `${secs}S`

  return duration
}
