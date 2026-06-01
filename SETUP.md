# Election Countdown — Setup Guide

## Prerequisites

1. **Node.js 20+**
2. **PostgreSQL** database
3. **Stripe Account** (for donations)

## Initial Setup

### 1. Clone and Install

```bash
git clone https://github.com/rblake2320/election-countdown.git
cd election-countdown
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your values:

- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — Random secret for session encryption
- `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` — From [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
- `STRIPE_WEBHOOK_SECRET` — From Stripe webhook settings
- `ADMIN_SECRET` — Secret for admin analytics endpoints

### 3. Push Database Schema

```bash
npm run db:push
```

### 4. Seed Stripe Products (first time only)

```bash
npm run seed:stripe
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

### 5. Optional: Configure Cloudflare Turnstile

For bot protection, add your Turnstile secret key to `.env`:
```
TURNSTILE_SECRET_KEY=your-turnstile-secret
```

If not configured, bot protection will be skipped.

## Running the Application

### Development

```bash
npm run dev
```

App available at http://localhost:5000

### Production

```bash
npm run build
npm start
```

## Authentication

This app uses email/password authentication (passport-local). Users register and sign in through the in-app dialog. Sessions are stored in PostgreSQL.

## Features

- **Dual Countdown** — Navigate with arrow keys, mouse wheel, touch swipe, or button clicks between 2026 Midterm and 2028 Presidential elections
- **Vote Intent** — Submit voting intention with state (required), age range, city, sex (optional). Rate limited to 5/hour/IP
- **Donations** — Stripe Checkout with preset tiers ($5–$100). Donors get analytics access and custom candidate field
- **Aggregate Stats** — Hidden until 50K participants for privacy
- **Admin Analytics** — Protected by admin secret header

## Architecture

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Framer Motion
- **Backend:** Node.js, Express 5, TypeScript (ESM)
- **Database:** PostgreSQL with Drizzle ORM
- **Auth:** passport-local (email/password), sessions in PostgreSQL
- **Payments:** Stripe Checkout + webhooks
- **Bot Protection:** Cloudflare Turnstile (optional)
- **Rate Limiting:** express-rate-limit

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Session encryption secret |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret API key |
| `STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable API key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `ADMIN_SECRET` | No | Admin analytics access secret |
| `TURNSTILE_SECRET_KEY` | No | Cloudflare Turnstile bot protection |
| `PORT` | No | Server port (default: 5000) |
