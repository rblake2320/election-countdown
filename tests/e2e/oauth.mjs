// Google / GitHub sign-in flow against the REAL provider endpoints.
// The runner sets placeholder client ids, so the providers reject the code exchange: this proves
// the redirect, state/PKCE, cookie and every failure path. A successful login needs real OAuth
// apps (owner-created) and a human at the consent screen; that is not simulated here.
// Usage: node oauth.mjs <base> [--expect-fixed | --expect-broken]
import { chromium } from "playwright";
import assert from "node:assert/strict";
const [base, mode = "--expect-fixed"] = process.argv.slice(2);
if (/pages\.dev/.test(base)) throw new Error("local only");
const ip = "198.21.0." + (Date.now() % 250);
const get = (path, headers = {}) => fetch(base + path, { redirect: "manual", headers: { "cf-connecting-ip": ip, ...headers } });

const out = {};
const providersRes = await get("/api/auth/providers");
out.providersStatus = providersRes.status;
if (mode === "--expect-broken") {
  console.log(JSON.stringify(out));
  assert.equal(out.providersStatus, 404, "control: no social sign-in on this build");
  console.log("CONTROL: no social sign-in on this build");
  process.exit(0);
}
out.providers = await providersRes.json();

async function start(provider, returnTo) {
  const res = await get(`/api/auth/oauth/${provider}/start?returnTo=${encodeURIComponent(returnTo)}`);
  const location = new URL(res.headers.get("location"));
  const setCookie = res.headers.get("set-cookie") || "";
  return { status: res.status, location, setCookie, cookie: setCookie.split(";")[0] };
}
const google = await start("google", "/#/profile");
out.googleStatus = google.status;
out.googleHost = google.location.origin + google.location.pathname;
out.googleParams = Object.fromEntries(google.location.searchParams);
out.cookieFlags = /HttpOnly/i.test(google.setCookie) && /SameSite=Lax/i.test(google.setCookie) && /Path=\/api\/auth\/oauth/.test(google.setCookie);
const github = await start("github", "/");
out.githubHost = github.location.origin + github.location.pathname;
out.githubParams = Object.fromEntries(github.location.searchParams);

const callback = async (provider, query, cookie) => {
  const res = await get(`/api/auth/oauth/${provider}/callback?${query}`, cookie ? { cookie } : {});
  return { status: res.status, location: res.headers.get("location") || "", clears: /ec_oauth=;/.test(res.headers.get("set-cookie") || ""), session: /ec_session=/.test(res.headers.get("set-cookie") || "") };
};
out.wrongState = await callback("google", "code=abc&state=not-the-state", google.cookie);
out.noCookie = await callback("google", `code=abc&state=${out.googleParams.state}`);
out.cancelled = await callback("google", `error=access_denied&state=${out.googleParams.state}`, google.cookie);
out.realGoogleRejects = await callback("google", `code=fake-code&state=${out.googleParams.state}`, google.cookie);
out.realGithubRejects = await callback("github", `code=fake-code&state=${out.githubParams.state}`, github.cookie);
const evil = await start("google", "//evil.example/steal");
out.openRedirect = await callback("google", `error=access_denied&state=x`, evil.cookie);

// UI: buttons, and an error coming back from a provider reopens the dialog with the reason.
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(base + "/", { waitUntil: "load" });
await p.getByRole("button", { name: /sign in/i }).first().click();
await p.locator("[data-testid=social-signin]").waitFor();
out.uiGoogleHref = await p.locator("[data-testid=button-signin-google]").getAttribute("href");
out.uiGithubHref = await p.locator("[data-testid=button-signin-github]").getAttribute("href");
await p.goto(base + "/?signin_error=unverified_email#/", { waitUntil: "load" });
await p.waitForTimeout(1500);
out.uiErrorShown = /no verified email/i.test(await p.locator("body").innerText());
out.uiUrlCleaned = !p.url().includes("signin_error");
await b.close();

console.log(JSON.stringify(out, null, 0));
assert.deepEqual(out.providers, { google: true, github: true });
assert.equal(out.googleStatus, 302);
assert.equal(out.googleHost, "https://accounts.google.com/o/oauth2/v2/auth");
assert.equal(out.googleParams.redirect_uri, `${base}/api/auth/oauth/google/callback`);
assert.equal(out.googleParams.response_type, "code");
assert.equal(out.googleParams.scope, "openid email profile");
assert.equal(out.googleParams.code_challenge_method, "S256");
assert.match(out.googleParams.code_challenge, /^[A-Za-z0-9_-]{43}$/);
assert.ok(out.googleParams.state.length >= 30);
assert.equal(out.cookieFlags, true);
assert.equal(out.githubHost, "https://github.com/login/oauth/authorize");
assert.equal(out.githubParams.scope, "read:user user:email");
assert.equal(out.githubParams.code_challenge_method, "S256");
assert.equal(out.githubParams.redirect_uri, `${base}/api/auth/oauth/github/callback`);
for (const [k, code] of [["wrongState", "invalid_state"], ["noCookie", "invalid_state"], ["cancelled", "cancelled"], ["realGoogleRejects", "token_exchange_failed"], ["realGithubRejects", "token_exchange_failed"]]) {
  assert.equal(out[k].status, 302, k);
  assert.ok(out[k].location.includes(`signin_error=${code}`), `${k} -> ${code} (got ${out[k].location})`);
  assert.equal(out[k].session, false, `${k} must not sign anyone in`);
  assert.equal(out[k].clears, true, `${k} clears the oauth cookie`);
}
assert.ok(out.openRedirect.location.startsWith("/?"), "returnTo cannot leave the site");
assert.equal(out.uiGoogleHref, "/api/auth/oauth/google/start?returnTo=%2F");
assert.equal(out.uiGithubHref, "/api/auth/oauth/github/start?returnTo=%2F");
assert.equal(out.uiErrorShown, true); assert.equal(out.uiUrlCleaned, true);
console.log("OAUTH TEST PASSED");
