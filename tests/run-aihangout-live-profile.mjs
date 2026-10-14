// Windows-safe local integration runner. Uses sibling AIHangout checkout by default.
// Production deployments, credentials and databases are never used.
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdirSync,openSync,realpathSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
const ec=realpathSync('.'),ai=realpathSync(process.argv[2]||'../aihangout-platform');
const runDir=join(ec,'.local',`integration-${Date.now()}`);mkdirSync(runDir,{recursive:true});
const env={...process.env};
// A long inherited Windows PATH can disappear in cmd.exe; this only changes child processes.
if(process.platform==='win32') {for(const k of Object.keys(env))if(k.toLowerCase()==='path')delete env[k];env.Path=`${dirname(process.execPath)};${join(process.env.SystemRoot,'System32')}`;}
const children=[];
async function port(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
const ecPort=await port(),aiPort=await port(),ecUrl=`https://127.0.0.1:${ecPort}`,aiUrl=`http://127.0.0.1:${aiPort}`;
function run(cwd,args,extra={}){return new Promise((yes,no)=>{const p=spawn(process.execPath,args,{cwd,env:{...env,...extra},stdio:'inherit',windowsHide:true});p.on('error',no);p.on('exit',code=>code===0?yes():no(new Error(`${args[0]} exited ${code}`)));});}
function start(cwd,args,name){const log=openSync(join(runDir,`${name}.log`),'a');const p=spawn(process.execPath,args,{cwd,env,stdio:['ignore',log,log],windowsHide:true});children.push(p);return p;}
async function waitForPort(p,child){for(let i=0;i<120;i++){if(child.exitCode!==null)throw new Error(`Server exited; see ${runDir}`);const ok=await new Promise(resolve=>{const s=createServer();s.once('error',()=>resolve(true));s.listen(p,'127.0.0.1',()=>s.close(()=>resolve(false)));});if(ok){await new Promise(r=>setTimeout(r,1000));return;}await new Promise(r=>setTimeout(r,500));}throw new Error(`Server timed out; see ${runDir}`);}
try{
  await run(ec,['scripts/publish-build.mjs']);
  await run(ai,['node_modules/esbuild/bin/esbuild','src/worker.js','--bundle','--format=esm','--external:cloudflare:workers','--outfile=dist/worker.js']);
  await run(join(ai,'frontend'),['node_modules/vite/bin/vite.js','build'],{VITE_LIVE_COUNTDOWN_ORIGIN:ecUrl});
  await run(ai,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','aihangout-staging','--env','staging','--local','--persist-to',join(runDir,'ai-state')]);
  const es=start(ec,['node_modules/wrangler/bin/wrangler.js','pages','dev','public','--ip','127.0.0.1','--port',String(ecPort),'--local-protocol','https','--persist-to',join(runDir,'ec-state'),'--binding','ADMIN_SECRET=local-acceptance-only-01234567890123456789','IP_HASH_SECRET=local-acceptance-only'],'countdown');
  const as=start(ai,['node_modules/wrangler/bin/wrangler.js','dev','--env','staging','--local','--ip','127.0.0.1','--port',String(aiPort),'--persist-to',join(runDir,'ai-state'),'--var','JWT_SECRET:local-acceptance-only-jwt-0123456789'],'aihangout');
  await Promise.all([waitForPort(ecPort,es),waitForPort(aiPort,as)]);
  await run(ec,['tests/e2e/aihangout-live-profile.mjs',aiUrl,ecUrl]);
}finally{
  for(const p of children){if(process.platform==='win32')spawnSync(join(process.env.SystemRoot,'System32','taskkill.exe'),['/pid',String(p.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});else p.kill('SIGTERM');}
  // Never leave a local provider URL in the deploy folder.
  await run(join(ai,'frontend'),['node_modules/vite/bin/vite.js','build'],{VITE_LIVE_COUNTDOWN_ORIGIN:'https://electionclock.com'});
}
