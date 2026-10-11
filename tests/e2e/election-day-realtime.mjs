// Shifts only Date to a target instant; timers + animation frames stay real.
import { chromium } from "playwright";
import assert from "node:assert/strict";
const [base, iso, waitMs] = process.argv.slice(2);
const b = await chromium.launch(); const p = await (await b.newContext({ timezoneId: "America/New_York" })).newPage();
await p.addInitScript((targetMs) => {
  const delta = targetMs - Date.now(); const RealDate = Date;
  class ShiftedDate extends RealDate { constructor(...a) { if (a.length === 0) super(RealDate.now() + delta); else super(...a); } static now() { return RealDate.now() + delta; } }
  globalThis.Date = ShiftedDate;
}, new Date(iso).getTime());
await p.goto(base + "/", { waitUntil: "load" });
const snap = async (l) => { const s = { h1s: await p.locator("[data-testid=dual-countdown] h1").allInnerTexts(), dots: await p.locator("[data-testid^=dot-election-]").count() }; console.log(l.padEnd(8), JSON.stringify(s)); return s; };
await p.waitForTimeout(2000); const start = await snap("start");
await p.waitForTimeout(Number(waitMs)); const after = await snap("after");
assert.match(start.h1s.join(" "), /Today is Election Day/i);
assert.match(after.h1s.join(" "), /2028 Presidential Election/i, "open page advances past Election Day");
assert.equal(after.dots, 2);
console.log("ELECTION DAY REALTIME TEST PASSED");
await b.close();
