// Appearance perks: only verified accounts may save a theme / number style; the saved look is
// applied on load; unverified users see the dialog locked.
// Setup note: a verified account normally comes from a completed Google/GitHub login, which needs
// real OAuth apps. The test registers a normal account and sets email_verified=1 in the LOCAL test
// D1 (the state a completed provider login leaves); everything after that is the real API and UI.
// Usage: node themes.mjs <base> <persist-dir> [--expect-fixed | --expect-broken]
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import assert from "node:assert/strict";
const [base, persistDir, mode = "--expect-fixed"] = process.argv.slice(2);
if (/pages\.dev/.test(base)) throw new Error("local only");
const run = Date.now().toString(36);

async function call(method, path, body, cookie) {
  const res = await fetch(base + path, {
    method, headers: { "content-type": "application/json", origin: base, "cf-connecting-ip": "198.22.0." + (run.length % 250), ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data, cookie: (res.headers.get("set-cookie") || "").split(";")[0] };
}
const register = async (tag) => (await call("POST", "/api/auth/register", { email: `${tag}-${run}@example.com`, password: "correct-horse-1" })).cookie;

const plain = await register("plain");
const out = {};
out.unverifiedSave = (await call("PUT", "/api/account/preferences", { theme: "crimson-gold", numbers: "3d" }, plain)).status;
if (mode === "--expect-broken") {
  console.log(JSON.stringify(out));
  assert.equal(out.unverifiedSave, 404, "control: no preferences endpoint on this build");
  console.log("CONTROL: no themes on this build");
  process.exit(0);
}

const verified = await register("verified");
// One quoted command string: on Windows a shell would otherwise split the SQL at spaces.
execSync(`npx wrangler d1 execute election-countdown --local --persist-to "${persistDir}" --command "UPDATE users SET email_verified = 1, verified_at = '${new Date().toISOString()}' WHERE email = 'verified-${run}@example.com'"`,
  { stdio: "ignore" });
await call("POST", "/api/intent", { intent: "independent", state: "OR" }, verified);

out.badTheme = (await call("PUT", "/api/account/preferences", { theme: "rainbow", numbers: "3d" }, verified)).status;
out.save = await call("PUT", "/api/account/preferences", { theme: "crimson-gold", numbers: "3d" }, verified);
out.userPrefs = (await call("GET", "/api/auth/user", undefined, verified)).data?.preferences;
out.plainPrefs = (await call("GET", "/api/auth/user", undefined, plain)).data?.preferences;

const b = await chromium.launch();
async function pageFor(cookie) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  if (cookie) {
    const [name, value] = cookie.split("=");
    await ctx.addCookies([{ name, value, url: base }]);
  }
  const p = await ctx.newPage();
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForTimeout(2000);
  return p;
}
const html = (p) => p.evaluate(() => ({ theme: document.documentElement.dataset.theme || null, numbers: document.documentElement.dataset.numbers || null }));

const vp = await pageFor(verified);
out.verifiedLoad = await html(vp);
out.box3d = await vp.locator(".countdown-number-box").first().evaluate((el) => getComputedStyle(el).transform !== "none");
out.primaryVar = await vp.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim());
await vp.locator("[data-testid=button-personalize]").click();
await vp.locator("[data-testid=theme-party]").click();
out.partyPreview = await html(vp);
await vp.locator("[data-testid=numbers-flat]").click();
await vp.locator("[data-testid=button-save-preferences]").click();
await vp.waitForTimeout(1500);
await vp.reload({ waitUntil: "load" });
await vp.waitForTimeout(2000);
out.afterSaveReload = await html(vp);
await vp.screenshot({ path: "tests/e2e/.themes-verified.png" }).catch(() => {});

const pp = await pageFor(plain);
out.plainLoad = await html(pp);
await pp.locator("[data-testid=button-personalize]").click();
out.plainLocked = await pp.locator("[data-testid=personalize-locked]").count();
out.plainSaveDisabled = await pp.locator("[data-testid=button-save-preferences]").isDisabled();
const anon = await pageFor(null);
out.anonButton = await anon.locator("[data-testid=button-personalize]").count();
await b.close();

console.log(JSON.stringify(out));
assert.equal(out.unverifiedSave, 403, "unverified accounts cannot save themes");
assert.equal(out.badTheme, 400);
assert.equal(out.save.status, 200);
assert.deepEqual(out.userPrefs, { theme: "crimson-gold", numbers: "3d" });
assert.deepEqual(out.plainPrefs, { theme: "classic", numbers: "flat" });
assert.deepEqual(out.verifiedLoad, { theme: "crimson-gold", numbers: "3d" }, "saved look applied on load");
assert.equal(out.box3d, true, "3D numbers transform the boxes");
assert.equal(out.primaryVar, "350 76% 36%", "theme variables take effect");
assert.deepEqual(out.partyPreview, { theme: "party-independent", numbers: "3d" }, "party theme follows the voter's intent");
assert.deepEqual(out.afterSaveReload, { theme: "party-independent", numbers: null }, "dialog save persists across reload");
assert.deepEqual(out.plainLoad, { theme: null, numbers: null });
assert.equal(out.plainLocked, 1); assert.equal(out.plainSaveDisabled, true);
assert.equal(out.anonButton, 0, "signed-out visitors don't see Personalize");
console.log("THEMES TEST PASSED");
