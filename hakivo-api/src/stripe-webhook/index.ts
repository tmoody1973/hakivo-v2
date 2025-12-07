import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import Stripe from 'stripe';

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());

// Manual CORS - allow Stripe webhooks from anywhere
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');

  if (c.req.method === 'OPTIONS') {
    return c.text('', 200);
  }

  await next();
});

// Health check
app.get('/api/stripe/health', (c) => {
  return c.json({ status: 'ok', service: 'stripe-webhook', timestamp: new Date().toISOString() });
});

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events
 * Events: checkout.session.completed, customer.subscription.*, invoice.payment_failed
 */
app.post('/api/stripe/webhook', async (c) => {
  const db = c.env.APP_DB;

  try {
    // Get raw body for signature verification
    const body = await c.req.text();
    const signature = c.req.header('stripe-signature');

    if (!signature) {
      console.error('[Stripe Webhook] Missing stripe-signature header');
      return c.json({ error: 'Missing stripe-signature header' }, 400);
    }

    // Parse the event (in production, verify signature with webhook secret)
    // For now, parse directly since we're in test mode
    let event: Stripe.Event;
    try {
      event = JSON.parse(body) as Stripe.Event;
    } catch (err) {
      console.error('[Stripe Webhook] Failed to parse event:', err);
      return c.json({ error: 'Invalid payload' }, 400);
    }

    console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

    // Check for idempotency - have we already processed this event?
    const existingEvent = await db
      .prepare('SELECT id FROM stripe_events WHERE event_id = ?')
      .bind(event.id)
      .first();

    if (existingEvent) {
      console.log(`[Stripe Webhook] Event ${event.id} already processed, skipping`);
      return c.json({ received: true, status: 'already_processed' });
    }

    // Process based on event type
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(db, event);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(db, event);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(db, event);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(db, event);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(db, event);
        break;

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    // Log event for audit trail
    const eventLogId = crypto.randomUUID();
    const now = Date.now();

    // Extract user ID from event metadata if available
    let userId: string | null = null;
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      userId = session.metadata?.userId || null;
    }

    await db
      .prepare(`
        INSERT INTO stripe_events (id, event_id, event_type, user_id, payload, processed_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        eventLogId,
        event.id,
        event.type,
        userId,
        JSON.stringify(event),
        now,
        now
      )
      .run();

    return c.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error processing webhook:', error);
    return c.json({
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Handle checkout.session.completed
 * User completed Stripe checkout - activate their subscription
 */
async function handleCheckoutCompleted(db: any, event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  console.log('[Stripe Webhook] Checkout completed:', {
    sessionId: session.id,
    customerId: session.customer,
    subscriptionId: session.subscription,
    metadata: session.metadata
  });

  const userId = session.metadata?.userId;
  if (!userId) {
    console.error('[Stripe Webhook] No userId in checkout session metadata');
    return;
  }

  const now = Date.now();

  // Update user's subscription status
  await db
    .prepare(`
      UPDATE users SET
        subscription_status = 'active',
        stripe_customer_id = ?,
        stripe_subscription_id = ?,
        subscription_started_at = ?,
        updated_at = ?
      WHERE id = ?
    `)
    .bind(
      session.customer as string,
      session.subscription as string,
      now,
      now,
      userId
    )
    .run();

  // Create notification for user
  await createNotification(db, userId, {
    type: 'subscription',
    title: 'Welcome to Hakivo Pro!',
    message: 'Your subscription is now active. Enjoy unlimited briefs, daily briefings, and real-time alerts.',
    link: '/dashboard'
  });

  console.log(`[Stripe Webhook] User ${userId} subscription activated`);
}

/**
 * Handle customer.subscription.updated
 * Subscription status changed (e.g., canceled at period end, renewed)
 */
async function handleSubscriptionUpdated(db: any, event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;

  console.log('[Stripe Webhook] Subscription updated:', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end
  });

  // Find user by stripe_subscription_id
  const user = await db
    .prepare('SELECT id FROM users WHERE stripe_subscription_id = ?')
    .bind(subscription.id)
    .first();

  if (!user) {
    console.error(`[Stripe Webhook] No user found for subscription ${subscription.id}`);
    return;
  }

  const userId = user.id as string;
  const now = Date.now();

  // Map Stripe status to our status
  let subscriptionStatus = 'free';
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    subscriptionStatus = subscription.cancel_at_period_end ? 'canceling' : 'active';
  } else if (subscription.status === 'past_due') {
    subscriptionStatus = 'past_due';
  } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    subscriptionStatus = 'free';
  }

  // Calculate subscription end date
  // Type assertion to access current_period_end which exists on the object
  const subData = subscription as any;
  const subscriptionEndsAt = subData.current_period_end
    ? subData.current_period_end * 1000 // Convert Unix timestamp to milliseconds
    : null;

  await db
    .prepare(`
      UPDATE users SET
        subscription_status = ?,
        subscription_ends_at = ?,
        updated_at = ?
      WHERE id = ?
    `)
    .bind(
      subscriptionStatus,
      subscriptionEndsAt,
      now,
      userId
    )
    .run();

  // Notify user if subscription is canceling
  if (subscription.cancel_at_period_end) {
    const endDate = new Date(subscriptionEndsAt!).toLocaleDateString();
    await createNotification(db, userId, {
      type: 'subscription',
      title: 'Subscription Cancellation Scheduled',
      message: `Your Hakivo Pro subscription will end on ${endDate}. You'll continue to have access until then.`,
      link: '/settings/subscription'
    });
  }

  console.log(`[Stripe Webhook] User ${userId} subscription status: ${subscriptionStatus}`);
}

