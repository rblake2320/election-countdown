import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {avatarPng,avatarStream} from '../lib/avatar-image.js';

function pixels(png){
  const blocks=[];let pos=8;
  while(pos<png.length){const length=new DataView(png.buffer,png.byteOffset+pos,4).getUint32(0);const kind=new TextDecoder().decode(png.subarray(pos+4,pos+8));if(kind==='IDAT')blocks.push(png.subarray(pos+8,pos+8+length));pos+=length+12;}
  return inflateSync(Buffer.concat(blocks));
}
const state={ownerZone:'America/Chicago',event:{startMs:Date.parse('2026-11-03T05:00:00Z'),endMs:Date.parse('2026-11-04T06:00:00Z')}};
test('zone affects the zone label pixels while a fixed deadline keeps the digits identical',async()=>{
  const now=Date.parse('2026-10-14T12:00:00Z');
  const a=pixels(await avatarPng(state,now)),b=pixels(await avatarPng({...state,ownerZone:'America/New_York'},now));
  assert.deepEqual(a.subarray(0,96*385),b.subarray(0,96*385));
  assert.notDeepEqual(a.subarray(96*385,102*385),b.subarray(96*385,102*385));
});
test('upcoming, event day, finished and disabled frames are distinct valid PNGs',async()=>{
  const frames=await Promise.all([avatarPng(state,state.event.startMs-10000),avatarPng(state,state.event.startMs),avatarPng(state,state.event.endMs),avatarPng(null)]);
  for(const frame of frames)assert.equal(pixels(frame).length,128*385);
  assert.equal(new Set(frames.map(f=>Buffer.from(f).toString('base64'))).size,4);
});
test('cancelling the stream stops pending frame generation and state reads',async()=>{
  let reads=0;const stream=avatarStream(state,async()=>{reads++;return state;});
  const reader=stream.body.getReader();await reader.read();await reader.cancel();
  await new Promise(resolve=>setTimeout(resolve,5500));assert.equal(reads,0);
});
