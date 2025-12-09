import { NextResponse } from 'next/server'
import { withAuth, getSignInUrl } from '@workos-inc/authkit-nextjs'
import jwt from 'jsonwebtoken'

/**
 * Generate signed JWT for Featurebase SSO
 * Uses HS256 algorithm to sign user data with the JWT secret
 * @see https://help.featurebase.app/articles/5257986-creating-and-signing-a-jwt
 */
export async function GET() {
  const { user } = await withAuth()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', signInUrl: await getSignInUrl() },
      { status: 401 }
    )
  }

  const secret = process.env.FEATUREBASE_JWT_SECRET
  if (!secret) {
    console.error('[FEATUREBASE] Missing FEATUREBASE_JWT_SECRET environment variable')
    return NextResponse.json(
      { error: 'Featurebase not configured' },
      { status: 500 }
    )
  }

  // Build user data payload for JWT
  // Both email and userId should be provided when possible
  const userData = {
    name: user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.email,
    email: user.email,
    userId: user.id,
    // Optional: add created timestamp
    ...(user.createdAt && { createdAt: user.createdAt }),
  }

  // Sign JWT with HS256 algorithm (required by Featurebase)
  const jwtToken = jwt.sign(userData, secret, { algorithm: 'HS256' })

  return NextResponse.json({ jwtToken })
}
