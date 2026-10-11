// End-to-end check of election-aware intent routes against a LOCAL `wrangler pages dev`.
// Usage: node api-e2e.mjs http://localhost:8799 <admin-secret>
import assert from "node:assert/strict";

const [base, adminSecret] = process.argv.slice(2);
assert.ok(!/pages\.dev|election-countdown-38g/.test(base), "refusing to run against production");
let cookie = "";

async function call(method, path, body, extra = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", origin: base, cookie, ...extra },
    body: body ? JSON.stringify(body) : undefined
  });
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

const email = `e2e-${Date.now()}@example.com`;
const reg = await call("POST", "/api/auth/register", { email, password: "correct-horse-1", firstName: "E2E" });
assert.equal(reg.status, 200, `register: ${JSON.stringify(reg.data)}`);
assert.ok(cookie, "session cookie set");

// Old client shape: no election anywhere -> defaults to midterm-2026.
const s1 = await call("POST", "/api/intent", { intent: "blue", state: "CA", ageRange: "25-34" });
assert.equal(s1.status, 200, JSON.stringify(s1.data));
assert.equal(s1.data.electionId, "midterm-2026");

// New client shape: election in body.
const s2 = await call("POST", "/api/intent", { intent: "red", state: "CA", electionId: "presidential-2028" });
assert.equal(s2.data.electionId, "presidential-2028");

// The 2028 answer must NOT overwrite the 2026 one (the bug being fixed).
const g26 = await call("GET", "/api/intent");
const g28 = await call("GET", "/api/intent?election=presidential-2028");
assert.equal(g26.data.intent, "blue", "midterm answer survives a 2028 save");
assert.equal(g28.data.intent, "red");

// Changing the 2026 answer updates in place and leaves 2028 alone.
await call("POST", "/api/intent?election=midterm-2026", { intent: "independent", state: "CA" });
assert.equal((await call("GET", "/api/intent")).data.intent, "independent");
assert.equal((await call("GET", "/api/intent?election=presidential-2028")).data.intent, "red");

const acct = await call("GET", "/api/account");
assert.deepEqual(Object.keys(acct.data.intents).sort(), ["midterm-2026", "presidential-2028"]);
assert.equal(acct.data.intent.electionId, "midterm-2026", "legacy `intent` field still the midterm");
const hist = await call("GET", "/api/intent/history");
assert.equal(hist.data.length, 3);
assert.deepEqual(hist.data.map((h) => h.electionId).sort(), ["midterm-2026", "midterm-2026", "presidential-2028"]);

// Public stats are per election.
const st26 = await call("GET", "/api/stats");
const st28 = await call("GET", "/api/stats?election=presidential-2028");
assert.equal(st26.data.electionId, "midterm-2026");
assert.equal(st28.data.electionId, "presidential-2028");
assert.ok(st26.data.total >= 1 && st28.data.total >= 1);
assert.equal(st26.data.showBar, false, "50k privacy threshold still hides the breakdown");
assert.equal(st26.data.redPercent, 0);

// Bad input.
assert.equal((await call("GET", "/api/stats?election=nope")).status, 400);
assert.equal((await call("POST", "/api/intent", { intent: "red", state: "CA", electionId: "inauguration-2029" })).status, 400);
assert.equal((await call("POST", "/api/intent", { intent: "red", state: "CA" }, { origin: "https://evil.example" })).status, 403, "CSRF check still applies");

// Admin.
const adm = await call("GET", "/api/admin/analytics", null, { "x-admin-secret": adminSecret });
assert.equal(adm.status, 200, JSON.stringify(adm.data));
const ids = adm.data.totalsByElection.map((r) => r.electionId).sort();
assert.deepEqual(ids, ["midterm-2026", "presidential-2028"]);
const csv = await call("GET", "/api/admin/export/votes.csv", null, { "x-admin-secret": adminSecret });
assert.ok(String(csv.data).split("\n")[0].includes("election_id"), "CSV has election_id column");
assert.equal((await call("GET", "/api/admin/analytics")).status, 401, "admin still needs the secret");

// Anonymous tracking still works with no session (user wants sign-in optional).
cookie = "";
const tr = await call("POST", "/api/track/flip", { from: "midterm-2026", to: "presidential-2028" });
assert.ok(tr.status < 300, `anonymous track: ${tr.status} ${JSON.stringify(tr.data)}`);
assert.equal((await call("GET", "/api/intent")).status, 401, "intent still requires sign-in");

console.log("API E2E PASSED: 2 elections kept separately, stats split, admin + CSV per election, anon tracking ok");
