#!/usr/bin/env tsx

/**
 * Stripe Live Migration: Founder's Gift
 *
 * This script migrates users to Stripe Live mode with 1 year free premium:
 * - Creates Stripe customers in LIVE mode for all existing users
 * - Creates subscriptions with 100% off coupon for 12 months
 * - Updates database with live Stripe IDs
 *
 * IMPORTANT: Run this ONCE after switching to live Stripe keys.
 *
 * Prerequisites:
 * - STRIPE_LIVE_SECRET_KEY environment variable set
 * - Live Stripe product, price, and coupon already created
 *
 * Usage:
 *   STRIPE_LIVE_SECRET_KEY=sk_live_xxx npx tsx scripts/migrate-stripe-live-founders-gift.ts
 */

import Stripe from 'stripe';

// Configuration - Live mode Stripe IDs (created via MCP)
const CONFIG = {
  LIVE_PRODUCT_ID: 'prod_TigokRwZOHInFc',
  LIVE_PRICE_ID: 'price_1SlFRECpozUWtHfykQIqPv28',
  COUPON_ID: 't5HqGxmD', // 100% off for 12 months
};

// Database admin URL (get from raindrop build find)
const ADMIN_DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyzq.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

// Get Stripe secret key from environment
const STRIPE_SECRET_KEY = process.env.STRIPE_LIVE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('❌ Error: STRIPE_LIVE_SECRET_KEY environment variable is required');
  console.error('   Usage: STRIPE_LIVE_SECRET_KEY=sk_live_xxx npx tsx scripts/migrate-stripe-live-founders-gift.ts');
  process.exit(1);
}

if (!STRIPE_SECRET_KEY.startsWith('sk_live_')) {
  console.error('❌ Error: STRIPE_LIVE_SECRET_KEY must be a LIVE key (sk_live_...)');
  console.error('   You provided a key starting with:', STRIPE_SECRET_KEY.substring(0, 10));
  process.exit(1);
}

// Initialize Stripe with live key
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-04-30.basil',
});

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  stripe_customer_id: string | null;
  subscription_status: string | null;
}

async function executeSQL(query: string): Promise<any> {
  const response = await fetch(`${ADMIN_DASHBOARD_URL}/db-admin/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Database query failed: ${error}`);
  }

  return response.json();
}

async function getAllUsers(): Promise<User[]> {
  const result = await executeSQL(`
    SELECT id, email, first_name, last_name, stripe_customer_id, subscription_status
    FROM users
    ORDER BY created_at ASC
  `);
  return result.results || [];
}

async function updateUserStripeInfo(
  userId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string
): Promise<void> {
  const now = Date.now();
  await executeSQL(`
    UPDATE users SET
      stripe_customer_id = '${stripeCustomerId}',
      stripe_subscription_id = '${stripeSubscriptionId}',
      subscription_status = 'active',
      subscription_started_at = ${now},
      updated_at = ${now}
    WHERE id = '${userId}'
  `);
}

async function createStripeCustomerAndSubscription(user: User): Promise<{
  customerId: string;
  subscriptionId: string;
}> {
  // Create Stripe customer
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || undefined;
  const customer = await stripe.customers.create({
    email: user.email,
    name: fullName,
    metadata: {
      userId: user.id,
      source: 'founders_gift_migration',
      migratedAt: new Date().toISOString(),
    },
  });

  console.log(`   📧 Created customer ${customer.id} for ${user.email}`);

  // Create subscription with coupon (100% off for 12 months)
  // Note: Stripe API 2025-04-30.basil requires discounts array instead of coupon
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: CONFIG.LIVE_PRICE_ID }],
    discounts: [{ coupon: CONFIG.COUPON_ID }],
    metadata: {
      userId: user.id,
      plan: 'founders_gift',
      grantedAt: new Date().toISOString(),
    },
  });

  console.log(`   🎁 Created subscription ${subscription.id} with Founder's Gift coupon`);

  return {
    customerId: customer.id,
    subscriptionId: subscription.id,
  };
}

async function main() {
  console.log('\n🚀 Stripe Live Migration: Founder\'s Gift');
  console.log('==========================================');
  console.log(`📦 Product ID: ${CONFIG.LIVE_PRODUCT_ID}`);
  console.log(`💰 Price ID: ${CONFIG.LIVE_PRICE_ID}`);
  console.log(`🎟️  Coupon ID: ${CONFIG.COUPON_ID} (100% off, 12 months)`);
  console.log('==========================================\n');

  try {
    // Verify Stripe connection and coupon
    console.log('🔗 Verifying Stripe connection...');
    const account = await stripe.accounts.retrieve();
    console.log(`   ✅ Connected to Stripe account: ${account.id}`);

    // Verify coupon exists
    console.log('\n🎟️  Verifying Founder\'s Gift coupon...');
    const coupon = await stripe.coupons.retrieve(CONFIG.COUPON_ID);
    console.log(`   ✅ Coupon found: ${coupon.name || coupon.id}`);
    console.log(`   📊 ${coupon.percent_off}% off for ${coupon.duration_in_months} months`);

    // Verify price exists
    console.log('\n💰 Verifying price...');
    const price = await stripe.prices.retrieve(CONFIG.LIVE_PRICE_ID);
    console.log(`   ✅ Price found: $${(price.unit_amount || 0) / 100}/${price.recurring?.interval}`);

    // Get all users
    console.log('\n📊 Fetching users from database...');
    const users = await getAllUsers();
    console.log(`   Found ${users.length} users`);

    // Filter users who don't already have a live Stripe customer
    const usersToMigrate = users.filter(u => {
      // Skip if already has a live customer ID (cus_ starting, not test mode)
      if (u.stripe_customer_id && u.stripe_customer_id.startsWith('cus_')) {
        // Could be test mode, need to check via Stripe API
        // For safety, only skip if subscription_status is already 'active'
        return u.subscription_status !== 'active';
      }
      return true;
    });

    console.log(`   ${usersToMigrate.length} users need migration`);

    if (usersToMigrate.length === 0) {
      console.log('\n✅ All users already migrated. Nothing to do.');
      return;
    }

    // Confirm before proceeding
    console.log('\n⚠️  This will create LIVE Stripe subscriptions for these users:');
    usersToMigrate.forEach(u => console.log(`   - ${u.email} (${u.id})`));

    console.log('\n📝 Starting migration...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const user of usersToMigrate) {
      console.log(`\n👤 Processing: ${user.email}`);

      try {
        const { customerId, subscriptionId } = await createStripeCustomerAndSubscription(user);
        await updateUserStripeInfo(user.id, customerId, subscriptionId);
        console.log(`   ✅ Migration complete for ${user.email}`);
        successCount++;
      } catch (error) {
        console.error(`   ❌ Error migrating ${user.email}:`, error);
        errorCount++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  📊 MIGRATION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  ✅ Successful: ${successCount}`);
    console.log(`  ❌ Failed: ${errorCount}`);
    console.log(`  📈 Total: ${usersToMigrate.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (errorCount === 0) {
      console.log('\n✨ Migration completed successfully!');
      console.log('\n📌 Next steps:');
      console.log('   1. Update subscription-api/index.ts with live price ID');
      console.log('   2. Update environment variables with live Stripe keys');
      console.log('   3. Configure live webhooks in Stripe Dashboard');
      console.log('   4. Deploy updated backend services');
    } else {
      console.log('\n⚠️  Some migrations failed. Review errors above.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
