# Election Countdown Launch

This package is ready for Cloudflare Pages with Functions and D1.

## Required Setup

1. Create the D1 database:

   ```bash
   npx wrangler d1 create election-countdown
   ```

2. Copy the returned `database_id` into `wrangler.toml`.

3. Apply the schema:

   - **New database:** apply `schema.sql` only. It already has the per-election shape, so do not
     also run `migrations/0001_election_id.sql` (it would fail on the duplicate column).

     ```bash
     npx wrangler d1 execute election-countdown --remote --file=./schema.sql
     ```

   - **Existing database (production before Oct 2026):** apply the election migration **before**
     deploying the Function that reads `election_id`. Until it runs, the new Function returns 503
     on intent, stats, admin and donor routes; everything else keeps working.

     ```bash
     npx wrangler d1 migrations apply election-countdown --remote
     ```

   Vote intents are stored per election (`midterm-2026`, `presidential-2028`). Requests without
   `?election=` (or `electionId` in the POST body) use `midterm-2026`.

4. Set the admin export secret:

   ```bash
   npx wrangler pages secret put ADMIN_SECRET
   ```

5. Set the IP-hash secret used to salt IP-derived security hashes:

   ```bash
   npx wrangler pages secret put IP_HASH_SECRET
   ```

6. Deploy from the repo root. `wrangler.toml` publishes only `public/` (the site) plus
   `functions/` (the API); nothing else in the repo is uploaded.

   ```bash
   npx wrangler pages deploy
   ```

   Anything the site serves must live in `public/`. Never point `pages_build_output_dir` back at
   the repo root: every file there, including source and any `.env`, would become public.

7. Verify the production health endpoint:

   ```bash
   curl https://YOUR_DOMAIN/api/health
   ```

   It must return `"ok":true` before public traffic.

## Captured Data

- Account registrations and sign-ins
- Vote intent, state, optional city, age range, sex, and donor-only candidate field
- Vote intent change history, including previous and new support state
- Countdown event flips
- Countdown dwell time, page dwell time, visibility changes, and heartbeat activity
- Share/referral/event tracking
- CTA clicks, Vote.gov clicks, already-registered clicks, and countdown cycle changes
- Session metadata with hashed IP and user agent
- Admin analytics and CSV export

## Privacy Guardrails

- Public vote breakdown remains hidden until 50,000 vote intents.
- State and age segment analytics are hidden until 50 records per segment.
- Session cookies are `HttpOnly`, `Secure`, and `SameSite=Lax`.
- IP addresses are hashed before storage.
- Production admin access requires a configured admin secret of at least 32 characters.
- `privacy.html` and `terms.html` are included and linked from the app shell.

## Nightly analytics job (Worker)

`workers/nightly` is a separate Worker on a cron (06:15 UTC). For the previous UTC day it writes
`daily_rollups` rows to D1 and gzipped NDJSON dumps (events, a votes snapshot, an anonymous-votes
snapshot; no emails) plus `manifest.json` to R2 under `daily/YYYY-MM-DD/`.

```bash
npx wrangler r2 bucket create election-countdown-exports   # once
npx wrangler d1 migrations apply election-countdown --remote  # creates daily_rollups (0003)
cd workers/nightly && npx wrangler deploy
```

Re-run a missed day: deploy with `--var NIGHTLY_DAY_OFFSET:N` (N days back), trigger, redeploy.
Admins can also recompute any day from the dashboard or `POST /api/admin/rollup?day=YYYY-MM-DD`.
