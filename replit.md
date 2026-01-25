# Election Countdown

## Overview

Election Countdown is a web application that displays live countdown timers to upcoming US elections (2026 Midterms and 2028 Presidential). Users can flip between election countdowns, submit their voting intent with optional demographic data, and make donations through Stripe. The app aggregates anonymous voting intentions and displays results once a participation threshold is reached.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Animations**: Framer Motion for countdown transitions
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON APIs under `/api/*`
- **Session Management**: Express sessions with PostgreSQL store (connect-pg-simple)
- **Authentication**: Replit Auth via OpenID Connect

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts`
- **Tables**:
  - `users` - User accounts (required for Replit Auth)
  - `sessions` - Session storage (required for Replit Auth)
  - `vote_intents` - User voting intentions with demographics
  - `donations` - Payment records
  - `user_preferences` - User settings

### Key Design Decisions

**Privacy-First Data Model**: Stores age ranges (18-24, 25-34, etc.) instead of exact ages, state is required but city is optional, and sex is optional with "prefer not to say" option.

**Threshold-Based Aggregation**: Vote intent results only display after 50,000 participants to protect individual privacy, with a minimum group size of 50 for demographic breakdowns.

**Bot Protection**: Cloudflare Turnstile integration (optional) plus rate limiting on vote submissions (5/hour) and donations (10/hour).

**Dual Countdown Interface**: Users can swipe/flip between Midterm and Presidential election countdowns without page navigation.

## External Dependencies

### Third-Party Services
- **Stripe**: Payment processing for donations via Replit's Stripe integration (`stripe-replit-sync`)
- **Replit Auth**: OpenID Connect authentication (no passwords stored)
- **Cloudflare Turnstile**: Optional bot verification (requires `TURNSTILE_SECRET_KEY`)

### Database
- **PostgreSQL**: Primary database (provisioned via Replit, requires `DATABASE_URL`)
- **Stripe Schema**: Separate `stripe.*` schema for synced Stripe data

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Express session secret
- `REPL_ID` / `REPL_IDENTITY` - Replit environment identifiers
- `TURNSTILE_SECRET_KEY` - Optional, for bot protection

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit` - Database ORM and migrations
- `stripe` / `stripe-replit-sync` - Payment processing
- `passport` / `openid-client` - Authentication
- `express-rate-limit` - API rate limiting
- `date-fns` / `date-fns-tz` - Date/time calculations for countdown