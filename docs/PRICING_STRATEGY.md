# Hakivo Pricing Strategy

## Pricing Tiers

Keep it dead simple - 2 tiers:

| Tier | Price | What they get |
|------|-------|---------------|
| **Free** | $0 | Podcast access, basic bill search, limited briefs (3/month) |
| **Pro** | $9/month | Unlimited AI briefs, personalized district tracking, full audio library |

---

## Why This Works

1. **One paid tier = simple code** - Just check `user.isPro` boolean. No complex tier logic.

2. **$9/month is the sweet spot** - Low enough for impulse buy, high enough to be real revenue. Same as Spotify, Netflix basic.

3. **Clear value prop** - Free users get a taste, Pro unlocks the AI-powered personalization that's your actual differentiator.

---

## What to Gate Behind Pro

Already built, easy to gate:

- Unlimited AI-generated briefs (daily/weekly)
- Personalized district tracking
- Audio briefs (TTS pipeline)
- Bill tracking
- Full bill text search

---

## Stripe Implementation (Minimal)

```
- One Stripe product: "Hakivo Pro"
- One price: $9/month
- Webhook: update user.subscription_status in DB
- Check: if (user.subscription_status === 'active') show Pro features
```

That's ~50-100 lines of code. No complex metering, no usage tracking, no multiple tiers.

---

## Skip For Now

- Annual pricing (adds complexity)
- Team/enterprise tiers (no customers asking for it yet)
- Usage-based billing (nightmare to implement)

---

## Feature Audit: What's Actually Built?

| Feature | Built? | Notes |
|---------|--------|-------|
| Unlimited AI briefs | ✅ Yes | Daily/weekly generation working |
| Personalized by district | ✅ Yes | Geocodio integration complete |
| Audio briefs | ✅ Yes | Gemini TTS pipeline working |
| Podcast access | ✅ Yes | Keep public (it's marketing) |
| Real-time alerts | ❌ No | Would need email/push notifications |
| Bill tracking | ✅ Yes | Users can track bills |

---

## Recommendation

**Don't gate the podcast** - it's your marketing funnel and available on Apple/Spotify anyway.

**Gate the personalized AI briefs** - this is the real value. Free users get 3/month, Pro gets unlimited.

**Gate audio versions of briefs** - Free users read, Pro users listen.

---

## Database Changes Needed

```sql
ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN subscription_id TEXT;
ALTER TABLE users ADD COLUMN briefs_used_this_month INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN briefs_reset_date INTEGER;
```

---

## Implementation Checklist

- [ ] Create Stripe product and price
- [ ] Add Stripe env variables to Raindrop manifest
- [ ] Add subscription columns to users table
- [ ] Create checkout session endpoint
- [ ] Create Stripe webhook handler
- [ ] Add `isPro` check to brief generation
- [ ] Add brief usage counter for free tier
- [ ] Create pricing page UI
- [ ] Add upgrade prompts when limit reached
