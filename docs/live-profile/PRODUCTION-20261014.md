# Production test profile — 2026-10-14

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
