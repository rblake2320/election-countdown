// Arrow keys typed in the Sign In dialog's email field must move the caret and must not flip
// the countdown; arrow keys on the page itself must still flip it.
// Usage: node arrow-test.mjs <base> [--expect-fixed | --expect-broken]
import { chromium } from "playwright";
import assert from "node:assert/strict";
const [base, mode = "--expect-fixed"] = process.argv.slice(2);
if (/pages\.dev/.test(base)) throw new Error("local only");

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto(base + "/", { waitUntil: "load" });
await p.waitForTimeout(1500);
const title = () => p.locator("h1, h2").filter({ hasText: /Election|Inauguration/ }).first().innerText();

// Control direction 1: on the page, ArrowDown flips.
const t0 = await title();
await p.locator("body").click({ position: { x: 5, y: 300 } });
await p.keyboard.press("ArrowDown");
await p.waitForTimeout(900);
const t1 = await title();
const pageFlips = t0 !== t1;

// In the dialog's email input: type, then arrow keys.
await p.getByRole("button", { name: /sign in/i }).first().click();
const email = p.locator("[role='dialog'] input[type='email'], [role='dialog'] input").first();
await email.waitFor();
await email.fill("someone@example.com");
// type=email has no selectionStart, so prove caret movement by inserting a character.
// ArrowDown first (it moves the caret to the end in a one-line input), then two lefts.
await p.keyboard.press("ArrowDown");
await p.keyboard.press("ArrowLeft");
await p.keyboard.press("ArrowLeft");
await p.keyboard.type("Z");
await p.waitForTimeout(900);
const value = await email.inputValue();
const caretMoved = value === "someone@example.cZom";
await p.keyboard.press("Escape");
await p.waitForTimeout(500);
const t2 = await title();
const flippedWhileTyping = t2 !== t1;
await b.close();

const result = { pageArrowFlips: pageFlips, value, caretMoved, flippedWhileTyping };
console.log(JSON.stringify(result));
assert.equal(pageFlips, true, "arrow keys on the page itself must still flip");
if (mode === "--expect-fixed") {
  assert.equal(flippedWhileTyping, false, "typing arrows must not flip the countdown");
  assert.equal(caretMoved, true, "ArrowLeft x2 moves the caret");
  console.log("ARROW KEY TEST PASSED");
} else {
  assert.ok(flippedWhileTyping || !caretMoved, "control: old build hijacks arrows");
  console.log("CONTROL: old build hijacks arrow keys in inputs");
}
