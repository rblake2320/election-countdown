// The nightly Worker writes the day's rollup to D1 and gzipped NDJSON dumps to R2, with no emails.
// Runs against a local `wrangler dev --test-scheduled` that shares the site's --persist-to dir and
// has NIGHTLY_DAY_OFFSET=0 (process today, since test data is created today).
// Usage: node nightly-worker.mjs <site-base> <worker-base> <admin-secret> <persist-dir>
import { execFileSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import assert from "node:assert/strict";
const [site, worker, secret, persistDir] = process.argv.slice(2);
if (/pages\.dev|workers\.dev/.test(site + worker)) throw new Error("local only");
const run = Date.now().toString(36);
const day = new Date().toISOString().slice(0, 10);
const email = `nightly-${run}@example.com`;

const post = (path, body, headers = {}) => fetch(site + path, {
  method: "POST", headers: { "content-type": "application/json", origin: site, "cf-connecting-ip": "198.20.1.1", ...headers }, body: JSON.stringify(body)
});
const reg = await post("/api/auth/register", { email, password: "correct-horse-1" });
const cookie = (reg.headers.get("set-cookie") || "").split(";")[0];
await post("/api/intent", { intent: "blue", state: "NV" }, { cookie });
await post("/api/track/page_view", { run });

const trigger = await fetch(`${worker}/__scheduled?cron=15+6+*+*+*`);
assert.equal(trigger.status, 200, "scheduled handler ran");

function r2(key) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  return execFileSync(npx, ["wrangler", "r2", "object", "get", `election-countdown-exports/${key}`, "--local", "--persist-to", persistDir, "--pipe"],
    { cwd: "workers/nightly", stdio: ["ignore", "pipe", "ignore"], shell: process.platform === "win32" });
}
const manifest = JSON.parse(r2(`daily/${day}/manifest.json`).toString());
const events = gunzipSync(r2(`daily/${day}/events.ndjson.gz`)).toString().trim().split("\n").map((l) => JSON.parse(l));
const votesText = gunzipSync(r2(`daily/${day}/votes.ndjson.gz`)).toString();
const votes = votesText.trim().split("\n").map((l) => JSON.parse(l));

const rollups = await (await fetch(`${site}/api/admin/rollups?from=${day}&to=${day}&metric=new_votes`, { headers: { "x-admin-secret": secret } })).json();

const out = {
  manifestDay: manifest.day,
  eventsInDump: events.length,
  ourEventDumped: events.some((e) => JSON.parse(e.payload_json).run === run),
  votesInDump: votes.length,
  ourVoteDumped: votes.some((v) => v.state === "NV" && v.intent === "blue"),
  emailInVoteDump: votesText.includes("@"),
  rollupHasNevadaVote: rollups.rows.some((r) => r.dimension === "midterm-2026|blue")
};
console.log(JSON.stringify(out));
assert.equal(out.manifestDay, day);
assert.ok(out.eventsInDump >= 1); assert.equal(out.ourEventDumped, true);
assert.equal(out.ourVoteDumped, true);
assert.equal(out.emailInVoteDump, false, "dumps never contain emails");
assert.equal(out.rollupHasNevadaVote, true, "nightly run wrote rollups to D1");
console.log("NIGHTLY WORKER TEST PASSED");
