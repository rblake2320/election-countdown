# Load tests

Run against **staging** only: a Pages preview deployment (`--branch staging`) bound to the
separate `election-countdown-staging` D1 database (see `[env.preview]` in `wrangler.toml`).
The script refuses any target whose `/api/health` does not report `environment: "staging"`.

```bash
npm run build && npx wrangler pages deploy --branch staging
ADMIN_SECRET=<staging> LOAD_TEST_SECRET=<staging> node tests/load/run-load-test.mjs https://staging.election-countdown-38g.pages.dev 1000 60 120
```

Staging-only `LOAD_TEST_SECRET` lets one machine act as many clients: rate limits are keyed per
virtual visitor instead of per IP (the limits and their database writes still apply). Production
has no such secret, so the keying is inert there.

Thresholds are fixed in the script before running (`SLO`), and integrity is checked afterwards:
votes and events stored must equal what was submitted.

## 2026-10-11: 1,000 concurrent visitors (2x the 500 launch target), PASSED

| Measure | Result | Threshold |
|---|---|---|
| Requests | 27,349 in 190 s (avg 144/s, peak about 170/s) | — |
| Error rate | 0.00% | < 0.5% |
| Page / static p95 | 173 ms | < 300 ms |
| API reads p95 (user, providers, stats, anon lookup) | 330 ms | < 500 ms |
| Writes p95 (tracking batches, votes, sign-ups) | 403 ms | < 800 ms |
| p99, any request | 523 ms (max 1,639 ms) | < 1,500 ms |
| Account votes stored / submitted | 30 / 30 | exact |
| Anonymous votes stored / submitted | 100 / 100 | exact |
| Events stored / expected | 69,196 / 69,196 | exact |

Model per visitor: page + bundle, `auth/user`, `auth/providers`, stats, anonymous-vote lookup; a
4-event tracking batch every 8 s; stats every 32 s; 10% anonymous vote, 3% sign-up + vote. Ramp
0 → 1,000 over 60 s, hold 120 s. Raw report: `2026-10-11-staging-1000vu.json`.

Limits of this result: all load came from one machine in one location; it is a 3-minute burst,
not a 24-hour soak.
