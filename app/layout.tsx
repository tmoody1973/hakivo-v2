import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from 'next/font/google'
import { ConditionalNav } from "@/components/conditional-nav"
import { ConditionalPlayer } from "@/components/conditional-player"
import { AuthProvider } from "@/lib/auth/auth-context"
import { SubscriptionProvider } from "@/lib/subscription/subscription-context"
import { AudioPlayerProvider } from "@/lib/audio/audio-player-context"
import { C1Provider } from "@/components/c1"
import { FeaturebaseWidget } from "@/components/featurebase"
import { PostHogProvider, PostHogPageview } from "@/lib/analytics"
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/seo/json-ld"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hakivo.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Hakivo - Understand Congress | Bills, Votes & Representatives Explained",
    template: "%s | Hakivo",
  },
  description:
    "Make sense of Congressional legislation with AI-powered summaries, podcast briefings, and representative tracking. Democracy made accessible.",
  keywords: [
    "congress",
    "legislation",
    "bills",
    "voting record",
    "representatives",
    "senators",
    "civic engagement",
    "government",
    "politics explained",
    "bill tracker",
  ],
  authors: [{ name: "Hakivo" }],
  creator: "Hakivo",
  publisher: "Hakivo",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Hakivo",
    title: "Hakivo - Understand Congress | Bills, Votes & Representatives Explained",
    description:
      "Make sense of Congressional legislation with AI-powered summaries, podcast briefings, and representative tracking. Democracy made accessible.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Hakivo - Civic Engagement Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hakivo - Understand Congress",
    description:
      "Make sense of Congressional legislation with AI-powered summaries and podcast briefings.",
    images: ["/og-image.png"],
    creator: "@hakivoapp",
  },
  alternates: {
    canonical: SITE_URL,
  },
  category: "Government & Politics",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <OrganizationJsonLd />
        <WebSiteJsonLd />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <PostHogProvider>
          <C1Provider>
            <AuthProvider>
              <SubscriptionProvider>
                <AudioPlayerProvider>
                  <PostHogPageview />
                  <div className="flex h-screen flex-col">
                    <ConditionalNav />

                    <main className="flex-1 overflow-auto pb-24">
                      {children}
                    </main>

                    <ConditionalPlayer />
                  </div>
                  <FeaturebaseWidget />
                </AudioPlayerProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </C1Provider>
        </PostHogProvider>
      </body>
    </html>
  )
}
