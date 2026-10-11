// The React app with no inline launch scripts: strict CSP, no sideways scroll, one tracking
// pipeline (one page_view per load), dialogs behave, profile page incl. account deletion.
// Usage: node app-shell.mjs <base> <admin-secret> [--expect-fixed | --expect-broken]
import { chromium } from "playwright";
import assert from "node:assert/strict";
const [base, secret, mode = "--expect-fixed"] = process.argv.slice(2);
if (/pages\.dev/.test(base)) throw new Error("local only");
const run = Date.now().toString(36);
const out = {};

const page0 = await fetch(base + "/");
const html = await page0.text();
const csp = page0.headers.get("content-security-policy") || "";
out.inlineScripts = (html.match(/<script\b[^>]*>/g) || []).filter((t) => !/\bsrc=/.test(t)).length;
out.cspScriptSrc = (csp.match(/script-src[^;]*/) || [""])[0];
if (mode === "--expect-broken") {
  console.log(JSON.stringify(out));
  assert.ok(out.inlineScripts > 0 || /unsafe-inline/.test(out.cspScriptSrc), "control: old page relies on inline scripts");
  console.log("CONTROL: old page has inline scripts / unsafe-inline");
  process.exit(0);
}

const b = await chromium.launch();
const errors = [];
async function newPage(viewport = { width: 1280, height: 1000 }, cookie) {
  const ctx = await b.newContext({ viewport });
  if (cookie) { const [name, value] = cookie.split("="); await ctx.addCookies([{ name, value, url: base }]); }
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && /Content Security Policy|Refused to/i.test(m.text())) errors.push(m.text()); });
  return p;
}
const admin = async (path) => (await fetch(base + path, { headers: { "x-admin-secret": secret } })).json();

// 1. Phone width: no sideways scroll, app replaces the prerender.
const phone = await newPage({ width: 390, height: 844 });
await phone.goto(base + "/", { waitUntil: "load" });
await phone.waitForTimeout(1500);
out.phoneOverflowPx = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
out.prerenderGone = (await phone.locator(".launch-prerender").count()) === 0 && (await phone.locator("[data-testid=dual-countdown]").count()) === 1;
const visitorId = await phone.evaluate(() => localStorage.getItem("ec_visitor_id"));
// One flip by keyboard, one click, then leave the page so the queue flushes via sendBeacon.
await phone.locator("body").click({ position: { x: 5, y: 400 } });
await phone.keyboard.press("ArrowDown");
await phone.waitForTimeout(800);
await phone.goto("about:blank");
await new Promise((r) => setTimeout(r, 1500));
const events = (await admin(`/api/admin/export/events.json?from=${new Date(Date.now() - 10 * 60000).toISOString()}`)).rows
  .map((e) => ({ type: e.event_type, p: JSON.parse(e.payload_json) }))
  .filter((e) => e.p.visitorId === visitorId);
out.pageViews = events.filter((e) => e.type === "page_view").length;
const flip = events.find((e) => e.type === "flip");
out.flipRecorded = !!flip && flip.p.fromYear === "midterm-2026" && flip.p.toYear === "presidential-2028" && flip.p.durationMs > 0 && flip.p.reason === "flip";
out.countdownView = events.filter((e) => e.type === "countdown_view").length;
out.ctaClicks = events.filter((e) => e.type === "cta_click").length >= 0;
out.pageExit = events.some((e) => e.type === "page_exit");
out.commonFields = events.every((e) => e.p.sessionId && e.p.timezone !== undefined && e.p.viewport);

// 2. Signed-out home: vote-form hint, Escape inside an open dropdown keeps the dialog open,
//    "already registered" can be undone.
const home = await newPage();
await home.goto(base + "/", { waitUntil: "load" });
await home.waitForTimeout(1200);
await home.getByRole("button", { name: /Share Your Vote Plan/i }).click();
await home.getByRole("dialog").waitFor();
out.voteHint = await home.locator("[data-testid=vote-form-hint]").count();
await home.getByRole("dialog").locator("button[role=combobox]").first().click();
await home.getByRole("listbox").waitFor();
await home.keyboard.press("Escape");
await home.waitForTimeout(400);
out.escapeClosedListboxOnly = (await home.getByRole("listbox").count()) === 0 && (await home.getByRole("dialog").count()) === 1;
await home.keyboard.press("Escape");
await home.waitForTimeout(400);
await home.getByRole("button", { name: /I.m already registered/i }).click();
await home.locator("[data-testid=registered-status]").waitFor({ timeout: 5000 });
await home.locator("[data-testid=button-undo-registered]").click();
out.undoRestoresCta = (await home.getByRole("button", { name: /I.m already registered/i }).count()) === 1;

