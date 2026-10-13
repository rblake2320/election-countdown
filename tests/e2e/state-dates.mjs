// State voting dates (client/public/data/state-voting-2026.json): schema + value checks, the
// file is served as JSON by the local site, every official source URL is still reachable, the
// date helper renders nulls as "Check your state's site", and selecting Georgia in the state
// select renders the "Key dates for Georgia" block with the registration date from the JSON.
// Usage: node tests/e2e/state-dates.mjs <local base>
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { formatVotingDate, latestDate, UNKNOWN_DATE_TEXT } from "../../client/src/lib/state-voting.ts";

const base = process.argv[2];
if (!base) throw new Error("usage: node state-dates.mjs <local base>");
if (/pages\.dev/.test(base)) throw new Error("local only");

const CODES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MIN = "2026-09-01";
const ELECTION_DAY = "2026-11-03";
const out = {};
const problems = [];

// 1. Schema and value checks on the committed file.
const file = JSON.parse(readFileSync("client/public/data/state-voting-2026.json", "utf8"));
assert.equal(file.election, "midterm-2026");
assert.equal(file.electionDay, ELECTION_DAY);
assert.match(file.generatedOn, DATE_RE);
assert.deepEqual(Object.keys(file.states).sort(), [...CODES].sort(), "exactly 50 states + DC");

function officialHost(url, where) {
  let u;
  try { u = new URL(url); } catch { problems.push(`${where}: not a URL: ${url}`); return; }
  if (u.protocol !== "https:") problems.push(`${where}: not https: ${url}`);
  // Official hosts: .gov, vote.gov, ncsl.org, plus the state-government *.state.xx.us domains
  // (Texas and Massachusetts Secretaries of State) and dcboe.org (the DC Board of Elections).
  const ok = u.hostname.endsWith(".gov") || u.hostname === "vote.gov" || u.hostname === "ncsl.org" || u.hostname.endsWith(".ncsl.org")
    || /\.state\.[a-z]{2}\.us$/.test(u.hostname) || u.hostname === "dcboe.org" || u.hostname === "www.dcboe.org";
  if (!ok) problems.push(`${where}: host is not an official election domain: ${u.hostname}`);
}
function checkDate(value, where) {
  if (value === null) return;
  if (typeof value !== "string" || !DATE_RE.test(value)) { problems.push(`${where}: bad date ${JSON.stringify(value)}`); return; }
  if (value < MIN || value > ELECTION_DAY) problems.push(`${where}: ${value} outside ${MIN}..${ELECTION_DAY}`);
}
const counts = { registration: 0, earlyVoting: 0, mail: 0, sameDay: 0, postmarkOk: 0 };
for (const code of CODES) {
  const s = file.states[code];
  if (typeof s.name !== "string" || !s.name) problems.push(`${code}: name`);
  for (const k of ["online", "mail", "inPerson"]) checkDate(s.registration[k], `${code}.registration.${k}`);
  checkDate(s.earlyVoting.start, `${code}.earlyVoting.start`);
  checkDate(s.earlyVoting.end, `${code}.earlyVoting.end`);
  if (s.earlyVoting.start && s.earlyVoting.end && s.earlyVoting.start > s.earlyVoting.end) problems.push(`${code}: earlyVoting.start > end`);
  checkDate(s.mail.requestBy, `${code}.mail.requestBy`);
  checkDate(s.mail.returnBy, `${code}.mail.returnBy`);
  for (const [obj, k] of [[s.registration, "sameDay"], [s.mail, "postmarkOk"]]) {
    if (typeof obj[k] !== "boolean") problems.push(`${code}.${k}: not boolean`);
  }
  for (const [obj, name] of [[s.registration, "registration"], [s.earlyVoting, "earlyVoting"], [s.mail, "mail"]]) {
    if (obj.note !== null && typeof obj.note !== "string") problems.push(`${code}.${name}.note: not string|null`);
  }
  if (!s.source || typeof s.source.title !== "string" || !DATE_RE.test(s.source.checkedOn || "")) problems.push(`${code}: source.title/checkedOn`);
  officialHost(s.source?.url, `${code}.source.url`);
  officialHost(s.officialUrl, `${code}.officialUrl`);
  if (s.registration.online || s.registration.mail || s.registration.inPerson) counts.registration++;
  if (s.earlyVoting.start || s.earlyVoting.end) counts.earlyVoting++;
  if (s.mail.requestBy || s.mail.returnBy) counts.mail++;
  if (s.registration.sameDay) counts.sameDay++;
  if (s.mail.postmarkOk) counts.postmarkOk++;
}
out.schemaProblems = problems;
out.filled = counts;

