// Signed-in user flips to the 2028 card, submits the vote form; the POST must carry
// electionId=presidential-2028 and the API must store it there (midterm stays empty).
// Usage: node vote-election-test.mjs <base>
import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.argv[2];
if (/pages\.dev/.test(base)) throw new Error("local only");
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
const reg = await ctx.request.post(base + "/api/auth/register", {
  headers: { origin: base, "cf-connecting-ip": "192.0.2." + (Date.now() % 250) },
  data: { email: `vote-${Date.now()}@example.com`, password: "correct-horse-1" }
});
assert.ok(reg.ok(), "register " + reg.status());
const p = await ctx.newPage();
const posted = [];
p.on("request", (r) => { if (r.method() === "POST" && new URL(r.url()).pathname === "/api/intent") posted.push(JSON.parse(r.postData() || "{}")); });
await p.goto(base + "/", { waitUntil: "load" });
await p.waitForTimeout(1500);
await p.locator("body").click({ position: { x: 5, y: 300 } });
await p.keyboard.press("ArrowDown");
await p.waitForTimeout(1200);
const card = (await p.locator("[data-testid=dual-countdown] h1").first().innerText()).trim();

await p.getByRole("button", { name: /Share Your Vote Plan/i }).click();
const dialog = p.getByRole("dialog");
await dialog.waitFor();
const description = (await dialog.innerText()).replace(/\s+/g, " ");
await p.locator("[data-testid=button-intent-blue]").click();
await dialog.locator("button[role=combobox]").first().click();
await p.getByRole("option", { name: /^(CA|California)$/ }).first().click();
await dialog.getByRole("button", { name: /save|submit|share/i }).last().click();
await p.waitForTimeout(2000);

const cookieHeader = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
const get = async (q) => (await ctx.request.get(base + "/api/intent" + q, { headers: { cookie: cookieHeader } })).json();
const stored28 = await get("?election=presidential-2028");
const stored26 = await get("?election=midterm-2026");
await b.close();

const out = { card, mentions2028InDialog: /2028 Presidential Election/.test(description), postedElectionId: posted[0]?.electionId, stored28: stored28?.intent ?? null, stored26: stored26?.intent ?? null };
console.log(JSON.stringify(out));
assert.match(card, /2028 Presidential Election/);
assert.equal(out.mentions2028InDialog, true);
assert.equal(out.postedElectionId, "presidential-2028");
assert.equal(out.stored28, "blue");
assert.equal(out.stored26, null, "midterm answer untouched");
console.log("VOTE ELECTION TEST PASSED");
