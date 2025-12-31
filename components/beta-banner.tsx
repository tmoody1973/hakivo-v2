'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export function BetaBanner() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if user has dismissed the banner
    const dismissed = localStorage.getItem('beta-banner-dismissed')
    if (!dismissed) {
      setIsVisible(true)
    }
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    // Remember dismissal for 7 days
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + 7)
    localStorage.setItem('beta-banner-dismissed', expiryDate.toISOString())
  }

  if (!isVisible) return null

  return (
    <div className="relative bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 text-center text-sm font-medium">
      <div className="flex items-center justify-center gap-2">
        <span className="text-lg">🚧</span>
        <span>
          <strong>BETA:</strong> We're building in public. Things might break. That's how innovation happens.{' '}
          <a
            href="https://hakivo.featurebase.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold hover:text-purple-100 transition-colors"
          >
            Report issues & request features →
          </a>
        </span>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}