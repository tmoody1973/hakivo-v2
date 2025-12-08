"use client"

import Link from 'next/link'
import { useAuth } from '@/lib/auth/auth-context'

export default function NotFound() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
        <p className="text-muted-foreground mb-8">
          The page you are looking for does not exist.
        </p>
        <Link
          href={isAuthenticated ? "/dashboard" : "/"}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {isAuthenticated ? "Return to Dashboard" : "Return to Home"}
        </Link>
      </div>
    </div>
  )
}
