// Exercises the API abuse limits against a LOCAL `wrangler pages dev`.
// Usage: node ratelimit-test.mjs <base> [--expect-limits | --expect-none]
import assert from "node:assert/strict";
const [base, mode = "--expect-limits"] = process.argv.slice(2);
assert.ok(!/pages\.dev/.test(base), "local only");
const expectLimits = mode === "--expect-limits";
const run = Date.now();

async function post(path, body, headers = {}) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base, ...headers },
    body: JSON.stringify(body)
  });
  return res;
}
const statuses = (arr) => arr.map((r) => r.status);
const out = {};

// Register: 5 per hour per IP.
const regs = [];
for (let i = 0; i < 6; i++) regs.push(await post("/api/auth/register", { email: `rl-${run}-${i}@example.com`, password: "correct-horse-1" }, { "cf-connecting-ip": "203.0.113.10" }));
out.register = statuses(regs);
// Load-test headers are inert unless LOAD_TEST_SECRET is configured (staging only).
out.registerWithFakeLoadHeaders = (await post("/api/auth/register", { email: `rl-${run}-lt@example.com`, password: "correct-horse-1" },
  { "cf-connecting-ip": "203.0.113.10", "x-load-test-secret": "x".repeat(40), "x-load-test-client": "vu-1" })).status;
const otherIp = await post("/api/auth/register", { email: `rl-${run}-other@example.com`, password: "correct-horse-1" }, { "cf-connecting-ip": "203.0.113.99" });
out.registerOtherIp = otherIp.status;

// Intent: 30 per hour per user.
const cookie = regs[0].headers.get("set-cookie").split(";")[0];
const intents = [];
for (let i = 0; i < 31; i++) intents.push((await post("/api/intent", { intent: i % 2 ? "red" : "blue", state: "CA" }, { cookie })).status);
out.intentFirst30AllOk = intents.slice(0, 30).every((s) => s === 200);
out.intent31st = intents[30];

// Login: 20 per 15 min per IP (wrong passwords count too).
const logins = [];
for (let i = 0; i < 21; i++) logins.push((await post("/api/login", { email: `rl-${run}-0@example.com`, password: "wrong-password" }, { "cf-connecting-ip": "203.0.113.20" })).status);
out.loginFirst20 = [...new Set(logins.slice(0, 20))];
out.login21st = logins[20];

// Track: 300 per 10 min per IP.
const tracks = [];
for (let i = 0; i < 301; i++) tracks.push((await post("/api/track/flip", { i }, { "cf-connecting-ip": "203.0.113.30" })).status);
out.trackFirst300AllOk = tracks.slice(0, 300).every((s) => s === 200);
out.track301st = tracks[300];

console.log(JSON.stringify(out));
if (expectLimits) {
  assert.deepEqual(out.register, [200, 200, 200, 200, 200, 429], "6th register from one IP is limited");
  assert.equal(out.registerWithFakeLoadHeaders, 429, "load-test headers cannot bypass limits without the staging secret");
  assert.equal(regs[5].headers.get("retry-after") > 0, true, "Retry-After set");
  assert.equal(out.registerOtherIp, 200, "a different IP is not affected");
  assert.equal(out.intentFirst30AllOk, true);
  assert.equal(out.intent31st, 429);
  assert.deepEqual(out.loginFirst20, [401]);
  assert.equal(out.login21st, 429);
  assert.equal(out.trackFirst300AllOk, true);
  assert.equal(out.track301st, 429);
  console.log("RATE LIMIT TEST PASSED");
} else {
  assert.ok(!Object.values(out).flat().includes(429), "control: no 429 anywhere");
  console.log("CONTROL: no limits on this build");
}
