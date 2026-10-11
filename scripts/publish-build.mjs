// Builds client/src with vite and publishes the bundle into public/ (the Pages output dir).
//
// public/index.html is the served page (it carries meta tags, legal links and inline launch
// scripts that client/index.html does not), so only its asset references are rewritten.
// Old hashed bundles are removed so public/assets holds exactly one JS and one CSS file.
//
// Usage: npm run build:site
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, copyFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const built = "dist/public/assets";
const published = "public/assets";
const page = "public/index.html";

execSync("npx vite build", { stdio: "inherit" });

const assets = readdirSync(built);
const js = assets.filter((f) => /^index-.*\.js$/.test(f));
const css = assets.filter((f) => /^index-.*\.css$/.test(f));
if (js.length !== 1 || css.length !== 1) {
  throw new Error(`expected one index JS and one CSS in ${built}, found ${assets.join(", ")}`);
}

let html = readFileSync(page, "utf8");
const jsRefs = html.match(/\.\/assets\/index-[\w-]+\.js/g) || [];
const cssRefs = html.match(/\.\/assets\/index-[\w-]+\.css/g) || [];
if (jsRefs.length !== 1 || cssRefs.length !== 1) {
  throw new Error(`${page} must reference exactly one index JS and CSS (found ${jsRefs.length}, ${cssRefs.length})`);
}
html = html.replace(jsRefs[0], `./assets/${js[0]}`).replace(cssRefs[0], `./assets/${css[0]}`);

for (const old of readdirSync(published)) {
  if (/^index-.*\.(js|css)$/.test(old) && old !== js[0] && old !== css[0]) rmSync(join(published, old));
}
copyFileSync(join(built, js[0]), join(published, js[0]));
copyFileSync(join(built, css[0]), join(published, css[0]));
writeFileSync(page, html);

console.log(`published ${js[0]} + ${css[0]} -> ${page}`);
