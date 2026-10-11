# Election Countdown

Live countdown to the 2026 Midterms and 2028 Presidential Election, with voter registration links.

## Screenshots

**Desktop**

![Desktop home](docs/screenshots/home-desktop.png)

**Mobile**

<img src="docs/screenshots/home-mobile.png" alt="Mobile home" width="320">

**Full page**

![Full page](docs/screenshots/home-fullpage.png)

## Run locally

```bash
npm ci
npm run dev:client   # http://localhost:5000
```

See [SETUP.md](SETUP.md) for the full stack (database, Stripe).

## Build and deploy

```bash
npm run build:site          # vite build -> public/assets, repoints public/index.html
npx wrangler pages deploy   # publishes public/ + functions/ only
```

Database changes ship as files in `migrations/`; apply them to production **before** deploying
code that needs them (see [LAUNCH.md](LAUNCH.md)).

## Tests

```bash
npx playwright install chromium   # first time only
npm run test:e2e
```

Starts a local `wrangler pages dev` with an empty database and runs every suite against it
(about 2–3 minutes): database migration, deploy-folder contents, per-election votes, CSV
export safety, rate limits, request volume per visitor, arrow keys, Election Day behaviour at
fixed times, and voting on the 2028 card. Run it before every deploy. The tests refuse to run
against `*.pages.dev`.
