# Friend and nonfriend live production acceptance

Worked on 2026-10-14, 18:54:37–18:55:48 UTC. See `acceptance.json` for machine-generated results and `run.txt` for the test transcript.

Owner: https://aihangout.ai/profile/live_countdown_test (test account 309).
Existing question and answer: https://aihangout.ai/problem/290 (question 290, answer 179, created before countdown linking).

| Viewer | Relationship to owner | Result |
| --- | --- | --- |
| countdown_friend_test (310) | Mutual follows | Worked |
| countdown_stranger_test (311) | Neither follows the other | Worked |

AIHangout has follows, not a separate friend status. Authenticated relationship checks and independent public follower/following readback (`public-relationships.json`) establish these two cases. The accounts and relationships remain available for further testing. No posts were created in this run.

Both viewers signed in through the actual login form in separate Chromium contexts. The friend context used America/Chicago; the nonfriend context used Asia/Tokyo. Each saw four distinct countdown frames on the owner profile, existing question, and existing answer: six placements total.

Changing the owner zone to America/New_York visibly changed the zone strip in all six already-mounted avatars within 5.95 seconds, without page reload. The election deadline remained unchanged. Turning the countdown off removed live images for both viewers within 15.34 seconds; turning it back on restored all six within 30.07 seconds without reload. These are observed upper bounds for this run, not service-level guarantees.

Original enabled state, owner zone, and reporter selection were restored and checked. No captured page errors occurred. Profile, old-post, changed-zone, off, and restored screenshots are retained for both viewers.

## Earlier attempts retained

- `first-attempt.json`: follow request rejected with HTTP 415 because the harness omitted a JSON body. The harness now sends an empty JSON object.
- `second-attempt.json`: ambiguous Follow selector matched both the owner and a follower-list control. The selector now scopes to the owner profile heading.
- `third-attempt.json`: homepage navigation timed out while waiting for load. The cause remains unconfirmed. The final harness signs each viewer in once, records the actual login response and identity, and waits for DOM content readiness. Both login responses were HTTP 200 in the successful run.

Every attempt restored countdown settings. The final acceptance used real deployed services, with no mocked responses. This run tested the existing test owner in desktop browser contexts; personal-profile setup and the physical-phone check still require the user's profile identity and phone details. It did not simulate the owner's device reporting a changed zone: it changed the owner's saved zone through the authenticated settings API and measured delivery to both viewers.

## Repeat on this Windows host

From the repository root, run `./tests/run-production-friend-visibility.ps1`. It uses local Windows-DPAPI-encrypted credentials under ignored `.local/`, injects passwords only into the process environment, and restores countdown settings in `finally`. This test intentionally mutates the named production fixture and retains its two viewer accounts and follow relationships.
