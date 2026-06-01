#!/usr/bin/env node
// Push to GitHub using the Replit connectors proxy via GitHub Contents API
import { execFileSync, execSync, spawnSync } from "child_process";
import { readFileSync } from "fs";

const connHost = process.env.REPLIT_CONNECTORS_HOSTNAME || "connectors.replit.com";
const OWNER = "rblake2320";
const REPO = "election-countdown";
const BRANCH = "main";

function getIdentity() {
  return execFileSync(
    process.env.REPLIT_CLI || "replit",
    ["identity", "create", "--audience", `https://${connHost}`],
    { encoding: "utf8" }
  ).trim();
}

async function githubApi(path, options = {}) {
  const identity = getIdentity();
  const url = `https://${connHost}/api/v2/proxy${path.startsWith("/") ? "" : "/"}${path}`;
  const resp = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "X-Replit-Token": `repl ${identity}`,
      "Connector-Name": "github",
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`GitHub API ${path} => ${resp.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

// Step 1: Initialize the empty repo with a README using Contents API
console.log("Step 1: Initializing empty repo with README...");
try {
  const readme = Buffer.from("# Election Countdown\n\nInitial commit.\n").toString("base64");
  await githubApi(`/repos/${OWNER}/${REPO}/contents/README.md`, {
    method: "PUT",
    body: {
      message: "Initial commit",
      content: readme,
      branch: BRANCH,
    },
  });
  console.log("README created.");
} catch (e) {
  if (e.message.includes("422") || e.message.includes("already exists") || e.message.includes("sha")) {
    console.log("README already exists, continuing.");
  } else {
    throw e;
  }
}

// Step 2: Get the current commit SHA on main
console.log("Step 2: Getting current branch SHA...");
const refData = await githubApi(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`);
const latestCommitSha = refData.object.sha;
console.log("Current HEAD:", latestCommitSha);

// Step 3: Get the tree SHA from the latest commit
const commitData = await githubApi(`/repos/${OWNER}/${REPO}/git/commits/${latestCommitSha}`);
const baseTreeSha = commitData.tree.sha;
console.log("Base tree SHA:", baseTreeSha);

// Step 4: Build a new tree with all our files
const files = execSync("git ls-files", { encoding: "utf8", cwd: "/home/runner/workspace" })
  .trim().split("\n").filter(Boolean);

console.log(`Step 3: Processing ${files.length} files...`);

const treeItems = [];
let processed = 0;

for (const file of files) {
  let content;
  let encoding;
  try {
    const buf = readFileSync(`/home/runner/workspace/${file}`);
    // Detect binary (has null bytes)
    let isBinary = false;
    for (let i = 0; i < Math.min(buf.length, 8000); i++) {
      if (buf[i] === 0) { isBinary = true; break; }
    }
    if (isBinary) {
      encoding = "base64";
      content = buf.toString("base64");
    } else {
      encoding = "utf-8";
      content = buf.toString("utf8");
    }
  } catch (e) {
    console.warn(`  Skipping ${file}: ${e.message}`);
    continue;
  }

  try {
    const blob = await githubApi(`/repos/${OWNER}/${REPO}/git/blobs`, {
      method: "POST",
      body: { content, encoding },
    });

    treeItems.push({
      path: file,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  } catch (e) {
    console.warn(`  Failed to create blob for ${file}: ${e.message.slice(0, 100)}`);
  }

  processed++;
  if (processed % 20 === 0) console.log(`  ${processed}/${files.length} files processed`);
}

console.log(`Step 4: Creating git tree with ${treeItems.length} items...`);
const tree = await githubApi(`/repos/${OWNER}/${REPO}/git/trees`, {
  method: "POST",
  body: {
    base_tree: baseTreeSha,
    tree: treeItems,
  },
});

const lastMessage = execSync("git log -1 --pretty=%B", { encoding: "utf8", cwd: "/home/runner/workspace" }).trim();

console.log("Step 5: Creating commit...");
const commit = await githubApi(`/repos/${OWNER}/${REPO}/git/commits`, {
  method: "POST",
  body: {
    message: lastMessage || "Push from Replit",
    tree: tree.sha,
    parents: [latestCommitSha],
  },
});

console.log("Step 6: Updating branch ref...");
await githubApi(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
  method: "PATCH",
  body: { sha: commit.sha, force: true },
});

console.log(`\nSuccessfully pushed ${treeItems.length} files!`);
console.log(`View at: https://github.com/${OWNER}/${REPO}`);
