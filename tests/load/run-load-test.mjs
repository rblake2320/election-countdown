// Load test against STAGING (a Pages preview deployment with its own D1 database).
//
//   ADMIN_SECRET=... LOAD_TEST_SECRET=... node tests/load/run-load-test.mjs https://staging.election-countdown-38g.pages.dev [vus=1000] [rampSec=60] [holdSec=120]
//
// Refuses to run unless /api/health reports environment "staging".
// Each virtual visitor: page + JS bundle, auth/providers/stats/anonymous-intent reads, then a
// tracking batch every 8 s and a stats refresh every 30 s. 10% vote anonymously, 3% register
// and vote. Pass/fail thresholds were fixed before the first run (see SLO below).
import { writeFileSync, mkdirSync } from "node:fs";

const [base, vusArg = "1000", rampArg = "60", holdArg = "120"] = process.argv.slice(2);
const VUS = Number(vusArg), RAMP_MS = Number(rampArg) * 1000, HOLD_MS = Number(holdArg) * 1000;
const ADMIN = process.env.ADMIN_SECRET, LOAD = process.env.LOAD_TEST_SECRET;
if (!base || !ADMIN || !LOAD) throw new Error("usage: ADMIN_SECRET=.. LOAD_TEST_SECRET=.. node run-load-test.mjs <staging-url>");

const SLO = {
  errorRate: 0.005,
  p95: { page: 300, read: 500, write: 800 },
  p99Any: 1500,
};

const health = await (await fetch(base + "/api/health")).json();
if (health.environment !== "staging" || !health.ok) throw new Error(`refusing: target is not a healthy staging deployment (${JSON.stringify(health)})`);

const metrics = { page: [], read: [], write: [] };
const statuses = {};
const failures = [];
let clientEventsAcked = 0, anonVotes = 0, accountVotes = 0, registrations = 0;

