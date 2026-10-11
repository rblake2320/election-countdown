// Admin data: filtered exports, on-demand daily rollups, and the admin dashboard.
// Usage: node data-pipeline.mjs <base> <admin-secret> [--expect-fixed | --expect-broken]
import { chromium } from "playwright";
import assert from "node:assert/strict";
const [base, secret, mode = "--expect-fixed"] = process.argv.slice(2);
if (/pages\.dev/.test(base)) throw new Error("local only");
const run = Date.now().toString(36);
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const admin = { "x-admin-secret": secret };

async function call(method, path, body, headers = {}) {
  const res = await fetch(base + path, {
    method, headers: { "content-type": "application/json", origin: base, "cf-connecting-ip": "198.20.0.9", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let data = text; try { data = JSON.parse(text); } catch {}
  return { status: res.status, data, cookie: (res.headers.get("set-cookie") || "").split(";")[0], type: res.headers.get("content-type") };
}

// Seed: one account vote in WY, one anonymous vote in WY, a flip event.
const reg = await call("POST", "/api/auth/register", { email: `data-${run}@example.com`, password: "correct-horse-1" });
await call("POST", "/api/intent", { intent: "independent", state: "WY" }, { cookie: reg.cookie });
await call("POST", "/api/intent/anonymous", { visitorId: `v_${run}data01`, intent: "red", state: "WY" });
await call("POST", "/api/track/flip", { fromYear: "midterm-2026", toYear: "presidential-2028", run });

const out = {};
const votesCsv = await call("GET", "/api/admin/export/votes.csv?election=midterm-2026&state=WY", undefined, admin);
out.votesCsvStatus = votesCsv.status;
if (mode === "--expect-broken") {
  const ev = await call("GET", "/api/admin/export/events.json", undefined, admin);
  console.log(JSON.stringify({ votesCsvFiltered: String(votesCsv.data).split("\n").length, eventsJson: ev.status }));
  assert.equal(ev.status, 404, "control: old code has no events export");
  console.log("CONTROL: no data pipeline on this build");
  process.exit(0);
}
out.votesCsvHasEmailColumn = String(votesCsv.data).split("\n")[0].includes("email");
out.votesCsvHasOurRow = String(votesCsv.data).includes(`data-${run}@example.com`);
out.votesJsonTX = (await call("GET", "/api/admin/export/votes.json?state=TX&election=midterm-2026", undefined, admin)).data.rows.filter((r) => r.email === `data-${run}@example.com`).length;
out.anonJson = (await call("GET", "/api/admin/export/anon-votes.json?state=WY", undefined, admin)).data.rows.some((r) => r.visitor_id === `v_${run}data01`);
const flips = (await call("GET", "/api/admin/export/events.json?type=flip", undefined, admin)).data.rows;
out.flipFound = flips.some((r) => JSON.parse(r.payload_json).run === run);
out.flipsOnlyFlips = flips.every((r) => r.event_type === "flip");
out.futureWindowEmpty = (await call("GET", `/api/admin/export/events.json?from=${tomorrow}`, undefined, admin)).data.count === 0;
out.badFrom = (await call("GET", "/api/admin/export/events.json?from=notadate", undefined, admin)).status;
out.noSecret = (await call("GET", "/api/admin/export/events.csv")).status;
out.csvType = (await call("GET", "/api/admin/export/events.csv?type=flip", undefined, admin)).type;

const rollup = await call("POST", `/api/admin/rollup?day=${today}`, undefined, admin);
const metric = (m, d) => (rollup.data.rows || []).find((r) => r.metric === m && (d === undefined || r.dimension === d))?.value || 0;
out.rollupFlips = metric("events", "flip");
out.rollupNewVotesMidtermIndependent = metric("new_votes", "midterm-2026|independent");
out.rollupNewAnonMidtermRed = metric("new_anon_votes", "midterm-2026|red");
out.rollupVisitors = metric("unique_visitors", "all");
out.rollupNewAccounts = metric("new_accounts", "all");
const read = await call("GET", `/api/admin/rollups?from=${today}&to=${today}&metric=events`, undefined, admin);
out.rollupsReadBack = (read.data.rows || []).every((r) => r.metric === "events") && read.data.rows.length > 0;
out.rollupBadDay = (await call("POST", "/api/admin/rollup?day=2026-13-45", undefined, admin)).status;

// Dashboard UI
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, acceptDownloads: true });
const p = await ctx.newPage();
const pageErrors = [];
p.on("pageerror", (e) => pageErrors.push(e.message));
await p.goto(base + "/#/admin", { waitUntil: "load" });
await p.locator("[data-testid=input-admin-secret]").fill(secret);
await p.locator("[data-testid=button-admin-unlock]").click();
await p.locator("[data-testid=admin-data-panel]").waitFor({ timeout: 15000 });
await p.locator("[data-testid=button-recompute-today]").click();
await p.waitForTimeout(2000);
out.uiEventTypesListed = await p.locator("[data-testid=table-event-types] td.font-mono", { hasText: "flip" }).count();
out.uiCharts = await p.locator("[data-testid=chart-visitors] .recharts-wrapper, [data-testid=chart-votes] .recharts-wrapper").count();
out.uiUnverifiedCount = await p.locator("[data-testid=text-unverified-votes]").innerText();
const [download] = await Promise.all([p.waitForEvent("download"), p.locator("[data-testid=button-export]").click()]);
out.uiDownloadName = download.suggestedFilename();
out.uiPageErrors = pageErrors.length;
await b.close();

console.log(JSON.stringify(out));
assert.equal(out.votesCsvStatus, 200); assert.equal(out.votesCsvHasEmailColumn, true); assert.equal(out.votesCsvHasOurRow, true);
assert.equal(out.votesJsonTX, 0, "state filter excludes WY rows");
assert.equal(out.anonJson, true);
assert.equal(out.flipFound, true); assert.equal(out.flipsOnlyFlips, true, "type filter");
assert.equal(out.futureWindowEmpty, true, "from filter");
assert.equal(out.badFrom, 400); assert.equal(out.noSecret, 401);
assert.match(out.csvType || "", /text\/csv/);
assert.ok(out.rollupFlips >= 1); assert.ok(out.rollupNewVotesMidtermIndependent >= 1); assert.ok(out.rollupNewAnonMidtermRed >= 1);
assert.ok(out.rollupVisitors >= 1); assert.ok(out.rollupNewAccounts >= 1);
assert.equal(out.rollupsReadBack, true); assert.equal(out.rollupBadDay, 400);
assert.equal(out.uiEventTypesListed, 1, "dashboard lists the flip event type");
assert.equal(out.uiCharts, 2, "both charts render");
assert.match(out.uiUnverifiedCount, /^\d/);
assert.match(out.uiDownloadName, /^votes_midterm-2026\.csv$/);
assert.equal(out.uiPageErrors, 0);
console.log("DATA PIPELINE TEST PASSED");
