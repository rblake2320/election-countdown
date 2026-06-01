# Election Countdown Launch

This package is ready for Cloudflare Pages with Functions and D1.

## Required Setup

1. Create the D1 database:

   ```bash
   npx wrangler d1 create election-countdown
   ```

2. Copy the returned `database_id` into `wrangler.toml`.

3. Apply the schema:

   ```bash
   npx wrangler d1 execute election-countdown --file=./schema.sql
   ```

4. Set the admin export secret:

   ```bash
   npx wrangler pages secret put ADMIN_SECRET
   ```

5. Set the IP-hash secret used to salt IP-derived security hashes:

   ```bash
   npx wrangler pages secret put IP_HASH_SECRET
   ```

6. Deploy the folder with Cloudflare Pages.

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