// 3. Signed-in: verify-email menu, profile page, delete account.
const email = `shell-${run}@example.com`;
const reg = await fetch(base + "/api/auth/register", {
  method: "POST", headers: { "content-type": "application/json", origin: base, "cf-connecting-ip": "198.23.0.1" },
  body: JSON.stringify({ email, password: "correct-horse-1", firstName: "Shell" })
});
const cookie = (reg.headers.get("set-cookie") || "").split(";")[0];
await fetch(base + "/api/intent", { method: "POST", headers: { "content-type": "application/json", origin: base, cookie }, body: JSON.stringify({ intent: "blue", state: "MI" }) });
await fetch(base + "/api/intent", { method: "POST", headers: { "content-type": "application/json", origin: base, cookie }, body: JSON.stringify({ intent: "independent", state: "MI" }) });
const me = await newPage(undefined, cookie);
await me.goto(base + "/", { waitUntil: "load" });
await me.waitForTimeout(1500);
out.yourPlan = (await me.locator("[data-testid=your-plan]").innerText()).replace(/\s+/g, " ");
await me.locator("header button[aria-haspopup=menu]").last().click();
out.verifyMenu = await me.locator("[data-testid=menu-verify-email]").count();
await me.keyboard.press("Escape");
await me.goto(base + "/#/profile", { waitUntil: "load" });
await me.locator("[data-testid=card-account-details]").waitFor();
out.profileEmail = (await me.locator("[data-testid=card-account-details]").innerText()).includes(email);
out.planCards = await me.locator("[data-testid^=card-plan-]").count();
await me.locator("[data-testid=card-history] li").first().waitFor({ timeout: 10000 }); // account data loaded
out.historyText = (await me.locator("[data-testid=card-history]").innerText()).replace(/\s+/g, " ");
await me.locator("[data-testid=button-delete-account]").click();
await me.locator("[data-testid=button-confirm-delete]").click();
await me.waitForURL((u) => !u.hash.includes("profile"), { timeout: 10000 });
out.afterDeleteUser = await (await fetch(base + "/api/auth/user", { headers: { cookie } })).json();
out.loginAfterDelete = (await fetch(base + "/api/login", { method: "POST", headers: { "content-type": "application/json", origin: base, "cf-connecting-ip": "198.23.0.2" }, body: JSON.stringify({ email, password: "correct-horse-1" }) })).status;
await b.close();
out.pageErrors = errors;

console.log(JSON.stringify(out));
assert.equal(out.inlineScripts, 0, "no inline scripts in the page");
assert.ok(!/unsafe-inline/.test(out.cspScriptSrc) && /script-src 'self'/.test(out.cspScriptSrc), "strict script-src served");
assert.ok(out.phoneOverflowPx <= 0, `no sideways scroll at 390px (overflow ${out.phoneOverflowPx}px)`);
assert.equal(out.prerenderGone, true);
assert.equal(out.pageViews, 1, "exactly one page_view per load");
assert.equal(out.countdownView, 1);
assert.equal(out.flipRecorded, true, "flip recorded with from/to, dwell time and reason");
assert.equal(out.pageExit, true, "page_exit delivered on leave");
assert.equal(out.commonFields, true);
assert.equal(out.voteHint, 1);
assert.equal(out.escapeClosedListboxOnly, true, "Escape closes the dropdown, not the dialog");
assert.equal(out.undoRestoresCta, true);
assert.match(out.yourPlan, /Your plan for the 2026 Midterm Elections: Independent · MI/);
assert.equal(out.verifyMenu, 1, "unverified account is offered email verification");
assert.equal(out.profileEmail, true);
assert.equal(out.planCards, 2, "one plan card per election");
assert.match(out.historyText, /Changed from Democrat \(MI\) to Independent \(MI\)/);
assert.equal(out.afterDeleteUser, null, "session gone after deletion");
assert.equal(out.loginAfterDelete, 401, "deleted account cannot sign in");
assert.deepEqual(out.pageErrors, [], "no page errors or CSP violations");
console.log("APP SHELL TEST PASSED");
