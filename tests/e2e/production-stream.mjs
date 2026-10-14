import {writeFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import assert from 'node:assert/strict';
const base='https://electionclock.com/api/live-profiles/d7d3e530-9b0b-4b54-a162-31dbc7445f3a';
const report={started:new Date().toISOString(),url:base+'.stream',frames:0,bytes:0,maxFrameAgeMs:0,decodedClockMismatches:0};
const font=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
const controller=new AbortController();let reader;
try{
 const state=await(await fetch(base)).json();
 const r=await fetch(base+'.stream',{signal:controller.signal});assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/multipart\/x-mixed-replace/);
 reader=r.body.getReader();let rest=Buffer.alloc(0);const began=performance.now(),seconds=new Set();
 while(performance.now()-began<60000){const {value,done}=await reader.read();if(done)break;report.bytes+=value.length;rest=Buffer.concat([rest,value]);
  while(true){const split=rest.indexOf('\r\n\r\n');if(split<0)break;const hdr=rest.subarray(0,split).toString();const length=Number(hdr.match(/Content-Length: (\d+)/)?.[1]);const generatedAt=Number(hdr.match(/X-Generated-At: (\d+)/)?.[1]);assert.ok(length&&generatedAt);if(rest.length<split+4+length+2)break;
   const png=rest.subarray(split+4,split+4+length);assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
   const idat=[];for(let pos=8;pos<png.length;){const size=png.readUInt32BE(pos);if(png.subarray(pos+4,pos+8).toString()==='IDAT')idat.push(png.subarray(pos+8,pos+8+size));pos+=size+12;}
   const pixels=inflateSync(Buffer.concat(idat));assert.equal(pixels.length,128*(128*3+1));
   function digit(i){let bits='';for(let row=0;row<5;row++)for(let col=0;col<3;col++){const x=17+i*12+col*3+1,y=73+row*3+1,p=y*(128*3+1)+1+x*3;bits+=pixels[p]>180&&pixels[p+1]>180&&pixels[p+2]>180?'1':'0';}const v=font.indexOf(bits);assert.ok(v>=0);return v;}
   const clock=(digit(0)*10+digit(1))*3600+(digit(3)*10+digit(4))*60+digit(6)*10+digit(7);
   const expected=Math.max(0,Math.floor((state.event.startMs-generatedAt)/1000))%86400;if(clock!==expected)report.decodedClockMismatches++;
   report.frames++;seconds.add(Math.floor(generatedAt/1000));report.maxFrameAgeMs=Math.max(report.maxFrameAgeMs,Date.now()-generatedAt);rest=rest.subarray(split+4+length+2);
  }
 }
 report.durationMs=performance.now()-began;report.uniqueSeconds=seconds.size;
 assert.equal(report.frames,seconds.size);assert.ok(report.frames>=55);assert.ok(report.maxFrameAgeMs<2000);assert.equal(report.decodedClockMismatches,0);report.result='Worked';
}catch(e){report.result='Failed';report.error=e.message;process.exitCode=1;}
finally{await reader?.cancel();controller.abort();report.finished=new Date().toISOString();writeFileSync('docs/live-profile/production-stream-20261014.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
