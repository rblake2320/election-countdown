// Runs the end-to-end suite against a fresh local `wrangler pages dev` (empty local D1).
//
//   npm run test:e2e
//
// First time only: `npx playwright install chromium`.
// Never points at production: every test refuses *.pages.dev URLs.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = Number(process.env.E2E_PORT || 8788);
const base = `http://localhost:${port}`;
const adminSecret = "e2e-admin-secret-0123456789abcdef0123456789";
const persistDir = mkdtempSync(join(tmpdir(), "ec-e2e-"));

const suites = [
  ["migration", ["tests/e2e/migration.mjs", "tests/fixtures/schema-pre-election-id.sql", "migrations/0001_election_id.sql"]],
  ["deploy folder", ["tests/e2e/deploy-folder.mjs", base]],
  ["per-election API", ["tests/e2e/api-elections.mjs", base, adminSecret]],
  ["CSV + duplicate register", ["tests/e2e/csv-and-register.mjs", base, adminSecret, "--expect-fixed"]],
  ["rate limits", ["tests/e2e/rate-limits.mjs", base, "--expect-limits"]],
  ["request flood", ["tests/e2e/request-flood.mjs", base]],
  ["sign-in panel", ["tests/e2e/signin-panel.mjs", base]],
  ["arrow keys", ["tests/e2e/arrow-keys.mjs", base, "--expect-fixed"]],
  ["election day (fixed instants)", ["tests/e2e/election-day.mjs", base, "--expect-fixed"]],
  ["election day (open page at 1 AM)", ["tests/e2e/election-day-realtime.mjs", base, "2026-11-04T05:59:50Z", "40000"]],
  ["vote on 2028 card", ["tests/e2e/vote-election.mjs", base]],
];

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
}

async function waitForHealth(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(base + "/api/health")).status === 200) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`wrangler pages dev did not become healthy on ${base}`);
}

// One command string: npx needs a shell on Windows, and Node warns when a shell gets an args array.
const server = spawn(
  `npx wrangler pages dev --port ${port} --persist-to "${persistDir}" --binding ADMIN_SECRET=${adminSecret} IP_HASH_SECRET=e2e-ip-secret`,
  { stdio: "ignore", shell: true }
);

let failed = 0;
try {
  await waitForHealth();
  for (const [name, args] of suites) {
    const started = Date.now();
    const { code, out } = await run("node", args);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (code === 0) {
      console.log(`PASS  ${name} (${seconds}s)`);
    } else {
      failed++;
      console.log(`FAIL  ${name} (${seconds}s)\n${out.split("\n").filter((l) => !/^\s+at /.test(l)).slice(-15).join("\n")}`);
    }
  }
} finally {
  if (process.platform === "win32") spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 1500));
  try { rmSync(persistDir, { recursive: true, force: true }); } catch {}
}

console.log(failed ? `\n${failed} of ${suites.length} suites FAILED` : `\nAll ${suites.length} suites passed`);
process.exit(failed ? 1 : 0);
