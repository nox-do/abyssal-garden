import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('./', import.meta.url));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha256 = data => createHash('sha256').update(data).digest('hex');
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = [];
    ws.addEventListener('message', e => {
      const message = JSON.parse(e.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (pending) { this.pending.delete(message.id); clearTimeout(pending.timer); message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result); }
      } else for (const listener of this.listeners) listener(message);
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  async evaluate(session, expression, userGesture = false) {
    const response = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture }, session);
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  }
}

const timing = process.argv.includes('--timing');
const shipping = process.argv.includes('--shipping');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const cases = args.length ? args.map(s => s.split(':')) : ['0','1','2'].flatMap(q => (shipping?['product']:['baseline','organic']).map(n => [n,q]));
const report = { date:new Date().toISOString(), node:process.version, mode:shipping?'shipping':timing?'timing':'qa', viewport:{width:1280,height:720,deviceScaleFactor:1}, tests:[] };
const profile = await fs.mkdtemp(path.join(os.tmpdir(),'abyssal-visual-'));
const log = path.join(root,'results',timing?'chrome-timing.log':'chrome.log');
await fs.writeFile(log,'');
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
  '--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update',
  '--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1280,720','about:blank'
],{stdio:['ignore','pipe','pipe']});
for(const stream of [chrome.stdout,chrome.stderr]) stream.on('data',d=>fs.appendFile(log,d).catch(()=>{}));
let cdp;
const reportPath=path.join(root,'results',process.env.VISUAL_REPORT || (shipping?'shipping.json':timing?'timing.json':'browser.json'));
try {
  let endpoint;
  for(let i=0;i<100;i++) {
    try { const [port,suffix]=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');endpoint=`ws://127.0.0.1:${port}${suffix}`;break; } catch {}
    if(chrome.exitCode!==null) throw Error('Chrome exited '+chrome.exitCode);
    await sleep(100);
  }
  assert.ok(endpoint);
  const ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
  cdp=new CDP(ws);report.browser=await cdp.send('Browser.getVersion');
  for(const [name,q] of cases) {
    const level=Number(q);console.log('Starting '+name+' quality '+level);
    const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'});
    const {sessionId:s}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});
    const errors=[],requests=[];
    const listener=m=>{if(m.sessionId!==s)return;if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args);if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);};
    cdp.listeners.push(listener);
    try {
      for(const method of ['Page.enable','Runtime.enable','Network.enable'])await cdp.send(method,{},s);
      await cdp.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0},s);
      await cdp.send('Emulation.setDeviceMetricsOverride',{...report.viewport,mobile:false},s);
      await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`
        window.__start=performance.now();localStorage.abyssal='${level},921600,1';localStorage.abyssalLoad='';
        // Exercise dive-in/audio without capturing the user's physical mouse,
        // even when the test Chrome is headless on macOS.
        window.__pointerLockRequests=0;
        Element.prototype.requestPointerLock=function(){window.__pointerLockRequests++;return Promise.resolve()};
        const raf=requestAnimationFrame.bind(window);let pending=[];window.requestAnimationFrame=cb=>(pending.push(cb),pending.length);
        window.__resume=()=>{window.requestAnimationFrame=raf;for(const cb of pending.splice(0))raf(cb)};
        const NativeAudio=AudioContext;window.AudioContext=class extends NativeAudio{constructor(...args){super(...args);window.__audio=this}};
        window.__hashes={};window.__hashWorld=async function walk(obj,p='') {for(const [k,v] of Object.entries(obj)){const n=p?p+'.'+k:k;if(v instanceof ArrayBuffer||ArrayBuffer.isView(v)){const bytes=v instanceof ArrayBuffer?new Uint8Array(v):new Uint8Array(v.buffer,v.byteOffset,v.byteLength);const h=await crypto.subtle.digest('SHA-256',bytes);window.__hashes[n]={bytes:bytes.length,sha256:Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join('')};}else if(v&&typeof v==='object')await walk(v,n);}};
        window.__alloc={buffers:[],textures:[]};
        ${timing ? '' : `for(const [method,key] of [['createBuffer','buffers'],['createTexture','textures']]){const original=GPUDevice.prototype[method];GPUDevice.prototype[method]=function(d){window.__alloc[key].push(d);return original.call(this,d)}};`}
        window.__readyMs=null;addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{if(document.body.className==='m'&&window.__readyMs===null)window.__readyMs=performance.now()-window.__start}).observe(document.body,{attributes:true,attributeFilter:['class']}));
      `},s);
      await cdp.send('Page.navigate',{url:shipping?new URL('../../index.html',import.meta.url).href:pathToFileURL(path.join(root,'variants',`${name}-${timing?'timing':'qa'}.html`)).href},s);
      let state;
      for(let i=0;i<180;i++){state=await cdp.evaluate(s,`({ready:${shipping?"document.body?.className==='m'":"!!window.__visual"},body:document.body?.className||'',status:document.getElementById('s')?.textContent})`);if(state.ready||state.body.includes('e'))break;await sleep(1000);}
      assert.ok(state.ready,JSON.stringify({state,errors}));assert.deepEqual(errors,[]);
      if(!report.adapter) report.adapter=await cdp.evaluate(s,`(async()=>{const a=await navigator.gpu.requestAdapter();return {vendor:a.info.vendor,architecture:a.info.architecture,device:a.info.device,description:a.info.description}})()`);
      const result={name,level,readyMs:await cdp.evaluate(s,'window.__readyMs'),worldMs:await cdp.evaluate(s,'window.__worldMs'),errors,requests};
      report.tests.push(result);
      await cdp.evaluate(s,`document.getElementById('d').click();document.body.className='g';document.querySelector('canvas').style.cssText='transition:none;filter:none;transform:none;opacity:1';for(const id of ['m','o','i'])document.getElementById(id).style.display='none'`,true);
      result.pointerLockSuppressed=await cdp.evaluate(s,'window.__pointerLockRequests');
      assert.equal(await cdp.evaluate(s,'document.pointerLockElement===null'),true);
      await sleep(100);
      if(shipping) {
        assert.ok(result.pointerLockSuppressed>0);
        result.audio=await cdp.evaluate(s,'({state:window.__audio?.state,sampleRate:window.__audio?.sampleRate})');assert.equal(result.audio.state,'running');
        await cdp.evaluate(s,"window.__resume();dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}))");await sleep(200);
        await cdp.evaluate(s,"dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));dispatchEvent(new KeyboardEvent('keydown',{code:'KeyM'}));dispatchEvent(new KeyboardEvent('keydown',{code:'KeyM'}));dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}))");
        assert.equal(await cdp.evaluate(s,'document.body.className'),'m');await sleep(300);
      } else if(timing) {
        result.benchmarks=[];
        for(const pose of [0,3,5])result.benchmarks.push({pose,...await cdp.evaluate(s,`window.__visual.bench(${pose},120)`)});
      } else {
        result.hashes=await cdp.evaluate(s,'window.__hashes');result.allocations=await cdp.evaluate(s,'window.__alloc');result.views=[];
        const shot=async(label,pose,time)=>{
          const camera=await cdp.evaluate(s,`window.__visual.draw(${JSON.stringify(pose)},${time})`);
          assert.equal(camera.width,1280);assert.equal(camera.height,720);assert.equal(camera.detail,1);assert.equal(camera.level,level);
          const bytes=Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},s)).data,'base64');
          const file=`${name}-q${level}-${label}.png`;await fs.writeFile(path.join(root,'results',file),bytes);
          result.views.push({label,file,sha256:sha256(bytes),...camera});
        };
        for(let pose=0;pose<6;pose++)await shot('pose'+(pose+1),pose,8);
        // Same scene, closer by a known camera displacement along its view direction.
        const poses=await cdp.evaluate(s,'window.__visual.state().poses');
        for(const i of [0,3,5]){const p=poses[i],d=p.slice(3).map((v,k)=>v-p[k]),l=Math.hypot(...d);const close=p.map((v,k)=>k<3?v+d[k]/l*3:v);await shot('detail'+(i+1),close,8);}
        // Fixed camera temporal samples; dense enough to examine a half-second and wider phases.
        for(const t of [8+1/30,8+2/30,8.1,8.2,8.3,8.4,8.5,9,10])await shot('time'+t.toFixed(3),5,t);
        for(const t of [8+1/30,8+2/30,8.1,8.2,8.3,8.4,8.5,9,10])await shot('sponge-time'+t.toFixed(3),3,t);
        // Move camera through the existing leaf LOD boundaries, keeping time fixed.
        const p=poses[5];for(let k=0;k<12;k++){const close=p.map((v,i)=>i<3?v+(p[i+3]-v)/Math.hypot(...p.slice(3).map((x,j)=>x-p[j]))*k*.25:v);await shot('travel'+k,close,8);}
        await cdp.evaluate(s,'window.__visual.draw(0,8)');
        const before=await cdp.evaluate(s,'window.__visual.state()');const after=await cdp.evaluate(s,'window.__visual.move(30)');assert.notDeepEqual(before.camera,after.camera);result.movement={before,after};
        await cdp.evaluate(s,`dispatchEvent(new KeyboardEvent('keydown',{code:'KeyM'}));dispatchEvent(new KeyboardEvent('keydown',{code:'KeyM'}));dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}));`);
        assert.equal(await cdp.evaluate(s,'document.body.className'),'m');
        result.audio=await cdp.evaluate(s,'({state:window.__audio?.state,sampleRate:window.__audio?.sampleRate})');assert.equal(result.audio.state,'running');
        await cdp.evaluate(s,'window.__resume()');await sleep(500);assert.deepEqual(errors,[]);
      }
      assert.deepEqual(requests.filter(u=>/^https?:/.test(u)),[]);assert.deepEqual(errors,[]);
      console.log(JSON.stringify({name,level,readyMs:result.readyMs,worldMs:result.worldMs,views:result.views?.length,benchmarks:result.benchmarks?.length}));
      await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
    } finally {cdp.listeners=cdp.listeners.filter(l=>l!==listener);await cdp.send('Target.closeTarget',{targetId});}
  }
  if(!timing&&!shipping) for(const test of report.tests) {
    const base=report.tests.find(t=>t.name==='baseline'&&t.level===test.level);if(!base)continue;
    assert.deepEqual(test.hashes,base.hashes,'Generated world/meshes changed');
    assert.deepEqual(test.allocations,base.allocations,'GPU resource descriptors changed');
    assert.deepEqual(test.views.map(v=>[v.camera,v.time,v.width,v.height,v.detail]),base.views.map(v=>[v.camera,v.time,v.width,v.height,v.detail]));
    assert.deepEqual(test.movement,base.movement);test.sameWorldAndAllocations=true;
  }
} finally {
  await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  if(cdp){try{await cdp.send('Browser.close');}catch{}cdp.ws.close();}if(chrome.exitCode===null)chrome.kill();
  await sleep(250);await fs.rm(profile,{recursive:true,force:true,maxRetries:3}).catch(()=>{});
}

