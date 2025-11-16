import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from 'next/font/google'
import { ConditionalNav } from "@/components/conditional-nav"
import { PersistentAudioPlayer } from "@/components/persistent-audio-player"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Hakivo - Civic Engagement Platform",
  description:
    "Transform Congressional legislation into personalized audio briefings and interactive civic engagement tools",
  generator: "v0.app",
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
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <div className="flex h-screen flex-col">
          <ConditionalNav />
          
          <main className="flex-1 overflow-auto pb-24">
            {children}
          </main>

          <PersistentAudioPlayer />
        </div>
        {/* Analytics component removed */}
      </body>
    </html>
  )
}
