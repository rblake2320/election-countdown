// The Pages output dir must expose the site and nothing else from the repo.
// Usage: node deploy-folder.mjs <base>
import assert from "node:assert/strict";
const base = process.argv[2];
if (/pages\.dev/.test(base)) throw new Error("local only");

const privateFiles = [
  "schema.sql", "wrangler.toml", "LAUNCH.md", "CLAUDE.md", "AGENTS.md", "package.json",
  "server/routes.ts", "client/src/App.tsx", "functions/api/%5B%5Bpath%5D%5D.js",
  ".gitignore", ".env.example", ".dev.vars", "drizzle.config.ts", "scripts/publish-build.mjs"
];
const leaked = [];
for (const f of privateFiles) {
  const body = await (await fetch(`${base}/${f}`)).text();
  // Unknown paths fall back to the SPA page; anything else means the file itself was served.
  if (!body.slice(0, 200).includes("<!DOCTYPE html>")) leaked.push(f);
}

const sitePaths = ["/", "/favicon.png", "/opengraph.jpg", "/background.png", "/privacy", "/terms", "/api/health"];
const html = await (await fetch(base + "/")).text();
for (const asset of html.match(/\.\/assets\/index-[\w-]+\.(js|css)/g) || []) sitePaths.push(asset.slice(1));
const broken = [];
for (const p of sitePaths) {
  const status = (await fetch(base + p)).status;
  if (status !== 200) broken.push(`${p} ${status}`);
}

console.log(JSON.stringify({ leaked, broken, sitePathsChecked: sitePaths.length }));
assert.deepEqual(leaked, [], "private repo files must not be served");
assert.deepEqual(broken, [], "every site path returns 200");
assert.ok(sitePaths.length >= 9, "index.html references its JS and CSS bundle");
console.log("DEPLOY FOLDER TEST PASSED");
