// Owner-authorized production test: two named test accounts, mutual follow vs no relationship.
// No posts are created. Tokens/passwords remain in memory. Countdown settings restore in finally.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const ai='https://aihangout.ai',ec='https://electionclock.com';
const ownerName='live_countdown_test',ownerEmail='live-countdown-test-20261014@example.invalid';
const profileId='d7d3e530-9b0b-4b54-a162-31dbc7445f3a';
const definitions=[
  {role:'friend',username:'countdown_friend_test',email:'countdown-friend-test-20261014@example.invalid',password:process.env.LIVE_FRIEND_PASSWORD,timezoneId:'America/Chicago'},
  {role:'nonfriend',username:'countdown_stranger_test',email:'countdown-stranger-test-20261014@example.invalid',password:process.env.LIVE_STRANGER_PASSWORD,timezoneId:'Asia/Tokyo'},
];
if(!process.env.LIVE_PROFILE_TEST_PASSWORD||definitions.some(v=>!v.password))throw Error('Process-only test passwords are required');
const out='docs/live-profile/friend-visibility',privateDir='.local/friend-visibility';
mkdirSync(out,{recursive:true});mkdirSync(privateDir,{recursive:true});
const accountsFile=privateDir+'/accounts.json';
const accounts=existsSync(accountsFile)?JSON.parse(readFileSync(accountsFile,'utf8').replace(/^\uFEFF/,'')):{};
const report={started:new Date().toISOString(),owner:ownerName,profileUrl:ai+'/profile/'+ownerName,postUrl:ai+'/problem/290',relationshipMeaning:'Mutual follows represent the requested friend; nonfriend has neither follow direction.',checks:[],errors:[]};
const pass=(name,detail={})=>{report.checks.push({name,result:'Worked',...detail});console.log('PASS',name);};
const browser=await chromium.launch();const ownerContext=await browser.newContext();
let baseline,ownerAuth;const viewers=[];
const auth=t=>({Authorization:`Bearer ${t}`});
async function checked(r){assert.ok(r.ok(),`${r.status()} ${r.url()}`);return r.json();}
async function ownerState(){return checked(await ownerContext.request.get(ec+'/api/account/live-profile'));}
async function update(enabled,ownerZone,reporterId){const current=await ownerState();return checked(await ownerContext.request.put(ec+'/api/account/live-profile',{headers:{Origin:ec},data:{enabled,electionId:baseline.event.id,ownerZone,reporterId,version:current.version,takeover:true}}));}
async function follows(token,target){return (await checked(await ownerContext.request.get(`${ai}/api/users/${target}/is-following`,{headers:auth(token)}))).following;}
async function follow(token,target){if(!await follows(token,target)){const r=await checked(await ownerContext.request.post(`${ai}/api/users/${target}/follow`,{headers:auth(token),data:{}}));assert.equal(r.following,true);}assert.equal(await follows(token,target),true);}
async function ready(page,count){await page.waitForFunction(({id,count})=>{const images=[...document.querySelectorAll(`img[data-live-profile="${id}"]`)];return images.length===count&&images.every(i=>i.naturalWidth===128);},{id:profileId,count},{timeout:45000});}
const hash=b=>createHash('sha256').update(b).digest('hex');
async function zonePixels(page,index){const b=await page.locator(`img[data-live-profile="${profileId}"]`).nth(index).boundingBox();return hash(await page.screenshot({clip:{x:Math.floor(b.x),y:Math.floor(b.y+b.height*95/128),width:Math.ceil(b.width),height:Math.ceil(b.height*8/128)}}));}
try{
  const ownerLogin=await checked(await ownerContext.request.post(ai+'/api/auth/login',{data:{email:ownerEmail,password:process.env.LIVE_PROFILE_TEST_PASSWORD}}));
  assert.equal(ownerLogin.user.username,ownerName);ownerAuth=ownerLogin;
  await checked(await ownerContext.request.post(ec+'/api/auth/login',{headers:{Origin:ec},data:{email:ownerEmail,password:process.env.LIVE_PROFILE_TEST_PASSWORD}}));
  baseline=await ownerState();assert.equal(baseline.id,profileId);assert.equal(baseline.enabled,true);
  const link=await checked(await ownerContext.request.get(`${ai}/api/users/by-username/${ownerName}/live-profile`));assert.equal(link.profileId,profileId);
  writeFileSync(privateDir+'/baseline.json',JSON.stringify({baseline,ownerId:ownerAuth.user.id}));
  for(const definition of definitions){
    let signed;
    if(!accounts[definition.role]){
      const registration=await ownerContext.request.post(ai+'/api/auth/register',{data:{username:definition.username,email:definition.email,password:definition.password,aiAgentType:'human'}});
      // An interrupted prior registration can have committed; login safely to the same identity.
      if(registration.status()===409) signed=await checked(await ownerContext.request.post(ai+'/api/auth/login',{data:{email:definition.email,password:definition.password}}));
      else signed=await checked(registration);
      assert.equal(signed.user.username,definition.username);
      accounts[definition.role]={id:signed.user.id,username:definition.username,email:definition.email};
      writeFileSync(accountsFile,JSON.stringify(accounts,null,2));
    }
    const context=await browser.newContext({timezoneId:definition.timezoneId,viewport:{width:1360,height:950}});
    viewers.push({...definition,context,id:accounts[definition.role].id});
  }
  assert.notEqual(viewers[0].id,viewers[1].id);assert.notEqual(viewers[0].id,ownerAuth.user.id);
  // Authenticate each viewer exactly once through the real sign-in form.
  for(const viewer of viewers){
    const page=await viewer.context.newPage();viewer.profile=page;
    page.on('pageerror',e=>report.errors.push({viewer:viewer.role,message:e.message}));
    await page.goto(ai+'/login',{waitUntil:'domcontentloaded'});
    await page.getByLabel('Email address').fill(viewer.email);await page.getByLabel('Password',{exact:true}).fill(viewer.password);
    const responsePromise=page.waitForResponse(r=>r.url()===ai+'/api/auth/login'&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    const response=await responsePromise;report.checks.push({name:`${viewer.role} browser sign-in`,status:response.status(),result:response.ok()?'Worked':'Failed'});
    const signed=await checked(response);assert.equal(signed.user.username,viewer.username);assert.equal(signed.user.id,viewer.id);viewer.token=signed.token;
    await page.waitForURL(ai+'/',{waitUntil:'domcontentloaded'});
  }
  await follow(viewers[0].token,ownerAuth.user.id);await follow(ownerAuth.token,viewers[0].id);
  assert.equal(await follows(viewers[1].token,ownerAuth.user.id),false);
  assert.equal(await follows(ownerAuth.token,viewers[1].id),false);
  report.accounts=viewers.map(v=>({role:v.role,username:v.username,id:v.id,profileUrl:ai+'/profile/'+v.username}));
  pass('Two distinct viewer accounts: mutual follow and no relationship',{relationships:{friendToOwner:true,ownerToFriend:true,nonfriendToOwner:false,ownerToNonfriend:false}});
  for(const viewer of viewers){
    const page=viewer.profile;
    await page.goto(report.profileUrl,{waitUntil:'domcontentloaded'});await ready(page,1);
    await page.getByRole('link',{name:new RegExp(viewer.username+' .*reputation')}).waitFor();
    await page.getByRole('heading',{name:ownerName,exact:true}).locator('..').getByRole('button',{name:viewer.role==='friend'?'Unfollow':'Follow',exact:true}).waitFor();
    viewer.profile=page;viewer.post=await viewer.context.newPage();
    await viewer.post.goto(report.postUrl,{waitUntil:'domcontentloaded'});await ready(viewer.post,2);
    await viewer.profile.screenshot({path:`${out}/${viewer.role}-profile.png`,fullPage:true});
    await viewer.post.screenshot({path:`${out}/${viewer.role}-old-post.png`,fullPage:true});
  }
  const targets=viewers.flatMap(v=>[{viewer:v.role,surface:'profile',page:v.profile,index:0},{viewer:v.role,surface:'question',page:v.post,index:0},{viewer:v.role,surface:'answer',page:v.post,index:1}]);
  for(const t of targets)t.hashes=[];
  for(let sample=0;sample<4;sample++){
    for(const t of targets)t.hashes.push(hash(await t.page.locator(`img[data-live-profile="${profileId}"]`).nth(t.index).screenshot()));
    await new Promise(r=>setTimeout(r,1600));
  }
  const motion=targets.map(t=>({viewer:t.viewer,surface:t.surface,uniqueFrames:new Set(t.hashes).size}));
  assert.ok(motion.every(m=>m.uniqueFrames>=3));pass('Friend and nonfriend see ticking avatars on profile, existing question and answer',{motion});
  for(const t of targets)t.zoneBefore=await zonePixels(t.page,t.index);
  const alternate=baseline.ownerZone==='America/New_York'?'America/Chicago':'America/New_York';
  const reporter=crypto.randomUUID(),changeStart=performance.now();const changed=await update(true,alternate,reporter);
  assert.equal(changed.event.startMs,baseline.event.startMs);
  for(const t of targets){
    while(performance.now()-changeStart<20000){if(await zonePixels(t.page,t.index)!==t.zoneBefore){t.zoneLatencyMs=performance.now()-changeStart;break;}await new Promise(r=>setTimeout(r,250));}
    assert.ok(t.zoneLatencyMs,`${t.viewer} ${t.surface} zone pixels did not change`);
  }
  pass('Owner zone change visibly reaches all six mounted avatars without reloading',{ownerZone:alternate,deadlineUnchanged:true,observations:targets.map(t=>({viewer:t.viewer,surface:t.surface,observedWithinMs:t.zoneLatencyMs}))});
  for(const v of viewers)await v.profile.screenshot({path:`${out}/${v.role}-changed-zone.png`,fullPage:true});
  const offStart=performance.now();await update(false,alternate,reporter);
  for(const v of viewers)for(const page of [v.profile,v.post])await page.waitForFunction(()=>document.querySelectorAll('img[data-live-profile]').length===0,null,{timeout:45000});
  const publicOff=await ownerContext.request.get(ec+'/api/live-profiles/'+profileId);assert.equal(publicOff.status(),404);
  pass('Turning the owner countdown off removes live images for both relationships',{observedWithinMs:performance.now()-offStart});
  for(const v of viewers)await v.post.screenshot({path:`${out}/${v.role}-off.png`,fullPage:true});
  const onStart=performance.now();await update(true,baseline.ownerZone,baseline.reporterId);
  for(const v of viewers){await ready(v.profile,1);await ready(v.post,2);}
  pass('Turning it back on restores both viewers without page reload',{observedWithinMs:performance.now()-onStart});
  for(const v of viewers)await v.post.screenshot({path:`${out}/${v.role}-restored.png`,fullPage:true});
  assert.equal(await follows(viewers[0].token,ownerAuth.user.id),true);assert.equal(await follows(ownerAuth.token,viewers[0].id),true);
  assert.equal(await follows(viewers[1].token,ownerAuth.user.id),false);assert.equal(await follows(ownerAuth.token,viewers[1].id),false);
  pass('Friend and nonfriend relationships remain distinct after the display changes');
  assert.deepEqual(report.errors,[]);report.result='Worked';
}catch(error){report.result='Failed';report.failure=error.stack;process.exitCode=1;console.error(error.message);}
finally{
  try{if(baseline){const restored=await update(baseline.enabled,baseline.ownerZone,baseline.reporterId);assert.equal(restored.ownerZone,baseline.ownerZone);assert.equal(restored.enabled,baseline.enabled);assert.equal(restored.reporterId,baseline.reporterId);report.restoration='Worked';}}
  catch(error){report.restoration='Failed';report.restorationError=error.message;report.result='Failed';process.exitCode=1;}
  report.finished=new Date().toISOString();await browser.close();writeFileSync(out+'/acceptance.json',JSON.stringify(report,null,2));
}
