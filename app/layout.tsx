import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from 'next/font/google'
import { ConditionalNav } from "@/components/conditional-nav"
import { ConditionalPlayer } from "@/components/conditional-player"
import { AuthProvider } from "@/lib/auth/auth-context"
import { AudioPlayerProvider } from "@/lib/audio/audio-player-context"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

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
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <AudioPlayerProvider>
            <div className="flex h-screen flex-col">
              <ConditionalNav />

              <main className="flex-1 overflow-auto pb-24">
                {children}
              </main>

              <ConditionalPlayer />
            </div>
          </AudioPlayerProvider>
        </AuthProvider>
        {/* Analytics component removed */}
      </body>
    </html>
  )
}
