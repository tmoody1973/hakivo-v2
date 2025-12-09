# Hakivo Financial Proforma

**Version:** 1.0
**Date:** December 2025
**Subscription Price:** $12/month (Hakivo Pro)

---

## Executive Summary

Hakivo is a civic intelligence platform that provides personalized legislative briefings, representative tracking, and AI-powered civic engagement tools. This proforma analyzes the unit economics at $12/month per subscriber.

---

## Revenue Model

### Subscription Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0/month | 3 briefs/month, 3 tracked bills, 3 followed members |
| **Pro** | $12/month | Unlimited briefs, unlimited tracking, daily briefings, real-time alerts, audio digests |

### Revenue Projections

| Subscribers | Monthly Revenue | Annual Revenue |
|-------------|-----------------|----------------|
| 100 | $1,200 | $14,400 |
| 500 | $6,000 | $72,000 |
| 1,000 | $12,000 | $144,000 |
| 5,000 | $60,000 | $720,000 |
| 10,000 | $120,000 | $1,440,000 |

---

## Cost Structure

### 1. AI & Language Model Services

#### Gemini (Google AI)
- **Usage:** Brief generation, content analysis, bill summarization, image generation
- **Pricing:** Gemini 1.5 Flash - $0.075/1M input tokens, $0.30/1M output tokens
- **Estimated per brief:** ~5,000 input tokens, ~2,000 output tokens
- **Cost per brief:** ~$0.001

| Volume | Monthly Cost |
|--------|--------------|
| 1,000 briefs | $1.00 |
| 10,000 briefs | $10.00 |
| 50,000 briefs | $50.00 |

#### Anthropic Claude
- **Usage:** Complex analysis, chat assistance
- **Pricing:** Claude 3.5 Sonnet - $3/1M input, $15/1M output
- **Estimated per query:** ~2,000 tokens in/out
- **Cost per query:** ~$0.036

| Volume | Monthly Cost |
|--------|--------------|
| 500 queries | $18.00 |
| 2,000 queries | $72.00 |
| 10,000 queries | $360.00 |

#### Cerebras
- **Usage:** Fast inference for real-time features
- **Pricing:** ~$0.60/1M tokens
- **Estimated monthly:** $5-20 depending on usage

#### Perplexity AI
- **Usage:** News research, current events context
- **Pricing:** Pro API - $5/1,000 queries
- **Estimated monthly:** $10-50

### 2. Text-to-Speech Services

#### ElevenLabs
- **Usage:** Audio brief generation
- **Pricing:**
  - Starter: $5/month (30,000 characters)
  - Creator: $22/month (100,000 characters)
  - Pro: $99/month (500,000 characters)
- **Characters per brief:** ~4,000-6,000 characters (3-5 minute audio)

| Subscribers | Briefs/Month | Characters | Recommended Plan | Cost |
|-------------|--------------|------------|------------------|------|
| 100 | 300 | 1.5M | Pro | $99 |
| 500 | 1,500 | 7.5M | Scale | $330 |
| 1,000 | 3,000 | 15M | Business | $660 |
| 5,000 | 15,000 | 75M | Enterprise | ~$2,500 |

#### Gemini TTS (Backup)
- **Usage:** Fallback TTS, podcast generation
- **Pricing:** Included in Gemini API costs
- **Cost:** ~$0.001 per 1,000 characters

### 3. Data & API Services

#### Congress.gov API
- **Usage:** Bill data, votes, actions
- **Pricing:** Free (government API)
- **Cost:** $0

#### OpenStates API
- **Usage:** State legislation data
- **Pricing:** Free tier (500 requests/day)
- **Cost:** $0 (may need paid tier at scale: ~$100/month)

#### FEC API
- **Usage:** Campaign finance data
- **Pricing:** Free (government API)
- **Cost:** $0

#### Geocodio
- **Usage:** Address to congressional district lookup
- **Pricing:** $0.50/1,000 lookups
- **Estimated:** 500-2,000 lookups/month during onboarding

| Lookups | Monthly Cost |
|---------|--------------|
| 1,000 | $0.50 |
| 5,000 | $2.50 |
| 10,000 | $5.00 |

#### Exa AI
- **Usage:** News search and research
- **Pricing:** $0.001 per search
- **Estimated:** 1,000-5,000 searches/month

| Searches | Monthly Cost |
|----------|--------------|
| 1,000 | $1.00 |
| 5,000 | $5.00 |
| 10,000 | $10.00 |

