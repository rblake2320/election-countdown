// Counts /api requests a single visitor makes in 15 s, logged out and logged in.
// Usage: node flood-probe.mjs http://localhost:8797
import { chromium } from "playwright";
import assert from "node:assert/strict";

const base = process.argv[2];
if (/pages\.dev/.test(base)) throw new Error("local only");
const browser = await chromium.launch();

async function run(label, setup) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  if (setup) await setup(ctx);
  const counts = {};
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/api/") && !u.pathname.startsWith("/api/track")) {
      const k = r.method() + " " + u.pathname;
      counts[k] = (counts[k] || 0) + 1;
    }
  });
  await page.goto(base + "/", { waitUntil: "load" });
  await page.waitForTimeout(15000);
  // Signed-in chrome rendered by React (the old inline "Voter Actions" panel is gone).
  const panels = await page.locator("[data-testid=button-personalize]").count();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`${label}: ${total} API requests in 15s ${JSON.stringify(counts)} | voter-actions panels: ${panels}`);
  await ctx.close();
  return { total, panels };
}

const anon = await run("logged-out");
const authed = await run("logged-in", async (ctx) => {
  const res = await ctx.request.post(base + "/api/auth/register", {
    headers: { origin: base },
    data: { email: `probe-${Date.now()}@example.com`, password: "correct-horse-1" }
  });
  if (!res.ok()) throw new Error("register failed " + res.status());
});
await browser.close();
console.log(JSON.stringify({ anonTotal: anon.total, authedTotal: authed.total, authedPanels: authed.panels }));
// Before the fix a logged-out visitor made ~68 requests in 15 s; the React app itself needs ~4.
assert.ok(anon.total <= 10, `logged-out visitor made ${anon.total} API requests in 15 s`);
assert.equal(authed.panels, 1, "signed-in visitor sees the signed-in header once");
console.log("REQUEST FLOOD TEST PASSED");
