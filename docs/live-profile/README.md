# Live profile countdown — local acceptance

Update, 2026-10-14: the owner subsequently approved production deployment. See
[production results and the human test profile](PRODUCTION-20261014.md).
The local acceptance notes and original shipping boundary below are historical.

The countdown can now be displayed as an opt-in profile image. Its event catalog and Eastern-time conversion come from the existing `client/src/lib/elections.ts`; there is no second event calendar.

## Use

Sign in and open **My Profile → Live countdown profile**. Enable it on the device that should report your time zone. The panel supplies a public `/live-avatar?id=…` URL and an iframe snippet. Publishing the link exposes the selected event and device zone, not the account's email or reporter ID.

The deadline stays at its original fixed instant. Changing the owner's zone changes the deadline label for everyone; it does not change the time remaining. The reporter checks while the settings page is visible and on focus/resume. Physical movement and locked-phone background reporting have not been exercised: the connected-device inventory returned no Android, Motorola, iPhone or MTP device and adb was unavailable on PATH.

Public delivery endpoints:

- `/api/live-profiles/:id` — current version, event, owner zone and server time.
- `/live-avatar?id=:id` — server-anchored browser renderer with stale-state indication.
- `/api/live-profiles/:id.stream` — experimental multipart PNG frames for a plain image element, regenerated on shared second boundaries. Read-only; no audio or player controls.
- `/api/live-profiles/:id.png` — a snapshot, not a continuously updating image.

The image stream uses a small built-in PNG renderer and the runtime's `CompressionStream`; no new dependency or paid image API is required. Clients must reconnect after a broken stream. AIHangout's adapter does this on network/visibility return and every 30 seconds, and restores initials on image errors.

## Verification

Install the repository dependencies and Playwright Chromium, then run from this repository:

```powershell
node tests/run-live-profile.mjs
node --test tests/avatar-image.test.mjs
```

The first command includes the PNG unit tests, builds the shipped assets, starts real local workerd/D1, runs browser and HTTP acceptance, restarts the server with its retained database, checks the image stream and read limits, and runs the existing embed regression. Each run gets fresh local state to avoid colliding with registration limits. It closes its own processes; logs remain under `.local/`.

With the modified `aihangout-platform` checkout next to this repository and both its root/frontend dependencies installed:

```powershell
node tests/run-aihangout-live-profile.mjs
```

That command builds both applications, applies real AIHangout migrations to a disposable local D1, starts a local HTTPS countdown and a local AIHangout Worker, and exercises the actual sign-in/settings/profile/prior-answer flow. It restores AIHangout's production provider URL when finished. The local self-signed certificate is trusted only by that test browser context. No remote database or deployment is used.

## Retained results

- `acceptance.json`: three viewers, wrong device clock, late join, 30-second renderer freeze, zone propagation, malformed input, unauthorized writers, concurrent updates, device handover, 95-second network loss, opt-out/in, account deletion, restart persistence and existing placements.
- `image-slot-chromium.json` and `image-slot-firefox.json`: actual image rendering with browser JavaScript disabled, independently decoded screenshot digits within a two-second freshness bound, visible-frame hashes, raw PNG frame counts/bytes/age and cancellation. The transport measurements cover one minute locally; they are not load tests or public-host measurements.
- `aihangout-integration.json`: actual built AIHangout sign-in and settings, a live profile image, an answer created before opt-in, visible zone-label pixel change, network fallback/recovery, and removal.
- `avatar-image.test.mjs`: independent PNG decompression verifies unchanged countdown digits versus changed zone-label pixels, event phases, and cancellation stopping background work.
- The original acceptance screenshots show local fixtures. The `production-*` screenshots and `production-retest/` capture the public test profile and its earlier question/answer.

The initial cross-origin fixture timeout and subsequent test setup failures are retained separately. The intercepted host-page test was replaced with a real HTTP host. The device emulation conflict was removed, and the standalone runner now isolates each test database so account-creation limits stay enabled.

The timer test exposed early wakeups that emitted two frames for one second. The stream now rechecks the clock before generating its next frame; the transport assertion requires distinct generated seconds. Screenshot hashes alone also proved too brittle: arbitrary sampling can catch the same painted second twice. The revised visual test requires ongoing progress and independently decodes the actual clock digits against server time. Original cadence failures and the run interrupted by a development reload remain in the evidence folder. Keep the runtime unchanged during timing tests.

## Shipping boundary

Both applications were deployed with explicit owner approval on 2026-10-14. See `PRODUCTION-20261014.md` and `production-retest/` for public-host browser and streaming receipts. A three-phone demonstration still requires those physical devices; browser device-zone emulation is recorded separately from physical travel.

Dependency installation reported existing audit findings (countdown: 5 high; AIHangout root: 2 moderate/6 high; AIHangout frontend: 3 moderate/11 high). This work adds no package dependency and makes no general security-readiness claim. The AIHangout whole-tree TypeScript check also encounters pre-existing JSX syntax in `frontend/src/utils/featureFlags.ts`; its built application, Worker/D1 suite and targeted integration are separate checks.

## Related projects

- **Glimpse Rush:** inspected its HTTP clock sampling, room ping/pong, and shared-clock rendering. The same clock principle is applied here; game state, scoring and reveal code are unchanged.
- **ProfilePays:** inspected its profile DTO, avatar, campaign code and open modernization PRs #6/#7. Those overlapping branches are unchanged. It can consume the public image/iframe endpoints after deployment; payments and campaigns are outside this countdown-first change.
- **AIHangout:** a separate `codex/live-countdown-avatar` branch adds only opt-in profile links and image placements. Existing CSP, CORS, authentication and rate thresholds are unchanged. Images are allowed by its existing policy.
