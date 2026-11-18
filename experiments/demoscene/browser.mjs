import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { CDP } from './cdp.mjs';
const root = fileURLToPath(new URL('./', import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const timing = process.argv.includes('--timing'), quick = process.argv.includes('--quick'), shipping = process.argv.includes('--shipping');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const cases = args.length ? args.map(a => a.split(':')) : [0,1,2].flatMap(q => (shipping ? ['product'] : ['baseline','shadow16-bias0']).map(n => [n,q]));
const report = { date: new Date().toISOString(), mode: shipping ? 'shipping' : timing ? 'timing' : 'qa', quick, viewport: { width:1280,height:720,deviceScaleFactor:1 }, tests:[] };
const output = path.join(root, 'results', process.env.DEMO_REPORT || (shipping ? 'shipping.json' : timing ? 'timing.json' : quick ? 'screen.json' : 'browser.json'));
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'abyssal-demo-'));
const log = path.join(root, 'results', 'chrome-' + report.mode + '.log');
await fs.writeFile(log, '');
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update',
  '--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1280,720','about:blank'
], { stdio:['ignore','pipe','pipe'] });
for (const stream of [chrome.stdout,chrome.stderr]) stream.on('data',d=>fs.appendFile(log,d).catch(()=>{}));
let cdp;
try {
  let endpoint;
  for(let i=0;i<100;i++) { try { const [port,suffix]=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');endpoint=`ws://127.0.0.1:${port}${suffix}`;break; }catch{} if(chrome.exitCode!==null)throw Error('Chrome exit '+chrome.exitCode);await sleep(100); }
  assert.ok(endpoint,'No test Chrome endpoint');
  const ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
  cdp=new CDP(ws);report.browser=await cdp.send('Browser.getVersion');
  for(const [name,q] of cases) {
    const level=Number(q);console.log('Starting '+name+' / '+level);
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
        window.__pointerLockRequests=0;Element.prototype.requestPointerLock=function(){window.__pointerLockRequests++;return Promise.resolve()};
        const raf=requestAnimationFrame.bind(window);let pending=[];window.requestAnimationFrame=cb=>(pending=[cb],1);window.__resume=()=>{window.requestAnimationFrame=raf;for(const cb of pending.splice(0))raf(cb)};
        const NativeAudio=AudioContext;window.AudioContext=class extends NativeAudio{constructor(...a){super(...a);window.__audio=this}};
        window.__hashes={};window.__hashWorld=async function walk(obj,p=''){for(const [k,v] of Object.entries(obj)){const n=p?p+'.'+k:k;if(v instanceof ArrayBuffer||ArrayBuffer.isView(v)){const b=v instanceof ArrayBuffer?new Uint8Array(v):new Uint8Array(v.buffer,v.byteOffset,v.byteLength);const h=await crypto.subtle.digest('SHA-256',b);window.__hashes[n]={bytes:b.length,sha256:Array.from(new Uint8Array(h),x=>x.toString(16).padStart(2,'0')).join('')};}else if(v&&typeof v==='object')await walk(v,n);}};
        window.__alloc={buffers:[],textures:[],pipelines:[]};
        ${timing||shipping?'':`for(const [method,key] of [['createBuffer','buffers'],['createTexture','textures']]){const orig=GPUDevice.prototype[method];GPUDevice.prototype[method]=function(d){window.__alloc[key].push(d);return orig.call(this,d)}};
        const pipe=GPUDevice.prototype.createRenderPipeline;GPUDevice.prototype.createRenderPipeline=function(d){window.__alloc.pipelines.push({vertex:d.vertex.entryPoint,buffers:d.vertex.buffers,constants:d.vertex.constants,fragment:d.fragment?.entryPoint,depthStencil:d.depthStencil,primitive:d.primitive,multisample:d.multisample});return pipe.call(this,d)};`}
        window.__readyMs=null;addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{if(document.body.className==='m'&&window.__readyMs===null)window.__readyMs=performance.now()-window.__start}).observe(document.body,{attributes:true,attributeFilter:['class']}));
      `},s);
      const url=shipping?new URL('../../index.html',import.meta.url).href:pathToFileURL(path.join(root,'variants',`${name}-${timing?'timing':'qa'}.html`)).href;
      await cdp.send('Page.navigate',{url},s);
      let state;
      for(let i=0;i<90;i++){state=await cdp.evaluate(s,`({ready:${shipping?"document.body?.className==='m'":"!!window.__visual"},body:document.body?.className,status:document.getElementById('s')?.textContent})`);if(state.ready||state.body?.includes('e'))break;await sleep(500);}
      assert.ok(state.ready,JSON.stringify({state,errors}));assert.deepEqual(errors,[]);
      const result={name,level,readyMs:await cdp.evaluate(s,'window.__readyMs'),worldMs:await cdp.evaluate(s,'window.__worldMs'),bakeMs:await cdp.evaluate(s,'window.__bakeMs'),errors,requests};report.tests.push(result);
      if(!report.adapter)report.adapter=await cdp.evaluate(s,'(async()=>{const a=await navigator.gpu.requestAdapter();return {vendor:a.info.vendor,architecture:a.info.architecture,description:a.info.description}})()');
      await cdp.evaluate(s,"document.getElementById('d').click();document.body.className='g';document.querySelector('canvas').style.cssText='transition:none;filter:none;transform:none;opacity:1';for(const id of ['m','o','i'])document.getElementById(id).style.display='none'",true);
      result.pointerLockSuppressed=await cdp.evaluate(s,'window.__pointerLockRequests');assert.ok(result.pointerLockSuppressed);assert.equal(await cdp.evaluate(s,'document.pointerLockElement===null'),true);
      await sleep(100);
      if(shipping){
        result.audio=await cdp.evaluate(s,'({state:window.__audio.state,sampleRate:window.__audio.sampleRate})');assert.equal(result.audio.state,'running');
        await cdp.evaluate(s,"window.__resume();dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}))");await sleep(200);await cdp.evaluate(s,"dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}))");assert.equal(await cdp.evaluate(s,'document.body.className'),'m');
      }else if(timing){
        result.benchmarks=[];for(const pose of [0,5,[0,.28,0,0,.28,-140],[-165,.28,10,-180,.4,10]])result.benchmarks.push({pose,...await cdp.evaluate(s,`__visual.bench(${JSON.stringify(pose)},120)`)});
      }else{
        result.hashes=await cdp.evaluate(s,'window.__hashes');result.allocations=await cdp.evaluate(s,'window.__alloc');result.sharedFarProof=await cdp.evaluate(s,'window.__sharedFarProof');result.views=[];
        const shot=async(label,pose,time=8)=>{const camera=await cdp.evaluate(s,`__visual.draw(${JSON.stringify(pose)},${time})`);assert.equal(camera.width,1280);assert.equal(camera.height,720);assert.equal(camera.detail,1);assert.equal(camera.level,level);const b=Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},s)).data,'base64');const file=`${name}-q${level}-${label}.png`;await fs.writeFile(path.join(root,'results',file),b);result.views.push({label,file,sha256:createHash('sha256').update(b).digest('hex'),...camera});};
        for(let p=0;p<6;p++)await shot('pose'+(p+1),p);
        const poses=await cdp.evaluate(s,'__visual.state().poses');
        for(const i of [0,3,5]){const p=poses[i],d=p.slice(3).map((v,k)=>v-p[k]),l=Math.hypot(...d);await shot('detail'+(i+1),p.map((v,k)=>k<3?v+d[k]/l*3:v));}
        for(const [label,p] of Object.entries({lagoon:[0,.28,0,0,.28,-140],west:[-140,.28,0,-170,1,0],'beach-wide':[-148,.28,8,-180,.8,10],'beach-near':[-165,.28,10,-180,.4,10],'beach-side':[-165,.28,-13,-177,.35,16],'beach-under':[-162,-2,8,-177,-.3,10]}))await shot(label,p);
        if(!quick){
          for(let i=1;i<=30;i++)await shot('time'+i,0,8+i/30);
          const p=poses[0],d=p.slice(3).map((v,k)=>v-p[k]),l=Math.hypot(d[0],d[2]);
          for(let i=-4;i<=4;i++){const x=-d[2]/l*i*.05,z=d[0]/l*i*.05;await shot('travel'+i,p.map((v,k)=>v+(k%3===0?x:k%3===2?z:0)));}
          result.swims=[];for(const [label,p,keys,n] of [['rise',[0,-2,0,0,-2,-140],['KeyE'],120],['dive',[0,.28,0,0,.28,-140],['KeyQ'],60],['shore',[-145,.28,10,-185,.28,10],['KeyW','KeyE','ShiftLeft'],300]]){const a=await cdp.evaluate(s,`__visual.swim(${JSON.stringify(p)},${JSON.stringify(keys)},${n})`);assert.ok(a.clearance>.25);assert.ok(a.end.camera[1]<=.280001);result.swims.push({label,...a});}
        }
        await cdp.evaluate(s,'__visual.reset();__visual.draw(0,8)');const before=await cdp.evaluate(s,'__visual.state()'),after=await cdp.evaluate(s,'__visual.move(30)');assert.notDeepEqual(before.camera,after.camera);result.movement={before,after};
        await cdp.evaluate(s,"dispatchEvent(new KeyboardEvent('keydown',{code:'KeyM'}));dispatchEvent(new KeyboardEvent('keydown',{code:'KeyM'}));dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}))");assert.equal(await cdp.evaluate(s,'document.body.className'),'m');
        result.audio=await cdp.evaluate(s,'({state:window.__audio.state,sampleRate:window.__audio.sampleRate})');assert.equal(result.audio.state,'running');await cdp.evaluate(s,'window.__resume()');await sleep(150);
      }
      assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(u=>/^https?:/.test(u)),[]);
      console.log(JSON.stringify({name,level,readyMs:result.readyMs,views:result.views?.length,benchmarks:result.benchmarks?.length}));
      await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
    } finally {cdp.listeners=cdp.listeners.filter(l=>l!==listener);await cdp.send('Target.closeTarget',{targetId});}
  }
  if(!timing&&!shipping)for(const t of report.tests){const b=report.tests.find(x=>x.name==='baseline'&&x.level===t.level);if(!b)continue;
    const expectedHashes=structuredClone(b.hashes);
    const shared=t.name==='shared-far'||t.name==='combined';
    if(shared){assert.equal(t.sharedFarProof.savedGPUBytes,expectedHashes['Wd.bigF.buf'].bytes);assert.ok(t.sharedFarProof.byteIdenticalCPUReconstruction);assert.ok(t.sharedFarProof.sameMetadata);delete expectedHashes['Wd.bigF.buf'];}
    assert.deepEqual(t.hashes,expectedHashes);assert.deepEqual(t.movement,b.movement);assert.deepEqual(t.swims,b.swims);
    const expected=structuredClone(b.allocations);
    if(t.name.startsWith('shadow16')||t.name==='combined'){expected.textures[0].format='depth16unorm';for(const p of expected.pipelines)if(p.depthStencil?.depthCompare==='less'){p.depthStencil.format='depth16unorm';p.depthStencil.depthBias=t.name.endsWith('bias2')?2:0;}}
    if(shared){const matches=expected.buffers.map((v,i)=>v.size===t.sharedFarProof.savedGPUBytes?i:-1).filter(i=>i>=0);assert.equal(matches.length,1);expected.buffers.splice(matches[0],1);const pipes=expected.pipelines.filter(p=>p.constants?.ROWS===3&&p.constants?.CUTOUT===true&&p.fragment==='fs');assert.equal(pipes.length,1);pipes[0].constants.WIDTH=1.5;pipes[0].buffers[0].arrayStride=72;}
    assert.deepEqual(t.allocations,expected);assert.deepEqual(t.views.map(v=>[v.label,v.camera,v.time,v.width,v.height,v.detail]),b.views.map(v=>[v.label,v.camera,v.time,v.width,v.height,v.detail]));t.dataAndResourcesPassed=true;
  }
  report.complete=true;
}finally{
  await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
  if(cdp){try{await cdp.send('Browser.close')}catch{}cdp.ws.close()}if(chrome.exitCode===null)chrome.kill();await sleep(250);await fs.rm(profile,{recursive:true,force:true,maxRetries:3}).catch(()=>{});
}