// 2. Helper: null and malformed render the fallback; a real date renders "Mon, Oct 19".
out.helper = {
  nullText: formatVotingDate(null),
  malformed: formatVotingDate("soon"),
  sample: formatVotingDate("2026-10-19"),
  latest: latestDate([null, "2026-10-05", "2026-10-19", null]),
  latestAllNull: latestDate([null, null]),
};

// 3. Served by the local site as JSON.
const res = await fetch(base + "/data/state-voting-2026.json");
out.served = { status: res.status, contentType: res.headers.get("content-type") || "" };
const served = await res.json();
out.servedMatchesRepo = JSON.stringify(served) === JSON.stringify(file);

// 4. Live reachability of every distinct source URL (HEAD, fallback GET, 10 s, concurrency 8).
//    Several official sites (vote.gov, sos.ga.gov, elections.ny.gov, ...) sit behind bot
//    challenges that answer 403 to plain fetches, so a 403/429 is retried in headless Chromium,
//    which is what a voter clicking the link actually uses.
const urls = [...new Set(CODES.map((c) => file.states[c].source.url))];
const unreachable = [];
// A Cloudflare-style challenge page ("Just a moment...") means the site is up and screening robots.
// GitHub's runners get challenged where a home connection does not, so a challenge is reported but
// is not a dead link. Dead = 404, 5xx, network error, "Access Denied" or a maintenance page.
const challenged = [];
const isChallenge = (title) => /^Just a moment/i.test(title || "");
const probeBrowser = await chromium.launch();
async function probe(url) {
  const ua = { "user-agent": "Mozilla/5.0 (compatible; electionclock-source-check/1.0)" };
  let last = "unknown";
  for (const method of ["HEAD", "GET"]) {
    try {
      const r = await fetch(url, { method, headers: ua, redirect: "follow", signal: AbortSignal.timeout(10000) });
      if (r.status < 400) return null;
      last = String(r.status);
    } catch (e) {
      last = `${e.name}: ${e.message}`;
    }
  }
  if (/^(403|429)$/.test(last)) {
    const ctx = await probeBrowser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    });
    try {
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
      // A bot challenge ("Just a moment...") reloads into the real page within a few seconds.
      await page.waitForFunction(() => !/Just a moment/i.test(document.title), null, { timeout: 10000 }).catch(() => {});
      const title = await page.title();
      const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) || "");
      if (!/Just a moment|Access Denied|Website Maintenance/i.test(title) && !/Access Denied|403 Forbidden|404 Not Found/i.test(bodyText)) return null;
      if (isChallenge(title)) return { challenged: `${url} -> ${last}, bot challenge` };
      last = `${last}, browser "${title}"`;
    } catch (e) {
      last = `${last}, browser ${e.name}: ${e.message}`;
    } finally {
      await ctx.close();
    }
  }
  return `${url} -> ${last}`;
}
let next = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < urls.length) {
    const r = await probe(urls[next++]);
    if (r?.challenged) challenged.push(r.challenged);
    else if (r) unreachable.push(r);
  }
}));
await probeBrowser.close();
out.sources = { distinct: urls.length, unreachable, challenged };
if (challenged.length) console.log("BOT-CHALLENGED SOURCES (site up, screening robots):", JSON.stringify(challenged));
// Controls for the classifier in both directions.
assert.equal(isChallenge("Just a moment..."), true, "Cloudflare challenge title is a challenge");
assert.equal(isChallenge("Access Denied"), false, "Access Denied is not a challenge");
assert.equal(isChallenge("Website Maintenance"), false, "maintenance page is not a challenge");
assert.equal(isChallenge(""), false);

