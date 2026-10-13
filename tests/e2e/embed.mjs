// Embeddable widget: /embed.html is framable by any site (its own CSP, no X-Frame-Options),
// counts down live, honours ?election= and the "today" phase, keeps the same dates as the app,
// and the share dialog hands out a copyable snippet.
// Usage: node embed.mjs <base>
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const base = process.argv[2];
if (/pages\.dev/.test(base)) throw new Error("local only");
const out = {};

// 1. Headers: the widget page may be framed; the rest of the site still may not.
// fetch follows the 308 to /embed, so these are the headers of the page actually served.
const embedRes = await fetch(base + "/embed.html");
out.embedStatus = embedRes.status;
out.embedFinalUrl = embedRes.url;
out.embedCsp = embedRes.headers.get("content-security-policy") || "";
out.embedXfo = embedRes.headers.get("x-frame-options");
out.embedJsStatus = (await fetch(base + "/embed.js")).status;
const homeRes = await fetch(base + "/");
out.homeXfo = homeRes.headers.get("x-frame-options");
out.homeCsp = homeRes.headers.get("content-security-policy") || "";

// 2. Dates in embed.js equal the ones in elections.ts (the widget cannot import the TS file).
const ts = readFileSync("client/src/lib/elections.ts", "utf8");
const js = readFileSync("client/public/embed.js", "utf8");
const dates = (src, id) => {
  const block = src.split(`id: "${id}"`)[1] || "";
  return { start: block.match(/start:\s*"([^"]+)"/)?.[1], end: block.match(/end:\s*"([^"]+)"/)?.[1] };
};
out.dates = {};
for (const id of ["midterm-2026", "presidential-2028"]) out.dates[id] = { ts: dates(ts, id), js: dates(js, id) };

const b = await chromium.launch();
const errors = [];
async function newPage(viewport, opts = {}) {
  const ctx = await b.newContext({ viewport, ...opts });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  return p;
}
const fields = ["days", "hours", "minutes", "seconds"];
const readFields = (p) => p.evaluate((ids) => ids.map((id) => document.getElementById(id).textContent), fields);

// 3. Live countdown at the small size: four numeric fields, the seconds move, no overflow.
const small = await newPage({ width: 300, height: 120 });
await small.goto(base + "/embed.html", { waitUntil: "load" });
await small.waitForTimeout(300);
const first = await readFields(small);
await small.waitForTimeout(1100);
const second = await readFields(small);
out.fieldsNumeric = first.every((v) => /^\d+$/.test(v));
out.fieldsChanged = first.join(",") !== second.join(",");
out.defaultTitle = await small.locator("#title").textContent();
out.smallOverflow = await small.evaluate(() => ({
  x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
}));
const link = small.locator("#link");
out.link = { href: await link.getAttribute("href"), target: await link.getAttribute("target"), rel: await link.getAttribute("rel"), text: await link.textContent() };

// 4. ?election=presidential-2028 and ?theme=dark at the large size.
const large = await newPage({ width: 600, height: 200 });
await large.goto(base + "/embed.html?election=presidential-2028&theme=dark", { waitUntil: "load" });
await large.waitForTimeout(300);
out.title2028 = await large.locator("#title").textContent();
out.darkTheme = await large.evaluate(() => document.documentElement.getAttribute("data-theme"));
out.largeOverflow = await large.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// 5. Election Day: fake clock at noon UTC on 2026-11-03 (7 AM Eastern, polls open).
const today = await newPage({ width: 320, height: 140 });
await today.clock.install({ time: new Date("2026-11-03T12:00:00Z") });
await today.goto(base + "/embed.html?election=midterm-2026", { waitUntil: "load" });
await today.clock.runFor(600);
out.todayText = (await today.locator("#today").textContent()).trim();
out.todayVisible = await today.locator("#today").isVisible();
out.countsHiddenOnToday = !(await today.locator("#counts").isVisible());
// After the midterm's "today" phase ends, the widget falls through to the 2028 race.
const after = await newPage({ width: 320, height: 140 });
await after.clock.install({ time: new Date("2026-11-04T06:30:00Z") }); // 1:30 AM EST, after the 1 AM end
await after.goto(base + "/embed.html?election=midterm-2026", { waitUntil: "load" });
await after.clock.runFor(600);
out.pastFallsThrough = await after.locator("#title").textContent();

