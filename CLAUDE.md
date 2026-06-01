# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Election Countdown

Live countdown timer to the 2026 Midterms and 2028 Presidential Election with voter registration links and admin analytics.

## Stack
Vite / React (SPA), Cloudflare Pages + Functions, Cloudflare D1 (SQLite)

## Commands

```bash
# Local dev (Cloudflare Pages with D1)
npx wrangler pages dev

# Deploy to Cloudflare Pages
npx wrangler pages deploy

# D1 database migrations
npx wrangler d1 migrations apply <db-name>
```

## Architecture

- `src/` or root — Vite/React SPA; countdown logic, voter registration links
- `functions/` — Cloudflare Pages Functions for server-side logic and D1 queries
- `_headers` / `_redirects` — Cloudflare Pages routing rules

D1 is SQLite at the edge — no connection pooling needed, but be aware of D1's consistency model (eventual on global replicas). Admin analytics are read from D1 via a Pages Function.