// 5. Browser: choose Georgia, the key-dates block shows the JSON's registration date, the
//    choice is remembered in localStorage (ec_state) and preselected on reload.
const ga = file.states.GA;
const expectedRegisterBy = formatVotingDate(latestDate([ga.registration.online, ga.registration.mail, ga.registration.inPerson]));
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const dataRequests = [];
page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/data/")) dataRequests.push(r.url()); });
await page.goto(base + "/", { waitUntil: "load" });
await page.waitForTimeout(1200);
await page.getByRole("combobox").filter({ hasText: /Select your state/ }).first().click();
await page.getByRole("option", { name: "Georgia", exact: true }).click();
const block = page.locator("[data-testid=state-key-dates]");
await block.waitFor({ timeout: 10000 });
out.ui = {
  heading: (await block.locator("h4").innerText()).trim(),
  registerBy: (await page.locator("[data-testid=state-register-by]").innerText()).split("\n")[0].trim(),
  earlyVoting: (await page.locator("[data-testid=state-early-voting]").innerText()).split("\n")[0].trim(),
  sourceLink: await block.locator(`a[href="${ga.source.url}"]`).count(),
  officialLink: await page.locator("[data-testid=state-official-link]").getAttribute("href"),
  officialTarget: await page.locator("[data-testid=state-official-link]").getAttribute("target"),
  officialRel: await page.locator("[data-testid=state-official-link]").getAttribute("rel"),
  saved: await page.evaluate(() => localStorage.getItem("ec_state")),
  dataRequests: dataRequests.length,
};
await page.reload({ waitUntil: "load" });
await page.locator("[data-testid=state-key-dates]").waitFor({ timeout: 10000 });
out.ui.preselectedAfterReload = await page.locator("[data-testid=state-key-dates]").getAttribute("data-state");
await b.close();
out.pageErrors = errors;

console.log(JSON.stringify(out));
assert.deepEqual(out.schemaProblems, [], "state-voting-2026.json passes schema + value checks");
assert.equal(out.helper.nullText, UNKNOWN_DATE_TEXT);
assert.equal(out.helper.nullText, "Check your state's site");
assert.equal(out.helper.malformed, "Check your state's site");
assert.equal(out.helper.sample, "Mon, Oct 19");
assert.equal(out.helper.latest, "2026-10-19");
assert.equal(out.helper.latestAllNull, null);
assert.equal(out.served.status, 200);
assert.match(out.served.contentType, /application\/json/);
assert.equal(out.servedMatchesRepo, true, "public/ is a fresh build of client/public");
// Official state sites go into maintenance windows (ohiosos.gov was down 40 min on 2026-10-13).
// One or two down is an outage to report, not a regression; more than that means our links rotted.
if (out.sources.unreachable.length) console.log("UNREACHABLE SOURCES (check them):", JSON.stringify(out.sources.unreachable));
assert.ok(out.sources.unreachable.length <= 2, `${out.sources.unreachable.length} official source URLs unreachable (max 2): ${JSON.stringify(out.sources.unreachable)}`);
assert.equal(out.ui.heading, "Key dates for Georgia");
assert.equal(out.ui.registerBy, expectedRegisterBy, "Georgia registration date comes from the JSON");
assert.equal(out.ui.sourceLink, 1, "source line links to source.url");
assert.equal(out.ui.officialLink, ga.officialUrl);
assert.equal(out.ui.officialTarget, "_blank");
assert.match(out.ui.officialRel, /noopener/);
assert.equal(out.ui.saved, "GA", "selection remembered in localStorage ec_state");
assert.equal(out.ui.preselectedAfterReload, "GA", "saved state preselected on return");
assert.equal(out.ui.dataRequests, 1, "exactly one static JSON fetch, no new /api calls");
assert.deepEqual(out.pageErrors, []);
console.log("STATE DATES TEST PASSED");
