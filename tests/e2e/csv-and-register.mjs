// Duplicate registration + CSV formula injection, against a LOCAL `wrangler pages dev`.
// Usage: node csvreg-test.mjs <base> <admin-secret> [--expect-fixed | --expect-broken]
import assert from "node:assert/strict";
const [base, secret, mode = "--expect-fixed"] = process.argv.slice(2);
assert.ok(!/pages\.dev/.test(base), "local only");

const email = `dup-${Date.now()}@example.com`;
const reg = (ip) => fetch(base + "/api/auth/register", {
  method: "POST", headers: { "content-type": "application/json", origin: base, "cf-connecting-ip": ip },
  body: JSON.stringify({ email, password: "correct-horse-1" })
});
const first = await reg("198.51.100.1");
const cookie = first.headers.get("set-cookie").split(";")[0];
const dup = await reg("198.51.100.2");
const dupBody = await dup.json();

// Hostile values a member of the public can type.
const payloads = { city: "=HYPERLINK(\"http://evil.example\",\"x\")", customCandidate: "+cmd|' /C calc'!A0" };
const save = await fetch(base + "/api/intent", {
  method: "POST", headers: { "content-type": "application/json", origin: base, cookie },
  body: JSON.stringify({ intent: "blue", state: "CA", ...payloads })
});
assert.equal(save.status, 200);
const csv = await (await fetch(base + "/api/admin/export/votes.csv", { headers: { "x-admin-secret": secret } })).text();
const row = csv.split("\n").find((line) => line.includes(email));
const cellStartsFormula = /(^|,)"?[=+\-@]/.test(row.split(email)[1]);

const result = { firstRegister: first.status, duplicateStatus: dup.status, duplicateSetsCookie: !!dup.headers.get("set-cookie"), duplicateHasUserId: !!dupBody.id, csvRow: row, cellStartsFormula };
console.log(JSON.stringify(result));
if (mode === "--expect-fixed") {
  assert.equal(result.duplicateStatus, 409);
  assert.equal(result.duplicateSetsCookie, false);
  assert.equal(cellStartsFormula, false, "no CSV cell starts with = + - @");
  assert.ok(row.includes("'=HYPERLINK"), "value kept, just neutralised");
  console.log("CSV + REGISTER TEST PASSED");
} else {
  assert.equal(result.duplicateStatus, 200, "control: old build returns 200 for a duplicate");
  assert.equal(cellStartsFormula, true, "control: old build exports a live formula");
  console.log("CONTROL: old build has both bugs");
}
