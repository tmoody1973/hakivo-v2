# Stripe Subscription Implementation for Hakivo Pro

## Overview

Hakivo Pro is a $12/month subscription that unlocks:
- Unlimited briefs (free tier: 3/month)
- Unlimited bill tracking (free tier: 3 bills)
- Unlimited member following (free tier: 3 members)
- Daily briefing emails
- Real-time vote alerts
- Audio digests

## Stripe Configuration

### Product & Price
- **Product ID**: `prod_TYstNGX1R577Gr`
- **Price ID**: `price_1Sbl9Z2SDNFB3sqEVZH1v8Yr`
- **Amount**: $12.00/month
- **Mode**: Test (change to live for production)

### Webhook URL
Configure this URL in Stripe Dashboard > Developers > Webhooks:
```
https://svc-01kbx70mmpbcrf475s1hdsb2pm.01k66gywmx8x4r0w31fdjjfekf.lmapp.run/api/stripe/webhook
```

### Webhook Events to Enable
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.payment_succeeded`

## Service URLs

### Subscription API
```
https://svc-01kbx70mmpbcrf475s1hdsb2pn.01k66gywmx8x4r0w31fdjjfekf.lmapp.run
```

**Endpoints:**
- `GET /api/subscription/health` - Health check
- `GET /api/subscription/status/:userId` - Get subscription status & usage
- `POST /api/subscription/create-checkout` - Create Stripe checkout session
- `POST /api/subscription/create-portal` - Create Stripe billing portal
- `POST /api/subscription/use-brief/:userId` - Track brief usage
- `POST /api/subscription/check-limit/:userId` - Check if action is allowed

### Stripe Webhook
```
https://svc-01kbx70mmpbcrf475s1hdsb2pm.01k66gywmx8x4r0w31fdjjfekf.lmapp.run
```

**Endpoints:**
- `GET /api/stripe/health` - Health check
- `POST /api/stripe/webhook` - Stripe webhook handler

## Database Schema

### Users Table Columns
```sql
subscription_status TEXT DEFAULT 'free',  -- free, active, past_due, canceling
stripe_customer_id TEXT,
stripe_subscription_id TEXT,
subscription_started_at INTEGER,
subscription_ends_at INTEGER,
briefs_used_this_month INTEGER DEFAULT 0,
briefs_reset_at INTEGER
```

### Stripe Events Table
```sql
CREATE TABLE stripe_events (
  id TEXT PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  user_id TEXT,
  payload TEXT NOT NULL,
  processed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
```

## Frontend Integration

### Using the Raindrop Client

```typescript
import { subscriptionApi } from '@/lib/raindrop-client';

// Get subscription status
const status = await subscriptionApi.getStatus(userId);

// Check if user can track more bills
const canTrack = await subscriptionApi.checkLimit(userId, 'track_bill');
if (!canTrack.allowed) {
  // Show upgrade prompt
}

// Create checkout session for upgrade
const checkout = await subscriptionApi.createCheckout(userId);

// Track brief usage for free tier
const usage = await subscriptionApi.useBrief(userId);
```

### Stripe.js Checkout

Since checkout sessions are created server-side, the frontend uses Stripe.js:

```typescript
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

async function handleUpgrade(userId: string) {
  const checkoutInfo = await subscriptionApi.createCheckout(userId);

  const stripe = await stripePromise;
  await stripe.redirectToCheckout({
    lineItems: [{ price: checkoutInfo.checkout.priceId, quantity: 1 }],
    mode: 'subscription',
    successUrl: 'https://hakivo-v2.netlify.app/dashboard?upgrade=success',
    cancelUrl: 'https://hakivo-v2.netlify.app/pricing?upgrade=canceled',
    clientReferenceId: userId,
  });
}
```

## Free Tier Limits

| Feature | Free | Pro |
|---------|------|-----|
| Briefs per month | 3 | Unlimited |
| Tracked bills | 3 | Unlimited |
| Followed members | 3 | Unlimited |
| Daily briefing | No | Yes |
| Real-time alerts | No | Yes |
| Audio digests | No | Yes |

## Next Steps

1. **Configure Stripe Webhook**: Add the webhook URL in Stripe Dashboard
2. **Add Publishable Key**: Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in frontend
3. **Build Pricing Page**: Create `/pricing` page with plan comparison
4. **Add Upgrade Prompts**: Show upgrade prompts when limits are reached
5. **Test Full Flow**: Test checkout ’ webhook ’ subscription activation
