// Anonymous (signed-out) votes are stored and reported apart from account votes.
// Usage: node anonymous-votes.mjs <base> [--expect-fixed | --expect-broken]
import { chromium } from "playwright";
import assert from "node:assert/strict";
const [base, mode = "--expect-fixed"] = process.argv.slice(2);
if (/pages\.dev/.test(base)) throw new Error("local only");
const run = Date.now().toString(36);
const ip = "198.19.0." + (Date.now() % 250);

async function call(method, path, body, headers = {}) {
  const res = await fetch(base + path, {
    method, headers: { "content-type": "application/json", origin: base, "cf-connecting-ip": ip, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data, cookie: (res.headers.get("set-cookie") || "").split(";")[0] };
}
const stats = async (e = "midterm-2026") => (await call("GET", `/api/stats?election=${e}`)).data;

const out = {};
const v1 = `v_${run}aaaa1`, v2 = `v_${run}bbbb2`;
out.noVisitor = (await call("POST", "/api/intent/anonymous", { intent: "red", state: "TX" })).status;
const s0 = await stats();
out.save1 = (await call("POST", "/api/intent/anonymous", { visitorId: v1, intent: "red", state: "TX" })).status;

if (mode === "--expect-broken") {
  console.log(JSON.stringify(out));
  assert.notEqual(out.save1, 200, "control: old code has no anonymous vote endpoint");
  console.log("CONTROL: no anonymous voting on this build");
  process.exit(0);
}

await call("POST", "/api/intent/anonymous", { visitorId: v1, intent: "blue", state: "TX" }); // update, not a 2nd vote
await call("POST", "/api/intent/anonymous", { visitorId: v1, intent: "red", state: "TX", electionId: "presidential-2028" });
await call("POST", "/api/intent/anonymous", { visitorId: v2, intent: "undecided", state: "OH" });
const s1 = await stats();
out.anonAdded = s1.anonymous.total - s0.anonymous.total;
out.accountTotalUnchanged = s1.total === s0.total;
out.anonFlaggedUnverified = s1.anonymous.verified === false;
out.saved = (await call("GET", `/api/intent/anonymous?visitorId=${v1}`)).data?.intent;

const reg = await call("POST", "/api/auth/register", { email: `anon-${run}@example.com`, password: "correct-horse-1" }, { "cf-connecting-ip": "198.19.1.1" });
out.signedInRejected = (await call("POST", "/api/intent/anonymous", { visitorId: `v_${run}cccc3`, intent: "red", state: "TX" }, { cookie: reg.cookie })).status;

const burst = [];
for (let i = 0; i < 12; i++) burst.push((await call("POST", "/api/intent/anonymous", { visitorId: `v_${run}burst${i}x`, intent: "red", state: "TX" }, { "cf-connecting-ip": "198.19.2.2" })).status);
out.burst = burst;

out.deleted = (await call("DELETE", "/api/intent/anonymous", { visitorId: v1 })).data?.deleted;
out.afterDelete = (await call("GET", `/api/intent/anonymous?visitorId=${v1}`)).data;

// UI: a signed-out visitor votes and sees the separate unverified tally.
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
await p.goto(base + "/", { waitUntil: "load" });
await p.waitForTimeout(1500);
const tallyBefore = await p.locator("[data-testid=anonymous-tally]").innerText().catch(() => "");
await p.getByRole("button", { name: /Share Your Vote Plan/i }).click();
const dialog = p.getByRole("dialog");
await dialog.waitFor();
out.uiNoteShown = await p.locator("[data-testid=anonymous-vote-note]").count();
await p.locator("[data-testid=button-intent-independent]").click();
await dialog.locator("button[role=combobox]").first().click();
await p.getByRole("option", { name: /^(WA|Washington)$/ }).first().click();
await dialog.getByRole("button", { name: /save|submit|share/i }).last().click();
await p.waitForTimeout(1500);
await p.keyboard.press("Escape");
await p.reload({ waitUntil: "load" });
await p.waitForTimeout(2000);
out.uiTally = await p.locator("[data-testid=anonymous-tally]").innerText().catch(() => "");
out.uiVerified = await p.locator("[data-testid=verified-total]").innerText().catch(() => "");
out.uiFormHiddenAfterVote = (await p.getByRole("button", { name: /Share Your Vote Plan/i }).count()) === 0;
// Deletion without an account: "Remove my answers" deletes this browser's plans.
await p.locator("[data-testid=button-remove-anonymous]").click();
await p.getByRole("button", { name: /Share Your Vote Plan/i }).waitFor({ timeout: 5000 });
const browserVisitor = await p.evaluate(() => localStorage.getItem("ec_visitor_id"));
out.uiRemovedOnServer = (await call("GET", `/api/intent/anonymous?visitorId=${browserVisitor}`)).data === null;
await b.close();

console.log(JSON.stringify(out));
assert.equal(out.noVisitor, 400);
assert.equal(out.save1, 200);
assert.equal(out.anonAdded, 2, "v1 updated in place (1) + v2 (1); v1's 2028 answer counts under 2028");
assert.equal(out.accountTotalUnchanged, true, "anonymous votes never enter the account totals");
assert.equal(out.anonFlaggedUnverified, true);
assert.equal(out.saved, "blue");
assert.equal(out.signedInRejected, 409);
assert.deepEqual(out.burst.slice(0, 10), Array(10).fill(200)); assert.equal(out.burst[10], 429);
assert.equal(out.deleted, 2, "both of v1's answers deleted");
assert.equal(out.afterDelete, null);
assert.equal(out.uiNoteShown, 1, "dialog explains the unverified tally");
assert.match(out.uiTally, /unverified/i);
assert.notEqual(out.uiTally, tallyBefore, "tally changed after the vote");
assert.match(out.uiVerified, /verified participant/);
assert.equal(out.uiFormHiddenAfterVote, true);
assert.equal(out.uiRemovedOnServer, true, "Remove my answers deletes the server record");
console.log("ANONYMOUS VOTES TEST PASSED");
