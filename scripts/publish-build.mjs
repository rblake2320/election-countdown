// Builds the site from client/ and mirrors the result into public/ (the Pages output dir).
//
// client/ is the only source: index.html, src/, and client/public/ (privacy/terms pages,
// _headers, _redirects, images). public/ is generated; never edit it by hand.
//
// Guard: the CSP in client/public/_headers has no 'unsafe-inline' for scripts, so the built page
// must not contain any inline <script>. The build fails instead of shipping a page the CSP blocks.
//
// Usage: npm run build:site
import { execSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";

const built = "dist/public";
const published = "public";

execSync("npx vite build", { stdio: "inherit" });

const html = readFileSync(`${built}/index.html`, "utf8");
const scripts = html.match(/<script\b[^>]*>/g) || [];
const inline = scripts.filter((tag) => !/\bsrc=/.test(tag));
if (inline.length) {
  throw new Error(`index.html has ${inline.length} inline <script> tag(s); the CSP (script-src 'self') would block them`);
}
for (const required of ["_headers", "_redirects", "privacy.html", "terms.html", "favicon.png", "opengraph.jpg"]) {
  if (!existsSync(`${built}/${required}`)) throw new Error(`build output is missing ${required}`);
}

rmSync(published, { recursive: true, force: true });
cpSync(built, published, { recursive: true });
console.log(`published ${built} -> ${published} (${scripts.length} external script tag(s), 0 inline)`);
