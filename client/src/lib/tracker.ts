// The one analytics pipeline for the site (replaces the old React hook and the inline tracker in
// index.html, which together double- and quintuple-counted page views).
//
// Events are queued and sent to POST /api/track/batch every 8 s or every 25 events, and with
// navigator.sendBeacon when the page is hidden or closed, so nothing is lost on exit.
// Every event carries the same base payload; the server adds user (if signed in), hashed IP,
// user agent and timestamp.
import { getVisitorId } from "@/lib/visitor";

type Payload = Record<string, unknown>;
interface QueuedEvent { type: string; payload: Payload }

const FLUSH_MS = 8000;
const FLUSH_AT = 25; // server accepts up to 25 per batch
const HEARTBEAT_MS = 15000;

const sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const pageStartedAt = Date.now();
let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let countdown: string | null = null;
let countdownSince = Date.now();

function basePayload(): Payload {
  return {
    visitorId: getVisitorId(),
    sessionId,
    path: window.location.hash || "#/",
    referrer: document.referrer || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    viewport: { width: window.innerWidth, height: window.innerHeight },
    countdown,
    pageElapsedMs: Date.now() - pageStartedAt,
  };
}

function body(events: QueuedEvent[]) {
  return JSON.stringify({ events });
}

export function flush(useBeacon = false) {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!queue.length) return;
  const events = queue.splice(0, FLUSH_AT);
  const data = body(events);
  if (useBeacon && navigator.sendBeacon?.("/api/track/batch", new Blob([data], { type: "application/json" }))) {
    if (queue.length) flush(true);
    return;
  }
  fetch("/api/track/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: data,
    keepalive: true,
  }).catch(() => {
    // Never block or break the UI for analytics.
  });
  if (queue.length) flush(useBeacon);
}

/** Record an event. Safe to call from anywhere, any number of times. */
export function track(type: string, data: Payload = {}) {
  queue.push({ type, payload: { ...basePayload(), ...data } });
  if (queue.length >= FLUSH_AT) flush();
  else if (!flushTimer) flushTimer = setTimeout(() => flush(), FLUSH_MS);
}

/** Called by the countdown whenever the visible event changes; records dwell time on the previous one. */
export function setCountdown(id: string, reason: "initial" | "flip" | "advance") {
  if (countdown === id) return;
  const previous = countdown;
  const durationMs = Date.now() - countdownSince;
  countdown = id;
  countdownSince = Date.now();
  if (!previous) {
    track("countdown_view", { countdown: id, reason });
  } else {
    // fromYear/toYear: field names the daily rollup (flips_to) reads.
    track("flip", { fromYear: previous, toYear: id, durationMs, reason });
  }
}

function clickTarget(event: MouseEvent) {
  return (event.target as Element | null)?.closest?.("a, button, [role='button'], [role='menuitem']") as HTMLElement | null;
}

/** Starts page-level tracking once per page load. */
export function startTracking() {
  if (started) return;
  started = true;

  track("page_view", {
    language: navigator.language || "",
    screen: { width: window.screen.width, height: window.screen.height },
  });
  const ref = new URLSearchParams(window.location.search).get("ref");
  if (ref) track("referral", { referralCode: ref.slice(0, 64) });

  document.addEventListener("click", (event) => {
    const target = clickTarget(event);
    if (!target) return;
    const label = (target.innerText || target.getAttribute("aria-label") || target.title || "").trim().slice(0, 120);
    const href = (target as HTMLAnchorElement).href || "";
    track("cta_click", { label, href, testId: target.dataset.testid || "", role: target.getAttribute("role") || target.tagName.toLowerCase() });
    if (href.includes("vote.gov")) track("vote_gov_click", { label, href });
    else if (href && !href.startsWith(window.location.origin)) track("external_link", { label, href });
  }, true);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      track("visibility_hidden", { countdownDurationMs: Date.now() - countdownSince });
      flush(true);
    } else {
      countdownSince = Date.now();
      track("visibility_visible");
    }
  });

  window.addEventListener("pagehide", () => {
    track("page_exit", { totalDurationMs: Date.now() - pageStartedAt, countdownDurationMs: Date.now() - countdownSince });
    flush(true);
  });

  setInterval(() => {
    if (document.visibilityState === "visible") track("heartbeat", { countdownDurationMs: Date.now() - countdownSince });
  }, HEARTBEAT_MS);
}
