import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { CDP } from '../demoscene/cdp.mjs';
const root = fileURLToPath(new URL('./', import.meta.url));
const closePoses=JSON.parse(await fs.readFile(new URL('poses.json',import.meta.url),'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const timing = process.argv.includes('--timing'), quick = process.argv.includes('--quick'), shipping = process.argv.includes('--shipping'), menuCheck = process.argv.includes('--menu-check');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const cases = args.length ? args.map(a => a.split(':')) : [0,1,2].flatMap(q => (shipping ? ['product'] : ['baseline','jelly']).map(n => [n,q]));
const report = { date: new Date().toISOString(), mode: shipping ? 'shipping' : timing ? 'timing' : 'qa', quick, viewport: { width:1280,height:720,deviceScaleFactor:1 }, tests:[] };
const output = path.join(root, 'results', process.env.JELLY_REPORT || (shipping ? 'shipping.json' : timing ? 'timing.json' : quick ? 'screen.json' : 'browser.json'));
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'abyssal-jelly-'));
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
        window.__actorDraws=[];const fishPipes=new WeakMap();const setPipe=GPURenderPassEncoder.prototype.setPipeline,drawIdx=GPURenderPassEncoder.prototype.drawIndexed;const active=new WeakMap();GPURenderPassEncoder.prototype.setPipeline=function(p){active.set(this,fishPipes.get(p));return setPipe.call(this,p)};GPURenderPassEncoder.prototype.drawIndexed=function(...a){if(active.get(this))window.__actorDraws.push([active.get(this),...a]);return drawIdx.apply(this,a)};const pipe=GPUDevice.prototype.createRenderPipeline;GPUDevice.prototype.createRenderPipeline=function(d){window.__alloc.pipelines.push({vertex:d.vertex.entryPoint,buffers:d.vertex.buffers,constants:d.vertex.constants,fragment:d.fragment?.entryPoint,depthStencil:d.depthStencil,primitive:d.primitive,multisample:d.multisample});const p=pipe.call(this,d);if(['vsFish','vsJelly'].includes(d.vertex.entryPoint))fishPipes.set(p,d.vertex.entryPoint);return p};`}
        window.__readyMs=null;addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{if(document.body.className==='m'&&window.__readyMs===null)window.__readyMs=performance.now()-window.__start}).observe(document.body,{attributes:true,attributeFilter:['class']}));
      `},s);
      const url=shipping?new URL('../../index.html',import.meta.url).href:pathToFileURL(path.join(root,'variants',`${name}-${timing?'timing':'qa'}.html`)).href;
      await cdp.send('Page.navigate',{url},s);
      let state;
      for(let i=0;i<90;i++){state=await cdp.evaluate(s,`({ready:${shipping?"document.body?.className==='m'":"!!window.__visual"},body:document.body?.className,status:document.getElementById('s')?.textContent})`);if(state.ready||state.body?.includes('e'))break;await sleep(500);}
      assert.ok(state.ready,JSON.stringify({state,errors}));assert.deepEqual(errors,[]);
      const result={name,level,readyMs:await cdp.evaluate(s,'window.__readyMs'),worldMs:await cdp.evaluate(s,'window.__worldMs'),bakeMs:await cdp.evaluate(s,'window.__bakeMs'),errors,requests};report.tests.push(result);
      if(!report.adapter)report.adapter=await cdp.evaluate(s,'(async()=>{const a=await navigator.gpu.requestAdapter();return {vendor:a.info.vendor,architecture:a.info.architecture,description:a.info.description}})()');
      if (menuCheck) {
        result.menu = await cdp.evaluate(s, `(()=>{const a=document.getElementById('a').getBoundingClientRect(),f=document.getElementById('f').getBoundingClientRect();return {credits:document.getElementById('credits').textContent,links:Array.from(document.querySelectorAll('#f a'),a=>a.href),noOverlap:a.bottom<=f.top,withinViewport:f.bottom<=innerHeight&&f.left>=0&&f.right<=innerWidth}})()`);
        assert.ok(result.menu.noOverlap && result.menu.withinViewport, JSON.stringify(result.menu));
        assert.match(result.menu.credits,/Maksymilian Dendura/);
        assert.deepEqual(result.menu.links,['https://github.com/nox-do/abyssal-garden','https://github.com/Noniv/abyssal-garden','https://ko-fi.com/noniv']);
        const shot=await cdp.send('Page.captureScreenshot',{format:'png'},s);
        await fs.writeFile(path.join(root,'results',`publication-menu-q${level}.png`),Buffer.from(shot.data,'base64'));
      }
      await cdp.evaluate(s,"document.getElementById('d').click();document.body.className='g';document.querySelector('canvas').style.cssText='transition:none;filter:none;transform:none;opacity:1';for(const id of ['m','o','i'])document.getElementById(id).style.display='none'",true);
      result.pointerLockSuppressed=await cdp.evaluate(s,'window.__pointerLockRequests');assert.ok(result.pointerLockSuppressed);assert.equal(await cdp.evaluate(s,'document.pointerLockElement===null'),true);
      await sleep(100);
      if(shipping){
        result.audio=await cdp.evaluate(s,'({state:window.__audio.state,sampleRate:window.__audio.sampleRate})');assert.equal(result.audio.state,'running');
        await cdp.evaluate(s,"window.__resume();dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}))");await sleep(200);await cdp.evaluate(s,"dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}))");assert.equal(await cdp.evaluate(s,'document.body.className'),'m');
      }else if(timing){
        result.benchmarks=[];for(const pose of [0,closePoses['jelly-close']])result.benchmarks.push({pose,...await cdp.evaluate(s,`__visual.bench(${JSON.stringify(pose)},60)`)});
      }else{
        result.hashes=await cdp.evaluate(s,'window.__hashes');result.allocations=await cdp.evaluate(s,'window.__alloc');result.jellyData=await cdp.evaluate(s,'window.__jellyData');result.floatingStones=await cdp.evaluate(s,'window.__floatCount');assert.equal(await cdp.evaluate(s,'window.__otherBob'),0);result.solidRanges=await cdp.evaluate(s,'window.__solidRanges');result.paths=await cdp.evaluate(s,quick?'__visual.jellyProbe([0,8,40])':'__visual.jellyProbe(Array.from({length:181},(_,i)=>i))');result.gpuCenters=await cdp.evaluate(s,'__visual.jellyGPU()');result.views=[];
        const shot=async(label,pose,time=8)=>{await cdp.evaluate(s,'window.__actorDraws=[]');const camera=await cdp.evaluate(s,`__visual.draw(${JSON.stringify(pose)},${time})`);assert.equal(camera.width,1280);assert.equal(camera.height,720);assert.equal(camera.detail,1);assert.equal(camera.level,level);const b=Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},s)).data,'base64');const file=`${name}-q${level}-${label}.png`;await fs.writeFile(path.join(root,'results',file),b);result.actorDraws=await cdp.evaluate(s,'window.__actorDraws');result.views.push({label,file,sha256:createHash('sha256').update(b).digest('hex'),...camera});};
        for(let p=0;p<6;p++)await shot('pose'+(p+1),p);
        for(const [label,p] of Object.entries({wide:[-18,-12,18,-18,-12,4],kelp:[10,-13,-70,10,-13,-88],grotto:[19,-13,83,19,-13,98],surface:[0,.28,0,0,-5,-12]}))await shot(label,p);
        for(const [label,p] of Object.entries(closePoses))await shot(label,p);
        if(!quick){
          for(const [i,h] of [-.08,-.065,-.055,-.03,0,.03,.08].entries()){const p=[...closePoses['surface-over-jelly']];p[1]=h;await shot('waterline-step'+i,p,8);}
          for(const [label,p] of Object.entries(closePoses).filter(([label])=>label.endsWith('-close')))for(let i=1;i<=12;i++)await shot(label+'-time'+i,p,8+i/30);
          for(let i=1;i<=12;i++)await shot('pulse'+i,closePoses['jelly-close'],8+i*.7);
          for(const time of [20,40,80])await shot('jelly-later'+time,closePoses['jelly-close'],time);
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
    const hashes=structuredClone(t.hashes),bh=structuredClone(b.hashes);
    for(const h of [hashes,bh])for(const k of ['Wd.solids.data','Wd.jelly','meshes.27.vb','meshes.27.ib'])delete h[k];
    assert.deepEqual(hashes,bh);assert.deepEqual(t.movement,b.movement);
    assert.deepEqual(t.actorDraws.filter(d=>d[0]==='vsFish'),b.actorDraws.filter(d=>d[0]==='vsFish'));
    if(t.name==='jelly'){
      assert.equal(t.floatingStones,0);assert.ok(b.floatingStones>0);assert.ok(t.jellyData.length>0&&t.jellyData.length<=40*8);
      assert.ok(t.paths.minClearance>.05,JSON.stringify(t.paths));assert.ok(t.paths.maxY<-.5);
      assert.equal(b.hashes['Wd.solids.data'].bytes-t.hashes['Wd.solids.data'].bytes,b.floatingStones*48);
      assert.equal(t.actorDraws.filter(d=>d[0]==='vsJelly').length,1);
    }
    const expected=structuredClone(b.allocations);
    if(t.name==='jelly'){
      const solidBytes=b.hashes['Wd.solids.data'].bytes+48;const sb=expected.buffers.filter(d=>d.size===solidBytes);assert.equal(sb.length,1);sb[0].size=t.hashes['Wd.solids.data'].bytes+48;
      for(const [field,divisor] of [['vb',1],['ib',2]]){
        const before=Object.entries(b.hashes).filter(([k])=>/^meshes\.\d+\./.test(k)&&k.endsWith('.'+field)).reduce((s,[k,v])=>s+v.bytes/divisor,0);
        const matches=expected.buffers.filter(d=>d.size===before);assert.equal(matches.length,1);matches[0].size=Math.ceil((before+t.hashes['meshes.27.'+field].bytes/divisor)/4)*4;
      }
      const actual=structuredClone(t.allocations);
      const jb=actual.buffers.findIndex(d=>d.size===t.hashes['Wd.jelly'].bytes);assert.ok(jb>=0);actual.buffers.splice(jb,1);
      const jp=actual.pipelines.findIndex(d=>d.vertex==='vsJelly');assert.ok(jp>=0);actual.pipelines.splice(jp,1);
      assert.deepEqual(actual,expected);
    }else assert.deepEqual(t.allocations,expected);
    assert.deepEqual(t.views.map(v=>[v.label,v.camera,v.time,v.width,v.height,v.detail]),b.views.map(v=>[v.label,v.camera,v.time,v.width,v.height,v.detail]));t.dataAndResourcesPassed=true;
  }
  report.complete=true;
}finally{
  await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
  if(cdp){try{await cdp.send('Browser.close')}catch{}cdp.ws.close()}if(chrome.exitCode===null)chrome.kill();await sleep(250);await fs.rm(profile,{recursive:true,force:true,maxRetries:3}).catch(()=>{});
}
