// API hardening: caching headers, reserved event types, batch cap, field validation,
// login timing parity, server-written login events, admin secret check, EC-ID format.
// Usage: node api-hardening.mjs <base> <admin-secret> [--expect-fixed | --expect-broken]
import assert from "node:assert/strict";
const [base, secret, mode = "--expect-fixed"] = process.argv.slice(2);
if (/pages\.dev/.test(base)) throw new Error("local only");
const ip = "198.18.0." + (Date.now() % 250);
let cookie = "";
async function call(method, path, body, headers = {}) {
  const res = await fetch(base + path, {
    method, headers: { "content-type": "application/json", origin: base, "cf-connecting-ip": ip, cookie, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, headers: res.headers, data };
}
const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
async function timeLogin(email, password) {
  const t = performance.now();
  await call("POST", "/api/login", { email, password }, { "cf-connecting-ip": "198.18.1." + Math.floor(Math.random() * 250) });
  return performance.now() - t;
}

const out = {};
const email = `harden-${Date.now()}@example.com`;
out.registerObjectPassword = (await call("POST", "/api/auth/register", { email, password: { a: 1 } })).status;
const reg = await call("POST", "/api/auth/register", { email, password: "correct-horse-1" });
out.ecId = reg.data?.ecId;

const stats = await call("GET", "/api/stats");
out.statsCache = stats.headers.get("cache-control");
out.userCache = (await call("GET", "/api/auth/user")).headers.get("cache-control");

out.badAge = (await call("POST", "/api/intent", { intent: "blue", state: "CA", ageRange: "junk-segment" })).status;
out.badSex = (await call("POST", "/api/intent", { intent: "blue", state: "CA", sex: "x".repeat(20) })).status;
out.goodIntent = (await call("POST", "/api/intent", { intent: "blue", state: "CA", ageRange: "25-34", sex: "female" })).status;

out.reservedSingle = (await call("POST", "/api/track/login", { fake: true })).status;
const batch = Array.from({ length: 40 }, (_, i) => ({ type: i < 5 ? "login" : "flip", payload: { i } }));
out.batchStored = (await call("POST", "/api/track/batch", { events: batch })).data?.stored;

const before = (await call("GET", "/api/admin/analytics", undefined, { "x-admin-secret": secret })).data?.sessionStats?.totalLogins ?? 0;
cookie = "";
await call("POST", "/api/login", { email, password: "correct-horse-1" });
const after = (await call("GET", "/api/admin/analytics", undefined, { "x-admin-secret": secret })).data?.sessionStats?.totalLogins ?? 0;
out.loginEventsAdded = after - before;
out.adminWrongSecret = (await call("GET", "/api/admin/analytics", undefined, { "x-admin-secret": secret.slice(0, -1) + "x" })).status;

const unknown = [], wrong = [];
for (let i = 0; i < 5; i++) {
  unknown.push(await timeLogin(`nobody-${Date.now()}-${i}@example.com`, "whatever-123"));
  wrong.push(await timeLogin(email, "wrong-password-1"));
}
out.loginTimingRatio = Number((median(unknown) / median(wrong)).toFixed(2));

console.log(JSON.stringify(out));
if (mode === "--expect-fixed") {
  assert.equal(out.registerObjectPassword, 400, "non-string password rejected");
  assert.match(out.ecId, /^EC-[A-Z2-9]{8}$/);
  assert.match(out.statsCache || "", /max-age=30/);
  assert.equal(out.userCache, "no-store");
  assert.equal(out.badAge, 400); assert.equal(out.badSex, 400); assert.equal(out.goodIntent, 200);
  assert.equal(out.reservedSingle, 400, "clients cannot send login events");
  assert.equal(out.batchStored, 20, "batch capped at 25, 5 reserved dropped");
  assert.equal(out.loginEventsAdded, 1, "server records one login event per sign-in");
  assert.equal(out.adminWrongSecret, 401);
  assert.ok(out.loginTimingRatio > 0.5 && out.loginTimingRatio < 2, "unknown-email login takes about as long as a wrong password");
  console.log("API HARDENING TEST PASSED");
} else {
  assert.ok(out.reservedSingle === 200 || out.batchStored === 40 || out.loginTimingRatio < 0.5, "control: old code lacks hardening");
  console.log("CONTROL: old code lacks hardening");
}
