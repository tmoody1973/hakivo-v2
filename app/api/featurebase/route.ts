import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

/**
 * POST /api/featurebase
 * Generate signed JWT for Featurebase SSO
 * Accepts user data from authenticated client
 * @see https://help.featurebase.app/articles/5257986-creating-and-signing-a-jwt
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, firstName, lastName } = body

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'userId and email are required' },
        { status: 400 }
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
    const userData = {
      name: firstName && lastName
        ? `${firstName} ${lastName}`
        : email,
      email,
      userId,
    }

    // Sign JWT with HS256 algorithm (required by Featurebase)
    const jwtToken = jwt.sign(userData, secret, { algorithm: 'HS256' })

    return NextResponse.json({ jwtToken })
  } catch (error) {
    console.error('[FEATUREBASE] JWT generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate JWT' },
      { status: 500 }
    )
  }
}
