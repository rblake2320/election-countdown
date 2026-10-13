// Runs the end-to-end suite against a fresh local `wrangler pages dev` (empty local D1).
//
//   npm run test:e2e
//
// First time only: `npx playwright install chromium`.
// Never points at production: every test refuses *.pages.dev URLs.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, openSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = Number(process.env.E2E_PORT || 8788);
const workerPort = port + 1;
const base = `http://localhost:${port}`;
const workerBase = `http://localhost:${workerPort}`;
const adminSecret = "e2e-admin-secret-0123456789abcdef0123456789";
const persistDir = mkdtempSync(join(tmpdir(), "ec-e2e-"));
// Server output goes to log files so a failed start can be diagnosed (printed below on failure).
const logDir = mkdtempSync(join(tmpdir(), "ec-e2e-logs-"));
const siteLog = join(logDir, "site.log");
const workerLog = join(logDir, "worker.log");

const suites = [
  ["migration", ["tests/e2e/migration.mjs", "tests/fixtures/schema-pre-election-id.sql", "migrations/0001_election_id.sql"]],
  ["deploy folder", ["tests/e2e/deploy-folder.mjs", base]],
  ["embed widget", ["tests/e2e/embed.mjs", base]],
  ["canonical domain redirect", ["tests/e2e/canonical-redirect.mjs", base]],
  ["per-election API", ["tests/e2e/api-elections.mjs", base, adminSecret]],
  ["API hardening", ["tests/e2e/api-hardening.mjs", base, adminSecret, "--expect-fixed"]],
  ["CSV + duplicate register", ["tests/e2e/csv-and-register.mjs", base, adminSecret, "--expect-fixed"]],
  ["rate limits", ["tests/e2e/rate-limits.mjs", base, "--expect-limits"]],
  ["request flood", ["tests/e2e/request-flood.mjs", base]],
  ["arrow keys", ["tests/e2e/arrow-keys.mjs", base, "--expect-fixed"]],
  ["election day (fixed instants)", ["tests/e2e/election-day.mjs", base, "--expect-fixed"]],
  ["election day (open page at 1 AM)", ["tests/e2e/election-day-realtime.mjs", base, "2026-11-04T05:59:50Z", "40000"]],
  ["vote on 2028 card", ["tests/e2e/vote-election.mjs", base]],
  ["anonymous votes", ["tests/e2e/anonymous-votes.mjs", base, "--expect-fixed"]],
  ["Google + GitHub sign-in (real provider endpoints)", ["tests/e2e/oauth.mjs", base, "--expect-fixed"]],
  ["themes for verified accounts", ["tests/e2e/themes.mjs", base, persistDir, "--expect-fixed"]],
  ["app shell: CSP, tracking, profile, dialogs", ["tests/e2e/app-shell.mjs", base, adminSecret, "--expect-fixed"]],
  ["data exports + rollups + dashboard", ["tests/e2e/data-pipeline.mjs", base, adminSecret, "--expect-fixed"]],
  ["nightly worker -> D1 + R2", ["tests/e2e/nightly-worker.mjs", base, workerBase, adminSecret, persistDir]],
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

async function waitFor(url, okStatus, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).status === okStatus) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} did not answer ${okStatus}`);
}

// One command string: npx needs a shell on Windows, and Node warns when a shell gets an args array.
const server = spawn(
  `npx wrangler pages dev --port ${port} --persist-to "${persistDir}" --binding ADMIN_SECRET=${adminSecret} IP_HASH_SECRET=e2e-ip-secret ` +
    // Placeholder OAuth apps: the real Google/GitHub endpoints reject them, which the oauth suite relies on.
    `GOOGLE_CLIENT_ID=e2e-placeholder.apps.googleusercontent.com GOOGLE_CLIENT_SECRET=e2e-placeholder ` +
    `GITHUB_CLIENT_ID=Iv1.e2eplaceholder GITHUB_CLIENT_SECRET=e2e-placeholder`,
  { stdio: ["ignore", openSync(siteLog, "w"), openSync(siteLog, "a")], shell: true }
);
// Nightly Worker on the same local D1/R2; offset 0 so it processes today (test data is created today).
const worker = spawn(
  `npx wrangler dev --port ${workerPort} --test-scheduled --persist-to "${persistDir}" --var NIGHTLY_DAY_OFFSET:0`,
  { stdio: ["ignore", openSync(workerLog, "w"), openSync(workerLog, "a")], shell: true, cwd: "workers/nightly" }
);

let failed = 0;
try {
  try {
    await waitFor(base + "/api/health", 200, 120000);
    await waitFor(workerBase + "/", 404, 120000);
  } catch (error) {
    for (const [name, file] of [["site", siteLog], ["worker", workerLog]]) {
      const tail = readFileSync(file, "utf8").split("\n").slice(-40).join("\n");
      console.log(`--- ${name} server log ---\n${tail}`);
    }
    throw error;
  }
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
  for (const child of [server, worker]) {
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  }
  await new Promise((r) => setTimeout(r, 1500));
  try { rmSync(persistDir, { recursive: true, force: true }); } catch {}
}

console.log(failed ? `\n${failed} of ${suites.length} suites FAILED` : `\nAll ${suites.length} suites passed`);
process.exit(failed ? 1 : 0);
