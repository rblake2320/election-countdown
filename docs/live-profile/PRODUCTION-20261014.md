# Production test profile — 2026-10-14

## Latest authorized redeployment and retest (12:31 PM America/Chicago)

The owner's request to deploy both and check the live profile and old posts was
executed again against the current committed source. Pages deployment:
`8f673448`; AIHangout Worker version: `45eaae7b-fd76-4462-a912-9d684c9d4911`.
The additive migrations succeeded, public health endpoints returned 200, and
AIHangout's deployment verifier passed 15/15, including deployed asset identity.
The public countdown HTML, CSS and JavaScript also matched local build hashes.

`production-retest/acceptance.json` records nine successful live checks with no
browser errors. The profile, existing question 290 and answer 179 visibly ticked;
an anonymous visitor saw both old placements. Three viewers in different device
zones had identical displayed remaining seconds and 39 ms estimated clock spread.
Owner-zone changes reached already-open avatars without moving the deadline.
Unlink/relink changed both earlier placements. A 35-second network outage showed
initials, then recovered to a moving countdown. A fresh authenticated settings
page rendered the owner's live preview. The original owner zone, reporting device
and AIHangout link were restored and read back.

The latest public stream receipt records 62 frames for 62 distinct seconds in
60.9 seconds, 71,746 bytes, maximum measured frame age 134 ms, and zero independently
decoded clock mismatches. Earlier receipts are retained separately.

Reproduce the read-only public checks with `node tests/e2e/production-assets.mjs`
and `node tests/e2e/production-stream.mjs`. The existing-test-account browser flow
is `node tests/e2e/production-live-profile.mjs`; it requires that account's password
in the process-only `LIVE_PROFILE_TEST_PASSWORD` environment variable. It creates
no posts or accounts, temporarily changes only the guarded test identity's avatar
settings, and restores them in `finally`. Do not run simultaneous writers to this
test identity during acceptance.

Screenshots and current machine receipts are in `production-retest/`. The
original deployment record follows for historical comparison.

## Original deployment record

Owner authorized deployment and selection of a test identity. The profile uses the
human account type and the clearly labeled username `live_countdown_test`; it is a
test fixture, not a claim about a real person's identity. Registration used a
reserved `.invalid` email address and did not verify email or vote intention.

- Profile: https://aihangout.ai/profile/live_countdown_test
- Earlier-answer test thread: https://aihangout.ai/problem/290 (answer 179)
- Public renderer: https://electionclock.com/live-avatar?id=d7d3e530-9b0b-4b54-a162-31dbc7445f3a
- Owner settings: https://electionclock.com/#/profile

The thread text quotes the owner-supplied acceptance notes. Its title is marked
`[TEST]`. Both the question and answer were created before enabling the AIHangout link.

## Executed release and acceptance

`deploy-live-profile.mjs --apply` built both projects, compiled Pages Functions,
ran the production dry-run, applied the two additive migrations, deployed both
applications, and returned HTTP 200 for the public clock and AIHangout health
and security endpoints. Pages deployment: `dc5f8403`; final AIHangout Worker
version after the setup-link correction: `f5b71d89-9e97-4502-8614-dfede36e878b`.

Worked:

- Fresh pre-release AIHangout Worker/D1 suite: 57 tests, four files; Crucible checks passed.
- Actual browser sign-in, settings link/save, visible moving profile image, and
  the same image on the question and answer created before opt-in.
- Removal produced zero live images on the earlier thread; relinking restored two.
- One-minute public transport: 62 PNG frames, 62 distinct generated seconds,
  71,673 bytes, maximum measured frame age 80 ms. Independently decompressed
  PNG clock digits matched their server generation time on every frame.
- Owner API zone change to New York retained the exact event deadline. The
  browser's explicit `Use this device` handover restored Chicago; the embedded
  and standalone renderers displayed Chicago and the unchanged deadline.
- The final public profile and earlier thread remain available for manual testing.

Machine receipts: `production-stream-20261014.json`,
`production-browser-20261014.json`, `production-zone-New_York-20261014.json`.
Screenshots are the `production-*-20261014.png` files in this folder.

## Findings during the live test

The original AIHangout setup link used `/profile`, but the countdown application
uses hash routing. It landed on the homepage. The link now uses `/#/profile`;
the deployed link was read back and its destination displayed the authenticated
owner's live-profile controls. Earlier local integration entered settings
directly and did not exercise this outbound setup link.

The owner iframe preview was initially blank while direct rendering and image
streaming worked. A fresh authenticated page load rendered the preview, and its
accessible countdown and owner zone were read back. The browser console also
recorded an extension custom-element error; its relationship to the initial
blank frame was not established. No browser security setting was changed.

These are public-host functional results for one synthetic human account and
one test thread. They do not add physical-phone travel, background reporting,
load, or general security acceptance to the earlier local results.
