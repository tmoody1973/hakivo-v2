import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/spreaker/callback
 * OAuth callback handler for Spreaker authorization
 *
 * Receives the authorization code from Spreaker and forwards it to
 * the db-admin service to exchange for access tokens.
 */

const DB_ADMIN_URL = process.env.DB_ADMIN_URL ||
  'https://svc-01kbwj6m2fjpvfp9jj2xpefwqm.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    console.error('[Spreaker OAuth] Error:', error, errorDescription);
    return NextResponse.redirect(
      new URL(`/admin/spreaker?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || '')}`, request.url)
    );
  }

  // Validate required params
  if (!code) {
    console.error('[Spreaker OAuth] Missing authorization code');
    return NextResponse.redirect(
      new URL('/admin/spreaker?error=missing_code', request.url)
    );
  }

  try {
    // Forward to db-admin service to exchange code for tokens
    const response = await fetch(`${DB_ADMIN_URL}/spreaker/exchange-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, state }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error('[Spreaker OAuth] Token exchange failed:', result);
      return NextResponse.redirect(
        new URL(`/admin/spreaker?error=token_exchange_failed&message=${encodeURIComponent(result.error || 'Unknown error')}`, request.url)
      );
    }

    console.log('[Spreaker OAuth] Successfully authenticated with Spreaker');

    // Redirect to success page
    return NextResponse.redirect(
      new URL('/admin/spreaker?success=true', request.url)
    );

  } catch (err) {
    console.error('[Spreaker OAuth] Callback error:', err);
    return NextResponse.redirect(
      new URL(`/admin/spreaker?error=callback_failed&message=${encodeURIComponent(err instanceof Error ? err.message : 'Unknown error')}`, request.url)
    );
  }
}
