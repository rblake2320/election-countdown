import { chromium } from "playwright";
import { createServer } from "node:http";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.argv[2] || "http://127.0.0.1:8898";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Local testing only");
mkdirSync("docs/live-profile", {recursive: true});
const report = {started: new Date().toISOString(), base, checks: [], errors: []};
const browser = await chromium.launch();
const contexts = [];
let hostServer;
const record = (name, detail) => { report.checks.push({name, result: "Worked", ...detail}); console.log(`PASS ${name}`); };
async function context(options = {}) { const ctx = await browser.newContext(options); contexts.push(ctx); return ctx; }
async function register(ctx, suffix) {
  const r = await ctx.request.post(base + "/api/auth/register", {data: {email: `live-${crypto.randomUUID()}-${suffix}@example.test`, password: "Local-test-only-9284!", firstName: "Live test"}});
  assert.equal(r.status(), 200, await r.text());
  return r.json();
}
async function write(ctx, value, status = 200, origin = base) {
  const r = await ctx.request.put(base + "/api/account/live-profile", {headers: {Origin: origin}, data: value});
  assert.equal(r.status(), status, await r.text()); return r.json();
}
const read = async id => { const r = await fetch(`${base}/api/live-profiles/${id}`); assert.equal(r.status, 200); return r.json(); };
const data = state => ({enabled: state.enabled, electionId: state.event.id, ownerZone: state.ownerZone, reporterId: state.reporterId, version: state.version});
async function view(ctx, id, size = 128) {
  const page = await ctx.newPage();
  page.on("pageerror", error => report.errors.push(error.message));
  await page.setViewportSize({width: size, height: size});
  await page.goto(`${base}/live-avatar?id=${id}`);
  await page.locator('#avatar[data-status="live"]').waitFor();
  return page;
}
const snapshot = page => page.locator("#avatar").evaluate(el => ({...el.dataset, label: el.getAttribute("aria-label")}));

