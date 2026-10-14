import { chromium, firefox } from "playwright";
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const base=process.argv[2];
if(!["127.0.0.1","localhost"].includes(new URL(base).hostname))throw new Error("Local only");
const {id}=JSON.parse(readFileSync(".local/live-profile-restart.json","utf8"));
const url=`${base}/api/live-profiles/${id}.stream`;
const report={base,started:new Date().toISOString(),checks:[]};
const host=createServer((req,res)=>{res.writeHead(200,{"content-type":"text/html"});res.end(`<!doctype html><html><body style="background:#edf1f7;font:20px Georgia;padding:40px"><h1>Plain image slot</h1><p>JavaScript disabled. One image URL receiving changing frames.</p><img src="${url}" alt="Live countdown" width="256" height="256" style="border-radius:50%"><p>Local frame-stream compatibility experiment</p></body></html>`);});
await new Promise(resolve=>host.listen(0,"127.0.0.1",resolve));
const engine=process.argv[3]||"chromium";
if(!["chromium","firefox"].includes(engine))throw new Error("Unknown test browser");
const browser=await ({chromium,firefox}[engine]).launch(engine === "firefox" && process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE} : {});
try {
  const context=await browser.newContext({javaScriptEnabled:false});
  const page=await context.newPage();
  // Decode screenshots in a separate blank page. The image host itself has JS disabled.
  const decoder=await browser.newPage();
  const state=await (await fetch(`${base}/api/live-profiles/${id}`)).json();
  await page.goto(`http://127.0.0.1:${host.address().port}/`,{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(2000);
  const hashes=[], observations=[];
  for(let i=0;i<6;i++) {
    const png=await page.locator("img").screenshot({timeout:10000});
    hashes.push(createHash("sha256").update(png).digest("hex"));
    const observedAt=Date.now();
    const visibleClock=await decoder.evaluate(async encoded=>{
      const image=new Image();image.src='data:image/png;base64,'+encoded;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,image.width,image.height).data;
      const font=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
      const scale=image.width/128;
      const digit=index=>{
        let bits='';for(let row=0;row<5;row++)for(let col=0;col<3;col++){
          const x=Math.floor((17+index*12+col*3+1)*scale),y=Math.floor((73+row*3+1)*scale);
          const p=(y*image.width+x)*4;bits+=data[p]>180&&data[p+1]>180&&data[p+2]>180?'1':'0';
        }
        const value=font.indexOf(bits);if(value<0)throw new Error('Visible countdown digit is unreadable: '+bits);return value;
      };
      return (digit(0)*10+digit(1))*3600+(digit(3)*10+digit(4))*60+digit(6)*10+digit(7);
    },png.toString('base64'));
    const expected=Math.max(0,Math.floor((state.event.startMs-observedAt)/1000))%86400;
    const lag=((visibleClock-expected+43200)%86400+86400)%86400-43200;
    observations.push({visibleClockSeconds:visibleClock,expectedSeconds:expected,lagSeconds:lag});
    assert.ok(lag>=-1&&lag<=2,`Visible countdown is ${lag} seconds behind server time`);
    await page.waitForTimeout(1200);
  }
  // Arrival and paint cadence can repeat a screenshot at an arbitrary sample instant.
  // Require visible progress AND independently decoded digits within the declared two-second bound.
  assert.ok(new Set(hashes).size>=4,"The visible image must keep progressing");
  await page.screenshot({path:"docs/live-profile/plain-image-stream.png"});
  report.checks.push({name:"Plain cross-origin image with JavaScript disabled",result:"Worked",browser:browser.version(),uniqueFrames:new Set(hashes).size,observations,hashes});
  const controller=new AbortController();
  const response=await fetch(url,{signal:controller.signal});
  assert.match(response.headers.get("content-type"),/multipart\/x-mixed-replace/);
  const reader=response.body.getReader();
  let bytes=0,frames=0,maxAge=0,rest=Buffer.alloc(0),began=performance.now();
  const seconds=new Set();
  while(performance.now()-began<60000) {
    const {value,done}=await reader.read();if(done)break;bytes+=value.length;rest=Buffer.concat([rest,value]);
    while(true){const boundary=rest.indexOf("\r\n\r\n");if(boundary<0)break;
      const headers=rest.subarray(0,boundary).toString();
      const length=Number(headers.match(/Content-Length: (\d+)/)?.[1]);
      const generatedAt=Number(headers.match(/X-Generated-At: (\d+)/)?.[1]);
      if(!length||!generatedAt)throw new Error("Invalid frame headers");
      if(rest.length<boundary+4+length+2)break;
      assert.deepEqual([...rest.subarray(boundary+4,boundary+12)],[137,80,78,71,13,10,26,10]);
      frames++;seconds.add(Math.floor(generatedAt/1000));maxAge=Math.max(maxAge,Date.now()-generatedAt);rest=rest.subarray(boundary+4+length+2);
    }
  }
  await reader.cancel();controller.abort();
  report.measurement={frames,uniqueSeconds:seconds.size,bytes,maxFrameAgeMs:maxAge,durationMs:performance.now()-began};
  assert.equal(frames,seconds.size,"Early timer wakes must not produce duplicate-second frames");
  assert.ok(frames>=55, `Only ${frames} frames arrived in the one-minute window`);assert.ok(maxAge<2000);
  report.checks.push({name:"One-minute frame delivery and client cancellation",result:"Worked",frames,bytes,maxFrameAgeMs:maxAge,durationMs:performance.now()-began});
  report.result="Worked";
} catch(error){report.result="Failed";report.failure=error.stack;process.exitCode=1;console.error(error);}
finally{await browser.close();host.close();writeFileSync(`docs/live-profile/image-slot-${engine}.json`,JSON.stringify(report,null,2));}
