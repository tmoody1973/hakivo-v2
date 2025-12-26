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
import { PostHogProvider, PostHogPageview, MixpanelProvider, MixpanelPageview } from "@/lib/analytics"
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
        {/* Mixpanel Analytics */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function (f, b) { if (!b.__SV) { var e, g, i, h; window.mixpanel = b; b._i = []; b.init = function (e, f, c) { function g(a, d) { var b = d.split("."); 2 == b.length && ((a = a[b[0]]), (d = b[1])); a[d] = function () { a.push([d].concat(Array.prototype.slice.call(arguments, 0))); }; } var a = b; "undefined" !== typeof c ? (a = b[c] = []) : (c = "mixpanel"); a.people = a.people || []; a.toString = function (a) { var d = "mixpanel"; "mixpanel" !== c && (d += "." + c); a || (d += " (stub)"); return d; }; a.people.toString = function () { return a.toString(1) + ".people (stub)"; }; i = "disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" "); for (h = 0; h < i.length; h++) g(a, i[h]); var j = "set set_once union unset remove delete".split(" "); a.get_group = function () { function b(c) { d[c] = function () { call2_args = arguments; call2 = [c].concat(Array.prototype.slice.call(call2_args, 0)); a.push([e, call2]); }; } for (var d = {}, e = ["get_group"].concat(Array.prototype.slice.call(arguments, 0)), c = 0; c < j.length; c++) b(j[c]); return d; }; b._i.push([e, f, c]); }; b.__SV = 1.2; e = f.createElement("script"); e.type = "text/javascript"; e.async = !0; e.src = "undefined" !== typeof MIXPANEL_CUSTOM_LIB_URL ? MIXPANEL_CUSTOM_LIB_URL : "file:" === f.location.protocol && "//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js".match(/^\\/\\//) ? "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js" : "//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js"; g = f.getElementsByTagName("script")[0]; g.parentNode.insertBefore(e, g); } })(document, window.mixpanel || []);`
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <PostHogProvider>
          <MixpanelProvider>
            <C1Provider>
              <AuthProvider>
                <SubscriptionProvider>
                  <AudioPlayerProvider>
                    <PostHogPageview />
                    <MixpanelPageview />
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
          </MixpanelProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}