try {
  const owner = await context();
  await register(owner, "owner");
  const anonymous = await context();
  const outsider = await context();
  await register(outsider, "outsider");
  const initial = {enabled: true, electionId: "midterm-2026", ownerZone: "America/Chicago", reporterId: crypto.randomUUID(), version: 0};
  await write(anonymous, initial, 401);
  await write(owner, initial, 403, "https://untrusted.example");
  for (const bad of [null, [], {...initial, ownerZone: "invalid/zone"}, {...initial, version: -1}, {...initial, userId: "another-user"}]) await write(owner, bad, 400);
  let state = await write(owner, initial);
  const originalId = state.id;
  assert.equal(state.version, 1);
  const stored = await (await owner.request.get(base + "/api/account/live-profile")).json();
  assert.deepEqual(stored.id, originalId);
  const publicState = await read(originalId);
  assert.equal(publicState.event.startMs, Date.parse("2026-11-03T05:00:00Z"));
  for (const secret of ["reporterId", "user_id", "email"]) assert.equal(publicState[secret], undefined);
  const foreign = await write(outsider, initial);
  assert.notEqual(foreign.id, originalId);
  assert.equal((await read(originalId)).version, 1);
  record("Authentication, CSRF, malformed input, public-data minimization and owner isolation", {targetUtc: new Date(publicState.event.startMs).toISOString()});

  await write(owner, initial, 409);
  await write(owner, {...data(state), reporterId: crypto.randomUUID()}, 409);
  const nextDevice = crypto.randomUUID();
  state = await write(owner, {...data(state), reporterId: nextDevice, takeover: true});
  await write(owner, {...data(state), reporterId: initial.reporterId}, 409);
  const simultaneous = await Promise.all([owner.request.put(base + "/api/account/live-profile", {headers: {Origin: base}, data: data(state)}), owner.request.put(base + "/api/account/live-profile", {headers: {Origin: base}, data: data(state)})]);
  assert.deepEqual(simultaneous.map(r => r.status()).sort(), [200, 409]);
  state = await (await owner.request.get(base + "/api/account/live-profile")).json();
  record("Stale retries, reporter handover and concurrent compare-and-swap", {version: state.version});

  const a = await view(await context({timezoneId: "Asia/Tokyo"}), originalId);
  await a.waitForTimeout(1200);
  const skewed = await context({timezoneId: "Pacific/Honolulu"});
  await skewed.addInitScript(() => { const realNow = Date.now; Date.now = () => realNow() + 300000; });
  const b = await view(skewed, originalId);
  const c = await view(await context({timezoneId: "Europe/London"}), originalId);
  const samples = await Promise.all([a,b,c].map(snapshot));
  const clockSpread = Math.max(...samples.map(s=>Number(s.serverNow))) - Math.min(...samples.map(s=>Number(s.serverNow)));
  assert.ok(clockSpread < 500, `clock spread ${clockSpread}ms`);
  assert.ok(Math.max(...samples.map(s=>Number(s.remaining))) - Math.min(...samples.map(s=>Number(s.remaining))) <= 1);
  record("Three viewers, late join, different zones and +5-minute device clock", {clockSpreadMs: clockSpread, remainingSeconds: samples.map(s=>Number(s.remaining))});

  // Freeze the actual renderer for 30 seconds; it must catch up from current time on resume.
  const cdp = await a.context().newCDPSession(a);
  await cdp.send("Page.setWebLifecycleState", {state: "frozen"});
  await b.waitForTimeout(30000);
  await cdp.send("Page.setWebLifecycleState", {state: "active"});
  await a.waitForTimeout(300);
  const recovered = await Promise.all([a,b].map(snapshot));
  assert.ok(Math.abs(Number(recovered[0].remaining)-Number(recovered[1].remaining))<=1);
  record("30-second renderer freeze and immediate catch-up", {remainingSeconds: recovered.map(s=>Number(s.remaining))});

  const before = await snapshot(b), changedAt = performance.now();
  state = await write(owner, {...data(state), ownerZone: "America/New_York"});
  await Promise.all([a,b,c].map(page=>page.locator(`#avatar[data-owner-zone="America/New_York"][data-version="${state.version}"]`).waitFor()));
  const changeLatency = performance.now() - changedAt;
  assert.ok(changeLatency < 7000);
  const after = await snapshot(b);
  assert.ok(Math.abs(Number(before.remaining) - Number(after.remaining) - changeLatency / 1000) < 2);
  assert.equal((await read(originalId)).event.startMs, publicState.event.startMs);
  record("Owner zone propagates to all viewers without moving deadline", {latencyMs: changeLatency, zone: state.ownerZone});

  const response = await fetch(base + "/live-avatar?id=" + originalId);
  assert.equal(response.headers.get("x-frame-options"), null);
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors \*/);
  assert.match((await fetch(base + "/api/time")).headers.get("cache-control"), /no-store/);
  assert.equal((await fetch(base + "/")).headers.get("x-frame-options"), "DENY");
  // Different local origin: a historical comment and current profile resolve the same public id.
  const host = await (await context()).newPage();
  hostServer = createServer((req, res) => { res.writeHead(200, {"content-type": "text/html"}); res.end(`<!doctype html><html><head><style>body{background:#edf1f7;font:18px system-ui;padding:40px;color:#12233d}section{background:white;border-radius:20px;padding:28px;margin-bottom:20px;display:flex;gap:24px;align-items:center}iframe{border:0;border-radius:50%}p{color:#53647a}</style></head><body><h1>Live profile delivery test</h1><p>Same profile, separate placements. Test fixtures, not a deployed social feed.</p><section><iframe src="${base}/live-avatar?id=${originalId}" width="128" height="128" title="Current profile"></iframe><div><h2>Current profile</h2><p>Owner's time zone: America/New_York</p></div></section><section><iframe src="${base}/live-avatar?id=${originalId}" width="64" height="64" title="Historical comment"></iframe><div><h2>Earlier comment</h2><p>This placement resolves the current live profile.</p></div></section></body></html>`); });
  await new Promise(resolve => hostServer.listen(0, "127.0.0.1", resolve));
  host.on("console", msg => { if (msg.type() === "error") console.log("HOST ERROR", msg.text()); });
  await host.goto(`http://127.0.0.1:${hostServer.address().port}/`);
  await host.frameLocator('iframe[title="Historical comment"]').locator('#avatar[data-status="live"]').waitFor();
  await host.screenshot({path: "docs/live-profile/cross-origin-placements.png", fullPage: true});
  record("Cross-origin iframe and historical-placement fixture", {screenshot: "docs/live-profile/cross-origin-placements.png", hosting: "separate local origin; not production AIHangout"});
  for (const size of [32,40,64,128]) {
    await c.setViewportSize({width: size, height: size});
    const overflow = await c.evaluate(()=>({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight}));
    assert.deepEqual(overflow, {x:0,y:0});
    await c.screenshot({path:`docs/live-profile/avatar-${size}.png`});
  }
  record("Circular avatar at 32, 40, 64 and 128 pixels", {overflowPixels: 0});

  // Test the actual settings page and device reporter, including an emulated device-zone switch.
  const settings = await owner.newPage();
  await settings.goto(base + "/profile");
  await settings.getByRole("button", {name: "Use this device", exact: true}).click();
  await settings.getByRole("status").filter({hasText:"Live profile saved"}).waitFor();
  const settingsCDP = await owner.newCDPSession(settings);
  await settingsCDP.send("Emulation.setTimezoneOverride", {timezoneId: "America/Denver"});
  await settings.evaluate(()=>window.dispatchEvent(new Event("focus")));
  await b.locator('#avatar[data-owner-zone="America/Denver"]').waitFor();
  state = await (await owner.request.get(base + "/api/account/live-profile")).json();
  assert.equal(state.ownerZone, "America/Denver");
  await settings.screenshot({path:"docs/live-profile/owner-settings.png",fullPage:true});
  record("Owner settings and actual Intl zone reporter", {zone:state.ownerZone, mechanism:"Chromium device-zone emulation + focus return; not physical travel"});

  await b.context().setOffline(true);
  await a.waitForTimeout(95000);
  assert.equal((await snapshot(b)).status, "stale");
  assert.equal(await b.locator("#days").textContent(), "—");
  await b.context().setOffline(false);
  await b.locator('#avatar[data-status="live"]').waitFor();
  const online = await Promise.all([a,b].map(snapshot));
  assert.ok(Math.abs(Number(online[0].remaining)-Number(online[1].remaining)) <= 1);
  record("95-second network outage, stale display and reconnection", {remainingSeconds:online.map(s=>Number(s.remaining))});

  await settings.getByRole("button", {name:"Turn off", exact:true}).click();
  await settings.getByRole("status").filter({hasText:"turned off"}).waitFor();
  await b.locator('#avatar[data-status="error"]').waitFor();
  assert.equal((await fetch(`${base}/api/live-profiles/${originalId}`)).status,404);
  state = await (await owner.request.get(base + "/api/account/live-profile")).json();
  state = await write(owner, {...data(state),enabled:true});
  await b.locator('#avatar[data-status="live"]').waitFor();
  assert.equal(state.id, originalId);
  record("Opt-out removes public display; opt-in restores the same stable link", {version:state.version});

  // Leave a non-sensitive state reference for restart verification.
  writeFileSync(".local/live-profile-restart.json",JSON.stringify({id:originalId, version:state.version, ownerZone:state.ownerZone}));
  await outsider.request.delete(base + "/api/account", {headers:{Origin:base}});
  assert.equal((await fetch(`${base}/api/live-profiles/${foreign.id}`)).status,404);
  record("Account deletion removes its live profile", {});
  assert.deepEqual(report.errors, []);
  report.result = "Worked";
} catch(error) {
  report.result = "Failed"; report.failure = error.stack; console.error(error); process.exitCode = 1;
} finally {
  report.finished = new Date().toISOString(); report.browser = browser.version();
  writeFileSync("docs/live-profile/acceptance.json", JSON.stringify(report,null,2));
  await browser.close();
  if (hostServer) hostServer.close();
}
