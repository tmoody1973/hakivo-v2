import type { Metadata } from "next";
import { BriefDetailClient } from "./brief-detail-client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://svc-01k66gywmx8x4r0w31fdjjfekf.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hakivo.com";

interface BriefMetadata {
  id: string;
  title: string;
  headline?: string;
  interests?: string[];
  createdAt: string;
  audioUrl?: string;
  articles?: Array<unknown>;
}

async function getBriefData(briefId: string): Promise<BriefMetadata | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/briefs/${briefId}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data || null;
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

  const dateStr = brief.createdAt ? formatDate(brief.createdAt) : "";
  const title = `${brief.title} | Hakivo`;
  const description = brief.headline ||
    `Daily congressional brief from ${dateStr}. ${brief.interests?.slice(0, 3).join(", ") || ""}`.trim();

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
    other: brief.audioUrl ? {
      "og:audio": brief.audioUrl,
      "og:audio:type": "audio/mpeg",
    } : undefined,
  };
}

export default function BriefPage() {
  return <BriefDetailClient />;
}
