import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const report={checkedAt:new Date().toISOString(),checks:[]};
for(const file of ['live-avatar.js','live-avatar.css','live-avatar.html']){
 const path=file==='live-avatar.html'?'live-avatar':file;
 const response=await fetch('https://electionclock.com/'+path,{cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('HTTP '+response.status+' '+path);
 const remote=Buffer.from(await response.arrayBuffer()),local=readFileSync('public/'+file);
 const digest=b=>createHash('sha256').update(b).digest('hex');
 if(digest(remote)!==digest(local))throw Error('Deployed asset differs: '+file);
 report.checks.push({file,sha256:digest(remote),result:'Worked'});
}
report.result='Worked';writeFileSync('docs/live-profile/production-retest/asset-identity.json',JSON.stringify(report,null,2));console.log('PASS public countdown assets match local build');
