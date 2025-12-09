"use client"

import { useEffect, useState } from "react"
import Script from "next/script"
import { useAuth } from "@/lib/auth/auth-context"

declare global {
  interface Window {
    Featurebase: (...args: unknown[]) => void
  }
}

/**
 * Featurebase Messenger with JWT SSO Authentication
 * Uses server-side signed JWT to securely authenticate users
 * @see https://help.featurebase.app/articles/5257986-creating-and-signing-a-jwt
 */
export function FeaturebaseWidget() {
  const { isLoading, isAuthenticated, user } = useAuth()
  const [jwtToken, setJwtToken] = useState<string | null>(null)

  // Fetch signed JWT from server when user is authenticated
  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated || !user) {
      setJwtToken(null)
      return
    }

    const fetchJwt = async () => {
      try {
        const response = await fetch("/api/featurebase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          }),
        })
        if (response.ok) {
          const data = await response.json()
          setJwtToken(data.jwtToken)
        }
      } catch (error) {
        console.error("[Featurebase] Failed to fetch JWT:", error)
      }
    }

    fetchJwt()
  }, [isAuthenticated, user, isLoading])

  useEffect(() => {
    const win = window

    // Initialize Featurebase if it doesn't exist
    if (typeof win.Featurebase !== "function") {
      win.Featurebase = function (...args: unknown[]) {
        (win.Featurebase as unknown as { q: unknown[] }).q =
          (win.Featurebase as unknown as { q: unknown[] }).q || []
        ;(win.Featurebase as unknown as { q: unknown[] }).q.push(args)
      }
    }

    // Don't boot until we have JWT for authenticated users
    if (isAuthenticated && !jwtToken) {
      return
    }

    // Boot Featurebase messenger with configuration
    const bootConfig: Record<string, unknown> = {
      appId: "6935fe78703bd032a636d24f",
      theme: "dark",
      language: "en",
    }

    // Add JWT token for authenticated users (secure SSO)
    if (jwtToken) {
      bootConfig.jwtToken = jwtToken
    }

    win.Featurebase("boot", bootConfig)
  }, [isAuthenticated, jwtToken])

  return (
    <Script
      src="https://do.featurebase.app/js/sdk.js"
      id="featurebase-sdk"
      strategy="afterInteractive"
    />
  )
}
