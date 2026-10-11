# CLAUDE.md

Guidance for Claude Code working in this repository. See also AGENTS.md.

# Election Countdown

Live countdown to the 2026 Midterms and 2028 Presidential Election with per-election vote plans
(account and anonymous), Google/GitHub sign-in, admin analytics and a nightly data pipeline.

## Stack
Vite + React SPA (`client/`) → built into `public/`; Cloudflare Pages Function API
(`functions/api/[[path]].js`); Cloudflare D1; nightly Cron Worker (`workers/nightly`) → D1 + R2.

## Commands

```bash
npm run dev:full      # site + API + local D1 (needs .dev.vars, see .dev.vars.example)
npm run build         # build client/ into public/
npm run check         # tsc
npm run test:e2e      # full end-to-end suite; run before every deploy
```

## Rules that matter here
- `public/` is generated: edit `client/` and run `npm run build`.
- No inline `<script>`: the CSP is `script-src 'self'` and the build fails on inline scripts.
- Schema changes ship as a new file in `migrations/` plus the same change in `schema.sql`, and are
  applied to production **before** deploying code that needs them.
- Every fix gets a test in `tests/e2e/` that fails without it.
