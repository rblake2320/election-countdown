// One-command local acceptance, built assets + real workerd/D1 + real Chromium.
import {spawn, spawnSync} from "node:child_process";
import {createServer} from "node:net";
import {mkdirSync, openSync, readFileSync, writeFileSync} from "node:fs";
import {join, resolve} from "node:path";
const runDir = resolve(".local", `live-${Date.now()}`);
mkdirSync(runDir, {recursive:true});
const probe = createServer();
await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise(resolve=>probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
let child;
async function start() {
  const log = openSync(join(runDir,"server.log"),"a");
  child = spawn(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "pages", "dev", "public", "--ip", "127.0.0.1", "--port", String(port), "--persist-to", runDir, "--binding", "ADMIN_SECRET=local-acceptance-only-01234567890123456789", "IP_HASH_SECRET=local-acceptance-only"], {stdio:["ignore",log,log],windowsHide:true});
  for(let i=0;i<120;i++) {
    if (child.exitCode !== null) throw new Error(`Server exited. See ${runDir}/server.log`);
    try {const response = await fetch(base+"/api/time", {signal:AbortSignal.timeout(1500)}); if(response.ok) return;} catch {}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw new Error(`Server not ready. See ${runDir}/server.log`);
}
function stop() {
  if(!child) return;
  if(process.platform === "win32") spawnSync(join(process.env.SystemRoot,"System32","taskkill.exe"),["/pid",String(child.pid),"/T","/F"],{stdio:"ignore",windowsHide:true});
  else child.kill("SIGTERM");
  child = null;
}
function run(file,args=[]) {
  return new Promise((resolve,reject)=>{
    const p=spawn(process.execPath,[file,...args],{stdio:"inherit",windowsHide:true});
    p.on("error",reject); p.on("close",code=>code===0?resolve():reject(new Error(`${file} exited ${code}`)));
  });
}
try {
  await run("--test", ["tests/avatar-image.test.mjs"]);
  await run("scripts/publish-build.mjs");
  await start();
  await run("tests/e2e/live-profile.mjs",[base]);
  stop(); await new Promise(resolve=>setTimeout(resolve,1500));
  await start();
  const expected=JSON.parse(readFileSync(".local/live-profile-restart.json","utf8"));
  const response=await fetch(`${base}/api/live-profiles/${expected.id}`);
  const state=await response.json();
  if(response.status!==200 || state.version!==expected.version || state.ownerZone!==expected.ownerZone) throw new Error("Persisted profile failed restart verification");
  const report=JSON.parse(readFileSync("docs/live-profile/acceptance.json","utf8"));
  report.checks.push({name:"Workerd restart with retained D1 state",result:"Worked",version:state.version});
  report.runtimeLogs=join(runDir,"server.log");
  writeFileSync("docs/live-profile/acceptance.json",JSON.stringify(report,null,2));
  console.log("PASS Workerd restart with retained D1 state");
  await run("tests/e2e/image-slot.mjs",[base]);
  await run("tests/e2e/live-image-limits.mjs",[base]);
  await run("tests/e2e/embed.mjs",[base]);
} finally { stop(); }
