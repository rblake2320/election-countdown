// Old address and www redirect to electionclock.com; everything else passes through untouched.
// Uses the real values from wrangler.toml, and checks the running site still serves pages
// through the middleware.
// Usage: node canonical-redirect.mjs <base>
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canonicalRedirect } from "../../lib/canonical.js";

const base = process.argv[2];
if (/pages\.dev/.test(base)) throw new Error("local only");

const toml = readFileSync("wrangler.toml", "utf8");
const prodVars = toml.split(/^\[env\./m)[0];
const read = (name) => prodVars.match(new RegExp(`^${name}\\s*=\\s*"([^"]*)"`, "m"))?.[1];
const env = { CANONICAL_HOST: read("CANONICAL_HOST"), REDIRECT_HOSTS: read("REDIRECT_HOSTS") };
assert.equal(env.CANONICAL_HOST, "electionclock.com", "production canonical host");
const previewVars = toml.split(/^\[env\.preview\.vars\]/m)[1]?.split(/^\[/m)[0] || "";
assert.ok(!/CANONICAL_HOST|REDIRECT_HOSTS/.test(previewVars), "staging never redirects to production");

const go = (url, method = "GET", e = env) => canonicalRedirect(url, method, e);
// Redirects (would be null if the middleware were missing or misconfigured).
assert.equal(go("https://election-countdown-38g.pages.dev/"), "https://electionclock.com/");
assert.equal(go("https://election-countdown-38g.pages.dev/privacy?x=1"), "https://electionclock.com/privacy?x=1");
assert.equal(go("https://www.electionclock.com/terms", "HEAD"), "https://electionclock.com/terms");
// Pass-through (would be a URL if the redirect were too broad).
for (const url of [
  "https://electionclock.com/",
  "https://staging.election-countdown-38g.pages.dev/",
  "https://abc123.election-countdown-38g.pages.dev/",
  "http://localhost:8788/",
  "https://election-countdown-38g.pages.dev/api/health",
  "https://election-countdown-38g.pages.dev/api/auth/oauth/github/callback?code=x"
]) assert.equal(go(url), null, url);
assert.equal(go("https://election-countdown-38g.pages.dev/", "POST"), null, "non-GET passes");
assert.equal(go("https://election-countdown-38g.pages.dev/", "GET", {}), null, "no config, no redirect");

// The site still works with the middleware in front of every page.
for (const p of ["/", "/privacy", "/terms", "/api/health"]) {
  const r = await fetch(base + p, { redirect: "manual" });
  assert.equal(r.status, 200, `${p} served through middleware`);
}
const home = await fetch(base + "/");
assert.match(home.headers.get("content-security-policy") || "", /script-src 'self'/, "_headers still applied");
console.log("CANONICAL REDIRECT TEST PASSED");
