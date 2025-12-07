import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import Stripe from 'stripe';

// Stripe price ID for Hakivo Pro ($12/month)
const HAKIVO_PRO_PRICE_ID = 'price_1Sbl9Z2SDNFB3sqEVZH1v8Yr';

// Free tier limits
const FREE_TIER_BRIEFS_PER_MONTH = 3;
const FREE_TIER_TRACKED_BILLS = 3;
const FREE_TIER_FOLLOWED_MEMBERS = 3;

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());

// Manual CORS middleware
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin') || '';
  const allowedOrigins = ['http://localhost:3000', 'https://hakivo-v2.netlify.app'];

  if (allowedOrigins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
  } else {
    c.header('Access-Control-Allow-Origin', '*');
  }
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Max-Age', '600');

  if (c.req.method === 'OPTIONS') {
    return c.text('', 200);
  }

  await next();
});

// Health check
app.get('/api/subscription/health', (c) => {
  return c.json({ status: 'ok', service: 'subscription-api', timestamp: new Date().toISOString() });
});

/**
 * GET /api/subscription/status/:userId
 * Get user's subscription status and limits
 */
app.get('/api/subscription/status/:userId', async (c) => {
  const db = c.env.APP_DB;
  const userId = c.req.param('userId');

  try {
    const user = await db
      .prepare(`
        SELECT
          id,
          email,
          subscription_status,
          stripe_customer_id,
          stripe_subscription_id,
          subscription_started_at,
          subscription_ends_at,
          briefs_used_this_month,
          briefs_reset_at
        FROM users WHERE id = ?
      `)
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const subscriptionStatus = user.subscription_status as string || 'free';
    const isPro = subscriptionStatus === 'active';

    // Get tracked bills count
    const trackedBills = await db
      .prepare('SELECT COUNT(*) as count FROM bill_tracking WHERE user_id = ?')
      .bind(userId)
      .first();

    // Get followed members count
    const followedMembers = await db
      .prepare('SELECT COUNT(*) as count FROM user_member_following WHERE user_id = ?')
      .bind(userId)
      .first();

    // Calculate briefs remaining
    const briefsUsed = user.briefs_used_this_month as number || 0;
    const briefsLimit = isPro ? Infinity : FREE_TIER_BRIEFS_PER_MONTH;
    const briefsRemaining = isPro ? 'unlimited' : Math.max(0, briefsLimit - briefsUsed);

    // Calculate limits
    const trackedBillsCount = (trackedBills?.count as number) || 0;
    const followedMembersCount = (followedMembers?.count as number) || 0;

    return c.json({
      userId,
      subscription: {
        status: subscriptionStatus,
        isPro,
        stripeCustomerId: user.stripe_customer_id || null,
        startedAt: user.subscription_started_at ? new Date(user.subscription_started_at as number).toISOString() : null,
        endsAt: user.subscription_ends_at ? new Date(user.subscription_ends_at as number).toISOString() : null
      },
      usage: {
        briefs: {
          used: briefsUsed,
          limit: isPro ? 'unlimited' : FREE_TIER_BRIEFS_PER_MONTH,
          remaining: briefsRemaining,
          resetAt: user.briefs_reset_at ? new Date(user.briefs_reset_at as number).toISOString() : null
        },
        trackedBills: {
          count: trackedBillsCount,
          limit: isPro ? 'unlimited' : FREE_TIER_TRACKED_BILLS,
          canTrackMore: isPro || trackedBillsCount < FREE_TIER_TRACKED_BILLS
        },
        followedMembers: {
          count: followedMembersCount,
          limit: isPro ? 'unlimited' : FREE_TIER_FOLLOWED_MEMBERS,
          canFollowMore: isPro || followedMembersCount < FREE_TIER_FOLLOWED_MEMBERS
        }
      },
      features: {
        dailyBriefing: isPro,
        realtimeAlerts: isPro,
        audioDigests: isPro,
        unlimitedBriefs: isPro,
        unlimitedTracking: isPro
      }
    });
  } catch (error) {
    console.error('[Subscription API] Error getting status:', error);
    return c.json({
      error: 'Failed to get subscription status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/subscription/create-checkout
 * Create Stripe checkout session for Pro upgrade
 */
app.post('/api/subscription/create-checkout', async (c) => {
  const db = c.env.APP_DB;

  try {
    const body = await c.req.json();
    const { userId, successUrl, cancelUrl } = body;

    if (!userId) {
      return c.json({ error: 'userId is required' }, 400);
    }

    // Get user
    const user = await db
      .prepare('SELECT id, email, stripe_customer_id FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Check if already subscribed
    const subscriptionStatus = await db
      .prepare('SELECT subscription_status FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (subscriptionStatus?.subscription_status === 'active') {
      return c.json({ error: 'User already has an active subscription' }, 400);
    }

    // Initialize Stripe (using Raindrop's built-in payment context if available)
    // For now, we'll return a payment URL that the frontend can redirect to
    // The actual Stripe checkout will be handled by Raindrop's payment system

    // Build checkout URL with metadata
    const checkoutParams = new URLSearchParams({
      userId,
      email: user.email as string,
      priceId: HAKIVO_PRO_PRICE_ID,
      successUrl: successUrl || 'https://hakivo-v2.netlify.app/dashboard?upgrade=success',
      cancelUrl: cancelUrl || 'https://hakivo-v2.netlify.app/pricing?upgrade=canceled'
    });

    // Return checkout info
    // The frontend will use this to redirect to Stripe checkout
    return c.json({
      success: true,
      checkout: {
        priceId: HAKIVO_PRO_PRICE_ID,
        amount: 1200, // $12.00 in cents
        currency: 'usd',
        interval: 'month',
        metadata: {
          userId,
          email: user.email
        }
      },
      // If using Raindrop's built-in payment, this would be handled differently
      // For now, we indicate that checkout needs to be completed via frontend
      requiresFrontendCheckout: true,
      message: 'Use Stripe.js on frontend to create checkout session with this configuration'
    });
  } catch (error) {
    console.error('[Subscription API] Error creating checkout:', error);
    return c.json({
      error: 'Failed to create checkout session',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/subscription/create-portal
 * Create Stripe billing portal session for managing subscription
 */
app.post('/api/subscription/create-portal', async (c) => {
  const db = c.env.APP_DB;

  try {
    const body = await c.req.json();
    const { userId, returnUrl } = body;

    if (!userId) {
      return c.json({ error: 'userId is required' }, 400);
    }

    // Get user's Stripe customer ID
    const user = await db
      .prepare('SELECT stripe_customer_id FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (!user.stripe_customer_id) {
      return c.json({ error: 'User has no Stripe customer account' }, 400);
    }

    // Return portal configuration
    // The actual portal session would be created via Stripe API
    return c.json({
      success: true,
      portal: {
        customerId: user.stripe_customer_id,
        returnUrl: returnUrl || 'https://hakivo-v2.netlify.app/settings/subscription'
      },
      requiresFrontendPortal: true,
      message: 'Use Stripe.js on frontend to create portal session with this customer ID'
    });
  } catch (error) {
    console.error('[Subscription API] Error creating portal:', error);
    return c.json({
      error: 'Failed to create portal session',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/subscription/use-brief/:userId
 * Increment brief usage counter for free tier users
 * Returns whether the user can generate more briefs
 */
app.post('/api/subscription/use-brief/:userId', async (c) => {
  const db = c.env.APP_DB;
  const userId = c.req.param('userId');

  try {
    // Get current usage
    const user = await db
      .prepare(`
        SELECT
          subscription_status,
          briefs_used_this_month,
          briefs_reset_at
        FROM users WHERE id = ?
      `)
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const isPro = user.subscription_status === 'active';

    // Pro users have unlimited briefs
    if (isPro) {
      return c.json({
        success: true,
        canGenerateMore: true,
        isPro: true,
        usage: {
          used: 'unlimited',
          limit: 'unlimited',
          remaining: 'unlimited'
        }
      });
    }

    const now = Date.now();
    let briefsUsed = user.briefs_used_this_month as number || 0;
    let resetAt = user.briefs_reset_at as number || 0;

    // Check if we need to reset (new month)
    const lastReset = new Date(resetAt);
    const currentDate = new Date();

    if (lastReset.getMonth() !== currentDate.getMonth() ||
        lastReset.getFullYear() !== currentDate.getFullYear()) {
      // Reset for new month
      briefsUsed = 0;
      resetAt = now;
    }

    // Check if limit reached
    if (briefsUsed >= FREE_TIER_BRIEFS_PER_MONTH) {
      return c.json({
        success: false,
        canGenerateMore: false,
        isPro: false,
        usage: {
          used: briefsUsed,
          limit: FREE_TIER_BRIEFS_PER_MONTH,
          remaining: 0
        },
        error: 'Monthly brief limit reached',
        upgradeUrl: '/pricing'
      }, 403);
    }

    // Increment usage
    briefsUsed += 1;

    await db
      .prepare(`
        UPDATE users SET
          briefs_used_this_month = ?,
          briefs_reset_at = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .bind(briefsUsed, resetAt, now, userId)
      .run();

    return c.json({
      success: true,
      canGenerateMore: briefsUsed < FREE_TIER_BRIEFS_PER_MONTH,
      isPro: false,
      usage: {
        used: briefsUsed,
        limit: FREE_TIER_BRIEFS_PER_MONTH,
        remaining: FREE_TIER_BRIEFS_PER_MONTH - briefsUsed
      }
    });
  } catch (error) {
    console.error('[Subscription API] Error using brief:', error);
    return c.json({
      error: 'Failed to track brief usage',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/subscription/check-limit/:userId
 * Check if user can perform action based on their subscription
 * Body: { action: 'track_bill' | 'follow_member' | 'generate_brief' }
 */
app.post('/api/subscription/check-limit/:userId', async (c) => {
  const db = c.env.APP_DB;
  const userId = c.req.param('userId');

  try {
    const body = await c.req.json();
    const { action } = body;

    if (!action) {
      return c.json({ error: 'action is required' }, 400);
    }

    // Get user subscription status
    const user = await db
      .prepare(`
        SELECT
          subscription_status,
          briefs_used_this_month
        FROM users WHERE id = ?
      `)
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const isPro = user.subscription_status === 'active';

    // Pro users can do everything
    if (isPro) {
      return c.json({
        allowed: true,
        isPro: true,
        reason: null
      });
    }

    // Check specific limits for free tier
    let allowed = true;
    let reason = null;
    let currentCount = 0;
    let limit = 0;

    switch (action) {
      case 'track_bill': {
        const result = await db
          .prepare('SELECT COUNT(*) as count FROM bill_tracking WHERE user_id = ?')
          .bind(userId)
          .first();
        currentCount = (result?.count as number) || 0;
        limit = FREE_TIER_TRACKED_BILLS;
        allowed = currentCount < limit;
        reason = allowed ? null : `Free tier limited to ${limit} tracked bills. Upgrade to Pro for unlimited.`;
        break;
      }

      case 'follow_member': {
        const result = await db
          .prepare('SELECT COUNT(*) as count FROM user_member_following WHERE user_id = ?')
          .bind(userId)
          .first();
        currentCount = (result?.count as number) || 0;
        limit = FREE_TIER_FOLLOWED_MEMBERS;
        allowed = currentCount < limit;
        reason = allowed ? null : `Free tier limited to ${limit} followed members. Upgrade to Pro for unlimited.`;
        break;
      }

      case 'generate_brief': {
        currentCount = user.briefs_used_this_month as number || 0;
        limit = FREE_TIER_BRIEFS_PER_MONTH;
        allowed = currentCount < limit;
        reason = allowed ? null : `Free tier limited to ${limit} briefs per month. Upgrade to Pro for unlimited.`;
        break;
      }

      case 'daily_briefing':
      case 'realtime_alerts':
        allowed = false;
        reason = 'This feature requires Hakivo Pro subscription.';
        break;

      default:
        return c.json({ error: `Unknown action: ${action}` }, 400);
    }

    return c.json({
      allowed,
      isPro: false,
      reason,
      currentCount,
      limit,
      upgradeUrl: '/pricing'
    });
  } catch (error) {
    console.error('[Subscription API] Error checking limit:', error);
    return c.json({
      error: 'Failed to check limit',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
