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

### Product & Price (LIVE MODE)
- **Product ID**: `prod_TigokRwZOHInFc`
- **Price ID**: `price_1SlFRECpozUWtHfykQIqPv28`
- **Amount**: $12.00/month
- **Mode**: Live (production)

### Founder's Gift Coupon
- **Coupon ID**: `t5HqGxmD`
- **Discount**: 100% off
- **Duration**: 12 months
- **Purpose**: All early adopters get 1 year free premium

### Legacy Test Mode IDs (deprecated)
- Product ID: `prod_TYstNGX1R577Gr`
- Price ID: `price_1SbrvvCpozUWtHfyCFE5Lyur` (also `price_1Sbl9Z2SDNFB3sqEVZH1v8Yr`)

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

## Migration to Live Mode

### Migration Script
A migration script is available to give existing users the Founder's Gift (1 year free premium):

```bash
# From hakivo-api directory:
STRIPE_LIVE_SECRET_KEY=sk_live_xxx npx tsx scripts/migrate-stripe-live-founders-gift.ts
```

The script:
1. Creates Stripe customers in LIVE mode for all existing users
2. Creates subscriptions with 100% off coupon for 12 months
3. Updates database with live Stripe IDs and active subscription status

### Migration Checklist

1. ✅ Create live Stripe product and price
2. ✅ Create Founder's Gift coupon (100% off, 12 months)
3. ✅ Write migration script (`scripts/migrate-stripe-live-founders-gift.ts`)
4. ✅ Update `subscription-api/index.ts` with live price ID
5. ⬜ Update environment variables:
   - `STRIPE_SECRET_KEY` - live secret key (sk_live_...)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - live publishable key (pk_live_...)
6. ⬜ Configure live webhooks in Stripe Dashboard:
   - URL: `https://<stripe-webhook-service-url>/api/stripe/webhook`
   - Events: checkout.session.completed, customer.subscription.*, invoice.payment_*
7. ⬜ Deploy updated backend services (`npx raindrop build start`)
8. ⬜ Run migration script with live Stripe key

## Environment Variables

### Backend (Raindrop/Cloudflare Workers)
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Frontend (Next.js/Netlify)
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

## Next Steps

1. **Update Environment Variables**: Switch STRIPE keys from test to live mode
2. **Configure Live Webhooks**: Add webhook URL in Stripe Dashboard (Live mode)
3. **Deploy Backend**: Run `npx raindrop build start` from hakivo-api
4. **Run Migration**: Execute the Founder's Gift migration script
5. **Verify**: Check that users have active subscriptions in Stripe Dashboard
