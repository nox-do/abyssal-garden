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
const quick = process.argv.includes('--quick');
const boundary = process.argv.includes('--boundary');
const memory = process.argv.includes('--memory');
const beach = process.argv.includes('--beach');
const collisionInfo = process.argv.includes('--collision-info');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const cases = args.length ? args.map(s => s.split(':')) : ['0','1','2'].flatMap(q => (shipping?['product']:beach?['beach-before','beach']:memory?['memory-before','memory']:boundary?['boundary-before','boundary']:['baseline','surface']).map(n => [n,q]));
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
const reportPath=path.join(root,'results',process.env.VISUAL_REPORT || (beach?'beach-browser.json':memory?'memory-browser.json':boundary?'boundary-browser.json':shipping?'shipping.json':timing?'timing.json':'browser.json'));
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
        const raf=requestAnimationFrame.bind(window);let pending=[];window.requestAnimationFrame=cb=>(pending=[cb],1);
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
      const result={name,level,readyMs:await cdp.evaluate(s,'window.__readyMs'),worldMs:await cdp.evaluate(s,'window.__worldMs'),collisionMs:await cdp.evaluate(s,'window.__collisionMs'),errors,requests};
      report.tests.push(result);
      if(memory)result.retainedCPU=await cdp.evaluate(s,'window.__retainedCPU');
      if(beach&&!timing)result.bounds=await cdp.evaluate(s,'window.__bounds');
      await cdp.evaluate(s,`document.getElementById('d').click();document.body.className='g';document.querySelector('canvas').style.cssText='transition:none;filter:none;transform:none;opacity:1';for(const id of ['m','o','i'])document.getElementById(id).style.display='none'`,true);
      result.pointerLockSuppressed=await cdp.evaluate(s,'window.__pointerLockRequests');
      assert.equal(await cdp.evaluate(s,'document.pointerLockElement===null'),true);
      await sleep(100);
      if(collisionInfo){
        result.layers=await cdp.evaluate(s,'window.__collisionLayers');
      } else if(shipping) {
        assert.ok(result.pointerLockSuppressed>0);
        result.audio=await cdp.evaluate(s,'({state:window.__audio?.state,sampleRate:window.__audio?.sampleRate})');assert.equal(result.audio.state,'running');
        await cdp.evaluate(s,"window.__resume();dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}))");await sleep(200);
        await cdp.evaluate(s,"dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));dispatchEvent(new KeyboardEvent('keydown',{code:'KeyM'}));dispatchEvent(new KeyboardEvent('keydown',{code:'KeyM'}));dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}))");
        assert.equal(await cdp.evaluate(s,'document.body.className'),'m');await sleep(300);
      } else if(timing) {
        result.benchmarks=[];
        for(const pose of [0,5,[0,.28,0,0,.28,-140],...(beach?[[-165,.28,10,-180,.4,10]]:[])])result.benchmarks.push({pose,...await cdp.evaluate(s,`window.__visual.bench(${JSON.stringify(pose)},120)`)});
      } else {
        result.hashes=await cdp.evaluate(s,'window.__hashes');result.allocations=await cdp.evaluate(s,'window.__alloc');result.views=[];
        const shot=async(label,pose,time,lab=false,side=0)=>{
          const camera=await cdp.evaluate(s,`window.__visual.${lab?'lab':'draw'}(${JSON.stringify(pose)},${time}${lab?','+side:''})`);
          assert.equal(camera.width,1280);assert.equal(camera.height,720);assert.equal(camera.detail,1);assert.equal(camera.level,level);
          const bytes=Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},s)).data,'base64');
          const file=`${name}-q${level}-${label}.png`;await fs.writeFile(path.join(root,'results',file),bytes);
          result.views.push({label,file,sha256:sha256(bytes),...camera});
        };
        for(let pose=0;pose<6;pose++)await shot('pose'+(pose+1),pose,8);
        // Same scene, closer by a known camera displacement along its view direction.
        const poses=await cdp.evaluate(s,'window.__visual.state().poses');
        for(const i of [0,3,5]){const p=poses[i],d=p.slice(3).map((v,k)=>v-p[k]),l=Math.hypot(...d);const close=p.map((v,k)=>k<3?v+d[k]/l*3:v);await shot('detail'+(i+1),close,8);}
        const surfaceViews={
          lagoon:[0,.28,0,0,.28,-140], coast:[0,.28,-140,0,1,-170],
          east:[140,.28,0,170,1,0], west:[-140,.28,0,-170,1,0],
          down:[0,.28,0,2,-10,-5], sun:[0,.28,0,27,100,-24],
          justBelow:[0,-.2,0,0,-.2,-140]
        };
        for(const [label,pose] of Object.entries(surfaceViews))await shot(label,pose,8);
        if(beach){
          for(const [label,pose] of Object.entries({
            'beach-wide':[-148,.28,8,-180,.8,10], 'beach-near':[-165,.28,10,-180,.4,10],
            'beach-side':[-165,.28,-13,-177,.35,16], 'beach-under':[-162,-2,8,-177,-.3,10]
          }))await shot(label,pose,8);
        }
        if(boundary||beach){
          result.shore=await cdp.evaluate(s,`(async()=>{
            const trials=[];
            for(const y of [.28,-2,-12,-30,-40])for(let a=0;a<16;a++){
              const theta=a*Math.PI/8,sx=Math.sin(theta),sz=-Math.cos(theta);let r=148;
              while(r>20&&Math.max(__visual.rock(sx*r,y,sz*r),__visual.rock(sx*r,y-.9,sz*r))>-.6)r-=2;
              if(r<=20)throw Error('No water start at '+a+','+y);
              const pose=[sx*r,y,sz*r,sx*(r+20),y,sz*(r+20)];
              const swim=await __visual.swim(pose,y===.28?['KeyW','KeyE','ShiftLeft']:['KeyW','ShiftLeft'],600,true);
              trials.push({angle:a,y,start:pose,...swim});
            }
            ${beach?`for(const z of [-18,-8,10,24,38])for(const y of [.28,-1.5]){
              const pose=[-145,y,z,-185,y,z];
              const swim=await __visual.swim(pose,y===.28?['KeyW','KeyE','ShiftLeft']:['KeyW','ShiftLeft'],600,true);
              trials.push({label:'beach-'+z,angle:null,y,start:pose,...swim});
            }`:''}
            return trials;
          })()`);
          for(const swim of result.shore){
            assert.ok(swim.states.every(p=>p.every(Number.isFinite)&&p[1]<=.280001&&Math.hypot(p[0],p[2])<=((name==='boundary'||beach)?180.6:150.6)), 'Invalid movement');
            assert.ok(swim.clearance>.25,'Rock penetration: '+JSON.stringify({angle:swim.angle,y:swim.y,clearance:swim.clearance}));
            swim.checkedFrames=swim.states.length;
            swim.maxRadius=Math.max(...swim.states.map(p=>Math.hypot(p[0],p[2])));
            swim.maxEyeHeight=Math.max(...swim.states.map(p=>p[1]));
            swim.samples=swim.states.filter((_,i)=>i%60===0||i===swim.states.length-1);
            delete swim.states;
          }
          if(name==='boundary'||beach){
            // A closed rock ring must stop the swimmer before the fallback radius.
            result.outerRing=await cdp.evaluate(s,`(()=>{let least=1;for(let a=0;a<720;a++)for(let y=-52;y<=.28;y+=.25){const theta=a*Math.PI/360;least=Math.min(least,__visual.rock(178*Math.sin(theta),y,-178*Math.cos(theta)));}return {radius:178,least};})()`);
            assert.ok(result.outerRing.least>(beach?0:.5),'Outer coast is not closed');
            assert.ok(result.shore.every(t=>Math.hypot(t.end.camera[0],t.end.camera[2])<177),'Reached safety limit');
            for(const a of [0,4,12]){
              const trial=result.shore.find(t=>t.y===.28&&t.angle===a);
              assert.ok(Math.hypot(trial.end.camera[0],trial.end.camera[2])>155,'Coast still unreachable');
              const p=trial.end.camera;
              await shot('reachable-coast'+a,[...p.slice(0,3),p[0]+Math.sin(a*Math.PI/8)*20,p[1],p[2]-Math.cos(a*Math.PI/8)*20],8);
            }
          }
        }
        if(!quick){
          for(const y of [-.1,-.03,-.005,0,.005,.03,.1,.28])await shot('cross'+y,[0,y,0,0,y,-140],8);
          for(let i=1;i<=15;i++)await shot('wave'+i,beach?[-165,.28,10,-180,.4,10]:surfaceViews.coast,8+i/30);
          for(const t of [9,10])await shot('wave-time'+t,beach?[-165,.28,10,-180,.4,10]:surfaceViews.coast,t);
          if(name==='surface'){
            result.swims=[];
            for(const [label,pose,keys,n] of [
              ['rise',[0,-2,0,0,-2,-140],['KeyE'],120],
              ['dive',[0,.28,0,0,.28,-140],['KeyQ'],60],
              ['island',[0,.28,-85,0,.28,-106],['KeyW','KeyE','ShiftLeft'],180],
              ['north',[0,.28,-120,0,.28,-170],['KeyW','KeyE','ShiftLeft'],180],
              ['east',[120,.28,0,170,.28,0],['KeyW','KeyE','ShiftLeft'],180],
              ['west',[-120,.28,0,-170,.28,0],['KeyW','KeyE','ShiftLeft'],180]
            ]){
              const swim=await cdp.evaluate(s,`window.__visual.swim(${JSON.stringify(pose)},${JSON.stringify(keys)},${n})`);
              assert.ok(swim.states.every(p=>p.every(Number.isFinite)&&p[1]<=.280001&&Math.hypot(p[0],p[2])<=180.6));
              if(label==='rise')assert.ok(swim.end.camera[1]>.25);
              if(label==='dive')assert.ok(swim.end.camera[1]<-2);
              assert.ok(swim.collision.every(x=>Number.isFinite(x)&&x<-.3),'Swimmer inside shore: '+JSON.stringify(swim.collision));
              result.swims.push({label,...swim});
            }
          }
        }
        await cdp.evaluate(s,'window.__visual.reset();window.__visual.draw(0,8)');
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
  if(!timing&&!shipping&&!collisionInfo) for(const test of report.tests) {
    const base=report.tests.find(t=>t.name===(beach?'beach-before':memory?'memory-before':boundary?'boundary-before':'baseline')&&t.level===test.level);if(!base)continue;
    const world=h=>Object.fromEntries(Object.entries(h).filter(([k])=>k!=='CI'&&k!=='CG'&&(!beach||(k!=='Wd.gm'&&!k.endsWith('.lo')))));
    assert.deepEqual(world(test.hashes),world(base.hashes),'Generated world/meshes changed');
    if(beach){
      assert.equal(test.bounds.length,base.bounds.length);
      for(let i=0;i<test.bounds.length;i++){
        assert.deepEqual(test.bounds[i].hi,base.bounds[i].hi);
        assert.ok(test.bounds[i].lo.every((v,j)=>v<=base.bounds[i].lo[j]));
      }
      test.changedData=Object.keys(test.hashes).filter(k=>test.hashes[k].sha256!==base.hashes[k].sha256);
    }
    if(memory&&test.name==='memory'){
      assert.deepEqual(test.hashes,base.hashes,'World/meshes/uploaded index values changed');
      assert.equal(test.retainedCPU,0);
      const expected=structuredClone(base.allocations);
      const changed=test.allocations.buffers.map((b,i)=>JSON.stringify(b)!==JSON.stringify(expected.buffers[i])?i:-1).filter(i=>i>=0);
      assert.equal(changed.length,1);expected.buffers[changed[0]].size/=2;
      assert.deepEqual(test.allocations,expected,'Unexpected GPU allocation change');
      test.freedCPUBytes=base.retainedCPU;test.savedGPUBytes=test.allocations.buffers[changed[0]].size;
    }else assert.deepEqual(test.allocations,base.allocations,'GPU resource descriptors changed');
    const common=test.views.filter(v=>base.views.some(b=>b.label===v.label)&&(!beach||!v.label.startsWith('reachable-coast')));
    const baseViews=base.views.filter(v=>common.some(c=>c.label===v.label));
    assert.deepEqual(common.map(v=>[v.camera,v.time,v.width,v.height,v.detail]),baseViews.map(v=>[v.camera,v.time,v.width,v.height,v.detail]));
    if(boundary)assert.deepEqual(common.map(v=>v.sha256),base.views.map(v=>v.sha256),'Fixed-view image changed');
    if(memory)test.imageHashDifferences=common.filter(v=>v.sha256!==base.views.find(b=>b.label===v.label).sha256).map(v=>v.label); // pixel-level validation is in memory-analyze.py
    assert.deepEqual(test.movement,base.movement);test.sameWorldAndAllocations=true;
  }
} finally {
  await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  if(cdp){try{await cdp.send('Browser.close');}catch{}cdp.ws.close();}if(chrome.exitCode===null)chrome.kill();
  await sleep(250);await fs.rm(profile,{recursive:true,force:true,maxRetries:3}).catch(()=>{});
}
