(() => {
  "use strict";
  const id = new URLSearchParams(location.search).get("id");
  const el = Object.fromEntries(["avatar", "eyebrow", "days", "unit", "clock", "zone", "status"].map(k => [k, document.getElementById(k)]));
  let state = null, anchor = null, lastSuccess = -Infinity, busy = false, failed = false;
  const pad = n => String(n).padStart(2, "0");
  const now = () => anchor.serverMs + performance.now() - anchor.monoMs;
  function unavailable(message) {
    state = null;
    el.avatar.dataset.status = "error";
    el.avatar.removeAttribute("data-remaining");
    el.avatar.setAttribute("aria-label", message);
    el.days.textContent = "—"; el.unit.textContent = "OFFLINE";
    el.clock.textContent = "--:--:--"; el.zone.textContent = ""; el.status.textContent = message;
  }
  function render() {
    if (!state || !anchor) return;
    const time = now();
    const stale = performance.now() - lastSuccess > 90000;
    const remaining = Math.max(0, Math.floor((state.event.startMs - time) / 1000));
    const today = time >= state.event.startMs && time < state.event.endMs;
    const past = time >= state.event.endMs;
    const days = Math.floor(remaining / 86400);
    const clock = `${pad(Math.floor(remaining % 86400 / 3600))}:${pad(Math.floor(remaining % 3600 / 60))}:${pad(remaining % 60)}`;
    el.avatar.dataset.status = stale ? "stale" : failed ? "reconnecting" : "live";
    el.avatar.dataset.remaining = String(remaining);
    el.avatar.dataset.version = String(state.version);
    el.avatar.dataset.ownerZone = state.ownerZone;
    el.avatar.dataset.serverNow = String(time);
    el.days.textContent = stale ? "—" : today ? "TODAY" : past ? "✓" : String(days);
    el.days.style.fontSize = today ? "18vmin" : "";
    el.unit.textContent = stale ? "RECONNECT" : today ? "ELECTION DAY" : past ? "FINISHED" : "DAYS";
    el.clock.textContent = stale ? "--:--:--" : clock;
    el.eyebrow.textContent = state.event.id === "inauguration-2029" ? "INAUGURATION" : "ELECTION";
    el.zone.textContent = new Intl.DateTimeFormat("en-US", {timeZone: state.ownerZone, month: "short", day: "numeric", hour: "numeric", timeZoneName: "short"}).format(state.event.startMs);
    el.status.textContent = stale ? "RECONNECT TO UPDATE" : failed ? "RECONNECTING" : "LIVE";
    el.avatar.setAttribute("aria-label", `${state.event.title}: ${stale ? "connection stale" : today ? state.event.todayTitle : past ? "finished" : `${days} days, ${clock} remaining`}. Owner zone ${state.ownerZone}. ${el.zone.textContent}`);
  }
  async function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      let best = null;
      // State and server timestamp travel together; no race between separate clock/state requests.
      for (let i = 0; i < (anchor ? 1 : 3); i++) {
        const start = performance.now();
        const response = await fetch(`/api/live-profiles/${encodeURIComponent(id)}`, {cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(4000)});
        if (response.status === 404) { unavailable("PROFILE UNAVAILABLE"); return; }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const value = await response.json();
        const end = performance.now();
        if (value.id !== id || !value.enabled || !Number.isSafeInteger(value.version) ||
            !Number.isFinite(value.serverNowMs) || !Number.isFinite(value.event?.startMs) ||
            !Number.isFinite(value.event?.endMs) || value.event.endMs <= value.event.startMs ||
            (state && value.version < state.version)) throw new Error("Invalid profile state");
        new Intl.DateTimeFormat("en", {timeZone: value.ownerZone});
        const sample = {value, rtt: end - start, monoMs: (start + end) / 2};
        if (!best || value.version > best.value.version || (value.version === best.value.version && sample.rtt < best.rtt)) best = sample;
      }
      if (best.rtt > 2000) throw new Error("Clock sample too slow");
      state = best.value;
      anchor = {serverMs: state.serverNowMs, monoMs: best.monoMs};
      lastSuccess = performance.now(); failed = false;
    } catch {
      failed = true;
      if (!state) unavailable("RECONNECTING");
    } finally { busy = false; render(); }
  }
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id || "")) { unavailable("PROFILE ID REQUIRED"); return; }
  refresh();
  setInterval(render, 100);
  setInterval(refresh, 5000);
  for (const event of ["online", "focus", "pageshow"]) window.addEventListener(event, refresh);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
})();
