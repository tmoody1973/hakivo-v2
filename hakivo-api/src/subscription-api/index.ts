import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import Stripe from 'stripe';

// Stripe price ID for Hakivo Pro ($12/month) - LIVE MODE
// Previous test mode ID: price_1SbrvvCpozUWtHfyCFE5Lyur
const HAKIVO_PRO_PRICE_ID = 'price_1SlFRECpozUWtHfykQIqPv28';

// Free tier limits
const FREE_TIER_BRIEFS_PER_MONTH = 3;
const FREE_TIER_TRACKED_BILLS = 3;
const FREE_TIER_FOLLOWED_MEMBERS = 3;
const FREE_TIER_ARTIFACTS_PER_MONTH = 3;

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
 * Auto-syncs from Stripe if there's a customer ID but status is not 'active'
 */
app.get('/api/subscription/status/:userId', async (c) => {
  const db = c.env.APP_DB;
  const userId = c.req.param('userId');

  try {
    let user = await db
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

    let subscriptionStatus = user.subscription_status as string || 'free';

    // Auto-sync from Stripe if user has customer ID but status is not 'active'
    // This handles cases where the webhook failed to update the database
    if (user.stripe_customer_id && subscriptionStatus !== 'active') {
      try {
        const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
          apiVersion: '2025-11-17.clover',
        });

        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripe_customer_id as string,
          status: 'active',
          limit: 1,
        });

        if (subscriptions.data.length > 0 && subscriptions.data[0]) {
          // User has active subscription in Stripe - sync to DB
          const latestSub = subscriptions.data[0];
          const now = Date.now();

          await db
            .prepare(`
              UPDATE users SET
                subscription_status = 'active',
                stripe_subscription_id = ?,
                subscription_started_at = COALESCE(subscription_started_at, ?),
                updated_at = ?
              WHERE id = ?
            `)
            .bind(latestSub.id, now, now, userId)
            .run();

          console.log(`[Subscription API] Auto-synced subscription for user ${userId} from Stripe`);
          subscriptionStatus = 'active';

          // Re-fetch user data after sync
          user = await db
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
        }
      } catch (stripeError) {
        console.error('[Subscription API] Error auto-syncing from Stripe:', stripeError);
        // Continue with existing data if Stripe sync fails
      }
    }

    // Also check by email if no customer ID but email exists
    if (!user?.stripe_customer_id && user?.email && subscriptionStatus !== 'active') {
      try {
        const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
          apiVersion: '2025-11-17.clover',
        });

        const customers = await stripe.customers.list({
          email: user.email as string,
          limit: 1,
        });

        if (customers.data.length > 0 && customers.data[0]) {
          const customerId = customers.data[0].id;

          const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: 'active',
            limit: 1,
          });

          if (subscriptions.data.length > 0 && subscriptions.data[0]) {
            const latestSub = subscriptions.data[0];
            const now = Date.now();

            await db
              .prepare(`
                UPDATE users SET
                  subscription_status = 'active',
                  stripe_customer_id = ?,
                  stripe_subscription_id = ?,
                  subscription_started_at = COALESCE(subscription_started_at, ?),
                  updated_at = ?
                WHERE id = ?
              `)
              .bind(customerId, latestSub.id, now, now, userId)
              .run();

            console.log(`[Subscription API] Auto-synced subscription for user ${userId} by email lookup`);
            subscriptionStatus = 'active';

            // Re-fetch user data after sync
            user = await db
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
          }
        }
      } catch (stripeError) {
        console.error('[Subscription API] Error auto-syncing by email:', stripeError);
      }
    }

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

    // Get artifacts created this month
    const currentDate = new Date();
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getTime();
    const artifactsThisMonth = await db
      .prepare('SELECT COUNT(*) as count FROM artifacts WHERE user_id = ? AND created_at >= ?')
      .bind(userId, monthStart)
      .first();

    // Count briefs created this month from the briefs table (more accurate than counter)
    const briefsThisMonth = await db
      .prepare(`
        SELECT COUNT(*) as count FROM briefs
        WHERE user_id = ?
          AND created_at >= ?
          AND status IN ('completed', 'script_ready', 'processing', 'audio_processing')
      `)
      .bind(userId, monthStart)
      .first();

    // Calculate briefs remaining - use actual count from briefs table
    const briefsUsed = (briefsThisMonth?.count as number) || 0;
    const briefsLimit = isPro ? Infinity : FREE_TIER_BRIEFS_PER_MONTH;
    const briefsRemaining = isPro ? 'unlimited' : Math.max(0, briefsLimit - briefsUsed);

    // Calculate limits
    const trackedBillsCount = (trackedBills?.count as number) || 0;
    const followedMembersCount = (followedMembers?.count as number) || 0;
    const artifactsUsed = (artifactsThisMonth?.count as number) || 0;
    const artifactsRemaining = isPro ? 'unlimited' : Math.max(0, FREE_TIER_ARTIFACTS_PER_MONTH - artifactsUsed);

    // Ensure user is not null (should never be after initial check, but TypeScript needs this)
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

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
        artifacts: {
          used: artifactsUsed,
          limit: isPro ? 'unlimited' : FREE_TIER_ARTIFACTS_PER_MONTH,
          remaining: artifactsRemaining,
          canCreateMore: isPro || artifactsUsed < FREE_TIER_ARTIFACTS_PER_MONTH
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
        unlimitedTracking: isPro,
        unlimitedArtifacts: isPro
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

    // Check if already subscribed in our DB
    const subscriptionStatus = await db
      .prepare('SELECT subscription_status, stripe_customer_id FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (subscriptionStatus?.subscription_status === 'active') {
      return c.json({ error: 'User already has an active subscription' }, 400);
    }

    // Initialize Stripe
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover',
    });

    // Check if user has an active subscription in Stripe (even if our DB doesn't know)
    if (subscriptionStatus?.stripe_customer_id) {
      const existingSubscriptions = await stripe.subscriptions.list({
        customer: subscriptionStatus.stripe_customer_id as string,
        status: 'active',
        limit: 1,
      });

      if (existingSubscriptions.data.length > 0 && existingSubscriptions.data[0]) {
        // User already has active subscription in Stripe - sync our DB
        const existingSub = existingSubscriptions.data[0];
        const now = Date.now();
        await db
          .prepare(`
            UPDATE users SET
              subscription_status = 'active',
              stripe_subscription_id = ?,
              subscription_started_at = COALESCE(subscription_started_at, ?),
              updated_at = ?
            WHERE id = ?
          `)
          .bind(existingSub.id, now, now, userId)
          .run();

        return c.json({
          error: 'You already have an active subscription. Your status has been synced.',
          alreadySubscribed: true
        }, 400);
      }
    }

    // Continue with checkout creation...
    // Create or retrieve Stripe customer
    let customerId = user.stripe_customer_id as string | null;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email as string,
        metadata: {
          userId: userId,
        },
      });
      customerId = customer.id;

      // Save customer ID to database
      await db
        .prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?')
        .bind(customerId, userId)
        .run();
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: HAKIVO_PRO_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || 'https://hakivo-v2.netlify.app/settings?tab=subscription&upgrade=success',
      cancel_url: cancelUrl || 'https://hakivo-v2.netlify.app/settings?tab=subscription&upgrade=canceled',
      metadata: {
        userId: userId,
      },
      subscription_data: {
        metadata: {
          userId: userId,
        },
      },
    });

    // Return checkout URL
    return c.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
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

    // Initialize Stripe
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover',
    });

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id as string,
      return_url: returnUrl || 'https://hakivo-v2.netlify.app/settings?tab=subscription',
    });

    return c.json({
      success: true,
      portalUrl: session.url,
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
 * POST /api/subscription/admin/activate/:userId
 * Admin endpoint to manually activate a user's subscription
 * Used when webhook fails or for manual overrides
 * Requires admin secret in header for security
 */
app.post('/api/subscription/admin/activate/:userId', async (c) => {
  const db = c.env.APP_DB;
  const userId = c.req.param('userId');

  try {
    // Simple security check - require admin secret
    const adminSecret = c.req.header('X-Admin-Secret');
    if (adminSecret !== 'hakivo-admin-2024') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const { stripeCustomerId, stripeSubscriptionId } = body;

    // Update user's subscription status to active
    const now = Date.now();

    await db
      .prepare(`
        UPDATE users SET
          subscription_status = 'active',
          stripe_customer_id = COALESCE(?, stripe_customer_id),
          stripe_subscription_id = COALESCE(?, stripe_subscription_id),
          subscription_started_at = COALESCE(subscription_started_at, ?),
          updated_at = ?
        WHERE id = ?
      `)
      .bind(
        stripeCustomerId || null,
        stripeSubscriptionId || null,
        now,
        now,
        userId
      )
      .run();

    // Verify the update
    const user = await db
      .prepare('SELECT id, email, subscription_status, stripe_customer_id FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    console.log(`[Admin] Manually activated subscription for user ${userId}`);

    return c.json({
      success: true,
      message: 'Subscription activated successfully',
      user: {
        id: user.id,
        email: user.email,
        subscriptionStatus: user.subscription_status,
        stripeCustomerId: user.stripe_customer_id
      }
    });
  } catch (error) {
    console.error('[Subscription API] Error activating subscription:', error);
    return c.json({
      error: 'Failed to activate subscription',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/subscription/sync/:userId
 * Sync subscription status from Stripe to database
 * Useful when webhook fails or for manual sync
 */
app.post('/api/subscription/sync/:userId', async (c) => {
  const db = c.env.APP_DB;
  const userId = c.req.param('userId');

  try {
    // Get user
    const user = await db
      .prepare('SELECT id, email, stripe_customer_id, subscription_status FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // If no Stripe customer ID, check if we can find one by email
    let customerId = user.stripe_customer_id as string | null;

    // Initialize Stripe
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover',
    });

    // If no customer ID, try to find by email
    if (!customerId && user.email) {
      const customers = await stripe.customers.list({
        email: user.email as string,
        limit: 1,
      });
      if (customers.data.length > 0 && customers.data[0]) {
        customerId = customers.data[0].id;
        // Save the customer ID
        await db
          .prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?')
          .bind(customerId, userId)
          .run();
      }
    }

    if (!customerId) {
      return c.json({
        success: false,
        message: 'No Stripe customer found for this user',
        currentStatus: user.subscription_status
      });
    }

    // Get active subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 5,
    });

    console.log(`[Subscription Sync] Found ${subscriptions.data.length} active subscriptions for user ${userId}`);

    if (subscriptions.data.length > 0 && subscriptions.data[0]) {
      // User has active subscription(s) in Stripe - sync to DB
      const latestSub = subscriptions.data[0];
      const now = Date.now();

      await db
        .prepare(`
          UPDATE users SET
            subscription_status = 'active',
            stripe_customer_id = ?,
            stripe_subscription_id = ?,
            subscription_started_at = COALESCE(subscription_started_at, ?),
            updated_at = ?
          WHERE id = ?
        `)
        .bind(customerId, latestSub.id, now, now, userId)
        .run();

      return c.json({
        success: true,
        message: 'Subscription synced successfully',
        previousStatus: user.subscription_status,
        newStatus: 'active',
        stripeSubscriptionId: latestSub.id,
        activeSubscriptions: subscriptions.data.length
      });
    } else {
      // No active subscriptions - check if we should downgrade
      if (user.subscription_status === 'active') {
        const now = Date.now();
        await db
          .prepare(`
            UPDATE users SET
              subscription_status = 'free',
              updated_at = ?
            WHERE id = ?
          `)
          .bind(now, userId)
          .run();

        return c.json({
          success: true,
          message: 'No active subscription found in Stripe - downgraded to free',
          previousStatus: user.subscription_status,
          newStatus: 'free'
        });
      }

      return c.json({
        success: true,
        message: 'No active subscription in Stripe',
        currentStatus: user.subscription_status
      });
    }
  } catch (error) {
    console.error('[Subscription API] Error syncing subscription:', error);
    return c.json({
      error: 'Failed to sync subscription',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/subscription/admin/users
 * Admin endpoint to list users and their subscription status
 */
app.get('/api/subscription/admin/users', async (c) => {
  const db = c.env.APP_DB;

  try {
    // Simple security check
    const adminSecret = c.req.header('X-Admin-Secret');
    if (adminSecret !== 'hakivo-admin-2024') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const users = await db
      .prepare(`
        SELECT id, email, first_name, last_name, subscription_status,
               stripe_customer_id, subscription_started_at, created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT 50
      `)
      .all();

    return c.json({
      success: true,
      users: users.results
    });
  } catch (error) {
    console.error('[Subscription API] Error listing users:', error);
    return c.json({
      error: 'Failed to list users',
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
        // Count actual briefs created this month from the database
        const currentDate = new Date();
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
        const briefsResult = await db
          .prepare(`
            SELECT COUNT(*) as count FROM briefs
            WHERE user_id = ?
              AND created_at >= ?
              AND status IN ('completed', 'script_ready', 'processing', 'audio_processing', 'pending')
          `)
          .bind(userId, monthStart)
          .first();
        currentCount = (briefsResult?.count as number) || 0;
        limit = FREE_TIER_BRIEFS_PER_MONTH;
        allowed = currentCount < limit;
        reason = allowed ? null : `Free tier limited to ${limit} briefs per month. Upgrade to Pro for unlimited.`;
        break;
      }

      case 'generate_artifact': {
        // Count artifacts created this month
        const currentDate = new Date();
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
        const result = await db
          .prepare('SELECT COUNT(*) as count FROM artifacts WHERE user_id = ? AND created_at >= ?')
          .bind(userId, monthStart)
          .first();
        currentCount = (result?.count as number) || 0;
        limit = FREE_TIER_ARTIFACTS_PER_MONTH;
        allowed = currentCount < limit;
        reason = allowed ? null : `Free tier limited to ${limit} documents per month. Upgrade to Pro for unlimited.`;
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
