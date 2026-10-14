import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const base=process.argv[2];
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local only');
const {id}=JSON.parse(readFileSync('.local/live-profile-restart.json','utf8'));
const headers={'CF-Connecting-IP':`198.51.100.${Math.floor(Math.random()*200)+1}`};
assert.equal((await fetch(`${base}/api/live-profiles/${id}.png`,{headers})).status,200);
let denied=0;
for(let i=0;i<120;i++) {
  const response=await fetch(`${base}/api/live-profiles/00000000-0000-0000-0000-000000000000.png`,{headers});
  assert.ok([404,429].includes(response.status));
  if(response.status===429)denied++;
}
assert.ok(denied>0);
assert.equal((await fetch(`${base}/api/live-profiles/${id}.png`,{headers})).status,429);
assert.equal((await fetch(`${base}/api/live-profiles/${id}.png`,{headers:{'CF-Connecting-IP':'203.0.113.252'}})).status,200);
writeFileSync('docs/live-profile/image-limits.json',JSON.stringify({result:'Worked',attempts:122,denied,otherClient:'Worked',description:'Real local D1-backed read rate limit and independent active control'},null,2));
console.log('PASS image read rate limit and independent active control');
