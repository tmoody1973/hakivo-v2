import type { Metadata } from "next";
import { RepresentativeDetailClient } from "./representative-detail-client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://svc-01k66gywmx8x4r0w31fdjjfekf.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hakivo.com";

interface MemberMetadata {
  bioguideId: string;
  fullName: string;
  party: string;
  chamber: string;
  state: string;
  district?: number;
  depiction?: {
    imageUrl?: string;
  };
}

async function getMemberData(bioguideId: string): Promise<MemberMetadata | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/members/${bioguideId}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.member || null;
  } catch {
    return null;
  }
}

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const member = await getMemberData(id);

  if (!member) {
    return {
      title: "Representative Not Found | Hakivo",
      description: "The requested representative could not be found.",
    };
  }

  const title = member.chamber === "House"
    ? `${member.fullName} - U.S. Representative from ${member.state} | Hakivo`
    : `${member.fullName} - U.S. Senator from ${member.state} | Hakivo`;

  const partyFull = member.party === "D" ? "Democrat" : member.party === "R" ? "Republican" : member.party;
  const location = member.chamber === "House" && member.district
    ? `${member.state} District ${member.district}`
    : member.state;

  const description = `Learn about ${member.fullName}, ${partyFull} ${member.chamber === "House" ? "Representative" : "Senator"} from ${location}. View voting records, sponsored legislation, and more on Hakivo.`;

  const ogImageUrl = `${SITE_URL}/api/og/representative/${id}`;
  const pageUrl = `${SITE_URL}/representatives/${id}`;

  return {
    title,
    description: description.substring(0, 160),
    keywords: [
      member.fullName,
      partyFull,
      member.state,
      member.chamber,
      "congress",
      "representative",
      "senator",
      "voting record",
    ].filter(Boolean) as string[],
    openGraph: {
      title: `${member.fullName} - ${member.chamber === "House" ? "U.S. Representative" : "U.S. Senator"}`,
      description: description.substring(0, 200),
      url: pageUrl,
      siteName: "Hakivo",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${member.fullName} - ${partyFull} from ${member.state}`,
        },
      ],
      locale: "en_US",
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `${member.fullName} - ${member.chamber === "House" ? "U.S. Representative" : "U.S. Senator"}`,
      description: description.substring(0, 200),
      images: [ogImageUrl],
      creator: "@hakivo",
    },
    alternates: {
      canonical: pageUrl,
    },
  };
}

export default function RepresentativePage() {
  return <RepresentativeDetailClient />;
}