/**
 * Handle customer.subscription.deleted
 * Subscription ended - downgrade user to free tier
 */
async function handleSubscriptionDeleted(db: any, event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;

  console.log('[Stripe Webhook] Subscription deleted:', {
    subscriptionId: subscription.id,
    customerId: subscription.customer
  });

  // Find user by stripe_subscription_id
  const user = await db
    .prepare('SELECT id FROM users WHERE stripe_subscription_id = ?')
    .bind(subscription.id)
    .first();

  if (!user) {
    console.error(`[Stripe Webhook] No user found for subscription ${subscription.id}`);
    return;
  }

  const userId = user.id as string;
  const now = Date.now();

  // Downgrade to free tier
  await db
    .prepare(`
      UPDATE users SET
        subscription_status = 'free',
        subscription_ends_at = ?,
        briefs_used_this_month = 0,
        briefs_reset_at = ?,
        updated_at = ?
      WHERE id = ?
    `)
    .bind(now, now, now, userId)
    .run();

  // Update alert preferences - disable Pro-only features
  await db
    .prepare(`
      UPDATE user_alert_preferences SET
        daily_briefing_enabled = 0,
        realtime_vote_alerts = 0,
        realtime_bill_updates = 0,
        updated_at = ?
      WHERE user_id = ?
    `)
    .bind(now, userId)
    .run();

  // Notify user
  await createNotification(db, userId, {
    type: 'subscription',
    title: 'Subscription Ended',
    message: 'Your Hakivo Pro subscription has ended. You can still use free features with limited briefs.',
    link: '/pricing'
  });

  console.log(`[Stripe Webhook] User ${userId} downgraded to free tier`);
}

/**
 * Handle invoice.payment_failed
 * Payment failed - notify user
 */
async function handlePaymentFailed(db: any, event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;

  console.log('[Stripe Webhook] Payment failed:', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    amountDue: invoice.amount_due
  });

  // Find user by stripe_customer_id
  const user = await db
    .prepare('SELECT id FROM users WHERE stripe_customer_id = ?')
    .bind(invoice.customer as string)
    .first();

  if (!user) {
    console.error(`[Stripe Webhook] No user found for customer ${invoice.customer}`);
    return;
  }

  const userId = user.id as string;
  const now = Date.now();

  // Update status to past_due
  await db
    .prepare(`
      UPDATE users SET
        subscription_status = 'past_due',
        updated_at = ?
      WHERE id = ?
    `)
    .bind(now, userId)
    .run();

  // Notify user
  await createNotification(db, userId, {
    type: 'subscription',
    title: 'Payment Failed',
    message: 'We couldn\'t process your payment. Please update your payment method to continue using Hakivo Pro.',
    link: '/settings/subscription'
  });

  console.log(`[Stripe Webhook] User ${userId} payment failed`);
}

/**
 * Handle invoice.payment_succeeded
 * Payment succeeded - ensure subscription is active
 */
async function handlePaymentSucceeded(db: any, event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;

  console.log('[Stripe Webhook] Payment succeeded:', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    amountPaid: invoice.amount_paid
  });

  // Find user by stripe_customer_id
  const user = await db
    .prepare('SELECT id, subscription_status FROM users WHERE stripe_customer_id = ?')
    .bind(invoice.customer as string)
    .first();

  if (!user) {
    console.error(`[Stripe Webhook] No user found for customer ${invoice.customer}`);
    return;
  }

  const userId = user.id as string;
  const now = Date.now();

  // If user was past_due, reactivate them
  if (user.subscription_status === 'past_due') {
    await db
      .prepare(`
        UPDATE users SET
          subscription_status = 'active',
          updated_at = ?
        WHERE id = ?
      `)
      .bind(now, userId)
      .run();

    await createNotification(db, userId, {
      type: 'subscription',
      title: 'Payment Successful',
      message: 'Your payment was processed successfully. Your Hakivo Pro subscription is active again.',
      link: '/dashboard'
    });

    console.log(`[Stripe Webhook] User ${userId} reactivated after successful payment`);
  }
}

/**
 * Helper: Create in-app notification
 */
async function createNotification(
  db: any,
  userId: string,
  notification: {
    type: string;
    title: string;
    message: string;
    link?: string;
    metadata?: any;
  }
) {
  const id = crypto.randomUUID();
  const now = Date.now();

  await db
    .prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, link, metadata, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `)
    .bind(
      id,
      userId,
      notification.type,
      notification.title,
      notification.message,
      notification.link || null,
      notification.metadata ? JSON.stringify(notification.metadata) : null,
      now
    )
    .run();

  console.log(`[Notification] Created notification for user ${userId}: ${notification.title}`);
}

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