### 4. Infrastructure Services

#### Raindrop (LiquidMetal)
- **Usage:** Cloudflare Workers hosting, D1 database, R2 storage, queues
- **Pricing:** Usage-based (Cloudflare pricing)
- **Estimated monthly:**

| Component | 100 users | 1,000 users | 10,000 users |
|-----------|-----------|-------------|--------------|
| Workers (requests) | $0 | $5 | $25 |
| D1 Database | $0 | $5 | $25 |
| R2 Storage (audio files) | $5 | $15 | $75 |
| Queues | $0 | $2 | $10 |
| **Total** | **$5** | **$27** | **$135** |

#### Netlify (Frontend)
- **Usage:** Next.js hosting, edge functions
- **Pricing:**
  - Free: 100GB bandwidth
  - Pro: $19/month (1TB bandwidth)
  - Business: $99/month

| Scale | Plan | Cost |
|-------|------|------|
| < 500 users | Free/Pro | $0-19 |
| 500-2,000 users | Pro | $19 |
| 2,000+ users | Business | $99 |

#### Vultr Object Storage
- **Usage:** Audio file storage (backup/CDN)
- **Pricing:** $5/month for 250GB + $0.01/GB transfer
- **Estimated:** $5-20/month

### 5. Authentication & Email

#### WorkOS
- **Usage:** Authentication, SSO
- **Pricing:**
  - Free: Up to 1M MAUs
  - **Cost:** $0 (at current scale)

#### Resend
- **Usage:** Transactional emails, weekly digests
- **Pricing:**
  - Free: 3,000 emails/month
  - Pro: $20/month (50,000 emails)
- **Estimated:** 2-5 emails per user per month

| Users | Emails/Month | Plan | Cost |
|-------|--------------|------|------|
| 500 | 2,500 | Free | $0 |
| 2,000 | 10,000 | Pro | $20 |
| 10,000 | 50,000 | Pro | $20 |

### 6. Media & Distribution

#### Spreaker
- **Usage:** Podcast hosting and distribution
- **Pricing:**
  - Free: 5 hours storage
  - On-Air: $6/month (100 hours)
  - Broadcaster: $20/month (500 hours)
- **Estimated:** $6-20/month

#### Pexels
- **Usage:** Stock images for briefs
- **Pricing:** Free API
- **Cost:** $0

### 7. Payment Processing

#### Stripe
- **Usage:** Subscription billing
- **Pricing:** 2.9% + $0.30 per transaction
- **Per $12 subscription:** $0.65 fee

| Subscribers | Monthly Revenue | Stripe Fees |
|-------------|-----------------|-------------|
| 100 | $1,200 | $65 |
| 500 | $6,000 | $325 |
| 1,000 | $12,000 | $650 |
| 5,000 | $60,000 | $3,250 |

---

## Cost Per User Analysis

### At 1,000 Subscribers (Steady State)

| Category | Monthly Cost | Per User |
|----------|--------------|----------|
| **AI Services** | | |
| Gemini (briefs + images) | $50 | $0.05 |
| Anthropic (chat) | $72 | $0.07 |
| Cerebras | $15 | $0.015 |
| Perplexity | $25 | $0.025 |
| **TTS** | | |
| ElevenLabs | $330 | $0.33 |
| **Data APIs** | | |
| Geocodio | $2.50 | $0.0025 |
| Exa | $5 | $0.005 |
| **Infrastructure** | | |
| Raindrop/Cloudflare | $27 | $0.027 |
| Netlify | $19 | $0.019 |
| Vultr | $10 | $0.01 |
| **Services** | | |
| Resend | $20 | $0.02 |
| Spreaker | $20 | $0.02 |
| **Payment Processing** | | |
| Stripe (5.4% effective) | $650 | $0.65 |
| **TOTAL VARIABLE** | **$1,246** | **$1.25** |

### Fixed Costs (Monthly)

| Item | Cost |
|------|------|
| Domain/DNS | $15 |
| Monitoring/Logging | $20 |
| Development Tools | $50 |
| **Total Fixed** | **$85** |

---

## Profitability Analysis

### Unit Economics at $12/month

| Metric | Value |
|--------|-------|
| Revenue per user | $12.00 |
| Variable cost per user | $1.25 |
| Contribution margin | $10.75 |
| **Contribution margin %** | **89.6%** |

### Break-Even Analysis