// 6. A third-party site can iframe the widget and it renders; the same site cannot frame the app.
//    The host page is an https origin (CSP `frame-ancestors *` matches network schemes only, so a
//    data: page is not a fair host). Chromium's Local Network Access check blocks a public page
//    framing localhost, which never applies to the public site, so it is switched off here.
const hostBrowser = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks"] });
const host = await hostBrowser.newPage({ viewport: { width: 800, height: 400 } });
const hostHtml = `<!DOCTYPE html><html><body><h1>Host site</h1>
<iframe id="ec" src="${base}/embed.html?election=midterm-2026" width="320" height="140" style="border:0" title="Election Countdown" loading="lazy"></iframe>
<iframe id="app" src="${base}/" width="320" height="140" title="App (must be blocked)"></iframe>
</body></html>`;
await host.route("https://host.example/**", (route) => route.fulfill({ contentType: "text/html", body: hostHtml }));
await host.goto("https://host.example/", { waitUntil: "load" });
await host.waitForTimeout(1500);
// Pages serves /embed.html at the clean URL /embed (308), so the frame's final URL is /embed?...
const frame = host.frames().find((f) => /\/embed(\.html)?\?/.test(f.url()));
assert.ok(frame, "iframe pointing at the widget exists");
out.iframeTitle = await frame.title();
out.iframeFields = await frame.evaluate((ids) => ids.map((id) => document.getElementById(id).textContent), fields);
out.iframeVisible = await host.locator("#ec").isVisible();
out.appFrameUrls = host.frames().filter((f) => f.name() === "app").map((f) => f.url());
await hostBrowser.close();

// 7. Share dialog: snippet shown, copy puts it on the clipboard.
const app = await newPage({ width: 1280, height: 1000 }, { permissions: ["clipboard-read", "clipboard-write"] });
await app.goto(base + "/", { waitUntil: "load" });
await app.waitForTimeout(1200);
await app.locator("header button[aria-label=Share]").click();
await app.getByRole("dialog").waitFor();
out.snippetShown = (await app.locator("[data-testid=embed-snippet]").textContent()).trim();
await app.locator("[data-testid=button-copy-embed]").click();
await app.waitForTimeout(300);
out.clipboard = await app.evaluate(() => navigator.clipboard.readText());
out.copiedLabel = (await app.locator("[data-testid=button-copy-embed]").textContent()).trim();
await b.close();
out.pageErrors = errors;

console.log(JSON.stringify(out));
assert.equal(out.embedStatus, 200, "/embed.html served");
assert.equal(out.embedJsStatus, 200, "/embed.js served");
assert.match(out.embedCsp, /frame-ancestors \*/, "embed CSP allows any frame ancestor");
assert.match(out.embedCsp, /script-src 'self'/, "embed CSP keeps strict script-src");
assert.ok(!/frame-ancestors 'none'/.test(out.embedCsp), "site-wide frame-ancestors 'none' detached from /embed.html");
assert.equal(out.embedXfo, null, "no X-Frame-Options on /embed.html");
assert.equal(out.homeXfo, "DENY", "the app itself still refuses framing");
assert.match(out.homeCsp, /frame-ancestors 'none'/, "the app CSP unchanged");
for (const id of ["midterm-2026", "presidential-2028"]) {
  assert.ok(out.dates[id].ts.start && out.dates[id].ts.end, `${id} dates found in elections.ts`);
  assert.deepEqual(out.dates[id].js, out.dates[id].ts, `${id} dates in embed.js match elections.ts`);
}
assert.equal(out.fieldsNumeric, true, "four numeric fields");
assert.equal(out.fieldsChanged, true, "countdown advances within 1.1 s");
assert.equal(out.defaultTitle, "2026 Midterm Elections", "default is the next upcoming election");
assert.deepEqual(out.smallOverflow, { x: 0, y: 0 }, "fits 300x120 without scrolling");
assert.equal(out.largeOverflow, 0, "fits 600x200 without sideways scroll");
assert.deepEqual(out.link, { href: "https://electionclock.com", target: "_blank", rel: "noopener", text: "electionclock.com" });
assert.equal(out.title2028, "2028 Presidential Election");
assert.equal(out.darkTheme, "dark");
assert.equal(out.todayText, "Today is Election Day");
assert.equal(out.todayVisible, true, "Election Day message shown during the today phase");
assert.equal(out.countsHiddenOnToday, true, "digits hidden on Election Day");
assert.equal(out.pastFallsThrough, "2028 Presidential Election", "past election falls through to the next one");
assert.equal(out.iframeTitle, "Election Countdown", "iframe on a foreign host loaded the widget");
assert.ok(out.iframeFields.every((v) => /^\d+$/.test(v)), "widget renders digits inside the foreign iframe");
assert.equal(out.iframeVisible, true);
assert.deepEqual(out.appFrameUrls, ["chrome-error://chromewebdata/"], "the app itself is still blocked from being framed");
const expectedSnippet = `<iframe src="${base}/embed.html?election=midterm-2026" width="320" height="140" style="border:0" title="Election Countdown" loading="lazy"></iframe>`;
assert.equal(out.snippetShown, expectedSnippet, "share dialog shows the embed snippet");
assert.equal(out.clipboard, expectedSnippet, "copy puts the snippet on the clipboard");
assert.equal(out.copiedLabel, "Copied!");
assert.deepEqual(out.pageErrors, [], "no page errors or CSP violations");
console.log("EMBED WIDGET TEST PASSED");
