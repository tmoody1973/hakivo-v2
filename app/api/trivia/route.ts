import { NextResponse } from 'next/server';

// Dashboard service URL (contains the trivia endpoint)
// Uses NEXT_PUBLIC_DASHBOARD_API_URL from .env.local
const DASHBOARD_API_URL = process.env.NEXT_PUBLIC_DASHBOARD_API_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzm.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

/**
 * GET /api/trivia
 * Get congressional/legislative trivia fact
 * Used to entertain users while briefs are generating
 */
export async function GET() {
  try {
    console.log('[API /trivia] Fetching trivia from dashboard service...');

    const response = await fetch(`${DASHBOARD_API_URL}/trivia`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[API /trivia] Error response:', response.status);
      // Return fallback trivia on error
      return NextResponse.json({
        success: true,
        fact: 'Did you know? The Capitol Building has 540 rooms and approximately 850 doorways!',
        category: 'Capitol Building',
        fallback: true
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /trivia] Caught error:', error);
    // Return fallback trivia on error
    return NextResponse.json({
      success: true,
      fact: 'Did you know? Congress has passed over 20,000 laws since the first Congress in 1789!',
      category: 'Legislative Records',
      fallback: true
    });
  }
}
