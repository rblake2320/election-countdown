// Small server-drawn PNGs. No canvas, native binaries, image service, or paid API.
const FONT = {
  "0":"111101101101111", "1":"010110010010111", "2":"111001111100111", "3":"111001111001111",
  "4":"101101111001001", "5":"111100111001111", "6":"111100111101111", "7":"111001001001001",
  "8":"111101111101111", "9":"111101111001111", ":":"000010000010000", "-":"000000111000000",
  "D":"110101101101110", "A":"010101111101101", "Y":"101101010010010", "S":"111100111001111",
  "L":"100100100100111", "I":"111010010010111", "V":"101101101101010", "E":"111100110100111",
  "U":"101101101101111", "T":"111010010010010", "C":"111100100100111", "+":"000010111010000",
  "O":"111101101101111", "F":"111100110100100", "N":"101111111111101", " ":"000000000000000",
};
const crcTable = Uint32Array.from({length:256}, (_, n)=>{
  for(let k=0;k<8;k++) n = n & 1 ? 0xedb88320 ^ (n>>>1) : n>>>1;
  return n>>>0;
});
function chunk(type, data) {
  const result = new Uint8Array(data.length+12), view=new DataView(result.buffer);
  view.setUint32(0,data.length); result.set(new TextEncoder().encode(type),4); result.set(data,8);
  let crc=0xffffffff;
  for(const byte of result.subarray(4,-4)) crc=crcTable[(crc^byte)&255]^(crc>>>8);
  view.setUint32(result.length-4,(crc^0xffffffff)>>>0); return result;
}
const concat = parts => {const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length;}return out;};

export async function avatarPng(state, generatedAt=Date.now()) {
  const size=128, raw=new Uint8Array(size*(size*3+1));
  function pixel(x,y,color) { if(x<0||y<0||x>=size||y>=size)return;raw.set(color,y*(size*3+1)+1+x*3); }
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const distance=Math.hypot(x-63.5,y-63.5);
    pixel(x,y,distance>63?[11,24,43]:distance>60?[201,170,102]:[11,24,43]);
  }
  function text(value,y,scale,color=[245,241,232]) {
    const x0=Math.floor((size-(value.length*4-1)*scale)/2);
    [...value].forEach((char,i)=>{const glyph=FONT[char]||FONT[" "];for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(glyph[row*3+col]==="1")for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++)pixel(x0+(i*4+col)*scale+dx,y+row*scale+dy,color);});
  }
  if(!state) {text("OFF",48,5);}
  else {
    const seconds=Math.max(0,Math.floor((state.event.startMs-generatedAt)/1000));
    const days=Math.floor(seconds/86400);
    const pad=n=>String(n).padStart(2,"0");
    text(generatedAt>=state.event.endMs?"END":generatedAt>=state.event.startMs?"TODAY":String(days),25,days>999?4:5);
    text(generatedAt>=state.event.endMs?"END":generatedAt>=state.event.startMs?"LIVE":"DAYS",55,2,[201,170,102]);
    text(`${pad(Math.floor(seconds%86400/3600))}:${pad(Math.floor(seconds%3600/60))}:${pad(seconds%60)}`,73,3);
    const zone=new Intl.DateTimeFormat("en",{timeZone:state.ownerZone,timeZoneName:"shortOffset"}).formatToParts(state.event.startMs).find(p=>p.type==="timeZoneName").value.replace("GMT","UTC");
    text(zone,96,1); text("LIVE",109,1,[201,170,102]);
  }
  const header=new Uint8Array(13), view=new DataView(header.buffer);
  view.setUint32(0,size);view.setUint32(4,size);header[8]=8;header[9]=2;
  const compressed=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer());
  return concat([new Uint8Array([137,80,78,71,13,10,26,10]),chunk("IHDR",header),chunk("IDAT",compressed),chunk("IEND",new Uint8Array())]);
}

export function avatarStream(initialState, readState) {
  let stopped=false, timer, wake, state=initialState, lastRead=Date.now(), nextFrame=0;
  const encoder=new TextEncoder();
  const body=new ReadableStream({
    async pull(controller) {
      // Timers may wake just before the requested boundary. Recheck the clock so
      // an early wake cannot emit the previous second twice or spin extra frames.
      while(!stopped && Date.now()<nextFrame) {
        await new Promise(resolve=>{wake=resolve;timer=setTimeout(resolve,Math.max(1,nextFrame-Date.now()));});
      }
      if(stopped)return;
      try {
        if(Date.now()-lastRead>=5000) {state=await readState();lastRead=Date.now();}
        const generatedAt=Date.now();
        const png=await avatarPng(state,generatedAt);
        if(stopped)return;
        controller.enqueue(concat([encoder.encode(`--frame\r\nContent-Type: image/png\r\nContent-Length: ${png.length}\r\nX-Generated-At: ${generatedAt}\r\n\r\n`),png,encoder.encode("\r\n")]));
        nextFrame=(Math.floor(generatedAt/1000)+1)*1000;
        if(!state){controller.enqueue(encoder.encode("--frame--\r\n"));controller.close();stopped=true;}
      } catch(error) {stopped=true;controller.error(error);}
    },
    cancel(){stopped=true;clearTimeout(timer);wake?.();},
  });
  return new Response(body,{headers:{"content-type":"multipart/x-mixed-replace; boundary=frame","cache-control":"no-store, no-transform","x-content-type-options":"nosniff","x-accel-buffering":"no"}});
}
