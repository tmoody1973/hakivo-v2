import type { Metadata } from "next";
import { BriefDetailClient } from "./brief-detail-client";

const BRIEFS_API_URL = process.env.NEXT_PUBLIC_BRIEFS_API_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzj.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hakivo.com";

interface BriefMetadata {
  id: string;
  title: string;
  headline?: string;
  interests?: string[];
  created_at: string;
  audio_url?: string;
  articles?: Array<unknown>;
}

async function getBriefData(briefId: string): Promise<BriefMetadata | null> {
  try {
    const response = await fetch(`${BRIEFS_API_URL}/briefs/${briefId}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.brief || null;
  } catch {
    return null;
  }
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const brief = await getBriefData(id);

  if (!brief) {
    return {
      title: "Brief Not Found | Hakivo",
      description: "The requested daily brief could not be found.",
    };
  }

  const dateStr = brief.created_at ? formatDate(brief.created_at) : "";
  const title = `${brief.title} | Hakivo`;

  // Build description - ensure at least 100 characters for LinkedIn
  let description = brief.headline || "";
  if (!description || description.length < 100) {
    const interestsStr = brief.interests?.slice(0, 3).join(", ") || "";
    const fallback = `Your daily congressional news brief from Hakivo covering the latest legislative updates${dateStr ? ` from ${dateStr}` : ""}${interestsStr ? `. Topics include ${interestsStr}` : ""}.`;
    description = description && description.length > fallback.length ? description : fallback;
  }

  const ogImageUrl = `${SITE_URL}/api/og/brief/${id}`;
  const pageUrl = `${SITE_URL}/briefs/${id}`;

  const keywords = [
    "daily brief",
    "congressional news",
    "legislation",
    ...(brief.interests || []),
  ].filter(Boolean);

  return {
    title,
    description: description.substring(0, 160),
    keywords: keywords as string[],
    openGraph: {
      title: brief.title,
      description: description.substring(0, 200),
      url: pageUrl,
      siteName: "Hakivo",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: brief.title,
        },
      ],
      locale: "en_US",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: brief.title,
      description: description.substring(0, 200),
      images: [ogImageUrl],
      creator: "@hakivo",
    },
    alternates: {
      canonical: pageUrl,
    },
    other: brief.audio_url ? {
      "og:audio": brief.audio_url,
      "og:audio:type": "audio/mpeg",
    } : undefined,
  };
}

export default function BriefPage() {
  return <BriefDetailClient />;
}