async function hit(kind, name, path, init = {}, client) {
  const headers = { ...(init.headers || {}), "x-load-test-secret": LOAD, "x-load-test-client": client };
  const t0 = performance.now();
  try {
    const res = await fetch(base + path, { ...init, headers, signal: AbortSignal.timeout(15000) });
    const body = await res.text();
    const ms = performance.now() - t0;
    metrics[kind].push(ms);
    const key = `${name} ${res.status}`;
    statuses[key] = (statuses[key] || 0) + 1;
    if (res.status >= 500 || res.status === 429 || (res.status >= 400 && name !== "auth_user")) {
      failures.push({ name, status: res.status, body: body.slice(0, 160) });
    }
    return { status: res.status, body, headers: res.headers };
  } catch (error) {
    metrics[kind].push(performance.now() - t0);
    statuses[`${name} ERR`] = (statuses[`${name} ERR`] || 0) + 1;
    failures.push({ name, status: "ERR", body: String(error).slice(0, 160) });
    return { status: 0, body: "" };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let stopping = false;
const run = Date.now().toString(36);
const html = await (await fetch(base + "/")).text();
const bundle = html.match(/\/?assets\/index-[\w-]+\.js/)[0].replace(/^\.?\/?/, "/");

async function visitor(i) {
  const client = `vu-${run}-${i}`;
  const visitorId = `v_${run}${String(i).padStart(6, "0")}`;
  const json = (body) => ({ method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify(body) });
  await hit("page", "html", "/", {}, client);
  await hit("page", "bundle", bundle, {}, client);
  await Promise.all([
    hit("read", "auth_user", "/api/auth/user", {}, client),
    hit("read", "providers", "/api/auth/providers", {}, client),
    hit("read", "stats", "/api/stats?election=midterm-2026", {}, client),
    hit("read", "anon_get", `/api/intent/anonymous?election=midterm-2026&visitorId=${visitorId}`, {}, client),
  ]);
  const roll = i % 100;
  if (roll < 10) {
    const r = await hit("write", "anon_vote", "/api/intent/anonymous", json({ visitorId, intent: ["red", "blue", "independent", "undecided"][i % 4], state: "OH" }), client);
    if (r.status === 200) anonVotes++;
  } else if (roll < 13) {
    const r = await hit("write", "register", "/api/auth/register", json({ email: `lt-${run}-${i}@example.com`, password: "load-test-password-1" }), client);
    if (r.status === 200) {
      registrations++;
      const cookie = (r.headers.get("set-cookie") || "").split(";")[0];
      const v = await hit("write", "account_vote", "/api/intent", { ...json({ intent: "blue", state: "PA" }), headers: { "content-type": "application/json", origin: base, cookie } }, client);
      if (v.status === 200) accountVotes++;
    }
  }
  let tick = 0;
  while (!stopping) {
    await sleep(8000 + Math.random() * 400);
    if (stopping) break;
    tick++;
    const events = Array.from({ length: 4 }, (_, k) => ({ type: k === 0 ? "heartbeat" : "cta_click", payload: { visitorId, run, tick } }));
    const r = await hit("write", "track_batch", "/api/track/batch", json({ events }), client);
    try { if (r.status === 200) clientEventsAcked += JSON.parse(r.body).stored || 0; } catch {}
    if (tick % 4 === 0) await hit("read", "stats", "/api/stats?election=midterm-2026", {}, client);
  }
}

async function adminJson(path, method = "GET") {
  return (await fetch(base + path, { method, headers: { "x-admin-secret": ADMIN } })).json();
}
const today = new Date().toISOString().slice(0, 10);
const eventsTotal = async () => (await adminJson(`/api/admin/rollup?day=${today}`, "POST")).rows.filter((r) => r.metric === "events").reduce((s, r) => s + r.value, 0);
const statsTotals = async () => {
  const s = await (await fetch(base + "/api/stats?election=midterm-2026", { cache: "no-store" })).json();
  return { accounts: s.total, anonymous: s.anonymous.total };
};

const before = { events: await eventsTotal(), ...(await statsTotals()) };
console.log(`staging ok; baseline ${JSON.stringify(before)}; starting ${VUS} visitors over ${RAMP_MS / 1000}s, hold ${HOLD_MS / 1000}s`);
const started = Date.now();
const vus = [];
for (let i = 0; i < VUS; i++) {
  vus.push(visitor(i));
  await sleep(RAMP_MS / VUS);
}
await sleep(HOLD_MS);
stopping = true;
await Promise.all(vus);
const durationS = (Date.now() - started) / 1000;
await sleep(5000);
const after = { events: await eventsTotal(), ...(await statsTotals()) };

const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]); };
const total = Object.values(metrics).reduce((n, a) => n + a.length, 0);
const errorRate = failures.length / total;
const lat = Object.fromEntries(Object.entries(metrics).map(([k, a]) => [k, { n: a.length, p50: pct(a, 50), p95: pct(a, 95), p99: pct(a, 99), max: Math.round(Math.max(0, ...a)) }]));
const p99Any = pct(Object.values(metrics).flat(), 99);
// Server-written events during the test: register + intent_saved per account vote + anon_intent_saved.
const expectedEvents = clientEventsAcked + registrations + accountVotes + anonVotes;
const integrity = {
  accountVotes: { submitted: accountVotes, stored: after.accounts - before.accounts },
  anonymousVotes: { submitted: anonVotes, stored: after.anonymous - before.anonymous },
  events: { expected: expectedEvents, stored: after.events - before.events },
};
const checks = {
  errorRate: errorRate < SLO.errorRate,
  p95Page: lat.page.p95 < SLO.p95.page,
  p95Read: lat.read.p95 < SLO.p95.read,
  p95Write: lat.write.p95 < SLO.p95.write,
  p99Any: p99Any < SLO.p99Any,
  accountVotesIntact: integrity.accountVotes.submitted === integrity.accountVotes.stored,
  anonymousVotesIntact: integrity.anonymousVotes.submitted === integrity.anonymousVotes.stored,
  eventsIntact: integrity.events.expected === integrity.events.stored,
};
const report = {
  target: base, vus: VUS, rampS: RAMP_MS / 1000, holdS: HOLD_MS / 1000, durationS: Math.round(durationS),
  requests: total, avgRps: Math.round(total / durationS), errorRate: Number(errorRate.toFixed(4)),
  latencyMs: lat, p99AnyMs: p99Any, statuses, integrity, slo: SLO, checks,
  sampleFailures: failures.slice(0, 10), pass: Object.values(checks).every(Boolean),
};
mkdirSync("docs/load-tests", { recursive: true });
const file = `docs/load-tests/${today}-staging-${VUS}vu.json`;
writeFileSync(file, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(report.pass ? "LOAD TEST PASSED" : "LOAD TEST FAILED");
process.exit(report.pass ? 0 : 1);
