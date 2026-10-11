# Election Countdown — Local Setup

Everything runs on Cloudflare: a static React site (`public/`, built from `client/`), one Pages
Function for the API (`functions/api/[[path]].js`), a D1 database, and a nightly Worker
(`workers/nightly`) that writes rollups to D1 and exports to R2. There is no other server.

## Prerequisites

- Node.js 20+ (22 used in CI)
- `npx wrangler` (pulled on demand; logs in with `npx wrangler login` for deploys only)

## Run it

```bash
npm ci
cp .dev.vars.example .dev.vars          # local secrets, never committed
npm run dev:full                        # build the site + API + local D1 on http://localhost:8788
```

`npm run dev` serves only the React UI with hot reload (http://localhost:5000); API calls need
`dev:full` (or `wrangler pages dev` running alongside).

The local D1 database is created on first request; nothing to install.

## Build

```bash
npm run build      # vite build of client/ mirrored into public/ (fails on any inline <script>)
npm run check      # TypeScript
```

`public/` is generated. Edit `client/` (source, `client/index.html`, `client/public/` for
privacy/terms, `_headers`, `_redirects` and images), then rebuild.

## Test

```bash
npx playwright install chromium   # once
npm run test:e2e                   # ~3 min, starts its own wrangler servers with an empty database
```

## Deploy

See [LAUNCH.md](LAUNCH.md): apply D1 migrations first, then deploy the nightly Worker and Pages.

## Layout

| Path | What it is |
|---|---|
| `client/` | React app (Vite). `client/public/` is copied verbatim into the build. |
| `functions/api/[[path]].js` | The whole API (auth, OAuth, votes, stats, tracking, admin). |
| `lib/` | Plain JS shared by the API and the Worker (`analytics.js`, `oauth.js`). |
| `workers/nightly/` | Cron Worker: daily rollups → D1, NDJSON dumps → R2. |
| `migrations/` | D1 migrations (`wrangler d1 migrations apply`). `schema.sql` is the full current schema for a brand-new database. |
| `tests/` | End-to-end suite (`npm run test:e2e`). |
| `public/` | Build output deployed by Pages (do not edit). |
