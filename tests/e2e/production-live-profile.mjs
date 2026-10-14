// Explicit production acceptance for the existing, clearly labeled test identity.
// No accounts/posts are created. Credentials stay in process memory. Restore settings in finally.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const ai='https://aihangout.ai', ec='https://electionclock.com';
const username='live_countdown_test', email='live-countdown-test-20261014@example.invalid';
const id='d7d3e530-9b0b-4b54-a162-31dbc7445f3a', problemId=290;
const password=process.env.LIVE_PROFILE_TEST_PASSWORD;
if(!password)throw Error('Provide the existing test password through LIVE_PROFILE_TEST_PASSWORD');
const report={started:new Date().toISOString(),profileUrl:`${ai}/profile/${username}`,postUrl:`${ai}/problem/${problemId}`,checks:[],errors:[]};
const out='docs/live-profile/production-retest';mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
const owner=await browser.newContext({viewport:{width:1360,height:950}});
const pass=(name,details={})=>{report.checks.push({name,result:'Worked',...details});console.log('PASS',name);};
let baseline, originalLink, aiToken;
async function checked(response){assert.ok(response.ok(),`HTTP ${response.status()} ${response.url()}`);return response.json();}
async function readOwner(){return checked(await owner.request.get(ec+'/api/account/live-profile'));}
async function changeZone(zone,reporterId){const current=await readOwner();return checked(await owner.request.put(ec+'/api/account/live-profile',{headers:{Origin:ec},data:{enabled:baseline.enabled,electionId:baseline.event.id,ownerZone:zone,reporterId,version:current.version,takeover:true}}));}
async function imagesReady(page,count){await page.waitForFunction(({id,count})=>{const images=[...document.querySelectorAll(`img[data-live-profile="${id}"]`)];return images.length===count&&images.every(i=>i.naturalWidth===128);},{id,count},{timeout:30000});}
async function motion(page,index=0){const hashes=[];for(let n=0;n<4;n++){hashes.push(createHash('sha256').update(await page.locator(`img[data-live-profile="${id}"]`).nth(index).screenshot()).digest('hex'));await page.waitForTimeout(1600);}assert.ok(new Set(hashes).size>=3,'Image must visibly progress');return {uniqueFrames:new Set(hashes).size,samples:hashes.length};}
try{
  await checked(await owner.request.post(ec+'/api/auth/login',{headers:{Origin:ec},data:{email,password}}));
  baseline=await readOwner();assert.equal(baseline.id,id);assert.equal(baseline.enabled,true);
  const login=await checked(await owner.request.post(ai+'/api/auth/login',{data:{email,password}}));
  assert.equal(login.user.username,username);aiToken=login.token;
  originalLink=(await checked(await owner.request.get(`${ai}/api/users/by-username/${username}/live-profile`))).profileId;
  assert.equal(originalLink,id);
  // Save non-secret state for recovery if the test process itself is interrupted.
  writeFileSync('.local/production-retest-baseline.json',JSON.stringify({baseline,originalLink}));
  const post=await checked(await owner.request.get(`${ai}/api/problems/${problemId}`));
  assert.equal(post.problem.username,username);assert.equal(post.solutions[0].username,username);
  assert.ok(Date.parse(post.problem.created_at+'Z')<Date.parse(report.started));
  assert.ok(Date.parse(post.solutions[0].created_at+'Z')<Date.parse(report.started));
  pass('Existing test question and answer predate this deployment verification',{questionCreated:post.problem.created_at,answerCreated:post.solutions[0].created_at,answerId:post.solutions[0].id});
  const page=await owner.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/Content Security Policy|Refused to/i.test(m.text()))report.errors.push(m.text());});
  await page.goto(ai+'/login');await page.getByLabel('Email address').fill(email);await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(ai+'/');
  await page.goto(ai+'/settings');
  assert.equal(await page.getByRole('link',{name:'Election Countdown profile settings'}).getAttribute('href'),ec+'/#/profile');
  await page.goto(report.profileUrl);await imagesReady(page,1);const profileMotion=await motion(page);
  await page.screenshot({path:out+'/profile.png',fullPage:true});
  pass('Public profile visibly ticks in the deployed application',profileMotion);
  await page.goto(report.postUrl);await imagesReady(page,2);
  const questionMotion=await motion(page,0),answerMotion=await motion(page,1);
  await page.screenshot({path:out+'/old-post.png',fullPage:true});
  pass('Earlier question and answer both visibly tick',{question:questionMotion,answer:answerMotion});
  // Fresh anonymous contexts use different device zones; the owner controls the shared state.
  const viewers=[];
  for(const timezoneId of ['Asia/Tokyo','America/New_York','UTC']){
    const context=await browser.newContext({timezoneId,viewport:{width:1280,height:900}});
    const avatar=await context.newPage();await avatar.goto(`${ec}/live-avatar?id=${id}`);
    await avatar.locator('#avatar[data-status="live"]').waitFor({timeout:30000});
    viewers.push({context,avatar});
  }
  const states=await Promise.all(viewers.map(({avatar})=>avatar.locator('#avatar').evaluate(e=>({...e.dataset}))));
  const remaining=states.map(s=>Number(s.remaining)), clocks=states.map(s=>Number(s.serverNow));
  assert.ok(Math.max(...remaining)-Math.min(...remaining)<=1);assert.ok(Math.max(...clocks)-Math.min(...clocks)<1000);
  assert.ok(states.every(s=>s.ownerZone===baseline.ownerZone));
  pass('Three public viewers share the current countdown despite different device zones',{remaining,clockSpreadMs:Math.max(...clocks)-Math.min(...clocks)});
  const anonymous=await viewers[0].context.newPage();await anonymous.goto(report.postUrl);await imagesReady(anonymous,2);
  pass('Logged-out visitor sees live avatars on the earlier question and answer');
  const zoneClip=async()=>{const b=await page.locator(`img[data-live-profile="${id}"]`).nth(1).boundingBox();return page.screenshot({clip:{x:Math.floor(b.x),y:Math.floor(b.y+b.height*95/128),width:Math.ceil(b.width),height:Math.ceil(b.height*8/128)}});};
  const before=await zoneClip(), alternate=baseline.ownerZone==='America/New_York'?'America/Chicago':'America/New_York';
  const changedAt=performance.now(),updated=await changeZone(alternate,crypto.randomUUID());
  assert.equal(updated.event.startMs,baseline.event.startMs);
  await Promise.all(viewers.map(({avatar})=>avatar.locator(`#avatar[data-owner-zone="${alternate}"]`).waitFor({timeout:15000})));
  await page.waitForTimeout(6000);assert.notDeepEqual(await zoneClip(),before);
  pass('Owner zone update reaches already-open avatars without changing the deadline',{ownerZone:alternate,deadline:updated.event.startMs,observedWithinMs:performance.now()-changedAt});
  await changeZone(baseline.ownerZone,baseline.reporterId);
  await page.goto(ai+'/settings');await page.getByRole('button',{name:'Remove countdown',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Live countdown removed'}).waitFor();
  await page.goto(report.postUrl);await page.getByRole('heading',{name:'[TEST] Live profile countdown',exact:true}).waitFor();
  await page.waitForTimeout(1500);assert.equal(await page.locator('img[data-live-profile]').count(),0);
  await page.goto(ai+'/settings');await page.getByLabel('Live avatar URL').fill(`${ec}/live-avatar?id=${id}`);
  await page.getByRole('button',{name:'Link countdown',exact:true}).click();await page.getByRole('status').filter({hasText:'Live countdown linked'}).waitFor();
  await page.goto(report.postUrl);await imagesReady(page,2);
  pass('Removing and relinking through settings updates both older placements');
  await owner.setOffline(true);await page.waitForTimeout(35000);
  assert.equal(await page.locator('img[data-live-profile]').count(),0);
  await owner.setOffline(false);await imagesReady(page,2);const recovered=await motion(page,1);
  pass('35-second network outage falls back to initials and recovers to a ticking older answer',recovered);
  await page.screenshot({path:out+'/old-post-recovered.png',fullPage:true});
  const settings=await owner.newPage();await settings.goto(ec+'/#/profile');
  const frame=settings.frameLocator('iframe[title="Your live countdown avatar"]');
  await frame.locator('#avatar[data-status="live"]').waitFor({timeout:30000});
  assert.match(await frame.locator('#avatar').getAttribute('aria-label'),new RegExp(baseline.ownerZone));
  await settings.screenshot({path:out+'/owner-settings.png',fullPage:true});
  pass('Fresh authenticated countdown settings renders a live owner preview');
  assert.deepEqual(report.errors,[]);report.result='Worked';
}catch(error){report.result='Failed';report.failure=error.stack;process.exitCode=1;console.error(error.message);}
finally{
  try{
    await owner.setOffline(false);
    if(baseline){const restored=await changeZone(baseline.ownerZone,baseline.reporterId);assert.equal(restored.ownerZone,baseline.ownerZone);assert.equal(restored.reporterId,baseline.reporterId);}
    if(aiToken&&originalLink){await checked(await owner.request.put(ai+'/api/users/me/live-profile',{headers:{Authorization:`Bearer ${aiToken}`},data:{profileId:originalLink}}));const linked=await checked(await owner.request.get(`${ai}/api/users/by-username/${username}/live-profile`));assert.equal(linked.profileId,originalLink);}
    report.restoration='Worked';
  }catch(error){report.restoration='Failed';report.restorationError=error.message;report.result='Failed';process.exitCode=1;}
  report.finished=new Date().toISOString();await browser.close();writeFileSync(out+'/acceptance.json',JSON.stringify(report,null,2));
}