| Scenario | Monthly Fixed | Break-Even Users |
|----------|---------------|------------------|
| Bootstrap | $85 | 8 users |
| With Dev Costs ($2k) | $2,085 | 194 users |
| With Team ($10k) | $10,085 | 938 users |

### Profitability Projections

| Subscribers | Revenue | Variable Costs | Fixed Costs | Profit | Margin |
|-------------|---------|----------------|-------------|--------|--------|
| 100 | $1,200 | $125 | $85 | $990 | 82.5% |
| 500 | $6,000 | $625 | $85 | $5,290 | 88.2% |
| 1,000 | $12,000 | $1,250 | $85 | $10,665 | 88.9% |
| 5,000 | $60,000 | $6,250 | $85 | $53,665 | 89.4% |
| 10,000 | $120,000 | $12,500 | $85 | $107,415 | 89.5% |

---

## Sensitivity Analysis

### If ElevenLabs Costs Increase

ElevenLabs is the largest variable cost. Alternative strategies:

1. **Gemini TTS** - Free with API, lower quality
2. **OpenAI TTS** - $15/1M characters (~$0.06 per brief)
3. **Azure TTS** - $4/1M characters (~$0.02 per brief)

| TTS Provider | Cost per Brief | Cost at 1,000 users |
|--------------|----------------|---------------------|
| ElevenLabs | $0.33 | $330/month |
| OpenAI | $0.06 | $60/month |
| Azure | $0.02 | $20/month |
| Gemini | $0.001 | $1/month |

### If AI Costs Increase 2x

| Scenario | Variable Cost | Margin |
|----------|---------------|--------|
| Current | $1.25/user | 89.6% |
| 2x AI costs | $1.45/user | 87.9% |
| 3x AI costs | $1.65/user | 86.3% |

The business remains highly profitable even with significant AI cost increases.

---

## Growth Scenarios

### Year 1 Projection (Conservative)

| Month | New Users | Total Users | MRR | Costs | Profit |
|-------|-----------|-------------|-----|-------|--------|
| 1 | 50 | 50 | $600 | $148 | $452 |
| 3 | 75 | 175 | $2,100 | $304 | $1,796 |
| 6 | 100 | 400 | $4,800 | $585 | $4,215 |
| 9 | 125 | 700 | $8,400 | $960 | $7,440 |
| 12 | 150 | 1,000 | $12,000 | $1,335 | $10,665 |

**Year 1 Total Revenue:** ~$75,000
**Year 1 Total Profit:** ~$65,000

### Year 2 Projection (Growth)

| Quarter | Users | MRR | Annual Run Rate |
|---------|-------|-----|-----------------|
| Q1 | 1,500 | $18,000 | $216,000 |
| Q2 | 2,500 | $30,000 | $360,000 |
| Q3 | 4,000 | $48,000 | $576,000 |
| Q4 | 6,000 | $72,000 | $864,000 |

---

## Key Metrics to Track

### Financial KPIs

- **MRR** (Monthly Recurring Revenue)
- **ARPU** (Average Revenue Per User) - Target: $12
- **LTV** (Lifetime Value) - Target: $144 (12 months)
- **CAC** (Customer Acquisition Cost) - Target: < $30
- **LTV:CAC Ratio** - Target: > 4:1
- **Gross Margin** - Target: > 85%

### Operational KPIs

- **Briefs generated per user per month**
- **Audio generation success rate**
- **API costs per user**
- **Churn rate** - Target: < 5%/month

---

## Risk Factors

1. **API Price Increases** - Mitigated by multiple provider options
2. **High TTS Costs** - Can switch to cheaper alternatives
3. **Government API Changes** - Low risk, public data
4. **Competition** - First-mover advantage in civic tech
5. **Churn** - Focus on engagement and value delivery

---

## Recommendations

1. **Start with Gemini TTS** for initial launch to minimize costs
2. **Upgrade to ElevenLabs** when reaching 500+ paid users
3. **Monitor AI costs** closely and set up alerts
4. **Consider annual pricing** ($99/year = $8.25/month effective) to reduce churn
5. **Invest in retention** - LTV depends on low churn

---

## Appendix: Service Pricing Links

- [Gemini Pricing](https://ai.google.dev/pricing)
- [ElevenLabs Pricing](https://elevenlabs.io/pricing)
- [Anthropic Pricing](https://www.anthropic.com/pricing)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/pricing/)
- [Stripe Fees](https://stripe.com/pricing)
- [Netlify Pricing](https://www.netlify.com/pricing/)

---

*Last updated: December 2025*
