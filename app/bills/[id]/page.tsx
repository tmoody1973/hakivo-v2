import type { Metadata } from "next";
import { BillDetailClient } from "./bill-detail-client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://svc-01kc6rbecv0s5k4yk6ksdaqyzh.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hakivo.com";

interface BillMetadata {
  id: string;
  congress: number;
  type: string;
  number: number;
  title: string;
  policyArea: string | null;
  originChamber: string | null;
  sponsor: {
    fullName: string;
    party: string;
    state: string;
  } | null;
  enrichment: {
    plainLanguageSummary?: string;
  } | null;
}

async function getBillData(billId: string): Promise<BillMetadata | null> {
  try {
    // Parse bill ID format: "119-s-2767" -> congress/type/number
    const parts = billId.split('-');
    if (parts.length !== 3) {
      console.error('[getBillData] Invalid bill ID format:', billId);
      return null;
    }
    const [congress, billType, billNumber] = parts;

    // Backend expects: /bills/:congress/:type/:number
    const response = await fetch(`${BACKEND_URL}/bills/${congress}/${billType}/${billNumber}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    if (!response.ok) {
      console.error('[getBillData] Backend returned:', response.status);
      return null;
    }
    const data = await response.json();
    return data?.bill || null;
  } catch (error) {
    console.error('[getBillData] Error fetching bill:', error);
    return null;
  }
}

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const bill = await getBillData(id);

  if (!bill) {
    return {
      title: "Bill Not Found | Hakivo",
      description: "The requested bill could not be found.",
    };
  }

  const billNumber = `${bill.type.toUpperCase()}.${bill.number}`;
  const title = `${billNumber}: ${bill.title} | Hakivo`;

  // Build description - ensure at least 100 characters for LinkedIn
  let description = bill.enrichment?.plainLanguageSummary || "";
  if (!description || description.length < 100) {
    const sponsorInfo = bill.sponsor ? ` sponsored by ${bill.sponsor.fullName} (${bill.sponsor.party}-${bill.sponsor.state})` : "";
    const policyInfo = bill.policyArea ? ` in ${bill.policyArea}` : "";
    const fallback = `${billNumber}: ${bill.title}. Learn about this legislation from the ${bill.congress}th Congress${sponsorInfo}${policyInfo}. Track bills, read AI summaries, and stay informed on Hakivo.`;
    description = description && description.length > fallback.length ? description : fallback;
  }

  const ogImageUrl = `${SITE_URL}/api/og/bill/${id}`;
  const pageUrl = `${SITE_URL}/bills/${id}`;

  return {
    title,
    description: description.substring(0, 160),
    keywords: [
      bill.type.toUpperCase(),
      `${bill.congress}th Congress`,
      bill.policyArea,
      bill.originChamber,
      "legislation",
      "congress",
      "bill tracking",
    ].filter(Boolean) as string[],
    openGraph: {
      title: `${billNumber}: ${bill.title}`,
      description: description.substring(0, 200),
      url: pageUrl,
      siteName: "Hakivo",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${billNumber} - ${bill.title}`,
        },
      ],
      locale: "en_US",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${billNumber}: ${bill.title}`,
      description: description.substring(0, 200),
      images: [ogImageUrl],
      creator: "@hakivo",
    },
    alternates: {
      canonical: pageUrl,
    },
    other: {
      "article:section": bill.policyArea || "Legislation",
      "article:tag": bill.type.toUpperCase(),
    },
  };
}

export default function BillPage() {
  return <BillDetailClient />;
}
