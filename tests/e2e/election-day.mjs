// Election-day behaviour at fixed instants (fake browser clock), against a LOCAL build.
// Usage: node eday-test.mjs <base> [--expect-fixed | --expect-broken]
import { chromium } from "playwright";
import assert from "node:assert/strict";
const [base, mode = "--expect-fixed"] = process.argv.slice(2);
if (/pages\.dev/.test(base)) throw new Error("local only");
const browser = await chromium.launch();

async function at(isoUtc, { timezoneId = "America/New_York", advanceMs = 0 } = {}) {
  const ctx = await browser.newContext({ timezoneId, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(isoUtc) });
  await page.goto(base + "/", { waitUntil: "load" });
  await page.clock.runFor(1500);
  if (advanceMs) await page.clock.runFor(advanceMs);
  await page.waitForTimeout(800);
  const text = await page.locator("[data-testid='dual-countdown']").innerText();
  const dots = await page.locator("[data-testid^='dot-election-']").count();
  const today = await page.locator("[data-testid='election-today']").count();
  const pollingLink = await page.locator("a[href='https://vote.gov/']", { hasText: /polling place/i }).count();
  await ctx.close();
  return { text: text.replace(/\s+/g, " ").slice(0, 140), dots, today, pollingLink };
}

const r = {};
r.nov2_noon = await at("2026-11-02T17:00:00Z");                 // Nov 2, 12:00 ET
r.nov3_0000 = await at("2026-11-03T05:00:30Z");                 // Nov 3, 00:00:30 ET
r.nov3_1500 = await at("2026-11-03T20:00:00Z");                 // Nov 3, 15:00 ET
r.nov3_LA   = await at("2026-11-03T05:00:30Z", { timezoneId: "America/Los_Angeles" }); // 9:00 PM Nov 2 in LA
r.nov4_0100 = await at("2026-11-04T06:00:30Z");                 // Nov 4, 01:00:30 ET
// Page left open across 1:00 AM ET is checked in real time by eday-realtime.mjs (fake timers stall framer exit animations).
for (const [k, v] of Object.entries(r)) console.log(k.padEnd(10), JSON.stringify(v));

if (mode === "--expect-fixed") {
  assert.match(r.nov2_noon.text, /2026 Midterm Elections/i); assert.equal(r.nov2_noon.today, 0); assert.equal(r.nov2_noon.dots, 3);
  for (const k of ["nov3_0000", "nov3_1500", "nov3_LA"]) {
    assert.equal(r[k].today, 1, `${k}: election-day panel`);
    assert.match(r[k].text, /Today is Election Day/i);
    assert.match(r[k].text, /2026 Midterm Elections/i);
    assert.doesNotMatch(r[k].text, /countdown has finished/i);
    assert.equal(r[k].pollingLink, 1);
  }
  for (const k of ["nov4_0100"]) {
    assert.match(r[k].text, /2028 Presidential Election/i, `${k}: advanced to 2028`);
    assert.equal(r[k].today, 0); assert.equal(r[k].dots, 2, `${k}: midterm dropped`);
  }
  console.log("ELECTION DAY TEST PASSED");
} else {
  assert.match(r.nov3_1500.text, /countdown has finished/i, "control: old build says finished on election day");
  console.log("CONTROL: old build shows 'countdown has finished' on Election Day");
}
await browser.close();
