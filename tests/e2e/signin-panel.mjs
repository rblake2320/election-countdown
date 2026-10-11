// Logged-out visitor signs in on the page (through window.fetch, like the React dialog):
// the Voter Actions panel must appear afterwards.
import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(base + "/", { waitUntil: "load" }); await p.waitForTimeout(3000);
const before = await p.locator("[data-launch-home-actions]").count();
const status = await p.evaluate(async () => (await window.fetch("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ email: "r" + Date.now() + "@example.com", password: "correct-horse-1" }) })).status);
await p.waitForTimeout(4000);
const after = await p.locator("[data-launch-home-actions]").count();
console.log(JSON.stringify({ register: status, panelBefore: before, panelAfter: after }));
await b.close();
assert.equal(status, 200); assert.equal(before, 0); assert.equal(after, 1, "panel appears after signing in on the page");
console.log("SIGN-IN PANEL TEST PASSED");
