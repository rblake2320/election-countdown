# Election Countdown MVP - Setup Guide

## Prerequisites

1. **PostgreSQL Database** - Already configured via Replit
2. **Stripe Account** - Connected via Replit integration
3. **Replit Auth** - Already configured

## Initial Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Sync Database Schema
```bash
npm run db:push
```

### 3. Seed Stripe Products (IMPORTANT - Run Once)

This creates the donation price tiers in Stripe:

```bash
npx tsx server/seed-products.ts
```

**Expected Output:**
```
Creating donation product...
Created product: prod_xxxxx
Created price: price_xxxxx - $5 Donation
Created price: price_xxxxx - $10 Donation
Created price: price_xxxxx - $25 Donation
Created price: price_xxxxx - $50 Donation
Created price: price_xxxxx - $100 Donation
Donation products seeded successfully!
```

**Note:** If you see "Donation product already exists", the products are already created and you can skip this step.

### 4. Optional: Configure Cloudflare Turnstile

For bot protection, add Turnstile keys:

1. Go to https://dash.cloudflare.com/
2. Navigate to Turnstile
3. Create a new site widget
4. Add your Turnstile secret key to secrets:
   - In Replit Secrets tab, add: `TURNSTILE_SECRET_KEY`

If not configured, bot protection will be skipped in development.

## Running the Application

### Development
```bash
npm run dev
```

The app will be available at http://localhost:5000

### Production

Before publishing:

1. **Run the seed script in production** (first time only):
   - SSH into your deployment or run via Replit Shell
   - Execute: `npx tsx server/seed-products.ts`

2. **Publish via Replit**:
   - Click "Publish" in Replit
   - The app will be live with working donation flow

## Features

✅ **Dual Countdown** - Navigate with:
- Arrow keys (↑↓)
- Mouse wheel (hover over countdown)
- Touch swipe (mobile)
- Button clicks

✅ **Vote Intent** - Submit with:
- Required: State, Intent (red/blue/undecided)
- Optional: Age range, City, Sex
- Rate limited: 5 submissions per hour per IP
- Bot protection: Cloudflare Turnstile (when configured)

✅ **Donations** - Stripe Checkout with:
- Preset donation tiers ($5, $10, $25, $50, $100)
- Analytics opt-in checkbox
- Rate limited: 10 attempts per hour per IP
- Automatic persistence via webhooks

✅ **Aggregate Stats** - Hidden until 50K participants

## Troubleshooting

### Donations not working

**Problem:** `/api/donation-prices` returns empty array

**Solution:** Run the seed script:
```bash
npx tsx server/seed-products.ts
```

### Stripe webhook not recording donations

**Problem:** Donations go through but aren't saved

**Solution:** Check logs for webhook errors. The webhook queries the `stripe.checkout_sessions` table populated by stripe-replit-sync.

### Rate limiting too aggressive

**Problem:** Users locked out too quickly

**Solution:** Adjust limits in `server/middleware/rateLimit.ts`:
```typescript
max: 5, // Change to higher number
windowMs: 60 * 60 * 1000, // Change time window
```

## Architecture Notes

- **Database:** PostgreSQL with Drizzle ORM
- **Auth:** Replit Auth (Google, GitHub, Apple, Email)
- **Payments:** Stripe + stripe-replit-sync
- **Bot Protection:** Cloudflare Turnstile (optional)
- **Rate Limiting:** express-rate-limit

## Environment Variables

Managed by Replit integrations:
- `DATABASE_URL` - PostgreSQL connection
- `TURNSTILE_SECRET_KEY` - Optional, for bot protection

All Stripe credentials are managed automatically by the Replit Stripe connector.
