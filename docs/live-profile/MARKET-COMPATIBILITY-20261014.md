# Live profile countdown: compatibility and product opportunity

Research date: 2026-10-14. This is a sourced product assessment, not a claim of platform approval or customer demand. Platform documentation was inspected; no third-party account/profile was modified and no paid service was purchased.

## Decision

There is a plausible product opportunity in an opt-in, live profile badge for communities that control their own website. A universal replacement for profile photos across closed social networks is not supported by the evidence. The recommended first distribution is a WordPress adapter plus an ordinary iframe embed; the existing AIHangout integration is the reference implementation.

The pitch: let members display an upcoming event beside their identity, with the current countdown also visible on older contributions, without editing each post. Keep the normal photo recognizable; make replacement versus an adjacent badge a host-controlled option. Whether this improves engagement or earns money must be measured in a pilot.

## What exists already

| Existing product or project | Evidence | Implication |
|---|---|---|
| [TickerFactory](https://tickerfactory.com/) and its [FAQ](https://www.tickerfactory.com/faq.html) | Countdown/progress images for forum signatures, blogs and websites; editable data can retain the same URL. The vendor dates its graphical tickers to 2003. | Personal countdowns carried across existing posts and remotely updated image URLs are established ideas. |
| [MotionMail](https://motionmailapp.com/) | Email countdown images, editing after sending, time-zone-independent remaining time, and paid plans. | Synchronization across viewer zones and changing a remotely hosted timer after publication are not unique. |
| [Sendtric](https://www.sendtric.com/) | Countdown images, personalized images and event timers; explicit Apple Mail fallback options for caching/display limitations. | Dynamic-image infrastructure is a competitive category. Vendor conversion/uptime claims were not independently verified or adopted as our own. |
| [Gravatar](https://docs.gravatar.com/sdk/images/) | One avatar identity can be displayed by multiple integrated sites. | Cross-site avatar distribution is established and still requires host adoption. |
| [TimeChanger source](https://github.com/adrian-kalinin/time-changer/blob/master/main.py) | A Telegram clock-avatar script generates and repeatedly uploads replacement pictures. | Clock avatars have prior examples. This script is not evidence that our stream works in Telegram or that frequent automated updates are a supported commercial integration. |

Our candidate distinction is the combination of authenticated owner controls, server-based countdown timing, opt-in time-zone reporting, existing-profile/post placement, live state propagation, and recovery. Individual ingredients are not new. This research does not establish technical novelty, exclusivity, patentability, or product-market fit.

## Where another site can allow it

“Documented route” means the platform exposes an integration mechanism. It does not mean our application has been installed and tested there, accepted in a marketplace, or approved by that site's owner.

| Target | What the primary source permits | Fit for this implementation |
|---|---|---|
| Self-hosted WordPress | [`get_avatar_url`](https://developer.wordpress.org/reference/hooks/get_avatar_url/) filters the avatar URL; [`get_avatar`](https://developer.wordpress.org/reference/functions/get_avatar/) filters avatar HTML. | Strong first adapter candidate with site-admin installation. Theme/plugin image proxies, lazy loading, old comments, opt-out and reconnection require an actual integration test. |
| WordPress.com | [Code documentation](https://wordpress.com/support/code/) permits iframe/scripts on plugin-enabled plans with hosting features activated; free-site code is restricted. | Eligible sites can use an embed or plugin. Do not promise that pasting HTML on every free plan works. |
| Wix | [Editor documentation](https://support.wix.com/en/article/wix-editor-embedding-a-site-or-a-widget) permits HTTPS site/HTML iframe embeds. | Good page/widget route; this is not permission to replace Wix Members avatars. |
| Webflow | [Code Embed documentation](https://help.webflow.com/hc/en-us/articles/33961332238611-Custom-code-embed) permits HTML/CSS/JS and iframe embeds on eligible plans. | Good creator/event-page route; plan access and a published-page test are required. |
| Circle | [Custom HTML documentation](https://help.circle.so/p/posts/post-spaces/embed-custom-html-code-within-posts) permits admin-added HTML on Professional or higher. In mobile apps it opens through a separate attachment view; code is omitted from email notifications. | Possible admin event/post card. Not a documented member-avatar integration and not seamless inline native-mobile delivery. |
| Discord | [Custom Profiles](https://support.discord.com/hc/en-us/articles/4403147417623-Custom-Profiles) supports uploaded animated GIF avatars for Nitro. | Animation support is not live-data support. The documented upload flow does not provide a remote stream slot. A normal link is a separate fallback. |
| Telegram | [Profile API](https://core.telegram.org/api/profile) supports uploaded photos and optionally animated profile pictures. | No documented direct multipart-stream avatar route in the inspected API. Repeated upload automation is a different architecture and was not implemented or endorsed. |
| X | [Profile documentation](https://help.x.com/en/managing-your-account/how-to-customize-your-profile) says animated GIFs are unsupported for profile/header images. | The normal profile-photo flow cannot carry this live countdown. Use a permitted link or independently tested page/card placement instead. |
| LinkedIn | [Photo requirements](https://www.linkedin.com/help/linkedin/answer/a549049?lang=en) specify PNG/JPG and that a profile photo reflect the person's likeness. | A countdown-only live profile picture is a poor fit for both format and purpose. Do not market it as supported. |
| GitHub README/profile README | [Image proxy documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-anonymized-urls) describes Camo and caching. Its linked [MIME allowlist](https://raw.githubusercontent.com/atmos/camo/master/mime-types.json) does not list `multipart/x-mixed-replace`. | Do not promise our stream in README image slots. Static snapshots and links are different outputs; opening a link can show the live renderer. No GitHub live-avatar claim. |
| Gravatar | [Default-image rules](https://docs.gravatar.com/sdk/images/) require a recognized image extension and exclude query strings. | Our `.stream` endpoint is not a documented default-image format. A `.png` snapshot cannot provide ongoing ticks by itself. Gravatar is not an automatic bridge around host restrictions. |
| Discourse | [Official forum discussion](https://meta.discourse.org/t/sso-external-avatars/192392) discusses external avatar URLs and local downloads; later [discussion](https://meta.discourse.org/t/allow-polling-avatar-from-uri/275943?tl=en) contains tentative configuration advice. | Secondary candidate requiring a tested plugin/adapter. Do not globally disable image protections based on those discussions, or treat older forum suggestions as a current compatibility guarantee. |

## What the current implementation actually supplies

- `/live-avatar?id=...`: browser renderer suitable for an approved iframe placement.
- `/api/live-profiles/:id.stream`: multipart PNG frames, requiring a direct compatible image path and reconnection handling.
- `/api/live-profiles/:id.png`: one snapshot per request. A snapshot saved or cached by another site cannot keep ticking.
- `/api/live-profiles/:id`: read-only state, event deadline and server time. Owner updates use authenticated routes.
- Owner time zone changes the deadline label, not the fixed event instant. Device reporting currently happens while settings are visible or on resume/focus; it is not continuous background phone tracking.
- Event choices currently come from the election catalog. Generic creator launches, webinars or community events would require product work; they are proposed uses, not shipped options.

Worked, from the retained public acceptance on 2026-10-14: ticking profile and older question/answer; anonymous visibility; three viewer clocks with a measured 39 ms spread; unchanged deadline after owner-zone update; unlink/relink; and recovery after a 35-second outage. See [production acceptance](production-retest/acceptance.json) and [production report](PRODUCTION-20261014.md). These results apply to AIHangout, not to the uninstalled targets above.

Worked, read-only HTTP check during this research: the public live-avatar URL returned 200, `Cache-Control: no-store`, CSP `frame-ancestors *`, and no X-Frame-Options denial. See [header receipt](market-http-check-20261014.json). This verifies our endpoint's embedding headers, not a Wix/Webflow/Circle installation.

The earlier one-minute public stream transferred 71,746 bytes in 60.9 seconds with 62 distinct generated seconds and no decoded-clock mismatches. That is one observed stream. Source inspection shows each connection renders its own frames and refreshes state periodically; it is not a measured high-concurrency service. Browser rendering from server time should be the preferred integration where available, with image streaming reserved for placements that need it.

## Product package and reasons for a site owner to adopt

1. Start with an optional “live event badge” beside a normal profile photo, with a larger countdown on the profile page. Let the host choose supported placements, including old comments. This preserves identity at small avatar sizes.
2. Offer an iframe for event/creator pages and a WordPress plugin for integrated identity placement. A small documented component/API can follow for custom applications. Do not require users to share other-site passwords.
3. Keep a fixed event instant, an explicit expiration state, and a normal-photo fallback. Add clear disclosure when the owner publishes their time zone; offer manual/fixed-zone selection.
4. Give site owners event/template allowlists, an off switch, removal/reporting controls and a bounded network/performance budget. An opt-in user setting must not override a host's ban on advertising, animation or external requests.
5. Use first-party rendering or a privacy-conscious delivery option where possible. A direct third-party image request can disclose network/referrer information even without cookies; do not promise “no tracking” without checking the delivery and retention design.
6. Sell a measurable site benefit: event discovery, attendance or useful member engagement, plus installation/support and branding. These are hypotheses to validate. A plain countdown is already available cheaply or free; the case for payment is reliable integration and useful outcomes.

Suggested first customer types: independent creator communities promoting a launch, event/conference communities, and membership/course communities with a shared upcoming session. These are fit hypotheses inferred from the placement and allowed integration mechanisms, not confirmed buyers. Avoid pitching every major social network as a supported destination.

## Pilot and useful data

Proposed next milestone: three independently operated, consenting sites; start with one real WordPress installation and one real Wix or Webflow page. No third-party deployments, outreach or purchases were made by this research.

For each installed placement, test page load, late join, a skewed device clock, old comments, owner changes, opt-out, loss/recovery of network, browser visibility changes, and expiration. Test a real iPhone/Safari and Android device rather than calling desktop viewport emulation a phone pass. Measure performance with many visible profiles before choosing a supported workload.

Collect only data needed for the decision, with the host's agreement:

- installation completion and time to first successful render;
- members offered the feature, opt-ins, opt-outs and continued use;
- visible display sessions and clicks, separated from raw image requests/frames/reconnects;
- event registrations or attendance where the host supplies an appropriate conversion event;
- first-render time, stale displays, recovery time, failure rate and bytes/CPU/database cost;
- complaints, moderation removals and mobile/browser failures.

Do not count each PNG frame as an impression or each request as a person. Caches, proxies and prefetchers further weaken request-based “views.” Do not turn this into a cross-site identity graph or store precise travel/location history. A controlled comparison with normal profiles is needed before claiming engagement uplift.

Advance only after other owners can install it, users choose to keep it, the agreed workload meets explicit performance targets, and at least one owner is willing to pay for ongoing use. Until then, the conclusion is a promising distribution/product hypothesis with a working AIHangout reference, not a validated market sweet spot.
